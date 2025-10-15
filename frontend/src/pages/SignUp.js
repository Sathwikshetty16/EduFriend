import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';  // Adjust path if needed
import axios from 'axios';
import './SignUp.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const SignUp = () => {
  const [formData, setFormData] = useState({
    userType: 'student',
    fullName: '',
    email: '',
    password: '',
    currentGrade: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('🔄 Starting signup process...');
    console.log('Auth object:', auth);  // Debug log

    // Validation
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (formData.userType === 'student' && !formData.currentGrade) {
      setError('Please select your current grade');
      setLoading(false);
      return;
    }

    try {
      console.log('📧 Creating user with email:', formData.email);
      
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      
      const user = userCredential.user;
      console.log('✅ Firebase user created:', user.uid);

      // Update display name
      await updateProfile(user, {
        displayName: formData.fullName
      });
      console.log('✅ Display name updated');

      // Save additional user data to backend
      const userData = {
        uid: user.uid,
        email: formData.email,
        fullName: formData.fullName,
        userType: formData.userType,
        currentGrade: formData.currentGrade
      };

      console.log('💾 Saving user data to backend...');
      await axios.post(`${API_URL}/auth/save-user-data`, userData);
      console.log('✅ User data saved to backend');

      alert('Account created successfully! Please log in.');
      navigate('/login');

    } catch (error) {
      console.error('❌ Signup error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Handle Firebase auth errors
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else if (error.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError(error.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-content">
        <div className="signup-form-section">
          <div className="signup-header">
            <h1 className="signup-title">Create Your Account</h1>
            <p className="signup-subtitle">Join us today and unlock a world of learning opportunities.</p>
          </div>

          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="signup-form">
            <div className="user-type-selector">
              <label>I am a:</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="userType"
                    value="student"
                    checked={formData.userType === 'student'}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <span>Student</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="userType"
                    value="teacher"
                    checked={formData.userType === 'teacher'}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <span>Teacher</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="john.doe@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Create a strong password (min. 6 characters)"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            {formData.userType === 'student' && (
              <div className="form-group">
                <label htmlFor="currentGrade">Current Grade</label>
                <select
                  id="currentGrade"
                  name="currentGrade"
                  value={formData.currentGrade}
                  onChange={handleChange}
                  required
                  disabled={loading}
                >
                  <option value="">Select your grade</option>
                  <option value="6">Grade 6</option>
                  <option value="7">Grade 7</option>
                  <option value="8">Grade 8</option>
                  <option value="9">Grade 9</option>
                  <option value="10">Grade 10</option>
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                </select>
              </div>
            )}

            <button type="submit" className="signup-button" disabled={loading}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <div className="login-link">
            Already have an account?{' '}
            <button type="button" onClick={() => navigate('/login')} disabled={loading}>
              Log In
            </button>
          </div>
        </div>

        <div className="signup-image-section">
          <img 
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1471&q=80" 
            alt="Students studying together" 
          />
        </div>
      </div>
    </div>
  );
};

export default SignUp;