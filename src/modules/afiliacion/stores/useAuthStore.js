import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi } from '@afi/api/authApi'

const TOKEN_KEY = 'auth_token'
const USER_KEY  = 'auth_user'

export const useAuthStore = defineStore('auth', () => {
  const token   = ref(localStorage.getItem(TOKEN_KEY) || null)
  const usuario = ref(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))

  const isAuthenticated = computed(() => !!token.value)

  const nombreCompleto = computed(() =>
    usuario.value ? `${usuario.value.nombre} ${usuario.value.apellido}` : ''
  )

  const rol = computed(() => usuario.value?.rol?.nombre ?? '')

  /**
   * Verifica si el usuario tiene un permiso específico.
   * Los super admins siempre tienen acceso.
   * @param {string} modulo - Módulo (ej: 'afiliaciones')
   * @param {string} accion - Acción (ej: 'crear', 'aprobar', 'ver_todas')
   * @returns {boolean}
   */
  function hasPermiso(modulo, accion) {
    if (!usuario.value) return false
    if (usuario.value.es_super_admin) return true
    const raw = usuario.value.rol?.permisos
    const permisos = typeof raw === 'string' ? JSON.parse(raw) : (raw || {})
    return permisos[modulo]?.[accion] === true
  }

  /**
   * Retorna la ruta de inicio según el rol del usuario
   */
  function rutaInicio() {
    if (!usuario.value) return { name: 'login' }
    if (usuario.value.es_super_admin) return { name: 'aprobaciones' }
    const raw = usuario.value.rol?.permisos
    const permisos = typeof raw === 'string' ? JSON.parse(raw) : (raw || {})
    const pCaja = permisos.caja || {}
    const pAfi  = permisos.afiliaciones || {}
    // CAJERO o CARTERA: si no tiene permisos de afiliaciones, va directo al cuadre
    const aprobadorCaja = pCaja.aprobar_efectivo || pCaja.aprobar_bancarios
    if (aprobadorCaja && !pAfi.crear && !pAfi.aprobar) return { name: 'cuadreCaja' }
    if (pAfi.ver_todas || pAfi.aprobar || pAfi.rechazar) return { name: 'aprobaciones' }
    if (pAfi.crear || pAfi.ver_propias)               return { name: 'registro' }
    return { name: 'registro' }
  }

  async function login(email, password) {
    const { data } = await loginApi({ email, password })
    token.value   = data.data.token
    usuario.value = data.data.usuario
    localStorage.setItem(TOKEN_KEY, token.value)
    localStorage.setItem(USER_KEY, JSON.stringify(usuario.value))
  }

  function logout() {
    token.value   = null
    usuario.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return {
    token,
    usuario,
    isAuthenticated,
    nombreCompleto,
    rol,
    hasPermiso,
    rutaInicio,
    login,
    logout
  }
})
