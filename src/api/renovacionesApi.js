import api from './axios';

export const renovacionesApi = {
  marcarConvenio: (prospId, fechaInicio, fechaVencimiento = null) =>
    api.patch(`/renovaciones/prospectos/${prospId}/marcar-convenio`, {
      fecha_inicio: fechaInicio,
      fecha_vencimiento: fechaVencimiento
    }).then(r => r.data),
  proximas:  (dias = 30) => api.get('/renovaciones/proximas', { params: { dias } }).then(r => r.data),
  vencidos:  ()          => api.get('/renovaciones/vencidos').then(r => r.data)
};
