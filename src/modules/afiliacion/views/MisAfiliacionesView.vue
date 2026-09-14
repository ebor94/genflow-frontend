<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAfiliadosPendientes, getAfiliacionesRechazadas, listarBorradores, eliminarBorrador } from '@afi/api/afiliadoApi'
import { useToastStore } from '@afi/stores/useToastStore'
import AfiliadoDetalle from '@afi/components/aprobacion/AfiliadoDetalle.vue'

const router = useRouter()
const toast  = useToastStore()

// ── Estado ────────────────────────────────────────────────────
const tab           = ref('pendientes')  // 'pendientes' | 'rechazadas' | 'borradores'
const pendientes    = ref([])
const rechazadas    = ref([])
const borradores    = ref([])
const cargando      = ref(false)
const expandidos    = ref(new Set())
const busqueda      = ref('')

// ── Computed ──────────────────────────────────────────────────
const lista = computed(() => {
  if (tab.value === 'pendientes') return pendientes.value
  if (tab.value === 'rechazadas') return rechazadas.value
  return []
})

const filtrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return lista.value
  return lista.value.filter(a =>
    nombreCompleto(a).toLowerCase().includes(q) ||
    a.numeroDocumento.includes(q)
  )
})

const borradoresFiltrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return borradores.value
  return borradores.value.filter(b =>
    (b.nombreCompleto || '').toLowerCase().includes(q) ||
    (b.numeroDocumento || '').includes(q)
  )
})

// ── Carga de datos ────────────────────────────────────────────
async function cargar() {
  cargando.value = true
  expandidos.value = new Set()
  try {
    const [resPend, resRech, resBorr] = await Promise.all([
      getAfiliadosPendientes(),
      getAfiliacionesRechazadas(),
      listarBorradores()
    ])
    pendientes.value = resPend.data.data
    rechazadas.value = resRech.data.data
    borradores.value = resBorr.data.data || []
  } catch {
    toast.error('Error al cargar las afiliaciones.')
  } finally {
    cargando.value = false
  }
}

function cambiarTab(t) {
  tab.value = t
  busqueda.value = ''
  expandidos.value = new Set()
}

