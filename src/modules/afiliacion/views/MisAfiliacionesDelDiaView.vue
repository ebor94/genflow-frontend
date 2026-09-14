<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useRoute } from 'vue-router'
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { getMisAfiliacionesDelDia, legalizarAfiliaciones, descargarLiquidacionPdf } from '@afi/api/afiliadoApi'
import { useToastStore } from '@afi/stores/useToastStore'
import AfiliadoDetalle from '@afi/components/aprobacion/AfiliadoDetalle.vue'
import TablaProductosAfiliacion from '@afi/components/afiliado/TablaProductosAfiliacion.vue'
import LegalizarModal from '@afi/components/afiliado/LegalizarModal.vue'

const router = useRouter()
const toast = useToastStore()

function hoyISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const fechaDesde    = ref(hoyISO())
const fechaHasta    = ref(hoyISO())
const busqueda      = ref('')
const afiliaciones  = ref([])
const cargando      = ref(false)
const expandidos    = ref(new Set())

// ── Legalización ─────────────────────────────────────────────────
const seleccionados  = ref([])   // array de ids
const modalLegalizar = ref(false)
const legalizando    = ref(false)

/**
 * MySQL BIT(1) llega del driver mysql2 como Buffer ({type:'Buffer',data:[1]}).
 * Esta función normaliza cualquier representación (number/string/bool/Buffer)
 * al entero correspondiente. Sirve mientras se despliega el typeCast del backend.
 */
function bitToInt(v) {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') return Number(v) || 0
  if (Array.isArray(v?.data)) return v.data[0] || 0   // { type:'Buffer', data:[N] }
  if (v?.[0] != null) return v[0]                     // Buffer real
  return 0
}

// Solo afiliaciones APROBADAS pueden legalizarse
// (estadoRegistro === 1, sin rechazo total ni parcial, no legalizadas)
function esLegalizable(a) {
  return bitToInt(a.estadoRegistro)   === 1
      && bitToInt(a.rechazado)        !== 1
      && bitToInt(a.rechazadoParcial) !== 1
      && bitToInt(a.legalizado)       !== 1
}

const legalizables = computed(() =>
  filtradas.value.filter(esLegalizable)
)

const todosSeleccionados = computed(() =>
  legalizables.value.length > 0 &&
  legalizables.value.every(a => seleccionados.value.includes(a.id))
)

function toggleTodos() {
  if (todosSeleccionados.value) {
    seleccionados.value = []
  } else {
    seleccionados.value = legalizables.value.map(a => a.id)
  }
}

function toggleSeleccion(id) {
  const idx = seleccionados.value.indexOf(id)
  if (idx === -1) seleccionados.value = [...seleccionados.value, id]
  else            seleccionados.value = seleccionados.value.filter(x => x !== id)
}

async function confirmarLegalizacion(numeroPlanilla) {
  modalLegalizar.value = false
  legalizando.value = true
  try {
    const { data } = await legalizarAfiliaciones(seleccionados.value, numeroPlanilla)
    if (data.data.legalizados > 0) {
      toast.success(`${data.data.legalizados} afiliación(es) legalizadas con planilla N° ${numeroPlanilla}`)
    } else {
      toast.info('Todas las afiliaciones ya estaban legalizadas.')
    }
    seleccionados.value = []
    await cargar()
  } catch (err) {
    toast.error(err?.response?.data?.message || 'Error al legalizar afiliaciones')
  } finally {
    legalizando.value = false
  }
}

// ── Descarga de liquidación PDF ──────────────────────────────────
const descargandoLiq = ref(false)

async function descargarLiquidacion() {
  if (seleccionados.value.length === 0) return

  // Validar que todas las seleccionadas estén realmente APROBADAS (defensa,
  // aunque la UI solo deja marcar las legalizables → aprobadas no legalizadas)
  const idsValidos = filtradas.value
    .filter(a => seleccionados.value.includes(a.id))
    .filter(a => bitToInt(a.estadoRegistro) === 1
              && bitToInt(a.rechazado) !== 1
              && bitToInt(a.rechazadoParcial) !== 1)
    .map(a => a.id)

  if (idsValidos.length === 0) {
    toast.error('Solo se pueden incluir afiliaciones aprobadas en la liquidación.')
    return
  }

  descargandoLiq.value = true
  try {
    const { data } = await descargarLiquidacionPdf(idsValidos)
    const blob = new Blob([data], { type: 'application/pdf' })
    const blobUrl = URL.createObjectURL(blob)
    const ts = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}`
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `liquidacion-${stamp}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    toast.success(`Liquidación generada (${idsValidos.length} afiliación(es))`)
  } catch (err) {
    // err.response.data puede ser un Blob (responseType: blob) si el backend respondió error
    let msg = 'Error al generar la liquidación'
    if (err?.response?.data instanceof Blob) {
      try {
        const txt = await err.response.data.text()
        msg = JSON.parse(txt)?.message || msg
      } catch (_) { /* mantener mensaje genérico */ }
    } else if (err?.response?.data?.message) {
      msg = err.response.data.message
    }
    toast.error(msg)
  } finally {
    descargandoLiq.value = false
  }
}

