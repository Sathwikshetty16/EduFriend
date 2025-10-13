import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './QuizView.css';

const API_URL = 'http://localhost:5000/api';

const QuizView = () => {
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await axios.get(`${API_URL}/quizzes/${quizId}`);
        if (response.data.success) {
          setQuiz(response.data.quiz);
        }
      } catch (error) {
        console.error('Error fetching quiz:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  if (loading) {
    return <div className="loading">Loading quiz...</div>;
  }

  if (!quiz) {
    return <div className="error">Quiz not found.</div>;
  }

  return (
    <div className="quiz-view">
      <h1>{quiz.title}</h1>
      <div className="quiz-details">
        <span>{quiz.numQuestions} Questions</span>
        <span>{quiz.toughness}</span>
        <span>{quiz.targetGrade}</span>
      </div>
      <div className="questions-list">
        {quiz.questions.map((q, index) => (
          <div key={index} className="question-card">
            <h3>Question {index + 1}</h3>
            <p>{q.question}</p>
            <ul className="options-list">
              {q.options.map((option, i) => (
                <li
                  key={i}
                  className={`option ${i === q.correctAnswer ? 'correct' : ''}`}
                >
                  {option}
                </li>
              ))}
            </ul>
            <div className="explanation">
              <strong>Explanation:</strong> {q.explanation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizView;
