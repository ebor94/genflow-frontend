/**
 * src/api/axios.js
 * Clientes HTTP autenticados para GenFlow.
 *   - apiClient (default): base /api/sv  → endpoints del CRM
 *   - apiRoot:             base /api     → endpoints fuera de /sv (p.ej. afiliaciones)
 * Ambos comparten la MISMA sesión (sv_access_token) y la lógica de refresh transparente,
 * de modo que un único login sirve para todo el ecosistema.
 *
 * Interceptores:
 *   - Request: agrega Bearer token desde localStorage (sv_access_token)
 *   - Response: en 401 intenta refresh transparente; si falla, limpia storage y redirige a login
 */
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api/sv';
// Raíz del API (sin el sufijo /sv): p.ej. https://host:8444/api/sv → https://host:8444/api
export const API_ROOT = BASE.replace(/\/sv\/?$/, '') || '/api';

function getAccessToken()  { return localStorage.getItem('sv_access_token'); }
function getRefreshToken() { return localStorage.getItem('sv_refresh_token'); }

function clearSession() {
  localStorage.removeItem('sv_access_token');
  localStorage.removeItem('sv_refresh_token');
  localStorage.removeItem('sv_user');
  localStorage.removeItem('sv_area_activa');
}

// Variable compartida para evitar múltiples refresh simultáneos entre instancias
let refreshing = null;

/**
 * Aplica a una instancia axios los interceptores de auth + refresh transparente.
 */
function attachInterceptors(instance) {
  instance.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      const status   = error.response?.status;
      const url      = original?.url || '';

      // Si es 401 y el request NO es de auth, intentar refresh una sola vez
      if (status === 401 && !url.includes('/auth/') && !original._retried) {
        original._retried = true;
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          clearSession();
          if (!location.pathname.endsWith('/login')) location.href = '/genflow/login';
          return Promise.reject(error);
        }
        try {
          if (!refreshing) {
            // Refresh por SSO de identidad (los tokens de sesión son de identidad).
            refreshing = axios.post(`${API_ROOT}/identidad/refresh`, { refreshToken })
              .finally(() => { refreshing = null; });
          }
          const r = await refreshing;
          const newAccess = r.data?.data?.accessToken;
          if (newAccess) {
            localStorage.setItem('sv_access_token', newAccess);
            original.headers.Authorization = `Bearer ${newAccess}`;
            return instance(original);
          }
        } catch (e) {
          clearSession();
          if (!location.pathname.endsWith('/login')) location.href = '/genflow/login';
        }
      }

      return Promise.reject(error);
    }
  );
  return instance;
}

const apiClient = attachInterceptors(axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
}));

// Cliente raíz /api — mismo token y refresh, distinta baseURL (afiliaciones, etc.)
export const apiRoot = attachInterceptors(axios.create({
  baseURL: API_ROOT,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
}));

export default apiClient;
