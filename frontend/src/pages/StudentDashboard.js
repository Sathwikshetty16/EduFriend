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
  const [performanceStats, setPerformanceStats] = useState(null);
  const [topicMaterials, setTopicMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
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
      if (activeTab === 'skill-gap') {
        fetchSkillGapAnalysis();
        fetchTopicSpecificMaterials();
      }
      if (activeTab === 'performance') {
        fetchPerformanceStats();
      }
    }
  }, [user, activeTab, fetchAttemptedQuizzes]);

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

  const fetchSkillGapAnalysis = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/student/${user.uid}/skill-gap`);
      if (response.data.success) {
        setSkillGapData(response.data.analysis);
      }
    } catch (error) {
      console.error('Error fetching skill gap analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicSpecificMaterials = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/student/${user.uid}/topic-specific-materials`);
      if (response.data.success) {
        setTopicMaterials(response.data.topicMaterials || []);
      }
    } catch (error) {
      console.error('Error fetching topic-specific materials:', error);
    }
  };

  const fetchPerformanceStats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/student/${user.uid}/performance-stats`);
      if (response.data.success) {
        setPerformanceStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching performance stats:', error);
    } finally {
      setLoading(false);
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
    navigate(`/quiz-results/${attemptId}`);
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
      <div className="section-header">
        <div>
          <h2>Study Materials</h2>
          <p className="section-subtitle">Access learning resources uploaded by your teachers</p>
        </div>
      </div>
      
      <div className="materials-grid">
        {materials.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>No Materials Available</h3>
            <p>Your teachers haven't uploaded any materials yet. Check back later!</p>
          </div>
        ) : (
          materials.map((material) => (
            <div key={material.id} className="material-card">
              <div className="material-icon">
                {material.type === 'PDF' ? '📄' : 
                 material.type === 'Video' ? '🎥' :
                 material.type === 'Presentation' ? '📊' : '📝'}
              </div>
              <div className="material-info">
                <h3>{material.name}</h3>
                <span className="material-type">{material.type}</span>
                <p className="material-date">
                  📅 {formatDate(material.uploadDate)}
                </p>
              </div>
              <button
                className="download-btn"
                onClick={() => handleDownloadMaterial(material.id)}
              >
                <span>📥</span>
                <span>Download</span>
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
      <div className="section-header">
        <div>
          <h2>Available Quizzes</h2>
          <p className="section-subtitle">Test your knowledge and track your progress</p>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>No Quizzes Available</h3>
          <p>Your teachers haven't created any quizzes yet. Check back soon!</p>
        </div>
      ) : (
        <div className="quizzes-grid">
          {quizzes.map((quiz) => {
            const status = getAttemptStatus(quiz.id);
            return (
              <div key={quiz.id} className="quiz-card-student" data-toughness={quiz.toughness}>
                <div className="quiz-header">
                  <h3>{quiz.title || 'Untitled Quiz'}</h3>
                  <span className="difficulty-badge">{quiz.toughness}</span>
                </div>
                
                <div className="quiz-details">
                  <div className="detail-item">
                    <span className="detail-icon">🎓</span>
                    <span>{quiz.targetGrade}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-icon">❓</span>
                    <span>{quiz.numQuestions || 0} Questions</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-icon">📅</span>
                    <span>{formatDate(quiz.createdAt)}</span>
                  </div>
                </div>

                {status && status.attempted ? (
                  <div className="quiz-status">
                    <div className="score-badge" style={{ backgroundColor: getScoreColor(status.percentage) }}>
                      <span className="score-value">{status.percentage}%</span>
                      <span className="score-label">Your Best Score</span>
                    </div>
                    <div className="status-actions">
                      <button
                        className="retake-btn"
                        onClick={() => handleAttemptQuiz(quiz.id)}
                      >
                        🔄 Retake
                      </button>
                      <button
                        className="view-results-btn"
                        onClick={() => handleViewResults(status.attemptId)}
                      >
                        📊 Results
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="attempt-btn"
                    onClick={() => handleAttemptQuiz(quiz.id)}
                  >
                    <span>🚀</span>
                    <span>Start Quiz</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ============ Render Skill Gap Analysis ============
  const renderSkillGap = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading analysis...</p>
        </div>
      );
    }

    return (
      <div className="content-section">
        <div className="section-header">
          <div>
            <h2>Skill Gap Analysis</h2>
            <p className="section-subtitle">AI-powered analysis of your learning gaps with personalized recommendations</p>
          </div>
        </div>

        {attemptedQuizzes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No Data Available</h3>
            <p>Complete some quizzes to see your skill gap analysis and personalized recommendations!</p>
            <button className="cta-btn" onClick={() => setActiveTab('quiz')}>
              Take Your First Quiz
            </button>
          </div>
        ) : (
          <div className="skill-gap-container">
            {/* Overall Performance */}
            <div className="performance-overview">
              <h3>📈 Overall Performance</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">✅</div>
                  <div className="stat-content">
                    <span className="stat-value">{skillGapData?.totalAttempts || attemptedQuizzes.length}</span>
                    <span className="stat-label">Quizzes Completed</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <span className="stat-value">
                      {skillGapData?.averageScore || 
                        (attemptedQuizzes.length > 0
                          ? (attemptedQuizzes.reduce((sum, a) => sum + a.percentage, 0) / attemptedQuizzes.length).toFixed(1)
                          : 0)}%
                    </span>
                    <span className="stat-label">Average Score</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🎯</div>
                  <div className="stat-content">
                    <span className="stat-value">
                      {attemptedQuizzes.filter(a => a.percentage >= 80).length}
                    </span>
                    <span className="stat-label">High Scores (80%+)</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">
                    {skillGapData?.improvementTrend === 'improving' ? '📈' : 
                     skillGapData?.improvementTrend === 'declining' ? '📉' : '➡️'}
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">
                      {skillGapData?.improvementTrend === 'improving' ? 'Improving' :
                       skillGapData?.improvementTrend === 'declining' ? 'Declining' :
                       skillGapData?.improvementTrend === 'stable' ? 'Stable' : 'N/A'}
                    </span>
                    <span className="stat-label">Learning Trend</span>
                  </div>
                </div>
              </div>
            </div>

            {/* NEW: Topic-Specific Study Material Recommendations */}
            {topicMaterials && topicMaterials.length > 0 && (
              <div className="topic-materials-section">
                <h3>📖 Focus Areas & Recommended Study Materials</h3>
                <p className="resources-subtitle">
                  Materials from your teacher mapped to topics you need to improve
                </p>
                
                {topicMaterials.map((topicItem, index) => (
                  <div key={index} className="topic-material-group">
                    <div className="topic-header">
                      <div className="topic-info">
                        <h4>{topicItem.topic}</h4>
                        <span className="error-badge">
                          {topicItem.errorCount} {topicItem.errorCount > 1 ? 'errors' : 'error'}
                        </span>
                      </div>
                      <div className="priority-badge">
                        {index < 3 ? '🔥 High Priority' : '⚡ Focus Area'}
                      </div>
                    </div>
                    
                    <div className="topic-materials-list">
                      {topicItem.recommendedMaterials.map((material, mIndex) => (
                        <div key={mIndex} className="topic-material-card">
                          <div className="material-match-score">
                            <div className="match-circle" style={{
                              background: `conic-gradient(var(--google-blue) ${material.similarity * 3.6}deg, var(--color-muted) 0deg)`
                            }}>
                              <div className="match-inner">
                                <span>{material.similarity}%</span>
                              </div>
                            </div>
                            <span className="match-label">Match</span>
                          </div>
                          
                          <div className="material-details">
                            <h5>{material.materialName}</h5>
                            <p className="relevant-content">
                              <strong>Relevant section:</strong> "{material.relevantContent}"
                            </p>
                            <button
                              className="access-material-btn"
                              onClick={() => handleDownloadMaterial(material.materialId)}
                            >
                              📥 Access This Material
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Strong Areas */}
            {skillGapData && skillGapData.strongAreas && skillGapData.strongAreas.length > 0 && (
              <div className="strong-areas">
                <h3>💪 Strong Areas</h3>
                <div className="strong-areas-list">
                  {skillGapData.strongAreas.map((area, index) => (
                    <div key={index} className="strong-area-card">
                      <span className="strong-icon">✨</span>
                      <div className="strong-content">
                        <h4>{area.topic}</h4>
                        <span className="strong-score">{area.score.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topic-wise Error Analysis */}
            {skillGapData && skillGapData.topicErrorAnalysis && skillGapData.topicErrorAnalysis.length > 0 && (
              <div className="error-analysis">
                <h3>🔍 Topic-wise Error Analysis</h3>
                <p className="resources-subtitle">Questions you struggled with most</p>
                <div className="error-topics-list">
                  {skillGapData.topicErrorAnalysis.map((item, index) => (
                    <div key={index} className="error-topic-card">
                      <div className="error-rank">{index + 1}</div>
                      <div className="error-content">
                        <h4>{item[0]}</h4>
                        <span className="error-count">{item[1]} {item[1] > 1 ? 'errors' : 'error'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI-Powered Recommendations */}
            {skillGapData && skillGapData.recommendations && skillGapData.recommendations.length > 0 && (
              <div className="ai-recommendations">
                <h3>🤖 AI-Powered Learning Recommendations</h3>
                <p className="resources-subtitle">Personalized suggestions based on your performance</p>
                <div className="recommendations-list">
                  {skillGapData.recommendations.map((recommendation, index) => (
                    <div key={index} className="recommendation-card">
                      <div className="recommendation-number">{index + 1}</div>
                      <div className="recommendation-content">
                        <p>{recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resource Recommendations */}
            {skillGapData && skillGapData.resourceRecommendations && (
              <div className="resource-recommendations">
                {/* Study Materials */}
                {skillGapData.resourceRecommendations.studyMaterials && 
                                 skillGapData.resourceRecommendations.studyMaterials.length > 0 && (
                  <div className="resource-section">
                    <h3>📚 Recommended Study Materials</h3>
                    <p className="resources-subtitle">Materials from your courses that can help</p>
                    <div className="resources-grid">
                      {skillGapData.resourceRecommendations.studyMaterials.map((material, index) => (
                        <div key={index} className="resource-card">
                          <div className="resource-icon">📄</div>
                          <h4>{material.title}</h4>
                          <p className="resource-description">{material.description}</p>
                          <button
                            className="resource-btn"
                            onClick={() => handleDownloadMaterial(material.id)}
                          >
                            Access Material
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Online Resources */}
                {skillGapData.resourceRecommendations.onlineResources && 
                 skillGapData.resourceRecommendations.onlineResources.length > 0 && (
                  <div className="resource-section">
                    <h3>🌐 Online Learning Resources</h3>
                    <p className="resources-subtitle">Curated articles and tutorials</p>
                    <div className="online-resources-list">
                      {skillGapData.resourceRecommendations.onlineResources.map((resource, index) => (
                        <div key={index} className="online-resource-card">
                          <div className="online-resource-icon">🔗</div>
                          <div className="online-resource-content">
                            <h4>{resource.title}</h4>
                            <p>{resource.description}</p>
                            <a 
                              href={resource.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="online-resource-link"
                            >
                              Visit Resource →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* YouTube Videos */}
                {skillGapData.resourceRecommendations.youtubeVideos && 
                 skillGapData.resourceRecommendations.youtubeVideos.length > 0 && (
                  <div className="resource-section">
                    <h3>🎥 Video Tutorials</h3>
                    <p className="resources-subtitle">Learn through video content</p>
                    <div className="youtube-videos-list">
                      {skillGapData.resourceRecommendations.youtubeVideos.map((video, index) => (
                        <div key={index} className="youtube-video-card">
                          <div className="youtube-icon">▶️</div>
                          <div className="youtube-content">
                            <h4>{video.title}</h4>
                            <p>{video.description}</p>
                            <a 
                              href={video.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="youtube-link"
                            >
                              Watch on YouTube →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Enhanced General Materials Section with Focus Indicators */}
            {materials.length > 0 && (
              <div className="recommended-resources">
                <h3>📚 All Study Materials</h3>
                <p className="resources-subtitle">
                  Materials marked with 🎯 are highly relevant to your weak areas
                </p>
                <div className="resources-grid">
                  {materials.map((material) => {
                    const isRecommended = topicMaterials.some(tm => 
                      tm.recommendedMaterials.some(rm => rm.materialId === material.id)
                    );
                    
                    return (
                      <div 
                        key={material.id} 
                        className={`resource-card ${isRecommended ? 'highly-relevant' : ''}`}
                      >
                        {isRecommended && (
                          <div className="relevance-indicator">
                            <span>🎯 Recommended for You</span>
                          </div>
                        )}
                        <div className="resource-icon">
                          {material.type === 'PDF' ? '📄' : 
                           material.type === 'Video' ? '🎥' :
                           material.type === 'Presentation' ? '📊' : '📝'}
                        </div>
                        <h4>{material.name}</h4>
                        <span className="resource-type">{material.type}</span>
                        <button
                          className="resource-btn"
                          onClick={() => handleDownloadMaterial(material.id)}
                        >
                          {isRecommended ? 'Priority Access' : 'Access Resource'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============ Render Performance ============
  const renderPerformance = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading performance data...</p>
        </div>
      );
    }

    return (
      <div className="content-section">
        <div className="section-header">
          <div>
            <h2>Performance Insights</h2>
            <p className="section-subtitle">Track your learning progress over time</p>
          </div>
        </div>

        {attemptedQuizzes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <h3>No Performance Data</h3>
            <p>Start taking quizzes to see detailed performance insights!</p>
            <button className="cta-btn" onClick={() => setActiveTab('quiz')}>
              Take Your First Quiz
            </button>
          </div>
        ) : (
          <div className="performance-container">
            {/* Performance Summary */}
            {performanceStats && (
              <div className="performance-summary">
                <h3>Performance Summary</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-content">
                      <span className="stat-value">{performanceStats.totalQuestions}</span>
                      <span className="stat-label">Total Questions</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                      <span className="stat-value">{performanceStats.correctAnswers}</span>
                      <span className="stat-label">Correct Answers</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-content">
                      <span className="stat-value">{performanceStats.averageScore}%</span>
                      <span className="stat-label">Average Score</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">⭐</div>
                    <div className="stat-content">
                      <span className="stat-value">{performanceStats.highestScore}%</span>
                      <span className="stat-label">Highest Score</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Attempts */}
            <div className="recent-attempts">
              <h3>Recent Quiz Attempts</h3>
              <div className="attempts-list">
                {attemptedQuizzes.slice(0, 10).map((attempt, index) => (
                  <div key={index} className="attempt-item">
                    <div className="attempt-info">
                      <h4>{attempt.quizTitle}</h4>
                      <p className="attempt-date">{formatDate(attempt.completedAt)}</p>
                    </div>
                    <div className="attempt-score-display">
                      <div 
                        className="score-circle"
                        style={{ borderColor: getScoreColor(attempt.percentage) }}
                      >
                        <span style={{ color: getScoreColor(attempt.percentage) }}>
                          {attempt.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <span className="attempt-details">
                        {attempt.score}/{attempt.totalQuestions} Correct
                      </span>
                    </div>
                    <button
                      className="view-attempt-btn"
                      onClick={() => handleViewResults(attempt.id)}
                    >
                      View Details →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'materials':
        return renderStudyMaterials();
      case 'quiz':
        return renderQuizSection();
      case 'skill-gap':
        return renderSkillGap();
      case 'performance':
        return renderPerformance();
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
          <div
            className={`nav-item ${activeTab === 'skill-gap' ? 'active' : ''}`}
            onClick={() => setActiveTab('skill-gap')}
          >
            <span className="nav-icon">📊</span>
            <span>Skill Gap Analysis</span>
          </div>
          <div
            className={`nav-item ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
            <span className="nav-icon">📈</span>
            <span>Performance</span>
          </div>
        </nav>
      </aside>
      
      <div className="main-content">
        <header className="dashboard-header">
          <h1>
            {activeTab === 'materials' ? 'Study Materials' :
             activeTab === 'quiz' ? 'Quizzes' :
             activeTab === 'skill-gap' ? 'Skill Gap Analysis' :
             'Performance Insights'}
          </h1>
          <div className="header-actions">
            <span className="user-name">Welcome, {user?.fullName || 'Student'}</span>
            <button className="logout-btn" onClick={handleLogout}>
              🚪 Logout
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