// ── Filtros y carga ───────────────────────────────────────────────
const rangoInvalido = computed(() =>
  !!fechaDesde.value && !!fechaHasta.value && fechaDesde.value > fechaHasta.value
)

async function cargar() {
  if (rangoInvalido.value) {
    toast.error('La fecha "Desde" no puede ser mayor que "Hasta".')
    return
  }
  cargando.value = true
  expandidos.value = new Set()
  seleccionados.value = []
  try {
    const { data } = await getMisAfiliacionesDelDia({
      fechaDesde: fechaDesde.value,
      fechaHasta: fechaHasta.value
    })
    afiliaciones.value = data.data
  } catch {
    toast.error('Error al cargar las afiliaciones del día.')
  } finally {
    cargando.value = false
  }
}

const filtradas = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return afiliaciones.value
  return afiliaciones.value.filter(a =>
    nombreCompleto(a).toLowerCase().includes(q) ||
    a.numeroDocumento?.includes(q)
  )
})

const totales = computed(() => {
  const acc = { total: afiliaciones.value.length, pendientes: 0, aprobadas: 0, rechazadas: 0, legalizadas: 0 }
  for (const a of afiliaciones.value) {
    if (bitToInt(a.rechazado) === 1 || bitToInt(a.rechazadoParcial) === 1) acc.rechazadas++
    else if (bitToInt(a.estadoRegistro) === 1) acc.aprobadas++
    else acc.pendientes++
    if (bitToInt(a.legalizado) === 1) acc.legalizadas++
  }
  return acc
})

function nombreCompleto(a) {
  return [a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido]
    .filter(Boolean).join(' ')
}

