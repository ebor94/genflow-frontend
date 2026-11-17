import axios from 'axios';
import api, { API_ROOT } from './axios';

export const authApi = {
  // Login unificado por SSO de identidad contra el directorio activo: el token
  // sirve para CRM (/api/sv) y afiliación (/api/afiliados, /api/recibos).
  // Body: { usuario, password } (usuario de red o correo).
  login    : (payload) => axios.post(`${API_ROOT}/identidad/login`, payload).then(r => r.data),
  refresh  : (refreshToken) => axios.post(`${API_ROOT}/identidad/refresh`, { refreshToken }).then(r => r.data),
  logout   : (refreshToken) => axios.post(`${API_ROOT}/identidad/logout`, { refreshToken }).then(r => r.data).catch(() => null),
  me       : () => api.get('/auth/me').then(r => r.data),
  updatePreferencias: (payload) => api.patch('/auth/me/preferencias', payload).then(r => r.data)
};
