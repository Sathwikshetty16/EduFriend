import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './StudentDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const StudentPerformance = () => {
  const { studentId } = useParams();
  const [attemptedQuizzes, setAttemptedQuizzes] = useState([]);
  const [skillGapData, setSkillGapData] = useState(null);
  const [performanceStats, setPerformanceStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchAttemptedQuizzes = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/student/${studentId}/quiz-attempts`);
      if (response.data.success) {
        setAttemptedQuizzes(response.data.attempts || []);
      }
    } catch (error) {
      console.error('Error fetching attempted quizzes:', error);
    }
  }, [studentId]);

  useEffect(() => {
    fetchAttemptedQuizzes();
    fetchPerformanceStats();
    fetchSkillGapAnalysis();
  }, [fetchAttemptedQuizzes]);

  const fetchSkillGapAnalysis = async () => {
    try {
      const response = await axios.get(`${API_URL}/student/${studentId}/skill-gap`);
      if (response.data.success) {
        setSkillGapData(response.data.analysis);
      }
    } catch (error) {
      console.error('Error fetching skill gap analysis:', error);
    }
  };

  const fetchPerformanceStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/student/${studentId}/performance-stats`);
      if (response.data.success) {
        setPerformanceStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching performance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = (attemptId) => {
    navigate(`/quiz-results/${attemptId}`);
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

  // Calculate performance trend
  const calculatePerformanceTrend = () => {
    if (attemptedQuizzes.length < 2) return null;

    // Sort by date
    const sorted = [...attemptedQuizzes].sort((a, b) => {
      const dateA = a.completedAt?._seconds || new Date(a.completedAt).getTime() / 1000;
      const dateB = b.completedAt?._seconds || new Date(b.completedAt).getTime() / 1000;
      return dateA - dateB;
    });

    // Get last 10 attempts for trend
    const recentAttempts = sorted.slice(-10);
    
    return recentAttempts.map((attempt, index) => ({
      attempt: index + 1,
      score: attempt.percentage,
      date: formatDate(attempt.completedAt),
      quizTitle: attempt.quizTitle
    }));
  };

  // Calculate skill gap completion
  const calculateSkillGapCompletion = () => {
    if (!skillGapData || !attemptedQuizzes.length) return null;

    const totalTopics = (skillGapData.strongAreas?.length || 0) + 
                       (skillGapData.topicErrorAnalysis?.length || 0);
    const masteredTopics = skillGapData.strongAreas?.length || 0;

    return {
      total: totalTopics,
      mastered: masteredTopics,
      percentage: totalTopics > 0 ? ((masteredTopics / totalTopics) * 100).toFixed(1) : 0,
      weakAreas: skillGapData.topicErrorAnalysis?.slice(0, 5) || []
    };
  };

  // ============ Render Performance Trend Chart ============
  const renderPerformanceTrendChart = () => {
    const trendData = calculatePerformanceTrend();
    
    if (!trendData || trendData.length < 2) {
      return (
        <div className="chart-placeholder">
          <p>Complete more quizzes to see your performance trend</p>
        </div>
      );
    }

    const maxScore = Math.max(...trendData.map(d => d.score));
    const minScore = Math.min(...trendData.map(d => d.score));
    const avgScore = (trendData.reduce((sum, d) => sum + d.score, 0) / trendData.length).toFixed(1);

    // Calculate if improving or declining
    const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
    const secondHalf = trendData.slice(Math.floor(trendData.length / 2));
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.score, 0) / secondHalf.length;
    const trend = secondAvg > firstAvg ? 'improving' : secondAvg < firstAvg ? 'declining' : 'stable';

    return (
      <div className="performance-trend-chart">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Quiz Scores Over Time</h3>
            <p className="chart-subtitle">Track your learning progress across recent attempts</p>
          </div>
          <div className="trend-indicator">
            <span className={`trend-badge trend-${trend}`}>
              {trend === 'improving' ? '📈 Improving' : 
               trend === 'declining' ? '📉 Needs Focus' : '➡️ Stable'}
            </span>
          </div>
        </div>

        <div className="chart-stats-mini">
          <div className="mini-stat">
            <span className="mini-stat-label">Average</span>
            <span className="mini-stat-value">{avgScore}%</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-label">Highest</span>
            <span className="mini-stat-value">{maxScore.toFixed(1)}%</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-label">Lowest</span>
            <span className="mini-stat-value">{minScore.toFixed(1)}%</span>
          </div>
        </div>

        <div className="line-chart-container">
          <div className="y-axis">
            <span className="y-label">100%</span>
            <span className="y-label">75%</span>
            <span className="y-label">50%</span>
            <span className="y-label">25%</span>
            <span className="y-label">0%</span>
          </div>
          <div className="chart-area">
            <svg className="line-chart" viewBox="0 0 600 300" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="0" x2="600" y2="0" stroke="#e8eaed" strokeWidth="1" />
              <line x1="0" y1="75" x2="600" y2="75" stroke="#e8eaed" strokeWidth="1" />
              <line x1="0" y1="150" x2="600" y2="150" stroke="#e8eaed" strokeWidth="1" />
              <line x1="0" y1="225" x2="600" y2="225" stroke="#e8eaed" strokeWidth="1" />
              <line x1="0" y1="300" x2="600" y2="300" stroke="#e8eaed" strokeWidth="1" />

              {/* Average line */}
              <line 
                x1="0" 
                y1={300 - (avgScore * 3)} 
                x2="600" 
                y2={300 - (avgScore * 3)} 
                stroke="#FBBC04" 
                strokeWidth="1" 
                strokeDasharray="5,5"
                opacity="0.5"
              />

              {/* Data line */}
              <polyline
                points={trendData.map((d, i) => {
                  const x = (i / (trendData.length - 1)) * 600;
                  const y = 300 - (d.score * 3);
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="#4A90E2"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {trendData.map((d, i) => {
                const x = (i / (trendData.length - 1)) * 600;
                const y = 300 - (d.score * 3);
                return (
                  <g key={i}>
                    <circle
                      cx={x}
                      cy={y}
                      r="5"
                      fill="#4A90E2"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <title>{`${d.quizTitle}: ${d.score}%`}</title>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="x-axis-labels">
          {trendData.map((d, i) => (
            <span key={i} className="x-label" title={d.quizTitle}>
              Quiz {d.attempt}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // ============ Render Skill Gap Completion ============
  const renderSkillGapCompletion = () => {
    const completion = calculateSkillGapCompletion();

    if (!completion) {
      return (
        <div className="skill-gap-placeholder">
          <p>Complete quizzes to see your skill gap analysis</p>
        </div>
      );
    }

    return (
      <div className="skill-gap-completion">
        <div className="completion-header">
          <h3 className="chart-title">Skill Mastery Progress</h3>
          <p className="chart-subtitle">Topics covered and areas that need attention</p>
        </div>

        <div className="completion-circle-container">
          <svg className="completion-circle" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#e8eaed"
              strokeWidth="20"
            />
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#34A853"
              strokeWidth="20"
              strokeDasharray={`${(completion.percentage / 100) * 502.4} 502.4`}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
            />
            <text
              x="100"
              y="100"
              textAnchor="middle"
              dy=".3em"
              fontSize="40"
              fontWeight="bold"
              fill="#202124"
            >
              {completion.percentage}%
            </text>
            <text
              x="100"
              y="130"
              textAnchor="middle"
              fontSize="14"
              fill="#5f6368"
            >
              Mastered
            </text>
          </svg>

          <div className="completion-stats">
            <div className="completion-stat-item">
              <div className="stat-circle mastered">
                <span>{completion.mastered}</span>
              </div>
              <span className="stat-label">Strong Topics</span>
            </div>
            <div className="completion-stat-item">
              <div className="stat-circle weak">
                <span>{completion.total - completion.mastered}</span>
              </div>
              <span className="stat-label">Need Focus</span>
            </div>
          </div>
        </div>

        {completion.weakAreas.length > 0 && (
          <div className="weak-areas-list">
            <h4 className="weak-areas-title">Focus Areas:</h4>
            <div className="weak-areas-grid">
              {completion.weakAreas.map((area, index) => (
                <div key={index} className="weak-area-item">
                  <div className="weak-area-rank">{index + 1}</div>
                  <div className="weak-area-content">
                    <span className="weak-area-name">{area[0]}</span>
                    <span className="weak-area-errors">{area[1]} errors</span>
                  </div>
                </div>
              ))}
            </div>
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

    const totalQuizzes = attemptedQuizzes.length;
    const avgScore = totalQuizzes > 0 
      ? (attemptedQuizzes.reduce((sum, a) => sum + a.percentage, 0) / totalQuizzes).toFixed(1)
      : 0;
    const highestScore = totalQuizzes > 0
      ? Math.max(...attemptedQuizzes.map(a => a.percentage)).toFixed(1)
      : 0;
    const passRate = totalQuizzes > 0
      ? ((attemptedQuizzes.filter(a => a.percentage >= 60).length / totalQuizzes) * 100).toFixed(0)
      : 0;

    return (
      <div className="content-section">
        <div className="page-header">
          <div>
            <h1 className="page-title">Performance Overview</h1>
            <p className="page-subtitle">Track your learning progress and quiz performance over time.</p>
          </div>
        </div>

        {attemptedQuizzes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <h3>No Performance Data</h3>
            <p>Start taking quizzes to see detailed performance insights!</p>
          </div>
        ) : (
          <div className="performance-container-new">
            {/* Performance Stats Cards */}
            <div className="performance-stats-grid">
              <div className="stat-card-new">
                <div className="stat-icon-new">📋</div>
                <div className="stat-content-new">
                  <span className="stat-label-new">Total Quizzes Taken</span>
                  <span className="stat-value-new">{totalQuizzes}</span>
                  <span className="stat-description">Quizzes completed to date.</span>
                </div>
              </div>

              <div className="stat-card-new">
                <div className="stat-icon-new">🏆</div>
                <div className="stat-content-new">
                  <span className="stat-label-new">Average Score</span>
                  <span className="stat-value-new">{avgScore}%</span>
                  <span className="stat-description">Overall average across all quizzes.</span>
                </div>
              </div>

              <div className="stat-card-new">
                <div className="stat-icon-new">🎯</div>
                <div className="stat-content-new">
                  <span className="stat-label-new">Highest Score</span>
                  <span className="stat-value-new">{highestScore}%</span>
                  <span className="stat-description">Best performance recorded.</span>
                </div>
              </div>

              <div className="stat-card-new">
                <div className="stat-icon-new">✅</div>
                <div className="stat-content-new">
                  <span className="stat-label-new">Pass Rate</span>
                  <span className="stat-value-new">{passRate}%</span>
                  <span className="stat-description">Quizzes passed out of total.</span>
                </div>
              </div>
            </div>

            {/* Performance Charts Section */}
            <div className="charts-grid">
              {/* Performance Trend Chart */}
              <div className="chart-card">
                {renderPerformanceTrendChart()}
              </div>

              {/* Skill Gap Completion */}
              <div className="chart-card">
                {renderSkillGapCompletion()}
              </div>
            </div>

            {/* Recent Quiz Attempts */}
            <div className="recent-attempts-section">
              <h3 className="section-title-new">Recent Quiz Attempts</h3>
              <div className="attempts-list-new">
                {attemptedQuizzes.slice(0, 10).map((attempt, index) => (
                  <div key={index} className="attempt-item-new">
                    <div className="attempt-info-new">
                      <h4 className="attempt-title">{attempt.quizTitle}</h4>
                      <p className="attempt-date-new">{formatDate(attempt.completedAt)}</p>
                    </div>
                    <div className="attempt-score-new">
                      <div className="score-display">
                        <span className="score-text">{attempt.percentage.toFixed(0)}%</span>
                      </div>
                      <span className="score-details">{attempt.score}/{attempt.totalQuestions} Correct</span>
                    </div>
                    <button
                      className="view-details-btn-compact"
                      onClick={() => handleViewResults(attempt.id)}
                      title="View Details"
                    >
                      →
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

  return (
    <div className="student-dashboard">
      <div className="main-content">
        <header className="dashboard-header performance-header">
          <button onClick={() => navigate(-1)} className="back-button">
            &larr; Back
          </button>
          <h1>
            Performance Insights
          </h1>
        </header>
        <div className="content-area">
          {renderPerformance()}
        </div>
      </div>
    </div>
  );
};

export default StudentPerformance;
