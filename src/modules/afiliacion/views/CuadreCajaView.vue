<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getCuadreCaja,
  aprobarRecibos as apiAprobar,
  getReciboPdfUrl,
  descargarReciboPdf,
  getAsesoresConPrefijo,
  reenviarWhatsappRecibo
} from '@afi/api/reciboApi'
import { useToastStore } from '@afi/stores/useToastStore'
import AprobarReciboModal from '@afi/components/recibos/AprobarReciboModal.vue'

const toast = useToastStore()

function hoyISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const fechaDesde = ref(hoyISO())
const fechaHasta = ref(hoyISO())
const filtroAsesorId = ref('')   // id del asesor seleccionado; '' = todos
const filtroEstado = ref('PENDIENTE')
const filtroTipo = ref('')     // 'efectivo' | 'bancarios' | '' (todos)
const recibos = ref([])
const cargando = ref(false)
const seleccionados = ref(new Set())
const modalAprobar = ref(false)
const asesores = ref([])         // [{ id, nombre, apellido, prefijo_recibo }]
// Permisos resueltos por el backend; default conservador
const permisos = ref({ efectivo: false, bancarios: false, all: false, superAdmin: false })

const rangoInvalido = computed(() =>
  !!fechaDesde.value && !!fechaHasta.value && fechaDesde.value > fechaHasta.value
)

// Contexto del cuadre según permisos
const contexto = computed(() => {
  const p = permisos.value
  if (p.superAdmin || p.all) {
    return { titulo: 'Cuadre completo', subtitulo: 'Efectivo + transferencias y consignaciones', badge: null }
  }
  if (p.efectivo) {
    return {
      titulo: 'Cuadre de efectivo',
      subtitulo: 'Solo apruebas recibos pagados en efectivo. Transferencias y consignaciones las gestiona el rol CARTERA.',
      badge: { texto: 'CAJERO · EFECTIVO', cls: 'bg-emerald-100 text-emerald-800' }
    }
  }
  if (p.bancarios) {
    return {
      titulo: 'Cuadre bancario',
      subtitulo: 'Apruebas transferencias, consignaciones y posfechados cobrados tras verificar en el banco.',
      badge: { texto: 'CARTERA · BANCARIOS', cls: 'bg-blue-100 text-blue-800' }
    }
  }
  return { titulo: 'Cuadre de caja', subtitulo: 'Sin permisos de aprobación', badge: null }
})

// Solo muestra el selector de tipo si el usuario puede ver ambos tipos
const mostrarSelectorTipo = computed(() => permisos.value.superAdmin || permisos.value.all)

async function cargar() {
  if (rangoInvalido.value) {
    toast.error('La fecha "Desde" no puede ser mayor que "Hasta".')
    return
  }
  cargando.value = true
  seleccionados.value = new Set()
  try {
    const { data } = await getCuadreCaja({
      fechaDesde: fechaDesde.value,
      fechaHasta: fechaHasta.value,
      asesorId: filtroAsesorId.value || undefined,
      estado: filtroEstado.value || undefined,
      tipo: filtroTipo.value || undefined
    })
    recibos.value = data.data
    if (data.permisos) permisos.value = data.permisos
  } catch {
    toast.error('Error al cargar el cuadre de caja.')
  } finally {
    cargando.value = false
  }
}

async function cargarAsesores() {
  try {
    const { data } = await getAsesoresConPrefijo()
    asesores.value = data.data
  } catch {
    // No bloquea la vista; el select simplemente queda vacío
  }
}

// El filtrado por asesorId ya lo hace el backend; aquí solo exponemos los datos.
const filtrados = computed(() => recibos.value)

