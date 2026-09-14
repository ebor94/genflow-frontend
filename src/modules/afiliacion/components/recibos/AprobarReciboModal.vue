<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  recibos: { type: Array, default: () => [] }
})
const emit = defineEmits(['cerrar', 'confirmar'])

const observacion = ref('')
const enviando = ref(false)

watch(() => props.visible, (v) => {
  if (v) {
    observacion.value = ''
    enviando.value = false
  }
})

const totalValor = computed(() =>
  props.recibos.reduce((acc, r) => acc + Number(r.valor || 0), 0)
)

const totalPorForma = computed(() => {
  const acc = {}
  for (const r of props.recibos) {
    acc[r.formaPago] = (acc[r.formaPago] || 0) + Number(r.valor || 0)
  }
  return acc
})

function formatearMoneda(n) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })
}

const formaLabel = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CORRESPONSAL: 'Corresponsal',
  POSFECHADO_COBRADO: 'Posfechado cobrado'
}

async function confirmar() {
  if (enviando.value) return
  enviando.value = true
  emit('confirmar', observacion.value.trim() || null)
}
</script>

<template>
  <div v-if="visible"
       class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
       @click.self="emit('cerrar')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-200 bg-green-50">
        <h3 class="text-lg font-bold text-green-800 flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Aprobar recibos seleccionados
        </h3>
      </div>

      <div class="p-5 space-y-4">
        <div class="bg-gray-50 rounded-lg p-3 text-sm">
          <p class="text-gray-700">
            <strong>{{ recibos.length }}</strong> recibo<span v-if="recibos.length !== 1">s</span> seleccionado<span v-if="recibos.length !== 1">s</span>
          </p>
          <p class="text-2xl font-bold text-green-700 mt-1">
            $ {{ formatearMoneda(totalValor) }}
          </p>

          <div v-if="Object.keys(totalPorForma).length > 1" class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div v-for="(monto, forma) in totalPorForma" :key="forma"
                 class="bg-white border border-gray-200 rounded px-2 py-1">
              <p class="text-gray-500">{{ formaLabel[forma] || forma }}</p>
              <p class="font-semibold text-gray-800">$ {{ formatearMoneda(monto) }}</p>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Observación <span class="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            v-model="observacion"
            rows="3"
            placeholder="Ej: cuadre realizado con efectivo entregado en sobre #12"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          ></textarea>
          <p class="text-xs text-gray-400 mt-1">Quedará en la trazabilidad de cada recibo.</p>
        </div>
      </div>

      <div class="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
        <button
          @click="emit('cerrar')"
          :disabled="enviando"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg
                 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          @click="confirmar"
          :disabled="enviando || recibos.length === 0"
          class="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700
                 rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          <svg v-if="enviando" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Aprobar
        </button>
      </div>
    </div>
  </div>
</template>
