<script setup>
import { computed, watch, ref } from 'vue'
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'
import { useToastStore } from '@afi/stores/useToastStore'
import { buscarTarifa } from '@afi/api/afiliadoApi'
import BaseSelect from '@afi/components/ui/BaseSelect.vue'
import BaseInput from '@afi/components/ui/BaseInput.vue'

const store = useAfiliadoStore()
const toast = useToastStore()

// ── Tarifa activa ─────────────────────────────────────────────
const buscandoTarifa = ref(false)

// Recalcular cada vez que cambien canal / producto / grupo / asistencia.
// immediate: true para que al montar (modo corrección/borrador) busque
// la tarifa con los valores ya hidratados.
watch(
  () => [
    store.afiliado.canal,
    store.afiliado.producto,
    store.afiliado.grupo,
    store.afiliado.asistenciaFueraDeCasa
  ],
  async ([canal, producto, grupo, asistencia]) => {
    if (!canal || !producto || !grupo) {
      store.tarifaActiva = null
      recalcular(null)
      return
    }
    buscandoTarifa.value = true
    try {
      const { data } = await buscarTarifa({ canal, producto, grupo, asistenciaFueraDeCasa: asistencia || 'NO' })
      if (data.success && data.data) {
        store.tarifaActiva = data.data
        store.contrato.tarifaId = data.data.id
        recalcular(data.data)
      } else {
        store.tarifaActiva = null
        recalcular(null)
      }
    } catch {
      store.tarifaActiva = null
      recalcular(null)
    } finally {
      buscandoTarifa.value = false
    }
  },
  { immediate: true }
)

// Recalcular cuando cambian adicionales (incluyendo valorPorPersona), seguros o nCuotas
// La periodicidad NO afecta el cálculo — solo se almacena
watch(
  () => [
    store.beneficiariosAdicional.map(b => b.valorPorPersona),
    store.beneficiariosAdicional.map(b => b.estado),
    store.seguros.map(s => s.prima),
    store.contrato.nCuotas
  ],
  () => recalcular(store.tarifaActiva),
  { deep: true }
)

// También cuando cambia el número de adicionales o seguros
watch(
  () => [store.beneficiariosAdicional.length, store.seguros.length],
  () => recalcular(store.tarifaActiva)
)

function recalcular(tarifa) {
  const n = Math.max(1, parseInt(store.contrato.nCuotas) || 1)

  // Plan base: valorBase es valor anual — se divide entre nCuotas para obtener la cuota
  const valorPlanExequial = tarifa ? +parseFloat(tarifa.valorBase).toFixed(2) : 0

  // Adicionales: suma de valorPorPersona anual por persona — excluye RETIRO
  const valorAdicionales = +store.beneficiariosAdicional
    .filter(b => b.estado !== 'RETIRO')
    .reduce((sum, b) => sum + (parseFloat(b.valorPorPersona) || 0), 0)
    .toFixed(2)

  // Asistencia: valor anual fijo — no varía con las cuotas
  const valorAsistencia = (tarifa?.valorAsistencia && parseFloat(tarifa.valorAsistencia) > 0)
    ? +parseFloat(tarifa.valorAsistencia).toFixed(2)
    : 0

  // Seguros: prima anual — se divide entre nCuotas para obtener la cuota
  const valorSeguros = +store.seguros
    .reduce((s, seg) => s + (parseFloat(seg.prima) || 0), 0)
    .toFixed(2)

  const valorTotal = +(valorPlanExequial + valorAdicionales + valorAsistencia + valorSeguros).toFixed(2)
  const valorCuota = n > 0 ? +(valorTotal / n).toFixed(2) : valorTotal

  store.updateContrato({ valorPlanExequial, valorAdicionales, valorAsistencia, valorSeguros, valorTotal, valorCuota })
}

// ── Helpers ───────────────────────────────────────────────────
function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(v || 0)
}

const opcionesPeriodicidad = [
  { value: 'MENSUAL',     label: 'Mensual' },
  { value: 'ANUAL',       label: 'Anual' },
  { value: 'TRIMESTRAL',  label: 'Trimestral' },
  { value: 'SEMESTRAL',   label: 'Semestral' },
  { value: 'SEMANAL',     label: 'Semanal' }
]

const sinTarifa = computed(() =>
  !store.tarifaActiva && store.afiliado.canal && store.afiliado.producto && store.afiliado.grupo
)

const tieneAsistencia = computed(() =>
  store.tarifaActiva?.valorAsistencia && parseFloat(store.tarifaActiva.valorAsistencia) > 0
)
</script>

