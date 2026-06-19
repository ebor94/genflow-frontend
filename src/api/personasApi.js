import api from './axios';

export const personasApi = {
  // Busca por teléfono. Si encuentra, devuelve { persona, prospectos_activos: [] }
  buscar: (telefono) => api.get('/personas/buscar', { params: { telefono } }).then(r => r.data),
  get:    (id) => api.get(`/personas/${id}`).then(r => r.data),
  prospectosActivos: (id) => api.get(`/personas/${id}/prospectos-activos`).then(r => r.data),
  historialCompleto: (id) => api.get(`/personas/${id}/historial-completo`).then(r => r.data),
  create: (data) => api.post('/personas', data).then(r => r.data),
  update: (id, data) => api.put(`/personas/${id}`, data).then(r => r.data)
};
