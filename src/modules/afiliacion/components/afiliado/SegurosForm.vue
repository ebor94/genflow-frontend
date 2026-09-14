<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'
import { useToastStore } from '@afi/stores/useToastStore'
import { listarPrimasSeguro } from '@afi/api/afiliadoApi'
import BaseSelect from '@afi/components/ui/BaseSelect.vue'
import BaseButton from '@afi/components/ui/BaseButton.vue'

const store = useAfiliadoStore()
const toast = useToastStore()

// ── Primas cargadas desde el backend ─────────────────────────
const primasPorSeguro = ref({})
const cargandoPrimas = ref(false)

onMounted(async () => {
  cargandoPrimas.value = true
  try {
    const { data } = await listarPrimasSeguro()
    if (data.success) {
      // Agrupar por nombre de seguro
      const agrupadas = {}
      for (const p of data.data) {
        if (!agrupadas[p.nombreSeguro]) agrupadas[p.nombreSeguro] = []
        agrupadas[p.nombreSeguro].push(p)
      }
      primasPorSeguro.value = agrupadas
    }
  } catch {
    // Si falla, usar valores por defecto embebidos (tarifas 2026)
    primasPorSeguro.value = {
      SOLICANASTA: [
        { montoAsegurado: 1000000,  prima: 4200  },
        { montoAsegurado: 2000000,  prima: 8400  },
        { montoAsegurado: 3000000,  prima: 12600 },
        { montoAsegurado: 5000000,  prima: 21000 },
        { montoAsegurado: 10000000, prima: 48000 }
      ],
      'Acc. Personales Opción 1M-100Aux': [
        { montoAsegurado: 1000000, prima: 1560 }
      ],
      'Acc. Personales Opción 2M-100Aux': [
        { montoAsegurado: 2000000, prima: 2820 }
      ],
      'Acc. Personales Opción 3M-100Aux': [
        { montoAsegurado: 3000000, prima: 4080 }
      ],
      'Acc. Personales Opción 5M-300Aux': [
        { montoAsegurado: 5000000, prima: 7200 }
      ],
      'SINERGIA OP 1': [
        { montoAsegurado: 1000000, prima: 18960 }
      ],
      'SINERGIA OP 2': [
        { montoAsegurado: 3000000, prima: 42000 }
      ],
      'SINERGIA OP 3': [
        { montoAsegurado: 5000000, prima: 64800 }
      ],
      SOLIENVIDA: [
        { montoAsegurado: 1000000, prima: 10800 }
      ]
    }
  } finally {
    cargandoPrimas.value = false
  }
})

// ── Form para agregar un seguro ───────────────────────────────
const form = reactive({ nombre: '', monto: '' })

const TODOS_SEGUROS = [
  { value: 'SOLICANASTA',                        label: 'Solicanasta' },
  { value: 'Acc. Personales Opción 1M-100Aux',   label: 'Accidentes Personales Opción 1M-100Aux' },
  { value: 'Acc. Personales Opción 2M-100Aux',   label: 'Accidentes Personales Opción 2M-100Aux' },
  { value: 'Acc. Personales Opción 3M-100Aux',   label: 'Accidentes Personales Opción 3M-100Aux' },
  { value: 'Acc. Personales Opción 5M-300Aux',   label: 'Accidentes Personales Opción 5M-300Aux' },
  { value: 'SINERGIA OP 1',                      label: 'Sinergia Opción 1' },
  { value: 'SINERGIA OP 2',                      label: 'Sinergia Opción 2' },
  { value: 'SINERGIA OP 3',                      label: 'Sinergia Opción 3' },
  { value: 'SOLIENVIDA',                         label: 'Solienvida' }
]

// Seguros permitidos para canal INDIVIDUAL
const SEGUROS_INDIVIDUAL = new Set(['SOLICANASTA', 'SINERGIA OP 1', 'SINERGIA OP 2'])
// Montos de Solicanasta permitidos para canal INDIVIDUAL (1M, 2M, 3M)
const SOLICANASTA_MONTOS_INDIVIDUAL = new Set([1000000, 2000000, 3000000])

const esIndividual = computed(() => store.afiliado.canal === 'INDIVIDUAL')

const nombresSeguro = computed(() =>
  esIndividual.value
    ? TODOS_SEGUROS.filter(s => SEGUROS_INDIVIDUAL.has(s.value))
    : TODOS_SEGUROS
)

// Limpiar selección si el seguro ya no está disponible al cambiar canal
watch(esIndividual, () => {
  if (esIndividual.value && form.nombre && !SEGUROS_INDIVIDUAL.has(form.nombre)) {
    form.nombre = ''
    form.monto = ''
  }
})

// Montos disponibles según el seguro seleccionado (con restricción por canal)
const montosDisponibles = computed(() => {
  if (!form.nombre) return []
  let primas = primasPorSeguro.value[form.nombre] || []
  if (esIndividual.value && form.nombre === 'SOLICANASTA') {
    primas = primas.filter(p => SOLICANASTA_MONTOS_INDIVIDUAL.has(Number(p.montoAsegurado)))
  }
  return primas.map(p => ({
    value: String(p.montoAsegurado),
    label: `${formatCOP(p.montoAsegurado)}  (prima: ${formatCOP(p.prima)} / año)`
  }))
})

// Prima calculada para el seguro en curso
const primaActual = computed(() => {
  if (!form.nombre || !form.monto) return null
  const primas = primasPorSeguro.value[form.nombre] || []
  const found = primas.find(p => String(p.montoAsegurado) === String(form.monto))
  return found ? found.prima : null
})

// Limpiar monto al cambiar de seguro
function onNombreChange() {
  form.monto = ''
}

function agregarSeguro() {
  if (store.seguros.length >= 1) {
    toast.warning('Solo se permite un seguro. Elimine el actual para agregar uno diferente.')
    return
  }
  if (!form.nombre) {
    toast.warning('Seleccione el nombre del seguro')
    return
  }
  if (!form.monto) {
    toast.warning('Seleccione el monto a cubrir')
    return
  }
  store.addSeguro({
    nombre: form.nombre,
    monto: parseFloat(form.monto),
    prima: primaActual.value ?? 0
  })
  toast.success('Seguro agregado')
  form.nombre = ''
  form.monto = ''
}

function eliminarSeguro(idx) {
  if (confirm('¿Eliminar este seguro?')) {
    store.removeSeguro(idx)
  }
}

// ── Helpers ───────────────────────────────────────────────────
function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(v)
}

const totalPrimas = computed(() =>
  store.seguros.reduce((sum, s) => sum + (s.prima || 0), 0)
)
</script>

<template>
  <fieldset class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
    <legend class="text-base font-bold text-gray-800 px-2">Seguros</legend>

    <!-- Formulario agregar seguro (oculto si ya hay uno) -->
    <div v-if="store.seguros.length === 0" class="bg-gray-50 rounded-lg border border-gray-200 p-4 mt-2">
      <h4 class="text-sm font-bold text-gray-700 mb-3">Agregar seguro</h4>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <BaseSelect
          v-model="form.nombre"
          label="Nombre del seguro"
          :options="nombresSeguro"
          @update:modelValue="onNombreChange"
        />

        <BaseSelect
          v-model="form.monto"
          label="Monto a cubrir"
          :options="montosDisponibles"
          :disabled="!form.nombre || cargandoPrimas"
        />

        <!-- Prima preview -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Prima Anual</label>
          <div class="flex items-center h-9 px-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm font-semibold">
            {{ primaActual !== null ? formatCOP(primaActual) : '—' }}
          </div>
        </div>
      </div>

      <div class="mt-3">
        <BaseButton variant="success" @click="agregarSeguro" :disabled="!form.nombre || !form.monto">
          + Agregar seguro
        </BaseButton>
      </div>
    </div>

    <!-- Aviso cuando ya hay un seguro agregado -->
    <div v-else class="flex items-center gap-2 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span>Solo se permite un seguro. Elimine el actual para agregar uno diferente.</span>
    </div>

    <!-- Lista de seguros agregados -->
    <div class="mt-4">
      <div v-if="store.seguros.length === 0"
           class="text-sm text-gray-400 italic py-3 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        No se han agregado seguros
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-emerald-50 text-emerald-900">
              <th class="border border-emerald-200 px-3 py-2 text-left">#</th>
              <th class="border border-emerald-200 px-3 py-2 text-left">Seguro</th>
              <th class="border border-emerald-200 px-3 py-2 text-right">Monto asegurado</th>
              <th class="border border-emerald-200 px-3 py-2 text-right">Prima Anual</th>
              <th class="border border-emerald-200 px-3 py-2 text-center">Accion</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, idx) in store.seguros" :key="idx"
                class="hover:bg-emerald-50/50 transition-colors">
              <td class="border border-gray-200 px-3 py-2 text-gray-500">{{ idx + 1 }}</td>
              <td class="border border-gray-200 px-3 py-2 font-medium">{{ s.nombre }}</td>
              <td class="border border-gray-200 px-3 py-2 text-right">{{ formatCOP(s.monto) }}</td>
              <td class="border border-gray-200 px-3 py-2 text-right text-green-700 font-semibold">
                {{ formatCOP(s.prima) }}
              </td>
              <td class="border border-gray-200 px-3 py-2 text-center">
                <button @click="eliminarSeguro(idx)"
                        class="text-red-500 hover:text-red-700 transition-colors" title="Eliminar">
                  <svg class="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-emerald-50 font-bold">
              <td class="border border-emerald-200 px-3 py-2 text-right text-xs text-gray-500" colspan="3">
                Total primas anuales
              </td>
              <td class="border border-emerald-200 px-3 py-2 text-right text-emerald-800">
                {{ formatCOP(totalPrimas) }}
              </td>
              <td class="border border-emerald-200 px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

  </fieldset>
</template>
