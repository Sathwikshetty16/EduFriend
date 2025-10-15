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
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import PyPDF2
import docx
import io as io_module
import json
from collections import defaultdict
from simple_rag import rag_system
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
# In production, the frontend will be hosted on Firebase.
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:3000",
    "https://edufriend-web-app.web.app",
    "https://astana-apprentices-playground.web.app",
    "https://astana-apprentices-playground.firebaseapp.com"
]}})

# Initialize Firebase Admin
try:
    cred = credentials.Certificate('firebase_config.json')
    firebase_admin.initialize_app(cred, {
        'databaseURL': os.getenv('DATABASE_URL')
    })
    print("✅ Firebase initialized successfully")
except Exception as e:
    print(f"❌ Firebase initialization error: {e}")

# Initialize Gemini AI
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-2.0-flash-exp')
    print("✅ Gemini AI initialized")
else:
    print("❌ GEMINI_API_KEY not found")
    gemini_model = None

# Initialize YouTube API
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')
youtube_service = None
if YOUTUBE_API_KEY:
    try:
        youtube_service = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
        print("✅ YouTube API initialized")
    except Exception as e:
        print(f"⚠️  YouTube API initialization failed: {e}")
else:
    print("⚠️  YouTube API key not found")

# ============ Helper Functions ============

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

# ============ YouTube Search Function ============

def search_youtube_videos(topic, max_results=2):
    """Search for real educational YouTube videos using YouTube Data API"""
    if not youtube_service:
        print("⚠️  YouTube API not available")
        return []
    
    try:
        # Enhanced search query for educational content
        search_query = f"{topic} tutorial explanation education"
        
        print(f"🔍 Searching YouTube for: {search_query}")
        
        search_response = youtube_service.search().list(
            q=search_query,
            type='video',
            part='id,snippet',
            maxResults=max_results * 3,  # Get more to filter
            videoDuration='medium',  # 4-20 minutes
            relevanceLanguage='en',
            safeSearch='strict',
            order='relevance',
            videoEmbeddable='true'
        ).execute()

        videos = []
        for item in search_response.get('items', []):
            try:
                video_id = item['id']['videoId']
                snippet = item['snippet']
                
                # Get video statistics for quality filtering
                video_stats_response = youtube_service.videos().list(
                    part='statistics,contentDetails',
                    id=video_id
                ).execute()
                
                if video_stats_response['items']:
                    stats = video_stats_response['items'][0]['statistics']
                    view_count = int(stats.get('viewCount', 0))
                    
                    # Filter out low-quality videos
                    if view_count < 1000:
                        continue
                    
                    video_data = {
                        'title': snippet['title'],
                        'link': f'https://www.youtube.com/watch?v={video_id}',
                        'description': snippet['description'][:200] + '...' if len(snippet['description']) > 200 else snippet['description'],
                        'thumbnail': snippet['thumbnails']['medium']['url'],
                        'channelTitle': snippet['channelTitle'],
                        'publishedAt': snippet['publishedAt'],
                        'viewCount': view_count,
                        'type': 'youtube'
                    }
                    videos.append(video_data)
                    
                    if len(videos) >= max_results:
                        break
                        
            except Exception as e:
                print(f"Error processing video: {e}")
                continue
        
        print(f"✅ Found {len(videos)} YouTube videos for '{topic}'")
        return videos[:max_results]
        
    except HttpError as e:
        print(f"❌ YouTube API HTTP Error: {e}")
        return []
    except Exception as e:
        print(f"❌ YouTube search error: {e}")
        return []

def search_online_resources_with_ai(topics, max_results=3):
    """Generate AI-curated online resource recommendations"""
    if not gemini_model:
        return []
        
    try:
        topics_str = ', '.join(topics[:3])
        
        prompt = f"""
For these educational topics: {topics_str}

Recommend {max_results} high-quality, FREE educational resources from well-known platforms.

Focus on:
- Khan Academy (khanacademy.org)
- Coursera (coursera.org) - free courses
- edX (edx.org) - free courses
- MIT OpenCourseWare (ocw.mit.edu)
- Wikipedia educational pages
- Academic websites (.edu domains)

For each resource, provide:
1. Exact title
2. Specific search query with site: operator
3. Platform name
4. Brief description (max 100 chars)

Format as JSON array:
[
  {{
    "title": "Resource Title",
    "searchQuery": "site:khanacademy.org topic",
    "platform": "Khan Academy",
    "description": "Brief description"
  }}
]

Respond ONLY with the JSON array.
"""
        
        response = gemini_model.generate_content(prompt)
        response_text = response.text.strip().replace('```json', '').replace('```', '').strip()
        resources = json.loads(response_text)
        
        # Convert to Google search links
        for resource in resources:
            query = resource['searchQuery']
            resource['link'] = f"https://www.google.com/search?q={query.replace(' ', '+')}"
            resource['type'] = 'online'
        
        return resources if isinstance(resources, list) else []
        
    except Exception as e:
        print(f"❌ Error generating online resources: {e}")
        return []

