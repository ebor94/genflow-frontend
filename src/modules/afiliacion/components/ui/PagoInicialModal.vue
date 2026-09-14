<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  visible:    { type: Boolean, default: false },
  valorCuota: { type: Number,  default: 0 }
})

const emit = defineEmits(['confirmar', 'cancel'])

// ── Estado interno ─────────────────────────────────────────────
const formaPago        = ref('')
const valorRecibido    = ref('')
const soporteFile      = ref(null)
const soportePreview   = ref(null) // string base64 o 'pdf'
const banco            = ref('')
const referencia2      = ref('')
const referencia3      = ref('')
const fechaTentativa   = ref('')
const fileInputRef     = ref(null)
const errores          = ref({})

const opcionesPago = [
  { value: 'EFECTIVO',      label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia bancaria' },
  { value: 'CORRESPONSAL',  label: 'Corresponsal bancario' },
  { value: 'POSFECHADO',    label: 'Pago posfechado' }
]

const opcionesBanco = [
  'BANCOLOMBIA', 'NEQUI', 'DAVIPLATA', 'BOGOTÁ',
  'DAVIVIENDA', 'AGRARIO', 'CREDISERVIR', 'COOPCENTRAL'
]

const requiereBanco = computed(() =>
  formaPago.value === 'TRANSFERENCIA' || formaPago.value === 'POSFECHADO'
)

// ── Manejo de archivo ──────────────────────────────────────────
function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
  if (!allowed.includes(file.type)) {
    errores.value.soporte = 'Solo se permiten imágenes JPG, PNG o PDF'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errores.value.soporte = 'El archivo no debe superar 5 MB'
    return
  }

  soporteFile.value = file
  errores.value.soporte = ''

  if (file.type === 'application/pdf') {
    soportePreview.value = 'pdf'
  } else {
    const reader = new FileReader()
    reader.onload = (ev) => { soportePreview.value = ev.target.result }
    reader.readAsDataURL(file)
  }
}

