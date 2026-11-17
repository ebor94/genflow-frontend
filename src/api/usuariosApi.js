import api from './axios';

export const usuariosApi = {
  list  : (params = {}) => api.get('/usuarios', { params }).then(r => r.data),
  accesibles: () => api.get('/usuarios/accesibles').then(r => r.data),
  directorio: (q) => api.get('/usuarios/directorio', { params: { q } }).then(r => r.data),
  get   : (id) => api.get(`/usuarios/${id}`).then(r => r.data),
  create: (data) => api.post('/usuarios', data).then(r => r.data),
  update: (id, data) => api.put(`/usuarios/${id}`, data).then(r => r.data),
  toggle: (id) => api.patch(`/usuarios/${id}/toggle`).then(r => r.data)
};