def generate_resource_recommendations(weak_topics):
    """Generate comprehensive resource recommendations with real YouTube videos"""
    if not weak_topics:
        return {
            'onlineResources': [],
            'youtubeVideos': [],
            'studyMaterials': []
        }

    print(f"🔍 Generating recommendations for topics: {weak_topics[:3]}")

    # 1. Find relevant study materials using RAG
    study_materials = []
    for topic in weak_topics:
        try:
            rag_results = rag_system.search(topic, top_k=1, min_similarity=0.3)
            if rag_results:
                material = {
                    "title": rag_results[0]['metadata']['docName'],
                    "description": f"Relevant content: \"{rag_results[0]['content'][:100]}...\"",
                    "id": rag_results[0]['metadata']['docId'],
                    "type": "studyMaterial"
                }
                if not any(m['id'] == material['id'] for m in study_materials):
                    study_materials.append(material)
        except Exception as e:
            print(f"Error searching RAG: {e}")

    # 2. Get REAL YouTube videos using YouTube Data API
    youtube_videos = []
    if youtube_service:
        for topic in weak_topics[:2]:  # Search for top 2 topics
            videos = search_youtube_videos(topic, max_results=2)
            youtube_videos.extend(videos)
        
        # Remove duplicates
        seen_links = set()
        unique_videos = []
        for video in youtube_videos:
            if video['link'] not in seen_links:
                seen_links.add(video['link'])
                unique_videos.append(video)
        youtube_videos = unique_videos[:3]  # Limit to 3 videos
    else:
        print("⚠️  YouTube API not available - skipping video recommendations")
    
    # 3. Get AI-curated online resources
    online_resources = search_online_resources_with_ai(weak_topics, max_results=3)

    result = {
        'onlineResources': online_resources[:3],
        'youtubeVideos': youtube_videos[:3],
        'studyMaterials': study_materials[:3]
    }
    
    print(f"✅ Generated: {len(online_resources)} online, {len(youtube_videos)} videos, {len(study_materials)} materials")
    
    return result

def generate_benchmark_times(questions, toughness, grade):
    """Generate AI-powered benchmark times for each question"""
    if not gemini_model:
        base_time = {'Easy': 30, 'Medium': 45, 'Hard': 60}.get(toughness, 45)
        return [base_time] * len(questions)
        
    try:
        question_summaries = []
        for i, q in enumerate(questions[:10], 1):
            question_summaries.append(f"{i}. {q['question'][:100]}")
        
        prompt = f"""
Estimate benchmark time (in seconds) for a {grade} student to answer each question at {toughness} difficulty.

Questions:
{chr(10).join(question_summaries)}

Consider: reading time, thinking time, complexity, difficulty, grade level.

Format as JSON array of numbers: [30, 45, 60, ...]
Respond ONLY with the JSON array of {len(questions)} numbers.
"""
        
        response = gemini_model.generate_content(prompt)
        response_text = response.text.strip().replace('```json', '').replace('```', '').strip()
        
        benchmark_times = json.loads(response_text)
        
        if len(benchmark_times) < len(questions):
            avg_time = sum(benchmark_times) / len(benchmark_times) if benchmark_times else 60
            benchmark_times.extend([avg_time] * (len(questions) - len(benchmark_times)))
        
        return benchmark_times[:len(questions)]
        
    except Exception as e:
        print(f"Error generating benchmark times: {e}")
        base_time = {'Easy': 30, 'Medium': 45, 'Hard': 60}.get(toughness, 45)
        return [base_time] * len(questions)

def generate_rag_recommendations(weak_topics, weak_areas, grade):
    """Generate personalized recommendations using RAG and AI"""
    if not gemini_model:
        return [
            "Review study materials related to your challenging topics",
            "Practice additional problems on weak areas",
            "Create summary notes for difficult concepts"
        ]
        
    try:
        if not weak_topics and not weak_areas:
            return ["Great job! Keep practicing to maintain your performance."]

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
Provide 5 specific, actionable study recommendations for a student:

{context}

Requirements:
1. Specific and actionable
2. Reference study materials when relevant
3. Include short-term and long-term strategies
4. Be encouraging and positive
5. Prioritize important gaps

