import apiClient from './axios'

// ── Asesor: mis recibos ──────────────────────────────────────
/**
 * @param {object} params { fecha?: 'YYYY-MM-DD', fechaDesde?, fechaHasta? }
 */
export const getMisRecibos = (params = {}) =>
  apiClient.get('/recibos/mios', { params })

// ── Asesor: posfechados pendientes de cobro ──────────────────
export const getPosfechadosPendientes = (params = {}) =>
  apiClient.get('/recibos/posfechados-pendientes', { params })

// ── Asesor: marcar posfechado como cobrado ───────────────────
export const cobrarPosfechado = (afiliadoId, payload) =>
  apiClient.post(`/recibos/cobrar-posfechado/${afiliadoId}`, payload)

// ── Cajero: lista para cuadre ────────────────────────────────
/**
 * @param {object} params { fecha?, fechaDesde?, fechaHasta?, asesorId?, estado? }
 */
export const getCuadreCaja = (params = {}) =>
  apiClient.get('/recibos/cuadre', { params })

// ── Lista de asesores con prefijo (para selector del cuadre) ─
export const getAsesoresConPrefijo = () =>
  apiClient.get('/recibos/asesores')

// ── Cajero: aprobar recibos seleccionados ────────────────────
export const aprobarRecibos = (reciboIds, observacion = null) =>
  apiClient.post('/recibos/aprobar', { reciboIds, observacion })

// ── Detalle y PDF de un recibo ───────────────────────────────
export const getReciboById = (id) => apiClient.get(`/recibos/${id}`)

/**
 * Construye la URL pública absoluta del PDF a partir de la ruta relativa
 * almacenada en recibo.pdfUrl (ej: '/uploads/recibos/MP-000001.pdf').
 * Retorna null si el PDF aún no se ha generado.
 */
export const getReciboPdfUrl = (recibo) => {
  if (!recibo?.pdfUrl) return null
  const base = import.meta.env.VITE_API_URL || '/api'
  const root = base.replace(/\/api\/?$/, '')
  return `${root}${recibo.pdfUrl}`
}
// Descarga vía endpoint autenticado (fallback con auth si el estático no es accesible)
export const descargarReciboPdf = (id) =>
  apiClient.get(`/recibos/${id}/pdf`, { responseType: 'blob' })

// Reenvío manual del PDF por WhatsApp (útil si el automático falló)
export const reenviarWhatsappRecibo = (id) =>
  apiClient.post(`/recibos/${id}/reenviar-whatsapp`)
