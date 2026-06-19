import api from './axios';

export const empresasApi = {
  list:    (params = {}) => api.get('/empresas', { params }).then(r => r.data),
  buscar:  (nit) => api.get('/empresas/buscar', { params: { nit } }).then(r => r.data),
  get:     (id)  => api.get(`/empresas/${id}`).then(r => r.data),
  create:  (data) => api.post('/empresas', data).then(r => r.data),
  update:  (id, data) => api.put(`/empresas/${id}`, data).then(r => r.data),

  // ─── Supervisor / Admin ───
  reasignarAsesor:     (id, nuevoAsesorId, motivo = '') =>
                          api.post(`/empresas/${id}/reasignar-asesor`, { nuevo_asesor_id: nuevoAsesorId, motivo }).then(r => r.data),
  actualizarCategoria: (id, categoria) =>
                          api.patch(`/empresas/${id}/categoria`, { categoria }).then(r => r.data),
  ajustarPresupuesto:  (id, payload) =>
                          api.post(`/empresas/${id}/presupuesto/ajustar`, payload).then(r => r.data),
  movimientos:         (id, params = {}) =>
                          api.get(`/empresas/${id}/presupuesto/movimientos`, { params }).then(r => r.data),

  // ─── Documentos ───
  listarDocumentos:    (id) => api.get(`/empresas/${id}/documentos`).then(r => r.data),
  subirDocumento:      (id, formData) => api.post(`/empresas/${id}/documentos`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        }).then(r => r.data),
  eliminarDocumento:   (docId) => api.delete(`/empresas/documentos/${docId}`).then(r => r.data),

  // ─── Propuestas archivo (reemplaza generación PDF) ───
  listarPropuestasArchivo: (id) => api.get(`/empresas/${id}/propuestas-archivo`).then(r => r.data),
  subirPropuestaArchivo:   (id, formData) => api.post(`/empresas/${id}/propuestas-archivo`, formData, {
                              headers: { 'Content-Type': 'multipart/form-data' }
                            }).then(r => r.data),
  eliminarPropuestaArchivo:(propId) => api.delete(`/empresas/propuestas-archivo/${propId}`).then(r => r.data),

  // ─── Catálogo de tipos de documento (admin) ───
  listarTipos:         (todos = false) => api.get('/empresas/tipos-documento', { params: todos ? { todos: 1 } : {} }).then(r => r.data),
  crearTipo:           (data) => api.post('/empresas/tipos-documento', data).then(r => r.data),
  actualizarTipo:      (tipoId, data) => api.put(`/empresas/tipos-documento/${tipoId}`, data).then(r => r.data),
  eliminarTipo:        (tipoId) => api.delete(`/empresas/tipos-documento/${tipoId}`).then(r => r.data)
};
