import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from './pages/SplashScreen';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import StudentDashboard from './pages/StudentDashboard';
import QuizView from './pages/QuizView';
import QuizAttempt from './pages/QuizAttempt';
import QuizResults from './pages/QuizResults';
import SkillGapAnalysis from './pages/SkillGapAnalysis';
import StudentPerformance from './pages/StudentPerformance';
import './App.css';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Check if user has already seen splash screen in this session
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');

    if (hasSeenSplash) {
      // Skip splash screen if already seen
      setShowSplash(false);
      return;
    }

    // Start fade out animation after 2.5 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2500);

    // Remove splash screen after fade animation completes
    const removeTimer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem('hasSeenSplash', 'true');
    }, 3100); // 2500ms + 600ms fade animation

    // Cleanup timers
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  return (
    <Router>
      <div className="App">
        {/* Splash Screen */}
        {showSplash && (
          <div className={fadeOut ? 'fade-out' : ''}>
            <SplashScreen />
          </div>
        )}

        {/* Main Application Routes */}
        {!showSplash && (
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/student-dashboard" element={<StudentDashboard />} />
            <Route path="/quiz-view/:quizId" element={<QuizView />} />
            <Route path="/quiz-attempt/:quizId" element={<QuizAttempt />} />
            <Route path="/quiz-results/:attemptId" element={<QuizResults />} />
            <Route path="/quiz-results/:attemptId/analysis" element={<SkillGapAnalysis />} />
            <Route path="/student-performance/:studentId" element={<StudentPerformance />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;