function toggleExpand(id) {
  const next = new Set(expandidos.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  expandidos.value = next
}

function formatHora(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function formatFechaCorta(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function estadoBadge(a) {
  // bitToInt cubre el caso BIT(1) → Buffer que devuelve mysql2 por defecto
  if (bitToInt(a.rechazado) === 1)        return { label: '✗ Rechazada',        cls: 'bg-red-100 text-red-700' }
  if (bitToInt(a.rechazadoParcial) === 1) return { label: '✏️ Correc. parcial', cls: 'bg-amber-100 text-amber-700' }
  if (bitToInt(a.estadoRegistro) === 1)   return { label: '✓ Aprobada',         cls: 'bg-green-100 text-green-700' }
  return { label: '⏳ Pendiente', cls: 'bg-blue-100 text-blue-700' }
}

// ── Helpers de info de venta ─────────────────────────────────────
function formatCOP(v) {
  const n = Number(v || 0)
  return n.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

function productoLabel(a) {
  const partes = [a.producto, a.grupo].filter(Boolean)
  return partes.length ? partes.join(' · ') : '—'
}

function valorPlan(a) {
  return Number(a.contrato?.valorPlanExequial || 0)
}

function tieneAsistencia(a) {
  return a.asistenciaFueraDeCasa === 'SI' || a.asistenciaFueraDeCasa === 1
}

function valorAsistencia(a) {
  return Number(a.contrato?.tarifa?.valorAsistencia || 0)
}

function segurosResumen(a) {
  const list = Array.isArray(a.seguros) ? a.seguros : []
  if (!list.length) return null
  const primaTotal = list.reduce((acc, s) => acc + Number(s.prima || 0), 0)
  return {
    cantidad: list.length,
    nombres: list.map(s => s.nombre).join(', '),
    primaTotal
  }
}

function beneficiariosAdicionales(a) {
  const list = Array.isArray(a.beneficiarios) ? a.beneficiarios : []
  const adicionales = list.filter(b => b.tipoBeneficiario === 'ADICIONAL')
  return {
    cantidad: adicionales.length,
    valorTotal: Number(a.contrato?.valorAdicionales || 0)
  }
}

function corregir(a) {
  if (!a.hash) { toast.error('No se pudo abrir la corrección.'); return }
  router.push({ name: 'corregirAfiliacion', params: { hash: a.hash } })
}

onMounted(cargar)
// Recarga al volver a esta ruta (cubre keep-alive y navegación entre vistas)
onActivated(cargar)
// Si la ruta cambia y vuelve a esta vista, recargar
const route = useRoute()
watch(() => route.fullPath, (to) => {
  if (to.startsWith('/mis-afiliaciones-dia')) cargar()
})
</script>

<template>
  <div class="space-y-5">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-gray-800">Mis afiliaciones del día</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          Todas las afiliaciones que registraste en la fecha, sin importar el estado.
        </p>
      </div>
      <!-- Botones de acciones sobre la selección -->
      <div v-if="seleccionados.length > 0" class="flex flex-wrap gap-2">
        <!-- Generar liquidación PDF -->
        <button
          @click="descargarLiquidacion"
          :disabled="descargandoLiq"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white
                 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition"
          title="Descarga PDF con totales agregados de la selección"
        >
          <svg v-if="!descargandoLiq" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 17v-6h13M9 11V5h13M3 5h3v14H3zM9 17h13"/>
          </svg>
          <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Generar liquidación ({{ seleccionados.length }})
        </button>

        <!-- Legalizar -->
        <button
          @click="modalLegalizar = true"
          :disabled="legalizando"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white
                 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition"
        >
          <svg v-if="!legalizando" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Legalizar seleccionados ({{ seleccionados.length }})
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Desde</label>
        <input v-model="fechaDesde" type="date" :max="fechaHasta || undefined"
          class="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
          :class="rangoInvalido ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
        <input v-model="fechaHasta" type="date" :min="fechaDesde || undefined"
          class="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
          :class="rangoInvalido ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'" />
      </div>
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
        <input v-model="busqueda" type="text" placeholder="Nombre o documento..."
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <button @click="cargar" :disabled="cargando || rangoInvalido"
        class="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-2 self-end">
        <svg :class="['w-4 h-4', cargando && 'animate-spin']" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Consultar
      </button>
      <p v-if="rangoInvalido" class="text-xs text-red-600 w-full">
        ⚠️ La fecha "Desde" no puede ser mayor que "Hasta".
      </p>
    </div>

    <!-- Resumen -->
    <div v-if="!cargando && afiliaciones.length > 0"
         class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p class="text-xs text-gray-600">Total</p>
        <p class="text-xl font-bold text-gray-800">{{ totales.total }}</p>
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p class="text-xs text-blue-700">Pendientes</p>
        <p class="text-xl font-bold text-blue-800">{{ totales.pendientes }}</p>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-lg p-3">
        <p class="text-xs text-green-700">Aprobadas</p>
        <p class="text-xl font-bold text-green-800">{{ totales.aprobadas }}</p>
      </div>
      <div class="bg-red-50 border border-red-200 rounded-lg p-3">
        <p class="text-xs text-red-700">Rechazadas</p>
        <p class="text-xl font-bold text-red-800">{{ totales.rechazadas }}</p>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <p class="text-xs text-emerald-700">Legalizadas</p>
        <p class="text-xl font-bold text-emerald-800">{{ totales.legalizadas }}</p>
      </div>
    </div>

    <!-- Cargando -->
    <div v-if="cargando" class="flex justify-center py-16">
      <div class="flex flex-col items-center gap-3 text-gray-400">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="text-sm">Cargando...</span>
      </div>
    </div>

    <!-- Sin resultados -->
    <div v-else-if="filtradas.length === 0" class="text-center py-16">
      <svg class="mx-auto w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-500 font-medium">
        {{ busqueda ? 'Sin resultados' : 'No registraste afiliaciones en esta fecha' }}
      </p>
    </div>

    <!-- Tabla -->
    <div v-else class="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <!-- Checkbox "seleccionar todo" -->
            <th class="w-10 px-3 py-3 text-center">
              <input
                v-if="legalizables.length > 0"
                type="checkbox"
                :checked="todosSeleccionados"
                @change="toggleTodos"
                class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                title="Seleccionar todas las aprobadas no legalizadas"
              />
            </th>
            <th class="w-8 px-2 py-3"></th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Afiliado</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Producto / Valor</th>
            <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Asistencia</th>
            <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Seguros</th>
            <th class="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Adicionales</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Firma</th>
            <th class="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Hora</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acción</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          <template v-for="a in filtradas" :key="a.id">
            <tr
              class="hover:bg-gray-50 cursor-pointer"
              :class="seleccionados.includes(a.id) ? 'bg-emerald-50' : ''"
              @click="toggleExpand(a.id)"
            >
              <!-- Checkbox individual (solo si está APROBADA y no legalizada) -->
              <td class="px-3 py-3 text-center" @click.stop>
                <input
                  v-if="esLegalizable(a)"
                  type="checkbox"
                  :value="a.id"
                  :checked="seleccionados.includes(a.id)"
                  @change="toggleSeleccion(a.id)"
                  class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <svg v-else class="w-4 h-4 text-emerald-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"/>
                </svg>
              </td>

              <!-- Chevron expandir -->
              <td class="px-2 py-3 text-center">
                <svg :class="['w-4 h-4 text-gray-400 transition-transform', expandidos.has(a.id) && 'rotate-90']"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </td>

              <!-- Afiliado: solo nombre + #ID (sin detalle: queda en la fila expandida) -->
              <td class="px-4 py-3">
                <p class="text-sm font-semibold text-gray-800">{{ nombreCompleto(a) }}</p>
                <p class="text-xs text-gray-400 font-mono" :title="`ID afiliado: ${a.id}`">
                  #{{ a.id }}
                </p>
              </td>

              <!-- Producto + Valor del plan exequial -->
              <td class="px-4 py-3">
                <p class="text-xs text-gray-500">{{ productoLabel(a) }}</p>
                <p class="text-sm font-bold text-gray-900">$ {{ formatCOP(valorPlan(a)) }}</p>
              </td>

              <!-- Asistencia (SI/NO) + valor -->
              <td class="hidden md:table-cell px-4 py-3">
                <template v-if="tieneAsistencia(a)">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">SI</span>
                  <p class="text-xs text-gray-600 mt-1">$ {{ formatCOP(valorAsistencia(a)) }}</p>
                </template>
                <template v-else>
                  <span class="text-xs text-gray-400">Sin asistencia</span>
                </template>
              </td>

              <!-- Seguros: nombres y prima total mensual -->
              <td class="hidden md:table-cell px-4 py-3">
                <template v-if="segurosResumen(a)">
                  <p class="text-xs text-gray-700 max-w-[180px] truncate" :title="segurosResumen(a).nombres">
                    {{ segurosResumen(a).nombres }}
                  </p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    Prima: <span class="font-semibold text-gray-800">$ {{ formatCOP(segurosResumen(a).primaTotal) }}</span>
                  </p>
                </template>
                <span v-else class="text-xs text-gray-400">Sin seguros</span>
              </td>

              <!-- Beneficiarios adicionales: cantidad + valor total -->
              <td class="hidden lg:table-cell px-4 py-3">
                <template v-if="beneficiariosAdicionales(a).cantidad > 0">
                  <p class="text-sm font-semibold text-gray-800">
                    {{ beneficiariosAdicionales(a).cantidad }}
                    benef.
                  </p>
                  <p class="text-xs text-gray-500">$ {{ formatCOP(beneficiariosAdicionales(a).valorTotal) }}</p>
                </template>
                <span v-else class="text-xs text-gray-400">—</span>
              </td>

              <!-- Estado + badge legalizado -->
              <td class="px-4 py-3 text-center">
                <div class="flex flex-col items-center gap-1">
                  <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold', estadoBadge(a).cls]">
                    {{ estadoBadge(a).label }}
                  </span>
                  <span v-if="a.legalizado"
                    class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    ✓ Planilla {{ a.numeroPlanilla }}
                  </span>
                </div>
              </td>

              <!-- Estado firma electrónica Adobe -->
              <td class="px-4 py-3 text-center" @click.stop>
                <a v-if="a.fechaFirmaAdobe && a.urlFirmaAdobe"
                   :href="a.urlFirmaAdobe" target="_blank" rel="noopener"
                   class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
                          bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                   :title="`Firmado el ${formatFechaCorta(a.fechaFirmaAdobe)} — ver documento`">
                  ✓ Firmado
                </a>
                <span v-else-if="a.fechaFirmaAdobe"
                   class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700"
                   :title="`Firmado el ${formatFechaCorta(a.fechaFirmaAdobe)}`">
                  ✓ Firmado
                </span>
                <span v-else
                   class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500"
                   title="Pendiente de firma electrónica">
                  ✗ Pendiente
                </span>
              </td>

              <td class="hidden lg:table-cell px-4 py-3">
                <p class="text-xs text-gray-500">{{ formatHora(a.createdAt) }}</p>
              </td>

              <td class="px-4 py-3 text-right" @click.stop>
                <button
                  v-if="(a.rechazado || a.rechazadoParcial) && a.hash"
                  @click="corregir(a)"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white
                         bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  ✏️ Corregir
                </button>
              </td>
            </tr>

            <!-- Fila expandida: tabla productos + detalle completo -->
            <tr v-if="expandidos.has(a.id)" :key="`det-${a.id}`">
              <td colspan="11" class="p-0">
                <div class="bg-gray-50 border-t border-gray-200 px-6 py-4">
                  <!-- Tabla de productos contratados -->
                  <TablaProductosAfiliacion :afiliado="a" />
                  <!-- Detalle completo del afiliado -->
                  <AfiliadoDetalle :afiliado="a" />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Modal legalizar -->
    <LegalizarModal
      :visible="modalLegalizar"
      :cantidad="seleccionados.length"
      @cerrar="modalLegalizar = false"
      @confirmar="confirmarLegalizacion"
    />

  </div>
</template>
