<script setup>
const props = defineProps({
  visible:   { type: Boolean, default: false },
  afiliado:  { type: Object,  default: null  },
  registros: { type: Array,   default: () => [] },
  cargando:  { type: Boolean, default: false }
})
defineEmits(['close'])

const TIPO_CONFIG = {
  APROBACION:                { label: 'Aprobación',          bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  RECHAZO_TOTAL:             { label: 'Rechazo total',        bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500'     },
  RECHAZO_PARCIAL:           { label: 'Rechazo parcial',      bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500'  },
  ACTUALIZACION_BENEFICIARIOS:{ label: 'Act. beneficiarios',  bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  ACTUALIZACION_DATOS:       { label: 'Act. datos contacto',  bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-400'    },
  CONSULTA:                  { label: 'Consulta pública',     bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400'    }
}

function tipoConf(tipo) {
  return TIPO_CONFIG[tipo] || { label: tipo, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
}

function formatFecha(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function nombreCompleto(a) {
  if (!a) return 'Acción pública'
  return [a.nombre, a.email].filter(Boolean).join(' · ')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="$emit('close')"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('close')" />

        <!-- Panel -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

          <!-- Header -->
          <div class="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100">
            <div>
              <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75" />
                </svg>
                Trazabilidad
              </h2>
              <p v-if="afiliado" class="text-sm text-gray-500 mt-0.5">
                {{ [afiliado.primerNombre, afiliado.primerApellido].filter(Boolean).join(' ') }}
                · {{ afiliado.numeroDocumento }}
              </p>
            </div>
            <button
              @click="$emit('close')"
              class="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="overflow-y-auto flex-1 px-6 py-5">

            <!-- Loading -->
            <div v-if="cargando" class="flex justify-center items-center py-16">
              <svg class="animate-spin w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>

            <!-- Sin registros -->
            <div v-else-if="registros.length === 0" class="text-center py-14 text-gray-400">
              <svg class="mx-auto w-10 h-10 mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p class="text-sm">Sin registros de trazabilidad</p>
            </div>

            <!-- Timeline -->
            <ol v-else class="relative border-l border-gray-200 ml-3 space-y-0">
              <li
                v-for="(r, i) in registros"
                :key="r.id || i"
                class="mb-6 ml-5"
              >
                <!-- Dot -->
                <span
                  :class="['absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white', tipoConf(r.tipo).dot]"
                />

                <!-- Contenido -->
                <div class="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                  <div class="flex items-start justify-between gap-2 flex-wrap">
                    <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', tipoConf(r.tipo).bg, tipoConf(r.tipo).text]">
                      {{ tipoConf(r.tipo).label }}
                    </span>
                    <time class="text-xs text-gray-400 flex-shrink-0">{{ formatFecha(r.createdAt) }}</time>
                  </div>
                  <p v-if="r.descripcion" class="text-sm text-gray-700 mt-2 leading-relaxed">
                    {{ r.descripcion }}
                  </p>
                  <p class="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    {{ r.usuario ? nombreCompleto(r.usuario) : 'Acción pública' }}
                  </p>
                </div>
              </li>
            </ol>

          </div>

          <!-- Footer -->
          <div class="px-6 py-3 border-t border-gray-100 flex justify-between items-center">
            <p class="text-xs text-gray-400">{{ registros.length }} registro{{ registros.length !== 1 ? 's' : '' }}</p>
            <button
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
