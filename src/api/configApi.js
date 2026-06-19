import api from './axios';

function crud(resource) {
  return {
    list:   ()        => api.get(`/config/${resource}`).then(r => r.data),
    create: (data)    => api.post(`/config/${resource}`, data).then(r => r.data),
    update: (id, data)=> api.put(`/config/${resource}/${id}`, data).then(r => r.data),
    toggle: (id)      => api.patch(`/config/${resource}/${id}/toggle`).then(r => r.data)
  };
}

export const configApi = {
  bootstrap: (areaId) => api.get('/config/bootstrap', { params: { area_id: areaId } }).then(r => r.data),
  areas:      crud('areas'),
  grupos:     crud('grupos'),
  productos:  crud('productos'),
  estados:    crud('estados'),
  resultados: crud('resultados'),
  fuentes:    crud('fuentes'),
  puntos:     crud('puntos')
};
