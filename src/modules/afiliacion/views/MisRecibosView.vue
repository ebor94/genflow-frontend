<script setup>
import { ref, computed, onMounted } from 'vue'
import { getMisRecibos, getReciboPdfUrl, descargarReciboPdf, reenviarWhatsappRecibo } from '@afi/api/reciboApi'
import { useToastStore } from '@afi/stores/useToastStore'

const toast = useToastStore()

// Filtros (default: hoy)
function hoyISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
const fechaDesde = ref(hoyISO())
const fechaHasta = ref(hoyISO())
const recibos = ref([])
const cargando = ref(false)

const rangoInvalido = computed(() =>
  !!fechaDesde.value && !!fechaHasta.value && fechaDesde.value > fechaHasta.value
)

async function cargar() {
  if (rangoInvalido.value) {
    toast.error('La fecha "Desde" no puede ser mayor que "Hasta".')
    return
  }
  cargando.value = true
  try {
    const { data } = await getMisRecibos({
      fechaDesde: fechaDesde.value,
      fechaHasta: fechaHasta.value
    })
    recibos.value = data.data
  } catch {
    toast.error('Error al cargar los recibos.')
  } finally {
    cargando.value = false
  }
}

const totales = computed(() => {
  const acc = {
    cantidad: recibos.value.length,
    total: 0,
    EFECTIVO: 0,
    TRANSFERENCIA: 0,
    CORRESPONSAL: 0,
    POSFECHADO_COBRADO: 0,
    PENDIENTE: 0,
    APROBADO: 0
  }
  for (const r of recibos.value) {
    const v = Number(r.valor || 0)
    acc.total += v
    acc[r.formaPago] = (acc[r.formaPago] || 0) + v
    acc[r.estadoCuadre] = (acc[r.estadoCuadre] || 0) + 1
  }
  return acc
})

function formatearMoneda(n) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })
}

