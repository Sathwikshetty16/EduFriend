
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth, db
from datetime import datetime
import traceback
import base64
import os
from io import BytesIO
import google.generativeai as genai
import PyPDF2
import docx
import io as io_module
import json
from collections import defaultdict
from simple_rag import rag_system

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# Initialize Firebase Admin
try:
    cred = credentials.Certificate('firebase_config.json')
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://ecstatic-maxim-353907-default-rtdb.firebaseio.com'
    })
    print("✅ Firebase initialized successfully")
except Exception as e:
    print(f"❌ Firebase initialization error: {e}")

# Initialize Gemini AI
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-2.0-flash-exp')
print("✅ Gemini AI initialized")
def extract_text_from_pdf(file_content):
    """Extract text from PDF file content"""
    try:
        pdf_reader = PyPDF2.PdfReader(io_module.BytesIO(file_content))
        return "".join(page.extract_text() + "\n" for page in pdf_reader.pages)
    except Exception as e:
        print(f"Error extracting PDF: {e}")
        return None

def extract_text_from_docx(file_content):
    """Extract text from DOCX file content"""
    try:
        doc = docx.Document(io_module.BytesIO(file_content))
        return "\n".join(para.text for para in doc.paragraphs)
    except Exception as e:
        print(f"Error extracting DOCX: {e}")
        return None


# Initialize RAG with existing materials
def initialize_rag_with_materials():
    """Load existing materials into RAG system on startup"""
    try:
        print("🔄 Loading existing materials into RAG...")
        materials_ref = db.reference('study_materials')
        materials_data = materials_ref.get()
        
        if materials_data:
            count = 0
            for material_id, material in materials_data.items():
                try:
                    file_content = base64.b64decode(material.get('fileContent', ''))
                    file_name = material.get('fileName', '')
                    file_ext = file_name.rsplit('.', 1)[1].lower() if '.' in file_name else ''
                    
                    text = ""
                    if file_ext == 'pdf':
                        text = extract_text_from_pdf(file_content)
                    elif file_ext in ['docx', 'doc']:
                        text = extract_text_from_docx(file_content)
                    
                    if text and len(text.strip()) > 50:
                        rag_system.add_document(
                            doc_id=material_id,
                            doc_name=material.get('name', file_name),
                            text=text
                        )
                        count += 1
                except Exception as e:
                    print(f"⚠️  Error loading material {material_id}: {e}")
            
            print(f"✅ Loaded {count} materials into RAG system")
            stats = rag_system.get_stats()
            print(f"📊 RAG Stats: {stats['totalChunks']} chunks from {stats['uniqueDocuments']} documents")
    except Exception as e:
        print(f"❌ Error initializing RAG: {e}")

# Initialize RAG on startup
initialize_rag_with_materials()

# ============ Authentication Routes ============

