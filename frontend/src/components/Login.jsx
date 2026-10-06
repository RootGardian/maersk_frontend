import React, { useState } from 'react';
import maerskLogo from '../assets/logo_maersk.png';
import { API_URL } from '../config';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la connexion');
      }

      localStorage.setItem('maersk_token', data.token);
      localStorage.setItem('maersk_user', JSON.stringify(data.user));

      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split-container">
      {/* LEFT PANEL: Official Maersk Identity */}
      <div className="login-left-panel">
        <div className="circle-decor circle-1"></div>
        <div className="circle-decor circle-2"></div>
        <div className="circle-decor circle-3"></div>

        <div className="branding-content">
          <div className="logo-container">
            <img src={maerskLogo} alt="Maersk Logo" className="branding-logo" />
          </div>
          <h1 className="branding-title">MAERSK</h1>
          <p className="branding-tagline">Système de Gestion de Facturation</p>
        </div>

        <div className="dot-grid-decor">
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>

      {/* RIGHT PANEL: Form */}
      <div className="login-right-panel">
        <div className="form-box">
          <h2 className="form-title">Connexion</h2>
          <p className="form-subtitle">
            Veuillez renseigner vos identifiants pour accéder à l'application.
          </p>

          {errorMessage && (
            <div className="error-badge">
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="split-login-form">
            <div className="field-group">
              <label htmlFor="email">EMAIL</label>
              <div className="input-wrapper">
                <span className="input-icon-left">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  id="email"
                  type="text"
                  placeholder="Entrez votre email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="password">MOT DE PASSE</label>
              <div className="input-wrapper">
                <span className="input-icon-left">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <div className="spinner"></div>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10 17 15 12 10 7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                  </svg>
                  <span>Se Connecter</span>
                </>
              )}
            </button>
          </form>

          <div className="right-panel-footer">
            <p>&copy; {new Date().getFullYear()} Maersk. Tous droits réservés.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
