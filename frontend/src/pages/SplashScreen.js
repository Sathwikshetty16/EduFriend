import React from 'react';
import './SplashScreen.css';
import logoImg from './logo.png';

const SplashScreen = () => {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="logo-container">
          <div className="logo-icon">
            <img
              src={logoImg}
              alt="Bridge AI logo"
              width="120"
              height="120"
              style={{ objectFit: 'contain', borderRadius: '12px' }}
            />
          </div>
        </div>
        <h1 className="splash-title">
          Bridge <span className="ai-text">AI</span>
        </h1>
        <p className="splash-tagline">Smarter Study, Guided Growth</p>
        <div className="splash-loader">
          <div className="loader-bar"></div>
        </div>
      </div>
      <div className="splash-sparkles">
        <span className="sparkle sparkle-1">✨</span>
        <span className="sparkle sparkle-2">✨</span>
        <span className="sparkle sparkle-3">✨</span>
        <span className="sparkle sparkle-4">⭐</span>
      </div>
    </div>
  );
};

export default SplashScreen;