import api from './axios';

export const propuestasApi = {
  list:    (params = {}) => api.get('/propuestas', { params }).then(r => r.data),
  get:     (id)  => api.get(`/propuestas/${id}`).then(r => r.data),
  create:  (data) => api.post('/propuestas', data).then(r => r.data),
  update:  (id, data) => api.put(`/propuestas/${id}`, data).then(r => r.data),
  generarPdf: (id) => api.post(`/propuestas/${id}/generar-pdf`).then(r => r.data),
  enviar:  (id, data) => api.post(`/propuestas/${id}/enviar`, data).then(r => r.data),
  eliminar:(id) => api.delete(`/propuestas/${id}`).then(r => r.data),
  previewUrl: (id) => `${import.meta.env.VITE_API_URL || '/api/sv'}/propuestas/${id}/preview`
};
