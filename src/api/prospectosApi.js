import api from './axios';

export const prospectosApi = {
  list:       (params = {}) => api.get('/prospectos', { params }).then(r => r.data),
  panelDia:   (params = {}) => api.get('/prospectos/panel-dia', { params }).then(r => r.data),
  agendaMes:  (anio, mes)   => api.get('/prospectos/agenda-mes', { params: { anio, mes } }).then(r => r.data),
  get:        (id) => api.get(`/prospectos/${id}`).then(r => r.data),
  create:     (data) => api.post('/prospectos', data).then(r => r.data),
  update:     (id, data) => api.put(`/prospectos/${id}`, data).then(r => r.data),
  actualizarProductos: (id, productos) => api.put(`/prospectos/${id}/productos`, { productos }).then(r => r.data),
  reasignar:  (id, nuevoAsesorId, motivo = '') => api.patch(`/prospectos/${id}/reasignar`, { nuevo_asesor_id: nuevoAsesorId, motivo }).then(r => r.data),
  // Recuperación auto: cola de prospectos sin asesor (para supervisor)
  sinAsignar:      (params = {}) => api.get('/prospectos/sin-asignar', { params }).then(r => r.data),
  sinAsignarCount: (areaId) => api.get('/prospectos/sin-asignar/count', { params: { area_id: areaId } }).then(r => r.data),
  asignar:         (id, asesorId) => api.patch(`/prospectos/${id}/asignar`, { asesor_id: asesorId }).then(r => r.data),
  // Reasignación masiva (vacaciones / retiro / incapacidad)
  porAsesor:           (params = {}) => api.get('/prospectos/por-asesor', { params }).then(r => r.data),
  reasignacionMasiva:  (payload) => api.post('/prospectos/reasignacion-masiva', payload).then(r => r.data)
};
