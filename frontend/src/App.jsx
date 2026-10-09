import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import PurchaseOrderForm from './components/PurchaseOrderForm';
import AdminPanel from './components/AdminPanel';
import ApproverDashboard from './components/ApproverDashboard';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('default'); // 'admin' | 'form'
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Hide splash screen after 5 seconds
    const timer = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('maersk_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        if (parsed.role === 'ADMIN') {
          setCurrentView('admin');
        } else if (parsed.role === 'APPROVER') {
          setCurrentView('approver');
        } else if (parsed.role === 'ACCOUNTANT_APPROVER') {
          setCurrentView('form'); // Vue par défaut pour ce rôle
        } else {
          setCurrentView('form');
        }
      } catch (err) {
        localStorage.removeItem('maersk_user');
      }
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'ADMIN') {
      setCurrentView('admin');
    } else if (user.role === 'APPROVER') {
      setCurrentView('approver');
    } else if (user.role === 'ACCOUNTANT_APPROVER') {
      setCurrentView('form');
    } else {
      setCurrentView('form');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('maersk_token');
    localStorage.removeItem('maersk_user');
    setCurrentUser(null);
    setCurrentView('default');
  };

  // Splash Screen
  if (showSplash) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <img src="/logo_maersk.png" alt="Maersk Logo" className="splash-logo" />
          <div className="splash-loader"></div>
        </div>
      </div>
    );
  }

  // Si non connecté -> Page de connexion
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Vue Administrateur
  if (currentUser.role === 'ADMIN' && currentView === 'admin') {
    return (
      <AdminPanel
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchToForm={() => setCurrentView('form')}
      />
    );
  }

  // Vue Approbateur
  if (currentUser.role === 'APPROVER' || (currentUser.role === 'ACCOUNTANT_APPROVER' && currentView === 'approver')) {
    return (
      <ApproverDashboard
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchToForm={currentUser.role === 'ACCOUNTANT_APPROVER' ? () => setCurrentView('form') : null}
      />
    );
  }

  // Vue Bon de Commande / Facture (Comptables & Accès Admin & Accountant Approver)
  return (
    <PurchaseOrderForm
      currentUser={currentUser}
      onLogout={handleLogout}
      onSwitchToAdmin={currentUser.role === 'ADMIN' ? () => setCurrentView('admin') : null}
      onSwitchToApprover={currentUser.role === 'ACCOUNTANT_APPROVER' ? () => setCurrentView('approver') : null}
    />
  );
}

export default App;
