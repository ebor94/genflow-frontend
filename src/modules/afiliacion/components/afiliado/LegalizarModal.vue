<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible:  { type: Boolean, default: false },
  cantidad: { type: Number, default: 0 }
})

const emit = defineEmits(['confirmar', 'cerrar'])

const numeroPlanilla = ref('')
const error = ref('')

// Limpiar al abrir
watch(() => props.visible, (v) => {
  if (v) { numeroPlanilla.value = ''; error.value = '' }
})

function confirmar() {
  const val = numeroPlanilla.value.trim()
  if (!val) {
    error.value = 'El número de planilla es obligatorio'
    return
  }
  if (val.length > 50) {
    error.value = 'Máximo 50 caracteres'
    return
  }
  error.value = ''
  emit('confirmar', val)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="emit('cerrar')"
      >
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        <!-- Panel -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">

          <!-- Icono + Título -->
          <div class="flex items-center gap-3 mb-5">
            <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900">Legalizar afiliaciones</h3>
              <p class="text-sm text-gray-500">
                Se legalizarán
                <span class="font-semibold text-emerald-700">{{ cantidad }}</span>
                afiliación{{ cantidad !== 1 ? 'es' : '' }}
              </p>
            </div>
          </div>

          <!-- Input número de planilla -->
          <div class="mb-5">
            <label class="block text-sm font-semibold text-gray-700 mb-1">
              Número de planilla <span class="text-red-500">*</span>
            </label>
            <input
              v-model="numeroPlanilla"
              type="text"
              maxlength="50"
              placeholder="Ej. 0042 o PLAN-2026-001"
              class="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition"
              :class="error
                ? 'border-red-400 focus:ring-red-300'
                : 'border-gray-300 focus:ring-emerald-300'"
              @keyup.enter="confirmar"
            />
            <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
            <p class="mt-1 text-xs text-gray-400">
              Este número quedará registrado en todas las afiliaciones seleccionadas.
            </p>
          </div>

          <!-- Botones -->
          <div class="flex gap-3 justify-end">
            <button
              @click="emit('cerrar')"
              class="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              @click="confirmar"
              class="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
            >
              Confirmar legalización
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to        { opacity: 0; }
</style>
