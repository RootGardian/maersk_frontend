import React, { useState, useEffect } from 'react';
import maerskLogo from '../assets/logo_maersk.png';
import { API_URL } from '../config';
import './ApproverDashboard.css';
import io from 'socket.io-client';

export default function ApproverDashboard({ currentUser, onLogout, onSwitchToForm }) {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [notification]);
  const [signatureData, setSignatureData] = useState(currentUser?.signature || '');

  const [notificationsList, setNotificationsList] = useState([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  useEffect(() => {
    fetchRequests();

    const socket = io(API_URL, { transports: ['websocket'] });
    socket.emit('join', currentUser.id);

    socket.on('new_request', (req) => {
      const msg = `Nouvelle demande (PO: ${req.requestNo}) reçue !`;
      showNotification('success', msg);
      
      setNotificationsList(prev => [{ id: Date.now(), text: msg, read: false, time: new Date() }, ...prev]);
      
      fetchRequests(); // Refresh list automatically
    });

    window.addEventListener('online', syncOfflineQueue);
    return () => {
      socket.disconnect();
      window.removeEventListener('online', syncOfflineQueue);
    };
  }, []);

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('maersk_approver_queue') || '[]');
    if (queue.length === 0) return;

    let successfulSyncs = 0;
    const remainingQueue = [];

    for (const item of queue) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        });
        if (res.ok) {
          successfulSyncs++;
        } else {
          remainingQueue.push(item);
        }
      } catch (err) {
        remainingQueue.push(item);
      }
    }

    localStorage.setItem('maersk_approver_queue', JSON.stringify(remainingQueue));
    if (successfulSyncs > 0) {
      showNotification('success', `${successfulSyncs} décision(s) synchronisée(s) avec succès !`);
      fetchRequests();
    }
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/purchase-requests`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
        localStorage.setItem('maersk_approver_requests', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Erreur chargement des demandes:', err);
      const cached = JSON.parse(localStorage.getItem('maersk_approver_requests') || '[]');
      if (cached.length > 0) {
        setRequests(cached);
        showNotification('error', 'Mode hors ligne. Données chargées depuis le cache.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id) => {
    const payload = { status: 'APPROVED', approvedByUserId: currentUser.id };
    const url = `${API_URL}/api/purchase-requests/${id}`;
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showNotification('success', 'Commande approuvée avec succès !');
        fetchRequests();
        setSelectedRequest(null);
      } else {
        const err = await res.json();
        showNotification('error', err.error || 'Erreur lors de l\'approbation');
      }
    } catch (error) {
      if (!window.navigator.onLine || error.message === 'Failed to fetch') {
        const queue = JSON.parse(localStorage.getItem('maersk_approver_queue') || '[]');
        queue.push({ url, method: 'PATCH', payload });
        localStorage.setItem('maersk_approver_queue', JSON.stringify(queue));
        
        showNotification('success', `Mode hors ligne : L'approbation a été sauvegardée et sera synchronisée au retour d'Internet.`);
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'APPROVED' } : r));
        setSelectedRequest(null);
      } else {
        showNotification('error', 'Impossible de joindre le serveur');
      }
    }
  };

  const handleReject = async (id) => {
    const payload = { status: 'REJECTED', approvedByUserId: currentUser.id };
    const url = `${API_URL}/api/purchase-requests/${id}`;
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showNotification('success', 'Commande rejetée.');
        fetchRequests();
        setSelectedRequest(null);
      } else {
        const err = await res.json();
        showNotification('error', err.error || 'Erreur lors du rejet');
      }
    } catch (error) {
      if (!window.navigator.onLine || error.message === 'Failed to fetch') {
        const queue = JSON.parse(localStorage.getItem('maersk_approver_queue') || '[]');
        queue.push({ url, method: 'PATCH', payload });
        localStorage.setItem('maersk_approver_queue', JSON.stringify(queue));
        
        showNotification('success', `Mode hors ligne : Le rejet a été sauvegardé et sera synchronisé au retour d'Internet.`);
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' } : r));
        setSelectedRequest(null);
      } else {
        showNotification('error', 'Impossible de joindre le serveur');
      }
    }
  };

  const showNotification = (type, text) => {
    setNotification({ type, text });
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureData(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveSignature = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/${currentUser.id}/signature`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: signatureData })
      });
      if (res.ok) {
        showNotification('success', 'Signature enregistrée avec succès !');
        setShowSettings(false);
      } else {
        showNotification('error', 'Erreur lors de la sauvegarde de la signature');
      }
    } catch (err) {
      showNotification('error', 'Erreur de connexion au serveur');
    }
  };

  const pendingRequests = requests.filter(r => 
    (r.status === 'PENDING' || !r.status) && r.approvedBy?.id === currentUser.id
  );
  const historyRequests = requests.filter(r => 
    (r.status === 'APPROVED' || r.status === 'REJECTED') && r.approvedBy?.id === currentUser.id
  );

  const displayedRequests = activeTab === 'pending' ? pendingRequests : historyRequests;

  return (
    <div className="approver-layout">
      <header className="approver-header">
        <div className="approver-brand">
          <img src={maerskLogo} alt="Maersk Logo" className="approver-logo" />
          <div>
            <h2>MAERSK | Tableau de bord d'approbation</h2>
            <span className="approver-subtitle">Validation des bons de commande</span>
          </div>
        </div>

        <div className="approver-user-profile">
          {onSwitchToForm && (
            <button className="logout-btn" onClick={onSwitchToForm} title="Basculer vers Création Bon de Commande" style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '10px' }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <span>Espace Création</span>
            </button>
          )}
          <span className="approver-role-badge">APPROUVEUR</span>
          <span className="approver-user-name">{currentUser?.firstName} {currentUser?.lastName}</span>
          
          <div style={{ position: 'relative' }}>
            <button className="logout-btn" onClick={() => {
              setShowNotificationsDropdown(!showNotificationsDropdown);
              if (!showNotificationsDropdown) {
                setNotificationsList(prev => prev.map(n => ({ ...n, read: true })));
              }
            }} title="Notifications">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {notificationsList.filter(n => !n.read).length > 0 && (
                <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  {notificationsList.filter(n => !n.read).length}
                </span>
              )}
            </button>
            {showNotificationsDropdown && (
              <div style={{ position: 'absolute', top: '40px', right: '0', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', width: '320px', maxHeight: '400px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', color: '#0f172a' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Notifications</span>
                  <div>
                    {notificationsList.length > 0 && (
                      <button onClick={() => setNotificationsList([])} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', marginRight: '10px' }}>Tout effacer</button>
                    )}
                    <button onClick={() => setShowNotificationsDropdown(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', lineHeight: '1' }} title="Fermer">&times;</button>
                  </div>
                </div>
                {notificationsList.length === 0 ? (
                  <div style={{ padding: '15px', textAlign: 'center', color: '#64748b' }}>Aucune notification</div>
                ) : (
                  notificationsList.map(n => (
                    <div key={n.id} style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', background: n.read ? '#fff' : '#f0f9ff', position: 'relative' }}>
                      <button onClick={() => setNotificationsList(prev => prev.filter(x => x.id !== n.id))} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', lineHeight: '1' }} title="Supprimer">&times;</button>
                      <div style={{ marginBottom: '4px', paddingRight: '15px' }}>{n.text}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{n.time.toLocaleTimeString()}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button className="logout-btn" onClick={() => setShowSettings(true)} title="Paramètres (Signature)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button className="logout-btn" onClick={onLogout} title="Déconnexion">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      {notification && (
        <div className={`approver-notif ${notification.type}`}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      <main className="approver-main">
        <div className="approver-sidebar">
          <div className="approver-tabs">
            <button 
              className={`approver-tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pending'); setSelectedRequest(null); }}
            >
              En attente ({pendingRequests.length})
            </button>
            <button 
              className={`approver-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => { setActiveTab('history'); setSelectedRequest(null); }}
            >
              Historique ({historyRequests.length})
            </button>
          </div>

          <div className="approver-list">
            {isLoading ? (
              <div className="approver-loading">Chargement...</div>
            ) : displayedRequests.length === 0 ? (
              <div className="approver-empty-list">Aucune commande {activeTab === 'pending' ? 'en attente' : 'dans l\'historique'}</div>
            ) : (
              displayedRequests.map(req => (
                <div 
                  key={req.id} 
                  className={`approver-list-item ${selectedRequest?.id === req.id ? 'selected' : ''}`}
                  onClick={() => setSelectedRequest(req)}
                >
                  <div className="item-header">
                    <span className="item-no">{req.requestNo}</span>
                    <span className={`status-badge ${req.status?.toLowerCase()}`}>{req.status}</span>
                  </div>
                  <div className="item-body">
                    <strong>{req.company?.name}</strong>
                    <span>Fournisseur : {req.vendor?.name}</span>
                    <span className="item-total">{Number(req.total).toLocaleString()} GNF</span>
                  </div>
                  <div className="item-footer">
                    <span>Par: {req.requestedBy?.firstName} {req.requestedBy?.lastName}</span>
                    <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="approver-details">
          {selectedRequest ? (
            <div className="details-card">
              <div className="details-header" style={{ marginBottom: '20px' }}>
                <span className={`status-badge large ${selectedRequest.status?.toLowerCase()}`}>{selectedRequest.status}</span>
              </div>
              
              <div className="pdf-template" style={{ padding: '40px', fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ width: '40%' }}>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h1 style={{ color: '#003366', fontSize: '2.5rem', margin: '0 0 10px 0', textTransform: 'uppercase', fontWeight: 'bold' }}>Purchase Order</h1>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', textAlign: 'right', justifyContent: 'end', color: '#000' }}>
                      <div style={{ textAlign: 'right' }}>Request No:</div>
                      <div>{selectedRequest.requestNo}</div>
                      <div style={{ textAlign: 'right' }}>Date:</div>
                      <div>{new Date(selectedRequest.requestDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>

                {/* Company & Vendor Grid */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '20px', fontSize: '0.9rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '15%', border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Company:</td>
                      <td style={{ width: '35%', border: '1px solid #000', padding: '6px' }}>{selectedRequest.company?.name}</td>
                      <td style={{ width: '15%', border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Vendor:</td>
                      <td style={{ width: '35%', border: '1px solid #000', padding: '6px' }}>{selectedRequest.vendor?.name}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Address:</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{selectedRequest.company?.address}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Address:</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{selectedRequest.vendor?.address}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Contact:</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{selectedRequest.company?.contact}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Contact:</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{selectedRequest.vendor?.contactPerson}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Telephone:</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{selectedRequest.company?.telephone}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Sector:</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{selectedRequest.vendor?.sector}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Service:</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{selectedRequest.company?.service}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Quote Number:</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{selectedRequest.quoteNumber}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Payment Terms & Delivery Date */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '20px', fontSize: '0.9rem', textAlign: 'center' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50%', border: '1px solid #000', padding: '6px', background: '#d9edf7', color: '#003366', textTransform: 'uppercase' }}>PAYMENT TERMS</th>
                      <th style={{ width: '50%', border: '1px solid #000', padding: '6px', background: '#d9edf7', color: '#003366', textTransform: 'uppercase' }}>DELIVERY DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '12px' }}>{selectedRequest.paymentTerms}</td>
                      <td style={{ border: '1px solid #000', padding: '12px' }}>{selectedRequest.deliveryDate ? new Date(selectedRequest.deliveryDate).toLocaleDateString() : ''}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Articles Grid */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '0', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#d9edf7', color: '#003366', textAlign: 'center' }}>
                      <th style={{ width: '15%', border: '1px solid #000', padding: '8px' }}>ARTICLE</th>
                      <th style={{ width: '40%', border: '1px solid #000', padding: '8px' }}>DESCRIPTION</th>
                      <th style={{ width: '15%', border: '1px solid #000', padding: '8px' }}>QUANTITY</th>
                      <th style={{ width: '15%', border: '1px solid #000', padding: '8px' }}>UNIT PRICE</th>
                      <th style={{ width: '15%', border: '1px solid #000', padding: '8px' }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(Math.max(10, selectedRequest.items?.length || 0))].map((_, idx) => {
                      const item = selectedRequest.items?.[idx];
                      return (
                        <tr key={idx} style={{ height: '30px' }}>
                          <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center' }}>{item?.articleName || ''}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 8px' }}>{item?.description || ''}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center' }}>{item?.quantity || ''}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>{item ? Number(item.unitPrice).toLocaleString() : ''}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>{item ? Number(item.total).toLocaleString() : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Totals and Instructions Grid */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', borderTop: 'none', marginBottom: '40px', fontSize: '0.9rem' }}>
                  <tbody>
                    <tr>
                      <td rowSpan="4" style={{ width: '70%', border: '1px solid #000', padding: '10px', verticalAlign: 'top', background: '#e6f0ff' }}>
                        <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                          {selectedRequest.instructions || '1. Send a copy of Invoice with the signed Delivery Note\n2. Ship and Invoice according to agreed terms'}
                        </pre>
                      </td>
                      <td style={{ width: '15%', border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>SUBTOTAL</td>
                      <td style={{ width: '15%', border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(selectedRequest.subtotal).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>TAX</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(selectedRequest.tax).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>LABOUR COST</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(selectedRequest.labourCost).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>TOTAL</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(selectedRequest.total).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Signatures Area */}
                <div className="signatures-area" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', marginTop: '60px' }}>
                  <div style={{ textAlign: 'center', width: '250px' }}>
                    <div style={{ borderBottom: '1px solid #000', minHeight: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '5px' }}>
                      {selectedRequest.requestedBy?.signature && (
                        <img src={selectedRequest.requestedBy.signature} alt="Signature Admin" style={{ maxHeight: '75px', maxWidth: '100%' }} />
                      )}
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '0.9rem' }}>Requested by:</div>
                    <div style={{ marginTop: '5px', fontWeight: 'bold', fontSize: '1rem' }}>{selectedRequest.requestedBy?.firstName} {selectedRequest.requestedBy?.lastName}</div>
                  </div>

                  <div style={{ textAlign: 'center', width: '250px' }}>
                    <div style={{ borderBottom: '1px solid #000', minHeight: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '5px' }}>
                      {selectedRequest.status === 'APPROVED' && selectedRequest.approvedBy?.signature && (
                        <img src={selectedRequest.approvedBy.signature} alt="Signature Approver" style={{ maxHeight: '75px', maxWidth: '100%' }} />
                      )}
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '0.9rem' }}>Approved by:</div>
                    <div style={{ marginTop: '5px', fontWeight: 'bold', fontSize: '1rem' }}>{selectedRequest.approvedBy?.firstName} {selectedRequest.approvedBy?.lastName}</div>
                  </div>
                </div>
              </div>

              {selectedRequest.status === 'PENDING' && (
                <div className="details-actions">
                  <button className="btn-reject" onClick={() => handleReject(selectedRequest.id)}>Rejeter la commande</button>
                  <button className="btn-approve" onClick={() => handleApprove(selectedRequest.id)}>Approuver la commande</button>
                </div>
              )}
            </div>
          ) : (
            <div className="details-empty">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#cbd5e1" strokeWidth="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <p>Sélectionnez une commande dans la liste pour voir ses détails et l'approuver.</p>
            </div>
          )}
        </div>
      </main>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', color: '#0f172a' }}>
            <h3>Paramètres du compte</h3>
            <p>Importez votre signature électronique pour l'apposer automatiquement sur les bons de commande que vous validez.</p>
            <div className="form-group" style={{ marginTop: '16px', marginBottom: '16px' }}>
              <label>Signature Électronique (Format PNG ou JPEG)</label>
              <input type="file" accept="image/png, image/jpeg" onChange={handleSignatureUpload} style={{ marginTop: '8px' }} />
            </div>
            {signatureData && (
              <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', marginBottom: '16px' }}>
                <img src={signatureData} alt="Signature" style={{ maxHeight: '100px', maxWidth: '100px' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setShowSettings(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', color: '#0f172a' }}
              >
                Fermer
              </button>
              <button 
                type="button" 
                onClick={saveSignature}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#00243d', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
