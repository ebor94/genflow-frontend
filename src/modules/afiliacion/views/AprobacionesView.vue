<template>
  <div class="space-y-5">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
          Registros pendientes de aprobación
          <span
            v-if="pendientes.length > 0"
            class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200"
          >
            {{ pendientes.length }}
          </span>
        </h2>
        <p class="text-sm text-gray-500 mt-0.5">Revisa la información del afiliado y sus beneficiarios antes de aprobar.</p>
      </div>
      <button
        @click="cargar"
        :disabled="cargando"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <svg :class="['w-4 h-4', cargando && 'animate-spin']" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar
      </button>
    </div>

    <!-- Buscador + filtro origen -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="busqueda"
          type="text"
          placeholder="Buscar por nombre o número de documento..."
          class="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <!-- Filtro origen -->
      <div class="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
        <button
          v-for="op in origenOpciones"
          :key="op.value"
          @click="filtroOrigen = op.value"
          class="px-3 py-2 transition-colors"
          :class="filtroOrigen === op.value
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-600 hover:bg-gray-50'"
        >
          {{ op.label }}
        </button>
      </div>
    </div>

    <!-- Estado de carga -->
    <div v-if="cargando" class="flex justify-center py-16">
      <div class="flex flex-col items-center gap-3 text-gray-400">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="text-sm">Cargando registros...</span>
      </div>
    </div>

    <!-- Sin resultados -->
    <div v-else-if="!cargando && filtrados.length === 0" class="text-center py-16">
      <svg class="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-500 font-medium">
        {{ busqueda ? 'Sin resultados para la búsqueda' : 'No hay registros pendientes' }}
      </p>
      <p class="text-sm text-gray-400 mt-1">
        {{ busqueda ? 'Intenta con otro nombre o documento.' : 'Todos los registros han sido aprobados.' }}
      </p>
    </div>

    <!-- Tabla de registros -->
    <div v-else class="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="w-10 px-3 py-3"></th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Afiliado</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
            <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Canal</th>
            <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
            <th class="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Beneficiarios</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Firma</th>
            <th class="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registrado</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          <template v-for="afiliado in filtrados" :key="afiliado.id">
            <!-- Fila principal -->
            <tr
              class="hover:bg-gray-50 transition-colors cursor-pointer"
              @click="toggleExpand(afiliado.id)"
            >
              <td class="px-3 py-3 text-center">
                <svg
                  :class="['w-4 h-4 text-gray-400 transition-transform duration-200', expandidos.has(afiliado.id) && 'rotate-90']"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold text-gray-800">{{ nombreCompleto(afiliado) }}</p>
                  <span
                    v-if="afiliado.origen === 'VEOLIA'"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 border border-teal-200"
                  >
                    Veolia
                  </span>
                  <span
                    v-if="tieneBeneficiariosInactivos(afiliado)"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200"
                  >
                    Parcialmente rechazado
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">Edad: {{ afiliado.edad }} años · {{ labelSexo(afiliado.sexo) }}</p>
              </td>
              <td class="px-4 py-3">
                <p class="text-sm text-gray-700">{{ afiliado.numeroDocumento }}</p>
                <p class="text-xs text-gray-400">{{ afiliado.tipoDocumento }}</p>
              </td>
              <td class="hidden md:table-cell px-4 py-3">
                <span v-if="afiliado.canal" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{{ afiliado.canal }}</span>
                <span v-else class="text-xs text-gray-400">—</span>
              </td>
              <td class="hidden md:table-cell px-4 py-3">
                <span v-if="afiliado.producto" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">{{ afiliado.producto }}</span>
                <span v-else class="text-xs text-gray-400">—</span>
              </td>
              <td class="hidden lg:table-cell px-4 py-3 text-sm text-gray-600">
                {{ afiliado.beneficiarios?.length ?? 0 }}
              </td>
              <!-- Estado firma electrónica Adobe -->
              <td class="px-4 py-3 text-center" @click.stop>
                <a v-if="afiliado.fechaFirmaAdobe && afiliado.urlFirmaAdobe"
                   :href="afiliado.urlFirmaAdobe" target="_blank" rel="noopener"
                   class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
                          bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                   :title="`Firmado el ${formatFechaCorta(afiliado.fechaFirmaAdobe)} — ver documento`">
                  ✓ Firmado
                </a>
                <span v-else-if="afiliado.fechaFirmaAdobe"
                   class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700"
                   :title="`Firmado el ${formatFechaCorta(afiliado.fechaFirmaAdobe)}`">
                  ✓ Firmado
                </span>
                <span v-else
                   class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"
                   title="El cliente aún no ha firmado el contrato electrónicamente">
                  ✗ Sin firma
                </span>
              </td>
              <td class="hidden lg:table-cell px-4 py-3 text-xs text-gray-500">
                {{ formatDateTime(afiliado.createdAt) }}
              </td>
              <td class="px-4 py-3 text-right" @click.stop>
                <div class="flex items-center justify-end gap-2">
                  <!-- Trazabilidad -->
                  <button
                    @click="verTrazabilidad(afiliado)"
                    title="Ver trazabilidad"
                    class="inline-flex items-center justify-center w-8 h-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <!-- Descargar Plano Excel -->
                  <button
                    @click="descargarPlano(afiliado)"
                    :disabled="descargandoPlano === afiliado.id"
                    title="Descargar Plano Excel"
                    class="inline-flex items-center justify-center w-8 h-8 text-teal-600 hover:text-teal-800
                           hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <svg v-if="descargandoPlano === afiliado.id" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </button>
                  <!-- Rechazar -->
                  <button
                    @click="abrirRechazo(afiliado)"
                    :disabled="rechazando === afiliado.id || aprobando === afiliado.id"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white
                           bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-lg transition-colors"
                  >
                    <svg v-if="rechazando === afiliado.id" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {{ rechazando === afiliado.id ? 'Rechazando...' : 'Rechazar' }}
                  </button>
                  <!-- Aprobar -->
                  <button
                    @click="aprobar(afiliado)"
                    :disabled="aprobando === afiliado.id || rechazando === afiliado.id"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white
                           bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-lg transition-colors"
                  >
                    <svg v-if="aprobando === afiliado.id" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {{ aprobando === afiliado.id ? 'Aprobando...' : 'Aprobar' }}
                  </button>
                </div>
              </td>
            </tr>

            <!-- Fila de detalle (collapse) -->
            <tr v-if="expandidos.has(afiliado.id)" :key="`detalle-${afiliado.id}`">
              <td colspan="9" class="p-0">
                <AfiliadoDetalle :afiliado="afiliado" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Modal de rechazo -->
    <ConfirmarRechazoModal
      :visible="showRechazoModal"
      :afiliado="afiliadoParaRechazar"
      @confirmar="confirmarRechazo"
      @cancel="showRechazoModal = false"
    />

    <!-- Modal de trazabilidad -->
    <TrazabilidadModal
      :visible="showTrazabilidad"
      :afiliado="afiliadoTrazabilidad"
      :registros="registrosTrazabilidad"
      :cargando="cargandoTrazabilidad"
      @close="showTrazabilidad = false"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getAfiliadosPendientes,
  aprobarAfiliado as aprobarApi,
  rechazarAfiliado as rechazarApi,
  rechazarBeneficiariosAfiliado,
  getTrazabilidadAfiliado,
  descargarPlanoExcel
} from '@afi/api/afiliadoApi'
import { useToastStore } from '@afi/stores/useToastStore'
import AfiliadoDetalle from '@afi/components/aprobacion/AfiliadoDetalle.vue'
import ConfirmarRechazoModal from '@afi/components/ui/ConfirmarRechazoModal.vue'
import TrazabilidadModal from '@afi/components/aprobacion/TrazabilidadModal.vue'

