/**
 * api/agendaApi.js
 * Agenda unificada del asesor + CRUD eventos.
 * Migración 018: creación básica de eventos.
 * Migración 020 (SP-1a): multi-asesor + pool público.
 */
import api from './axios';

export const agendaApi = {
  // Listado del día (gestiones próximas + eventos)
  dia: ({ fecha, asesorId = null }) =>
    api.get('/agenda/dia', { params: { fecha, asesor_id: asesorId || undefined } }).then(r => r.data),

  // Agregado por día para colorear el calendario
  mes: ({ anio, mes, asesorId = null }) =>
    api.get('/agenda/mes', { params: { anio, mes, asesor_id: asesorId || undefined } }).then(r => r.data)
};

export const eventosAgendaApi = {
  get:              (id)                 => api.get(`/eventos-agenda/${id}`).then(r => r.data),
  create:           (data)               => api.post('/eventos-agenda', data).then(r => r.data),
  update:           (id, data)           => api.put(`/eventos-agenda/${id}`, data).then(r => r.data),
  marcarCompletado: (id, completado)     => api.patch(`/eventos-agenda/${id}/completado`, { completado }).then(r => r.data),
  remove:           (id)                 => api.delete(`/eventos-agenda/${id}`).then(r => r.data),

  // SP-1a · Pool + métricas + resumen
  pool:               (id, params = {})            => api.get(`/eventos-agenda/${id}/pool`, { params }).then(r => r.data),
  asignarPool:        (id, poolId, payload)        => api.post(`/eventos-agenda/${id}/pool/${poolId}/asignar`, payload).then(r => r.data),
  metricasAsistente:  (evaId, payload)             => api.patch(`/eventos-agenda/asistentes/${evaId}/metricas`, payload).then(r => r.data),
  resumen:            (id)                          => api.get(`/eventos-agenda/${id}/resumen`).then(r => r.data)
};

// SP-1a · Endpoints públicos (sin auth). Usan la misma instancia axios;
// los interceptors de auth deben skipear si no hay token en localStorage.
export const publicEventosApi = {
  landing:   (hash)          => api.get(`/public/eventos/${hash}`).then(r => r.data),
  registrar: (hash, payload) => api.post(`/public/eventos/${hash}/registro`, payload).then(r => r.data)
};
