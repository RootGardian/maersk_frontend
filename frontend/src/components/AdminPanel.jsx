import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import maerskLogo from '../assets/logo_maersk.png';
import { API_URL } from '../config';
import './AdminPanel.css';

export default function AdminPanel({ currentUser, onLogout, onSwitchToForm }) {
  const [activeTab, setActiveTab] = useState('database');
  const [isLoading, setIsLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [articles, setArticles] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  // Search bar state
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state (50 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'ACCOUNTANT' });
  const [newCompany, setNewCompany] = useState({ name: '', address: '', contact: '', telephone: '', service: '' });
  const [newVendor, setNewVendor] = useState({ name: '', address: '', contactPerson: '', telephone: '', email: '', sector: '' });
  const [newArticle, setNewArticle] = useState({ name: '', description: '', unitPrice: '' });

  const [editCompanyId, setEditCompanyId] = useState(null);
  const [editVendorId, setEditVendorId] = useState(null);
  const [editArticleId, setEditArticleId] = useState(null);

  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fileInputRef = useRef(null);
  const [importTarget, setImportTarget] = useState(null);

  const [resetPasswordModal, setResetPasswordModal] = useState({ isOpen: false, userId: null, userEmail: '', newPassword: '' });

  useEffect(() => {
    fetchAllData();
  }, []);

  // Reset page & search term when switching tabs
  useEffect(() => {
    setCurrentPage(1);
    setSearchTerm('');
  }, [activeTab]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [uRes, cRes, vRes, aRes, poRes] = await Promise.all([
        fetch(`${API_URL}/api/users`).then(r => r.json()),
        fetch(`${API_URL}/api/companies`).then(r => r.json()),
        fetch(`${API_URL}/api/vendors`).then(r => r.json()),
        fetch(`${API_URL}/api/articles`).then(r => r.json()),
        fetch(`${API_URL}/api/purchase-requests`).then(r => r.json())
      ]);

      if (Array.isArray(uRes)) setUsers(uRes);
      if (Array.isArray(cRes)) setCompanies(cRes);
      if (Array.isArray(vRes)) setVendors(vRes);
      if (Array.isArray(aRes)) setArticles(aRes);
      if (Array.isArray(poRes)) setPurchaseOrders(poRes);
    } catch (err) {
      console.error('Erreur chargement données admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.email || !newUser.firstName) return;

    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setNotification({ type: 'success', text: `Utilisateur ${newUser.email} créé avec succès.` });
        setNewUser({ firstName: '', lastName: '', email: '', password: '', role: 'ACCOUNTANT' });
        fetchAllData();
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  const handleUpdateUserStatus = async (id, updates) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = (id, email) => {
    setResetPasswordModal({ isOpen: true, userId: id, userEmail: email, newPassword: '' });
  };

  const submitResetPassword = async () => {
    const { userId, userEmail, newPassword } = resetPasswordModal;
    if (!newPassword) return;

    try {
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (res.ok) {
        setNotification({ type: 'success', text: `Mot de passe réinitialisé pour ${userEmail}.` });
        setResetPasswordModal({ isOpen: false, userId: null, userEmail: '', newPassword: '' });
      } else {
        setNotification({ type: 'error', text: 'Erreur lors de la réinitialisation du mot de passe.' });
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  const handleSubmitCompany = async (e) => {
    e.preventDefault();
    if (!newCompany.name) return;

    try {
      const isEdit = !!editCompanyId;
      const url = isEdit ? `${API_URL}/api/companies/${editCompanyId}` : `${API_URL}/api/companies`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany)
      });
      if (res.ok) {
        setNotification({ type: 'success', text: `Compagnie ${newCompany.name} ${isEdit ? 'mise à jour' : 'créée'}.` });
        setNewCompany({ name: '', address: '', contact: '', telephone: '', service: '' });
        setEditCompanyId(null);
        fetchAllData();
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  const handleSubmitVendor = async (e) => {
    e.preventDefault();
    if (!newVendor.name) return;

    try {
      const isEdit = !!editVendorId;
      const url = isEdit ? `${API_URL}/api/vendors/${editVendorId}` : `${API_URL}/api/vendors`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVendor)
      });
      if (res.ok) {
        setNotification({ type: 'success', text: `Fournisseur ${newVendor.name} ${isEdit ? 'mis à jour' : 'créé'}.` });
        setNewVendor({ name: '', address: '', contactPerson: '', telephone: '', email: '', sector: '' });
        setEditVendorId(null);
        fetchAllData();
      } else {
        const errorData = await res.json();
        setNotification({ type: 'error', text: errorData.error || 'Erreur inconnue' });
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  const handleSubmitArticle = async (e) => {
    e.preventDefault();
    if (!newArticle.name) return;

    try {
      const isEdit = !!editArticleId;
      const url = isEdit ? `${API_URL}/api/articles/${editArticleId}` : `${API_URL}/api/articles`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newArticle)
      });
      if (res.ok) {
        setNotification({ type: 'success', text: `Article ${newArticle.name} ${isEdit ? 'mis à jour' : 'ajouté'}.` });
        setNewArticle({ name: '', description: '', unitPrice: '' });
        setEditArticleId(null);
        fetchAllData();
      } else {
        const errorData = await res.json();
        setNotification({ type: 'error', text: errorData.error || 'Erreur inconnue' });
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  // --- EXPORT TO EXCEL ---
  const handleExportExcel = (target) => {
    let dataToExport = [];
    let fileName = '';

    if (target === 'companies') {
      fileName = 'MAERSK_COMPANIES.xlsx';
      dataToExport = companies.map(c => ({
        'Company': c.name || '',
        'Address': c.address || '',
        'Contact': c.contact || '',
        'Telephone': c.telephone || '',
        'Service': c.service || '',
        'logo': c.logo || ''
      }));
    } else if (target === 'vendors') {
      fileName = 'MAERSK_VENDORS.xlsx';
      dataToExport = vendors.map(v => ({
        'Vendor': v.name || '',
        'Address': v.address || '',
        'Contact Person': v.contactPerson || '',
        'Telephone': v.telephone || '',
        'Email': v.email || '',
        'Sector': v.sector || ''
      }));
    } else if (target === 'articles') {
      fileName = 'MAERSK_ARTICLES.xlsx';
      dataToExport = articles.map(a => ({
        'Article': a.name || '',
        'Description': a.description || '',
        'Unit Price': a.unitPrice ? Number(a.unitPrice) : 0
      }));
    } else if (target === 'database') {
      fileName = 'MAERSK_DATABASE_FULL.xlsx';
      dataToExport = [];
      purchaseOrders.forEach(po => {
        if (po.items && po.items.length > 0) {
          po.items.forEach(item => {
            dataToExport.push({
              'Order No.': po.requestNo,
              'Request Date': po.requestDate ? new Date(po.requestDate).toLocaleDateString() : '',
              'Company': po.company?.name || '',
              'Vendor Name': po.vendor?.name || '',
              'Sector': po.vendor?.sector || '',
              'Quote Number': po.quoteNumber || '',
              'Payment Terms': po.paymentTerms || '',
              'Delivery Date': po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString() : '',
              'Article': item.articleName || '',
              'Description': item.description || '',
              'Quantity': item.quantity || 1,
              'Unit Price': item.unitPrice || 0,
              'Total': item.total || 0,
              'Subtotal': po.subtotal || 0,
              'Tax': po.vat || 0,
              'Labor Cost': po.laborCost || 0,
              'Net Total': po.total || 0,
              'Status': po.status || 'PENDING'
            });
          });
        } else {
          dataToExport.push({
            'Order No.': po.requestNo,
            'Request Date': po.requestDate ? new Date(po.requestDate).toLocaleDateString() : '',
            'Company': po.company?.name || '',
            'Vendor Name': po.vendor?.name || '',
            'Sector': po.vendor?.sector || '',
            'Quote Number': po.quoteNumber || '',
            'Payment Terms': po.paymentTerms || '',
            'Delivery Date': po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString() : '',
            'Article': '-',
            'Description': '-',
            'Quantity': 0,
            'Unit Price': 0,
            'Total': 0,
            'Subtotal': po.subtotal || 0,
            'Tax': po.vat || 0,
            'Labor Cost': po.laborCost || 0,
            'Net Total': po.total || 0,
            'Status': po.status || 'PENDING'
          });
        }
      });
    }

    if (dataToExport.length === 0) {
      setNotification({ type: 'error', text: 'Aucune donnée à exporter.' });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, target.toUpperCase());
    XLSX.writeFile(workbook, fileName);
    setNotification({ type: 'success', text: `Fichier Excel ${fileName} généré avec succès !` });
  };

  // --- TRIGGER FILE UPLOAD ---
  const triggerImport = (target) => {
    setImportTarget(target);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  // --- HELPER TO FIND ROW VALUE FLEXIBLY ---
  const getRowValue = (row, possibleKeys) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    for (const key of possibleKeys) {
      // 1. Exact match
      if (row[key] !== undefined && row[key] !== null) return row[key];
      // 2. Case insensitive match & trim match
      const targetLower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const foundKey = rowKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === targetLower);
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return row[foundKey];
      }
    }
    return undefined;
  };

  // --- HANDLE FILE IMPORT WITH FLEXIBLE COLUMN MATCHING & DUPLICATE CHECKING ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !importTarget) return;

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        // Convert sheet to json with headers
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (json.length === 0) {
          setNotification({ type: 'error', text: 'Le fichier Excel est vide.' });
          setIsLoading(false);
          return;
        }

        let importedCount = 0;
        let updatedCount = 0;

        if (importTarget === 'companies') {
          const itemsToProcess = json.map(row => {
            const rawName = getRowValue(row, ['Company', 'company', 'Nom', 'Name', 'Societe', 'Compagnie', 'Société']);
            if (!rawName || String(rawName).trim() === '') return null;
            return {
              name: String(rawName).trim(),
              address: String(getRowValue(row, ['Address', 'address', 'Adresse', 'Lieu']) || ''),
              contact: String(getRowValue(row, ['Contact', 'contact', 'Responsable']) || ''),
              telephone: String(getRowValue(row, ['Telephone', 'telephone', 'Téléphone', 'Tel', 'Phone']) || ''),
              service: String(getRowValue(row, ['Service', 'service', 'Département', 'Department']) || '')
            };
          }).filter(Boolean);

          const res = await fetch(`${API_URL}/api/bulk-import/companies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToProcess })
          });
          const data = await res.json();
          if (res.ok) {
            importedCount = data.createdCount || 0;
            updatedCount = data.updatedCount || 0;
          }
        } else if (importTarget === 'vendors') {
          const itemsToProcess = json.map(row => {
            const rawName = getRowValue(row, ['Vendor', 'vendor', 'Fournisseur', 'Name', 'Nom']);
            if (!rawName || String(rawName).trim() === '') return null;
            return {
              name: String(rawName).trim(),
              address: String(getRowValue(row, ['Address', 'address', 'Adresse']) || ''),
              contactPerson: String(getRowValue(row, ['Contact Person', 'Contact', 'contactPerson', 'ContactPerson']) || ''),
              telephone: String(getRowValue(row, ['Telephone', 'telephone', 'Téléphone', 'Tel', 'Phone']) || ''),
              email: String(getRowValue(row, ['Email', 'email', 'E-mail', 'Mail']) || ''),
              sector: String(getRowValue(row, ['Sector', 'sector', 'Secteur', 'Domaine']) || '')
            };
          }).filter(Boolean);

          const res = await fetch(`${API_URL}/api/bulk-import/vendors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToProcess })
          });
          const data = await res.json();
          if (res.ok) {
            importedCount = data.createdCount || 0;
            updatedCount = data.updatedCount || 0;
          }
        } else if (importTarget === 'articles') {
          const itemsToProcess = json.map(row => {
            const rawName = getRowValue(row, ['Article', 'article', 'Désignation', 'Designation', 'Name', 'Item']);
            if (!rawName || String(rawName).trim() === '') return null;
            return {
              name: String(rawName).trim(),
              description: String(getRowValue(row, ['Description', 'description', 'Details']) || ''),
              unitPrice: Number(getRowValue(row, ['Unit Price', 'UnitPrice', 'Prix Unitaire', 'PrixUnitaire', 'Price', 'Prix']) || 0)
            };
          }).filter(Boolean);

          const res = await fetch(`${API_URL}/api/bulk-import/articles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToProcess })
          });
          const data = await res.json();
          if (res.ok) {
            importedCount = data.createdCount || 0;
            updatedCount = data.updatedCount || 0;
          }
        } else if (importTarget === 'database') {
          const groupedOrders = {};
          let currentOrderNo = null;

          json.forEach((row, index) => {
            let orderNo = getRowValue(row, ['Order No.', 'Order No', 'OrderNo', 'N° Commande', 'Num Commande', 'RequestNo']);

            if (orderNo && String(orderNo).trim() !== '') {
              currentOrderNo = String(orderNo).trim();
            } else if (!currentOrderNo) {
              currentOrderNo = `PO-IMP-${Date.now()}-${index + 1}`;
            }

            if (!groupedOrders[currentOrderNo]) {
              groupedOrders[currentOrderNo] = {
                headerRow: row,
                items: []
              };
            }

            const articleName = getRowValue(row, ['Article', 'article', 'Désignation', 'Designation']) || 'Prestation';
            const description = getRowValue(row, ['Description', 'description']) || '';
            const qty = Number(getRowValue(row, ['Quantity', 'quantity', 'Quantité', 'Qty']) || 1);
            const uPrice = Number(getRowValue(row, ['Unit Price', 'UnitPrice', 'Prix Unitaire']) || 0);
            const total = Number(getRowValue(row, ['Total', 'total']) || qty * uPrice);

            groupedOrders[currentOrderNo].items.push({
              articleName: String(articleName),
              description: String(description),
              quantity: qty,
              unitPrice: uPrice,
              total: total
            });
          });

          const itemsToProcess = Object.keys(groupedOrders).map(orderNo => {
            const orderData = groupedOrders[orderNo];
            const row = orderData.headerRow;

            const compName = getRowValue(row, ['Company', 'company', 'Societe']) || '';
            const vendName = getRowValue(row, ['Vendor Name', 'Vendor', 'vendor', 'Fournisseur']) || '';
            const calcSubtotal = orderData.items.reduce((sum, item) => sum + item.total, 0);
            const vat = Number(getRowValue(row, ['Tax', 'TVA']) || 0);
            const laborCost = Number(getRowValue(row, ['Labor Cost', 'Main d oeuvre']) || 0);
            const netTotal = Number(getRowValue(row, ['Net Total', 'Total']) || (calcSubtotal + vat + laborCost));

            const excelDateVal = getRowValue(row, ['Request Date', 'Date']);
            let parsedDate = new Date();
            if (excelDateVal) {
              if (excelDateVal instanceof Date) {
                parsedDate = excelDateVal;
              } else if (typeof excelDateVal === 'number') {
                parsedDate = new Date(Math.round((excelDateVal - 25569) * 86400 * 1000));
              } else {
                const tempDate = new Date(excelDateVal);
                if (!isNaN(tempDate.getTime())) parsedDate = tempDate;
              }
            }

            return {
              requestNo: orderNo,
              requestDate: parsedDate,
              companyName: String(compName).trim(),
              vendorName: String(vendName).trim(),
              quoteNumber: String(getRowValue(row, ['Quote Number', 'Devis']) || ''),
              paymentTerms: String(getRowValue(row, ['Payment Terms', 'Paiement']) || '30 jours'),
              currency: 'GNF',
              subtotal: Number(getRowValue(row, ['Subtotal', 'Sous total']) || calcSubtotal),
              tax: vat,
              labourCost: laborCost,
              total: netTotal,
              status: String(getRowValue(row, ['Status', 'Statut']) || 'APPROVED'),
              requestedById: currentUser?.id || 1,
              items: orderData.items
            };
          });

          const res = await fetch(`${API_URL}/api/bulk-import/purchase-requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToProcess })
          });
          const data = await res.json();
          if (res.ok) {
            importedCount = data.createdCount || 0;
          }
        }

        let message = '';
        if (importedCount > 0 && updatedCount > 0) {
          message = `${importedCount} nouvel(s) élément(s) créé(s) et ${updatedCount} existant(s) mis à jour.`;
        } else if (importedCount > 0) {
          message = `${importedCount} nouvel(s) élément(s) importé(s) avec succès.`;
        } else if (updatedCount > 0) {
          message = `${updatedCount} élément(s) existant(s) mis à jour avec les nouvelles données.`;
        }

        if (importedCount === 0 && updatedCount === 0) {
          message = 'Aucune colonne valide trouvée dans le fichier Excel. Vérifiez que la 1ère ligne contient les entêtes.';
          setNotification({ type: 'error', text: message });
          setIsLoading(false);
        } else {
          setNotification({ type: 'success', text: message });
          await fetchAllData();
        }
      } catch (err) {
        console.error('Erreur import Excel:', err);
        setNotification({ type: 'error', text: 'Erreur lors du traitement du fichier Excel.' });
        setIsLoading(false);
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="admin-layout">
      {/* HIDDEN FILE INPUT FOR EXCEL IMPORT */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls"
        style={{ display: 'none' }}
      />

      {/* HEADER BAR */}
      <header className="admin-header">
        <div className="admin-brand">
          <img src={maerskLogo} alt="Maersk Logo" className="admin-logo" />
          <div>
            <h2>MAERSK | Administration DB & Excel Sync</h2>
            <span className="admin-subtitle">Importation & Exportation des Bases de Données</span>
          </div>
        </div>

        <div className="admin-header-actions">
          {onSwitchToForm && (
            <button className="switch-view-btn" onClick={onSwitchToForm}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>Créateur de Bons de Commande</span>
            </button>
          )}

          <div className="admin-user-profile">
            <span className="admin-role-badge">ADMINISTRATEUR</span>
            <span className="admin-user-name">{currentUser?.firstName} {currentUser?.lastName}</span>
            <button className="logout-btn" onClick={onLogout} title="Déconnexion">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* NOTIFICATION */}
      {notification && (
        <div className={`admin-notif ${notification.type}`}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* EXCEL NAVBAR MATCHING USER DESIGN (DATABASE | COMPANIES | VENDORS | ARTICLES) */}
      <div className="excel-nav-bar">
        <button
          className={`excel-nav-btn ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => setActiveTab('database')}
        >
          DATABASE
        </button>
        <span className="excel-nav-divider">|</span>
        <button
          className={`excel-nav-btn ${activeTab === 'companies' ? 'active' : ''}`}
          onClick={() => setActiveTab('companies')}
        >
          COMPANIES
        </button>
        <span className="excel-nav-divider">|</span>
        <button
          className={`excel-nav-btn ${activeTab === 'vendors' ? 'active' : ''}`}
          onClick={() => setActiveTab('vendors')}
        >
          VENDORS
        </button>
        <span className="excel-nav-divider">|</span>
        <button
          className={`excel-nav-btn ${activeTab === 'articles' ? 'active' : ''}`}
          onClick={() => setActiveTab('articles')}
        >
          ARTICLES
        </button>
        <span className="excel-nav-divider">|</span>
        <button
          className={`excel-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          UTILISATEURS & ROLES
        </button>
      </div>

      {/* MAIN CONTAINER */}
      <main className="admin-main">

        {/* LOADING ANIMATION SPINNER */}
        {isLoading ? (
          <div className="admin-loading-container">
            <div className="maersk-spinner"></div>
            <span className="admin-loading-text">Chargement des données en cours...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: DATABASE (Img 2 format) */}
            {activeTab === 'database' && (() => {
              const filteredPOs = purchaseOrders.filter(po => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                const reqNo = (po.requestNo || '').toLowerCase();
                const compName = (po.company?.name || '').toLowerCase();
                const vendName = (po.vendor?.name || '').toLowerCase();
                const vendSector = (po.vendor?.sector || '').toLowerCase();
                const quote = (po.quoteNumber || '').toLowerCase();
                const itemsMatch = po.items && po.items.some(item =>
                  (item.articleName || '').toLowerCase().includes(term) ||
                  (item.description || '').toLowerCase().includes(term)
                );
                return reqNo.includes(term) || compName.includes(term) || vendName.includes(term) || vendSector.includes(term) || quote.includes(term) || itemsMatch;
              });

              return (
                <div className="admin-tab-content">
                  <div className="admin-card">
                    <div className="admin-card-header flex-between flex-wrap" style={{ gap: '16px' }}>
                      <div>
                        <h4>DATABASE (Global Purchase Orders & Invoices Header)</h4>
                        <span className="subtext">
                          {searchTerm.trim() ? `${filteredPOs.length} résultat(s) sur ${purchaseOrders.length} bons` : `${purchaseOrders.length} bons de commande enregistrés`}
                        </span>
                      </div>

                      {/* SEARCH INPUT BAR */}
                      <div className="admin-search-wrapper" style={{ flex: '1', maxWidth: '380px', minWidth: '240px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                          <input
                            type="text"
                            placeholder="Rechercher (N° commande, Fournisseur, Société, Article...)"
                            value={searchTerm}
                            onChange={(e) => {
                              setSearchTerm(e.target.value);
                              setCurrentPage(1);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 32px 8px 36px',
                              borderRadius: '6px',
                              border: '1px solid #94a3b8',
                              fontSize: '0.85rem',
                              color: '#0f172a',
                              outline: 'none',
                              transition: 'border-color 0.2s',
                              background: '#ffffff'
                            }}
                          />
                          {searchTerm && (
                            <button
                              onClick={() => {
                                setSearchTerm('');
                                setCurrentPage(1);
                              }}
                              style={{
                                position: 'absolute',
                                right: '10px',
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                padding: 0
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="btn-group">
                        <button className="excel-import-btn" onClick={() => triggerImport('database')}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                          Importer XLSX
                        </button>
                        <button className="excel-export-btn" onClick={() => handleExportExcel('database')}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                          Exporter DATABASE (.xlsx)
                        </button>
                        {onSwitchToForm && (
                          <button className="admin-submit-btn inline-create-btn" onClick={onSwitchToForm}>
                            + Créer un Bon Manuellement
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="table-responsive excel-table-container">
                      <table className="excel-styled-table">
                        <thead>
                          <tr className="excel-header-row">
                            <th style={{ width: '45px', textAlign: 'center' }}>N°</th>
                            <th>Order No.</th>
                            <th>Request Date</th>
                            <th>Company</th>
                            <th>Vendor Name</th>
                            <th>Sector</th>
                            <th>Quote Number</th>
                            <th>Payment Terms</th>
                            <th>Delivery Date</th>
                            <th>Article</th>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                            <th>Subtotal</th>
                            <th>Tax</th>
                            <th>Labor Cost</th>
                            <th>Net Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPOs.length === 0 ? (
                            <tr>
                              <td colSpan="18" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                Aucun bon de commande ne correspond à votre recherche "{searchTerm}".
                              </td>
                            </tr>
                          ) : (
                            filteredPOs
                              .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                              .map((po, poIdx) => {
                                const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + poIdx + 1;
                                return (
                                  <React.Fragment key={po.id}>
                                    {po.items && po.items.length > 0 ? (
                                      po.items.map((item, idx) => (
                                        <tr key={item.id || idx}>
                                          {idx === 0 ? (
                                            <>
                                              <td rowSpan={po.items.length} style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>
                                                {globalIndex}
                                              </td>
                                              <td rowSpan={po.items.length}><strong>{po.requestNo}</strong></td>
                                              <td rowSpan={po.items.length}>{new Date(po.requestDate).toLocaleDateString()}</td>
                                              <td rowSpan={po.items.length}>{po.company?.name || '-'}</td>
                                              <td rowSpan={po.items.length}>{po.vendor?.name || '-'}</td>
                                              <td rowSpan={po.items.length}>{po.vendor?.sector || '-'}</td>
                                              <td rowSpan={po.items.length}>{po.quoteNumber || '-'}</td>
                                              <td rowSpan={po.items.length}>{po.paymentTerms || '-'}</td>
                                              <td rowSpan={po.items.length}>{po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString() : '-'}</td>
                                            </>
                                          ) : null}
                                          <td>{item.articleName}</td>
                                          <td>{item.description}</td>
                                          <td>{item.quantity}</td>
                                          <td>{Number(item.unitPrice).toLocaleString()} GNF</td>
                                          <td>{Number(item.total).toLocaleString()} GNF</td>
                                          {idx === 0 ? (
                                            <>
                                              <td rowSpan={po.items.length}>{Number(po.subtotal).toLocaleString()} GNF</td>
                                              <td rowSpan={po.items.length}>{Number(po.vat).toLocaleString()} GNF</td>
                                              <td rowSpan={po.items.length}>{Number(po.laborCost).toLocaleString()} GNF</td>
                                              <td rowSpan={po.items.length}><strong>{Number(po.total).toLocaleString()} {po.currency}</strong></td>
                                            </>
                                          ) : null}
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{globalIndex}</td>
                                        <td><strong>{po.requestNo}</strong></td>
                                        <td>{new Date(po.requestDate).toLocaleDateString()}</td>
                                        <td>{po.company?.name || '-'}</td>
                                        <td>{po.vendor?.name || '-'}</td>
                                        <td>{po.vendor?.sector || '-'}</td>
                                        <td>{po.quoteNumber || '-'}</td>
                                        <td>{po.paymentTerms || '-'}</td>
                                        <td>{po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString() : '-'}</td>
                                        <td colSpan="5" className="text-center-muted">Aucun article enregistré</td>
                                        <td>{Number(po.subtotal).toLocaleString()} GNF</td>
                                        <td>{Number(po.vat).toLocaleString()} GNF</td>
                                        <td>{Number(po.laborCost).toLocaleString()} GNF</td>
                                        <td><strong>{Number(po.total).toLocaleString()} {po.currency}</strong></td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* PAGINATION CONTROLS */}
                    {filteredPOs.length > ITEMS_PER_PAGE && (
                      <div className="pagination-controls">
                        <span className="pagination-info">
                          Affichage de {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredPOs.length)} à {Math.min(currentPage * ITEMS_PER_PAGE, filteredPOs.length)} sur {filteredPOs.length} éléments
                        </span>
                        <div className="pagination-btns">
                          <button
                            className="page-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          >
                            ‹ Précédent
                          </button>
                          {Array.from({ length: Math.ceil(filteredPOs.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              className={`page-btn ${currentPage === page ? 'active' : ''}`}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            className="page-btn"
                            disabled={currentPage === Math.ceil(filteredPOs.length / ITEMS_PER_PAGE)}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredPOs.length / ITEMS_PER_PAGE)))}
                          >
                            Suivant ›
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB 2: COMPANIES */}
            {activeTab === 'companies' && (() => {
              const filteredCompanies = companies.filter(c => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return (
                  (c.name || '').toLowerCase().includes(term) ||
                  (c.address || '').toLowerCase().includes(term) ||
                  (c.contact || '').toLowerCase().includes(term) ||
                  (c.telephone || '').toLowerCase().includes(term) ||
                  (c.service || '').toLowerCase().includes(term)
                );
              });

              return (
                <div className="admin-tab-content">
                  <div className="admin-grid-split">
                    {/* Form Create Company */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h4>{editCompanyId ? 'Modifier la Compagnie' : 'Ajouter une Compagnie'}</h4>
                      </div>
                      <form onSubmit={handleSubmitCompany} className="admin-form">
                        <div className="form-group">
                          <label>Company</label>
                          <input
                            type="text"
                            placeholder="Ex: Maersk Guinea SA"
                            value={newCompany.name}
                            onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Address</label>
                          <input
                            type="text"
                            placeholder="Ex: Almamya, Kaloum, Conakry"
                            value={newCompany.address}
                            onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Contact</label>
                          <input
                            type="text"
                            placeholder="Nom du responsable"
                            value={newCompany.contact}
                            onChange={(e) => setNewCompany({ ...newCompany, contact: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Telephone</label>
                          <input
                            type="text"
                            placeholder="+224 ..."
                            value={newCompany.telephone}
                            onChange={(e) => setNewCompany({ ...newCompany, telephone: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Service</label>
                          <input
                            type="text"
                            placeholder="Ex: Logistics & Operations"
                            value={newCompany.service}
                            onChange={(e) => setNewCompany({ ...newCompany, service: e.target.value })}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="submit" className="admin-submit-btn" style={{ flex: 1 }}>
                            {editCompanyId ? 'Mettre à jour' : 'Ajouter la Compagnie'}
                          </button>
                          {editCompanyId && (
                            <button type="button" className="admin-submit-btn" style={{ flex: 1, background: '#64748b' }} onClick={() => {
                              setEditCompanyId(null);
                              setNewCompany({ name: '', address: '', contact: '', telephone: '', service: '' });
                            }}>
                              Annuler
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* Companies Excel Table */}
                    <div className="admin-card">
                      <div className="admin-card-header flex-between flex-wrap" style={{ gap: '12px' }}>
                        <div>
                          <h4>COMPANIES ({searchTerm.trim() ? `${filteredCompanies.length}/${companies.length}` : companies.length})</h4>
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '180px' }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                          <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            style={{ width: '100%', padding: '6px 28px 6px 30px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.82rem', color: '#0f172a', outline: 'none', background: '#ffffff' }}
                          />
                          {searchTerm && (
                            <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>×</button>
                          )}
                        </div>
                        <div className="btn-group">
                          <button className="excel-import-btn" onClick={() => triggerImport('companies')}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            Importer XLSX
                          </button>
                          <button className="excel-export-btn" onClick={() => handleExportExcel('companies')}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Exporter XLSX
                          </button>
                        </div>
                      </div>
                      <div className="table-responsive excel-table-container">
                        <table className="excel-styled-table">
                          <thead>
                            <tr className="excel-header-row-blue">
                              <th style={{ width: '45px', textAlign: 'center' }}>N°</th>
                              <th>Company ▼</th>
                              <th>Address ▼</th>
                              <th>Contact ▼</th>
                              <th>Telephone ▼</th>
                              <th>Service ▼</th>
                              <th>logo ▼</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCompanies.length === 0 ? (
                              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Aucune compagnie trouvée</td></tr>
                            ) : (
                              filteredCompanies
                                .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                                .map((c, idx) => {
                                  const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                                  return (
                                    <tr 
                                      key={c.id} 
                                      onClick={() => {
                                        setEditCompanyId(c.id);
                                        setNewCompany({ name: c.name || '', address: c.address || '', contact: c.contact || '', telephone: c.telephone || '', service: c.service || '' });
                                        // Scroll to top left
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                      style={{ cursor: 'pointer', background: editCompanyId === c.id ? '#e0f2fe' : '' }}
                                    >
                                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{globalIndex}</td>
                                      <td><strong>{c.name}</strong></td>
                                      <td>{c.address || '-'}</td>
                                      <td>{c.contact || '-'}</td>
                                      <td>{c.telephone || '-'}</td>
                                      <td>{c.service || '-'}</td>
                                      <td>{c.logo || 'maersk_logo.png'}</td>
                                    </tr>
                                  );
                                })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* PAGINATION CONTROLS */}
                      {filteredCompanies.length > ITEMS_PER_PAGE && (
                        <div className="pagination-controls">
                          <span className="pagination-info">
                            Affichage de {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredCompanies.length)} à {Math.min(currentPage * ITEMS_PER_PAGE, filteredCompanies.length)} sur {filteredCompanies.length} éléments
                          </span>
                          <div className="pagination-btns">
                            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>‹ Précédent</button>
                            {Array.from({ length: Math.ceil(filteredCompanies.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                              <button key={page} className={`page-btn ${currentPage === page ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                            ))}
                            <button className="page-btn" disabled={currentPage === Math.ceil(filteredCompanies.length / ITEMS_PER_PAGE)} onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredCompanies.length / ITEMS_PER_PAGE)))}>Suivant ›</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB 3: VENDORS */}
            {activeTab === 'vendors' && (() => {
              const filteredVendors = vendors.filter(v => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return (
                  (v.name || '').toLowerCase().includes(term) ||
                  (v.address || '').toLowerCase().includes(term) ||
                  (v.contactPerson || '').toLowerCase().includes(term) ||
                  (v.telephone || '').toLowerCase().includes(term) ||
                  (v.email || '').toLowerCase().includes(term) ||
                  (v.sector || '').toLowerCase().includes(term)
                );
              });

              return (
                <div className="admin-tab-content">
                  <div className="admin-grid-split">
                    {/* Form Create Vendor */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h4>{editVendorId ? 'Modifier le Fournisseur' : 'Ajouter un Fournisseur'}</h4>
                      </div>
                      <form onSubmit={handleSubmitVendor} className="admin-form">
                        <div className="form-group">
                          <label>Vendor</label>
                          <input
                            type="text"
                            placeholder="Ex: TotalEnergies Guinee"
                            value={newVendor.name}
                            onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Address</label>
                          <input
                            type="text"
                            placeholder="Ex: BP 120 Conakry"
                            value={newVendor.address}
                            onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Contact Person</label>
                          <input
                            type="text"
                            placeholder="Ex: M. Camara"
                            value={newVendor.contactPerson}
                            onChange={(e) => setNewVendor({ ...newVendor, contactPerson: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Telephone</label>
                          <input
                            type="text"
                            placeholder="+224 ..."
                            value={newVendor.telephone}
                            onChange={(e) => setNewVendor({ ...newVendor, telephone: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Email</label>
                          <input
                            type="email"
                            placeholder="contact@vendor.com"
                            value={newVendor.email}
                            onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Sector</label>
                          <input
                            type="text"
                            placeholder="Ex: Carburant & Énergie"
                            value={newVendor.sector}
                            onChange={(e) => setNewVendor({ ...newVendor, sector: e.target.value })}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="submit" className="admin-submit-btn" style={{ flex: 1 }}>
                            {editVendorId ? 'Mettre à jour' : 'Ajouter le Fournisseur'}
                          </button>
                          {editVendorId && (
                            <button type="button" className="admin-submit-btn" style={{ flex: 1, background: '#64748b' }} onClick={() => {
                              setEditVendorId(null);
                              setNewVendor({ name: '', address: '', contactPerson: '', telephone: '', email: '', sector: '' });
                            }}>
                              Annuler
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* Vendors Excel Table */}
                    <div className="admin-card">
                      <div className="admin-card-header flex-between flex-wrap" style={{ gap: '12px' }}>
                        <div>
                          <h4>VENDORS ({searchTerm.trim() ? `${filteredVendors.length}/${vendors.length}` : vendors.length})</h4>
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '180px' }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                          <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            style={{ width: '100%', padding: '6px 28px 6px 30px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.82rem', color: '#0f172a', outline: 'none', background: '#ffffff' }}
                          />
                          {searchTerm && (
                            <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>×</button>
                          )}
                        </div>
                        <div className="btn-group">
                          <button className="excel-import-btn" onClick={() => triggerImport('vendors')}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            Importer XLSX
                          </button>
                          <button className="excel-export-btn" onClick={() => handleExportExcel('vendors')}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Exporter XLSX
                          </button>
                        </div>
                      </div>
                      <div className="table-responsive excel-table-container">
                        <table className="excel-styled-table">
                          <thead>
                            <tr className="excel-header-row-dark">
                              <th style={{ width: '45px', textAlign: 'center' }}>N°</th>
                              <th>Vendor ▼</th>
                              <th>Address ▼</th>
                              <th>Contact Person ▼</th>
                              <th>Telephone ▼</th>
                              <th>Email ▼</th>
                              <th>Sector ▼</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredVendors.length === 0 ? (
                              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Aucun fournisseur trouvé</td></tr>
                            ) : (
                              filteredVendors
                                .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                                .map((v, idx) => {
                                  const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                                  return (
                                    <tr 
                                      key={v.id}
                                      onClick={() => {
                                        setEditVendorId(v.id);
                                        setNewVendor({ name: v.name || '', address: v.address || '', contactPerson: v.contactPerson || '', telephone: v.telephone || '', email: v.email || '', sector: v.sector || '' });
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                      style={{ cursor: 'pointer', background: editVendorId === v.id ? '#e0f2fe' : '' }}
                                    >
                                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{globalIndex}</td>
                                      <td><strong>{v.name}</strong></td>
                                      <td>{v.address || '-'}</td>
                                      <td>{v.contactPerson || '-'}</td>
                                      <td>{v.telephone || '-'}</td>
                                      <td>{v.email || '-'}</td>
                                      <td>{v.sector || '-'}</td>
                                    </tr>
                                  );
                                })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* PAGINATION CONTROLS */}
                      {filteredVendors.length > ITEMS_PER_PAGE && (
                        <div className="pagination-controls">
                          <span className="pagination-info">
                            Affichage de {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredVendors.length)} à {Math.min(currentPage * ITEMS_PER_PAGE, filteredVendors.length)} sur {filteredVendors.length} éléments
                          </span>
                          <div className="pagination-btns">
                            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>‹ Précédent</button>
                            {Array.from({ length: Math.ceil(filteredVendors.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                              <button key={page} className={`page-btn ${currentPage === page ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                            ))}
                            <button className="page-btn" disabled={currentPage === Math.ceil(filteredVendors.length / ITEMS_PER_PAGE)} onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredVendors.length / ITEMS_PER_PAGE)))}>Suivant ›</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB 4: ARTICLES */}
            {activeTab === 'articles' && (() => {
              const filteredArticles = articles.filter(a => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return (
                  (a.name || '').toLowerCase().includes(term) ||
                  (a.description || '').toLowerCase().includes(term) ||
                  String(a.unitPrice || '').includes(term)
                );
              });

              return (
                <div className="admin-tab-content">
                  <div className="admin-grid-split">
                    {/* Form Create Article */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h4>{editArticleId ? 'Modifier l\'Article' : 'Ajouter un Article'}</h4>
                      </div>
                      <form onSubmit={handleSubmitArticle} className="admin-form">
                        <div className="form-group">
                          <label>Article</label>
                          <input
                            type="text"
                            placeholder="Ex: Frais de Manutention Conteneur"
                            value={newArticle.name}
                            onChange={(e) => setNewArticle({ ...newArticle, name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Description</label>
                          <textarea
                            rows="3"
                            placeholder="Description détaillée de la prestation..."
                            value={newArticle.description}
                            onChange={(e) => setNewArticle({ ...newArticle, description: e.target.value })}
                          ></textarea>
                        </div>

                        <div className="form-group">
                          <label>Unit Price (GNF)</label>
                          <input
                            type="number"
                            placeholder="Ex: 250000"
                            value={newArticle.unitPrice}
                            onChange={(e) => setNewArticle({ ...newArticle, unitPrice: e.target.value })}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="submit" className="admin-submit-btn" style={{ flex: 1 }}>
                            {editArticleId ? 'Mettre à jour' : 'Enregistrer l\'Article'}
                          </button>
                          {editArticleId && (
                            <button type="button" className="admin-submit-btn" style={{ flex: 1, background: '#64748b' }} onClick={() => {
                              setEditArticleId(null);
                              setNewArticle({ name: '', description: '', unitPrice: '' });
                            }}>
                              Annuler
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* Articles Excel Table */}
                    <div className="admin-card">
                      <div className="admin-card-header flex-between flex-wrap" style={{ gap: '12px' }}>
                        <div>
                          <h4>ARTICLES ({searchTerm.trim() ? `${filteredArticles.length}/${articles.length}` : articles.length})</h4>
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '180px' }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                          <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            style={{ width: '100%', padding: '6px 28px 6px 30px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.82rem', color: '#0f172a', outline: 'none', background: '#ffffff' }}
                          />
                          {searchTerm && (
                            <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>×</button>
                          )}
                        </div>
                        <div className="btn-group">
                          <button className="excel-import-btn" onClick={() => triggerImport('articles')}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            Importer XLSX
                          </button>
                          <button className="excel-export-btn" onClick={() => handleExportExcel('articles')}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Exporter XLSX
                          </button>
                        </div>
                      </div>
                      <div className="table-responsive excel-table-container">
                        <table className="excel-styled-table">
                          <thead>
                            <tr className="excel-header-row-blue">
                              <th style={{ width: '45px', textAlign: 'center' }}>N°</th>
                              <th>Article ▼</th>
                              <th>Description ▼</th>
                              <th>Unit Price ▼</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredArticles.length === 0 ? (
                              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Aucun article trouvé</td></tr>
                            ) : (
                              filteredArticles
                                .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                                .map((a, idx) => {
                                  const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                                  return (
                                    <tr 
                                      key={a.id}
                                      onClick={() => {
                                        setEditArticleId(a.id);
                                        setNewArticle({ name: a.name || '', description: a.description || '', unitPrice: a.unitPrice || '' });
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                      style={{ cursor: 'pointer', background: editArticleId === a.id ? '#e0f2fe' : '' }}
                                    >
                                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{globalIndex}</td>
                                      <td><strong>{a.name}</strong></td>
                                      <td>{a.description || '-'}</td>
                                      <td><strong>{Number(a.unitPrice).toLocaleString()} GNF</strong></td>
                                    </tr>
                                  );
                                })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* PAGINATION CONTROLS */}
                      {filteredArticles.length > ITEMS_PER_PAGE && (
                        <div className="pagination-controls">
                          <span className="pagination-info">
                            Affichage de {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredArticles.length)} à {Math.min(currentPage * ITEMS_PER_PAGE, filteredArticles.length)} sur {filteredArticles.length} éléments
                          </span>
                          <div className="pagination-btns">
                            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>‹ Précédent</button>
                            {Array.from({ length: Math.ceil(filteredArticles.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                              <button key={page} className={`page-btn ${currentPage === page ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                            ))}
                            <button className="page-btn" disabled={currentPage === Math.ceil(filteredArticles.length / ITEMS_PER_PAGE)} onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredArticles.length / ITEMS_PER_PAGE)))}>Suivant ›</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB 5: USERS & ROLES */}
            {activeTab === 'users' && (
              <div className="admin-tab-content">
                <div className="admin-grid-split">
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h4>Créer un nouvel utilisateur</h4>
                    </div>
                    <form onSubmit={handleCreateUser} className="admin-form">
                      <div className="form-group">
                        <label>Prénom</label>
                        <input
                          type="text"
                          value={newUser.firstName}
                          onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Nom</label>
                        <input
                          type="text"
                          value={newUser.lastName}
                          onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Adresse Email / Identifiant</label>
                        <input
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Mot de Passe</label>
                        <input
                          type="password"
                          placeholder="Définir un mot de passe"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Rôle attribué</label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        >
                          <option value="ACCOUNTANT">ACCOUNTANT (Comptable / Saisisseur)</option>
                          <option value="APPROVER">APPROVER (Valideur / Approbateur)</option>
                          <option value="ADMIN">ADMIN (Administrateur)</option>
                        </select>
                      </div>

                      <button type="submit" className="admin-submit-btn">
                        Créer l'utilisateur
                      </button>
                    </form>
                  </div>

                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h4>Liste des utilisateurs enregistrés ({users.length})</h4>
                    </div>
                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th style={{ width: '45px', textAlign: 'center' }}>N°</th>
                            <th>Nom & Prénom</th>
                            <th>Email</th>
                            <th>Rôle</th>
                            <th>Statut</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u, idx) => (
                            <tr key={u.id}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{idx + 1}</td>
                              <td><strong>{u.firstName} {u.lastName}</strong></td>
                              <td><code>{u.email}</code></td>
                              <td>
                                <select
                                  value={u.role}
                                  onChange={(e) => handleUpdateUserStatus(u.id, { role: e.target.value })}
                                  className="role-select"
                                >
                                  <option value="ACCOUNTANT">ACCOUNTANT</option>
                                  <option value="APPROVER">APPROVER</option>
                                  <option value="ADMIN">ADMIN</option>
                                </select>
                              </td>
                              <td>
                                <span className={`status-badge ${u.isActive ? 'active' : 'inactive'}`}>
                                  {u.isActive ? 'Actif' : 'Désactivé'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    className="toggle-status-btn"
                                    onClick={() => handleUpdateUserStatus(u.id, { isActive: !u.isActive })}
                                  >
                                    {u.isActive ? 'Désactiver' : 'Activer'}
                                  </button>
                                  <button
                                    className="toggle-status-btn"
                                    style={{ backgroundColor: '#f59e0b' }}
                                    onClick={() => handleResetPassword(u.id, u.email)}
                                  >
                                    Réinitialiser MDP
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL RESET PASSWORD */}
      {resetPasswordModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem' }}>Réinitialiser le mot de passe</h3>
            <p style={{ margin: '0 0 16px 0' }}>Entrez le nouveau mot de passe pour <strong>{resetPasswordModal.userEmail}</strong> :</p>
            <input 
              type="password" 
              value={resetPasswordModal.newPassword}
              onChange={(e) => setResetPasswordModal({ ...resetPasswordModal, newPassword: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '24px', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setResetPasswordModal({ isOpen: false, userId: null, userEmail: '', newPassword: '' })} 
                style={{ padding: '8px 16px', borderRadius: '6px', background: 'none', border: '1px solid #94a3b8', cursor: 'pointer', color: '#334155' }}>
                Annuler
              </button>
              <button 
                onClick={submitResetPassword} 
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#00243d', color: 'white', border: 'none', cursor: 'pointer' }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
