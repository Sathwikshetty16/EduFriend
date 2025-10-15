import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

const API_URL = 'http://localhost:5000/api';

const Dashboard = () => {
  // Active tab state
  const [activeTab, setActiveTab] = useState('materials');
  
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
const [classInsights, setClassInsights] = useState('');
const [insightsLoading, setInsightsLoading] = useState(false);
const [insightsError, setInsightsError] = useState(null);
  const [toughness, setToughness] = useState('Medium');
  const [targetGrade, setTargetGrade] = useState('Grade 10');
  const [numQuestions, setNumQuestions] = useState(10);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // AI Skill Gap Overview state
  const [studentsOverview, setStudentsOverview] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [lowPerformers, setLowPerformers] = useState([]);
  const [overviewStats, setOverviewStats] = useState({
    totalStudents: 0,
    classAverageScore: 0,
    classAverageCompletion: 0,
    lowPerformersCount: 0
  });

  const [user, setUser] = useState(null);
  const fileInputRef = useRef(null);
  const docFileInputRef = useRef(null);
  const quizContainerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    fetchMaterials();
    fetchQuizzes(parsedUser.uid);
  }, [navigate]);

  // Fetch students overview when AI Skill Gap tab is active
  useEffect(() => {
    if (user && activeTab === 'skill-gap') {
      fetchStudentsOverview();
    }
  }, [user, activeTab]);

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
  // ============ AI Performance Insights Functions ============

