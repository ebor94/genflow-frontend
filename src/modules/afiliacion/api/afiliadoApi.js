import apiClient from './axios'
import publicApiClient from './publicAxios'

// ── Afiliados ─────────────────────────────────────────────────
export const createAfiliadoVeolia = (payload) => {
  if (payload instanceof FormData) {
    return publicApiClient.post('/afiliados/veolia', payload, {
      headers: { 'Content-Type': undefined }
    })
  }
  return publicApiClient.post('/afiliados/veolia', payload)
}

export const createAfiliado = (payload) => {
  // Si el payload es FormData (viene con archivo adjunto), dejar que el
  // navegador establezca automáticamente el Content-Type multipart/form-data
  // (con el boundary correcto) eliminando el header JSON por defecto.
  if (payload instanceof FormData) {
    return apiClient.post('/afiliados', payload, {
      headers: { 'Content-Type': undefined }
    })
  }
  return apiClient.post('/afiliados', payload)
}
export const getAfiliados = () => apiClient.get('/afiliados')
export const getAfiliado = (id) => apiClient.get(`/afiliados/${id}`)
export const getAfiliadosPendientes    = ()             => apiClient.get('/afiliados/pendientes')
export const getAfiliacionesRechazadas = ()             => apiClient.get('/afiliados/rechazados')
// Afiliaciones del asesor en un día/rango, sin filtrar por estado
// params: { fecha: 'YYYY-MM-DD' } o { fechaDesde, fechaHasta }
export const getMisAfiliacionesDelDia  = (params = {})  => apiClient.get('/afiliados/mis-del-dia', { params })
export const aprobarAfiliado           = (id)           => apiClient.post(`/afiliados/${id}/aprobar`)
export const rechazarAfiliado          = (id, motivo)   => apiClient.post(`/afiliados/${id}/rechazar`, { motivo })
export const reenviarAfiliacion              = (id, payload)  => apiClient.put(`/afiliados/${id}/reenviar`, payload)
export const rechazarBeneficiariosAfiliado   = (id, payload)  => apiClient.post(`/afiliados/${id}/rechazar-parcial`, payload)
export const consultarAfiliado               = (numerodocumento) => publicApiClient.get(`/afiliados/consulta/${numerodocumento}`)
export const actualizarBeneficiariosConsulta = (id, beneficiarios) => publicApiClient.put(`/afiliados/${id}/actualizar-beneficiarios`, { beneficiarios })

// ── OTP Consulta pública ──────────────────────────────────────
export const solicitarOtpPublico       = (doc)       => publicApiClient.post('/afiliados/consulta/solicitar-otp', { numeroDocumento: doc })
export const verificarOtpPublico       = (doc, otp)  => publicApiClient.post('/afiliados/consulta/verificar-otp', { numeroDocumento: doc, otp })
export const actualizarContactoPublico = (id, datos) => publicApiClient.put(`/afiliados/${id}/datos-contacto`, datos)

// ── OTP Reenvío ───────────────────────────────────────────────
export const solicitarOtpReenvio = (id) => publicApiClient.post(`/afiliados/${id}/solicitar-otp-reenvio`)

// ── Corrección pública via hash ───────────────────────────────
export const getAfiliadoPorHash = (hash) => publicApiClient.get(`/afiliados/por-hash/${hash}`)
export const reenviarAfiliacionPublico = (id, payload) => {
  if (payload instanceof FormData) {
    return publicApiClient.put(`/afiliados/${id}/reenviar`, payload, {
      headers: { 'Content-Type': undefined }
    })
  }
  return publicApiClient.put(`/afiliados/${id}/reenviar`, payload)
}

// ── Trazabilidad ──────────────────────────────────────────────
export const getTrazabilidadAfiliado = (id) => apiClient.get(`/afiliados/${id}/trazabilidad`)

// ── Veolia — unidades de negocio ─────────────────────────────
export const getVeoliaUnidades = () => publicApiClient.get('/afiliados/veolia-unidades')

// ── Empresas ──────────────────────────────────────────────────
export const buscarEmpresaPorNit = (nit) => apiClient.get(`/empresas/${nit}`)
export const crearEmpresa = (payload) => apiClient.post('/empresas', payload)
export const listarEmpresas = (q = '') => apiClient.get('/empresas', { params: { q } })

// ── Tarifas ───────────────────────────────────────────────────
export const listarTarifas = () => apiClient.get('/tarifas')
export const buscarTarifa = (params) => apiClient.get('/tarifas/buscar', { params })
export const listarPrimasSeguro = (seguro) =>
  apiClient.get('/tarifas/primas', { params: seguro ? { seguro } : {} })

// ── Legalización ─────────────────────────────────────────────
/**
 * Marca un lote de afiliaciones como legalizadas con un número de planilla.
 * @param {number[]} afiliadoIds
 * @param {string}   numeroPlanilla
 */
export const legalizarAfiliaciones = (afiliadoIds, numeroPlanilla) =>
  apiClient.post('/afiliados/legalizar', { afiliadoIds, numeroPlanilla })

/**
 * Descarga el PDF de liquidación con los totales agregados de las afiliaciones
 * seleccionadas. Solo se aceptan APROBADAS (estadoRegistro=1, sin rechazo).
 * @param {number[]} afiliadoIds
 * @returns {Promise<AxiosResponse<Blob>>}
 */
export const descargarLiquidacionPdf = (afiliadoIds) =>
  apiClient.post('/afiliados/liquidacion-pdf', { afiliadoIds }, { responseType: 'blob' })

/**
 * Búsqueda interna usada en el formulario de registro: si el cliente quiere
 * un segundo contrato, el asesor consulta su documento y precarga los datos
 * personales. Devuelve { data: null } cuando no hay coincidencias (no es error).
 */
export const buscarAfiliadoPorDocumento = (numeroDocumento) =>
  apiClient.get(`/afiliados/buscar/${encodeURIComponent(numeroDocumento)}`)

// ── Borradores ────────────────────────────────────────────────
// Las pre-afiliaciones (borradores) ahora suben archivos opcionales como multipart.
// Si llega FormData se usa Content-Type undefined para que Axios ponga el boundary correcto.
export const crearBorrador = (payload) => {
  if (payload instanceof FormData) {
    return apiClient.post('/afiliados/borradores', payload, { headers: { 'Content-Type': undefined } })
  }
  return apiClient.post('/afiliados/borradores', payload)
}
export const actualizarBorrador = (id, payload) => {
  if (payload instanceof FormData) {
    return apiClient.put(`/afiliados/borradores/${id}`, payload, { headers: { 'Content-Type': undefined } })
  }
  return apiClient.put(`/afiliados/borradores/${id}`, payload)
}
export const listarBorradores   = ()             => apiClient.get('/afiliados/borradores')
export const getBorrador        = (id)           => apiClient.get(`/afiliados/borradores/${id}`)
export const eliminarBorrador   = (id)           => apiClient.delete(`/afiliados/borradores/${id}`)

export const descargarPlanoExcel = (afiliadoId) =>
  apiClient.get(`/afiliados/${afiliadoId}/plano-excel`, { responseType: 'blob' })
