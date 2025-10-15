import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import './SkillGapAnalysis.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const SkillGapAnalysis = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flippedCards, setFlippedCards] = useState({});

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const [analysisRes, analyticsRes] = await Promise.all([
        axios.get(`${API_URL}/quiz-results/attempt/${attemptId}/analysis`),
        axios.get(`${API_URL}/quiz-results/attempt/${attemptId}/detailed-analytics`)
      ]);
      
      if (analysisRes.data.success) {
        setAnalysis(analysisRes.data.analysis);
      }
      
      if (analyticsRes.data.success) {
        setAnalytics(analyticsRes.data.analytics);
      }
    } catch (err) {
      setError('An error occurred while fetching the analysis.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleCardFlip = (index) => {
    setFlippedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleDownloadMaterial = (materialId) => {
    window.open(`${API_URL}/materials/${materialId}/download`, '_blank');
  };

  if (loading) {
    return (
      <div className="analysis-loading">
        <div className="loading-spinner-large"></div>
        <p>Analyzing Your Performance...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analysis-error">
        <div className="error-icon">⚠️</div>
        <h2>Oops!</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="error-back-btn">
          Go Back
        </button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="analysis-error">
        <div className="error-icon">📊</div>
        <h2>Analysis Not Found</h2>
        <p>We couldn't find the analysis for this quiz attempt.</p>
        <button onClick={() => navigate(-1)} className="error-back-btn">
          Go Back
        </button>
      </div>
    );
  }

  // Prepare chart data
  const pieChartData = analytics ? [
    { name: 'Correct', value: analytics.answerDistribution.correct, color: '#4CAF50' },
    { name: 'Incorrect', value: analytics.answerDistribution.incorrect, color: '#F44336' },
    { name: 'Not Attempted', value: analytics.answerDistribution.notAttempted, color: '#FFC107' }
  ].filter(item => item.value > 0) : [];

  // REMOVED: const COLORS = ['#4CAF50', '#F44336', '#FFC107'];
  // Colors are already defined in pieChartData array above

  return (
    <div className="skill-gap-analysis">
      {/* Header */}
      <div className="analysis-header">
        <button onClick={() => navigate(-1)} className="back-arrow-btn">
          ← Back
        </button>
        <div className="header-content">
          <h1>🎯 Your Personalized Learning Plan</h1>
          <p>AI-powered insights to help you improve</p>
        </div>
      </div>

      {/* Analytics Section - Pie Chart and Time Analysis */}
      {analytics && (
        <>
          {/* Answer Distribution Pie Chart */}
          <div className="analytics-section">
            <div className="section-header-analysis">
              <h2>📊 Answer Distribution</h2>
              <p className="section-subtitle">Your performance breakdown</p>
            </div>
            
            <div className="pie-chart-container styled-pie-chart">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              
              {/* <div className="distribution-stats">
                <div className="stat-item correct">
                  <span className="stat-icon">✓</span>
                  <span className="stat-label">Correct</span>
                  <span className="stat-value">{analytics.answerDistribution.correct}</span>
                </div>
                <div className="stat-item incorrect">
                  <span className="stat-icon">✗</span>
                  <span className="stat-label">Incorrect</span>
                  <span className="stat-value">{analytics.answerDistribution.incorrect}</span>
                </div>
                <div className="stat-item not-attempted">
                  <span className="stat-icon">○</span>
                  <span className="stat-label">Not Attempted</span>
                  <span className="stat-value">{analytics.answerDistribution.notAttempted}</span>
                </div>
              </div>
          */}
            </div> 
          </div>

          {/* Time Analysis Section */}
          <div className="time-analysis-section">
            <div className="section-header-analysis">
              <h2>⏱️ Time Analysis vs. AI Benchmark</h2>
              <p className="section-subtitle">Compare your pace with recommended times</p>
            </div>
            
            <div className="time-summary">
              <div className="time-summary-card">
                <span className="time-label">Your Total Time</span>
                <span className="time-value">{Math.floor(analytics.totalTime / 60)}m {analytics.totalTime % 60}s</span>
              </div>
              <div className="time-summary-card">
                <span className="time-label">Benchmark Time</span>
                <span className="time-value">{Math.floor(analytics.benchmarkTotalTime / 60)}m {Math.round(analytics.benchmarkTotalTime % 60)}s</span>
              </div>
              <div className="time-summary-card">
                <span className="time-label">Avg Per Question</span>
                <span className="time-value">{analytics.averageTimePerQuestion}s</span>
              </div>
            </div>

            {/* Time Comparison Bar Chart */}
            <div className="time-chart-container">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analytics.timeAnalysis} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  {/* <XAxis 
                    dataKey="questionNumber" 
                    label={{ value: 'Question Number', position: 'insideBottom', offset: -10 }}
                  /> */}
                  <YAxis label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-title">Q{data.questionNumber}</p>
                            <p className="tooltip-question">{data.questionText}</p>
                            <p className="tooltip-your">Your time: <strong>{data.estimatedTime}s</strong></p>
                            <p className="tooltip-benchmark">Benchmark: <strong>{data.benchmarkTime}s</strong></p>
                            <p className={`tooltip-diff ${data.difference > 0 ? 'slower' : 'faster'}`}>
                              {data.difference > 0 ? '🐌 ' : '⚡ '}
                              {Math.abs(data.difference)}s {data.difference > 0 ? 'slower' : 'faster'}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="estimatedTime" fill="#2196F3" name="Your Time" />
                  <Bar dataKey="benchmarkTime" fill="#FF9800" name="AI Benchmark" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Time Insights */}
            <div className="time-insights">
              {analytics.averageTimePerQuestion > (analytics.benchmarkTotalTime / analytics.timeAnalysis.length) + 10 ? (
                <div className="insight-card warning">
                  <span className="insight-icon">🐌</span>
                  <div className="insight-content">
                    <h4>Consider Pacing</h4>
                    <p>You're taking longer than recommended. Try to manage your time better during the quiz.</p>
                  </div>
                </div>
              ) : analytics.averageTimePerQuestion < (analytics.benchmarkTotalTime / analytics.timeAnalysis.length) - 10 ? (
                <div className="insight-card success">
                  <span className="insight-icon">⚡</span>
                  <div className="insight-content">
                    <h4>Great Pace!</h4>
                    <p>You're faster than the benchmark. Just ensure accuracy isn't compromised.</p>
                  </div>
                </div>
              ) : (
                <div className="insight-card info">
                  <span className="insight-icon">✓</span>
                  <div className="insight-content">
                    <h4>Optimal Pace</h4>
                    <p>Your timing is well-balanced with the recommended pace.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* AI Recommendations - Flip Cards */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div className="recommendations-section">
          <div className="section-header-analysis">
            <h2>🤖 AI-Powered Recommendations</h2>
            <p className="section-subtitle">Click any card to reveal detailed suggestions</p>
          </div>
          
          <div className="flip-cards-grid">
            {analysis.recommendations.map((recommendation, index) => (
              <div 
                key={index} 
                className={`flip-card ${flippedCards[index] ? 'flipped' : ''}`}
                onClick={() => handleCardFlip(index)}
              >
                <div className="flip-card-inner">
                  {/* Front of Card */}
                  <div className="flip-card-front">
                    <div className="card-number">
                      <span>{index + 1}</span>
                    </div>
                    <div className="card-icon">💡</div>
                    <h3>Suggestion {index + 1}</h3>
                    <p className="card-hint">Click to view</p>
                    <div className="flip-indicator">🔄</div>
                  </div>
                  
                  {/* Back of Card */}
                  <div className="flip-card-back">
                    <div className="back-header">
                      <span className="back-number">{index + 1}</span>
                      <span className="back-icon">✨</span>
                    </div>
                    <div className="recommendation-text">
                      {recommendation}
                    </div>
                    <div className="flip-back-indicator">
                      🔄 Click to flip back {recommendation.length > 150 && '• Scroll to read more'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teacher Materials */}
      {analysis.teacherMaterials && analysis.teacherMaterials.length > 0 && (
        <div className="teacher-materials-section">
          <div className="section-header-analysis">
            <h2>👨‍🏫 Materials from Your Teacher</h2>
            <p className="section-subtitle">Additional resources shared by your instructor</p>
          </div>

          <div className="teacher-materials-grid">
            {analysis.teacherMaterials.map((material, index) => (
              <div key={index} className="teacher-material-card">
                <div className="teacher-card-header">
                  <div className="material-type-badge">
                    {material.type === 'PDF' ? '📄' : 
                     material.type === 'Video' ? '🎥' :
                     material.type === 'Presentation' ? '📊' : '📝'}
                  </div>
                  <span className="teacher-badge">From Teacher</span>
                </div>

                <div className="teacher-card-body">
                  <h4>{material.title}</h4>
                  <p>{material.description}</p>
                </div>

                <div className="teacher-card-footer">
                  <button
                    className="download-teacher-btn"
                    onClick={() => handleDownloadMaterial(material.id)}
                  >
                    <span>⬇️</span>
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!analysis.recommendations || analysis.recommendations.length === 0) &&
       (!analysis.topicSpecificMaterials || analysis.topicSpecificMaterials.length === 0) &&
       (!analysis.teacherMaterials || analysis.teacherMaterials.length === 0) && (
        <div className="empty-analysis">
          <div className="empty-icon">🎉</div>
          <h2>Great Job!</h2>
          <p>You performed excellently! No specific areas for improvement identified.</p>
          <button onClick={() => navigate(-1)} className="continue-btn">
            Continue Learning
          </button>
        </div>
      )}

      {/* Footer Actions */}
      <div className="analysis-footer">
        <button onClick={() => navigate(`/quiz-results/attempt/${attemptId}`)} className="view-results-btn">
          📊 View Detailed Results
        </button>
        <button onClick={() => navigate('/student-dashboard')} className="dashboard-btn">
          🏠 Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default SkillGapAnalysis;
