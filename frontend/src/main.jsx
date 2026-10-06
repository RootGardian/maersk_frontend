import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  const token = localStorage.getItem('maersk_token');
  if (token) {
    if (!config) config = {};
    if (!config.headers) config.headers = {};
    if (config.headers instanceof Headers) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = { ...config.headers, 'Authorization': `Bearer ${token}` };
    }
  }
  
  const response = await originalFetch(resource, config);
  
  // Gestion automatique des tokens expirés ou invalides (401 / 403)
  const url = typeof resource === 'string' ? resource : resource.url;
  if ((response.status === 401 || response.status === 403) && url && !url.includes('/api/auth/login')) {
    localStorage.removeItem('maersk_token');
    localStorage.removeItem('maersk_user');
    // On recharge la page pour revenir à l'écran de connexion
    window.location.reload();
  }
  
  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