<template>
  <fieldset class="bg-white rounded-xl border border-indigo-200 shadow-sm p-5">
    <legend class="text-base font-bold text-indigo-800 px-2">Valor del Contrato</legend>

    <!-- Aviso sin tarifa -->
    <div v-if="sinTarifa"
         class="mt-2 mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
      <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      No se encontro tarifa para la combinacion Canal / Producto / Grupo seleccionada. Los valores se mostraran en cero.
    </div>

    <!-- Buscando tarifa spinner -->
    <div v-if="buscandoTarifa" class="flex items-center gap-2 mt-2 mb-4 text-sm text-blue-600">
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      Consultando tarifa...
    </div>

    <!-- Tarifa aplicada -->
    <div v-if="store.tarifaActiva && !buscandoTarifa"
         class="mt-2 mb-4 flex flex-wrap gap-2 text-xs text-gray-500">
      <span class="bg-indigo-50 text-indigo-700 rounded px-2 py-1 font-medium">
        Tarifa base: {{ formatCOP(store.tarifaActiva.valorBase) }}
      </span>
      <span class="bg-indigo-50 text-indigo-700 rounded px-2 py-1 font-medium">
        Adicional &lt;50 años: {{ formatCOP(store.tarifaActiva.valorAdicional) }}/año
      </span>
      <span class="bg-indigo-50 text-indigo-700 rounded px-2 py-1 font-medium">
        Adicional 50–65 años: {{ formatCOP(store.tarifaActiva.valorAdicionalMayor50) }}/año
      </span>
      <span v-if="tieneAsistencia" class="bg-green-50 text-green-700 rounded px-2 py-1 font-medium">
        Asistencia: {{ formatCOP(store.tarifaActiva.valorAsistencia) }}/año
      </span>
    </div>

    <!-- Periodicidad y cuotas -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      <BaseSelect
        v-model="store.contrato.periodicidad"
        label="Periodicidad"
        :options="opcionesPeriodicidad"
      />

      <BaseInput
        v-model="store.contrato.nCuotas"
        label="N° de cuotas"
        type="number"
        min="1"
        placeholder="1"
      />
    </div>

    <!-- Tabla resumen de valores -->
    <div class="mt-5 overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="bg-indigo-50 text-indigo-900">
            <th class="border border-indigo-200 px-4 py-2 text-left">Concepto</th>
            <th class="border border-indigo-200 px-4 py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          <!-- Plan exequial -->
          <tr class="hover:bg-gray-50">
            <td class="border border-gray-200 px-4 py-2">
              <div class="font-medium">Plan Exequial</div>
              <div v-if="store.tarifaActiva" class="text-xs text-gray-400">
                Valor anual: {{ formatCOP(store.tarifaActiva.valorBase) }}
              </div>
            </td>
            <td class="border border-gray-200 px-4 py-2 text-right font-semibold">
              {{ formatCOP(store.contrato.valorPlanExequial) }}
            </td>
          </tr>

          <!-- Beneficiarios adicionales -->
          <tr class="hover:bg-gray-50">
            <td class="border border-gray-200 px-4 py-2">
              <div class="font-medium">Beneficiarios adicionales</div>
              <div class="text-xs text-gray-400">
                <span v-if="store.beneficiariosAdicional.filter(b => b.estado !== 'RETIRO').length > 0">
                  {{ store.beneficiariosAdicional.filter(b => b.estado !== 'RETIRO').length }} persona(s) activa(s) — valor anual por persona
                </span>
                <span v-else>Sin adicionales activos</span>
                <span v-if="store.beneficiariosAdicional.some(b => b.estado === 'RETIRO')" class="text-red-400 ml-1">
                  ({{ store.beneficiariosAdicional.filter(b => b.estado === 'RETIRO').length }} en retiro excluido{{ store.beneficiariosAdicional.filter(b => b.estado === 'RETIRO').length > 1 ? 's' : '' }})
                </span>
              </div>
            </td>
            <td class="border border-gray-200 px-4 py-2 text-right font-semibold">
              {{ formatCOP(store.contrato.valorAdicionales) }}
            </td>
          </tr>

          <!-- Asistencia fuera de casa (solo si aplica) -->
          <tr v-if="tieneAsistencia" class="hover:bg-gray-50">
            <td class="border border-gray-200 px-4 py-2">
              <div class="font-medium">Asistencia fuera de casa</div>
              <div class="text-xs text-gray-400">Valor anual fijo (no varía con las cuotas)</div>
            </td>
            <td class="border border-gray-200 px-4 py-2 text-right font-semibold">
              {{ formatCOP(store.contrato.valorAsistencia) }}
            </td>
          </tr>

          <!-- Seguros -->
          <tr class="hover:bg-gray-50">
            <td class="border border-gray-200 px-4 py-2">
              <div class="font-medium">Seguros</div>
              <div class="text-xs text-gray-400">
                {{ store.seguros.length }} seguro(s)
                <span v-if="store.seguros.length > 0"> — valor anual</span>
              </div>
            </td>
            <td class="border border-gray-200 px-4 py-2 text-right font-semibold">
              {{ formatCOP(store.contrato.valorSeguros) }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <!-- Valor total -->
          <tr class="bg-indigo-600 text-white">
            <td class="border border-indigo-500 px-4 py-3 font-bold text-base">
              VALOR TOTAL
            </td>
            <td class="border border-indigo-500 px-4 py-3 text-right font-bold text-base">
              {{ formatCOP(store.contrato.valorTotal) }}
            </td>
          </tr>

          <!-- Valor cuota -->
          <tr class="bg-indigo-50">
            <td class="border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-800">
              Valor por cuota
              <span class="text-xs font-normal text-gray-500 ml-1">
                ({{ store.contrato.nCuotas }} cuota{{ store.contrato.nCuotas > 1 ? 's' : '' }})
              </span>
            </td>
            <td class="border border-indigo-200 px-4 py-2 text-right font-bold text-indigo-800">
              {{ formatCOP(store.contrato.valorCuota) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

  </fieldset>
</template>
