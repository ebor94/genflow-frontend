<script setup>
import { ref, computed, watch } from 'vue'
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'

const store = useAfiliadoStore()

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const abierto            = ref(true)
const _soportePreviewLocal = ref(null)   // DataURL del File local
const fileInputRef       = ref(null)
const errores            = ref({})

// Fallback a URL del servidor cuando no hay preview local
const soportePreview = computed(() =>
  _soportePreviewLocal.value
    || (store.soportePagoUrl ? `${API_URL}/uploads/${store.soportePagoUrl}` : null)
)

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

// Corresponsal bancario es un servicio físico de oficina, las billeteras
// digitales (Nequi, Daviplata) no aplican como corresponsal.
const BANCOS_SIN_BILLETERAS = opcionesBanco.filter(
  b => b !== 'NEQUI' && b !== 'DAVIPLATA'
)

const requiereBanco = computed(() =>
  store.pago.formaPago === 'TRANSFERENCIA'
  || store.pago.formaPago === 'POSFECHADO'
  || store.pago.formaPago === 'CORRESPONSAL'
)

const bancosDisponibles = computed(() =>
  store.pago.formaPago === 'CORRESPONSAL' ? BANCOS_SIN_BILLETERAS : opcionesBanco
)

// Si cambia a CORRESPONSAL teniendo NEQUI/DAVIPLATA seleccionado, limpiar
// para que el usuario elija un banco válido.
watch(() => store.pago.formaPago, (forma) => {
  if (forma === 'CORRESPONSAL'
      && (store.pago.referenciaPago1 === 'NEQUI' || store.pago.referenciaPago1 === 'DAVIPLATA')) {
    store.pago.referenciaPago1 = ''
  }
})

// ── Limpiar errores en vivo al corregir cada campo ──────────────
// Si no, el badge "N campos requeridos" sigue contando errores ya
// resueltos hasta que se haga otra llamada a validar().
watch(() => store.pago.formaPago, (v) => {
  if (v) delete errores.value.formaPago
})
watch(() => store.pago.referenciaPago1, (v) => {
  if (v) delete errores.value.banco
})
watch(() => store.pago.fechaPagoTentativa, (v) => {
  if (v) delete errores.value.fechaTentativa
})

const tieneContenido = computed(() =>
  store.pago.formaPago || store.pago.soporteFile
)

// Cuenta solo errores con texto no vacío (por si quedó una key con '')
const erroresActivos = computed(() =>
  Object.values(errores.value).filter(v => v && String(v).trim().length).length
)

// ── Manejo de archivo ─────────────────────────────────────────
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

  store.pago.soporteFile = file
  store.soportePagoUrl   = ''          // invalidar URL del servidor al subir nuevo
  delete errores.value.soporte

  if (file.type === 'application/pdf') {
    _soportePreviewLocal.value = 'pdf'
  } else {
    const reader = new FileReader()
    reader.onload = (ev) => { _soportePreviewLocal.value = ev.target.result }
    reader.readAsDataURL(file)
  }
}

function limpiarSoporte() {
  store.pago.soporteFile  = null
  store.soportePagoUrl    = ''
  _soportePreviewLocal.value = null
  delete errores.value.soporte
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// ── Validación (llamada desde RegistroView antes de enviar) ───
function validar() {
  errores.value = {}
  if (!store.pago.formaPago)
    errores.value.formaPago = 'Seleccione la forma de pago'

  const requiereSoporte =
    store.pago.formaPago === 'TRANSFERENCIA' || store.pago.formaPago === 'CORRESPONSAL'
  if (requiereSoporte && !store.pago.soporteFile)
    errores.value.soporte = 'Adjunte el soporte de pago'

  if (requiereBanco.value && !store.pago.referenciaPago1)
    errores.value.banco = 'Seleccione el banco'

  if (store.pago.formaPago === 'POSFECHADO' && !store.pago.fechaPagoTentativa)
    errores.value.fechaTentativa = 'Ingrese la fecha tentativa de pago'

  const ok = Object.keys(errores.value).length === 0
  if (!ok) abierto.value = true  // expandir si hay errores
  return ok
}

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(v || 0)
}

defineExpose({ validar })
</script>

