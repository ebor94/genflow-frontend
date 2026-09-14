<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['verified', 'cancel'])

const num1 = ref(0)
const num2 = ref(0)
const operator = ref('+')
const correctAnswer = ref(0)
const userAnswer = ref('')
const errorMsg = ref('')
const attempts = ref(0)
const inputRef = ref(null)

const operators = [
  { symbol: '+', fn: (a, b) => a + b },
  { symbol: '-', fn: (a, b) => a - b },
  { symbol: 'x', fn: (a, b) => a * b }
]

function generateChallenge() {
  const op = operators[Math.floor(Math.random() * operators.length)]
  operator.value = op.symbol

  if (op.symbol === 'x') {
    num1.value = Math.floor(Math.random() * 10) + 1
    num2.value = Math.floor(Math.random() * 10) + 1
  } else if (op.symbol === '-') {
    num1.value = Math.floor(Math.random() * 40) + 10
    num2.value = Math.floor(Math.random() * num1.value)
  } else {
    num1.value = Math.floor(Math.random() * 50) + 1
    num2.value = Math.floor(Math.random() * 50) + 1
  }

  correctAnswer.value = op.fn(num1.value, num2.value)
  userAnswer.value = ''
  errorMsg.value = ''
}

function verify() {
  const parsed = parseInt(userAnswer.value, 10)

  if (isNaN(parsed)) {
    errorMsg.value = 'Ingrese un numero valido'
    return
  }

  if (parsed === correctAnswer.value) {
    attempts.value = 0
    emit('verified')
  } else {
    attempts.value++
    errorMsg.value = `Respuesta incorrecta. Intento ${attempts.value}/3`

    if (attempts.value >= 3) {
      errorMsg.value = 'Demasiados intentos. Se genero una nueva operacion.'
      attempts.value = 0
      generateChallenge()
    }
  }
}

function handleCancel() {
  attempts.value = 0
  emit('cancel')
}

function handleKeydown(e) {
  if (e.key === 'Enter') {
    verify()
  } else if (e.key === 'Escape') {
    handleCancel()
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    generateChallenge()
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
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="handleCancel" />

        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 rounded-lg p-2">
                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-white">Verificacion de seguridad</h3>
                <p class="text-blue-100 text-sm">Resuelva la operacion para continuar</p>
              </div>
            </div>
          </div>

          <!-- Body -->
          <div class="px-6 py-5">
            <!-- Operacion matematica -->
            <div class="bg-gray-50 rounded-xl p-5 text-center mb-4">
              <p class="text-sm text-gray-500 mb-2">Cuanto es:</p>
              <p class="text-4xl font-bold text-gray-800 tracking-wide">
                {{ num1 }}
                <span class="text-blue-600 mx-1">{{ operator }}</span>
                {{ num2 }}
                <span class="text-gray-400 mx-1">=</span>
                <span class="text-blue-600">?</span>
              </p>
            </div>

            <!-- Input -->
            <div>
              <input
                ref="inputRef"
                v-model="userAnswer"
                type="number"
                placeholder="Escriba su respuesta"
                inputmode="numeric"
                @keydown="handleKeydown"
                class="block w-full rounded-lg border-gray-300 shadow-sm text-center text-lg font-semibold
                       focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 py-3"
                :class="{ 'border-red-400': errorMsg }"
              />
              <p v-if="errorMsg" class="mt-2 text-sm text-red-600 text-center font-medium">
                {{ errorMsg }}
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 pb-5 flex gap-3">
            <button
              @click="handleCancel"
              class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-300
                     text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="verify"
              class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg text-white
                     bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              Verificar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
