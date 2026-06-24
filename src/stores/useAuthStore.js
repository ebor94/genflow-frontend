/**
 * useAuthStore — sesión GenFlow (JWT propio, refresh, área activa).
 * Persiste en localStorage con prefijo sv_*.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/authApi';

const KEYS = {
  ACCESS:  'sv_access_token',
  REFRESH: 'sv_refresh_token',
  USER:    'sv_user',
  AREA:    'sv_area_activa'
};

export const useAuthStore = defineStore('svAuth', () => {
  const accessToken  = ref(localStorage.getItem(KEYS.ACCESS)  || null);
  const refreshToken = ref(localStorage.getItem(KEYS.REFRESH) || null);
  const usuario      = ref(JSON.parse(localStorage.getItem(KEYS.USER) || 'null'));
  const areaActivaId = ref(parseInt(localStorage.getItem(KEYS.AREA)) || null);

  const isAuthenticated = computed(() => !!accessToken.value && !!usuario.value);
  const nombreCompleto  = computed(() => usuario.value ? `${usuario.value.usr_nombre} ${usuario.value.usr_apellido}` : '');
  const iniciales       = computed(() => usuario.value
    ? `${(usuario.value.usr_nombre || '').charAt(0)}${(usuario.value.usr_apellido || '').charAt(0)}`.toUpperCase()
    : '');
  const rolCodigo       = computed(() => usuario.value?.rol?.rol_codigo || null);
  const rolNivel        = computed(() => usuario.value?.rol?.rol_nivel ?? 99);
  const esSuperAdmin    = computed(() => rolCodigo.value === 'SUPER_ADMIN');
  const esAdminArea     = computed(() => rolCodigo.value === 'ADMIN_AREA');
  const esSupervisor    = computed(() => rolCodigo.value === 'SUPERVISOR');
  const esJefePap       = computed(() => rolCodigo.value === 'JEFE_PAP');
  const esGerente       = computed(() => rolCodigo.value === 'GERENTE_GENERAL');
  const esDirector      = computed(() => rolCodigo.value === 'DIRECTOR_COMERCIAL');
  const esCoordinador   = computed(() => rolCodigo.value === 'COORDINADOR_PREVISION');
  // Roles autorizados a reasignar prospectos individualmente desde las fichas
  const puedeReasignar  = computed(() =>
    ['SUPER_ADMIN','GERENTE_GENERAL','DIRECTOR_COMERCIAL',
     'ADMIN_AREA','JEFE_PAP','SUPERVISOR','COORDINADOR_PREVISION'].includes(rolCodigo.value)
  );

  // Áreas accesibles: combina principal + areas_extra (viene del backend en /auth/me y login)
  const areasAccesibles = computed(() => usuario.value?.areas_accesibles || []);
  const esMultiArea     = computed(() => areasAccesibles.value.length > 1);

  // El área "actual" (la del areaActivaId). Si no hay, toma la principal del usuario.
  const areaActual = computed(() => {
    const id = areaActivaId.value;
    if (id) return areasAccesibles.value.find(a => a.area_id === id) || null;
    return areasAccesibles.value.find(a => a.principal) || usuario.value?.area || null;
  });

  function tieneAccesoArea(codigo) {
    if (esSuperAdmin.value) return true;
    return areasAccesibles.value.some(a => a.area_codigo === codigo);
  }

  function hasPermiso(modulo, accion) {
    if (esSuperAdmin.value) return true;
    const perms = usuario.value?.rol?.rol_permisos;
    const parsed = typeof perms === 'string' ? JSON.parse(perms) : perms;
    const arr = parsed?.[modulo];
    return Array.isArray(arr) && arr.includes(accion);
  }

  // Mapeo área_codigo → ruta default de esa área (paneles funcionales)
  const RUTA_AREA = {
    'PRENEC':   { name: 'prenec-panel' },
    'PREV-EMP': { name: 'emp-panel' },
    'PREV-PAP': { name: 'pap-panel' },
    'SVC':      { name: 'svc-panel' }         // Fase 4 funcional (call center)
  };

  function rutaInicio() {
    if (!isAuthenticated.value) return { name: 'login' };
    // Roles multi-área van al selector para que elijan dónde trabajar.
    if (esSuperAdmin.value || esAdminArea.value || esGerente.value || esDirector.value) {
      return { name: 'selector' };
    }
    // Coordinador de Previsión es jefe de Empresariales: panel del área.
    if (esCoordinador.value) return { name: 'emp-panel' };
    // JEFE_PAP → dashboard supervisor PAP (panel de equipo)
    if (esJefePap.value)                         return { name: 'pap-supervisor' };
    if (rolCodigo.value === 'AGENTE_SVC')        return { name: 'placeholder-svc' };
    // Agente de Fidelización Empresas (grupo FIDELIZACION) → panel fideliz
    const grupoCod = usuario.value?.grupo?.grupo_codigo;
    if (grupoCod === 'FIDELIZACION')             return { name: 'fideliz-panel' };
    // Si tiene >1 área accesible, ir al selector para que elija
    if (esMultiArea.value) return { name: 'selector' };
    const area = usuario.value?.area?.area_codigo;
    return RUTA_AREA[area] || { name: 'mi-perfil' };
  }

  function rutaArea(codigo) {
    return RUTA_AREA[codigo] || { name: 'mi-perfil' };
  }

  function persist() {
    if (accessToken.value)  localStorage.setItem(KEYS.ACCESS,  accessToken.value);  else localStorage.removeItem(KEYS.ACCESS);
    if (refreshToken.value) localStorage.setItem(KEYS.REFRESH, refreshToken.value); else localStorage.removeItem(KEYS.REFRESH);
    if (usuario.value)      localStorage.setItem(KEYS.USER,    JSON.stringify(usuario.value)); else localStorage.removeItem(KEYS.USER);
    if (areaActivaId.value) localStorage.setItem(KEYS.AREA,    String(areaActivaId.value)); else localStorage.removeItem(KEYS.AREA);
  }

  async function login(email, password) {
    const res = await authApi.login({ email, password });
    accessToken.value  = res.data.accessToken;
    refreshToken.value = res.data.refreshToken;
    usuario.value      = res.data.user;
    // Por defecto el área activa = la del usuario (o null si SUPER_ADMIN)
    areaActivaId.value = res.data.user?.usr_area_id || null;
    persist();
    return res.data;
  }

  async function logout() {
    // Finalizar jornada de tracking antes de cerrar sesión (import dinámico para evitar ciclo)
    try {
      const { useTrackingStore } = await import('@/stores/useTrackingStore');
      const tracking = useTrackingStore();
      if (tracking.estaActiva) await tracking.finalizar();
      else tracking.reset();
    } catch { /* silencioso */ }
    try { if (refreshToken.value) await authApi.logout(refreshToken.value); } catch {}
    accessToken.value  = null;
    refreshToken.value = null;
    usuario.value      = null;
    areaActivaId.value = null;
    persist();
  }

  async function fetchMe() {
    try {
      const r = await authApi.me();
      usuario.value = r.data;
      persist();
      return r.data;
    } catch (e) {
      await logout();
      throw e;
    }
  }

  function setAreaActiva(areaId) {
    areaActivaId.value = parseInt(areaId);
    persist();
  }

  function restore() {
    // No-op; los valores ya se cargaron desde localStorage al inicializar refs.
  }

  return {
    accessToken, refreshToken, usuario, areaActivaId,
    isAuthenticated, nombreCompleto, iniciales, rolCodigo, rolNivel,
    esSuperAdmin, esAdminArea, esSupervisor, esJefePap, esGerente, esDirector, esCoordinador, puedeReasignar,
    areasAccesibles, esMultiArea, areaActual,
    tieneAccesoArea, hasPermiso, rutaInicio, rutaArea,
    login, logout, fetchMe, setAreaActiva, restore
  };
});
