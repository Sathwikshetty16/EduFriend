import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './QuizView.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const QuizView = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchQuiz = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API_URL}/quizzes/${quizId}`);
      if (response.data.success) {
        setQuiz(response.data.quiz);
      } else {
        setError('Failed to load quiz.');
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
      setError('An error occurred while loading the quiz.');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  if (loading) {
    return (
      <div className="quiz-view-loading">
        <div className="loading-spinner"></div>
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-view-error">
        <div className="error-icon">⚠️</div>
        <h2>Oops!</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="back-btn">
          Go Back
        </button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-view-error">
        <div className="error-icon">📝</div>
        <h2>Quiz Not Found</h2>
        <p>The quiz you're looking for doesn't exist.</p>
        <button onClick={() => navigate(-1)} className="back-btn">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-view">
      <div className="quiz-view-header">
        <button onClick={() => navigate(-1)} className="back-arrow-btn">
          ← Back
        </button>
        <div className="quiz-title-section">
          <h1>{quiz.title}</h1>
          <div className="quiz-details">
            <span className="detail-badge">📝 {quiz.numQuestions} Questions</span>
            <span className="detail-badge difficulty">{quiz.toughness}</span>
            <span className="detail-badge grade">{quiz.targetGrade}</span>
          </div>
        </div>
      </div>

      <div className="questions-list">
        {quiz.questions.map((q, index) => (
          <div key={index} className="question-card">
            <div className="question-header">
              <h3>Question {index + 1}</h3>
            </div>
            <div className="question-content">
              <p className="question-text">{q.question}</p>
              <ul className="options-list">
                {q.options.map((option, i) => (
                  <li
                    key={i}
                    className={`option ${i === q.correctAnswer ? 'correct' : ''}`}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + i)}.</span>
                    <span className="option-text">{option}</span>
                    {i === q.correctAnswer && <span className="correct-badge">✓ Correct Answer</span>}
                  </li>
                ))}
              </ul>
              <div className="explanation">
                <div className="explanation-header">
                  <span className="explanation-icon">💡</span>
                  <strong>Explanation:</strong>
                </div>
                <p>{q.explanation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizView;