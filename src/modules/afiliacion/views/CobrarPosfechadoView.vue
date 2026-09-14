<script setup>
import { ref, onMounted } from 'vue'
import { getPosfechadosPendientes, cobrarPosfechado as apiCobrar } from '@afi/api/reciboApi'
import { useToastStore } from '@afi/stores/useToastStore'
import CobrarPosfechadoModal from '@afi/components/recibos/CobrarPosfechadoModal.vue'

const toast = useToastStore()

const posfechados = ref([])
const cargando = ref(false)
const modal = ref(false)
const afiliadoActivo = ref(null)

async function cargar() {
  cargando.value = true
  try {
    const { data } = await getPosfechadosPendientes()
    posfechados.value = data.data
  } catch {
    toast.error('Error al cargar los pagos posfechados pendientes.')
  } finally {
    cargando.value = false
  }
}

function abrirCobro(a) {
  afiliadoActivo.value = a
  modal.value = true
}

async function confirmarCobro(datos) {
  try {
    const { data } = await apiCobrar(afiliadoActivo.value.id, datos)
    toast.success(`Recibo ${data.data.numeroRecibo} emitido.`)
    modal.value = false
    afiliadoActivo.value = null
    await cargar()
  } catch (err) {
    const msg = err.response?.data?.message || 'Error al cobrar el posfechado.'
    toast.error(msg)
  }
}

function formatearMoneda(n) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })
}

function nombreCompleto(a) {
  return [a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido]
    .filter(Boolean).join(' ')
}

function vencido(fecha) {
  if (!fecha) return false
  return new Date(fecha) < new Date()
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-5">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-gray-800">Pagos posfechados pendientes</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          Marca como cobrados los cheques o transferencias programadas que ya recibiste.
        </p>
      </div>
      <button
        @click="cargar"
        :disabled="cargando"
        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg
               hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
      >
        <svg :class="['w-4 h-4', cargando && 'animate-spin']" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar
      </button>
    </div>

    <!-- Cargando -->
    <div v-if="cargando" class="flex justify-center py-16">
      <div class="flex flex-col items-center gap-3 text-gray-400">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="text-sm">Cargando posfechados...</span>
      </div>
    </div>

    <!-- Sin resultados -->
    <div v-else-if="posfechados.length === 0" class="text-center py-16">
      <svg class="mx-auto w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-500 font-medium">No tienes posfechados pendientes de cobro</p>
    </div>

    <!-- Tabla -->
    <div v-else class="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Afiliado</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Documento</th>
            <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Banco / Referencia</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Valor</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Fecha tentativa</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acción</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          <tr v-for="a in posfechados" :key="a.id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">{{ nombreCompleto(a) }}</p>
              <p class="text-xs text-gray-400">Cel: {{ a.celular }}</p>
            </td>
            <td class="px-4 py-3">
              <p class="text-sm text-gray-700">{{ a.numeroDocumento }}</p>
              <p class="text-xs text-gray-400">{{ a.tipoDocumento }}</p>
            </td>
            <td class="hidden md:table-cell px-4 py-3">
              <p class="text-sm text-gray-700">{{ a.referenciaPago1 || '—' }}</p>
              <p v-if="a.referenciaPago2" class="text-xs text-gray-400">Ref: {{ a.referenciaPago2 }}</p>
            </td>
            <td class="px-4 py-3 text-right">
              <p class="text-sm font-bold text-gray-800">$ {{ formatearMoneda(a.valorRecibido) }}</p>
            </td>
            <td class="px-4 py-3 text-center">
              <span :class="vencido(a.fechaPagoTentativa)
                ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700'
                : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700'">
                {{ a.fechaPagoTentativa || '—' }}
                <span v-if="vencido(a.fechaPagoTentativa)" class="ml-1">⚠️</span>
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                @click="abrirCobro(a)"
                class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white
                       bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Marcar cobrado
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CobrarPosfechadoModal
      :visible="modal"
      :afiliado="afiliadoActivo"
      @cerrar="modal = false"
      @confirmar="confirmarCobro"
    />

  </div>
</template>
