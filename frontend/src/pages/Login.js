import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';
import './Login.css';
import logoImg from './logo.png';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log('✅ Firebase authentication successful:', user.uid);

      const response = await axios.get(`${API_URL}/auth/user/${user.uid}`);

      if (response.data.success) {
        const userData = {
          uid: user.uid,
          email: user.email,
          ...response.data.user
        };

        localStorage.setItem('user', JSON.stringify(userData));
        
        if (userData.userType === 'teacher') {
          navigate('/dashboard');
        } else {
          navigate('/student-dashboard');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError(error.response?.data?.error || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Logo and Brand */}
        <div className="brand-section">
          <div className="brand-logo">
            <img src={logoImg} alt="BridgeAi logo" width="48" height="48" style={{ objectFit: 'contain', borderRadius: '8px' }} />
          </div>
          <h1 className="brand-title">BridgeAi</h1>
          <p className="brand-description">Empowering educators and learners with intelligent solutions</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="card-header">
            <h2 className="card-title">Welcome Back</h2>
            <p className="card-subtitle">Sign in to continue to your account</p>
          </div>

          {/* Tabs */}
          <div className="auth-tabs">
            <button className="auth-tab active" type="button">
              Sign In
            </button>
            <button 
              className="auth-tab" 
              type="button"
              onClick={() => navigate('/signup')}
            >
              Create Account
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-error" role="alert">
              <svg className="alert-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="login-form" noValidate>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <div className="input-wrapper">
               
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="input-wrapper">
                
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex="-1"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3L21 21M10.5 10.677C9.89668 11.2544 9.5 12.0826 9.5 13C9.5 14.933 11.067 16.5 13 16.5C13.9174 16.5 14.7456 16.1033 15.323 15.5M7 7C5.11687 8.36419 3.6939 10.2782 3 12.5C4.5 17 8.5 20 13 20C14.6945 20 16.2671 19.5583 17.6429 18.8M13 6C17.5 6 21.5 9 23 13.5C22.5 14.75 21.7 15.85 20.7 16.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 12.5C4.5 17 8.5 20 13 20C17.5 20 21.5 17 23 12.5C21.5 8 17.5 5 13 5C8.5 5 4.5 8 3 12.5Z" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="13" cy="12.5" r="2.5" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-wrapper">
                <input type="checkbox" className="checkbox" />
                <span className="checkbox-label">Remember me</span>
              </label>
              <button type="button" className="link-button">
                Forgot password?
              </button>
            </div>

            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="spinner" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="card-footer">
            <p className="footer-text">
              Don't have an account?{' '}
              <button 
                type="button"
                className="link-inline"
                onClick={() => navigate('/signup')}
              >
                Sign up for free
              </button>
            </p>
          </div>
        </div>

        {/* Bottom Links */}
        <div className="bottom-links">
          <a href="/terms">Terms of Service</a>
          <span className="separator">•</span>
          <a href="/privacy">Privacy Policy</a>
          <span className="separator">•</span>
          <a href="/help">Help Center</a>
        </div>
      </div>
    </div>
  );
};

export default Login;