import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import StudentDashboard from './pages/StudentDashboard';
import QuizView from './pages/QuizView';
import QuizAttempt from './pages/QuizAttempt';
import QuizResults from './pages/QuizResults';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          <Route path="/quiz-view/:quizId" element={<QuizView />} />
          <Route path="/quiz-attempt/:quizId" element={<QuizAttempt />} />
          <Route path="/quiz-results/:attemptId" element={<QuizResults />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
