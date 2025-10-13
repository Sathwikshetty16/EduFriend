import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './QuizResults.css';

const API_URL = 'http://localhost:5000/api';

const QuizResults = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAttempt = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/quiz-results/${attemptId}`);
      if (response.data.success) {
        setAttempt(response.data.attempt);
      } else {
        setError('Failed to load quiz results.');
      }
    } catch (err) {
      setError('An error occurred while fetching the results.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    fetchAttempt();
  }, [fetchAttempt]);

  if (loading) {
    return <div className="loading-container">Loading Results...</div>;
  }

  if (error) {
    return <div className="error-container">{error}</div>;
  }

  if (!attempt) {
    return <div className="container">Results not found.</div>;
  }

  const {
    quizTitle,
    score,
    totalQuestions,
    percentage,
    detailedResults,
    resourceRecommendations,
  } = attempt;

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
        <p className="score-details">You answered {score} out of {totalQuestions} questions correctly.</p>
      </div>
      <div className="detailed-results">
        <h2>Detailed Breakdown</h2>
        {detailedResults.map((result, index) => (
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
      {resourceRecommendations && (
        <div className="resource-recommendations">
          <h2>Resources to Help You Improve</h2>
          {resourceRecommendations.onlineResources && (
            <div className="resource-section">
              <h3>Online Articles & Guides</h3>
              {resourceRecommendations.onlineResources.map((resource, index) => (
                <div key={index} className="resource-item">
                  <a href={resource.link} target="_blank" rel="noopener noreferrer">{resource.title}</a>
                  <p>{resource.description}</p>
                </div>
              ))}
            </div>
          )}
          {resourceRecommendations.youtubeVideos && (
            <div className="resource-section">
              <h3>YouTube Videos</h3>
              {resourceRecommendations.youtubeVideos.map((video, index) => (
                <div key={index} className="resource-item">
                  <a href={video.link} target="_blank" rel="noopener noreferrer">{video.title}</a>
                  <p>{video.description}</p>
                </div>
              ))}
            </div>
          )}
          {resourceRecommendations.studyMaterials && (
            <div className="resource-section">
              <h3>Study Materials from Your Teacher</h3>
              {resourceRecommendations.studyMaterials.map((material, index) => (
                <div key={index} className="resource-item">
                  <a href={`/materials/${material.id}/download`} target="_blank" rel="noopener noreferrer">{material.title}</a>
                  <p>{material.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="results-footer">
        <button onClick={() => navigate('/student-dashboard', { state: { quizCompleted: true } })} className="back-btn">Back to Dashboard</button>
      </div>
    </div>
  );
};

export default QuizResults;
