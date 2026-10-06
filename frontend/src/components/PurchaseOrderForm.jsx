import React, { useState, useEffect } from 'react';
import maerskLogo from '../assets/logo_maersk.png';
import { API_URL } from '../config';
import './PurchaseOrderForm.css';
import html2pdf from 'html2pdf.js';
import io from 'socket.io-client';

export default function PurchaseOrderForm({ currentUser, onLogout, onSwitchToAdmin }) {
  const [activeTab, setActiveTab] = useState('create');

  const [companies, setCompanies] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [articlesCatalog, setArticlesCatalog] = useState([]);
  const [historyRequests, setHistoryRequests] = useState([]);
  const [approvers, setApprovers] = useState([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companyDetails, setCompanyDetails] = useState({ address: '', contact: '', telephone: '', service: '' });

  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorDetails, setVendorDetails] = useState({ address: '', telephone: '', sector: '' });
  const [quoteNumber, setQuoteNumber] = useState('');

  const generateUniqueOrderNo = (existingList = historyRequests) => {
    const existingNos = new Set((existingList || []).map(r => r.requestNo?.toLowerCase()));
    let candidate = '';
    do {
      candidate = `PO-${Math.floor(100000 + Math.random() * 900000)}`;
    } while (existingNos.has(candidate.toLowerCase()));
    return candidate;
  };

  const [orderNo, setOrderNo] = useState(() => `PO-${Math.floor(100000 + Math.random() * 900000)}`);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('30 Jours');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [currency, setCurrency] = useState('GNF');

  const [items, setItems] = useState([
    { id: Date.now(), articleId: '', articleName: '', description: '', quantity: '', unitPrice: '', total: 0 }
  ]);

  const [taxPercent, setTaxPercent] = useState('');
  const [labourCost, setLabourCost] = useState('');
  const [instructions, setInstructions] = useState('');

  const [editingDraftId, setEditingDraftId] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [deleteDraftModal, setDeleteDraftModal] = useState({ isOpen: false, draftId: null, reqNo: '' });

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const [showApproverModal, setShowApproverModal] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState('');

  const [previewData, setPreviewData] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [signatureData, setSignatureData] = useState(currentUser?.signature || '');

  // Pagination pour l'historique
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [notifications, setNotifications] = useState([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  useEffect(() => {
    fetchData();

    const socket = io(API_URL, { transports: ['websocket'] });
    socket.emit('join', currentUser.id);

    socket.on('request_updated', (req) => {
      let statusFr = req.status === 'APPROVED' ? 'Approuvée' : (req.status === 'REJECTED' ? 'Rejetée' : req.status);
      const msg = `La commande ${req.requestNo} a été ${statusFr} !`;
      showNotification('success', msg);
      
      setNotifications(prev => [{ id: Date.now(), text: msg, read: false, time: new Date() }, ...prev]);
      
      // Update the request in history if it exists
      setHistoryRequests(prev => prev.map(r => r.id === req.id ? req : r));
    });

    window.addEventListener('online', syncOfflineQueue);
    return () => {
      socket.disconnect();
      window.removeEventListener('online', syncOfflineQueue);
    };
  }, []);

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('maersk_offline_queue') || '[]');
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

    localStorage.setItem('maersk_offline_queue', JSON.stringify(remainingQueue));
    if (successfulSyncs > 0) {
      showNotification('success', `${successfulSyncs} action(s) synchronisée(s) avec succès !`);
      fetchData();
    }
  };

  const fetchData = async () => {
    try {
      const [compRes, vendRes, artRes, histRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/companies`).then(r => r.json()),
        fetch(`${API_URL}/api/vendors`).then(r => r.json()),
        fetch(`${API_URL}/api/articles`).then(r => r.json()),
        fetch(`${API_URL}/api/purchase-requests`).then(r => r.json()),
        fetch(`${API_URL}/api/users`).then(r => r.json())
      ]);

      if (Array.isArray(compRes)) { setCompanies(compRes); localStorage.setItem('maersk_comp', JSON.stringify(compRes)); }
      if (Array.isArray(vendRes)) { setVendors(vendRes); localStorage.setItem('maersk_vend', JSON.stringify(vendRes)); }
      if (Array.isArray(artRes)) { setArticlesCatalog(artRes); localStorage.setItem('maersk_art', JSON.stringify(artRes)); }
      if (Array.isArray(histRes)) {
        setHistoryRequests(histRes);
        localStorage.setItem('maersk_hist', JSON.stringify(histRes));
        setOrderNo(prev => {
          const existingNos = new Set(histRes.map(r => r.requestNo?.toLowerCase()));
          if (existingNos.has(prev.toLowerCase())) {
            return generateUniqueOrderNo(histRes);
          }
          return prev;
        });
      }
      if (Array.isArray(usersRes)) {
        const approversList = usersRes.filter(u => u.role === 'APPROVER' && u.isActive !== false);
        setApprovers(approversList);
        localStorage.setItem('maersk_users', JSON.stringify(approversList));
      }
    } catch (err) {
      console.error('Erreur chargement API, tentative de chargement depuis le cache local:', err);
      // Load from cache if offline
      const cachedComp = JSON.parse(localStorage.getItem('maersk_comp') || '[]');
      const cachedVend = JSON.parse(localStorage.getItem('maersk_vend') || '[]');
      const cachedArt = JSON.parse(localStorage.getItem('maersk_art') || '[]');
      const cachedHist = JSON.parse(localStorage.getItem('maersk_hist') || '[]');
      const cachedUsers = JSON.parse(localStorage.getItem('maersk_users') || '[]');

      if (cachedComp.length > 0) setCompanies(cachedComp);
      if (cachedVend.length > 0) setVendors(cachedVend);
      if (cachedArt.length > 0) setArticlesCatalog(cachedArt);
      if (cachedUsers.length > 0) setApprovers(cachedUsers);
      if (cachedHist.length > 0) {
        setHistoryRequests(cachedHist);
        setOrderNo(prev => {
          const existingNos = new Set(cachedHist.map(r => r.requestNo?.toLowerCase()));
          if (existingNos.has(prev.toLowerCase())) return generateUniqueOrderNo(cachedHist);
          return prev;
        });
      }
      showNotification('error', 'Mode hors ligne. Données chargées depuis le cache local.');
    }
  };

  const handleCompanyChange = (id) => {
    setSelectedCompanyId(id);
    const comp = companies.find(c => c.id === parseInt(id));
    if (comp) {
      setCompanyDetails({
        address: comp.address || '',
        contact: comp.contact || '',
        telephone: comp.telephone || '',
        service: comp.service || ''
      });
    } else {
      setCompanyDetails({ address: '', contact: '', telephone: '', service: '' });
    }
  };

  const handleVendorChange = (id) => {
    setSelectedVendorId(id);
    const vend = vendors.find(v => v.id === parseInt(id));
    if (vend) {
      setVendorDetails({
        address: vend.address || '',
        telephone: vend.telephone || '',
        sector: vend.sector || ''
      });
    } else {
      setVendorDetails({ address: '', telephone: '', sector: '' });
    }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('pdf-content-to-download');
    const opt = {
      margin:       0.5,
      filename:     `PO_${previewData?.requestNo || 'Draft'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
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
        setNotification({ type: 'success', text: 'Signature enregistrée avec succès !' });
        setShowSettings(false);
      } else {
        setNotification({ type: 'error', text: 'Erreur lors de la sauvegarde de la signature' });
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Erreur de connexion au serveur' });
    }
  };

  const handleLoadDraft = (draft) => {
    setEditingDraftId(draft.id);
    setOrderNo(draft.requestNo || generateUniqueOrderNo());
    setOrderDate(draft.requestDate ? new Date(draft.requestDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setSelectedCompanyId(draft.companyId ? String(draft.companyId) : '');
    if (draft.company) {
      setCompanyDetails({
        address: draft.company.address || '',
        contact: draft.company.contact || '',
        telephone: draft.company.telephone || '',
        service: draft.company.service || ''
      });
    }
    setSelectedVendorId(draft.vendorId ? String(draft.vendorId) : '');
    if (draft.vendor) {
      setVendorDetails({
        address: draft.vendor.address || '',
        telephone: draft.vendor.telephone || '',
        sector: draft.vendor.sector || ''
      });
    }
    setQuoteNumber(draft.quoteNumber || '');
    setPaymentTerms(draft.paymentTerms || '30 Jours');
    setDeliveryDate(draft.deliveryDate ? new Date(draft.deliveryDate).toISOString().split('T')[0] : '');
    setCurrency(draft.currency || 'GNF');
    setLabourCost(draft.labourCost ? String(draft.labourCost) : '');
    setInstructions(draft.instructions || '');

    if (draft.items && draft.items.length > 0) {
      setItems(draft.items.map(item => ({
        id: item.id || Date.now() + Math.random(),
        articleId: item.articleId ? String(item.articleId) : '',
        articleName: item.articleName || '',
        description: item.description || '',
        quantity: item.quantity ? String(item.quantity) : '',
        unitPrice: item.unitPrice ? String(item.unitPrice) : '',
        total: item.total || 0
      })));
    } else {
      setItems([{ id: Date.now(), articleId: '', articleName: '', description: '', quantity: '', unitPrice: '', total: 0 }]);
    }

    setActiveTab('create');
    setNotification({ type: 'success', text: `Brouillon ${draft.requestNo} chargé dans le formulaire.` });
  };

  const [sendingDraftId, setSendingDraftId] = useState(null);

  const handleSendDraft = (draftId) => {
    setSendingDraftId(draftId);
    setShowApproverModal(true);
  };

  const submitSendDraft = async (draftId, approverId) => {
    try {
      const res = await fetch(`${API_URL}/api/purchase-requests/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDING', approvedByUserId: approverId })
      });
      if (!res.ok) throw new Error('Impossible d\'envoyer le brouillon');
      setNotification({ type: 'success', text: 'Le brouillon a été validé et envoyé avec succès.' });
      fetchData();
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  const handleDeleteDraft = (draftId, reqNo) => {
    setDeleteDraftModal({ isOpen: true, draftId, reqNo });
  };

  const submitDeleteDraft = async () => {
    const { draftId, reqNo } = deleteDraftModal;
    try {
      const res = await fetch(`${API_URL}/api/purchase-requests/${draftId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Échec de la suppression');
      setNotification({ type: 'success', text: `Brouillon ${reqNo} supprimé.` });
      fetchData();
      setDeleteDraftModal({ isOpen: false, draftId: null, reqNo: '' });
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
      setDeleteDraftModal({ isOpen: false, draftId: null, reqNo: '' });
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === 'articleId' && value) {
      const art = articlesCatalog.find(a => a.id === parseInt(value));
      if (art) {
        item.articleName = art.name;
        item.description = art.description || '';
        item.unitPrice = Number(art.unitPrice);
      }
    }

    const qty = parseFloat(field === 'quantity' ? value : item.quantity) || 0;
    const price = parseFloat(field === 'unitPrice' ? value : item.unitPrice) || 0;
    item.total = qty * price;

    updated[index] = item;
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { id: Date.now(), articleId: '', articleName: '', description: '', quantity: '', unitPrice: '', total: 0 }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const addQuickInstruction = (text) => {
    if (!instructions.trim()) {
      setInstructions(text);
    } else {
      setInstructions(instructions + ' - ' + text);
    }
  };

  const subtotal = items.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
  const calculatedTax = (subtotal * (parseFloat(taxPercent) || 0)) / 100;
  const netTotal = subtotal + calculatedTax + (parseFloat(labourCost) || 0);

  const handleSubmitOrder = async (statusType = 'PENDING') => {
    if (!selectedCompanyId || !selectedVendorId) {
      setNotification({ type: 'error', text: 'Veuillez sélectionner une compagnie et un fournisseur.' });
      return;
    }

    setSubmitting(true);
    setNotification(null);

    const payload = {
      requestNo: orderNo,
      requestDate: orderDate,
      companyId: selectedCompanyId,
      vendorId: selectedVendorId,
      quoteNumber,
      paymentTerms,
      deliveryDate,
      sector: vendorDetails.sector,
      currency,
      subtotal,
      tax: calculatedTax,
      labourCost,
      total: netTotal,
      instructions,
      requestedByUserId: currentUser?.id || 1,
      status: statusType,
      items,
      ...(selectedApproverId ? { approvedByUserId: selectedApproverId } : {})
    };

    try {
      const url = editingDraftId
        ? `${API_URL}/api/purchase-requests/${editingDraftId}`
        : `${API_URL}/api/purchase-requests`;

      const method = editingDraftId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Échec de la sauvegarde');
      }

      setNotification({
        type: 'success',
        text: statusType === 'PENDING'
          ? `Bon de Commande ${orderNo} envoyé avec succès pour validation.`
          : `Brouillon ${orderNo} mis à jour avec succès.`
      });

      fetchData();
      if (statusType === 'PENDING') {
        handleResetForm();
      }
    } catch (err) {
      if (!window.navigator.onLine || err.message === 'Failed to fetch') {
        const url = editingDraftId
          ? `${API_URL}/api/purchase-requests/${editingDraftId}`
          : `${API_URL}/api/purchase-requests`;
        const method = editingDraftId ? 'PATCH' : 'POST';
        
        const queue = JSON.parse(localStorage.getItem('maersk_offline_queue') || '[]');
        queue.push({ url, method, payload });
        localStorage.setItem('maersk_offline_queue', JSON.stringify(queue));
        
        setNotification({ type: 'success', text: `Mode hors ligne : L'action sur ${orderNo} a été sauvegardée et sera synchronisée au retour d'Internet.` });
        if (statusType === 'PENDING') handleResetForm();
      } else {
        setNotification({ type: 'error', text: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setEditingDraftId(null);
    setOrderNo(generateUniqueOrderNo());
    setSelectedCompanyId('');
    setCompanyDetails({ address: '', contact: '', telephone: '', service: '' });
    setSelectedVendorId('');
    setVendorDetails({ address: '', telephone: '', sector: '' });
    setQuoteNumber('');
    setItems([{ id: Date.now(), articleId: '', articleName: '', description: '', quantity: '', unitPrice: '', total: 0 }]);
    setLabourCost('');
    setInstructions('');
    setNotification({ type: 'success', text: 'Formulaire réinitialisé avec un nouveau numéro PO.' });
  };

  return (
    <div className="po-app-layout">
      {/* HEADER BAR */}
      <header className="po-header">
        <div className="po-brand">
          <img src={maerskLogo} alt="Maersk Logo" className="po-header-logo" />
          <div className="po-brand-text">
            <h2>MAERSK</h2>
            <span>Portail de Facturation & Bons de Commande</span>
          </div>
        </div>

        {/* Tabs navigation */}
        <div className="po-tabs">
          <button
            className={`po-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Créer un Bon de Commande</span>
          </button>
          <button
            className={`po-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>Historique ({historyRequests.filter(r => r.status !== 'DRAFT').length})</span>
          </button>
          <button
            className={`po-tab-btn ${activeTab === 'drafts' ? 'active' : ''}`}
            onClick={() => setActiveTab('drafts')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span>Brouillons ({historyRequests.filter(r => r.status === 'DRAFT').length})</span>
          </button>
        </div>

        {/* User profile & Logout */}
        <div className="po-user-profile">
          {onSwitchToAdmin && (
            <button className="back-admin-btn" onClick={onSwitchToAdmin} title="Panneau Administration">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Panneau Admin</span>
            </button>
          )}
          <div className="user-avatar">
            {currentUser?.firstName?.[0] || 'M'}
          </div>
          <div className="user-info">
            <span className="user-name">{currentUser?.firstName} {currentUser?.lastName}</span>
            <span className="user-role">{currentUser?.role || 'Comptable'}</span>
          </div>

          <div style={{ position: 'relative' }}>
            <button className="logout-btn" onClick={() => {
              setShowNotificationsDropdown(!showNotificationsDropdown);
              if (!showNotificationsDropdown) {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
              }
            }} title="Notifications">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            {showNotificationsDropdown && (
              <div style={{ position: 'absolute', top: '40px', right: '0', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', width: '320px', maxHeight: '400px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', color: '#0f172a' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Notifications</span>
                  <div>
                    {notifications.length > 0 && (
                      <button onClick={() => setNotifications([])} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', marginRight: '10px' }}>Tout effacer</button>
                    )}
                    <button onClick={() => setShowNotificationsDropdown(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', lineHeight: '1' }} title="Fermer">&times;</button>
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '15px', textAlign: 'center', color: '#64748b' }}>Aucune notification</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', background: n.read ? '#fff' : '#f0f9ff', position: 'relative' }}>
                      <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', lineHeight: '1' }} title="Supprimer">&times;</button>
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

      {/* NOTIFICATION BADGE */}
      {notification && (
        <div className={`po-notification ${notification.type}`}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="close-notif">×</button>
        </div>
      )}

      {/* TAB CONTENT 1: CREATE PURCHASE ORDER */}
      {activeTab === 'create' && (
        <main className="po-main-content">
          <div className="po-form-container">
            <div className="form-header-bar">
              <div>
                <h3>Création d'un Bon de Commande / Purchase Order</h3>
                <p className="section-desc">Saisissez les informations de facturation et de commande.</p>
              </div>
              <span className="po-number-badge">{orderNo}</span>
            </div>

            {/* TOP 3 CARDS SECTION */}
            <div className="po-grid-3">
              {/* CARD 1: COMPANY DETAILS */}
              <div className="po-card">
                <div className="card-header">
                  <span className="card-icon-svg">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                      <line x1="9" y1="6" x2="9" y2="6.01"></line>
                      <line x1="15" y1="6" x2="15" y2="6.01"></line>
                      <line x1="9" y1="10" x2="9" y2="10.01"></line>
                      <line x1="15" y1="10" x2="15" y2="10.01"></line>
                      <line x1="9" y1="14" x2="9" y2="14.01"></line>
                      <line x1="15" y1="14" x2="15" y2="14.01"></line>
                      <line x1="9" y1="18" x2="15" y2="18"></line>
                    </svg>
                  </span>
                  <h4>Company Details</h4>
                </div>
                <div className="card-body">
                  <div className="form-field">
                    <label>Company</label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                    >
                      <option value="">-- Sélectionner une compagnie --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Address</label>
                    <input type="text" value={companyDetails.address} readOnly placeholder="Adresse auto-remplie" />
                  </div>

                  <div className="form-row-2">
                    <div className="form-field">
                      <label>Contact</label>
                      <input type="text" value={companyDetails.contact} readOnly placeholder="Contact" />
                    </div>
                    <div className="form-field">
                      <label>Telephone</label>
                      <input type="text" value={companyDetails.telephone} readOnly placeholder="Téléphone" />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Service</label>
                    <input type="text" value={companyDetails.service} readOnly placeholder="Service" />
                  </div>
                </div>
              </div>

              {/* CARD 2: VENDOR DETAILS */}
              <div className="po-card">
                <div className="card-header">
                  <span className="card-icon-svg">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                  </span>
                  <h4>Vendor Details</h4>
                </div>
                <div className="card-body">
                  <div className="form-field">
                    <label>Vendor</label>
                    <select
                      value={selectedVendorId}
                      onChange={(e) => handleVendorChange(e.target.value)}
                    >
                      <option value="">-- Sélectionner un fournisseur --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Vendor Address</label>
                    <input type="text" value={vendorDetails.address} readOnly placeholder="Adresse du fournisseur" />
                  </div>

                  <div className="form-row-2">
                    <div className="form-field">
                      <label>Vendor Phone</label>
                      <input type="text" value={vendorDetails.telephone} readOnly placeholder="Téléphone" />
                    </div>
                    <div className="form-field">
                      <label>Sector</label>
                      <input type="text" value={vendorDetails.sector} readOnly placeholder="Secteur" />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Quote Number (N° Devis)</label>
                    <input
                      type="text"
                      value={quoteNumber}
                      onChange={(e) => setQuoteNumber(e.target.value)}
                      placeholder="Ex: QUOTE-2026-089"
                    />
                  </div>
                </div>
              </div>

              {/* CARD 3: PURCHASE ORDER DETAILS */}
              <div className="po-card">
                <div className="card-header">
                  <span className="card-icon-svg">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                  </span>
                  <h4>Purchase Order Details</h4>
                </div>
                <div className="card-body">
                  <div className="form-field">
                    <label>Order No.</label>
                    <input
                      type="text"
                      value={orderNo}
                      onChange={(e) => setOrderNo(e.target.value)}
                      className="highlight-input"
                    />
                  </div>

                  <div className="form-field">
                    <label>Order Date</label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label>Payment Terms</label>
                    <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                      <option value="Comptant">Comptant à réception</option>
                      <option value="15 Jours">15 Jours</option>
                      <option value="30 Jours">30 Jours</option>
                      <option value="60 Jours">60 Jours</option>
                    </select>
                  </div>

                  <div className="form-row-2">
                    <div className="form-field">
                      <label>Delivery Date</label>
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label>Devise</label>
                      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        <option value="GNF">GNF (Franc Guinéen)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MIDDLE SECTION: ARTICLES DETAILS */}
            <div className="po-card articles-section">
              <div className="card-header space-between">
                <div className="header-left">
                  <span className="card-icon-svg">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                  </span>
                  <h4>Articles Details</h4>
                </div>
                <button type="button" className="add-line-btn" onClick={addItemRow}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Ajouter un article</span>
                </button>
              </div>

              <div className="table-responsive">
                <table className="articles-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Article</th>
                      <th style={{ width: '30%' }}>Description</th>
                      <th style={{ width: '12%' }}>Quantité</th>
                      <th style={{ width: '16%' }}>Prix Unitaire ({currency})</th>
                      <th style={{ width: '16%' }}>Total ({currency})</th>
                      <th style={{ width: '4%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td>
                          <select
                            value={item.articleId}
                            onChange={(e) => handleItemChange(index, 'articleId', e.target.value)}
                          >
                            <option value="">-- Choisir ou saisir --</option>
                            {articlesCatalog.map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                          {!item.articleId && (
                            <input
                              type="text"
                              placeholder="Nom personnalisé..."
                              value={item.articleName}
                              onChange={(e) => handleItemChange(index, 'articleName', e.target.value)}
                              style={{ marginTop: '6px' }}
                            />
                          )}
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="Description détaillée de la prestation..."
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="calculated-total">
                            {Number(item.total).toLocaleString()} {currency}
                          </div>
                        </td>
                        <td>
                          {items.length > 1 && (
                            <button
                              type="button"
                              className="delete-row-btn"
                              onClick={() => removeItemRow(index)}
                              title="Supprimer la ligne"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BOTTOM SECTION: INSTRUCTIONS & TOTALS & ACTION BUTTONS */}
            <div className="po-bottom-grid">
              {/* Left Instructions (Redesigned) */}
              <div className="po-card instructions-card">
                <div className="card-header space-between">
                  <div className="header-left">
                    <span className="card-icon-svg">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </span>
                    <h4>Instructions & Notes de Facturation</h4>
                  </div>
                  <span className="char-counter">{instructions.length} car.</span>
                </div>
                <div className="card-body instructions-body">
                  <div className="quick-tags">
                    <span className="tag-label">Ajout rapide:</span>
                    <button type="button" className="quick-tag-chip" onClick={() => addQuickInstruction('Livraison prioritaire')}>
                      + Livraison prioritaire
                    </button>
                    <button type="button" className="quick-tag-chip" onClick={() => addQuickInstruction('Paiement sous 30 jours')}>
                      + Paiement 30d
                    </button>
                    <button type="button" className="quick-tag-chip" onClick={() => addQuickInstruction('Facture à joindre au colis')}>
                      + Facture avec colis
                    </button>
                  </div>

                  <div className="textarea-wrapper">
                    <textarea
                      rows="4"
                      placeholder="Saisissez ici les instructions de livraison, mentions légales ou notes de règlement..."
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      className="styled-textarea"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Right Summary Totals & Actions */}
              <div className="po-card totals-card">
                <div className="totals-summary">
                  <div className="total-row">
                    <span>SUBTOTAL</span>
                    <strong>{subtotal.toLocaleString()} {currency}</strong>
                  </div>

                  <div className="total-row align-center">
                    <span>TAX (TVA %)</span>
                    <div className="cost-input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        style={{ width: '60px', textAlign: 'center' }}
                        value={taxPercent}
                        onChange={(e) => setTaxPercent(e.target.value)}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>% = {calculatedTax.toLocaleString()} {currency}</span>
                    </div>
                  </div>

                  <div className="total-row align-center">
                    <span>LABOR COST</span>
                    <div className="cost-input-wrapper">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={labourCost}
                        onChange={(e) => setLabourCost(e.target.value)}
                      />
                      <span>{currency}</span>
                    </div>
                  </div>

                  <div className="total-row net-total-row">
                    <span>NET TOTAL</span>
                    <span className="net-total-amount">{netTotal.toLocaleString()} {currency}</span>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="po-action-buttons">
                  <button
                    type="button"
                    className="action-btn send-btn"
                    disabled={submitting}
                    onClick={() => setShowApproverModal(true)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>SEND FOR (Envoyer)</span>
                  </button>

                  <button
                    type="button"
                    className="action-btn reset-btn"
                    onClick={handleResetForm}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    <span>RESET</span>
                  </button>

                  <button
                    type="button"
                    className="action-btn save-btn"
                    disabled={submitting}
                    onClick={() => handleSubmitOrder('DRAFT')}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <span>SAVE BROUILLON</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* TAB CONTENT 2: HISTORY & TRACKING */}
      {activeTab === 'history' && (
        <main className="po-main-content">
          <div className="po-form-container">
            <div className="form-header-bar">
              <div>
                <h3>Historique & Suivi des Bons de Commande</h3>
                <p className="section-desc">Liste de toutes les demandes de facturation et leur statut.</p>
              </div>

            </div>

            {(() => {
              const nonDrafts = historyRequests.filter(r => r.status !== 'DRAFT');
              const totalPages = Math.ceil(nonDrafts.length / itemsPerPage) || 1;
              const indexOfLastItem = currentPage * itemsPerPage;
              const indexOfFirstItem = indexOfLastItem - itemsPerPage;
              const currentItems = nonDrafts.slice(indexOfFirstItem, indexOfLastItem);

              return (
                <div className="po-card">
                  <div className="table-responsive">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>N° Commande</th>
                          <th>Date</th>
                          <th>Compagnie</th>
                          <th>Fournisseur</th>
                          <th>Montant Total</th>
                          <th>Statut</th>
                          <th>Demandé par</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nonDrafts.length === 0 ? (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                              Aucun bon de commande validé ou en cours pour le moment.
                            </td>
                          </tr>
                        ) : (
                          currentItems.map((req) => (
                            <tr key={req.id}>
                              <td><strong>{req.requestNo}</strong></td>
                              <td>{new Date(req.requestDate).toLocaleDateString()}</td>
                              <td>{req.company?.name || '-'}</td>
                              <td>{req.vendor?.name || '-'}</td>
                              <td><strong>{Number(req.total).toLocaleString()} {req.currency}</strong></td>
                              <td>
                                <span className={`status-pill ${req.status?.toLowerCase()}`}>
                                  {req.status}
                                </span>
                              </td>
                              <td>{req.requestedBy ? `${req.requestedBy.firstName} ${req.requestedBy.lastName}` : 'Système'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="draft-action-btn edit"
                                  onClick={() => setPreviewData(req)}
                                  title="Aperçu du Bon de Commande"
                                  style={{ padding: '6px 12px' }}
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                  <span style={{ marginLeft: '4px' }}>Aperçu</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {nonDrafts.length > 0 && (
                    <div className="pagination-bar">
                      <span className="pagination-info">
                        Affichage de <strong>{indexOfFirstItem + 1}</strong> à <strong>{Math.min(indexOfLastItem, nonDrafts.length)}</strong> sur <strong>{nonDrafts.length}</strong> éléments
                      </span>
                      <div className="pagination-controls">
                        <button
                          type="button"
                          className="pagination-btn"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                          ‹ Précédent
                        </button>
                        <span className="page-indicator">
                          Page <strong>{currentPage}</strong> sur <strong>{totalPages}</strong>
                        </span>
                        <button
                          type="button"
                          className="pagination-btn"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                          Suivant ›
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </main>
      )}

      {/* TAB CONTENT 3: DRAFTS MANAGEMENT */}
      {activeTab === 'drafts' && (
        <main className="po-main-content">
          <div className="po-form-container">
            <div className="form-header-bar">
              <div>
                <h3>Gestion des Brouillons</h3>
                <p className="section-desc">Consultez, reprenez la rédaction ou envoyez vos bons de commande sauvegardés.</p>
              </div>
            </div>

            <div className="po-card">
              <div className="table-responsive">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>N° Brouillon</th>
                      <th>Date de Sauvegarde</th>
                      <th>Compagnie</th>
                      <th>Fournisseur</th>
                      <th>Montant Estimé</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRequests.filter(r => r.status === 'DRAFT').length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          Aucun brouillon enregistré. Vous pouvez sauvegarder vos saisies en cours avec le bouton <strong>SAVE BROUILLON</strong>.
                        </td>
                      </tr>
                    ) : (
                      historyRequests.filter(r => r.status === 'DRAFT').map((draft) => (
                        <tr key={draft.id}>
                          <td><strong style={{ color: 'var(--maersk-dark-blue)' }}>{draft.requestNo}</strong></td>
                          <td>{new Date(draft.requestDate).toLocaleDateString()}</td>
                          <td>{draft.company?.name || 'Non spécifié'}</td>
                          <td>{draft.vendor?.name || 'Non spécifié'}</td>
                          <td><strong>{Number(draft.total).toLocaleString()} {draft.currency}</strong></td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className="draft-action-btn edit"
                                onClick={() => handleLoadDraft(draft)}
                                title="Ouvrir et modifier"
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                <span>Ouvrir / Reprendre</span>
                              </button>
                              <button
                                type="button"
                                className="draft-action-btn send"
                                onClick={() => handleSendDraft(draft.id)}
                                title="Envoyer directement"
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                <span>Envoyer</span>
                              </button>
                              <button
                                type="button"
                                className="draft-action-btn delete"
                                onClick={() => handleDeleteDraft(draft.id, draft.requestNo)}
                                title="Supprimer le brouillon"
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                <span>Supprimer</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* APPROVER SELECTION MODAL */}
      {showApproverModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: '#0f172a' }}>
            <h3>Sélectionner un approbateur</h3>
            <p>Veuillez choisir la personne qui devra valider cette demande d'achat.</p>
            <div className="form-group" style={{ marginTop: '16px', marginBottom: '24px' }}>
              <select
                value={selectedApproverId}
                onChange={(e) => setSelectedApproverId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="">-- Choisir un approbateur --</option>
                {approvers.map(app => (
                  <option key={app.id} value={app.id}>{app.firstName} {app.lastName}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowApproverModal(false);
                  setSendingDraftId(null);
                }}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', color: '#0f172a' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowApproverModal(false);
                  if (sendingDraftId) {
                    submitSendDraft(sendingDraftId, selectedApproverId);
                    setSendingDraftId(null);
                  } else {
                    handleSubmitOrder('PENDING');
                  }
                }}
                disabled={!selectedApproverId}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#059669', color: 'white', border: 'none', cursor: selectedApproverId ? 'pointer' : 'not-allowed', opacity: selectedApproverId ? 1 : 0.6 }}
              >
                Confirmer l'envoi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PO PREVIEW MODAL */}
      {previewData && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content printable-modal" style={{ maxWidth: '850px', width: '95%', maxHeight: '95vh', overflowY: 'auto', backgroundColor: '#fff', color: '#000', padding: 0 }}>
            {/* Action buttons (Hidden when printing) */}
            <div className="no-print" style={{ padding: '16px', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>Aperçu du Bon de Commande</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={handleDownloadPDF} style={{ padding: '8px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Télécharger PDF
                </button>
                <button type="button" onClick={() => window.print()} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Imprimer
                </button>
                <button type="button" onClick={() => setPreviewData(null)} style={{ padding: '8px 16px', background: '#e2e8f0', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>
                  Fermer
                </button>
              </div>
            </div>

            {/* The Actual PDF Template */}
            <div id="pdf-content-to-download" className="pdf-template" style={{ padding: '40px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ width: '40%' }}>
                  {/* You could put logo here if needed, but template image doesn't show it */}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h1 style={{ color: '#003366', fontSize: '2.5rem', margin: '0 0 10px 0', textTransform: 'uppercase', fontWeight: 'bold' }}>Purchase Order</h1>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', textAlign: 'right', justifyContent: 'end', color: '#000' }}>
                    <div style={{ textAlign: 'right' }}>Request No:</div>
                    <div>{previewData.requestNo}</div>
                    <div style={{ textAlign: 'right' }}>Date:</div>
                    <div>{new Date(previewData.requestDate).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              {/* Company & Vendor Grid */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '20px', fontSize: '0.9rem' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '15%', border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Company:</td>
                    <td style={{ width: '35%', border: '1px solid #000', padding: '6px' }}>{previewData.company?.name}</td>
                    <td style={{ width: '15%', border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Vendor:</td>
                    <td style={{ width: '35%', border: '1px solid #000', padding: '6px' }}>{previewData.vendor?.name}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Address:</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{previewData.company?.address}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Address:</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{previewData.vendor?.address}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Contact:</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{previewData.company?.contact}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Contact:</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{previewData.vendor?.contactPerson}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Telephone:</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{previewData.company?.telephone}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Sector:</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{previewData.vendor?.sector}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Service:</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{previewData.company?.service}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>Quote Number:</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{previewData.quoteNumber}</td>
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
                    <td style={{ border: '1px solid #000', padding: '12px' }}>{previewData.paymentTerms}</td>
                    <td style={{ border: '1px solid #000', padding: '12px' }}>{previewData.deliveryDate ? new Date(previewData.deliveryDate).toLocaleDateString() : ''}</td>
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
                  {/* Render items and fill empty rows up to 10 rows minimum to match excel look */}
                  {[...Array(Math.max(10, previewData.items?.length || 0))].map((_, idx) => {
                    const item = previewData.items?.[idx];
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
                        {previewData.instructions || '1. Send a copy of Invoice with the signed Delivery Note\n2. Ship and Invoice according to agreed terms'}
                      </pre>
                    </td>
                    <td style={{ width: '15%', border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>SUBTOTAL</td>
                    <td style={{ width: '15%', border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(previewData.subtotal).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>TAX</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(previewData.tax).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>LABOUR COST</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(previewData.labourCost).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', background: '#e6f0ff' }}>TOTAL</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(previewData.total).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures Area */}
              <div className="signatures-area" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', marginTop: '60px' }}>
                <div style={{ textAlign: 'center', width: '250px' }}>
                  <div style={{ borderBottom: '1px solid #000', minHeight: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '5px' }}>
                    {previewData.requestedBy?.signature && (
                      <img src={previewData.requestedBy.signature} alt="Signature Admin" style={{ maxHeight: '75px', maxWidth: '100%' }} />
                    )}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '0.9rem' }}>Requested by:</div>
                  <div style={{ marginTop: '5px', fontWeight: 'bold', fontSize: '1rem' }}>{previewData.requestedBy?.firstName} {previewData.requestedBy?.lastName}</div>
                </div>

                <div style={{ textAlign: 'center', width: '250px' }}>
                  <div style={{ borderBottom: '1px solid #000', minHeight: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '5px' }}>
                    {previewData.status === 'APPROVED' && previewData.approvedBy?.signature && (
                      <img src={previewData.approvedBy.signature} alt="Signature Approver" style={{ maxHeight: '75px', maxWidth: '100%' }} />
                    )}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '0.9rem' }}>Approved by:</div>
                  <div style={{ marginTop: '5px', fontWeight: 'bold', fontSize: '1rem' }}>{previewData.approvedBy?.firstName} {previewData.approvedBy?.lastName}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL (Creator Signature) */}
      {showSettings && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '400px', color: '#0f172a' }}>
            <h3>Paramètres du compte</h3>
            <p>Importez votre signature électronique pour l'apposer automatiquement sur vos bons de commande.</p>
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
                style={{ padding: '8px 16px', borderRadius: '6px', background: 'none', border: '1px solid #94a3b8', cursor: 'pointer' }}
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

      {/* DELETE DRAFT MODAL */}
      {deleteDraftModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '400px', color: '#0f172a' }}>
            <h3>Confirmation de suppression</h3>
            <p>Voulez-vous vraiment supprimer le brouillon <strong>{deleteDraftModal.reqNo}</strong> ?</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setDeleteDraftModal({ isOpen: false, draftId: null, reqNo: '' })}
                style={{ padding: '8px 16px', borderRadius: '6px', background: 'none', border: '1px solid #94a3b8', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitDeleteDraft}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