function limpiarSoporte() {
  soporteFile.value   = null
  soportePreview.value = null
  errores.value.soporte = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// ── Validación ─────────────────────────────────────────────────
function validar() {
  errores.value = {}
  if (!formaPago.value) errores.value.formaPago = 'Seleccione la forma de pago'
  // Soporte obligatorio para TRANSFERENCIA y CORRESPONSAL (no para EFECTIVO ni POSFECHADO)
  const requiereSoporte = formaPago.value === 'TRANSFERENCIA' || formaPago.value === 'CORRESPONSAL'
  if (!soporteFile.value && requiereSoporte) {
    errores.value.soporte = 'Adjunte el soporte de pago'
  }
  if (requiereBanco.value && !banco.value) {
    errores.value.banco = 'Seleccione el banco'
  }
  if (formaPago.value === 'POSFECHADO' && !fechaTentativa.value) {
    errores.value.fechaTentativa = 'Ingrese la fecha tentativa de pago'
  }
  return Object.keys(errores.value).length === 0
}

// ── Acciones ───────────────────────────────────────────────────
function confirmar() {
  if (!validar()) return
  emit('confirmar', {
    formaPago:          formaPago.value,
    soporteFile:        soporteFile.value,
    valorRecibido:      valorRecibido.value !== '' ? parseFloat(valorRecibido.value) : null,
    referenciaPago1:    banco.value,
    referenciaPago2:    referencia2.value.trim(),
    referenciaPago3:    referencia3.value.trim(),
    fechaPagoTentativa: fechaTentativa.value || null
  })
}

function cancelar() {
  emit('cancel')
}

// ── Reset al abrir el modal ────────────────────────────────────
watch(() => props.visible, (val) => {
  if (val) {
    formaPago.value      = ''
    valorRecibido.value  = ''
    soporteFile.value    = null
    soportePreview.value = null
    banco.value          = ''
    referencia2.value    = ''
    referencia3.value    = ''
    fechaTentativa.value = ''
    errores.value        = {}
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
})

// ── Formato COP ────────────────────────────────────────────────
function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(v || 0)
}
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
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-hidden">

          <!-- ── Header ─────────────────────────────────────────── -->
          <div class="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-4 flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 rounded-xl p-2.5">
                <!-- receipt icon -->
                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-white">Registro de Primera Cuota</h3>
                <p class="text-green-100 text-sm mt-0.5">
                  Valor a cobrar:
                  <span class="font-bold text-white text-base">{{ formatCOP(valorCuota) }}</span>
                </p>
              </div>
            </div>
          </div>

          <!-- ── Body ──────────────────────────────────────────── -->
          <div class="px-6 py-5 overflow-y-auto flex-1 space-y-5">

            <!-- Forma de pago -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1.5">
                Forma de pago <span class="text-red-500">*</span>
              </label>
              <select
                v-model="formaPago"
                class="block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm bg-white
                       focus:outline-none focus:ring-2 transition-colors"
                :class="errores.formaPago
                  ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'"
              >
                <option value="">-- Seleccione --</option>
                <option v-for="op in opcionesPago" :key="op.value" :value="op.value">
                  {{ op.label }}
                </option>
              </select>
              <p v-if="errores.formaPago" class="mt-1 text-xs text-red-600 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                {{ errores.formaPago }}
              </p>
            </div>

            <!-- Valor recibido -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1.5">
                Valor recibido
                <span class="text-gray-400 font-normal ml-1">(opcional — si difiere del valor de la cuota)</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">$</span>
                <input
                  v-model="valorRecibido"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Ej: 28500"
                  class="block w-full rounded-lg border border-gray-300 pl-7 pr-4 py-2.5 text-sm
                         focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                />
              </div>
            </div>

            <!-- Soporte de pago -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1.5">
                Foto / soporte del pago
                <span v-if="formaPago === 'TRANSFERENCIA' || formaPago === 'CORRESPONSAL'" class="text-red-500">*</span>
                <span v-else class="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>

              <!-- Preview imagen -->
              <div v-if="soportePreview && soportePreview !== 'pdf'" class="mb-3 relative inline-block">
                <img
                  :src="soportePreview"
                  alt="Soporte de pago"
                  class="max-h-52 max-w-full rounded-xl border border-gray-200 object-contain shadow-sm"
                />
                <button
                  @click="limpiarSoporte"
                  class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6
                         flex items-center justify-center shadow-md transition-colors"
                  title="Quitar imagen"
                >
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Preview PDF -->
              <div v-else-if="soportePreview === 'pdf'"
                   class="mb-3 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <svg class="w-9 h-9 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-800 truncate">{{ soporteFile?.name }}</p>
                  <p class="text-xs text-gray-500">PDF · {{ soporteFile ? (soporteFile.size / 1024).toFixed(0) : 0 }} KB</p>
                </div>
                <button @click="limpiarSoporte"
                        class="text-red-500 hover:text-red-700 p-1 flex-shrink-0 transition-colors" title="Quitar archivo">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Zona de carga (visible si no hay archivo) -->
              <div
                v-if="!soportePreview"
                class="border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all"
                :class="errores.soporte
                  ? 'border-red-400 bg-red-50 hover:border-red-500'
                  : 'border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50'"
                @click="fileInputRef?.click()"
              >
                <svg class="mx-auto w-10 h-10 mb-2"
                     :class="errores.soporte ? 'text-red-400' : 'text-gray-400'"
                     fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                </svg>
                <p class="text-sm font-semibold"
                   :class="errores.soporte ? 'text-red-700' : 'text-gray-600'">
                  Haga clic para adjuntar el soporte
                </p>
                <p class="text-xs text-gray-400 mt-1">JPG · PNG · PDF · Máximo 5 MB</p>
              </div>

              <!-- Input oculto -->
              <input
                ref="fileInputRef"
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                class="hidden"
                @change="handleFileChange"
              />

              <p v-if="errores.soporte" class="mt-1 text-xs text-red-600 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                {{ errores.soporte }}
              </p>
            </div>

            <!-- Banco (para TRANSFERENCIA y POSFECHADO) -->
            <div v-if="requiereBanco">
              <label class="block text-sm font-semibold text-gray-700 mb-1.5">
                Banco <span class="text-red-500">*</span>
              </label>
              <select
                v-model="banco"
                class="block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm bg-white
                       focus:outline-none focus:ring-2 transition-colors"
                :class="errores.banco
                  ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'"
              >
                <option value="">-- Seleccione banco --</option>
                <option v-for="b in opcionesBanco" :key="b" :value="b">{{ b }}</option>
              </select>
              <p v-if="errores.banco" class="mt-1 text-xs text-red-600">{{ errores.banco }}</p>
            </div>

            <!-- Fecha tentativa (solo POSFECHADO) -->
            <div v-if="formaPago === 'POSFECHADO'">
              <label class="block text-sm font-semibold text-gray-700 mb-1.5">
                Fecha tentativa de pago <span class="text-red-500">*</span>
              </label>
              <input
                v-model="fechaTentativa"
                type="date"
                class="block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm bg-white
                       focus:outline-none focus:ring-2 transition-colors"
                :class="errores.fechaTentativa
                  ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'"
              />
              <p v-if="errores.fechaTentativa" class="mt-1 text-xs text-red-600">{{ errores.fechaTentativa }}</p>
            </div>

            <!-- Referencias opcionales -->
            <div>
              <p class="text-sm font-semibold text-gray-700 mb-2">
                Referencias
                <span class="text-gray-400 font-normal ml-1">(opcionales)</span>
              </p>
              <div class="space-y-2">
                <input
                  v-model="referencia2"
                  type="text"
                  placeholder="Referencia — No. transacción, recibo, comprobante..."
                  class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400
                         focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                />
                <input
                  v-model="referencia3"
                  type="text"
                  placeholder="Referencia adicional"
                  class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400
                         focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                />
              </div>
            </div>

          </div><!-- /body -->

          <!-- ── Footer ─────────────────────────────────────────── -->
          <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 flex-shrink-0">
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
                     bg-green-600 hover:bg-green-700 transition-colors shadow-sm
                     flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Confirmar y continuar
            </button>
          </div>

        </div><!-- /panel -->
      </div>
    </Transition>
  </Teleport>
</template>