// Estado de selección
function toggleSeleccion(id) {
  const next = new Set(seleccionados.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  seleccionados.value = next
}

const todosSeleccionables = computed(() =>
  filtrados.value.filter(r => r.estadoCuadre === 'PENDIENTE').map(r => r.id)
)
const todosSeleccionados = computed(() =>
  todosSeleccionables.value.length > 0 &&
  todosSeleccionables.value.every(id => seleccionados.value.has(id))
)
function toggleTodos() {
  if (todosSeleccionados.value) {
    seleccionados.value = new Set()
  } else {
    seleccionados.value = new Set(todosSeleccionables.value)
  }
}

const recibosSeleccionados = computed(() =>
  filtrados.value.filter(r => seleccionados.value.has(r.id))
)

const totalSeleccionado = computed(() =>
  recibosSeleccionados.value.reduce((acc, r) => acc + Number(r.valor || 0), 0)
)

const totalesPorForma = computed(() => {
  const acc = { EFECTIVO: 0, TRANSFERENCIA: 0, CORRESPONSAL: 0, POSFECHADO_COBRADO: 0 }
  for (const r of filtrados.value) {
    acc[r.formaPago] = (acc[r.formaPago] || 0) + Number(r.valor || 0)
  }
  acc.total = Object.values(acc).reduce((s, v) => s + v, 0)
  return acc
})

function formatearMoneda(n) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })
}

function formatearFecha(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function nombreAfiliado(r) {
  const a = r.afiliado
  if (!a) return '—'
  return [a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido]
    .filter(Boolean).join(' ')
}

function nombreAsesor(r) {
  const a = r.asesor
  if (!a) return '—'
  return [a.nombre, a.apellido].filter(Boolean).join(' ')
}

const formaLabel = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CORRESPONSAL: 'Corresponsal',
  POSFECHADO_COBRADO: 'Posfechado cobrado'
}
const formaBadgeClass = {
  EFECTIVO: 'bg-emerald-50 text-emerald-700',
  TRANSFERENCIA: 'bg-blue-50 text-blue-700',
  CORRESPONSAL: 'bg-purple-50 text-purple-700',
  POSFECHADO_COBRADO: 'bg-amber-50 text-amber-700'
}

async function abrirPdf(r) {
  const url = getReciboPdfUrl(r)
  if (url) { window.open(url, '_blank'); return }
  try {
    const { data } = await descargarReciboPdf(r.id)
    const blob = new Blob([data], { type: 'application/pdf' })
    window.open(URL.createObjectURL(blob), '_blank')
  } catch {
    toast.error('PDF no disponible.')
  }
}

const reenviandoWa = ref(null)
async function reenviarWhatsapp(r) {
  reenviandoWa.value = r.id
  try {
    const { data } = await reenviarWhatsappRecibo(r.id)
    if (data.success) {
      toast.success(`WhatsApp enviado (${r.numeroRecibo}) ✓`)
    } else {
      toast.error(data.message || 'No se pudo enviar el WhatsApp')
    }
  } catch (err) {
    toast.error(err?.response?.data?.message || 'Error al reenviar WhatsApp')
  } finally {
    reenviandoWa.value = null
  }
}

async function confirmarAprobacion(observacion) {
  try {
    const ids = recibosSeleccionados.value.map(r => r.id)
    await apiAprobar(ids, observacion)
    toast.success(`${ids.length} recibo(s) aprobado(s).`)
    modalAprobar.value = false
    await cargar()
  } catch (err) {
    const msg = err.response?.data?.message || 'Error al aprobar los recibos.'
    toast.error(msg)
  }
}

onMounted(() => {
  cargarAsesores()
  cargar()
})
</script>