Format as JSON array: ["recommendation 1", "recommendation 2", ...]
Respond ONLY with the JSON array.
"""
        
        response = gemini_model.generate_content(prompt)
        response_text = response.text.strip().replace('```json', '').replace('```', '').strip()

        recommendations = json.loads(response_text)
        return recommendations if isinstance(recommendations, list) else []
        
    except Exception as e:
        print(f"Error generating recommendations: {e}")
        return [
            "Review study materials related to your challenging topics",
            "Practice additional problems on weak areas",
            "Create summary notes for difficult concepts"
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

# ============ Initialize RAG ============

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
            'uid': uid, 
            'email': email, 
            'fullName': full_name,
            'userType': user_type, 
            'currentGrade': current_grade,
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
            return jsonify({'success': True, 'user': {
                'fullName': teacher_data.get('fullName'), 
                'userType': 'teacher', 
                'email': teacher_data.get('email')
            }}), 200
        
        student_ref = db.reference(f'students/{uid}')
        student_data = student_ref.get()
        if student_data:
            return jsonify({'success': True, 'user': {
                'fullName': student_data.get('fullName'), 
                'userType': 'student', 
                'currentGrade': student_data.get('currentGrade'), 
                'email': student_data.get('email')
            }}), 200
            
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
        if len(file_content) > 10485760:
            return jsonify({'success': False, 'error': 'File too large. Maximum size is 10MB'}), 400
        
        file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        text = ""
        if file_ext == 'pdf':
            text = extract_text_from_pdf(file_content)
        elif file_ext in ['docx', 'doc']:
            text = extract_text_from_docx(file_content)
        
        file_base64 = base64.b64encode(file_content).decode('utf-8')
        
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

# ============ Quiz Generation Routes ============

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
        
        rag_results = rag_system.search(text[:500], top_k=3)
        additional_context = ""
        if rag_results:
            additional_context = "\n\nRelated content from study materials:\n"
            for i, result in enumerate(rag_results[:2], 1):
                additional_context += f"\n{i}. {result['content'][:300]}...\n"
        
        if not gemini_model:
            return jsonify({'success': False, 'error': 'AI model not available'}), 500
        
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
        response_text = response.text.strip().replace('```json', '').replace('```', '').strip()

        try:
            questions = json.loads(response_text)
            if not isinstance(questions, list) or len(questions) == 0:
                raise ValueError("Invalid questions format")
        except (json.JSONDecodeError, ValueError) as e:
            print(f"❌ JSON parsing error. Response: {response_text[:500]}")
            return jsonify({'success': False, 'error': 'Failed to parse AI response'}), 500

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

# ============ Quiz Management Routes ============

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

        quiz_ref = db.reference(f'quizzes/{quiz_id}')
        quiz_data = quiz_ref.get()
        if not quiz_data:
            return jsonify({'success': False, 'error': 'Quiz not found'}), 404

        questions = quiz_data.get('questions', [])
        if len(answers) != len(questions):
            return jsonify({'success': False, 'error': 'Invalid number of answers'}), 400

        score = 0
        detailed_results = []
        weak_topics = []
        
        for i, (question, user_answer) in enumerate(zip(questions, answers)):
            is_correct = user_answer == question['correctAnswer']
            if is_correct:
                score += 1
            else:
                weak_topics.append(question['question'])
            
            enhanced_explanation = question.get('explanation', '')
            if not is_correct and user_answer != -1:
                try:
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

        attempts_ref = db.reference('quiz_attempts')
        new_attempt_ref = attempts_ref.push()
        attempt_data = {
            'studentId': student_id,
            'quizId': quiz_id,
            'quizTitle': quiz_data.get('title', 'Untitled Quiz'),
            'score': score,
            'totalQuestions': len(questions),
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
        
        # Generate resource recommendations with REAL YouTube videos
        resource_recommendations = {}
        if weak_topics:
            print(f"🎬 Generating YouTube recommendations for weak topics...")
            resource_recommendations = generate_resource_recommendations(weak_topics[:3])
        
        attempt_data['resourceRecommendations'] = resource_recommendations
        new_attempt_ref.set(attempt_data)

        print(f"✅ Quiz attempt saved: {new_attempt_ref.key} - Score: {score}/{len(questions)}")
        print(f"   YouTube videos generated: {len(resource_recommendations.get('youtubeVideos', []))}")
        
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
                attempt_data.pop('detailedResults', None)
                student_attempts.append(attempt_data)
        
        student_attempts.sort(key=lambda x: x.get('completedAt', ''), reverse=True)
        return jsonify({'success': True, 'attempts': student_attempts}), 200
    except Exception as e:
        print(f"❌ Get student attempts error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quiz-results/attempt/<attempt_id>', methods=['GET'])
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

# ============ Analytics Routes ============

@app.route('/api/quiz-results/attempt/<attempt_id>/detailed-analytics', methods=['GET'])
def get_detailed_analytics(attempt_id):
    """Get detailed analytics including time analysis and answer distribution"""
    try:
        attempt_ref = db.reference(f'quiz_attempts/{attempt_id}')
        attempt_data = attempt_ref.get()
        if not attempt_data:
            return jsonify({'success': False, 'error': 'Attempt not found'}), 404

        quiz_id = attempt_data.get('quizId')
        quiz_ref = db.reference(f'quizzes/{quiz_id}')
        quiz_data = quiz_ref.get()
        
        if not quiz_data:
            return jsonify({'success': False, 'error': 'Quiz not found'}), 404

        questions = quiz_data.get('questions', [])
        answers = attempt_data.get('answers', [])
        total_time = attempt_data.get('timeTaken', 0)
        
        correct_count = 0
        incorrect_count = 0
        not_attempted_count = 0
        
        for i, answer in enumerate(answers):
            if answer == -1:
                not_attempted_count += 1
            elif answer == questions[i]['correctAnswer']:
                correct_count += 1
            else:
                incorrect_count += 1
        
        benchmark_times = generate_benchmark_times(
            questions, 
            quiz_data.get('toughness', 'Medium'),
            quiz_data.get('targetGrade', 'Grade 10')
        )
        
        avg_time_per_question = total_time / len(questions) if len(questions) > 0 else 0
        
        time_analysis = []
        for i, question in enumerate(questions):
            time_analysis.append({
                'questionNumber': i + 1,
                'questionText': question['question'][:50] + '...' if len(question['question']) > 50 else question['question'],
                'estimatedTime': round(avg_time_per_question, 1),
                'benchmarkTime': benchmark_times[i],
                'difference': round(avg_time_per_question - benchmark_times[i], 1)
            })
        
        analytics = {
            'answerDistribution': {
                'correct': correct_count,
                'incorrect': incorrect_count,
                'notAttempted': not_attempted_count,
                'total': len(questions)
            },
            'timeAnalysis': time_analysis,
            'totalTime': total_time,
            'averageTimePerQuestion': round(avg_time_per_question, 1),
            'benchmarkTotalTime': sum(benchmark_times)
        }
        
        return jsonify({'success': True, 'analytics': analytics}), 200
        
    except Exception as e:
        print(f"❌ Detailed analytics error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quiz-results/attempt/<attempt_id>/analysis', methods=['GET'])
def get_attempt_analysis(attempt_id):
    """Get skill gap analysis for a single quiz attempt"""
    try:
        attempt_ref = db.reference(f'quiz_attempts/{attempt_id}')
        attempt_data = attempt_ref.get()
        if not attempt_data:
            return jsonify({'success': False, 'error': 'Attempt not found'}), 404

        student_id = attempt_data.get('studentId')
        student_ref = db.reference(f'students/{student_id}')
        student_data = student_ref.get()
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404

        weak_topics = attempt_data.get('weakTopics', [])
        
        if not weak_topics:
            return jsonify({
                'success': True,
                'analysis': {
                    'recommendations': ["No specific weak topics identified in this attempt. Great job!"],
                    'topicErrorAnalysis': [],
                    'topicSpecificMaterials': [],
                    'teacherMaterials': []
                }
            }), 200

        materials_ref = db.reference('study_materials')
        all_materials = materials_ref.get() or {}
        
        topic_specific_materials = []
        for topic in list(set(weak_topics))[:5]:
            rag_results = rag_system.search(topic, top_k=3, min_similarity=0.25)
            
            if rag_results:
                materials_for_topic = []
                for result in rag_results:
                    mat_id = result['metadata']['docId']
                    if mat_id in all_materials:
                        mat_data = all_materials[mat_id]
                        materials_for_topic.append({
                            'id': mat_id,
                            'title': mat_data.get('name', 'Untitled'),
                            'description': f"Relevant: \"{result['content'][:150]}...\"",
                            'similarity': round(result['similarity'] * 100, 1)
                        })
                
                if materials_for_topic:
                    topic_specific_materials.append({
                        'topic': topic,
                        'materials': materials_for_topic
                    })
        
        weak_areas = [{'topic': attempt_data.get('quizTitle', 'Quiz'), 'score': attempt_data.get('percentage', 0)}]
        recommendations = generate_rag_recommendations(
            weak_topics, 
            weak_areas, 
            student_data.get('currentGrade')
        )
        
        topic_errors = defaultdict(int)
        for topic in weak_topics:
            topic_errors[topic] += 1
        topic_error_analysis = sorted(topic_errors.items(), key=lambda item: item[1], reverse=True)
        
        teacher_materials = []
        try:
            quiz_id = attempt_data.get('quizId')
            if quiz_id:
                quiz_ref = db.reference(f'quizzes/{quiz_id}')
                quiz_data = quiz_ref.get()
                if quiz_data:
                    teacher_id = quiz_data.get('teacherId')
                    if teacher_id:
                        for mat_id, mat_data in all_materials.items():
                            if mat_data.get('teacherId') == teacher_id:
                                teacher_materials.append({
                                    'id': mat_id,
                                    'title': mat_data.get('name', 'Untitled Material'),
                                    'type': mat_data.get('type', 'Document'),
                                    'description': f"From your teacher - Type: {mat_data.get('type', 'N/A')}"
                                })
        except Exception as e:
            print(f"⚠️ Error fetching teacher materials: {e}")
        
        analysis = {
            'recommendations': recommendations,
            'topicErrorAnalysis': topic_error_analysis,
            'topicSpecificMaterials': topic_specific_materials,
            'teacherMaterials': teacher_materials[:10]
        }
        
        return jsonify({'success': True, 'analysis': analysis}), 200

    except Exception as e:
        print(f"❌ Attempt analysis error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ Skill Gap Analysis ============

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

        total_attempts = len(student_attempts)
        total_score = sum(a['score'] for a in student_attempts)
        total_questions = sum(a['totalQuestions'] for a in student_attempts)
        average_score = (total_score / total_questions * 100) if total_questions > 0 else 0

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

        recommendations = generate_rag_recommendations(
            all_weak_topics[:5], 
            weak_areas, 
            student_data.get('currentGrade')
        )

        resource_recommendations = generate_resource_recommendations(list(set(all_weak_topics))[:3])

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

@app.route('/api/student/<student_id>/recommended-materials', methods=['GET'])
def get_recommended_materials(student_id):
    """Get recommended study materials using RAG based on weak areas"""
    try:
        attempts_ref = db.reference('quiz_attempts')
        all_attempts = attempts_ref.get() or {}
        
        weak_topics = []
        for attempt_id, attempt_data in all_attempts.items():
            if attempt_data.get('studentId') == student_id:
                if attempt_data.get('percentage', 100) < 70:
                    weak_topics.extend(attempt_data.get('weakTopics', []))

        materials_ref = db.reference('study_materials')
        all_materials = materials_ref.get() or {}
        
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
        
        materials = []
        for material_id, material in all_materials.items():
            if not weak_topics or material_id in recommended_material_ids:
                material_copy = material.copy()
                material_copy['id'] = material_id
                material_copy.pop('fileContent', None)
                material_copy['relevanceScore'] = relevance_scores.get(material_id, 0)
                materials.append(material_copy)
        
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

@app.route('/api/student/<student_id>/topic-specific-materials', methods=['GET'])
def get_topic_specific_materials(student_id):
    """Get study materials specifically matched to student's weak topics using RAG"""
    try:
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
        
        unique_weak_topics = list(set(weak_topics))
        topic_materials = []
        
        for topic in unique_weak_topics[:10]:
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
        
        topic_materials.sort(key=lambda x: x['errorCount'], reverse=True)
        
        return jsonify({
            'success': True,
            'topicMaterials': topic_materials
        }), 200
        
    except Exception as e:
        print(f"❌ Get topic-specific materials error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ Resource Progress Tracking ============

@app.route('/api/quiz-results/attempt/<attempt_id>/progress', methods=['GET'])
def get_resource_progress(attempt_id):
    """Get resource completion progress for a quiz attempt"""
    try:
        progress_ref = db.reference(f'resource_progress/{attempt_id}')
        progress_data = progress_ref.get()
        
        if not progress_data:
            default_progress = {
                'onlineResources': [],
                'youtubeVideos': [],
                'analysisViewed': False
            }
            return jsonify({'success': True, 'progress': default_progress}), 200
                
        if 'onlineResources' not in progress_data:
            progress_data['onlineResources'] = []
        if 'youtubeVideos' not in progress_data:
            progress_data['youtubeVideos'] = []
        if 'analysisViewed' not in progress_data:
            progress_data['analysisViewed'] = False
        
        return jsonify({'success': True, 'progress': progress_data}), 200
        
    except Exception as e:
        print(f"❌ Get resource progress error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quiz-results/<attempt_id>/mark-complete', methods=['POST'])
def mark_resource_complete(attempt_id):
    """Mark a resource as complete"""
    try:
        data = request.json
        resource_type = data.get('resourceType')
        resource_index = data.get('resourceIndex')
        
        if not resource_type:
            return jsonify({'success': False, 'error': 'Resource type is required'}), 400
        
        progress_ref = db.reference(f'resource_progress/{attempt_id}')
        progress_data = progress_ref.get()
        
        if not progress_data:
            progress_data = {
                'onlineResources': [],
                'youtubeVideos': [],
                'analysisViewed': False,
                'attemptId': attempt_id,
                'createdAt': datetime.utcnow().isoformat()
            }
        
        if 'onlineResources' not in progress_data:
            progress_data['onlineResources'] = []
        if 'youtubeVideos' not in progress_data:
            progress_data['youtubeVideos'] = []
        if 'analysisViewed' not in progress_data:
            progress_data['analysisViewed'] = False
        
        if resource_type == 'analysisViewed':
            progress_data['analysisViewed'] = True
        elif resource_type in ['onlineResources', 'youtubeVideos']:
            if resource_type not in progress_data:
                progress_data[resource_type] = []
            
            if resource_index not in progress_data[resource_type]:
                progress_data[resource_type].append(resource_index)
                progress_data[resource_type].sort()
        else:
            return jsonify({'success': False, 'error': 'Invalid resource type'}), 400
        
        progress_data['lastUpdated'] = datetime.utcnow().isoformat()
        progress_ref.set(progress_data)
        
        attempt_ref = db.reference(f'quiz_attempts/{attempt_id}')
        attempt_data = attempt_ref.get()
        
        if attempt_data:
            resource_recommendations = attempt_data.get('resourceRecommendations', {})
            total_resources = (
                len(resource_recommendations.get('onlineResources', [])) +
                len(resource_recommendations.get('youtubeVideos', [])) +
                (1 if resource_recommendations else 0)
            )
            
            completed_count = (
                len(progress_data.get('onlineResources', [])) +
                len(progress_data.get('youtubeVideos', [])) +
                (1 if progress_data.get('analysisViewed') else 0)
            )
            
            completion_percentage = round((completed_count / total_resources) * 100, 2) if total_resources > 0 else 0
            progress_data['completionPercentage'] = completion_percentage
            progress_ref.update({'completionPercentage': completion_percentage})
        
        print(f"✅ Resource marked complete: {resource_type} for attempt {attempt_id}")
        return jsonify({'success': True, 'progress': progress_data}), 200
        
    except Exception as e:
        print(f"❌ Mark resource complete error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/student/<student_id>/overall-progress', methods=['GET'])
def get_overall_progress(student_id):
    """Get overall resource completion progress for a student"""
    try:
        attempts_ref = db.reference('quiz_attempts')
        all_attempts = attempts_ref.get() or {}
        
        student_attempts = []
        for attempt_id, attempt_data in all_attempts.items():
            if attempt_data.get('studentId') == student_id:
                student_attempts.append({'id': attempt_id, **attempt_data})
        
        if not student_attempts:
            return jsonify({
                'success': True,
                'overallProgress': {
                    'totalAttempts': 0,
                    'attemptsWithResources': 0,
                    'completedResources': 0,
                    'totalResources': 0,
                    'completionPercentage': 0
                }
            }), 200
        
        total_resources = 0
        completed_resources = 0
        attempts_with_resources = 0
        
        for attempt in student_attempts:
            attempt_id = attempt['id']
            resource_recommendations = attempt.get('resourceRecommendations', {})
            
            attempt_total = (
                len(resource_recommendations.get('onlineResources', [])) +
                len(resource_recommendations.get('youtubeVideos', [])) +
                (1 if resource_recommendations else 0)
            )
            
            if attempt_total > 0:
                attempts_with_resources += 1
                total_resources += attempt_total
                
                progress_ref = db.reference(f'resource_progress/{attempt_id}')
                progress_data = progress_ref.get()
                
                if progress_data:
                    completed_resources += (
                        len(progress_data.get('onlineResources', [])) +
                        len(progress_data.get('youtubeVideos', [])) +
                        (1 if progress_data.get('analysisViewed') else 0)
                    )
        
        completion_percentage = round((completed_resources / total_resources) * 100, 2) if total_resources > 0 else 0
        
        overall_progress = {
            'totalAttempts': len(student_attempts),
            'attemptsWithResources': attempts_with_resources,
            'completedResources': completed_resources,
            'totalResources': total_resources,
            'completionPercentage': completion_percentage
        }
        
        return jsonify({'success': True, 'overallProgress': overall_progress}), 200
        
    except Exception as e:
        print(f"❌ Get overall progress error:\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============ Teacher Analytics Routes ============

@app.route('/api/teacher/<teacher_id>/students-overview', methods=['GET'])
def get_students_overview(teacher_id):
    """Get overview of all students who have attempted quizzes from this teacher"""
    try:
        # Get all quizzes by this teacher
        quizzes_ref = db.reference('quizzes')
        all_quizzes = quizzes_ref.get() or {}
        
        teacher_quiz_ids = []
        for quiz_id, quiz_data in all_quizzes.items():
            if quiz_data.get('teacherId') == teacher_id:
                teacher_quiz_ids.append(quiz_id)
        
        if not teacher_quiz_ids:
            return jsonify({
                'success': True,
                'students': [],
                'message': 'No quizzes created yet'
            }), 200
        
        # Get all quiz attempts for teacher's quizzes
        attempts_ref = db.reference('quiz_attempts')
        all_attempts = attempts_ref.get() or {}
        
        # Get all students
        students_ref = db.reference('students')
        all_students = students_ref.get() or {}
        
        # Organize attempts by student
        student_attempts = defaultdict(list)
        for attempt_id, attempt_data in all_attempts.items():
            if attempt_data.get('quizId') in teacher_quiz_ids:
                student_id = attempt_data.get('studentId')
                attempt_data['id'] = attempt_id
                student_attempts[student_id].append(attempt_data)
        
        # Calculate metrics for each student
        students_overview = []
        
        for student_id, attempts in student_attempts.items():
            student_data = all_students.get(student_id, {})
            
            if not student_data:
                continue
            
            # Calculate average score
            total_score = sum(a.get('score', 0) for a in attempts)
            total_questions = sum(a.get('totalQuestions', 0) for a in attempts)
            average_score = (total_score / total_questions * 100) if total_questions > 0 else 0
            
            # Calculate skill gap completion
            total_resources = 0
            completed_resources = 0
            
            for attempt in attempts:
                attempt_id = attempt['id']
                resource_recommendations = attempt.get('resourceRecommendations', {})
                
                attempt_total = (
                    len(resource_recommendations.get('onlineResources', [])) +
                    len(resource_recommendations.get('youtubeVideos', [])) +
                    (1 if resource_recommendations else 0)
                )
                
                if attempt_total > 0:
                    total_resources += attempt_total
                    
                    # Get progress data
                    progress_ref = db.reference(f'resource_progress/{attempt_id}')
                    progress_data = progress_ref.get()
                    
                    if progress_data:
                        completed_resources += (
                            len(progress_data.get('onlineResources', [])) +
                            len(progress_data.get('youtubeVideos', [])) +
                            (1 if progress_data.get('analysisViewed') else 0)
                        )
            
            skill_gap_completion = (completed_resources / total_resources * 100) if total_resources > 0 else 0
            
            student_overview = {
                'studentId': student_id,
                'studentName': student_data.get('fullName', 'Unknown'),
                'studentEmail': student_data.get('email', 'N/A'),
                'currentGrade': student_data.get('currentGrade', 'N/A'),
                'quizzesTaken': len(attempts),
                'averageScore': round(average_score, 2),
                'skillGapCompletion': round(skill_gap_completion, 2),
                'totalResources': total_resources,
                'completedResources': completed_resources,
                'lastActivity': attempts[-1].get('completedAt', '') if attempts else ''
            }
            
            students_overview.append(student_overview)
        
        # Sort by skill gap completion (ascending) to show students needing help first
        students_overview.sort(key=lambda x: x['skillGapCompletion'])
        
        print(f"✅ Teacher overview generated: {len(students_overview)} students")
        
        return jsonify({
            'success': True,
            'students': students_overview,
            'totalStudents': len(students_overview),
            'lowPerformers': len([s for s in students_overview if s['skillGapCompletion'] < 20])
        }), 200
        
    except Exception as e:
        print(f"❌ Get students overview error:\n{traceback.format_exc()}")
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

# ============ Health Check & Root ============

@app.route('/api/health', methods=['GET'])
def health_check():
    """API health check"""
    rag_stats = rag_system.get_stats()
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'services': {
            'firebase': 'connected',
            'gemini_ai': 'configured' if gemini_model else 'not_configured',
            'youtube_api': 'configured' if youtube_service else 'not_configured',
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
        'message': 'EduMaster AI Backend with RAG & Real YouTube Integration',
        'version': '3.0.0',
        'features': [
            'AI-Powered Quiz Generation',
            'RAG-Enhanced Learning',
            'Skill Gap Analysis',
            'Real YouTube Video Recommendations',
            'Smart Resource Recommendations',
            'Performance Analytics',
            'Teacher Analytics Dashboard'
        ],
        'status': {
            'gemini_ai': '✅ Active' if gemini_model else '❌ Not configured',
            'youtube_api': '✅ Active' if youtube_service else '❌ Not configured',
            'rag_system': '✅ Active'
        }
    }), 200
# Add to app.py

@app.route('/api/teacher/<teacher_id>/class-insights', methods=['GET'])
def get_class_insights(teacher_id):
    """Get AI-powered insights for the entire class"""
    try:
        # Get all quizzes by this teacher
        quizzes_ref = db.reference('quizzes')
        teacher_quizzes = quizzes_ref.get() or {}
        teacher_quiz_ids = [quiz_id for quiz_id, quiz in teacher_quizzes.items() if quiz.get('teacherId') == teacher_id]
        
        # Get all attempts for these quizzes
        attempts_ref = db.reference('quiz_attempts')
        all_attempts = attempts_ref.get() or {}
        class_attempts = [attempt for attempt in all_attempts.values() if attempt.get('quizId') in teacher_quiz_ids]
        
        # Get all students in the class
        students_ref = db.reference('students')
        all_students = students_ref.get() or {}
        
        # If no attempts, return empty
        if not class_attempts:
            return jsonify({
                'success': True,
                'insights': "No quiz data available to generate class insights."
            }), 200
        
        # Gather data for the AI
        total_quizzes = len(class_attempts)
        total_students = len(set(attempt.get('studentId') for attempt in class_attempts))
        average_score = sum(attempt.get('percentage', 0) for attempt in class_attempts) / total_quizzes
        average_score = round(average_score, 2)
        
        # Identify common weak topics across the class
        weak_topics = defaultdict(int)
        for attempt in class_attempts:
            for topic in attempt.get('weakTopics', []):
                weak_topics[topic] += 1
        
        # Sort and get top 5
        common_weak_topics = sorted(weak_topics.items(), key=lambda x: x[1], reverse=True)[:5]
        common_weak_topics = [topic[0] for topic in common_weak_topics]
        
        # Prepare the context for the AI
        context = f"""
        Teacher Class Performance Analysis Report
        
        Class Statistics:
        - Total Students: {total_students}
        - Total Quizzes Taken: {total_quizzes}
        - Class Average Score: {average_score}%
        - Most Common Weak Topics: {', '.join(common_weak_topics)}
        """
        
        # Generate the prompt for the AI
        prompt = f"""
        You are an experienced education analyst with 15 years of experience. 
        Review the following class performance data and provide professional insights:
        
        {context}
        
        Please provide a comprehensive analysis with the following structure:
        
        # Class Performance Overview
        [Summary of overall class performance]
        
        # Key Strengths Observed
        [Bulleted list of 3-5 class strengths]
        
        # Common Learning Gaps
        [Bulleted list of 3-5 most common gaps across the class]
        
        # Recommendations for Class Instruction
        [Bulleted list of 5-7 specific teaching strategies to address gaps]
        
        # Top 3 Focus Areas
        [Prioritized areas for immediate attention]
        
        Format the response using Markdown. Be specific and actionable.
        """
        
        # Use Gemini to generate the insights
        response = gemini_model.generate_content(prompt)
        insights = response.text
        
        # Return the insights
        return jsonify({
            'success': True,
            'insights': insights
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
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
    print("🚀 EduMaster AI Backend Server - Complete Edition")
    print("="*80)
    print("📚 Features Enabled:")
    print("   ✓ User Authentication & Management")
    print("   ✓ Study Materials Upload & Download")
    print("   ✓ AI-Powered Quiz Generation (Gemini)")
    print("   ✓ RAG-Enhanced Context & Search")
    print("   ✓ Real YouTube Video Recommendations")
    print("   ✓ Quiz Attempts & Scoring")
    print("   ✓ Skill Gap Analysis with AI")
    print("   ✓ Smart Resource Recommendations")
    print("   ✓ Performance Analytics & Insights")
    print("   ✓ Resource Progress Tracking")
    print("   ✓ Teacher Analytics Dashboard")
    print("="*80)
    
    rag_stats = rag_system.get_stats()
    print(f"📊 RAG System Status:")
    print(f"   • Documents Indexed: {rag_stats['uniqueDocuments']}")
    print(f"   • Total Chunks: {rag_stats['totalChunks']}")
    print(f"   • Avg Chunk Length: {rag_stats['averageChunkLength']:.0f} chars")
    print("="*80)
    
    print(f"🤖 AI Services Status:")
    print(f"   • Gemini AI: {'✅ Connected' if gemini_model else '❌ Not configured'}")
    print(f"   • YouTube API: {'✅ Connected' if youtube_service else '❌ Not configured'}")
    print("="*80)
    
    print("🌐 Server running on: http://localhost:5000")
    print("📡 CORS enabled for: http://localhost:3000")
    print("="*80)
    
    if not gemini_model:
        print("⚠️  WARNING: GEMINI_API_KEY not found!")
    if not youtube_service:
        print("⚠️  WARNING: YOUTUBE_API_KEY not found!")
    print("="*80)
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=True, port=port, host='0.0.0.0')
