import api from './axios';

export const ventasApi = {
  deProspecto: (prospId)   => api.get(`/prospectos/${prospId}/ventas`).then(r => r.data),
  corregir:    (id, datos) => api.put(`/ventas/${id}`, datos).then(r => r.data),
  anular:      (id, datos) => api.post(`/ventas/${id}/anular`, datos).then(r => r.data)
};