function formatearFecha(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function nombreAfiliado(r) {
  const a = r.afiliado
  if (!a) return '—'
  return [a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido]
    .filter(Boolean).join(' ')
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

async function abrirPdf(recibo) {
  const url = getReciboPdfUrl(recibo)
  if (url) {
    window.open(url, '_blank')
    return
  }
  // Fallback: el PDF aún no se ha generado o la ruta estática no es accesible
  try {
    const { data } = await descargarReciboPdf(recibo.id)
    const blob = new Blob([data], { type: 'application/pdf' })
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, '_blank')
  } catch {
    toast.error('El PDF de este recibo aún no se ha generado.')
  }
}

const reenviando = ref(null) // id del recibo en proceso
async function reenviarWhatsapp(recibo) {
  reenviando.value = recibo.id
  try {
    const { data } = await reenviarWhatsappRecibo(recibo.id)
    if (data.success) {
      toast.success(`WhatsApp enviado a ${recibo.celularAfiliado || 'cliente'} ✓`)
    } else {
      toast.error(data.message || 'No se pudo enviar el WhatsApp')
    }
  } catch (err) {
    toast.error(err?.response?.data?.message || 'Error al reenviar WhatsApp')
  } finally {
    reenviando.value = null
  }
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-5">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-gray-800">Mis recibos de caja</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          Para cuadre con el cajero / auditoría al cierre del día.
        </p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Desde</label>
        <input
          v-model="fechaDesde"
          type="date"
          :max="fechaHasta || undefined"
          class="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
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
          class="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
          :class="rangoInvalido
            ? 'border-red-400 focus:ring-red-500'
            : 'border-gray-300 focus:ring-green-500'"
        />
      </div>
      <button
        @click="cargar"
        :disabled="cargando || rangoInvalido"
        class="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700
               rounded-lg disabled:opacity-50 flex items-center gap-2"
      >
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
    <div v-if="!cargando && recibos.length > 0"
         class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-green-50 border border-green-200 rounded-lg p-3">
        <p class="text-xs text-green-700">Total del día</p>
        <p class="text-xl font-bold text-green-800">$ {{ formatearMoneda(totales.total) }}</p>
        <p class="text-xs text-green-700 mt-1">{{ totales.cantidad }} recibo<span v-if="totales.cantidad !== 1">s</span></p>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <p class="text-xs text-emerald-700">Efectivo</p>
        <p class="text-lg font-bold text-emerald-800">$ {{ formatearMoneda(totales.EFECTIVO) }}</p>
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p class="text-xs text-blue-700">Transferencia / Corresponsal</p>
        <p class="text-lg font-bold text-blue-800">
          $ {{ formatearMoneda(totales.TRANSFERENCIA + totales.CORRESPONSAL) }}
        </p>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p class="text-xs text-amber-700">Posfechado cobrado</p>
        <p class="text-lg font-bold text-amber-800">$ {{ formatearMoneda(totales.POSFECHADO_COBRADO) }}</p>
      </div>
    </div>

    <!-- Cargando -->
    <div v-if="cargando" class="flex justify-center py-16">
      <div class="flex flex-col items-center gap-3 text-gray-400">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="text-sm">Cargando recibos...</span>
      </div>
    </div>

    <!-- Sin resultados -->
    <div v-else-if="!cargando && recibos.length === 0" class="text-center py-16">
      <svg class="mx-auto w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 17v-2a4 4 0 014-4h.01M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p class="text-gray-500 font-medium">Sin recibos en la fecha seleccionada</p>
    </div>

    <!-- Tabla -->
    <div v-else class="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N° Recibo</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Afiliado</th>
            <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Forma de pago</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Valor</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
            <th class="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Emitido</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          <tr v-for="r in recibos" :key="r.id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <p class="text-sm font-bold text-gray-800">{{ r.numeroRecibo }}</p>
            </td>
            <td class="px-4 py-3">
              <p class="text-sm font-medium text-gray-800">{{ nombreAfiliado(r) }}</p>
              <p class="text-xs text-gray-400">{{ r.afiliado?.numeroDocumento || '' }}</p>
            </td>
            <td class="hidden md:table-cell px-4 py-3">
              <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', formaBadgeClass[r.formaPago]]">
                {{ formaLabel[r.formaPago] || r.formaPago }}
              </span>
              <p v-if="r.banco" class="text-xs text-gray-500 mt-1">{{ r.banco }}</p>
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
            </td>
            <td class="hidden lg:table-cell px-4 py-3">
              <p class="text-xs text-gray-500">{{ formatearFecha(r.fechaEmision) }}</p>
              <p v-if="r.estadoCuadre === 'APROBADO' && r.aprobadoAt"
                 class="text-xs text-green-700 mt-1">
                Cuadrado: {{ formatearFecha(r.aprobadoAt) }}
              </p>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex flex-col items-end gap-1.5">
                <!-- Ver PDF -->
                <button
                  @click="abrirPdf(r)"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white
                         bg-gray-700 hover:bg-gray-800 rounded-lg"
                  title="Ver PDF del recibo"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF
                </button>

                <!-- Reenviar por WhatsApp -->
                <button
                  @click="reenviarWhatsapp(r)"
                  :disabled="reenviando === r.id"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  :class="r.whatsappEnviado
                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100'"
                  :title="r.whatsappEnviado ? 'WhatsApp enviado — clic para reenviar' : 'WhatsApp no enviado — clic para enviar'"
                >
                  <svg v-if="reenviando !== r.id" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M3 10l9-7 9 7v11a1 1 0 01-1 1H4a1 1 0 01-1-1V10z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 21V12h6v9" />
                  </svg>
                  <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  {{ r.whatsappEnviado ? 'WA ✓' : 'Enviar WA' }}
                </button>

                <p v-if="r.observacionCajero" class="mt-0.5 text-xs text-gray-500 max-w-xs truncate" :title="r.observacionCajero">
                  💬 {{ r.observacionCajero }}
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>
