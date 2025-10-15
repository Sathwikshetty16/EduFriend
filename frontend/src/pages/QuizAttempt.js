import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './QuizAttempt.css';

const API_URL = 'http://localhost:5000/api';

const QuizAttempt = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(userData));
  }, [navigate]);

  const fetchQuiz = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/quizzes/${quizId}`);
      if (response.data.success) {
        const quizData = response.data.quiz;
        setQuiz(quizData);
        setAnswers(new Array(quizData.questions.length).fill(null));
        setTimeLeft(quizData.questions.length * 60); // 60 seconds per question
      } else {
        setError('Failed to load quiz.');
      }
    } catch (err) {
      setError('An error occurred while fetching the quiz.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (user) {
      fetchQuiz();
    }
  }, [user, fetchQuiz]);

  useEffect(() => {
    if (timeLeft === 0) {
      handleSubmit();
    }
    if (!timeLeft) return;
    const intervalId = setInterval(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft]);

  const handleAnswerSelect = (optionIndex) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('You must be logged in to submit a quiz.');
      return;
    }

    const timeTaken = (quiz.questions.length * 60) - timeLeft;

    try {
      const response = await axios.post(`${API_URL}/quiz/submit`, {
        quizId,
        studentId: user.uid,
        answers,
        timeTaken,
      });

      if (response.data.success) {
        navigate(`/quiz-results/attempt/${response.data.attemptId}`);
      } else {
        setError(response.data.error || 'Failed to submit quiz.');
      }
    } catch (err) {
      setError('An error occurred while submitting the quiz.');
      console.error(err);
    }
  };

  if (loading) {
    return <div className="loading-container">Loading Quiz...</div>;
  }

  if (error) {
    return <div className="error-container">{error}</div>;
  }

  if (!quiz) {
    return <div className="container">Quiz not found.</div>;
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;

  return (
    <div className="quiz-attempt-container">
      <div className="quiz-header">
        <h2>{quiz.title}</h2>
        <div className="timer">Time Left: {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}</div>
      </div>
      <div className="progress-bar">
        <div className="progress" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="question-container">
        <h3>Question {currentQuestionIndex + 1} of {quiz.questions.length}</h3>
        <p className="question-text">{currentQuestion.question}</p>
        <div className="options-container">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              className={`option-btn ${answers[currentQuestionIndex] === index ? 'selected' : ''}`}
              onClick={() => handleAnswerSelect(index)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="navigation-buttons">
        <button onClick={goToPreviousQuestion} disabled={currentQuestionIndex === 0}>Previous</button>
        {currentQuestionIndex < quiz.questions.length - 1 ? (
          <button onClick={goToNextQuestion}>Next</button>
        ) : (
          <button onClick={handleSubmit} className="submit-btn">Submit Quiz</button>
        )}
      </div>
    </div>
  );
};

export default QuizAttempt;
