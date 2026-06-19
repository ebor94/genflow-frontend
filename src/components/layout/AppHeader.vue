<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import AreaBadge from '@/components/common/AreaBadge.vue';
import JornadaWidget from '@/components/tracking/JornadaWidget.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const emit = defineEmits(['abrir-busqueda']);

const menuAbierto       = ref(false);
const switcherAbierto   = ref(false);
const dropdownAbierto   = ref(null); // grupo activo del dropdown nav (codigo)

const areaActiva = computed(() => auth.areaActual);
const mostrarSwitcher = computed(() => auth.esMultiArea);

async function cerrarSesion() {
  await auth.logout();
  router.push({ name: 'login' });
}

function cambiarArea(area) {
  auth.setAreaActiva(area.area_id);
  switcherAbierto.value = false;
  router.push(auth.rutaArea(area.area_codigo));
}

function toggleDropdown(key) {
  dropdownAbierto.value = dropdownAbierto.value === key ? null : key;
  menuAbierto.value = false;
  switcherAbierto.value = false;
}

// Cerrar dropdowns al cambiar de ruta o click fuera
function cerrarTodo() {
  dropdownAbierto.value = null;
  menuAbierto.value = false;
  switcherAbierto.value = false;
}
onMounted(() => document.addEventListener('click', onClickFuera));
onBeforeUnmount(() => document.removeEventListener('click', onClickFuera));
function onClickFuera(ev) {
  if (!ev.target.closest('[data-header-menu]')) cerrarTodo();
}
router.afterEach(cerrarTodo);

