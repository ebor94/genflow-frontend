/**
 * src/api/axios.js
 * Cliente HTTP autenticado para GenFlow (/api/sv).
 * Interceptores:
 *   - Request: agrega Bearer token desde localStorage (sv_access_token)
 *   - Response: en 401 intenta refresh transparente; si falla, limpia storage y redirige a login
 */
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api/sv';

const apiClient = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

function getAccessToken()  { return localStorage.getItem('sv_access_token'); }
function getRefreshToken() { return localStorage.getItem('sv_refresh_token'); }

function clearSession() {
  localStorage.removeItem('sv_access_token');
  localStorage.removeItem('sv_refresh_token');
  localStorage.removeItem('sv_user');
  localStorage.removeItem('sv_area_activa');
}

// Request interceptor
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Variables para evitar múltiples refresh simultáneos
let refreshing = null;

apiClient.interceptors.response.use(
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
          refreshing = axios.post(`${BASE}/auth/refresh`, { refreshToken })
            .finally(() => { refreshing = null; });
        }
        const r = await refreshing;
        const newAccess = r.data?.data?.accessToken;
        if (newAccess) {
          localStorage.setItem('sv_access_token', newAccess);
          original.headers.Authorization = `Bearer ${newAccess}`;
          return apiClient(original);
        }
      } catch (e) {
        clearSession();
        if (!location.pathname.endsWith('/login')) location.href = '/genflow/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
