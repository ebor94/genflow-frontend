import api from './axios';

export const buscadorApi = {
  buscar: (q, limit = 5) => api.get('/buscar', { params: { q, limit } }).then(r => r.data)
};
