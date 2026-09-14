<template>
  <div class="min-h-screen relative flex items-center justify-center p-4 bg-gradient-to-br from-green-950 via-green-900 to-emerald-900 overflow-hidden">

    <!-- Círculos decorativos de fondo -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-white/5 rounded-full"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-white/5 rounded-full"></div>
    <div class="absolute top-1/2 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full -translate-y-1/2"></div>

    <div class="relative w-full max-w-md">

      <!-- Card del formulario -->
      <div class="bg-white rounded-2xl shadow-2xl overflow-hidden">

        <!-- Barra superior decorativa -->
        <div class="h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-green-600"></div>

        <div class="p-8">
          <!-- Logo dentro de la card -->
          <div class="text-center mb-7">
            <img
              src="https://cucuta.losolivos.co/wp-content/uploads/2023/07/Logo-OLIVOS.webp"
              alt="Logo Los Olivos"
              class="h-20 w-auto object-contain mx-auto mb-3"
            />
            <h1 class="text-gray-800 text-lg font-bold tracking-tight">Sistema de Afiliaciones</h1>
            <p class="text-gray-400 text-xs mt-0.5">SERFUNORTE · Los Olivos · Cúcuta</p>
          </div>

          <h2 class="text-gray-800 text-lg font-semibold mb-6">Iniciar sesión</h2>

          <form @submit.prevent="handleLogin" class="space-y-5">

            <!-- Usuario -->
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Usuario</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  v-model="form.email"
                  type="text"
                  autocomplete="username"
                  placeholder="Ingresa tu usuario"
                  :disabled="cargando"
                  class="w-full pl-10 pr-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent focus:bg-white disabled:opacity-60 transition-all"
                />
              </div>
            </div>

            <!-- Contraseña -->
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contraseña</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  v-model="form.password"
                  :type="mostrarPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  :disabled="cargando"
                  class="w-full pl-10 pr-11 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent focus:bg-white disabled:opacity-60 transition-all"
                />
                <button
                  type="button"
                  @click="mostrarPassword = !mostrarPassword"
                  class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg v-if="!mostrarPassword" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Error -->
            <transition name="fade">
              <div
                v-if="errorMsg"
                class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl"
              >
                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {{ errorMsg }}
              </div>
            </transition>

            <!-- Botón -->
            <button
              type="submit"
              :disabled="cargando || !form.email || !form.password"
              class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white font-semibold text-sm rounded-xl shadow-lg shadow-green-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              <svg v-if="cargando" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ cargando ? 'Ingresando...' : 'Ingresar' }}
            </button>

            <div class="flex items-center gap-3 my-2">
              <div class="flex-1 h-px bg-gray-200"></div>
              <span class="text-[10px] text-gray-400 uppercase tracking-wider">o</span>
              <div class="flex-1 h-px bg-gray-200"></div>
            </div>

            <button
              type="button"
              @click="entrarConPortal"
              :disabled="cargando"
              class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white hover:bg-gray-50 text-green-800 font-semibold text-sm rounded-xl border-2 border-green-700/30 transition-all duration-200 disabled:opacity-50"
            >
              🌿 Iniciar sesión con Portal Serfunorte
            </button>

          </form>
        </div>
      </div>

      <!-- Footer -->
      <p class="text-center text-green-400/70 text-xs mt-6">
        © {{ new Date().getFullYear() }} Los Olivos · Sistema de Afiliados
      </p>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@afi/stores/useAuthStore'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({ email: '', password: '' })
const cargando = ref(false)
const errorMsg = ref('')
const mostrarPassword = ref(false)

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'https://losolivoscucuta.com/portal'
function entrarConPortal() {
  window.location.href = `${PORTAL_URL}/login?next=afiliaciones`
}

async function handleLogin() {
  errorMsg.value = ''
  cargando.value = true
  try {
    await authStore.login(form.email, form.password)
    router.push(authStore.rutaInicio())
  } catch (err) {
    const status = err.response?.status
    if (status === 401 || status === 400) {
      errorMsg.value = 'Usuario o contraseña incorrectos.'
    } else {
      errorMsg.value = 'Error de conexión. Intenta de nuevo.'
    }
  } finally {
    cargando.value = false
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
