import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

const API_URL = 'http://localhost:5000/api';

const Dashboard = () => {
  // Active tab state
  const [activeTab, setActiveTab] = useState('materials'); // 'materials' or 'quiz'
  
  // Study Materials state
  const [materials, setMaterials] = useState([]);
  const [uploadData, setUploadData] = useState({
    materialName: '',
    materialType: 'PDF',
    file: null
  });

  // Quiz Generation state
  const [quizzes, setQuizzes] = useState([]);
  const [quizFile, setQuizFile] = useState(null);
  const [toughness, setToughness] = useState('Medium');
  const [targetGrade, setTargetGrade] = useState('Grade 10');
  const [numQuestions, setNumQuestions] = useState(10);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [user, setUser] = useState(null);
  const fileInputRef = useRef(null);
  const docFileInputRef = useRef(null);
  const quizContainerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Fetch materials and quizzes
    fetchMaterials();
    fetchQuizzes(parsedUser.uid);
  }, [navigate]);

  // ============ Study Materials Functions ============

  const fetchMaterials = async () => {
    try {
      const response = await axios.get(`${API_URL}/materials`);
      if (response.data.success) {
        setMaterials(response.data.materials);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const handleFileChange = (e) => {
    setUploadData({
      ...uploadData,
      file: e.target.files[0]
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadData.file) {
      alert('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('materialName', uploadData.materialName);
    formData.append('materialType', uploadData.materialType);
    formData.append('teacherId', user.uid);
    formData.append('file', uploadData.file);

    try {
      const response = await axios.post(`${API_URL}/materials/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        alert('Material uploaded successfully!');
        setUploadData({ materialName: '', materialType: 'PDF', file: null });
        fetchMaterials();
      }
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    if (!window.confirm('Are you sure you want to delete this material?')) {
      return;
    }

    try {
      const response = await axios.delete(`${API_URL}/materials/${materialId}`);
      if (response.data.success) {
        alert('Material deleted successfully!');
        fetchMaterials();
      }
    } catch (error) {
      alert('Delete failed: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const handleDownloadMaterial = (materialId) => {
    window.open(`${API_URL}/materials/${materialId}/download`, '_blank');
  };

  // ============ Quiz Generation Functions ============

  const fetchQuizzes = async (teacherId) => {
    try {
      const response = await axios.get(`${API_URL}/quizzes?teacherId=${teacherId}`);
      if (response.data.success) {
        setQuizzes(response.data.quizzes);
      }
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    }
  };

  const handleDocumentUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only PDF and DOCX files are allowed');
      return;
    }
    setQuizFile(file);
  };

  const handleGenerateQuiz = async () => {
    if (!quizFile) {
      alert('Please select a document');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('file', quizFile);
    formData.append('toughness', toughness);
    formData.append('targetGrade', targetGrade);
    formData.append('teacherId', user.uid);
    formData.append('numQuestions', numQuestions);

    try {
      const response = await axios.post(`${API_URL}/quiz/generate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        alert('Quiz generated successfully!');
        fetchQuizzes(user.uid);
        setQuizFile(null);
      }
    } catch (error) {
      alert('Quiz generation failed: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewQuiz = (quizId) => {
    navigate(`/quiz-view/${quizId}`);
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;

    try {
      const response = await axios.delete(`${API_URL}/quizzes/${quizId}`);
      if (response.data.success) {
        alert('Quiz deleted successfully!');
        fetchQuizzes(user.uid);
      }
    } catch (error) {
      alert('Delete failed: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  // ============ Utility Functions ============

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date._seconds ? date._seconds * 1000 : date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getToughnessColor = (level) => {
    switch(level) {
      case 'Easy': return '#4caf50';
      case 'Medium': return '#ff9800';
      case 'Hard': return '#f44336';
      default: return '#999';
    }
  };

  const scrollLeft = () => {
    if (quizContainerRef.current) {
      quizContainerRef.current.scrollBy({ left: -350, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (quizContainerRef.current) {
      quizContainerRef.current.scrollBy({ left: 350, behavior: 'smooth' });
    }
  };

  // ============ Render Functions ============

  const renderStudyMaterials = () => (
    <div className="content-grid">
      {/* Upload Section */}
      <div className="upload-section">
        <h2>Upload New Study Material</h2>
        <p className="section-subtitle">Add new documents or files to your repository.</p>

        <div className="upload-form">
          <div className="form-field">
            <label>Material Name</label>
            <input
              type="text"
              placeholder="e.g., Algebra Basics PDF"
              value={uploadData.materialName}
              onChange={(e) => setUploadData({ ...uploadData, materialName: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label>Material Type</label>
            <select
              value={uploadData.materialType}
              onChange={(e) => setUploadData({ ...uploadData, materialType: e.target.value })}
            >
              <option value="PDF">PDF</option>
              <option value="Document">Document</option>
              <option value="Presentation">Presentation</option>
              <option value="Video">Video</option>
            </select>
          </div>

          <div className="form-field">
            <label>File</label>
            <div className="file-upload-area">
              <input
                type="file"
                id="file-input"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-input" className="file-upload-label">
                <div className="upload-icon">📤</div>
                <p>{uploadData.file ? uploadData.file.name : 'Drag and drop files here, or click to browse'}</p>
              </label>
            </div>
          </div>

          <button className="upload-btn" onClick={handleUpload}>
            Upload Material
          </button>
        </div>
      </div>

      {/* Materials List */}
      <div className="materials-section">
        <h2>Uploaded Materials</h2>
        <p className="section-subtitle">Manage your existing study materials.</p>

        <div className="materials-table">
          <div className="table-header">
            <div className="th">Name</div>
            <div className="th">Type</div>
            <div className="th">Upload Date</div>
            <div className="th">Actions</div>
          </div>

          <div className="table-body">
            {materials.length === 0 ? (
              <div className="empty-state">
                <p>No materials uploaded yet. Upload your first material!</p>
              </div>
            ) : (
              materials.map((material) => (
                <div key={material.id} className="table-row">
                  <div className="td">{material.name}</div>
                  <div className="td">
                    <span className="type-badge">{material.type}</span>
                  </div>
                  <div className="td">{formatDate(material.uploadDate)}</div>
                  <div className="td actions">
                    <button 
                      className="action-btn view-btn"
                      onClick={() => handleDownloadMaterial(material.id)}
                      title="Download"
                    >
                      📥
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteMaterial(material.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderQuizGeneration = () => (
    <div className="quiz-content">
      <div className="quiz-grid">
        {/* Left Section - Upload Documents */}
        <div className="upload-section">
          <h2>Upload Source Documents</h2>
          <p className="section-subtitle">Provide materials for AI-powered quiz generation.</p>

          <div className="upload-area">
            <input
              type="file"
              ref={docFileInputRef}
              onChange={handleDocumentUpload}
              accept=".pdf,.docx,.doc"
              style={{ display: 'none' }}
            />
            <button 
              className="select-doc-btn"
              onClick={() => docFileInputRef.current.click()}
              disabled={uploading}
            >
              📄 Select Document (PDF, DOCX)
            </button>
            <button 
              className="upload-btn-secondary"
              onClick={() => docFileInputRef.current.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>

          {quizFile && (
            <div className="selected-file">
              <p>Selected file: {quizFile.name}</p>
            </div>
          )}
        </div>

        {/* Right Section - Quiz Settings */}
        <div className="settings-section">
          <h2>Quiz Settings</h2>
          <p className="section-subtitle">Define parameters for your AI-generated quiz.</p>

          <div className="settings-form">
            <div className="form-field">
              <label>🎚️ Select Toughness</label>
              <select 
                value={toughness} 
                onChange={(e) => setToughness(e.target.value)}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div className="form-field">
              <label>🎓 Target Grade</label>
              <select 
                value={targetGrade} 
                onChange={(e) => setTargetGrade(e.target.value)}
              >
                <option value="Grade 6">Grade 6</option>
                <option value="Grade 7">Grade 7</option>
                <option value="Grade 8">Grade 8</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </select>
            </div>

            <div className="form-field">
              <label>❓ Number of Questions</label>
              <input
                type="number"
                min="5"
                max="50"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value) || 10)}
              />
            </div>

            <button 
              className="generate-quiz-btn"
              onClick={handleGenerateQuiz}
              disabled={loading || !quizFile}
            >
              {loading ? '⏳ Generating...' : '🎯 Generate Quiz'}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Quizzes - Horizontal Scroll */}
      <div className="recent-quizzes">
        <div className="quizzes-header">
          <div>
            <h2>Recent Quizzes</h2>
            <p className="section-subtitle">A list of quizzes you've generated recently.</p>
          </div>
          <div className="scroll-buttons">
            <button className="scroll-btn" onClick={scrollLeft}>←</button>
            <button className="scroll-btn" onClick={scrollRight}>→</button>
          </div>
        </div>

        {quizzes.length === 0 ? (
          <div className="no-quizzes">
            <p>No quizzes generated yet. Create your first quiz!</p>
          </div>
        ) : (
          <div className="quizzes-container" ref={quizContainerRef}>
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="quiz-card">
                <div className="quiz-card-header">
                  <h3>{quiz.title}</h3>
                  <span 
                    className="difficulty-badge"
                    style={{ backgroundColor: getToughnessColor(quiz.toughness) }}
                  >
                    {quiz.toughness}
                  </span>
                </div>
                <div className="quiz-card-body">
                  <p className="quiz-grade">🎓 {quiz.targetGrade}</p>
                  <p className="quiz-date">📅 {formatDate(quiz.createdAt)}</p>
                  <p className="quiz-questions">❓ {quiz.numQuestions || 0} Questions</p>
                </div>
                <div className="quiz-card-actions">
                  <button 
                    className="view-quiz-btn"
                    onClick={() => handleViewQuiz(quiz.id)}
                  >
                    👁️ View Quiz
                  </button>
                  <button 
                    className="delete-quiz-btn"
                    onClick={() => handleDeleteQuiz(quiz.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ============ Main Render ============

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">✨</span>
          <span className="logo-text">EduMasterAI</span>
        </div>

        <nav className="nav-menu">
          
          <div
            className={`nav-item ${activeTab === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveTab('materials')}
          >
            <span className="nav-icon">📚</span>
            <span>Study Materials</span>
          </div>
         
          <div 
            className={`nav-item ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            <span className="nav-icon">🎯</span>
            <span>Quiz Generation</span>
          </div>
          <div className="nav-item">
            <span className="nav-icon">📊</span>
            <span>AI Skill Gap Overview</span>
          </div>
          <div className="nav-item">
            <span className="nav-icon">📈</span>
            <span>AI Performance Insights</span>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="dashboard-header">
          <h1>
            {activeTab === 'materials' ? 'Study Materials' : 'Quiz Generation'}
          </h1>
          <div className="header-actions">
            <span className="user-name">Welcome, {user?.fullName || 'Teacher'}</span>
            <button className="logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </header>

        {/* Dynamic Content Based on Active Tab */}
        {activeTab === 'materials' ? renderStudyMaterials() : renderQuizGeneration()}
      </div>
    </div>
  );
};

export default Dashboard;
