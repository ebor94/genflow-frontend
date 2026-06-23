<script setup>
/**
 * AppSidebar — Sidebar lateral desktop (>= 1024px).
 *
 * Estructura:
 *   - Header: logo + botón colapsar/expandir.
 *   - Sección fija superior: Inicio, Agenda, Mi perfil.
 *   - Una sección colapsable por cada área accesible al usuario:
 *       PRENEC, PREV-EMP, PREV-PAP, SVC.
 *     Solo se muestran las áreas que el usuario realmente puede ver
 *     (auth.areasAccesibles ya incluye el espejo EMP↔PAP para asesores).
 *   - Sección Admin (solo SUPER_ADMIN / ADMIN_AREA).
 *   - Footer: cerrar sesión.
 *
 * Persistencia: estado colapsado en localStorage 'sv_sidebar_collapsed'.
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';

const props = defineProps({ openBusqueda: { type: Function, default: null } });

const router  = useRouter();
const route   = useRoute();
const auth    = useAuthStore();

// ── Estado colapsado ───────────────────────────────────────────────────────
const STORAGE_KEY = 'sv_sidebar_collapsed';
const colapsado = ref(localStorage.getItem(STORAGE_KEY) === '1');

function toggleColapsado() {
  colapsado.value = !colapsado.value;
  localStorage.setItem(STORAGE_KEY, colapsado.value ? '1' : '0');
  // Si colapsa, cierra todos los grupos
  if (colapsado.value) gruposAbiertos.value = {};
}

// ── Grupos abiertos por área ───────────────────────────────────────────────
const gruposAbiertos = ref({});  // { 'PREV-EMP': true, ... }

onMounted(() => {
  // Por defecto, abre el grupo del área activa
  const cod = auth.areaActual?.area_codigo;
  if (cod) gruposAbiertos.value[cod] = true;
});

function toggleGrupo(cod) {
  gruposAbiertos.value = { ...gruposAbiertos.value, [cod]: !gruposAbiertos.value[cod] };
}

// ── Helpers de permisos ────────────────────────────────────────────────────
const esSup = computed(() =>
  ['SUPER_ADMIN','ADMIN_AREA','JEFE_PAP','SUPERVISOR'].includes(auth.rolCodigo)
);
const esFidelizGrupo = computed(() => auth.usuario?.grupo?.grupo_codigo === 'FIDELIZACION');

// ── Estructura del menú por área ───────────────────────────────────────────
// Devuelve los items para un área concreta. Solo se llama por áreas
// accesibles al usuario (auth.areasAccesibles).
function itemsDeArea(codigo) {
  const sup = esSup.value;
  const trackingItems = sup ? [
    { to: { name: 'tracking-live' },   label: 'Mapa en vivo',         icon: '🗺️' },
    { to: { name: 'tracking-asesor', params: { usrId: auth.usuario?.usr_id || 0 } },
      label: 'Recorridos GPS', icon: '📍' }
  ] : [];
  const reasignarItem = sup ? [
    { to: { name: 'reasignacion-masiva' }, label: 'Reasignar prospectos', icon: '🔄' }
  ] : [];

  switch (codigo) {
    case 'PRENEC': return [
      { to: { name: 'prenec-panel' },    label: 'Panel del día',    icon: '🏠' },
      { to: { name: 'prenec-clientes' }, label: 'Mis clientes',     icon: '👥' },
      { to: { name: 'prenec-agenda' },   label: 'Agenda área',      icon: '📅' },
      { to: { name: 'prenec-metricas' }, label: 'Mis métricas',     icon: '📊' },
      ...(sup ? [{ to: { name: 'prenec-supervisor' }, label: 'Panel supervisor', icon: '👁️' }] : []),
      ...reasignarItem,
      ...trackingItems
    ];

    case 'PREV-EMP': {
      const items = [];
      if (!esFidelizGrupo.value) {
        items.push(
          { to: { name: 'emp-panel' },        label: 'Empresas',        icon: '🏢' },
          { to: { name: 'emp-kanban' },       label: 'Pipeline',        icon: '🔄' },
          { to: { name: 'emp-metricas' },     label: 'Métricas',        icon: '📊' },
          { to: { name: 'emp-renovaciones' }, label: 'Renovaciones',    icon: '🔁' }
        );
        if (sup) {
          items.push(
            { to: { name: 'emp-supervisor' },       label: 'Panel supervisor',  icon: '👁️' },
            { to: { name: 'emp-reporte-fideliz' },  label: 'Reporte fideliz.',  icon: '📑' }
          );
        }
      }
      if (esFidelizGrupo.value || sup) {
        items.push(
          { tipo: 'divider', label: 'Fidelización' },
          { to: { name: 'fideliz-panel' },      label: 'Próximos cumples', icon: '💝' },
          { to: { name: 'fideliz-calendario' }, label: 'Calendario fideliz.', icon: '📅' },
          { to: { name: 'fideliz-empresas' },   label: 'Empresas fideliz.', icon: '🏢' },
          { to: { name: 'fideliz-contactos' },  label: 'Contactos fideliz.', icon: '👤' },
          { to: { name: 'fideliz-metricas' },   label: 'Métricas fideliz.', icon: '📊' }
        );
        if (sup) items.push({ to: { name: 'fideliz-supervisor' }, label: 'Supervisor fideliz.', icon: '👁️' });
      }
      items.push(...reasignarItem, ...trackingItems);
      return items;
    }

    case 'PREV-PAP': return [
      { to: { name: 'pap-panel' },       label: 'Panel Individual', icon: '🏠' },
      { to: { name: 'pap-registrar' },   label: 'Registro rápido', icon: '➕' },
      { to: { name: 'pap-mis-visitas' }, label: 'Mis visitas',     icon: '🚪' },
      { to: { name: 'pap-mapa' },        label: 'Mapa de zona',    icon: '🗺️' },
      { to: { name: 'pap-metricas' },    label: 'Mis métricas',    icon: '📊' },
      ...(sup ? [{ to: { name: 'pap-supervisor' }, label: 'Panel supervisor', icon: '👁️' }] : []),
      ...reasignarItem,
      ...trackingItems
    ];

    case 'SVC': return [
      { to: { name: 'svc-panel' },    label: 'Panel SVC',  icon: '🏠' },
      { to: { name: 'svc-clientes' }, label: 'Clientes',   icon: '👥' },
      { to: { name: 'svc-agenda' },   label: 'Agenda SVC', icon: '📅' },
      { to: { name: 'svc-metricas' }, label: 'Métricas',   icon: '📊' },
      ...(sup ? [
        { to: { name: 'svc-sin-asignar' }, label: 'Sin asignar', icon: '⏳' },
        { to: { name: 'svc-supervisor' },  label: 'Equipo',      icon: '👁️' }
      ] : []),
      ...reasignarItem
    ];

    default: return [];
  }
}

// Override de labels visibles por código. Garantiza que el menú siempre
// muestre los nombres acordados sin depender del cache de localStorage
// ni de futuros cambios en BD.
const LABELS_AREA = {
  'PRENEC':   'Prenecesidad',
  'PREV-EMP': 'Previsión Empresariales',
  'PREV-PAP': 'Previsión Individual',
  'SVC':      'Servicio al Cliente'
};

// Lista de áreas a mostrar como grupos (las accesibles al usuario)
const areasMenu = computed(() => {
  const lista = (auth.areasAccesibles || []).slice().sort((a, b) => {
    const orden = { PRENEC: 1, 'PREV-EMP': 2, 'PREV-PAP': 3, SVC: 4 };
    return (orden[a.area_codigo] || 99) - (orden[b.area_codigo] || 99);
  });
  // Para asesores con area principal (sin multi-area), también muestra la suya
  if (!lista.length && auth.usuario?.area) lista.push(auth.usuario.area);
  return lista.map(a => ({
    area_codigo:    a.area_codigo,
    area_nombre:    LABELS_AREA[a.area_codigo] || a.area_nombre,
    area_color_hex: a.area_color_hex || '#C8902A',
    area_icono:     a.area_icono || '📂'
  }));
});

const itemActivo = (item) => route.name === item.to?.name;

async function cerrarSesion() {
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <aside
    class="hidden lg:flex flex-col bg-brown-deep text-cream border-r border-cream/10 sticky top-0 h-screen z-30 transition-[width] duration-200"
    :class="colapsado ? 'w-16' : 'w-64'"
  >
    <!-- Header -->
    <div class="h-16 flex items-center justify-between px-3 border-b border-cream/10 shrink-0">
      <RouterLink :to="auth.rutaInicio()"
                  class="font-serif text-xl text-gold-bright hover:text-gold transition-colors truncate">
        <span v-if="!colapsado">GenFlow</span>
        <span v-else>G</span>
      </RouterLink>
      <button @click="toggleColapsado"
              :title="colapsado ? 'Expandir' : 'Colapsar'"
              class="text-cream/60 hover:text-cream text-lg leading-none p-1">
        {{ colapsado ? '»' : '«' }}
      </button>
    </div>

    <!-- Búsqueda + Inicio + Agenda + Mi perfil -->
    <nav class="px-2 py-3 space-y-1 border-b border-cream/10">
      <button
        v-if="openBusqueda"
        @click="openBusqueda()"
        :title="'Buscar (Cmd+K)'"
        class="w-full flex items-center gap-3 px-2 py-2 rounded-sv text-sm hover:bg-cream/10 text-cream/80"
      >
        <span class="text-base">🔍</span>
        <span v-if="!colapsado" class="truncate">Buscar</span>
        <kbd v-if="!colapsado" class="ml-auto text-[10px] bg-cream/10 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      <RouterLink :to="auth.rutaInicio()" title="Inicio"
                  class="flex items-center gap-3 px-2 py-2 rounded-sv text-sm hover:bg-cream/10 text-cream/80"
                  :class="route.name === 'selector' ? 'bg-gold/15 text-gold-bright' : ''">
        <span class="text-base">🏠</span>
        <span v-if="!colapsado">Inicio</span>
      </RouterLink>

      <RouterLink :to="{ name: 'agenda' }" title="Agenda unificada"
                  class="flex items-center gap-3 px-2 py-2 rounded-sv text-sm hover:bg-cream/10 text-cream/80"
                  :class="route.name === 'agenda' ? 'bg-gold/15 text-gold-bright' : ''">
        <span class="text-base">📅</span>
        <span v-if="!colapsado">Mi agenda</span>
      </RouterLink>

      <RouterLink :to="{ name: 'mi-perfil' }" title="Mi perfil"
                  class="flex items-center gap-3 px-2 py-2 rounded-sv text-sm hover:bg-cream/10 text-cream/80"
                  :class="route.name === 'mi-perfil' ? 'bg-gold/15 text-gold-bright' : ''">
        <span class="text-base">👤</span>
        <span v-if="!colapsado">Mi perfil</span>
      </RouterLink>
    </nav>

    <!-- Grupos por área -->
    <nav class="flex-1 overflow-y-auto px-2 py-3 space-y-1">
      <div v-for="area in areasMenu" :key="area.area_codigo">
        <button
          @click="!colapsado ? toggleGrupo(area.area_codigo) : null"
          :title="area.area_nombre"
          class="w-full flex items-center gap-3 px-2 py-2 rounded-sv text-sm hover:bg-cream/10 text-cream/80 font-semibold"
        >
          <span class="text-base" :style="`color: ${area.area_color_hex}`">{{ area.area_icono }}</span>
          <span v-if="!colapsado" class="flex-1 text-left truncate">{{ area.area_nombre }}</span>
          <span v-if="!colapsado" class="text-xs text-cream/40">
            {{ gruposAbiertos[area.area_codigo] ? '▾' : '▸' }}
          </span>
        </button>

        <!-- Submenú: si está colapsado el sidebar, no se muestra (los íconos del grupo bastan) -->
        <div v-if="!colapsado && gruposAbiertos[area.area_codigo]" class="ml-3 mt-0.5 pl-3 border-l border-cream/10 space-y-0.5">
          <template v-for="(item, idx) in itemsDeArea(area.area_codigo)" :key="idx">
            <div v-if="item.tipo === 'divider'"
                 class="text-[10px] uppercase tracking-wider text-cream/40 pt-2 pb-1 px-2">
              {{ item.label }}
            </div>
            <RouterLink v-else :to="item.to" :title="item.label"
                        class="flex items-center gap-2 px-2 py-1.5 rounded-sv text-xs hover:bg-cream/10 text-cream/70"
                        :class="itemActivo(item) ? 'bg-gold/15 text-gold-bright' : ''">
              <span class="text-sm">{{ item.icon }}</span>
              <span class="truncate">{{ item.label }}</span>
            </RouterLink>
          </template>
        </div>
      </div>

      <!-- Admin -->
      <div v-if="auth.esSuperAdmin || auth.esAdminArea" class="mt-4 pt-3 border-t border-cream/10">
        <button
          @click="!colapsado ? toggleGrupo('admin') : null"
          title="Administración"
          class="w-full flex items-center gap-3 px-2 py-2 rounded-sv text-sm hover:bg-cream/10 text-cream/80 font-semibold"
        >
          <span class="text-base">⚙️</span>
          <span v-if="!colapsado" class="flex-1 text-left">Administración</span>
          <span v-if="!colapsado" class="text-xs text-cream/40">{{ gruposAbiertos['admin'] ? '▾' : '▸' }}</span>
        </button>
        <div v-if="!colapsado && gruposAbiertos['admin']" class="ml-3 mt-0.5 pl-3 border-l border-cream/10 space-y-0.5">
          <RouterLink :to="{ name: 'admin-areas' }"     class="flex items-center gap-2 px-2 py-1.5 rounded-sv text-xs hover:bg-cream/10 text-cream/70"
                      :class="route.name === 'admin-areas' ? 'bg-gold/15 text-gold-bright' : ''">
            <span>🗂️</span><span>Áreas</span>
          </RouterLink>
          <RouterLink :to="{ name: 'admin-usuarios' }"  class="flex items-center gap-2 px-2 py-1.5 rounded-sv text-xs hover:bg-cream/10 text-cream/70"
                      :class="route.name === 'admin-usuarios' ? 'bg-gold/15 text-gold-bright' : ''">
            <span>👥</span><span>Usuarios</span>
          </RouterLink>
          <RouterLink :to="{ name: 'admin-productos' }" class="flex items-center gap-2 px-2 py-1.5 rounded-sv text-xs hover:bg-cream/10 text-cream/70"
                      :class="route.name === 'admin-productos' ? 'bg-gold/15 text-gold-bright' : ''">
            <span>📦</span><span>Productos</span>
          </RouterLink>
          <RouterLink :to="{ name: 'admin-pipeline' }"  class="flex items-center gap-2 px-2 py-1.5 rounded-sv text-xs hover:bg-cream/10 text-cream/70"
                      :class="route.name === 'admin-pipeline' ? 'bg-gold/15 text-gold-bright' : ''">
            <span>🔄</span><span>Pipelines</span>
          </RouterLink>
        </div>
      </div>
    </nav>

    <!-- Footer: usuario + logout -->
    <div class="border-t border-cream/10 px-2 py-3 shrink-0">
      <div v-if="!colapsado" class="px-2 py-1.5 text-xs text-cream/60 truncate">
        <div class="font-semibold text-cream/90 truncate">{{ auth.nombreCompleto }}</div>
        <div class="truncate">{{ auth.rolCodigo }}</div>
      </div>
      <button @click="cerrarSesion" title="Cerrar sesión"
              class="w-full flex items-center gap-3 px-2 py-2 rounded-sv text-sm hover:bg-danger/20 text-cream/80 hover:text-danger">
        <span class="text-base">🚪</span>
        <span v-if="!colapsado">Cerrar sesión</span>
      </button>
    </div>
  </aside>
</template>