const fetchClassInsights = async () => {
  if (!user) return;
  
  setInsightsLoading(true);
  setInsightsError(null);
  
  try {
    const response = await axios.get(`${API_URL}/teacher/${user.uid}/class-insights`);
    if (response.data.success) {
      setClassInsights(response.data.insights);
    }
  } catch (error) {
    console.error('Error fetching class insights:', error);
    setInsightsError(error.response?.data?.error || 'Failed to load insights');
  } finally {
    setInsightsLoading(false);
  }
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

  // ============ AI Skill Gap Overview Functions ============

  const fetchStudentsOverview = async () => {
    if (!user) return;
    
    setOverviewLoading(true);
    try {
      const response = await axios.get(`${API_URL}/teacher/${user.uid}/students-overview`);
      if (response.data.success) {
        const students = response.data.students || [];
        setStudentsOverview(students);
        
        // Calculate statistics
        const totalStudents = students.length;
        const classAverageScore = totalStudents > 0 
          ? (students.reduce((sum, s) => sum + s.averageScore, 0) / totalStudents).toFixed(1)
          : 0;
        const classAverageCompletion = totalStudents > 0
          ? (students.reduce((sum, s) => sum + s.skillGapCompletion, 0) / totalStudents).toFixed(1)
          : 0;
        
        // Find students with completion rate < 20%
        const lowPerformingStudents = students.filter(
          student => student.skillGapCompletion < 20
        );
        setLowPerformers(lowPerformingStudents);
        
        setOverviewStats({
          totalStudents,
          classAverageScore,
          classAverageCompletion,
          lowPerformersCount: lowPerformingStudents.length
        });
        
        // Show alert if there are low performers
        if (lowPerformingStudents.length > 0) {
          const names = lowPerformingStudents.map(s => s.studentName).join(', ');
          setTimeout(() => {
            alert(
              `⚠️ ALERT: ${lowPerformingStudents.length} student(s) have skill gap completion below 20%:\n\n${names}\n\nThese students need immediate attention and additional support.`
            );
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error fetching students overview:', error);
      alert('Failed to load students overview: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setOverviewLoading(false);
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

  const getCompletionColor = (percentage) => {
    if (percentage >= 70) return '#34A853';
    if (percentage >= 40) return '#FBBC04';
    return '#EA4335';
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

  // ============ Render AI Skill Gap Overview ============
  const renderSkillGapOverview = () => (
    <div className="skill-gap-overview-content">
      <div className="overview-header">
        <div>
          <h2>AI-Powered Student Analytics</h2>
          <p className="section-subtitle">
            Comprehensive overview of student performance and skill gap completion across all your quizzes.
          </p>
        </div>
        <button 
          className="refresh-btn"
          onClick={fetchStudentsOverview}
          disabled={overviewLoading}
        >
          {overviewLoading ? '⏳ Loading...' : '🔄 Refresh Data'}
        </button>
      </div>

      {overviewLoading ? (
        <div className="loading-state">
          <div className="loading-spinner-large"></div>
          <p>Analyzing student performance data...</p>
        </div>
      ) : studentsOverview.length === 0 ? (
        <div className="empty-state-large">
          <div className="empty-icon-large">📊</div>
          <h3>No Student Data Available</h3>
          <p>Students haven't attempted any of your quizzes yet.</p>
          <p className="empty-hint">Once students start taking quizzes, their analytics will appear here.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="overview-summary-cards">
            <div className="summary-card">
              <div className="summary-icon">👥</div>
              <div className="summary-content">
                <span className="summary-value">{overviewStats.totalStudents}</span>
                <span className="summary-label">Total Students</span>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">📈</div>
              <div className="summary-content">
                <span className="summary-value">{overviewStats.classAverageScore}%</span>
                <span className="summary-label">Class Average Score</span>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">🎯</div>
              <div className="summary-content">
                <span className="summary-value">{overviewStats.classAverageCompletion}%</span>
                <span className="summary-label">Avg Skill Gap Completion</span>
              </div>
            </div>

            <div className="summary-card alert-card">
              <div className="summary-icon">⚠️</div>
              <div className="summary-content">
                <span className="summary-value">{overviewStats.lowPerformersCount}</span>
                <span className="summary-label">Students Need Attention</span>
              </div>
            </div>
          </div>

          {/* Low Performers Alert Section */}
          {lowPerformers.length > 0 && (
            <div className="alert-section">
              <div className="alert-header">
                <span className="alert-icon">⚠️</span>
                <h3>Students Requiring Immediate Attention (Below 20% Completion)</h3>
              </div>
              <div className="alert-students-grid">
                {lowPerformers.map((student, index) => (
                  <div key={index} className="alert-student-card">
                    <div className="alert-student-info">
                      <h4>{student.studentName}</h4>
                      <p className="student-email">{student.studentEmail}</p>
                    </div>
                    <div className="alert-stats">
                      <div className="alert-stat">
                        <span className="alert-stat-label">Avg Score</span>
                        <span className="alert-stat-value" style={{ color: getCompletionColor(student.averageScore) }}>
                          {student.averageScore.toFixed(1)}%
                        </span>
                      </div>
                      <div className="alert-stat">
                        <span className="alert-stat-label">Completion</span>
                        <span className="alert-stat-value danger">
                          {student.skillGapCompletion.toFixed(1)}%
                        </span>
                      </div>
                      <div className="alert-stat">
                        <span className="alert-stat-label">Resources</span>
                        <span className="alert-stat-value">
                          {student.completedResources}/{student.totalResources}
                        </span>
                      </div>
                    </div>
                    <div className="alert-actions">
                      <span className="urgent-badge">🚨 Urgent</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Students Performance Table */}
          <div className="students-table-section">
            <h3>Detailed Student Performance</h3>
            <div className="students-performance-table">
              <div className="performance-table-header">
                <div className="th-performance">Student Name</div>
                <div className="th-performance">Email</div>
                <div className="th-performance">Grade</div>
                <div className="th-performance">Quizzes</div>
                <div className="th-performance">Avg Score</div>
                <div className="th-performance">Resources</div>
                <div className="th-performance">Completion</div>
                <div className="th-performance">Status</div>
              </div>

              <div className="performance-table-body">
                {studentsOverview.map((student, index) => (
                  <div
                    key={index}
                    className={`performance-table-row ${student.skillGapCompletion < 20 ? 'row-alert' : ''}`}
                    onClick={() => navigate(`/student-performance/${student.studentId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="td-performance student-name-cell">
                      <div className="student-avatar">
                        {student.studentName.charAt(0).toUpperCase()}
                      </div>
                      <span>{student.studentName}</span>
                    </div>
                    <div className="td-performance">{student.studentEmail}</div>
                    <div className="td-performance">
                      <span className="grade-badge">{student.currentGrade}</span>
                    </div>
                    <div className="td-performance">
                      <span className="quiz-count-badge">{student.quizzesTaken}</span>
                    </div>
                    <div className="td-performance">
                      <div className="score-indicator">
                        <div 
                          className="score-bar"
                          style={{ 
                            width: `${student.averageScore}%`,
                            backgroundColor: getCompletionColor(student.averageScore)
                          }}
                        ></div>
                        <span className="score-text">{student.averageScore.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="td-performance">
                      <span className="resources-text">
                        {student.completedResources}/{student.totalResources}
                      </span>
                    </div>
                    <div className="td-performance">
                      <div className="completion-cell">
                        <div className="circular-progress">
                          <svg width="50" height="50" viewBox="0 0 50 50">
                            <circle
                              cx="25"
                              cy="25"
                              r="20"
                              fill="none"
                              stroke="#e8eaed"
                              strokeWidth="5"
                            />
                            <circle
                              cx="25"
                              cy="25"
                              r="20"
                              fill="none"
                              stroke={getCompletionColor(student.skillGapCompletion)}
                              strokeWidth="5"
                              strokeDasharray={`${(student.skillGapCompletion / 100) * 125.6} 125.6`}
                              strokeLinecap="round"
                              transform="rotate(-90 25 25)"
                            />
                            <text
                              x="25"
                              y="25"
                              textAnchor="middle"
                              dy=".3em"
                              fontSize="10"
                              fontWeight="bold"
                              fill={getCompletionColor(student.skillGapCompletion)}
                            >
                              {student.skillGapCompletion.toFixed(0)}%
                            </text>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="td-performance">
                      {student.skillGapCompletion < 20 ? (
                        <span className="status-badge status-critical">🚨 Critical</span>
                      ) : student.skillGapCompletion < 50 ? (
                        <span className="status-badge status-needs-improvement">⚠️ Needs Help</span>
                      ) : student.skillGapCompletion < 80 ? (
                        <span className="status-badge status-progressing">📈 Progressing</span>
                      ) : (
                        <span className="status-badge status-excellent">✅ Excellent</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Performance Distribution Chart */}
          <div className="distribution-section">
            <h3>Skill Gap Completion Distribution</h3>
            <div className="distribution-chart">
              {[
                { range: '0-20%', label: 'Critical', color: '#EA4335', count: studentsOverview.filter(s => s.skillGapCompletion < 20).length },
                { range: '20-50%', label: 'Needs Help', color: '#FBBC04', count: studentsOverview.filter(s => s.skillGapCompletion >= 20 && s.skillGapCompletion < 50).length },
                { range: '50-80%', label: 'Progressing', color: '#4A90E2', count: studentsOverview.filter(s => s.skillGapCompletion >= 50 && s.skillGapCompletion < 80).length },
                { range: '80-100%', label: 'Excellent', color: '#34A853', count: studentsOverview.filter(s => s.skillGapCompletion >= 80).length }
              ].map((segment, index) => (
                <div key={index} className="distribution-segment">
                  <div className="distribution-info">
                    <span className="range-label">{segment.range}</span>
                    <span className="category-label">({segment.label})</span>
                  </div>
                  <div className="distribution-bar-container">
                    <div 
                      className="distribution-bar"
                      style={{
                        width: `${(segment.count / studentsOverview.length) * 100}%`,
                        backgroundColor: segment.color
                      }}
                    >
                      {segment.count > 0 && (
                        <span className="bar-label">{segment.count}</span>
                      )}
                    </div>
                  </div>
                  <span className="count-label">
                    {segment.count} student{segment.count !== 1 ? 's' : ''} ({((segment.count / studentsOverview.length) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

 // ============ Render Performance Insights ============
const renderPerformanceInsights = () => {
  // Helper function to render markdown-style text
  const renderMarkdownContent = (text) => {
    if (!text) return null;
    
    return text.split('\n').map((line, index) => {
      // Headers
      if (line.startsWith('# ')) {
        return <h2 key={index} className="insight-heading">{line.replace('# ', '')}</h2>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={index} className="insight-subheading">{line.replace('## ', '')}</h3>;
      }
      
      // Bullet points
      if (line.trim().startsWith('- ')) {
        return (
          <li key={index} className="insight-bullet">
            {line.replace(/^- /, '')}
          </li>
        );
      }
      
      // Bold text
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={index} className="insight-paragraph">
            {parts.map((part, i) => 
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            )}
          </p>
        );
      }
      
      // Regular paragraphs
      if (line.trim()) {
        return <p key={index} className="insight-paragraph">{line}</p>;
      }
      
      return <br key={index} />;
    });
  };

  return (
    <div className="performance-insights-content">
      <div className="insights-header">
        <div>
          <h2>🤖 AI-Powered Class Performance Insights</h2>
          <p className="section-subtitle">
            Comprehensive analysis of your class performance with actionable recommendations
          </p>
        </div>
        <button 
          className="refresh-btn"
          onClick={fetchClassInsights}
          disabled={insightsLoading}
        >
          {insightsLoading ? '⏳ Generating Insights...' : '🔄 Refresh Insights'}
        </button>
      </div>

      {insightsLoading ? (
        <div className="loading-state">
          <div className="loading-spinner-large"></div>
          <p>Analyzing class performance data with AI...</p>
          <p className="loading-subtext">This may take a few moments</p>
        </div>
      ) : insightsError ? (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Unable to Load Insights</h3>
          <p>{insightsError}</p>
          <button className="retry-btn" onClick={fetchClassInsights}>
            🔄 Try Again
          </button>
        </div>
      ) : !classInsights ? (
        <div className="empty-state-large">
          <div className="empty-icon-large">🤖</div>
          <h3>No Insights Available Yet</h3>
          <p>Generate AI-powered insights by clicking the "Refresh Insights" button above.</p>
          <p className="empty-hint">
            Make sure students have completed some quizzes to get meaningful insights.
          </p>
        </div>
      ) : (
        <div className="insights-container">
          {/* AI Badge */}
          <div className="ai-badge-container">
            <span className="ai-badge">
              <span className="ai-icon">✨</span>
              AI-Generated Insights
            </span>
            <span className="generation-time">
              Generated on {new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {/* Insights Content */}
          <div className="insights-content-box">
            {renderMarkdownContent(classInsights)}
          </div>

          {/* Action Buttons */}
          <div className="insights-actions">
            <button 
              className="action-button primary"
              onClick={() => {
                const element = document.createElement('a');
                const file = new Blob([classInsights], { type: 'text/plain' });
                element.href = URL.createObjectURL(file);
                element.download = `class-insights-${new Date().toISOString().split('T')[0]}.txt`;
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
              }}
            >
              📥 Download Insights
            </button>
            <button 
              className="action-button secondary"
              onClick={() => {
                navigator.clipboard.writeText(classInsights);
                alert('Insights copied to clipboard!');
              }}
            >
              📋 Copy to Clipboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

  // ============ Main Render Content Switch ============
  const renderContent = () => {
    switch(activeTab) {
      case 'materials':
        return renderStudyMaterials();
      case 'quiz':
        return renderQuizGeneration();
      case 'skill-gap':
        return renderSkillGapOverview();
      case 'performance':
        return renderPerformanceInsights();
      default:
        return renderStudyMaterials();
    }
  };

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
          
          <div 
            className={`nav-item ${activeTab === 'skill-gap' ? 'active' : ''}`}
            onClick={() => setActiveTab('skill-gap')}
          >
            <span className="nav-icon">📊</span>
            <span>AI Skill Gap Overview</span>
          </div>
          
          <div 
            className={`nav-item ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
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
            {activeTab === 'materials' ? 'Study Materials' : 
             activeTab === 'quiz' ? 'Quiz Generation' :
             activeTab === 'skill-gap' ? 'AI Skill Gap Overview' :
             'AI Performance Insights'}
          </h1>
          <div className="header-actions">
            <span className="user-name">Welcome, {user?.fullName || 'Teacher'}</span>
            <button className="logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </header>

        {/* Dynamic Content Based on Active Tab */}
        <div className="content-wrapper">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
