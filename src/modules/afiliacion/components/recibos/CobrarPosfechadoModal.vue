<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  afiliado: { type: Object, default: null }
})
const emit = defineEmits(['cerrar', 'confirmar'])

const banco = ref('')
const referencia = ref('')
const observacion = ref('')
const enviando = ref(false)

watch(() => props.visible, (v) => {
  if (v && props.afiliado) {
    // Pre-cargar con datos existentes del posfechado original
    banco.value = props.afiliado.referenciaPago1 || ''
    referencia.value = props.afiliado.referenciaPago2 || ''
    observacion.value = ''
    enviando.value = false
  }
})

const nombreCompleto = computed(() => {
  const a = props.afiliado
  if (!a) return ''
  return [a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido]
    .filter(Boolean).join(' ')
})

function formatearMoneda(n) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })
}

async function confirmar() {
  if (enviando.value) return
  enviando.value = true
  emit('confirmar', {
    banco: banco.value.trim() || null,
    referencia: referencia.value.trim() || null,
    observacion: observacion.value.trim() || null
  })
}
</script>

<template>
  <div v-if="visible"
       class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
       @click.self="emit('cerrar')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-200 bg-blue-50">
        <h3 class="text-lg font-bold text-blue-800 flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 10h18M7 15h.01M11 15h2m4 0h.01M5 19a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5z" />
          </svg>
          Marcar pago posfechado como cobrado
        </h3>
      </div>

      <div class="p-5 space-y-4">
        <div v-if="afiliado" class="bg-gray-50 rounded-lg p-3 text-sm">
          <p class="font-semibold text-gray-800">{{ nombreCompleto }}</p>
          <p class="text-xs text-gray-500">
            {{ afiliado.tipoDocumento || '' }} {{ afiliado.numeroDocumento }}
          </p>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-xs text-gray-500">Valor pendiente:</span>
            <span class="text-lg font-bold text-blue-700">
              $ {{ formatearMoneda(afiliado.valorRecibido) }}
            </span>
          </div>
          <p v-if="afiliado.fechaPagoTentativa" class="text-xs text-gray-400 mt-1">
            Fecha tentativa original: {{ afiliado.fechaPagoTentativa }}
          </p>
        </div>

        <p class="text-sm text-gray-600">
          Al confirmar, se asignará un número consecutivo de recibo y entrará al
          cuadre de caja del día de hoy. Esta acción no se puede deshacer.
        </p>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Banco</label>
            <input
              v-model="banco"
              type="text"
              placeholder="Ej: Bancolombia"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
            <input
              v-model="referencia"
              type="text"
              placeholder="No. consignación / cheque"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Observación <span class="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            v-model="observacion"
            rows="2"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          ></textarea>
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
          :disabled="enviando"
          class="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
                 rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          <svg v-if="enviando" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Marcar como cobrado
        </button>
      </div>
    </div>
  </div>
</template>