<template>
  <div class="space-y-5">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-xl font-bold text-gray-800">{{ contexto.titulo }}</h2>
          <span v-if="contexto.badge"
                :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold', contexto.badge.cls]">
            {{ contexto.badge.texto }}
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-1 max-w-2xl">{{ contexto.subtitulo }}</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Desde</label>
        <input
          v-model="fechaDesde"
          type="date"
          :max="fechaHasta || undefined"
          class="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
          :class="rangoInvalido
            ? 'border-red-400 focus:ring-red-500'
            : 'border-gray-300 focus:ring-green-500'"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
        <input
          v-model="fechaHasta"
          type="date"
          :min="fechaDesde || undefined"
          class="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
          :class="rangoInvalido
            ? 'border-red-400 focus:ring-red-500'
            : 'border-gray-300 focus:ring-green-500'"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Asesor</label>
        <select
          v-model="filtroAsesorId"
          @change="cargar"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
                 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Todos los asesores</option>
          <option v-for="a in asesores" :key="a.id" :value="a.id">
            {{ a.prefijo_recibo }} — {{ a.nombre }} {{ a.apellido }}
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Estado</label>
        <select
          v-model="filtroEstado"
          @change="cargar"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
                 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="PENDIENTE">Pendientes</option>
          <option value="APROBADO">Aprobados</option>
          <option value="">Todos</option>
        </select>
      </div>
      <!-- Selector de tipo: solo si tiene ambos permisos (admin/super_admin) -->
      <div v-if="mostrarSelectorTipo">
        <label class="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
        <select
          v-model="filtroTipo"
          @change="cargar"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
                 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Todos los tipos</option>
          <option value="efectivo">Solo efectivo</option>
          <option value="bancarios">Solo bancarios</option>
        </select>
      </div>
      <button
        @click="cargar"
        :disabled="cargando || rangoInvalido"
        class="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700
               rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 self-end"
        :class="!mostrarSelectorTipo && 'lg:col-start-6'"
      >
        <svg :class="['w-4 h-4', cargando && 'animate-spin']" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Consultar
      </button>
      <p v-if="rangoInvalido" class="text-xs text-red-600 col-span-full">
        ⚠️ La fecha "Desde" no puede ser mayor que "Hasta".
      </p>
    </div>

    <!-- Resumen del día -->
    <div v-if="!cargando && recibos.length > 0"
         class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div class="bg-gray-100 border border-gray-300 rounded-lg p-3 col-span-2 md:col-span-1">
        <p class="text-xs text-gray-600">Total filtrado</p>
        <p class="text-xl font-bold text-gray-800">$ {{ formatearMoneda(totalesPorForma.total) }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ filtrados.length }} recibo(s)</p>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <p class="text-xs text-emerald-700">Efectivo</p>
        <p class="text-base font-bold text-emerald-800">$ {{ formatearMoneda(totalesPorForma.EFECTIVO) }}</p>
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p class="text-xs text-blue-700">Transferencia</p>
        <p class="text-base font-bold text-blue-800">$ {{ formatearMoneda(totalesPorForma.TRANSFERENCIA) }}</p>
      </div>
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <p class="text-xs text-purple-700">Corresponsal</p>
        <p class="text-base font-bold text-purple-800">$ {{ formatearMoneda(totalesPorForma.CORRESPONSAL) }}</p>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p class="text-xs text-amber-700">Posfechado cobrado</p>
        <p class="text-base font-bold text-amber-800">$ {{ formatearMoneda(totalesPorForma.POSFECHADO_COBRADO) }}</p>
      </div>
    </div>

    <!-- Barra de acción de selección -->
    <div v-if="seleccionados.size > 0"
         class="sticky top-0 z-10 bg-green-700 text-white rounded-lg shadow-lg p-3 flex items-center justify-between gap-3">
      <div>
        <p class="font-semibold">{{ seleccionados.size }} recibo(s) seleccionado(s)</p>
        <p class="text-sm opacity-90">Total: $ {{ formatearMoneda(totalSeleccionado) }}</p>
      </div>
      <button
        @click="modalAprobar = true"
        class="px-4 py-2 bg-white text-green-700 font-bold rounded-lg hover:bg-green-50"
      >
        Aprobar seleccionados
      </button>
    </div>

    <!-- Cargando -->
    <div v-if="cargando" class="flex justify-center py-16">
      <div class="flex flex-col items-center gap-3 text-gray-400">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="text-sm">Cargando cuadre...</span>
      </div>
    </div>

    <!-- Sin resultados -->
    <div v-else-if="filtrados.length === 0" class="text-center py-16">
      <p class="text-gray-500 font-medium">Sin recibos en los filtros aplicados</p>
    </div>

    <!-- Tabla -->
    <div v-else class="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="w-10 px-3 py-3">
              <input
                type="checkbox"
                :checked="todosSeleccionados"
                :disabled="todosSeleccionables.length === 0"
                @change="toggleTodos"
                class="rounded text-green-600 focus:ring-green-500"
              />
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N° Recibo</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Asesor</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Afiliado</th>
            <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Forma</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Valor</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
            <th class="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Hora</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">PDF</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          <tr v-for="r in filtrados" :key="r.id"
              :class="seleccionados.has(r.id) ? 'bg-green-50' : 'hover:bg-gray-50'">
            <td class="px-3 py-3 text-center">
              <input
                type="checkbox"
                :checked="seleccionados.has(r.id)"
                :disabled="r.estadoCuadre === 'APROBADO'"
                @change="toggleSeleccion(r.id)"
                class="rounded text-green-600 focus:ring-green-500"
              />
            </td>
            <td class="px-4 py-3">
              <p class="text-sm font-bold text-gray-800">{{ r.numeroRecibo }}</p>
            </td>
            <td class="px-4 py-3">
              <p class="text-sm text-gray-700">{{ nombreAsesor(r) }}</p>
              <p class="text-xs text-gray-400">{{ r.asesor?.prefijo_recibo }}</p>
            </td>
            <td class="px-4 py-3">
              <p class="text-sm text-gray-700">{{ nombreAfiliado(r) }}</p>
              <p class="text-xs text-gray-400">{{ r.afiliado?.numeroDocumento }}</p>
            </td>
            <td class="hidden md:table-cell px-4 py-3">
              <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', formaBadgeClass[r.formaPago]]">
                {{ formaLabel[r.formaPago] || r.formaPago }}
              </span>
              <p v-if="r.banco" class="text-xs text-gray-500 mt-1">{{ r.banco }}</p>
              <p v-if="r.referencia" class="text-xs text-gray-400">Ref: {{ r.referencia }}</p>
            </td>
            <td class="px-4 py-3 text-right">
              <p class="text-sm font-bold text-gray-800">$ {{ formatearMoneda(r.valor) }}</p>
            </td>
            <td class="px-4 py-3 text-center">
              <span v-if="r.estadoCuadre === 'APROBADO'"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                ✓ Aprobado
              </span>
              <span v-else
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                ⏳ Pendiente
              </span>
              <p v-if="r.observacionCajero" class="mt-1 text-xs text-gray-500 max-w-xs truncate" :title="r.observacionCajero">
                💬 {{ r.observacionCajero }}
              </p>
            </td>
            <td class="hidden lg:table-cell px-4 py-3">
              <p class="text-xs text-gray-500">{{ formatearFecha(r.fechaEmision) }}</p>
              <p v-if="r.aprobador" class="text-xs text-green-700 mt-1">
                Por {{ r.aprobador.nombre }}
              </p>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex flex-col items-end gap-1.5">
                <button
                  @click="abrirPdf(r)"
                  class="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-white
                         bg-gray-700 hover:bg-gray-800 rounded-lg"
                  title="Ver PDF"
                >
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  PDF
                </button>
                <button
                  @click="reenviarWhatsapp(r)"
                  :disabled="reenviandoWa === r.id"
                  class="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  :class="r.whatsappEnviado ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                             : 'text-amber-700 bg-amber-50 hover:bg-amber-100'"
                  :title="r.whatsappEnviado ? 'WA enviado — reenviar' : 'Enviar por WhatsApp'"
                >
                  <svg v-if="reenviandoWa !== r.id" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                  </svg>
                  <svg v-else class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  {{ r.whatsappEnviado ? 'WA ✓' : 'WA' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AprobarReciboModal
      :visible="modalAprobar"
      :recibos="recibosSeleccionados"
      @cerrar="modalAprobar = false"
      @confirmar="confirmarAprobacion"
    />

  </div>
</template>
