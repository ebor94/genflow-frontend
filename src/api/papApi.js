import api from './axios';

export const papApi = {
  registroRapido: (data) => api.post('/pap/registro-rapido', data).then(r => r.data),
  zonas:    (params = {}) => api.get('/pap/zonas',    { params }).then(r => r.data),
  mapa:     (params = {}) => api.get('/pap/mapa',     { params }).then(r => r.data),
  metricas: (params = {}) => api.get('/pap/metricas', { params }).then(r => r.data)
};
