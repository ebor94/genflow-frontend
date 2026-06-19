import api from './axios';
import publicApi from './publicAxios';

export const authApi = {
  login    : (payload) => publicApi.post('/auth/login', payload).then(r => r.data),
  refresh  : (refreshToken) => publicApi.post('/auth/refresh', { refreshToken }).then(r => r.data),
  logout   : (refreshToken) => api.post('/auth/logout', { refreshToken }).then(r => r.data).catch(() => null),
  me       : () => api.get('/auth/me').then(r => r.data),
  changePassword: (payload) => api.patch('/auth/me/password', payload).then(r => r.data),
  updatePreferencias: (payload) => api.patch('/auth/me/preferencias', payload).then(r => r.data)
};
