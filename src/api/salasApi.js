import api from './axios';

export const salasApi = {
  listar:          ()            => api.get('/salas/homenajes').then(r => r.data),
  obtener:         (id)          => api.get(`/salas/homenajes/${id}`).then(r => r.data),
  atender:         (id, datos = {}) => api.post(`/salas/homenajes/${id}/atender`, datos).then(r => r.data),
  registrarVisita: (id, payload) => api.post(`/salas/homenajes/${id}/visitas`, payload).then(r => r.data)
};
