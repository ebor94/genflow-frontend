import api from './axios';

export const gestionesApi = {
  create:      (data) => api.post('/gestiones', data).then(r => r.data),
  historial:   (prospId, params = {}) => api.get('/gestiones', { params: { prosp_id: prospId, ...params } }).then(r => r.data),
  resumenDia:  (params = {}) => api.get('/gestiones/resumen-dia', { params }).then(r => r.data)
};
