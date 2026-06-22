/**
 * api/agendaApi.js
 * Agenda unificada del asesor + CRUD eventos (migración 018).
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
  get:           (id)       => api.get(`/eventos-agenda/${id}`).then(r => r.data),
  create:        (data)     => api.post('/eventos-agenda', data).then(r => r.data),
  update:        (id, data) => api.put(`/eventos-agenda/${id}`, data).then(r => r.data),
  marcarCompletado: (id, completado) =>
    api.patch(`/eventos-agenda/${id}/completado`, { completado }).then(r => r.data),
  remove:        (id)       => api.delete(`/eventos-agenda/${id}`).then(r => r.data)
};
