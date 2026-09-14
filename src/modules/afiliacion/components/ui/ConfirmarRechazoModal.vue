<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible:  { type: Boolean, default: false },
  afiliado: { type: Object,  default: null }
})

const emit = defineEmits(['confirmar', 'cancel'])

const motivo      = ref('')
const errorMsg    = ref('')
const inputRef    = ref(null)
const selectedIds = ref([])

function nombreCompleto(a) {
  if (!a) return ''
  return [a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido]
    .filter(Boolean).join(' ')
}

function confirmar() {
  if (!motivo.value.trim()) {
    errorMsg.value = 'Ingrese el motivo del rechazo'
    return
  }
  emit('confirmar', {
    motivo: motivo.value.trim(),
    beneficiarioIds: [...selectedIds.value]
  })
}

function cancelar() {
  emit('cancel')
}

watch(() => props.visible, (val) => {
  if (val) {
    motivo.value      = ''
    errorMsg.value    = ''
    selectedIds.value = []
    setTimeout(() => inputRef.value?.focus(), 100)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">

        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="cancelar" />

        <!-- Panel -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

          <!-- Header -->
          <div class="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 rounded-xl p-2.5">
                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-white">Rechazar afiliación</h3>
                <p v-if="afiliado" class="text-red-100 text-sm truncate max-w-xs">
                  {{ nombreCompleto(afiliado) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <p class="text-sm text-gray-600">
              Ingrese el motivo del rechazo. El asesor podrá verlo en su vista de afiliaciones rechazadas.
            </p>

            <!-- Motivo -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1.5">
                Motivo del rechazo <span class="text-red-500">*</span>
              </label>
              <textarea
                ref="inputRef"
                v-model="motivo"
                rows="3"
                placeholder="Ej: Documento ilegible, datos incompletos, falta soporte de pago..."
                class="block w-full rounded-lg border px-3 py-2 text-sm shadow-sm resize-none
                       focus:outline-none focus:ring-2 transition-colors"
                :class="errorMsg
                  ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-red-500 focus:ring-red-500/20'"
                @keydown.ctrl.enter="confirmar"
              />
              <p v-if="errorMsg" class="mt-1 text-xs text-red-600 flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                {{ errorMsg }}
              </p>
              <p class="mt-1.5 text-xs text-gray-400">Ctrl + Enter para confirmar</p>
            </div>

            <!-- Selección de beneficiarios (rechazo parcial) -->
            <div v-if="afiliado?.beneficiarios?.length" class="space-y-2">
              <p class="text-sm font-semibold text-gray-700">
                Beneficiarios a rechazar
                <span class="text-xs font-normal text-gray-400 ml-1">
                  (opcional — sin selección = rechazo total del registro)
                </span>
              </p>
              <div class="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-44 overflow-y-auto">
                <label
                  v-for="b in afiliado.beneficiarios"
                  :key="b.id"
                  class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                  :class="b.activo === 0 ? 'opacity-40 pointer-events-none' : ''"
                >
                  <input
                    type="checkbox"
                    :value="b.id"
                    v-model="selectedIds"
                    :disabled="b.activo === 0"
                    class="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span class="text-sm text-gray-700 flex items-center gap-1.5 flex-wrap">
                    {{ b.primerNombre }} {{ b.primerApellido }}
                    <span
                      class="text-xs rounded px-1.5 py-0.5 font-medium"
                      :class="b.tipoBeneficiario === 'DE_LEY'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-violet-100 text-violet-700'"
                    >
                      {{ b.tipoBeneficiario === 'DE_LEY' ? 'Beneficiario' : 'Adicional' }}
                    </span>
                    <span v-if="b.activo === 0" class="text-xs text-red-500">(ya inactivo)</span>
                  </span>
                </label>
              </div>
              <p v-if="selectedIds.length > 0" class="text-xs text-amber-600 font-medium">
                Se inactivarán {{ selectedIds.length }} beneficiario(s). El afiliado permanecerá pendiente.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
            <button
              @click="cancelar"
              class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-300
                     text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="confirmar"
              class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg text-white
                     bg-red-600 hover:bg-red-700 transition-colors shadow-sm
                     flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {{ selectedIds.length > 0 ? 'Rechazar seleccionados' : 'Confirmar rechazo' }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>
