import api from './axios';

/**
 * Endpoints del módulo tracking GPS (Fase 7) bajo /api/sv/tracking.
 */
export const trackingApi = {
  // Jornadas propias
  iniciarJornada:   (payload = {}) => api.post('/tracking/jornadas', payload).then(r => r.data),
  finalizarJornada: (jornadaId, payload = {}) => api.patch(`/tracking/jornadas/${jornadaId}/finalizar`, payload).then(r => r.data),
  batchPuntos:      (jornadaId, puntos) => api.post(`/tracking/jornadas/${jornadaId}/puntos`, { puntos }).then(r => r.data),
  listarJornadas:   (params = {}) => api.get('/tracking/jornadas', { params }).then(r => r.data),

  // Recorridos
  recorrido:        (usrId, fecha) => api.get(`/tracking/recorrido/${usrId}`, { params: { fecha } }).then(r => r.data),
  liveEquipo:       (params = {}) => api.get('/tracking/equipo/live', { params }).then(r => r.data),

  // Habeas Data
  aceptarConsentimiento: () => api.post('/tracking/me/consentimiento').then(r => r.data),
  exportarMisDatos:      (desde, hasta) =>
    api.get('/tracking/me/exportar', { params: { desde, hasta }, responseType: 'blob' }).then(r => r.data)
};
