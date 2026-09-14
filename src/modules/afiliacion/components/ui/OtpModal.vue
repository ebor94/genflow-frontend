<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  visible:       { type: Boolean, default: false },
  celularMasked: { type: String,  default: '' },
  cargando:      { type: Boolean, default: false },
  error:         { type: String,  default: '' }
})

const emit = defineEmits(['verificar', 'reenviar', 'cancel'])

const otp         = ref('')
const countdown   = ref(120)   // 2:00 en segundos
const puedeReenviar = ref(false)
let timer = null

function startCountdown() {
  puedeReenviar.value = false
  countdown.value = 120
  clearInterval(timer)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      puedeReenviar.value = true
    }
  }, 1000)
}

function formatCountdown(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function verificar() {
  if (otp.value.length !== 5 || props.cargando) return
  emit('verificar', otp.value)
}

function reenviar() {
  if (!puedeReenviar.value || props.cargando) return
  otp.value = ''
  emit('reenviar')
  startCountdown()
}

function cancelar() {
  emit('cancel')
}

watch(() => props.visible, (val) => {
  if (val) {
    otp.value = ''
    startCountdown()
  } else {
    clearInterval(timer)
  }
})

onUnmounted(() => clearInterval(timer))
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
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

          <!-- Header -->
          <div class="bg-gradient-to-r from-teal-600 to-emerald-700 px-6 py-5 text-center">
            <div class="mx-auto mb-2 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3" />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-white">Verificación de identidad</h3>
            <p class="text-teal-100 text-xs mt-1">
              Enviamos un código al número<br/>
              <span class="font-semibold text-white tracking-widest">{{ celularMasked }}</span>
            </p>
          </div>

          <!-- Body -->
          <div class="px-6 py-6 space-y-5">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-3 text-center">
                Ingresa el código de 5 dígitos
              </label>
              <input
                v-model="otp"
                type="text"
                inputmode="numeric"
                maxlength="5"
                placeholder="• • • • •"
                class="block w-full text-center text-3xl font-bold tracking-[0.4em] border-2 rounded-xl px-4 py-3
                       focus:outline-none focus:ring-2 transition-colors"
                :class="error
                  ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20 text-red-700'
                  : 'border-gray-300 focus:border-teal-500 focus:ring-teal-500/20 text-gray-800'"
                @input="otp = otp.replace(/\D/g, '').slice(0, 5)"
                @keydown.enter="verificar"
              />
              <p v-if="error" class="mt-2 text-xs text-red-600 text-center flex items-center justify-center gap-1">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                {{ error }}
              </p>
            </div>

            <!-- Countdown / Reenviar -->
            <div class="text-center">
              <p v-if="!puedeReenviar" class="text-xs text-gray-500">
                ¿No recibiste el código? Reenviar en
                <span class="font-semibold text-teal-600">{{ formatCountdown(countdown) }}</span>
              </p>
              <button
                v-else
                @click="reenviar"
                :disabled="cargando"
                class="text-xs font-semibold text-teal-600 hover:text-teal-800 disabled:opacity-50 underline"
              >
                Reenviar código
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 pb-6 flex gap-3">
            <button
              @click="cancelar"
              class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-300
                     text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="verificar"
              :disabled="otp.length !== 5 || cargando"
              class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-colors
                     bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300
                     flex items-center justify-center gap-2"
            >
              <svg v-if="cargando" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ cargando ? 'Verificando...' : 'Verificar' }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>