// ─── Estructura de navegación en GRUPOS (más profesional) ───
// Cada grupo es: { tipo: 'link' | 'dropdown', label, to?, items?, key? }
const nav = computed(() => {
  const grupos = [];
  const cod = areaActiva.value?.area_codigo;
  const rol = auth.rolCodigo;
  const esSup = ['SUPER_ADMIN','ADMIN_AREA','JEFE_PAP','SUPERVISOR'].includes(rol);

  // Admin link visible siempre para super_admin / admin_area
  if (auth.esSuperAdmin || auth.esAdminArea || auth.esGerente) {
    grupos.push({ tipo: 'link', to: { name: 'selector' }, label: 'Inicio' });
    if (auth.esSuperAdmin || auth.esAdminArea) {
      grupos.push({ tipo: 'link', to: { name: 'admin-areas' }, label: 'Admin' });
    }
  }

  // PRENECESIDAD
  if (cod === 'PRENEC') {
    grupos.push({ tipo: 'link', to: { name: 'prenec-panel' },    label: 'Panel' });
    grupos.push({ tipo: 'link', to: { name: 'prenec-clientes' }, label: 'Clientes' });
    grupos.push({ tipo: 'link', to: { name: 'prenec-agenda' },   label: 'Agenda' });
    grupos.push({ tipo: 'link', to: { name: 'prenec-metricas' }, label: 'Métricas' });
    if (esSup) {
      grupos.push({ tipo: 'dropdown', key: 'prenec-sup', label: 'Supervisión', items: [
        { to: { name: 'prenec-supervisor' },      label: 'Panel supervisor',     desc: 'Métricas y equipo' },
        { to: { name: 'reasignacion-masiva' },    label: 'Reasignar prospectos', desc: 'Mover cartera entre asesores' },
        { to: { name: 'tracking-live' },          label: 'Mapa en vivo',         desc: 'Posición actual del equipo' },
        { to: { name: 'tracking-asesor', params: { usrId: auth.usuario?.usr_id || 0 } }, label: 'Recorridos por asesor', desc: 'Histórico de jornadas GPS' }
      ]});
    }
  }

  // PREVISIÓN EMPRESARIALES — agrupa B2B + Fidelización en dropdowns
  if (cod === 'PREV-EMP') {
    const esFidelizGrupo = auth.usuario?.grupo?.grupo_codigo === 'FIDELIZACION';

    // Grupo B2B: visible si el usuario NO es agente fideliz puro
    if (!esFidelizGrupo) {
      grupos.push({
        tipo: 'dropdown', key: 'b2b', label: 'Empresariales',
        items: [
          { to: { name: 'emp-panel' },   label: 'Empresas',    desc: 'Listado y búsqueda' },
          { to: { name: 'emp-kanban' },  label: 'Pipeline',    desc: 'Vista Kanban' },
          { to: { name: 'emp-agenda' },  label: 'Agenda',      desc: 'Próximas gestiones' },
          { to: { name: 'emp-metricas' },label: 'Métricas',    desc: 'KPIs de la cartera' },
          { to: { name: 'emp-renovaciones' }, label: 'Renovaciones', desc: 'Convenios por vencer y vencidos' },
          ...(esSup ? [
            { to: { name: 'emp-supervisor' },      label: 'Supervisor',            desc: 'Equipo B2B' },
            { to: { name: 'reasignacion-masiva' }, label: 'Reasignar prospectos',  desc: 'Mover cartera entre asesores' },
            { to: { name: 'tracking-live' },       label: 'Mapa en vivo',          desc: 'Posición actual del equipo' },
            { to: { name: 'tracking-asesor', params: { usrId: auth.usuario?.usr_id || 0 } }, label: 'Recorridos por asesor', desc: 'Histórico de jornadas GPS' }
          ] : [])
        ]
      });
    }

    // Grupo Fidelización: visible a agente fideliz y supervisores
    if (esFidelizGrupo || esSup) {
      grupos.push({
        tipo: 'dropdown', key: 'fideliz', label: 'Fidelización',
        items: [
          { to: { name: 'fideliz-panel' },      label: 'Próximos cumples', desc: 'Eventos a gestionar' },
          { to: { name: 'fideliz-calendario' }, label: 'Calendario',       desc: 'Vista mensual' },
          { to: { name: 'fideliz-empresas' },   label: 'Empresas',         desc: 'Historial por empresa' },
          { to: { name: 'fideliz-contactos' },  label: 'Contactos',        desc: 'Todos los empleados' },
          { to: { name: 'fideliz-metricas' },   label: 'Métricas',         desc: 'Envíos y conversión' },
          ...(esSup ? [{ to: { name: 'fideliz-supervisor' }, label: 'Supervisor', desc: 'Equipo Fidelización' }] : [])
        ]
      });
    }
  }

  // PAP
  if (cod === 'PREV-PAP') {
    grupos.push({ tipo: 'link', to: { name: 'pap-panel' },       label: 'Panel' });
    grupos.push({ tipo: 'link', to: { name: 'pap-mis-visitas' }, label: 'Visitas' });
    grupos.push({ tipo: 'link', to: { name: 'pap-mapa' },        label: 'Mapa' });
    grupos.push({ tipo: 'link', to: { name: 'pap-metricas' },    label: 'Métricas' });
    if (esSup) {
      grupos.push({ tipo: 'dropdown', key: 'pap-sup', label: 'Supervisión', items: [
        { to: { name: 'pap-supervisor' },         label: 'Panel supervisor',     desc: 'Zonas y conversión' },
        { to: { name: 'reasignacion-masiva' },    label: 'Reasignar prospectos', desc: 'Mover cartera entre asesores' },
        { to: { name: 'tracking-live' },          label: 'Mapa en vivo',         desc: 'Posición actual del equipo' },
        { to: { name: 'tracking-asesor', params: { usrId: auth.usuario?.usr_id || 0 } }, label: 'Recorridos por asesor', desc: 'Histórico de jornadas GPS' }
      ]});
    }
  }

  // SVC
  if (cod === 'SVC' || rol === 'AGENTE_SVC') {
    grupos.push({ tipo: 'link', to: { name: 'svc-panel' },    label: 'Panel' });
    grupos.push({ tipo: 'link', to: { name: 'svc-clientes' }, label: 'Clientes' });
    grupos.push({ tipo: 'link', to: { name: 'svc-agenda' },   label: 'Agenda' });
    grupos.push({ tipo: 'link', to: { name: 'svc-metricas' }, label: 'Métricas' });
    if (esSup) {
      grupos.push({ tipo: 'dropdown', key: 'svc-sup', label: 'Supervisión', items: [
        { to: { name: 'svc-sin-asignar' },     label: 'Sin asignar',          desc: 'Cola de recuperación' },
        { to: { name: 'svc-supervisor' },      label: 'Equipo',               desc: 'Métricas agentes' },
        { to: { name: 'reasignacion-masiva' }, label: 'Reasignar prospectos', desc: 'Mover cartera entre agentes' }
      ]});
    }
  }

  return grupos;
});

