import api from './axios';

/**
 * Wrapper de los endpoints /api/sv/fidelizacion (Fase 6).
 * Para upload de evidencia usar el método especial `subirEvidencia`.
 */
export const fidelizacionApi = {
  // Empresas con fidelización + historial por empresa
  listEmpresasConFideliz: () =>
    api.get('/fidelizacion/empresas').then(r => r.data),
  historialEmpresa: (empresaId) =>
    api.get(`/fidelizacion/empresas/${empresaId}/envios`).then(r => r.data),

  // Listado global de contactos (todos)
  listTodosContactos: (q = null) =>
    api.get('/fidelizacion/contactos', { params: q ? { q } : {} }).then(r => r.data),

  // Contactos por empresa
  listContactosEmpresa: (empresaId) =>
    api.get(`/fidelizacion/empresas/${empresaId}/contactos`).then(r => r.data),
  crearContacto: (empresaId, data) =>
    api.post(`/fidelizacion/empresas/${empresaId}/contactos`, data).then(r => r.data),
  getContacto: (cfId) =>
    api.get(`/fidelizacion/contactos/${cfId}`).then(r => r.data),
  actualizarContacto: (cfId, data) =>
    api.put(`/fidelizacion/contactos/${cfId}`, data).then(r => r.data),
  eliminarContacto: (cfId) =>
    api.delete(`/fidelizacion/contactos/${cfId}`).then(r => r.data),

  // Fechas especiales
  agregarFecha: (cfId, data) =>
    api.post(`/fidelizacion/contactos/${cfId}/fechas`, data).then(r => r.data),
  eliminarFecha: (feId) =>
    api.delete(`/fidelizacion/fechas/${feId}`).then(r => r.data),

  // Próximos cumples / calendario
  proximosCumples: (dias = 3) =>
    api.get('/fidelizacion/proximos-cumples', { params: { dias } }).then(r => r.data),
  calendario: (anio, mes) =>
    api.get('/fidelizacion/calendario', { params: { anio, mes } }).then(r => r.data),

  // Envíos
  listEnvios: (personaId) =>
    api.get('/fidelizacion/envios', { params: { persona_id: personaId } }).then(r => r.data),
  registrarEnvio: (data) =>
    api.post('/fidelizacion/envios', data).then(r => r.data),
  actualizarEnvio: (envId, data) =>
    api.patch(`/fidelizacion/envios/${envId}`, data).then(r => r.data),
  subirEvidencia: (envId, file) => {
    const fd = new FormData();
    fd.append('foto', file);
    return api.post(`/fidelizacion/envios/${envId}/evidencia`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data);
  },

  // Métricas
  metricas: (params = {}) =>
    api.get('/fidelizacion/metricas', { params }).then(r => r.data)
};