const toast = useToastStore()

const pendientes           = ref([])
const cargando             = ref(false)
const aprobando            = ref(null)
const rechazando           = ref(null)
const descargandoPlano     = ref(null)
const expandidos           = ref(new Set())
const busqueda             = ref('')
const filtroOrigen         = ref('TODOS')
const showRechazoModal     = ref(false)
const afiliadoParaRechazar = ref(null)

// Trazabilidad
const showTrazabilidad      = ref(false)
const afiliadoTrazabilidad  = ref(null)
const registrosTrazabilidad = ref([])
const cargandoTrazabilidad  = ref(false)

const origenOpciones = [
  { value: 'TODOS',  label: 'Todos'   },
  { value: 'ASESOR', label: 'Asesor'  },
  { value: 'VEOLIA', label: 'Veolia'  }
]

const filtrados = computed(() => {
  let list = pendientes.value
  if (filtroOrigen.value !== 'TODOS') {
    list = list.filter(a => a.origen === filtroOrigen.value)
  }
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return list
  return list.filter(a =>
    nombreCompleto(a).toLowerCase().includes(q) ||
    a.numeroDocumento.includes(q)
  )
})

function tieneBeneficiariosInactivos(afiliado) {
  return afiliado.beneficiarios?.some(b => b.activo === 0)
}

