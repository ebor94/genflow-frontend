/**
 * Router GenFlow CRM
 * Base path: /genflow/ (vite.config.js base)
 * Guards: requireAuth, nivelMinimo, areaCoincide
 */
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConfigStore } from '@/stores/useConfigStore';

const routes = [
  // Auth
  { path: '/login', name: 'login', component: () => import('@/views/auth/Login.vue'),
    meta: { publica: true } },

  // Inicio / Selector área
  { path: '/', redirect: () => {
      const auth = useAuthStore();
      return auth.isAuthenticated ? auth.rutaInicio() : { name: 'login' };
    }
  },
  { path: '/selector', name: 'selector', component: () => import('@/views/selector/SelectorArea.vue'),
    meta: { requiereAuth: true, nivelMaximo: 4 } },

  // Perfil
  { path: '/perfil', name: 'mi-perfil', component: () => import('@/views/perfil/MiPerfil.vue'),
    meta: { requiereAuth: true } },

  // Admin (SUPER_ADMIN, ADMIN_AREA)
  { path: '/admin',                name: 'admin',             component: () => import('@/views/admin/AdminPanel.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },
  { path: '/admin/areas',          name: 'admin-areas',       component: () => import('@/views/admin/GestionAreas.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },
  { path: '/admin/grupos',         name: 'admin-grupos',      component: () => import('@/views/admin/GestionGrupos.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },
  { path: '/admin/productos',      name: 'admin-productos',   component: () => import('@/views/admin/GestionProductos.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },
  { path: '/admin/pipeline',       name: 'admin-pipeline',    component: () => import('@/views/admin/GestionPipeline.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },
  { path: '/admin/resultados',     name: 'admin-resultados',  component: () => import('@/views/admin/GestionResultados.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },
  { path: '/admin/fuentes',        name: 'admin-fuentes',     component: () => import('@/views/admin/GestionFuentes.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },
  { path: '/admin/puntos',         name: 'admin-puntos',      component: () => import('@/views/admin/GestionPuntos.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },
  { path: '/admin/usuarios',       name: 'admin-usuarios',    component: () => import('@/views/admin/GestionUsuarios.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },
  { path: '/admin/tipos-documento', name: 'admin-tipos-documento', component: () => import('@/views/admin/GestionTiposDocumento.vue'),
    meta: { requiereAuth: true, nivelMaximo: 2 } },

  // ─── Prenecesidad (Fase 1) ───
  { path: '/prenec',             name: 'placeholder-prenec', redirect: { name: 'prenec-panel' } },
  { path: '/prenec/panel-dia',   name: 'prenec-panel',     component: () => import('@/views/prenecesidad/PanelDia.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },
  { path: '/prenec/clientes',    name: 'prenec-clientes',  component: () => import('@/views/prenecesidad/MisClientes.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },
  { path: '/prenec/cliente/:id', name: 'prenec-ficha',     component: () => import('@/views/prenecesidad/FichaCliente.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },
  { path: '/prenec/nuevo',       name: 'prenec-nuevo',     component: () => import('@/views/prenecesidad/NuevoCliente.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },
  { path: '/prenec/agenda',      name: 'prenec-agenda',    component: () => import('@/views/prenecesidad/AgendaInteligente.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },
  { path: '/prenec/metricas',    name: 'prenec-metricas',  component: () => import('@/views/prenecesidad/MisMetricas.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },
  { path: '/prenec/supervisor',  name: 'prenec-supervisor',component: () => import('@/views/prenecesidad/PanelSupervisor.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC', nivelMaximo: 3 } },
  { path: '/prenec/llamada/:id', name: 'prenec-llamada',   component: () => import('@/views/prenecesidad/EnLlamada.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },

  // ─── Empresariales B2B (Fase 2) ───
  { path: '/emp',              name: 'placeholder-emp',  redirect: { name: 'emp-panel' } },
  { path: '/emp/panel',        name: 'emp-panel',        component: () => import('@/views/empresariales/PanelEmpresas.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/emp/nueva',        name: 'emp-nueva',        component: () => import('@/views/empresariales/NuevaEmpresaView.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/emp/empresa/:id',  name: 'emp-ficha',        component: () => import('@/views/empresariales/FichaEmpresa.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/emp/kanban',       name: 'emp-kanban',       component: () => import('@/views/empresariales/KanbanPipeline.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/emp/agenda',       name: 'emp-agenda',       component: () => import('@/views/empresariales/AgendaEmp.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/emp/metricas',     name: 'emp-metricas',     component: () => import('@/views/empresariales/MisMetricasEmp.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/emp/supervisor',   name: 'emp-supervisor',   component: () => import('@/views/empresariales/PanelSupervisorEmp.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP', nivelMaximo: 3 } },
  { path: '/emp/reporte-fideliz', name: 'emp-reporte-fideliz', component: () => import('@/views/empresariales/ReportePresupuestoFideliz.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP', nivelMaximo: 3 } },
  { path: '/emp/renovaciones', name: 'emp-renovaciones', component: () => import('@/views/empresariales/RenovacionesProximas.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },

  // ─── PAP - Puerta a Puerta (Fase 3) ───
  { path: '/pap',             name: 'placeholder-pap',  redirect: { name: 'pap-panel' } },
  { path: '/pap/panel',       name: 'pap-panel',        component: () => import('@/views/pap/PanelPAP.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-PAP' } },
  { path: '/pap/registrar',   name: 'pap-registrar',    component: () => import('@/views/pap/RegistroRapidoView.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-PAP' } },
  { path: '/pap/mis-visitas', name: 'pap-mis-visitas',  component: () => import('@/views/pap/MisVisitas.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-PAP' } },
  { path: '/pap/mapa',        name: 'pap-mapa',         component: () => import('@/views/pap/MapaZona.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-PAP' } },
  { path: '/pap/metricas',    name: 'pap-metricas',     component: () => import('@/views/pap/MisMetricasPap.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-PAP' } },
  { path: '/pap/agenda',      name: 'pap-agenda',       component: () => import('@/views/pap/AgendaPap.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-PAP' } },
  { path: '/pap/supervisor',  name: 'pap-supervisor',   component: () => import('@/views/pap/PanelSupervisorPap.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-PAP', nivelMaximo: 3 } },

  // ─── Fidelización Empresas (Fase 6) ───
  { path: '/fideliz',             name: 'placeholder-fideliz', redirect: { name: 'fideliz-panel' } },
  { path: '/fideliz/panel',       name: 'fideliz-panel',       component: () => import('@/views/fidelizacion/PanelFideliz.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/fideliz/calendario',  name: 'fideliz-calendario',  component: () => import('@/views/fidelizacion/CalendarioFideliz.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/fideliz/contactos',   name: 'fideliz-contactos',   component: () => import('@/views/fidelizacion/MisContactosFideliz.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/fideliz/contacto/:cfId', name: 'fideliz-contacto', component: () => import('@/views/fidelizacion/FichaContactoFideliz.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/fideliz/metricas',    name: 'fideliz-metricas',    component: () => import('@/views/fidelizacion/MisMetricasFideliz.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/fideliz/supervisor',  name: 'fideliz-supervisor',  component: () => import('@/views/fidelizacion/PanelSupervisorFideliz.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP', nivelMaximo: 3 } },
  { path: '/fideliz/empresas',    name: 'fideliz-empresas',    component: () => import('@/views/fidelizacion/EmpresasFideliz.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },
  { path: '/fideliz/empresa/:empresaId/historial', name: 'fideliz-historial-empresa',
    component: () => import('@/views/fidelizacion/HistorialEmpresaFideliz.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PREV-EMP' } },

  // ─── SVC Call Center comercial (Fase 4) ───
  { path: '/svc',             name: 'placeholder-svc', redirect: { name: 'svc-panel' } },
  { path: '/svc/panel',       name: 'svc-panel',        component: () => import('@/views/svc/PanelSvc.vue'),
    meta: { requiereAuth: true, areaCodigo: 'SVC' } },
  { path: '/svc/clientes',    name: 'svc-clientes',     component: () => import('@/views/svc/MisClientesSvc.vue'),
    meta: { requiereAuth: true, areaCodigo: 'SVC' } },
  { path: '/svc/cliente/:id', name: 'svc-ficha',        component: () => import('@/views/svc/FichaClienteSvc.vue'),
    meta: { requiereAuth: true, areaCodigo: 'SVC' } },
  { path: '/svc/nuevo',       name: 'svc-nuevo',        component: () => import('@/views/svc/NuevoClienteSvc.vue'),
    meta: { requiereAuth: true, areaCodigo: 'SVC' } },
  { path: '/svc/agenda',      name: 'svc-agenda',       component: () => import('@/views/svc/AgendaSvc.vue'),
    meta: { requiereAuth: true, areaCodigo: 'SVC' } },
  { path: '/svc/metricas',    name: 'svc-metricas',     component: () => import('@/views/svc/MisMetricasSvc.vue'),
    meta: { requiereAuth: true, areaCodigo: 'SVC' } },
  { path: '/svc/supervisor',  name: 'svc-supervisor',   component: () => import('@/views/svc/PanelSupervisorSvc.vue'),
    meta: { requiereAuth: true, areaCodigo: 'SVC', nivelMaximo: 3 } },
  { path: '/svc/sin-asignar', name: 'svc-sin-asignar',  component: () => import('@/views/svc/SinAsignarSvc.vue'),
    meta: { requiereAuth: true, areaCodigo: 'SVC', nivelMaximo: 3 } },

  // ─── Vista cross-área (visible a supervisor+) ───
  { path: '/cliente-completo/:personaId', name: 'cliente-historial',
    component: () => import('@/views/comun/HistorialClienteCompleto.vue'),
    meta: { requiereAuth: true, nivelMaximo: 3 } },
  { path: '/reasignacion-masiva', name: 'reasignacion-masiva',
    component: () => import('@/views/comun/ReasignacionMasiva.vue'),
    meta: { requiereAuth: true, nivelMaximo: 3 } },

  // ─── Tracking GPS de jornadas (Fase 7) ───
  { path: '/tracking/mis-recorridos',  name: 'tracking-mios',
    component: () => import('@/views/tracking/MisRecorridos.vue'),
    meta: { requiereAuth: true } },
  { path: '/tracking/asesor/:usrId',   name: 'tracking-asesor',
    component: () => import('@/views/tracking/RecorridoAsesor.vue'),
    meta: { requiereAuth: true } },                       // controller verifica scope
  { path: '/tracking/equipo/live',     name: 'tracking-live',
    component: () => import('@/views/tracking/LiveEquipo.vue'),
    meta: { requiereAuth: true, nivelMaximo: 3 } },

  // Errors
  { path: '/403',     name: 'forbidden', component: () => import('@/views/Forbidden.vue'), meta: { publica: true } },
  { path: '/:any(.*)', name: 'not-found', component: () => import('@/views/NotFound.vue'), meta: { publica: true } }
];

const router = createRouter({
  history: createWebHistory('/genflow/'),
  routes,
  scrollBehavior() { return { top: 0 }; }
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  const config = useConfigStore();

  // ── SSO callback desde el Portal Serfunorte ──
  if (to.query.sso_token && to.query.sso_refresh) {
    auth.accessToken  = String(to.query.sso_token);
    auth.refreshToken = String(to.query.sso_refresh);
    localStorage.setItem('sv_access_token',  auth.accessToken);
    localStorage.setItem('sv_refresh_token', auth.refreshToken);
    try {
      await auth.fetchMe();
    } catch {
      auth.accessToken = null; auth.refreshToken = null;
      localStorage.removeItem('sv_access_token');
      localStorage.removeItem('sv_refresh_token');
      return { name: 'login' };
    }
    const { sso_token, sso_refresh, ...rest } = to.query;
    if (to.name === 'login' || to.path === '/') return auth.rutaInicio();
    return { path: to.path, query: rest, replace: true };
  }

  // Pública → libre
  if (to.meta.publica) {
    // Si ya logueado y va a login → su ruta de inicio
    if (to.name === 'login' && auth.isAuthenticated) return auth.rutaInicio();
    return true;
  }

  // Requiere auth
  if (to.meta.requiereAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { next: to.fullPath } };
  }

  // Nivel jerárquico
  if (to.meta.nivelMaximo && auth.rolNivel > to.meta.nivelMaximo) {
    return { name: 'forbidden' };
  }

  // Área coincide (SUPER_ADMIN siempre pasa; AGENTE_SVC bypass para placeholder-svc)
  if (to.meta.areaCodigo && !auth.esSuperAdmin) {
    const accesoOk = auth.tieneAccesoArea(to.meta.areaCodigo);
    const esSvcAgente = auth.rolCodigo === 'AGENTE_SVC' && to.meta.areaCodigo === 'SVC';
    if (!accesoOk && !esSvcAgente) {
      return { name: 'forbidden' };
    }
    // Auto-cambiar área activa si entra a una sección de otra área accesible
    const areaDestino = auth.areasAccesibles.find(a => a.area_codigo === to.meta.areaCodigo);
    if (areaDestino && auth.areaActivaId !== areaDestino.area_id) {
      auth.setAreaActiva(areaDestino.area_id);
    }
  }

  // Cargar bootstrap del área activa (no bloquear si falla)
  if (auth.isAuthenticated && auth.areaActivaId && !config.cache.has(auth.areaActivaId)) {
    try { await config.loadBootstrap(auth.areaActivaId); } catch {}
  }
  return true;
});

export default router;
