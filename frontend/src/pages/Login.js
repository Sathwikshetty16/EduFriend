import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';
import './Login.css';

const API_URL = 'http://localhost:5000/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Authenticate with Firebase Client SDK
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log('✅ Firebase authentication successful:', user.uid);

      // Get user data from backend
      const response = await axios.get(`${API_URL}/auth/user/${user.uid}`);

      if (response.data.success) {
        const userData = {
          uid: user.uid,
          email: user.email,
          ...response.data.user
        };

        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Navigate based on user type
        if (userData.userType === 'teacher') {
          navigate('/dashboard');
        } else {
          navigate('/student-dashboard');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle Firebase auth errors
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(error.response?.data?.error || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1 className="login-title">Welcome to EduMaster AI</h1>
          <p className="login-subtitle">Your personalized learning and teaching companion.</p>
        </div>

        <div className="tabs">
          <button className="tab active">Log In</button>
          <button className="tab" onClick={() => navigate('/signup')}>Sign Up</button>
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <span className="input-icon">📧</span>
              <input
                id="email"
                type="email"
                placeholder="your@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Don't have an account? <span onClick={() => navigate('/signup')}>Sign up here</span></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