<template>
  <fieldset class="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">

    <!-- Cabecera colapsable -->
    <button
      type="button"
      @click="abierto = !abierto"
      class="w-full flex items-center justify-between px-5 py-4 text-left
             hover:bg-green-50 transition-colors focus:outline-none"
    >
      <div class="flex items-center gap-2.5">
        <!-- receipt icon -->
        <svg class="w-5 h-5 text-green-700 flex-shrink-0" fill="none" viewBox="0 0 24 24"
             stroke-width="1.8" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057
               1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
        </svg>
        <span class="text-base font-bold text-green-800">Primer Pago</span>
        <!-- badge si ya tiene forma de pago -->
        <span v-if="tieneContenido && !abierto"
              class="text-xs bg-green-100 text-green-700 font-medium rounded-full px-2 py-0.5">
          {{ store.pago.formaPago }}
        </span>
        <!-- indicador de errores: solo cuenta claves con texto no vacío -->
        <span v-if="erroresActivos > 0"
              class="text-xs bg-red-100 text-red-700 font-medium rounded-full px-2 py-0.5">
          {{ erroresActivos }} campo{{ erroresActivos > 1 ? 's' : '' }} requerido{{ erroresActivos > 1 ? 's' : '' }}
        </span>
      </div>
      <!-- chevron -->
      <svg class="w-5 h-5 text-green-600 transition-transform duration-200"
           :class="abierto ? 'rotate-180' : ''"
           fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>

    <!-- Contenido colapsable -->
    <div v-show="abierto" class="px-5 pb-5 space-y-5 border-t border-green-100">

      <!-- Info: valor de la cuota -->
      <div class="mt-4 flex flex-wrap items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <svg class="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24"
             stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125
               1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504
               1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75
               0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
        <span class="text-sm text-green-700">Valor de la cuota a cobrar:</span>
        <span class="font-bold text-green-800 text-base">{{ formatCOP(store.contrato.valorCuota) }}</span>
      </div>

      <!-- Forma de pago -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">
          Forma de pago <span class="text-red-500">*</span>
        </label>
        <select
          v-model="store.pago.formaPago"
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
            <path fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd" />
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
            v-model="store.pago.valorRecibido"
            type="number"
            min="0"
            step="100"
            placeholder="Ej: 28500"
            class="block w-full rounded-lg border border-gray-300 pl-7 pr-4 py-2.5 text-sm
                   focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
          />
        </div>
      </div>

      <!-- Banco (para TRANSFERENCIA, POSFECHADO y CORRESPONSAL).
           En CORRESPONSAL se excluyen NEQUI y DAVIPLATA por ser billeteras
           digitales y no servicios de corresponsal bancario. -->
      <div v-if="requiereBanco">
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">
          Banco <span class="text-red-500">*</span>
        </label>
        <select
          v-model="store.pago.referenciaPago1"
          class="block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm bg-white
                 focus:outline-none focus:ring-2 transition-colors"
          :class="errores.banco
            ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20'
            : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'"
        >
          <option value="">-- Seleccione banco --</option>
          <option v-for="b in bancosDisponibles" :key="b" :value="b">{{ b }}</option>
        </select>
        <p v-if="errores.banco" class="mt-1 text-xs text-red-600">{{ errores.banco }}</p>
      </div>

      <!-- Fecha tentativa (solo POSFECHADO) -->
      <div v-if="store.pago.formaPago === 'POSFECHADO'">
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">
          Fecha tentativa de pago <span class="text-red-500">*</span>
        </label>
        <input
          v-model="store.pago.fechaPagoTentativa"
          type="date"
          class="block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm bg-white
                 focus:outline-none focus:ring-2 transition-colors"
          :class="errores.fechaTentativa
            ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20'
            : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'"
        />
        <p v-if="errores.fechaTentativa" class="mt-1 text-xs text-red-600">{{ errores.fechaTentativa }}</p>
      </div>

      <!-- Soporte de pago -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">
          Foto / soporte del pago
          <span v-if="store.pago.formaPago === 'TRANSFERENCIA' || store.pago.formaPago === 'CORRESPONSAL'"
                class="text-red-500">*</span>
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
          <svg class="w-9 h-9 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24"
               stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0
                 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0
                 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800 truncate">{{ store.pago.soporteFile?.name }}</p>
            <p class="text-xs text-gray-500">
              PDF · {{ store.pago.soporteFile ? (store.pago.soporteFile.size / 1024).toFixed(0) : 0 }} KB
            </p>
          </div>
          <button @click="limpiarSoporte"
                  class="text-red-500 hover:text-red-700 p-1 flex-shrink-0 transition-colors"
                  title="Quitar archivo">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Zona de carga (visible si no hay archivo) -->
        <div
          v-if="!soportePreview"
          class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all"
          :class="errores.soporte
            ? 'border-red-400 bg-red-50 hover:border-red-500'
            : 'border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50'"
          @click="fileInputRef?.click()"
        >
          <svg class="mx-auto w-9 h-9 mb-2"
               :class="errores.soporte ? 'text-red-400' : 'text-gray-400'"
               fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0
                 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18
                 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
          </svg>
          <p class="text-sm font-semibold"
             :class="errores.soporte ? 'text-red-700' : 'text-gray-600'">
            Haga clic para adjuntar el soporte
          </p>
          <p class="text-xs text-gray-400 mt-1">JPG · PNG · PDF · Máximo 5 MB</p>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/jpg,image/png,application/pdf"
          class="hidden"
          @change="handleFileChange"
        />

        <p v-if="errores.soporte" class="mt-1 text-xs text-red-600 flex items-center gap-1">
          <svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd" />
          </svg>
          {{ errores.soporte }}
        </p>
      </div>

      <!-- Referencias opcionales -->
      <div>
        <p class="text-sm font-semibold text-gray-700 mb-2">
          Referencias
          <span class="text-gray-400 font-normal ml-1">(opcionales)</span>
        </p>
        <div class="space-y-2">
          <input
            v-model="store.pago.referenciaPago2"
            type="text"
            placeholder="No. transacción, recibo, comprobante..."
            class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400
                   focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
          />
          <input
            v-model="store.pago.referenciaPago3"
            type="text"
            placeholder="Referencia adicional"
            class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400
                   focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
          />
        </div>
      </div>

    </div><!-- /contenido colapsable -->
  </fieldset>
</template>