@app.route('/api/auth/save-user-data', methods=['POST'])
def save_user_data():
    """Save additional user data after Firebase Auth signup"""
    try:
        data = request.json
        uid = data.get('uid')
        email = data.get('email')
        full_name = data.get('fullName')
        user_type = data.get('userType', 'student')
        current_grade = data.get('currentGrade', '')

        if not uid or not email or not full_name:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400

        user_data = {
            'uid': uid, 'email': email, 'fullName': full_name,
            'userType': user_type, 'currentGrade': current_grade,
            'createdAt': datetime.utcnow().isoformat()
        }

        collection = 'teachers' if user_type == 'teacher' else 'students'
        ref = db.reference(f'{collection}/{uid}')
        ref.set(user_data)
        
        print(f"✅ User data saved: {collection}/{uid}")
        return jsonify({'success': True, 'message': 'User data saved successfully'}), 201
    except Exception as e:
        print(f"❌ Save user data error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/auth/user/<uid>', methods=['GET'])
def get_user(uid):
    """Get user data by UID"""
    try:
        teacher_ref = db.reference(f'teachers/{uid}')
        teacher_data = teacher_ref.get()
        if teacher_data:
            return jsonify({'success': True, 'user': {'fullName': teacher_data.get('fullName'), 'userType': 'teacher', 'email': teacher_data.get('email')}}), 200
        
        student_ref = db.reference(f'students/{uid}')
        student_data = student_ref.get()
        if student_data:
            return jsonify({'success': True, 'user': {'fullName': student_data.get('fullName'), 'userType': 'student', 'currentGrade': student_data.get('currentGrade'), 'email': student_data.get('email')}}), 200
            
        return jsonify({'success': False, 'error': 'User not found'}), 404
    except Exception as e:
        print(f"❌ Get user error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 400

# ============ Study Materials Routes ============

@app.route('/api/materials', methods=['GET'])
def get_materials():
    """Get all study materials"""
    try:
        materials_ref = db.reference('study_materials')
        materials_data = materials_ref.get()
        materials = []
        if materials_data:
            for material_id, material in materials_data.items():
                material['id'] = material_id
                if 'fileContent' in material:
                    del material['fileContent']
                materials.append(material)
        materials.sort(key=lambda x: x.get('uploadDate', ''), reverse=True)
        return jsonify({'success': True, 'materials': materials}), 200
    except Exception as e:
        print(f"❌ Get materials error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 400

# ============ Text Extraction Functions ============


@app.route('/api/materials/upload', methods=['POST'])
def upload_material():
    """Upload a new study material and add to RAG system"""
    try:
        material_name = request.form.get('materialName')
        material_type = request.form.get('materialType')
        teacher_id = request.form.get('teacherId')
        file = request.files.get('file')

        if not all([material_name, material_type, teacher_id, file]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400

        file_content = file.read()
        if len(file_content) > 10485760:  # 10MB limit
            return jsonify({'success': False, 'error': 'File too large. Maximum size is 10MB'}), 400
        
        # Extract text for RAG
        file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        text = ""
        if file_ext == 'pdf':
            text = extract_text_from_pdf(file_content)
        elif file_ext in ['docx', 'doc']:
            text = extract_text_from_docx(file_content)
        
        file_base64 = base64.b64encode(file_content).decode('utf-8')
        
        # Save to Firebase
        materials_ref = db.reference('study_materials')
        new_material_ref = materials_ref.push()
        material_data = {
            'name': material_name, 
            'type': material_type, 
            'fileName': file.filename,
            'fileContent': file_base64, 
            'teacherId': teacher_id,
            'uploadDate': datetime.utcnow().isoformat()
        }
        new_material_ref.set(material_data)
        
        # Add to RAG system
        if text and len(text.strip()) > 50:
            try:
                rag_system.add_document(
                    doc_id=new_material_ref.key,
                    doc_name=material_name,
                    text=text
                )
                print(f"✅ Material added to RAG: {material_name}")
            except Exception as rag_error:
                print(f"⚠️  RAG indexing failed: {rag_error}")
        
        return jsonify({'success': True, 'message': 'Material uploaded successfully', 'materialId': new_material_ref.key}), 201
    except Exception as e:
        print(f"❌ Upload error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/materials/<material_id>/download', methods=['GET'])
def download_material(material_id):
    """Download a study material"""
    try:
        material_ref = db.reference(f'study_materials/{material_id}')
        material_data = material_ref.get()
        if not material_data:
            return jsonify({'success': False, 'error': 'Material not found'}), 404

        file_content = base64.b64decode(material_data['fileContent'])
        return send_file(
            BytesIO(file_content),
            mimetype='application/octet-stream',
            as_attachment=True,
            download_name=material_data['fileName']
        )
    except Exception as e:
        print(f"❌ Download error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/materials/<material_id>', methods=['DELETE'])
def delete_material(material_id):
    """Delete a study material and remove from RAG"""
    try:
        material_ref = db.reference(f'study_materials/{material_id}')
        if not material_ref.get():
            return jsonify({'success': False, 'error': 'Material not found'}), 404
        
        # Remove from RAG
        try:
            rag_system.remove_document(material_id)
            print(f"✅ Material removed from RAG: {material_id}")
        except Exception as rag_error:
            print(f"⚠️  RAG removal failed: {rag_error}")
        
        material_ref.delete()
        return jsonify({'success': True, 'message': 'Material deleted successfully'}), 200
    except Exception as e:
        print(f"❌ Delete error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 400

# ============ Quiz Generation with RAG ============

@app.route('/api/quiz/generate', methods=['POST'])
def generate_quiz():
    """Generate quiz using RAG-enhanced context"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file part in the request'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No selected file'}), 400

        teacher_id = request.form.get('teacherId')
        if not teacher_id:
            return jsonify({'success': False, 'error': 'Teacher ID is required'}), 400

        file_content = file.read()
        file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''

        text = ""
        if file_ext == 'pdf':
            text = extract_text_from_pdf(file_content)
        elif file_ext in ['docx', 'doc']:
            text = extract_text_from_docx(file_content)
        else:
            return jsonify({'success': False, 'error': 'Unsupported file type.'}), 400

        if not text or len(text.strip()) < 50:
            return jsonify({'success': False, 'error': 'Could not extract sufficient text.'}), 400

        num_questions = int(request.form.get('numQuestions', 10))
        toughness = request.form.get('toughness', 'Medium')
        target_grade = request.form.get('targetGrade', 'Grade 10')
        
        # Use RAG to find related content from other materials
        rag_results = rag_system.search(text[:500], top_k=3)  # Search using first part of doc
        additional_context = ""
        if rag_results:
            additional_context = "\n\nRelated content from study materials:\n"
            for i, result in enumerate(rag_results[:2], 1):
                additional_context += f"\n{i}. {result['content'][:300]}...\n"
        
        prompt = f"""
Based on the following material, generate {num_questions} multiple-choice questions suitable for {target_grade} students at {toughness} difficulty level.

PRIMARY MATERIAL:
{text[:3000]}

{additional_context}

Requirements:
1. Generate exactly {num_questions} questions
2. Each question should have 4 options
3. Mark the correct answer index (0-3)
4. Provide a brief, clear explanation for the correct answer
5. Questions should be at {toughness} difficulty level
6. Suitable for {target_grade} students
7. Make questions diverse and comprehensive

Format the response as a valid JSON array with this EXACT structure:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Brief explanation why this is correct"
  }}
]

Respond ONLY with the JSON array, no additional text or markdown.
"""
        
        response = gemini_model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Clean the response
        response_text = response_text.replace('```json', '').replace('```', '').strip()

        try:
            questions = json.loads(response_text)
            if not isinstance(questions, list) or len(questions) == 0:
                raise ValueError("Invalid questions format")
        except (json.JSONDecodeError, ValueError) as e:
            print(f"❌ JSON parsing error. Response: {response_text[:500]}")
            return jsonify({'success': False, 'error': 'Failed to parse AI response'}), 500

        # Save quiz to database
        quizzes_ref = db.reference('quizzes')
        new_quiz_ref = quizzes_ref.push()
        quiz_data = {
            'title': f"Quiz: {file.filename.rsplit('.', 1)[0]}",
            'toughness': toughness,
            'targetGrade': target_grade,
            'teacherId': teacher_id,
            'questions': questions,
            'numQuestions': len(questions),
            'createdAt': datetime.utcnow().isoformat()
        }
        new_quiz_ref.set(quiz_data)
        
        print(f"✅ Quiz generated with RAG enhancement: {new_quiz_ref.key}")
        return jsonify({'success': True, 'message': 'Quiz generated successfully', 'quizId': new_quiz_ref.key}), 201

    except Exception as e:
        print(f"❌ Quiz generation error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': f'Quiz generation failed: {str(e)}'}), 500

# ============ Quiz Routes ============

@app.route('/api/quizzes', methods=['GET'])
def get_quizzes():
    """Get all quizzes for a teacher"""
    try:
        teacher_id = request.args.get('teacherId')
        if not teacher_id:
            return jsonify({'success': False, 'error': 'Teacher ID required'}), 400

        quizzes_ref = db.reference('quizzes')
        all_quizzes = quizzes_ref.get() or {}
        
        quizzes = []
        for quiz_id, quiz_data in all_quizzes.items():
            if quiz_data.get('teacherId') == teacher_id:
                quiz_data['id'] = quiz_id
                quiz_data.pop('questions', None)
                quizzes.append(quiz_data)
        
        quizzes.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        return jsonify({'success': True, 'quizzes': quizzes}), 200
    except Exception as e:
        print(f"❌ Get quizzes error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quizzes/<quiz_id>', methods=['GET'])
def get_quiz(quiz_id):
    """Get a specific quiz with all questions"""
    try:
        quiz_ref = db.reference(f'quizzes/{quiz_id}')
        quiz_data = quiz_ref.get()
        if not quiz_data:
            return jsonify({'success': False, 'error': 'Quiz not found'}), 404
        quiz_data['id'] = quiz_id
        return jsonify({'success': True, 'quiz': quiz_data}), 200
    except Exception as e:
        print(f"❌ Get quiz error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quizzes/<quiz_id>', methods=['DELETE'])
def delete_quiz(quiz_id):
    """Delete a quiz"""
    try:
        quiz_ref = db.reference(f'quizzes/{quiz_id}')
        if not quiz_ref.get():
            return jsonify({'success': False, 'error': 'Quiz not found'}), 404
        quiz_ref.delete()
        return jsonify({'success': True, 'message': 'Quiz deleted successfully'}), 200
    except Exception as e:
        print(f"❌ Delete quiz error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ Student Quiz Routes ============

@app.route('/api/student/<student_id>/quizzes', methods=['GET'])
def get_quizzes_for_student(student_id):
    """Get all quizzes for a specific student based on their grade"""
    try:
        student_ref = db.reference(f'students/{student_id}')
        student_data = student_ref.get()
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        student_grade = student_data.get('currentGrade')
        if not student_grade:
            return jsonify({'success': False, 'error': 'Student grade not found'}), 400

        quizzes_ref = db.reference('quizzes')
        all_quizzes = quizzes_ref.get() or {}
        
               
        quizzes = []
        for quiz_id, quiz_data in all_quizzes.items():
            # Normalize grades by extracting numbers to handle format differences (e.g., "10" vs "Grade 10")
            student_grade_num_str = ''.join(filter(str.isdigit, str(student_grade)))
            quiz_target_grade_str = ''.join(filter(str.isdigit, str(quiz_data.get('targetGrade'))))

            if student_grade_num_str and quiz_target_grade_str and student_grade_num_str == quiz_target_grade_str:
                quiz_data['id'] = quiz_id
                quiz_data.pop('questions', None)
                quizzes.append(quiz_data)
        
        quizzes.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        return jsonify({'success': True, 'quizzes': quizzes}), 200
    except Exception as e:
        print(f"❌ Get quizzes for student error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quiz/submit', methods=['POST'])
def submit_quiz():
    """Submit a quiz attempt and calculate score with RAG-enhanced explanations"""
    try:
        data = request.json
        student_id = data.get('studentId')
        quiz_id = data.get('quizId')
        answers = data.get('answers', [])
        time_taken = data.get('timeTaken', 0)

        if not all([student_id, quiz_id]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400

        # Get quiz data
        quiz_ref = db.reference(f'quizzes/{quiz_id}')
        quiz_data = quiz_ref.get()
        if not quiz_data:
            return jsonify({'success': False, 'error': 'Quiz not found'}), 404

        questions = quiz_data.get('questions', [])
        if len(answers) != len(questions):
            return jsonify({'success': False, 'error': 'Invalid number of answers'}), 400

        # Calculate score and enhance explanations with RAG
        score = 0
        detailed_results = []
        weak_topics = []
        
        for i, (question, user_answer) in enumerate(zip(questions, answers)):
            is_correct = user_answer == question['correctAnswer']
            if is_correct:
                score += 1
            else:
                weak_topics.append(question['question'])
            
            # For wrong answers, enhance explanation with RAG
            enhanced_explanation = question.get('explanation', '')
            if not is_correct and user_answer != -1:
                try:
                    # Search for related content
                    rag_results = rag_system.search(question['question'], top_k=2, min_similarity=0.4)
                    if rag_results:
                        enhanced_explanation += "\n\n📚 Related study material:\n"
                        for result in rag_results[:1]:
                            enhanced_explanation += f"From '{result['metadata']['docName']}': {result['content'][:200]}..."
                except Exception as rag_error:
                    print(f"RAG enhancement error: {rag_error}")
            
            detailed_results.append({
                'questionIndex': i,
                'question': question['question'],
                'options': question['options'],
                'userAnswer': user_answer,
                'correctAnswer': question['correctAnswer'],
                'isCorrect': is_correct,
                'explanation': enhanced_explanation
            })

        # Save quiz attempt
        attempts_ref = db.reference('quiz_attempts')
        new_attempt_ref = attempts_ref.push()
        attempt_data = {
            'studentId': student_id,
            'quizId': quiz_id,
            'quizTitle': quiz_data.get('title', 'Untitled Quiz'),
            'score': score,
            'totalQuestions': len(questions),
            'percentage': round((score / len(questions)) * 100, 2),
            'answers': answers,
            'detailedResults': detailed_results,
            'weakTopics': weak_topics,
            'timeTaken': time_taken,
            'completedAt': datetime.utcnow().isoformat(),
            'toughness': quiz_data.get('toughness'),
            'targetGrade': quiz_data.get('targetGrade')
        }
        # Generate resource recommendations for weak topics
        resource_recommendations = {}
        if weak_topics:
            resource_recommendations = generate_resource_recommendations(weak_topics[:3]) # Limit to 3 topics
        
        attempt_data['resourceRecommendations'] = resource_recommendations
        new_attempt_ref.set(attempt_data)

        print(f"✅ Quiz attempt saved: {new_attempt_ref.key} - Score: {score}/{len(questions)}")
        
        return jsonify({
            'success': True,
            'message': 'Quiz submitted successfully',
            'attemptId': new_attempt_ref.key,
            'score': score,
            'totalQuestions': len(questions),
            'percentage': attempt_data['percentage'],
            'detailedResults': detailed_results,
            'resourceRecommendations': resource_recommendations
        }), 201

    except Exception as e:
        print(f"❌ Submit quiz error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

def generate_resource_recommendations(weak_topics):
    """Generate online, YouTube, and study material recommendations"""
    if not weak_topics:
        return {}

    # Find relevant study materials using RAG
    study_materials = []
    for topic in weak_topics:
        try:
            rag_results = rag_system.search(topic, top_k=1, min_similarity=0.3)
            if rag_results:
                material = {
                    "title": rag_results[0]['metadata']['docName'],
                    "description": f"Relevant content: \"{rag_results[0]['content'][:100]}...\"",
                    "id": rag_results[0]['metadata']['docId']
                }
                if not any(m['id'] == material['id'] for m in study_materials):
                    study_materials.append(material)
        except Exception as e:
            print(f"Error searching RAG for topic '{topic}': {e}")

    # Generate online and YouTube recommendations using AI
    try:
        prompt = f"""
For the following weak topics, find 2 relevant online articles (like blogs, tutorials, or educational sites) and 2 YouTube videos that can help a student understand them better.

Weak Topics:
- {"\n- ".join(weak_topics)}

Format the response as a valid JSON object with this EXACT structure:
{{
  "onlineResources": [
    {{
      "title": "Resource Title",
      "link": "https://example.com/resource1",
      "description": "A brief summary of the resource."
    }}
  ],
  "youtubeVideos": [
    {{
      "title": "Video Title",
      "link": "https://youtube.com/watch?v=video1",
      "description": "A brief summary of the video."
    }}
  ]
}}

Respond ONLY with the JSON object, no additional text or markdown.
"""
        response = gemini_model.generate_content(prompt)
        response_text = response.text.strip().replace('```json', '').replace('```', '').strip()
        
        recommendations = json.loads(response_text)
        recommendations['studyMaterials'] = study_materials
        return recommendations if isinstance(recommendations, dict) else {}
        
    except Exception as e:
        print(f"❌ Error generating resource recommendations: {e}")
        return {"studyMaterials": study_materials}

@app.route('/api/student/<student_id>/quiz-attempts', methods=['GET'])
def get_student_quiz_attempts(student_id):
    """Get all quiz attempts for a student"""
    try:
        attempts_ref = db.reference('quiz_attempts')
        all_attempts = attempts_ref.get() or {}
        
        student_attempts = []
        for attempt_id, attempt_data in all_attempts.items():
            if attempt_data.get('studentId') == student_id:
                attempt_data['id'] = attempt_id
                attempt_data['attemptId'] = attempt_id
                # Remove detailed results from list view
                attempt_data.pop('detailedResults', None)
                student_attempts.append(attempt_data)
        
        student_attempts.sort(key=lambda x: x.get('completedAt', ''), reverse=True)
        return jsonify({'success': True, 'attempts': student_attempts}), 200
    except Exception as e:
        print(f"❌ Get student attempts error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quiz-results/<attempt_id>', methods=['GET'])
def get_quiz_results(attempt_id):
    """Get detailed results for a specific quiz attempt"""
    try:
        attempt_ref = db.reference(f'quiz_attempts/{attempt_id}')
        attempt_data = attempt_ref.get()
        if not attempt_data:
            return jsonify({'success': False, 'error': 'Attempt not found'}), 404
        
        attempt_data['id'] = attempt_id
        return jsonify({'success': True, 'attempt': attempt_data}), 200
    except Exception as e:
        print(f"❌ Get quiz results error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ Skill Gap Analysis with RAG ============

@app.route('/api/student/<student_id>/skill-gap', methods=['GET'])
def get_skill_gap_analysis(student_id):
    """Get skill gap analysis with RAG-enhanced recommendations"""
    try:
        student_ref = db.reference(f'students/{student_id}')
        student_data = student_ref.get()
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404

        attempts_ref = db.reference('quiz_attempts')
        all_attempts = attempts_ref.get() or {}
        
        student_attempts = []
        for attempt_id, attempt_data in all_attempts.items():
            if attempt_data.get('studentId') == student_id:
                attempt_data['id'] = attempt_id
                student_attempts.append(attempt_data)

        if not student_attempts:
            return jsonify({
                'success': True,
                'analysis': {
                    'totalAttempts': 0,
                    'averageScore': 0,
                    'weakAreas': [],
                    'strongAreas': [],
                    'recommendations': []
                }
            }), 200

        # Calculate statistics
        total_attempts = len(student_attempts)
        total_score = sum(a['score'] for a in student_attempts)
        total_questions = sum(a['totalQuestions'] for a in student_attempts)
        average_score = (total_score / total_questions * 100) if total_questions > 0 else 0

        # Identify weak and strong areas
        weak_areas = []
        strong_areas = []
        all_weak_topics = []

        for attempt in student_attempts:
            quiz_title = attempt.get('quizTitle', 'Unknown')
            percentage = attempt.get('percentage', 0)
            
            if percentage < 70:
                weak_areas.append({
                    'topic': quiz_title,
                    'score': percentage,
                    'quizId': attempt.get('quizId')
                })
                all_weak_topics.extend(attempt.get('weakTopics', []))
            elif percentage >= 80:
                strong_areas.append({
                    'topic': quiz_title,
                    'score': percentage
                })

        # Generate RAG-enhanced recommendations
        recommendations = generate_rag_recommendations(
            all_weak_topics[:5], 
            weak_areas, 
            student_data.get('currentGrade')
        )

        # Generate resource recommendations
        resource_recommendations = generate_resource_recommendations(list(set(all_weak_topics))[:3])

        # Topic-wise error analysis
        topic_errors = defaultdict(int)
        for topic in all_weak_topics:
            topic_errors[topic] += 1
        
        topic_error_analysis = sorted(topic_errors.items(), key=lambda item: item[1], reverse=True)

        analysis = {
            'totalAttempts': total_attempts,
            'averageScore': round(average_score, 2),
            'weakAreas': weak_areas[:5],
            'strongAreas': strong_areas[:5],
            'recommendations': recommendations,
            'resourceRecommendations': resource_recommendations,
            'topicErrorAnalysis': topic_error_analysis[:5],
            'improvementTrend': calculate_improvement_trend(student_attempts)
        }

        return jsonify({'success': True, 'analysis': analysis}), 200

    except Exception as e:
        print(f"❌ Skill gap analysis error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

def generate_rag_recommendations(weak_topics, weak_areas, grade):
    """Generate personalized recommendations using RAG and AI"""
    try:
        if not weak_topics and not weak_areas:
            return ["Great job! Keep practicing to maintain your performance."]

        # Search RAG for relevant materials
        relevant_materials = []
        for topic in weak_topics[:3]:
            results = rag_system.search(topic, top_k=2, min_similarity=0.3)
            for result in results:
                if result['metadata']['docName'] not in relevant_materials:
                    relevant_materials.append(result['metadata']['docName'])

        weak_area_names = [area['topic'] for area in weak_areas[:3]]
        
        context = f"""
Student Grade: {grade}
Weak Topics: {', '.join(weak_topics[:5]) if weak_topics else 'None'}
Weak Quiz Areas: {', '.join(weak_area_names) if weak_area_names else 'None'}
Available Study Materials: {', '.join(relevant_materials[:5]) if relevant_materials else 'General materials'}
"""

        prompt = f"""
As an educational AI assistant, provide 5 specific, actionable study recommendations for a student with the following performance data:

{context}

Requirements:
1. Make recommendations specific and actionable
2. Reference available study materials when relevant
3. Include both short-term and long-term strategies
4. Be encouraging and positive
5. Prioritize the most important gaps

Format as a JSON array of strings:
["recommendation 1", "recommendation 2", ...]

Respond ONLY with the JSON array.
"""
        
        response = gemini_model.generate_content(prompt)
        response_text = response.text.strip().replace('```json', '').replace('```', '').strip()

        recommendations = json.loads(response_text)
        return recommendations if isinstance(recommendations, list) else []
        
    except Exception as e:
        print(f"Error generating RAG recommendations: {e}")
        return [
            "Review study materials related to your challenging topics",
            "Practice additional problems on weak areas",
            "Create summary notes for difficult concepts",
            "Discuss challenging topics with teachers or peers",
            "Set aside regular study time for improvement"
        ]

def calculate_improvement_trend(attempts):
    """Calculate if student is improving over time"""
    if len(attempts) < 2:
        return "insufficient_data"
    
    sorted_attempts = sorted(attempts, key=lambda x: x.get('completedAt', ''))
    
    mid_point = len(sorted_attempts) // 2
    first_half_avg = sum(a['percentage'] for a in sorted_attempts[:mid_point]) / mid_point
    second_half_avg = sum(a['percentage'] for a in sorted_attempts[mid_point:]) / (len(sorted_attempts) - mid_point)
    
    if second_half_avg > first_half_avg + 5:
        return "improving"
    elif second_half_avg < first_half_avg - 5:
        return "declining"
    else:
        return "stable"

# ============ RAG-Enhanced Resource Recommendations ============

@app.route('/api/student/<student_id>/recommended-materials', methods=['GET'])
def get_recommended_materials(student_id):
    """Get recommended study materials using RAG based on weak areas"""
    try:
        # Get student's quiz attempts
        attempts_ref = db.reference('quiz_attempts')
        all_attempts = attempts_ref.get() or {}
        
        student_attempts = []
        weak_topics = []
        
        for attempt_id, attempt_data in all_attempts.items():
            if attempt_data.get('studentId') == student_id:
                student_attempts.append(attempt_data)
                if attempt_data.get('percentage', 100) < 70:
                    weak_topics.extend(attempt_data.get('weakTopics', []))

        # Get all materials
        materials_ref = db.reference('study_materials')
        all_materials = materials_ref.get() or {}
        
        # Use RAG to find relevant materials for weak topics
        recommended_material_ids = set()
        relevance_scores = {}
        
        if weak_topics:
            for topic in weak_topics[:5]:
                results = rag_system.search(topic, top_k=3, min_similarity=0.25)
                for result in results:
                    doc_id = result['metadata']['docId']
                    similarity = result['similarity']
                    
                    if doc_id in relevance_scores:
                        relevance_scores[doc_id] += similarity
                    else:
                        relevance_scores[doc_id] = similarity
                    
                    recommended_material_ids.add(doc_id)
        
        # Build response with materials sorted by relevance
        materials = []
        for material_id, material in all_materials.items():
            if not weak_topics or material_id in recommended_material_ids:
                material_copy = material.copy()
                material_copy['id'] = material_id
                material_copy.pop('fileContent', None)
                material_copy['relevanceScore'] = relevance_scores.get(material_id, 0)
                materials.append(material_copy)
        
        # Sort by relevance if we have weak topics, otherwise by date
        if weak_topics:
            materials.sort(key=lambda x: x.get('relevanceScore', 0), reverse=True)
        else:
            materials.sort(key=lambda x: x.get('uploadDate', ''), reverse=True)
        
        return jsonify({
            'success': True, 
            'materials': materials[:10],
            'weakTopicsFound': len(weak_topics) > 0
        }), 200

    except Exception as e:
        print(f"❌ Get recommended materials error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ Performance Analytics ============

@app.route('/api/student/<student_id>/performance-stats', methods=['GET'])
def get_performance_stats(student_id):
    """Get detailed performance statistics"""
    try:
        attempts_ref = db.reference('quiz_attempts')
        all_attempts = attempts_ref.get() or {}
        
        student_attempts = []
        for attempt_id, attempt_data in all_attempts.items():
            if attempt_data.get('studentId') == student_id:
                attempt_data['id'] = attempt_id
                student_attempts.append(attempt_data)

        if not student_attempts:
            return jsonify({
                'success': True,
                'stats': {
                    'totalQuizzes': 0,
                    'totalQuestions': 0,
                    'correctAnswers': 0,
                    'averageScore': 0,
                    'highestScore': 0,
                    'lowestScore': 0,
                    'recentAttempts': []
                }
            }), 200

        total_correct = sum(a['score'] for a in student_attempts)
        total_questions = sum(a['totalQuestions'] for a in student_attempts)
        percentages = [a['percentage'] for a in student_attempts]
        
        stats = {
            'totalQuizzes': len(student_attempts),
            'totalQuestions': total_questions,
            'correctAnswers': total_correct,
            'averageScore': round(sum(percentages) / len(percentages), 2),
            'highestScore': round(max(percentages), 2),
            'lowestScore': round(min(percentages), 2),
            'recentAttempts': sorted(student_attempts, key=lambda x: x.get('completedAt', ''), reverse=True)[:5],
            'performanceByDifficulty': calculate_performance_by_difficulty(student_attempts),
            'timeStats': calculate_time_stats(student_attempts)
        }

        return jsonify({'success': True, 'stats': stats}), 200

    except Exception as e:
        print(f"❌ Get performance stats error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

def calculate_performance_by_difficulty(attempts):
    """Calculate average performance grouped by difficulty"""
    difficulty_stats = defaultdict(lambda: {'total': 0, 'correct': 0, 'count': 0})
    
    for attempt in attempts:
        difficulty = attempt.get('toughness', 'Medium')
        difficulty_stats[difficulty]['total'] += attempt['totalQuestions']
        difficulty_stats[difficulty]['correct'] += attempt['score']
        difficulty_stats[difficulty]['count'] += 1
    
    result = {}
    for difficulty, stats in difficulty_stats.items():
        if stats['total'] > 0:
            result[difficulty] = {
                'averageScore': round((stats['correct'] / stats['total']) * 100, 2),
                'quizzesTaken': stats['count']
            }
    
    return result

def calculate_time_stats(attempts):
    """Calculate time-related statistics"""
    times = [a.get('timeTaken', 0) for a in attempts if a.get('timeTaken')]
    
    if not times:
        return {'averageTime': 0, 'fastestTime': 0, 'slowestTime': 0}
    
    return {
        'averageTime': round(sum(times) / len(times), 2),
        'fastestTime': min(times),
        'slowestTime': max(times)
    }
@app.route('/api/student/<student_id>/topic-specific-materials', methods=['GET'])
def get_topic_specific_materials(student_id):
    """Get study materials specifically matched to student's weak topics using RAG"""
    try:
        # Get student's quiz attempts
        attempts_ref = db.reference('quiz_attempts')
        all_attempts = attempts_ref.get() or {}
        
        weak_topics = []
        for attempt_id, attempt_data in all_attempts.items():
            if attempt_data.get('studentId') == student_id:
                if attempt_data.get('percentage', 100) < 70:
                    weak_topics.extend(attempt_data.get('weakTopics', []))
        
        if not weak_topics:
            return jsonify({
                'success': True,
                'topicMaterials': [],
                'message': 'No weak topics identified yet'
            }), 200
        
        # Get unique weak topics
        unique_weak_topics = list(set(weak_topics))
        
        # For each weak topic, find relevant materials using RAG
        topic_materials = []
        
        for topic in unique_weak_topics[:10]:  # Limit to top 10 topics
            rag_results = rag_system.search(topic, top_k=3, min_similarity=0.3)
            
            if rag_results:
                materials_for_topic = []
                seen_materials = set()
                
                for result in rag_results:
                    material_id = result['metadata']['docId']
                    if material_id not in seen_materials:
                        materials_for_topic.append({
                            'materialId': material_id,
                            'materialName': result['metadata']['docName'],
                            'relevantContent': result['content'][:200] + '...',
                            'similarity': round(result['similarity'] * 100, 1)
                        })
                        seen_materials.add(material_id)
                
                if materials_for_topic:
                    topic_materials.append({
                        'topic': topic,
                        'errorCount': weak_topics.count(topic),
                        'recommendedMaterials': materials_for_topic
                    })
        
        # Sort by error count (topics with most errors first)
        topic_materials.sort(key=lambda x: x['errorCount'], reverse=True)
        
        return jsonify({
            'success': True,
            'topicMaterials': topic_materials
        }), 200
        
    except Exception as e:
        print(f"❌ Get topic-specific materials error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ RAG System Management ============

@app.route('/api/rag/stats', methods=['GET'])
def get_rag_stats():
    """Get RAG system statistics"""
    try:
        stats = rag_system.get_stats()
        return jsonify({'success': True, 'stats': stats}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rag/search', methods=['POST'])
def search_rag():
    """Search RAG system directly"""
    try:
        data = request.json
        query = data.get('query', '')
        top_k = data.get('top_k', 5)
        
        if not query:
            return jsonify({'success': False, 'error': 'Query is required'}), 400
        
        results = rag_system.search(query, top_k=top_k)
        return jsonify({'success': True, 'results': results}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ Health Check ============

@app.route('/api/health', methods=['GET'])
def health_check():
    """API health check"""
    rag_stats = rag_system.get_stats()
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'services': {
            'firebase': 'connected',
            'gemini_ai': 'configured',
            'rag_system': {
                'status': 'active',
                'documents': rag_stats['uniqueDocuments'],
                'chunks': rag_stats['totalChunks']
            }
        }
    }), 200

@app.route('/', methods=['GET'])
def home():
    """Root endpoint"""
    return jsonify({
        'message': 'EduMaster AI Backend with RAG',
        'version': '2.0.0',
        'features': [
            'AI-Powered Quiz Generation',
            'RAG-Enhanced Learning',
            'Skill Gap Analysis',
            'Smart Resource Recommendations'
        ]
    }), 200

# ============ Error Handlers ============

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ============ Main ============

if __name__ == '__main__':
    print("="*80)
    print("🚀 EduMaster AI Backend Server with RAG Integration")
    print("="*80)
    print("📚 Features Enabled:")
    print("   ✓ User Authentication & Management")
    print("   ✓ Study Materials Upload & Download")
    print("   ✓ AI-Powered Quiz Generation (Gemini)")
    print("   ✓ RAG-Enhanced Context & Search")
    print("   ✓ Quiz Attempts & Scoring")
    print("   ✓ Skill Gap Analysis with AI")
    print("   ✓ Smart Resource Recommendations")
    print("   ✓ Performance Analytics & Insights")
    print("="*80)
    rag_stats = rag_system.get_stats()
    print(f"📊 RAG System Status:")
    print(f"   • Documents Indexed: {rag_stats['uniqueDocuments']}")
    print(f"   • Total Chunks: {rag_stats['totalChunks']}")
    print(f"   • Avg Chunk Length: {rag_stats['averageChunkLength']:.0f} chars")
    print("="*80)
    print("🌐 Server running on: http://localhost:5000")
    print("📡 CORS enabled for: http://localhost:3000")
    print("="*80)
    app.run(debug=True, port=5000, host='0.0.0.0')
