import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../pages/QuizResults.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const QuizResultsView = ({ attemptId, showBackButton = false, onBack }) => {
  const [attempt, setAttempt] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [completedResources, setCompletedResources] = useState({
    onlineResources: [],
    youtubeVideos: [],
    analysisViewed: false
  });

  const fetchAttempt = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      const [resultsRes, analysisRes, progressRes] = await Promise.all([
        axios.get(`${API_URL}/quiz-results/attempt/${attemptId}`),
        axios.get(`${API_URL}/quiz-results/attempt/${attemptId}/analysis`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/quiz-results/attempt/${attemptId}/progress`).catch(() => ({ data: { success: false } }))
      ]);

      if (resultsRes.data.success) {
        setAttempt(resultsRes.data.attempt);
      } else {
        setError('Failed to load quiz results.');
      }

      if (analysisRes.data.success) {
        setAnalysis(analysisRes.data.analysis);
      } else {
        setAnalysis(null);
      }

      if (progressRes.data.success && progressRes.data.progress) {
        setCompletedResources({
          onlineResources: progressRes.data.progress.onlineResources || [],
          youtubeVideos: progressRes.data.progress.youtubeVideos || [],
          analysisViewed: progressRes.data.progress.analysisViewed || false
        });
      } else {
        setCompletedResources({ onlineResources: [], youtubeVideos: [], analysisViewed: false });
      }
    } catch (err) {
      setError('An error occurred while fetching the results.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    fetchAttempt();
  }, [fetchAttempt]);

  const handleMarkComplete = async (resourceType, resourceIndex) => {
    try {
      const response = await axios.post(`${API_URL}/quiz-results/${attemptId}/mark-complete`, {
        resourceType,
        resourceIndex
      });

      if (response.data.success && response.data.progress) {
        setCompletedResources({
          onlineResources: response.data.progress.onlineResources || [],
          youtubeVideos: response.data.progress.youtubeVideos || [],
          analysisViewed: response.data.progress.analysisViewed || false
        });
      }
    } catch (err) {
      console.error('Error marking resource as complete:', err);
      alert('Failed to mark resource as complete');
    }
  };

  const handleMarkAnalysisComplete = async () => {
    try {
      const response = await axios.post(`${API_URL}/quiz-results/${attemptId}/mark-complete`, {
        resourceType: 'analysisViewed',
        resourceIndex: 0
      });

      if (response.data.success && response.data.progress) {
        setCompletedResources({
          onlineResources: response.data.progress.onlineResources || [],
          youtubeVideos: response.data.progress.youtubeVideos || [],
          analysisViewed: response.data.progress.analysisViewed || false
        });
      }
    } catch (err) {
      console.error('Error marking analysis as complete:', err);
      alert('Failed to mark analysis as complete');
    }
  };

  const calculateProgress = () => {
    if (!attempt?.resourceRecommendations) return 0;

    const totalResources = 
      (attempt.resourceRecommendations.onlineResources?.length || 0) +
      (attempt.resourceRecommendations.youtubeVideos?.length || 0) +
      (analysis ? 1 : 0);

    if (totalResources === 0) return 100;

    const completedCount = 
      (completedResources?.onlineResources?.length || 0) +
      (completedResources?.youtubeVideos?.length || 0) +
      (completedResources?.analysisViewed ? 1 : 0);

    return Math.round((completedCount / totalResources) * 100);
  };

  if (!attemptId) {
    return <div className="quiz-results-container">No attempt selected.</div>;
  }

  if (loading) {
    return <div className="loading-container">Loading Results...</div>;
  }

  if (error) {
    return <div className="error-container">{error}</div>;
  }

  if (!attempt) {
    return <div className="quiz-results-container">Results not found.</div>;
  }

  const {
    quizTitle,
    score,
    totalQuestions,
    percentage,
    detailedResults,
    resourceRecommendations,
  } = attempt;

  const progressPercentage = calculateProgress();
  const hasResources = resourceRecommendations && (
    (resourceRecommendations.onlineResources && resourceRecommendations.onlineResources.length > 0) ||
    (resourceRecommendations.youtubeVideos && resourceRecommendations.youtubeVideos.length > 0) ||
    analysis
  );

  return (
    <div className="quiz-results-container">
      <div className="results-header">
        <h1>{quizTitle} - Results</h1>
      </div>

      <div className="score-summary">
        <h2>Your Score</h2>
        <div className="score-circle">
          <span className="score">{percentage}%</span>
        </div>
        <p className="score-details">
          You answered {score} out of {totalQuestions} questions correctly.
        </p>
      </div>

      <div className="detailed-results">
        <h2>Detailed Breakdown</h2>
        {detailedResults && detailedResults.map((result, index) => (
          <div key={index} className={`result-item ${result.isCorrect ? 'correct' : 'incorrect'}`}>
            <div className="question-header">
              <strong>Question {index + 1}:</strong> {result.question}
            </div>
            <div className="answers">
              <p><strong>Your Answer:</strong> {result.options[result.userAnswer] || 'Not Answered'}</p>
              {!result.isCorrect && (
                <p><strong>Correct Answer:</strong> {result.options[result.correctAnswer]}</p>
              )}
            </div>
            <div className="explanation">
              <strong>Explanation:</strong> {result.explanation}
            </div>
          </div>
        ))}
      </div>

      {hasResources && (
        <div className="resource-recommendations">
          <div className="progress-header">
            <h2>Resources to Help You Improve</h2>
            <div className="progress-tracker">
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <span className="progress-text">{progressPercentage}% Complete</span>
            </div>
          </div>

          {resourceRecommendations?.onlineResources && resourceRecommendations.onlineResources.length > 0 && (
            <div className="resource-section">
              <h3>📚 Online Articles & Guides</h3>
              {resourceRecommendations.onlineResources.map((resource, index) => (
                <div 
                  key={index} 
                  className={`resource-item ${completedResources?.onlineResources?.includes(index) ? 'completed' : ''}`}
                >
                  <div className="resource-content">
                    <a href={resource.link} target="_blank" rel="noopener noreferrer">
                      {resource.title}
                    </a>
                    <p>{resource.description}</p>
                  </div>
                  {user?.userType === 'student' && (
                    <button
                      className={`complete-btn ${completedResources?.onlineResources?.includes(index) ? 'completed' : ''}`}
                      onClick={() => handleMarkComplete('onlineResources', index)}
                      disabled={completedResources?.onlineResources?.includes(index)}
                    >
                      {completedResources?.onlineResources?.includes(index) ? '✓ Completed' : 'Mark as Complete'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {resourceRecommendations?.youtubeVideos && resourceRecommendations.youtubeVideos.length > 0 && (
            <div className="resource-section">
              <h3>🎥 YouTube Videos</h3>
              {resourceRecommendations.youtubeVideos.map((video, index) => (
                <div 
                  key={index} 
                  className={`resource-item ${completedResources?.youtubeVideos?.includes(index) ? 'completed' : ''}`}
                >
                  <div className="resource-content">
                    <a href={video.link} target="_blank" rel="noopener noreferrer">
                      {video.title}
                    </a>
                    <p>{video.description}</p>
                  </div>
                  {user?.userType === 'student' && (
                    <button
                      className={`complete-btn ${completedResources?.youtubeVideos?.includes(index) ? 'completed' : ''}`}
                      onClick={() => handleMarkComplete('youtubeVideos', index)}
                      disabled={completedResources?.youtubeVideos?.includes(index)}
                    >
                      {completedResources?.youtubeVideos?.includes(index) ? '✓ Completed' : 'Mark as Complete'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {analysis && (
            <div className="resource-section">
              <h3>📊 Skill Gap Analysis</h3>
              <div className={`resource-item analysis-item ${completedResources?.analysisViewed ? 'completed' : ''}`}>
                <Link to={`/quiz-results/${attemptId}/analysis`} className="analysis-link">
                  <div className="analysis-link-content">
                    <strong>Click here for a detailed analysis of your performance.</strong>
                    {analysis.topicErrorAnalysis && analysis.topicErrorAnalysis.length > 0 && (
                      <p>
                        You struggled with {analysis.topicErrorAnalysis.length} topic(s), 
                        including "{analysis.topicErrorAnalysis[0][0]}". We have study materials to help.
                      </p>
                    )}
                  </div>
                </Link>
                {user?.userType === 'student' && (
                  <button
                    className={`complete-btn ${completedResources?.analysisViewed ? 'completed' : ''}`}
                    onClick={handleMarkAnalysisComplete}
                    disabled={completedResources?.analysisViewed}
                  >
                    {completedResources?.analysisViewed ? '✓ Reviewed' : 'Mark as Reviewed'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showBackButton && (
        <div className="results-footer">
          <button 
            onClick={onBack}
            className="back-btn"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizResultsView;
