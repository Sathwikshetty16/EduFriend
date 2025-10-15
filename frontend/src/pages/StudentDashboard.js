
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './StudentDashboard.css';

const API_URL = 'http://localhost:5000/api';

const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState('materials');
  const [user, setUser] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [attemptedQuizzes, setAttemptedQuizzes] = useState([]);
  const [skillGapData, setSkillGapData] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchAttemptedQuizzes = useCallback(async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/student/${user.uid}/quiz-attempts`);
      if (response.data.success) {
        setAttemptedQuizzes(response.data.attempts || []);
      }
    } catch (error) {
      console.error('Error fetching attempted quizzes:', error);
    }
  }, [user]);

  useEffect(() => {
    if (location.state?.quizCompleted) {
      fetchAttemptedQuizzes();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, fetchAttemptedQuizzes, navigate]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchMaterials();
      fetchAllQuizzes();
      fetchAttemptedQuizzes();
    }
  }, [user, fetchAttemptedQuizzes]);

  const fetchAllQuizzes = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/student/${user.uid}/quizzes`);
      if (response.data.success) {
        setQuizzes(response.data.quizzes);
      }
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    }
  };


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

  const handleDownloadMaterial = (materialId) => {
    window.open(`${API_URL}/materials/${materialId}/download`, '_blank');
  };

  const handleAttemptQuiz = (quizId) => {
    navigate(`/quiz-attempt/${quizId}`);
  };

  const handleViewResults = (attemptId) => {
    navigate(`/quiz-results/attempt/${attemptId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return '#34A853';
    if (percentage >= 60) return '#FBBC04';
    return '#EA4335';
  };

  const getDifficultyColor = (difficulty) => {
    switch(difficulty?.toLowerCase()) {
      case 'easy': return '#34A853';
      case 'medium': return '#4A90E2';
      case 'hard': return '#EA4335';
      default: return '#757575';
    }
  };

  const getAttemptStatus = (quizId) => {
    const attempts = attemptedQuizzes.filter(a => a.quizId === quizId);
    if (attempts.length === 0) return null;
    
    const bestAttempt = attempts.reduce((best, current) => 
      current.percentage > best.percentage ? current : best
    );
    
    return {
      attempted: true,
      attemptId: bestAttempt.id,
      score: bestAttempt.score,
      totalQuestions: bestAttempt.totalQuestions,
      percentage: bestAttempt.percentage
    };
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    let date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue._seconds) {
      date = new Date(dateValue._seconds * 1000);
    } else {
      date = new Date(dateValue);
    }
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };


  // ============ Render Study Materials ============
  const renderStudyMaterials = () => (
    <div className="content-section">
      <div className="page-header">
        <div>
          <h1 className="page-title">Study Materials</h1>
          <p className="page-subtitle">Access learning resources uploaded by your teachers.</p>
        </div>
      </div>
      
      <div className="materials-grid-cards">
        {materials.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>No Materials Available</h3>
            <p>Your teachers haven't uploaded any materials yet. Check back later!</p>
          </div>
        ) : (
          materials.map((material) => (
            <div key={material.id} className="material-card-compact">
              <div className="material-card-icon">
                {material.type === 'PDF' ? '📄' : 
                 material.type === 'Video' ? '🎥' :
                 material.type === 'Presentation' ? '📊' : '📝'}
              </div>
              <div className="material-card-content">
                <h3 className="material-card-title">{material.name}</h3>
                <div className="material-card-meta">
                  <span className="material-meta-type">{material.type} Document</span>
                  <span className="material-meta-date">Uploaded: {formatDate(material.uploadDate)}</span>
                </div>
              </div>
              <button
                className="download-btn-compact"
                onClick={() => handleDownloadMaterial(material.id)}
                title="Download"
              >
                ⬇
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ============ Render Quiz Section ============
  const renderQuizSection = () => (
    <div className="content-section">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quizzes</h1>
          <p className="page-subtitle">Test your knowledge and track your progress across various subjects.</p>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>No Quizzes Available</h3>
          <p>Your teachers haven't created any quizzes yet. Check back soon!</p>
        </div>
      ) : (
        <div className="quizzes-grid-new">
          {quizzes.map((quiz) => {
            const status = getAttemptStatus(quiz.id);
            return (
              <div key={quiz.id} className="quiz-card-new">
                <div className="quiz-card-header">
                  <h3 className="quiz-title">{quiz.title || 'Untitled Quiz'}</h3>
                  <span 
                    className="difficulty-badge-new"
                    style={{ 
                      backgroundColor: `${getDifficultyColor(quiz.toughness)}15`,
                      color: getDifficultyColor(quiz.toughness)
                    }}
                  >
                    {quiz.toughness || 'Medium'}
                  </span>
                </div>
                
                <div className="quiz-meta-info">
                  <div className="meta-item">
                    <span className="meta-icon">🎓</span>
                    <span className="meta-text">Grade {quiz.targetGrade}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-icon">❓</span>
                    <span className="meta-text">{quiz.numQuestions || 0} Questions</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-icon">📅</span>
                    <span className="meta-text">Due: {formatDate(quiz.createdAt)}</span>
                  </div>
                </div>

                {status && status.attempted ? (
                  <div className="quiz-status-section">
                    <div className="score-info">
                      <span className="score-label">Your Best Score</span>
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar-fill"
                          style={{ 
                            width: `${status.percentage}%`,
                            backgroundColor: getScoreColor(status.percentage)
                          }}
                        ></div>
                      </div>
                      <span className="score-percentage">{status.percentage}%</span>
                    </div>
                    <div className="quiz-actions">
                      <button
                        className="retake-button"
                        onClick={() => handleAttemptQuiz(quiz.id)}
                      >
                        <span>🔄</span>
                        Retake
                      </button>
                      <button
                        className="results-button"
                        onClick={() => handleViewResults(status.attemptId)}
                      >
                        <span>📊</span>
                        Results
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="start-quiz-button"
                    onClick={() => handleAttemptQuiz(quiz.id)}
                  >
                    <span>🚀</span>
                    Start Quiz
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );


  const renderContent = () => {
    switch (activeTab) {
      case 'materials':
        return renderStudyMaterials();
      case 'quiz':
        return renderQuizSection();
      default:
        return renderStudyMaterials();
    }
  };

  return (
    <div className="student-dashboard">
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
            <span>Quizzes</span>
          </div>
        </nav>
      </aside>
      
      <div className="main-content">
        <header className="dashboard-header">
          <h1>
            {activeTab === 'materials' ? 'Study Materials' :
             'Quizzes'}
          </h1>
          <div className="header-actions">
            <span className="user-name">Welcome, {user?.fullName || 'Student'}</span>
            <button className="logout-btn" onClick={handleLogout}>
              � Logout
            </button>
          </div>
        </header>
        <div className="content-area">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