async function cargar() {
  cargando.value = true
  expandidos.value = new Set()
  try {
    const { data } = await getAfiliadosPendientes()
    pendientes.value = data.data
  } catch {
    toast.error('Error al cargar los registros pendientes.')
  } finally {
    cargando.value = false
  }
}

function formatFechaCorta(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function descargarPlano(afiliado) {
  descargandoPlano.value = afiliado.id
  try {
    const res = await descargarPlanoExcel(afiliado.id)
    const url = URL.createObjectURL(res.data)
    const a   = document.createElement('a')
    a.href     = url
    a.download = `plano-${afiliado.primerApellido}-${afiliado.numeroDocumento}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error('No se pudo generar el plano Excel')
  } finally {
    descargandoPlano.value = null
  }
}

async function aprobar(afiliado) {
  // Validación obligatoria: el contrato debe estar firmado antes de aprobar.
  // Si no está firmado, pedir confirmación explícita al aprobador.
  if (!afiliado.fechaFirmaAdobe) {
    const ok = window.confirm(
      `⚠️ ATENCIÓN: ${nombreCompleto(afiliado)} aún NO ha firmado electrónicamente el contrato.\n\n` +
      '¿Está seguro de aprobar este registro sin firma?'
    )
    if (!ok) return
  }

  aprobando.value = afiliado.id
  try {
    await aprobarApi(afiliado.id)
    pendientes.value = pendientes.value.filter(a => a.id !== afiliado.id)
    expandidos.value.delete(afiliado.id)
    toast.success(`Registro de ${nombreCompleto(afiliado)} aprobado exitosamente.`)
  } catch {
    toast.error('Error al aprobar el registro. Intenta de nuevo.')
  } finally {
    aprobando.value = null
  }
}

function abrirRechazo(afiliado) {
  afiliadoParaRechazar.value = afiliado
  showRechazoModal.value = true
}

async function confirmarRechazo({ motivo, beneficiarioIds }) {
  const afiliado = afiliadoParaRechazar.value
  showRechazoModal.value = false
  rechazando.value = afiliado.id

  try {
    if (beneficiarioIds.length > 0) {
      // Rechazo parcial: inactiva beneficiarios seleccionados; afiliado queda pendiente
      const { data } = await rechazarBeneficiariosAfiliado(afiliado.id, { motivo, beneficiarioIds })
      // Actualizar la fila en la lista (no eliminar)
      const idx = pendientes.value.findIndex(a => a.id === afiliado.id)
      if (idx !== -1) pendientes.value[idx] = data.data
      toast.info(`${beneficiarioIds.length} beneficiario(s) de ${nombreCompleto(afiliado)} inactivados.`)
    } else {
      // Rechazo total: comportamiento original
      await rechazarApi(afiliado.id, motivo)
      pendientes.value = pendientes.value.filter(a => a.id !== afiliado.id)
      expandidos.value.delete(afiliado.id)
      toast.info(`Registro de ${nombreCompleto(afiliado)} rechazado.`)
    }
  } catch {
    toast.error('Error al rechazar el registro. Intenta de nuevo.')
  } finally {
    rechazando.value = null
    afiliadoParaRechazar.value = null
  }
}

async function verTrazabilidad(afiliado) {
  afiliadoTrazabilidad.value  = afiliado
  registrosTrazabilidad.value = []
  showTrazabilidad.value      = true
  cargandoTrazabilidad.value  = true
  try {
    const { data } = await getTrazabilidadAfiliado(afiliado.id)
    registrosTrazabilidad.value = data.data
  } catch {
    toast.error('Error al cargar la trazabilidad')
  } finally {
    cargandoTrazabilidad.value = false
  }
}

function toggleExpand(id) {
  if (expandidos.value.has(id)) {
    expandidos.value.delete(id)
  } else {
    expandidos.value.add(id)
  }
  expandidos.value = new Set(expandidos.value)
}

function nombreCompleto(a) {
  return [a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido]
    .filter(Boolean).join(' ')
}

function labelSexo(val) {
  return { F: 'Femenino', M: 'Masculino', X: 'No binario' }[val] ?? val
}

function formatDateTime(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

onMounted(cargar)
</script>