function toggleExpand(id) {
  const next = new Set(expandidos.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandidos.value = next
}

function corregir(afiliado) {
  router.push({ name: 'corregirAfiliacion', params: { hash: afiliado.hash } })
}

// ── Helpers ───────────────────────────────────────────────────
function nombreCompleto(a) {
  return [a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido]
    .filter(Boolean).join(' ')
}

function formatDateTime(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function labelSexo(val) {
  return { F: 'Femenino', M: 'Masculino', X: 'No binario' }[val] ?? val
}

/** Retorna true si el afiliado tiene rechazo parcial (beneficiarios inactivados) */
function esParcial(a) {
  return !!a.rechazadoParcial && !a.rechazado
}

/** Motivo a mostrar para rechazos parciales (del primer beneficiario con motivoRechazo) */
function motivoBeneficiarios(a) {
  const b = (a.beneficiarios || []).find(b => b.activo === 0 && b.motivoRechazo)
  return b?.motivoRechazo || 'Beneficiarios requieren corrección'
}

function continuarBorrador(b) {
  router.push({ path: '/', query: { borrador: b.id } })
}

async function handleEliminarBorrador(b) {
  if (!confirm(`¿Eliminar la pre-afiliación de ${b.nombreCompleto || 'este afiliado'}?`)) return
  try {
    await eliminarBorrador(b.id)
    borradores.value = borradores.value.filter(x => x.id !== b.id)
    toast.info('Pre-afiliación eliminada')
  } catch {
    toast.error('No se pudo eliminar la pre-afiliación')
  }
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-5">

    <!-- ── Header ──────────────────────────────────────────────── -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-gray-800">Mis Afiliaciones</h2>
        <p class="text-sm text-gray-500 mt-0.5">Consulta el estado de tus registros enviados.</p>
      </div>
      <button
        @click="cargar"
        :disabled="cargando"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700
               bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <svg :class="['w-4 h-4', cargando && 'animate-spin']" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar
      </button>
    </div>

    <!-- ── Tabs ────────────────────────────────────────────────── -->
    <div class="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
      <button
        @click="cambiarTab('pendientes')"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        :class="tab === 'pendientes'
          ? 'bg-white text-amber-700 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Pendientes
        <span v-if="pendientes.length > 0"
              class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
          {{ pendientes.length }}
        </span>
      </button>
      <button
        @click="cambiarTab('rechazadas')"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        :class="tab === 'rechazadas'
          ? 'bg-white text-red-700 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Rechazadas
        <span v-if="rechazadas.length > 0"
              class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
          {{ rechazadas.length }}
        </span>
      </button>
      <button
        @click="cambiarTab('borradores')"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        :class="tab === 'borradores'
          ? 'bg-white text-blue-700 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        Pre-afiliaciones
        <span v-if="borradores.length > 0"
              class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
          {{ borradores.length }}
        </span>
      </button>
    </div>

    <!-- ── Buscador ─────────────────────────────────────────────── -->
    <div class="relative">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre o número de documento..."
        class="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg
               focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>

    <!-- ── Cargando ─────────────────────────────────────────────── -->
    <div v-if="cargando" class="flex justify-center py-16">
      <div class="flex flex-col items-center gap-3 text-gray-400">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="text-sm">Cargando afiliaciones...</span>
      </div>
    </div>

    <!-- ── Sin resultados (pendientes / rechazadas) ─────────────── -->
    <div v-else-if="!cargando && tab !== 'borradores' && filtrados.length === 0" class="text-center py-16">
      <svg class="mx-auto w-12 h-12 mb-3"
           :class="tab === 'rechazadas' ? 'text-red-200' : 'text-amber-200'"
           fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-500 font-medium">
        {{ busqueda ? 'Sin resultados para la búsqueda'
           : tab === 'pendientes' ? 'No tienes afiliaciones pendientes'
           : 'No tienes afiliaciones rechazadas' }}
      </p>
      <p class="text-sm text-gray-400 mt-1">
        {{ busqueda ? 'Intenta con otro nombre o documento.' : '' }}
      </p>
    </div>

    <!-- ── Tabla (pendientes / rechazadas) ──────────────────────── -->
    <div v-else-if="tab !== 'borradores'" class="rounded-xl border overflow-hidden shadow-sm"
         :class="tab === 'rechazadas' ? 'border-red-200' : 'border-gray-200'">
      <table class="min-w-full divide-y divide-gray-200">
        <thead :class="tab === 'rechazadas' ? 'bg-red-50' : 'bg-amber-50'">
          <tr>
            <th class="w-10 px-3 py-3"></th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Afiliado</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
            <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Canal / Plan</th>
            <th class="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {{ tab === 'rechazadas' ? 'Motivo rechazo' : 'Registrado' }}
            </th>
            <th v-if="tab === 'rechazadas'"
                class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Acción
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          <template v-for="afiliado in filtrados" :key="afiliado.id">

            <!-- Fila principal -->
            <tr
              class="transition-colors cursor-pointer"
              :class="tab === 'rechazadas' ? 'hover:bg-red-50' : 'hover:bg-amber-50'"
              @click="toggleExpand(afiliado.id)"
            >
              <td class="px-3 py-3 text-center">
                <svg
                  :class="['w-4 h-4 text-gray-400 transition-transform duration-200', expandidos.has(afiliado.id) && 'rotate-90']"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </td>

              <td class="px-4 py-3">
                <p class="text-sm font-semibold text-gray-800">{{ nombreCompleto(afiliado) }}</p>
                <p class="text-xs text-gray-400">{{ afiliado.edad }} años · {{ labelSexo(afiliado.sexo) }}</p>
              </td>

              <td class="px-4 py-3">
                <p class="text-sm text-gray-700">{{ afiliado.numeroDocumento }}</p>
                <p class="text-xs text-gray-400">{{ afiliado.tipoDocumento }}</p>
              </td>

              <td class="hidden md:table-cell px-4 py-3">
                <span v-if="afiliado.canal" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 mr-1">{{ afiliado.canal }}</span>
                <span v-if="afiliado.grupo" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">{{ afiliado.grupo }}</span>
                <span v-if="!afiliado.canal && !afiliado.grupo" class="text-xs text-gray-400">—</span>
              </td>

              <!-- Columna condicional: motivo (rechazadas) o fecha (pendientes) -->
              <td class="hidden lg:table-cell px-4 py-3">
                <template v-if="tab === 'rechazadas'">
                  <!-- Badge tipo de rechazo -->
                  <span
                    v-if="esParcial(afiliado)"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 mb-1"
                  >
                    ✏️ Corrección parcial
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 mb-1"
                  >
                    ✗ Rechazado
                  </span>
                  <!-- Motivo -->
                  <p v-if="afiliado.motivoRechazo"
                     class="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 max-w-xs truncate"
                     :title="afiliado.motivoRechazo">
                    {{ afiliado.motivoRechazo }}
                  </p>
                  <p v-else-if="esParcial(afiliado)"
                     class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 max-w-xs truncate"
                     :title="motivoBeneficiarios(afiliado)">
                    {{ motivoBeneficiarios(afiliado) }}
                  </p>
                  <span v-else class="text-xs text-gray-400">Sin motivo</span>
                </template>
                <template v-else>
                  <span class="text-xs text-gray-500">{{ formatDateTime(afiliado.createdAt) }}</span>
                </template>
              </td>

              <!-- Botón Corregir (solo tab rechazadas) -->
              <td v-if="tab === 'rechazadas'" class="px-4 py-3 text-right" @click.stop>
                <button
                  @click="corregir(afiliado)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white
                         bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                  Corregir
                </button>
              </td>

            </tr>

            <!-- Fila de detalle -->
            <tr v-if="expandidos.has(afiliado.id)" :key="`det-${afiliado.id}`">
              <td :colspan="tab === 'rechazadas' ? 6 : 5" class="p-0">
                <!-- Banner motivo si rechazada -->
                <div v-if="tab === 'rechazadas' && (afiliado.motivoRechazo || esParcial(afiliado))"
                     :class="['flex items-start gap-3 border-b px-5 py-3',
                              esParcial(afiliado)
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-red-50 border-red-200']">
                  <svg :class="['w-5 h-5 mt-0.5 flex-shrink-0', esParcial(afiliado) ? 'text-amber-500' : 'text-red-500']"
                       fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p :class="['text-sm font-semibold', esParcial(afiliado) ? 'text-amber-800' : 'text-red-800']">
                      {{ esParcial(afiliado) ? 'Corrección requerida en beneficiarios:' : 'Motivo del rechazo:' }}
                    </p>
                    <p :class="['text-sm mt-0.5', esParcial(afiliado) ? 'text-amber-700' : 'text-red-700']">
                      {{ afiliado.motivoRechazo || motivoBeneficiarios(afiliado) }}
                    </p>
                  </div>
                </div>
                <AfiliadoDetalle :afiliado="afiliado" />
              </td>
            </tr>

          </template>
        </tbody>
      </table>
    </div>

    <!-- ── Panel Pre-afiliaciones ──────────────────────────────────────── -->
    <template v-if="tab === 'borradores' && !cargando">
      <!-- Sin borradores -->
      <div v-if="borradoresFiltrados.length === 0" class="text-center py-16">
        <svg class="mx-auto w-12 h-12 mb-3 text-blue-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p class="text-gray-500 font-medium">
          {{ busqueda ? 'Sin resultados para la búsqueda' : 'No tienes pre-afiliaciones guardadas' }}
        </p>
        <p class="text-sm text-gray-400 mt-1">
          {{ busqueda ? 'Intenta con otro nombre o documento.' : 'Las pre-afiliaciones se guardan automáticamente mientras completas el formulario.' }}
        </p>
      </div>

      <!-- Lista de borradores -->
      <div v-else class="space-y-3">
        <div
          v-for="b in borradoresFiltrados"
          :key="b.id"
          class="flex items-center justify-between gap-4 bg-white rounded-xl border border-blue-100 shadow-sm px-5 py-4 hover:border-blue-300 transition-colors"
        >
          <div class="flex items-center gap-4 min-w-0">
            <!-- Icono documento -->
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-800 truncate">
                {{ b.nombreCompleto || '(Sin nombre)' }}
              </p>
              <p class="text-xs text-gray-500 truncate">
                {{ b.numeroDocumento || '—' }}
                <template v-if="b.canal || b.grupo">
                  · <span class="font-medium text-blue-600">{{ b.canal }}</span>
                  <template v-if="b.grupo"> / {{ b.grupo }}</template>
                </template>
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                Guardado: {{ formatDateTime(b.actualizadoAt || b.creadoAt) }}
              </p>
            </div>
          </div>

          <!-- Acciones -->
          <div class="flex items-center gap-2 shrink-0">
            <button
              @click="continuarBorrador(b)"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white
                     bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              Continuar
            </button>
            <button
              @click="handleEliminarBorrador(b)"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600
                     bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
              title="Eliminar pre-afiliación"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>
