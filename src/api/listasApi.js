import api from './axios';

export const listasApi = {
  list: (params = {}) => api.get('/listas', { params }).then(r => r.data),
  cargar: (formData) => api.post('/listas/cargar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data),
  prospectos: (id, params = {}) => api.get(`/listas/${id}/prospectos`, { params }).then(r => r.data)
};