// Detecta si la ruta actual cae dentro de un dropdown (para resaltar)
function dropdownActivo(grupo) {
  if (grupo.tipo !== 'dropdown') return false;
  return grupo.items.some(it => route.name === it.to.name);
}
</script>

<template>
  <header class="bg-brown-deep text-cream sticky top-0 z-40 shadow-sv-card border-b border-cream/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
      <!-- Logo -->
      <RouterLink :to="auth.rutaInicio()"
                  class="font-serif text-xl text-gold-bright hover:text-gold transition-colors shrink-0 mr-2">
        GenFlow
      </RouterLink>

      <!-- Nav agrupada -->
      <nav class="hidden md:flex items-center gap-0.5" data-header-menu>
        <template v-for="grupo in nav" :key="grupo.label">
          <!-- Enlace simple -->
          <RouterLink v-if="grupo.tipo === 'link'"
                      :to="grupo.to"
                      class="px-3 py-2 text-sm font-medium rounded-sv text-cream/75 hover:text-gold-bright hover:bg-cream/5 transition-colors"
                      active-class="text-gold-bright bg-cream/10">
            {{ grupo.label }}
          </RouterLink>

          <!-- Dropdown -->
          <div v-else class="relative">
            <button @click.stop="toggleDropdown(grupo.key)"
                    class="px-3 py-2 text-sm font-medium rounded-sv hover:text-gold-bright hover:bg-cream/5 transition-colors inline-flex items-center gap-1.5"
                    :class="dropdownActivo(grupo) || dropdownAbierto === grupo.key
                            ? 'text-gold-bright bg-cream/10'
                            : 'text-cream/75'">
              {{ grupo.label }}
              <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-180': dropdownAbierto === grupo.key }"
                   viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
              </svg>
            </button>
            <Transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0">
              <div v-if="dropdownAbierto === grupo.key"
                   class="absolute left-0 mt-1 w-64 bg-white text-text1 rounded-sv shadow-sv-pop border border-text3/15 py-1.5 z-50">
                <RouterLink v-for="it in grupo.items" :key="it.label"
                            :to="it.to"
                            class="block px-4 py-2.5 hover:bg-cream/60 transition-colors group"
                            active-class="bg-cream/40">
                  <div class="text-sm font-semibold text-text1 group-hover:text-brown-warm">{{ it.label }}</div>
                  <div v-if="it.desc" class="text-xs text-text3 mt-0.5">{{ it.desc }}</div>
                </RouterLink>
              </div>
            </Transition>
          </div>
        </template>
      </nav>

      <div class="flex-1" />

      <!-- Widget jornada de tracking (solo asesores de PRENEC/PREV-*) -->
      <JornadaWidget />

      <!-- Botón Buscar -->
      <button @click="emit('abrir-busqueda')"
              class="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-sv bg-cream/5 hover:bg-cream/10 text-cream/70 hover:text-cream transition-colors text-xs border border-cream/10"
              title="Buscar (Cmd+K)">
        <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
        </svg>
        <span>Buscar</span>
        <kbd class="hidden xl:inline px-1.5 py-0.5 rounded bg-cream/10 text-[10px] border border-cream/20 font-mono">⌘K</kbd>
      </button>

      <!-- Switcher de área multi-área -->
      <div v-if="mostrarSwitcher" class="relative" data-header-menu>
        <button @click.stop="switcherAbierto = !switcherAbierto; dropdownAbierto = null; menuAbierto = false"
                class="inline-flex items-center gap-2 hover:bg-cream/10 px-2 py-1.5 rounded-sv transition-colors border border-transparent hover:border-cream/10"
                :title="`Cambiar área (${auth.areasAccesibles.length} disponibles)`">
          <AreaBadge v-if="areaActiva"
                     :codigo="areaActiva.area_codigo"
                     :nombre="areaActiva.area_nombre"
                     :icono="areaActiva.area_icono"
                     :color-hex="areaActiva.area_color_hex"
                     size="sm"
                     on-dark />
          <svg class="w-3 h-3 text-cream/50" :class="{ 'rotate-180': switcherAbierto }"
               viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
          </svg>
        </button>
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0">
          <div v-if="switcherAbierto"
               class="absolute right-0 mt-1 w-64 bg-white text-text1 rounded-sv shadow-sv-pop border border-text3/15 py-1.5 z-50">
            <div class="px-3 py-2 text-[10px] uppercase tracking-wider text-text3 font-semibold border-b border-text3/10">
              Áreas disponibles
            </div>
            <button v-for="a in auth.areasAccesibles" :key="a.area_id"
                    @click="cambiarArea(a)"
                    class="w-full text-left px-3 py-2.5 hover:bg-cream/60 flex items-center gap-2.5 text-sm transition-colors"
                    :class="{ 'bg-cream/40': areaActiva?.area_id === a.area_id }">
              <span class="w-7 h-7 rounded-full flex items-center justify-center text-base shrink-0"
                    :style="`background-color:${a.area_color_hex}20;color:${a.area_color_hex}`">
                {{ a.area_icono || '📁' }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="font-semibold truncate" :class="{ 'text-brown-warm': areaActiva?.area_id === a.area_id }">
                  {{ a.area_nombre }}
                </div>
                <div class="text-[10px] text-text3 uppercase tracking-wider">
                  {{ a.area_codigo }}<span v-if="a.principal"> · principal</span>
                </div>
              </div>
              <svg v-if="areaActiva?.area_id === a.area_id" class="w-4 h-4 text-sage" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </Transition>
      </div>

      <!-- Si solo tiene 1 área (no multi), badge estático -->
      <AreaBadge
        v-else-if="areaActiva"
        :codigo="areaActiva.area_codigo"
        :nombre="areaActiva.area_nombre"
        :icono="areaActiva.area_icono"
        :color-hex="areaActiva.area_color_hex"
        size="sm"
        on-dark
        class="hidden sm:inline-flex"
      />

      <!-- Menú usuario -->
      <div class="relative" data-header-menu>
        <button @click.stop="menuAbierto = !menuAbierto; dropdownAbierto = null; switcherAbierto = false"
                class="inline-flex items-center gap-2.5 hover:bg-cream/10 px-2 py-1.5 rounded-sv transition-colors border border-transparent hover:border-cream/10">
          <span class="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-brown-warm text-brown-deep font-bold flex items-center justify-center text-sm ring-2 ring-cream/10">
            {{ auth.iniciales }}
          </span>
          <div class="hidden lg:flex flex-col items-start leading-tight">
            <span class="text-sm font-semibold text-cream">{{ auth.usuario?.usr_nombre }} {{ auth.usuario?.usr_apellido }}</span>
            <span class="text-[10px] text-cream/50 uppercase tracking-wider">{{ auth.rolCodigo?.replace('_', ' ') }}</span>
          </div>
          <svg class="hidden lg:block w-3 h-3 text-cream/50" :class="{ 'rotate-180': menuAbierto }"
               viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
          </svg>
        </button>
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0">
          <div v-if="menuAbierto"
               class="absolute right-0 mt-1 w-64 bg-white text-text1 rounded-sv shadow-sv-pop border border-text3/15 py-1.5 z-50">
            <div class="px-4 py-3 border-b border-text3/10">
              <div class="font-semibold text-text1 text-sm">{{ auth.nombreCompleto }}</div>
              <div class="text-xs text-text3 mt-0.5">{{ auth.usuario?.usr_email }}</div>
              <div v-if="auth.usuario?.grupo" class="text-[10px] text-text3 uppercase tracking-wider mt-1">
                {{ auth.usuario.grupo.grupo_nombre }}
              </div>
            </div>
            <RouterLink :to="{ name: 'mi-perfil' }"
                        class="block px-4 py-2 text-sm hover:bg-cream/60 transition-colors"
                        @click="menuAbierto = false">
              Mi perfil
            </RouterLink>
            <RouterLink v-if="auth.esMultiArea" :to="{ name: 'selector' }"
                        class="block px-4 py-2 text-sm hover:bg-cream/60 transition-colors"
                        @click="menuAbierto = false">
              Cambiar área
            </RouterLink>
            <div class="border-t border-text3/10 mt-1 pt-1">
              <button @click="cerrarSesion(); menuAbierto = false"
                      class="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors">
                Cerrar sesión
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
