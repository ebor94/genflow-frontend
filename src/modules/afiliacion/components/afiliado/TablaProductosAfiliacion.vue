<script setup>
import { computed } from 'vue'

const props = defineProps({
  afiliado: { type: Object, required: true }
})

// ── Mapeos de etiquetas ──────────────────────────────────────────

const NOVEDAD_LABEL = {
  NUEVO:                'Ingreso',
  CAMBIO:               'Cambio',
  TRASLADO:             'Traslado',
  ACTUALIZACION:        'Actualización',
  TRASLADO_COMPETENCIA: 'Traslado Competencia'
}

const GRUPO_LABEL = {
  UNIFAMILIAR:  'Unifamiliar',
  UNIPERSONAL:  'Unipersonal',
  BASICO:       'Básico',
  INDIVIDUAL:   'Individual',
  TRADICIONAL:  'Tradicional',
  CENS_II:      'Cens II'
}

const PRODUCTO_LABEL = {
  INTEGRAL: 'Integral',
  VERDE:    'Verde',
  CENS:     'CENS'
}

function labelPlanExequial(afiliado) {
  const prod  = PRODUCTO_LABEL[afiliado.producto] || afiliado.producto || ''
  const grupo = GRUPO_LABEL[afiliado.grupo]        || afiliado.grupo   || ''
  return `${prod} ${grupo}`.trim() || 'Plan Exequial'
}

const SEGURO_PRODUCTO = {
  SOLICANASTA:   'Canasta',
  SOLIENVIDA:    'SoliEnvida',
  'SINERGIA OP 1': 'Sinergia',
  'SINERGIA OP 2': 'Sinergia',
  'SINERGIA OP 3': 'Sinergia'
}

const SEGURO_COBERTURA = {
  SOLICANASTA:   'Canasta Serfunorte',
  SOLIENVIDA:    'SoliEnvida',
  'SINERGIA OP 1': 'Sinergia Opción 1',
  'SINERGIA OP 2': 'Sinergia Opción 2',
  'SINERGIA OP 3': 'Sinergia Opción 3'
}

function seguroProducto(nombre) {
  return SEGURO_PRODUCTO[nombre] || nombre || 'Seguro'
}
function seguroCobertura(nombre) {
  return SEGURO_COBERTURA[nombre] || nombre || 'Cobertura'
}

// Si el nombre contiene "Acc" se clasifica como accidentes
function esAccidente(nombre = '') {
  return nombre.toLowerCase().includes('acc')
}

// ── Construcción de filas ────────────────────────────────────────

const filas = computed(() => {
  const a       = props.afiliado
  const contrato = a.contrato || {}
  const cuotas   = contrato.nCuotas || 1
  const novedad  = NOVEDAD_LABEL[a.novedad] || a.novedad || 'Ingreso'
  const rows     = []

  // 1. Plan exequial
  const valorExequial = parseFloat(contrato.valorPlanExequial || 0)
  if (valorExequial > 0) {
    rows.push({
      producto:    labelPlanExequial(a),
      cobertura:   'Exequial',
      tipoNovedad: novedad,
      cuotas,
      cantidad:    1,
      valor:       valorExequial,
      vlrTotal:    valorExequial
    })
  }

  // 2. Adicionales (beneficiarios ADICIONAL activos)
  const adicionales = (a.beneficiarios || []).filter(
    b => b.tipoBeneficiario === 'ADICIONAL' && b.activo !== 0
  )
  if (adicionales.length > 0) {
    const totalAdicionales = parseFloat(contrato.valorAdicionales || 0)
    if (totalAdicionales > 0) {
      rows.push({
        producto:    'Adicionales',
        cobertura:   `${adicionales.length} beneficiario(s)`,
        tipoNovedad: novedad,
        cuotas,
        cantidad:    adicionales.length,
        valor:       totalAdicionales,
        vlrTotal:    totalAdicionales
      })
    }
  }

  // 3. Seguros
  for (const seg of (a.seguros || [])) {
    const prima = parseFloat(seg.prima || 0)
    if (esAccidente(seg.nombre)) {
      rows.push({
        producto:    'Accidentes Personales',
        cobertura:   seg.nombre,
        tipoNovedad: novedad,
        cuotas,
        cantidad:    1,
        valor:       prima,
        vlrTotal:    prima
      })
    } else {
      rows.push({
        producto:    seguroProducto(seg.nombre),
        cobertura:   seguroCobertura(seg.nombre),
        tipoNovedad: novedad,
        cuotas,
        cantidad:    1,
        valor:       prima,
        vlrTotal:    prima
      })
    }
  }

  // 4. Asistencia fuera de casa
  const valorAsistencia = parseFloat(contrato.valorAsistencia || contrato.tarifa?.valorAsistencia || 0)
  if (a.asistenciaFueraDeCasa === 'SI' && valorAsistencia > 0) {
    rows.push({
      producto:    'Asistencias',
      cobertura:   'Asistencia',
      tipoNovedad: novedad,
      cuotas,
      cantidad:    1,
      valor:       valorAsistencia,
      vlrTotal:    valorAsistencia
    })
  }

  return rows
})

const totalContrato = computed(() =>
  filas.value.reduce((s, f) => s + f.vlrTotal, 0)
)

function fmt(n) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })
}
</script>

<template>
  <div v-if="filas.length" class="mt-3 mb-2">
    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
      Productos contratados
    </p>
    <div class="overflow-x-auto rounded-lg border border-gray-200">
      <table class="min-w-full text-xs divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-gray-600">Producto Previsión</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600">Cobertura</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-600">Tipo Novedad</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-600">Cuotas</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-600">Cantidad</th>
            <th class="px-3 py-2 text-right font-semibold text-gray-600">Valor</th>
            <th class="px-3 py-2 text-right font-semibold text-gray-600">Vlr Total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr v-for="(f, i) in filas" :key="i" class="hover:bg-gray-50">
            <td class="px-3 py-2 font-medium text-gray-800">{{ f.producto }}</td>
            <td class="px-3 py-2 text-gray-600">{{ f.cobertura }}</td>
            <td class="px-3 py-2 text-center text-gray-600">{{ f.tipoNovedad }}</td>
            <td class="px-3 py-2 text-center text-gray-600">{{ f.cuotas }}</td>
            <td class="px-3 py-2 text-center text-gray-600">{{ f.cantidad }}</td>
            <td class="px-3 py-2 text-right text-gray-700">{{ fmt(f.valor) }}</td>
            <td class="px-3 py-2 text-right font-semibold text-gray-800">{{ fmt(f.vlrTotal) }}</td>
          </tr>
        </tbody>
        <tfoot class="bg-gray-50 border-t border-gray-300">
          <tr>
            <td colspan="5" class="px-3 py-2 text-right font-semibold text-gray-700 text-xs uppercase">
              Total anual contrato
            </td>
            <td colspan="2" class="px-3 py-2 text-right font-bold text-gray-900 text-sm">
              $ {{ fmt(totalContrato) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
  <div v-else class="mt-2 text-xs text-gray-400 italic">Sin detalle de productos.</div>
</template>
