<script setup>
import { reactive, computed, watch, ref, nextTick } from 'vue'
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'
import { useAgeCalculator } from '@afi/composables/useAgeCalculator'
import { useToastStore } from '@afi/stores/useToastStore'
import BaseInput from '@afi/components/ui/BaseInput.vue'
import BaseSelect from '@afi/components/ui/BaseSelect.vue'
import BaseButton from '@afi/components/ui/BaseButton.vue'

const emit = defineEmits(['add'])
const store = useAfiliadoStore()
const toast = useToastStore()

// ── Estado de edición ─────────────────────────────────────────
const editingIndex  = ref(null)
const isLoadingEdit = ref(false)

// ── Documento adjunto por beneficiario (opcional) ─────────────
const documentoFile      = ref(null)   // File seleccionado
const documentoActualUrl = ref('')     // Nombre del archivo ya guardado (modo edición)
const fileInputRef       = ref(null)

// Para construir la URL de previsualización del doc existente
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
function fileUrl(filename) { return `${BASE_URL}/uploads/${filename}` }

function onDocumentoChange(e) {
  documentoFile.value = e.target.files[0] || null
  if (documentoFile.value) documentoActualUrl.value = ''
}

function limpiarDocumento() {
  documentoFile.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// ── Formulario ────────────────────────────────────────────────
const form = reactive({
  tipoBeneficiario: '',
  parentesco:       '',
  genero:           '',
  valorPorPersona:  '',
  tipoDocumento:    '',
  numeroDocumento:  '',
  primerApellido:   '',
  segundoApellido:  '',
  primerNombre:     '',
  segundoNombre:    '',
  fechaNacimiento:  '',
  edad:             0,
  estado:           ''
})

const { edad } = useAgeCalculator(computed(() => form.fechaNacimiento))
watch(edad, (val) => { form.edad = val })

// ── Auto-calcular valorPorPersona para adicionales ────────────
watch(
  () => [form.tipoBeneficiario, form.fechaNacimiento, form.estado, store.afiliado.planVeolia],
  () => {
    if (form.tipoBeneficiario !== 'ADICIONAL') {
      form.valorPorPersona = ''
      return
    }
    if (form.estado === 'RETIRO') {
      form.valorPorPersona = 0
      return
    }
    if (!form.fechaNacimiento) return

    const edadActual = edad.value

    // ── Veolia: tarifa por edad y plan ────────────────────────
    if (store.formMode === 'veolia') {
      const plan = store.afiliado.planVeolia
      const tarifas = {
        PLATINO: { menor70: 4207,  menor80: 20215, mayor80: 29800 },
        ORO:     { menor70: 6338,  menor80: 26771, mayor80: 36800 }
      }
      const t = tarifas[plan]
      if (!t) return  // sin plan seleccionado, no calcular
      if (edadActual < 70)      form.valorPorPersona = t.menor70
      else if (edadActual < 80) form.valorPorPersona = t.menor80
      else                      form.valorPorPersona = t.mayor80
      return
    }

    // ── Estándar ─────────────────────────────────────────────
    if (edadActual < 50) {
      form.valorPorPersona = store.tarifaActiva?.valorAdicional
        ? parseFloat(store.tarifaActiva.valorAdicional)
        : 75900
    } else if (edadActual >= 50 && edadActual < 65) {
      form.valorPorPersona = store.tarifaActiva?.valorAdicionalMayor50
        ? parseFloat(store.tarifaActiva.valorAdicionalMayor50)
        : 86900
    } else {
      form.valorPorPersona = 0
      toast.warning('Edad del beneficiario fuera del rango cubierto por el plan (0 a 64 años)')
    }
  }
)

// ── Auto-asignar parentesco cuando es diferente al contratante ─
watch(() => store.afiliado.diferenteAlContratante, (val) => {
  if (val && store.beneficiarios.length === 0 && !form.parentesco) {
    form.parentesco = 'ASEGURADO PRINCIPAL'
  }
  if (!val && form.parentesco === 'ASEGURADO PRINCIPAL') {
    form.parentesco = ''
  }
})

// En UNIPERSONAL/INDIVIDUAL con check activo, forzar ASEGURADO PRINCIPAL
// (cubre el caso donde el grupo cambia DESPUÉS de marcar el check).
watch(() => store.afiliado.grupo, (grupo) => {
  if (store.formMode !== 'veolia'
      && store.afiliado.diferenteAlContratante
      && (grupo === 'UNIPERSONAL' || grupo === 'INDIVIDUAL')
      && store.beneficiarios.length === 0) {
    form.parentesco = 'ASEGURADO PRINCIPAL'
  }
})

// Parentesco bloqueado: solo mientras sea ASEGURADO PRINCIPAL y el checkbox esté activo
const parentescoLocked = computed(() =>
  store.afiliado.diferenteAlContratante && form.parentesco === 'ASEGURADO PRINCIPAL'
)

// ADT no permitido cuando parentesco es ASEGURADO PRINCIPAL
watch(() => form.parentesco, (parentesco) => {
  if (parentesco === 'ASEGURADO PRINCIPAL' && form.tipoDocumento === 'ADT') {
    form.tipoDocumento = ''
    form.numeroDocumento = ''
  }
})

// ── Documento tipo ADT ────────────────────────────────────────
const isDocumentoReadonly = computed(() => form.tipoDocumento === 'ADT')

watch(() => form.tipoDocumento, (nuevoTipo) => {
  if (isLoadingEdit.value) return
  if (nuevoTipo === 'ADT') {
    generarNumeroADT()
  } else {
    form.numeroDocumento = ''
  }
})

function generarNumeroADT() {
  const docPrincipal = store.afiliado.numeroDocumento
  if (!docPrincipal) {
    toast.warning('Ingrese primero el numero de documento del afiliado principal')
    form.tipoDocumento = ''
    return
  }
  const prefijo = docPrincipal
  const consecutivos = store.beneficiarios
    .filter((b, i) => b.tipoDocumento === 'ADT' && i !== editingIndex.value && b.numeroDocumento.startsWith(prefijo))
    .map(b => parseInt(b.numeroDocumento.slice(prefijo.length)))
    .filter(n => !isNaN(n))

  const maxConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) : 0
  form.numeroDocumento = prefijo + String(maxConsecutivo + 1).padStart(2, '0')
}

// ── Computeds ─────────────────────────────────────────────────
const isValorReadonly = computed(() => form.tipoBeneficiario === 'ADICIONAL')
const modoEdicion     = computed(() => editingIndex.value !== null)

// ── Parentescos que solo pueden aparecer una vez ──────────────
const PARENTESCOS_UNICOS = new Set([
  'PADRE', 'MADRE',
  'CONYUGE', 'COMPAÑERO (A)',
  'SUEGRASTRO',
  'MADRASTRA', 'PADRASTRO',
  'ASEGURADO PRINCIPAL', 'EX-ESPOSO (A)'
])

// ── Validación de restricciones por grupo ─────────────────────
const SUEGROS           = ['SUEGRO (A)', 'SUEGRASTRO']
const CONYUGE           = ['CONYUGE', 'COMPAÑERO (A)']
const HIJOS_NORMALES    = ['HIJO (A)', 'HIJO ADOPTIVO', 'HIJASTRO (A)']
const HERMANOS_NORMALES = ['HERMANO (A)', 'HERMANASTRO (A)']

// Parentescos permitidos en Integral Grupo Básico según estado civil
const BASICO_SOLTERO = [
  'PADRE', 'MADRE',
  'HERMANO (A)', 'HERMANASTRO (A)', 'HERMANO CON INCAPACIDAD',
  'ASEGURADO PRINCIPAL'
]
const BASICO_CASADO = [
  'CONYUGE', 'COMPAÑERO (A)',
  'HIJO (A)', 'HIJO ADOPTIVO', 'HIJASTRO (A)', 'HIJO CON INCAPACIDAD',
  'PADRE', 'MADRE',
  'SUEGRO (A)', 'SUEGRASTRO',
  'ASEGURADO PRINCIPAL'
]
// Divorciado, Viudo, Separado: hijos y padres, sin cónyuge ni suegros
const BASICO_OTROS = [
  'HIJO (A)', 'HIJO ADOPTIVO', 'HIJASTRO (A)', 'HIJO CON INCAPACIDAD',
  'PADRE', 'MADRE',
  'ASEGURADO PRINCIPAL'
]

function validarRestriccionesGrupo() {
  // ── Veolia: el plan corporativo tiene sus propias reglas (tarifa por edad
  //    según PLATINO/ORO) y no aplica las restricciones de Integral Básico
  //    ni Unifamiliar (parentescos limitados, topes por edad, etc.).
  //    Solo se devuelve true para permitir agregar el beneficiario.
  if (store.formMode === 'veolia') return true

  const grupo      = store.afiliado.grupo
  const parentesco = form.parentesco
  const edadActual = edad.value

  // ─ Integral Grupo Básico ──────────────────────────────────────
  if (grupo === 'BASICO') {
    // ASEGURADO PRINCIPAL: debe tener menos de 65 años
    if (parentesco === 'ASEGURADO PRINCIPAL' && edadActual >= 65) {
      toast.error(`El Asegurado Principal en Integral Grupo Básico debe tener menos de 65 años (edad: ${edadActual})`)
      return false
    }

    if (form.tipoBeneficiario === 'DE_LEY') {
      const estadoCivil     = store.afiliado.estadoCivil
      const esSoltero       = estadoCivil === 'SOLTERO'
      const esCasadoOUnion  = ['CASADO', 'UNION_LIBRE'].includes(estadoCivil)
      const deLeyExistentes = store.beneficiariosDeLey.filter((_, i) => i !== editingIndex.value)

      // ── Verificar parentesco permitido según estado civil ────
      const permitidos = esSoltero ? BASICO_SOLTERO : esCasadoOUnion ? BASICO_CASADO : BASICO_OTROS
      if (!permitidos.includes(parentesco)) {
        const desc = esSoltero ? 'Soltero' : esCasadoOUnion ? 'Casado / Unión libre' : estadoCivil
        toast.error(`"${parentesco}" no está permitido en Integral Grupo Básico para estado civil: ${desc}`)
        return false
      }

      // ── Restricciones de edad por parentesco ─────────────────
      // Cónyuge / Compañero(a): < 65 años
      if (CONYUGE.includes(parentesco) && edadActual >= 65) {
        toast.error(`Cónyuge / Compañero(a) debe tener menos de 65 años (edad: ${edadActual})`)
        return false
      }

      // Padre, Madre, Suegro(a), Suegrastro: < 75 años (máximo 74)
      if (['PADRE', 'MADRE', 'SUEGRO (A)', 'SUEGRASTRO'].includes(parentesco) && edadActual >= 75) {
        toast.error(`Padre, Madre o Suegro(a) debe tener menos de 75 años (edad: ${edadActual})`)
        return false
      }

      // Hijos (sin incapacidad): < 30 años
      if (HIJOS_NORMALES.includes(parentesco) && edadActual >= 30) {
        toast.error(`Hijos deben tener menos de 30 años en Integral Grupo Básico (edad: ${edadActual})`)
        return false
      }

      // Hermanos (sin incapacidad): < 30 años
      if (HERMANOS_NORMALES.includes(parentesco) && edadActual >= 30) {
        toast.error(`Hermanos deben tener menos de 30 años en Integral Grupo Básico (edad: ${edadActual})`)
        return false
      }

      // Hijo con incapacidad / Hermano con incapacidad: sin límite de edad

      // ── Suegros: solo si no están registrados padre Y madre ──
      if (SUEGROS.includes(parentesco)) {
        const tienePadre = deLeyExistentes.some(b => b.parentesco === 'PADRE')
        const tieneMadre = deLeyExistentes.some(b => b.parentesco === 'MADRE')
        if (tienePadre && tieneMadre) {
          toast.error('No se puede agregar Suegro/a si ya están registrados Padre y Madre')
          return false
        }
      }
    }

    if (form.tipoBeneficiario === 'ADICIONAL') {
      // Máximo 5 beneficiarios adicionales
      const totalAdicional = store.beneficiariosAdicional.filter((_, localIdx) => {
        const globalIdx = store.beneficiariosDeLey.length + localIdx
        return globalIdx !== editingIndex.value
      }).length
      if (totalAdicional >= 5) {
        toast.error('Integral Grupo Básico permite máximo 5 beneficiarios adicionales')
        return false
      }

      // Adicionales deben tener menos de 65 años
      if (edadActual >= 65) {
        toast.error(
          `En Integral Grupo Básico, los beneficiarios adicionales deben tener menos de 65 años ` +
          `(edad actual: ${edadActual} años)`
        )
        return false
      }
    }
  }

  // ─ Integral Unifamiliar ───────────────────────────────────────
  if (grupo === 'UNIFAMILIAR') {
    if (form.tipoBeneficiario === 'DE_LEY') {
      // Cap dinámico:
      //  - Sin check "afiliado diferente al contratante" → max 6 DE_LEY
      //    (el contratante es el ASEGURADO PRINCIPAL implícito).
      //  - Con check marcado                              → max 7 DE_LEY
      //    (el ASEGURADO PRINCIPAL ocupa un slot como beneficiario).
      const maxDeLey = store.afiliado.diferenteAlContratante ? 7 : 6
      const totalDeLey = store.beneficiariosDeLey.filter((_, i) => i !== editingIndex.value).length
      if (totalDeLey >= maxDeLey) {
        toast.error(`Integral Unifamiliar permite máximo ${maxDeLey} beneficiarios de ley`)
        return false
      }

      // Beneficiarios de ley no pueden ser mayores de 75 años
      if (edadActual > 75) {
        toast.error(
          `En Integral Unifamiliar, los beneficiarios de ley no pueden ser mayores de 75 años ` +
          `(edad actual: ${edadActual} años)`
        )
        return false
      }

      // Máximo 2 de ley pueden tener entre 61 y 75 años
      const enRango = edadActual > 60 && edadActual < 76
      if (enRango) {
        const yaEnRango = store.beneficiariosDeLey.filter(
          (_, i) => i !== editingIndex.value && store.beneficiariosDeLey[i].edad > 60 && store.beneficiariosDeLey[i].edad < 76
        ).length
        if (yaEnRango >= 2) {
          toast.error(
            `En Integral Unifamiliar solo 2 beneficiarios de ley pueden tener entre 61 y 75 años. ` +
            `Ya hay ${yaEnRango}.`
          )
          return false
        }
      }
    }

    if (form.tipoBeneficiario === 'ADICIONAL') {
      // Máximo 5 beneficiarios adicionales
      const totalAdicional = store.beneficiariosAdicional.filter((_, localIdx) => {
        const globalIdx = store.beneficiariosDeLey.length + localIdx
        return globalIdx !== editingIndex.value
      }).length
      if (totalAdicional >= 5) {
        toast.error('Integral Unifamiliar permite máximo 5 beneficiarios adicionales')
        return false
      }

      // Adicionales deben tener menos de 65 años
      if (edadActual >= 65) {
        toast.error(
          `En Integral Unifamiliar, los beneficiarios adicionales deben tener menos de 65 años ` +
          `(edad actual: ${edadActual} años)`
        )
        return false
      }
    }
  }

  // ─ UNIPERSONAL ───────────────────────────────────────────────
  // Solo permitir UN beneficiario con parentesco ASEGURADO PRINCIPAL
  // y edad MENOR de 50 años.
  if (grupo === 'UNIPERSONAL') {
    if (parentesco !== 'ASEGURADO PRINCIPAL') {
      toast.error(
        'En UNIPERSONAL solo se permite un beneficiario con parentesco "ASEGURADO PRINCIPAL"'
      )
      return false
    }
    if (edadActual >= 50) {
      toast.error(
        `El Asegurado Principal en UNIPERSONAL debe ser menor de 50 años (edad: ${edadActual})`
      )
      return false
    }
  }

  // ─ INDIVIDUAL ────────────────────────────────────────────────
  // Solo permitir UN beneficiario con parentesco ASEGURADO PRINCIPAL
  // y edad entre 50 y 64 años (50 ≤ edad < 65).
  if (grupo === 'INDIVIDUAL') {
    if (parentesco !== 'ASEGURADO PRINCIPAL') {
      toast.error(
        'En INDIVIDUAL solo se permite un beneficiario con parentesco "ASEGURADO PRINCIPAL"'
      )
      return false
    }
    if (edadActual < 50 || edadActual >= 65) {
      toast.error(
        `El Asegurado Principal en INDIVIDUAL debe tener entre 50 y 64 años (edad: ${edadActual})`
      )
      return false
    }
  }

  return true
}

// ── Acciones ──────────────────────────────────────────────────
function resetForm() {
  editingIndex.value      = null
  documentoFile.value     = null
  documentoActualUrl.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
  Object.assign(form, {
    tipoBeneficiario: '',
    parentesco:       '',
    genero:           '',
    valorPorPersona:  '',
    tipoDocumento:    '',
    numeroDocumento:  '',
    primerApellido:   '',
    segundoApellido:  '',
    primerNombre:     '',
    segundoNombre:    '',
    fechaNacimiento:  '',
    edad:             0,
    estado:           ''
  })
}

async function editarBeneficiario(beneficiario, index) {
  isLoadingEdit.value      = true
  editingIndex.value       = index
  documentoFile.value      = null
  documentoActualUrl.value = beneficiario.documentoUrl || ''
  if (fileInputRef.value) fileInputRef.value.value = ''

  Object.assign(form, {
    tipoBeneficiario: beneficiario.tipoBeneficiario || '',
    parentesco:       beneficiario.parentesco       || '',
    genero:           beneficiario.genero           || '',
    valorPorPersona:  beneficiario.valorPorPersona  ?? '',
    tipoDocumento:    beneficiario.tipoDocumento    || '',
    numeroDocumento:  beneficiario.numeroDocumento  || '',
    primerApellido:   beneficiario.primerApellido   || '',
    segundoApellido:  beneficiario.segundoApellido  || '',
    primerNombre:     beneficiario.primerNombre     || '',
    segundoNombre:    beneficiario.segundoNombre    || '',
    // Normalizar ISO con T → YYYY-MM-DD para que el <input type="date"> la muestre
    fechaNacimiento:  beneficiario.fechaNacimiento
      ? String(beneficiario.fechaNacimiento).split('T')[0]
      : '',
    edad:             beneficiario.edad             || 0,
    estado:           beneficiario.estado           || ''
  })
  await nextTick()
  isLoadingEdit.value = false
}

function handleAdd() {
  if (!form.tipoBeneficiario || !form.parentesco || !form.tipoDocumento ||
      !form.numeroDocumento  || !form.primerApellido || !form.primerNombre ||
      !form.fechaNacimiento  || !form.estado) {
    toast.warning('Complete los campos obligatorios del beneficiario')
    return
  }
  if (form.tipoDocumento !== 'ADT' && !/^\d{5,20}$/.test(form.numeroDocumento)) {
    toast.warning('Numero de documento invalido (5 a 20 digitos)')
    return
  }

  // ── ADT no permitido para ASEGURADO PRINCIPAL ─────────────
  if (form.parentesco === 'ASEGURADO PRINCIPAL' && form.tipoDocumento === 'ADT') {
    toast.error('El Asegurado Principal no puede tener tipo de documento ADT')
    return
  }

  // ── Parentesco único (no duplicados) ──────────────────────
  if (PARENTESCOS_UNICOS.has(form.parentesco)) {
    const yaExiste = store.beneficiarios.some(
      (b, i) => i !== editingIndex.value && b.parentesco === form.parentesco
    )
    if (yaExiste) {
      toast.error(`Ya existe un beneficiario con parentesco "${form.parentesco}"`)
      return
    }
  }

  // ── Documento obligatorio para beneficiarios >= 65 años (no Veolia) ─
  if (store.formMode !== 'veolia' && edad.value >= 65) {
    if (!documentoFile.value && !documentoActualUrl.value) {
      toast.error('Los beneficiarios de 65 años o más deben adjuntar un documento de identidad')
      return
    }
  }

  // ── Validaciones por grupo/plan ────────────────────────────
  if (!validarRestriccionesGrupo()) return

  const datos = {
    ...form,
    edad: edad.value,  // computed directo para evitar lag del watcher en form.edad
    valorPorPersona: form.valorPorPersona !== '' ? parseFloat(form.valorPorPersona) : null,
    _documentoFile:  documentoFile.value || null   // el store extrae y guarda en beneficiariosFiles
  }

  if (modoEdicion.value) {
    store.updateBeneficiario(editingIndex.value, datos)
    toast.success('Beneficiario actualizado')
    resetForm()
  } else {
    emit('add', datos)
    resetForm()
  }
}

// Exponer para que RegistroView pueda llamar desde BeneficiarioList
defineExpose({ editarBeneficiario })

// ── Listas ────────────────────────────────────────────────────
const tiposBeneficiario = [
  { value: 'DE_LEY',    label: 'Beneficiario' },
  { value: 'ADICIONAL', label: 'Beneficiario adicional' }
]

const opcionesEstado = [
  { value: 'INGRESO',       label: 'Ingreso' },
  { value: 'ACTUALIZACION', label: 'Actualizacion' },
  { value: 'RETIRO',        label: 'Retiro' }
]

const opcionesGenero = [
  { value: 'M', label: 'M - Masculino' },
  { value: 'F', label: 'F - Femenino' }
]

const PARENTESCOS_TODOS = [
  'ABUELASTRO (A)', 'ABUELO (A)', 'AHIJADO (A)', 'ASEGURADO PRINCIPAL',
  'BISABUELO (A)', 'BISNIETO (A)', 'COMPAÑERO (A)', 'CONYUGE',
  'CUÑADO (A)', 'EX-ESPOSO (A)', 'HERMANASTRO (A)', 'HERMANO (A)',
  'HERMANO CON INCAPACIDAD', 'HIJASTRO (A)', 'HIJO (A)', 'HIJO ADOPTIVO',
  'HIJO CON INCAPACIDAD', 'MADRASTRA', 'MADRE', 'MADRINA',
  'NIETO (A)', 'OTRO', 'PADRASTRO', 'PADRE', 'PADRINO',
  'PRIMO (A)', 'PROTEGIDO (A)', 'SERVICIO DOMESTICO (A)', 'SOBRINO (A)',
  'SUEGRASTRO', 'SUEGRO (A)', 'TIO (A)', 'YERNO/NUERA'
].map(p => ({ value: p, label: p.charAt(0) + p.slice(1).toLowerCase() }))

// En UNIPERSONAL/INDIVIDUAL (canal ASESOR), el único beneficiario válido es
// el ASEGURADO PRINCIPAL. En Veolia siempre se muestran todos.
const parentescos = computed(() => {
  const grupo = store.afiliado.grupo
  if (store.formMode !== 'veolia' && (grupo === 'UNIPERSONAL' || grupo === 'INDIVIDUAL')) {
    return PARENTESCOS_TODOS.filter(p => p.value === 'ASEGURADO PRINCIPAL')
  }
  return PARENTESCOS_TODOS
})

const TODOS_TIPOS_DOCUMENTO = [
  { value: 'CC',  label: 'CC'  },
  { value: 'TI',  label: 'TI'  },
  { value: 'CE',  label: 'CE'  },
  { value: 'PPT', label: 'PPT' },
  { value: 'RC',  label: 'RC'  },
  { value: 'ADT', label: 'ADT' }
]

const tiposDocumento = computed(() =>
  form.parentesco === 'ASEGURADO PRINCIPAL'
    ? TODOS_TIPOS_DOCUMENTO.filter(t => t.value !== 'ADT')
    : TODOS_TIPOS_DOCUMENTO
)

</script>

<template>
  <div :class="[
    'rounded-lg border p-4 transition-colors',
    modoEdicion
      ? 'bg-amber-50 border-amber-300'
      : 'bg-gray-50 border-gray-200'
  ]">
    <!-- Encabezado -->
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-sm font-bold" :class="modoEdicion ? 'text-amber-800' : 'text-gray-700'">
        <span v-if="modoEdicion">✏️ Editando beneficiario</span>
        <span v-else>Agregar miembro del grupo familiar</span>
      </h4>
      <button
        v-if="modoEdicion"
        @click="resetForm"
        class="text-xs text-amber-700 hover:text-amber-900 underline"
      >
        Cancelar edición
      </button>
    </div>

    <!-- Aviso de restricción según grupo seleccionado -->
    <div
      v-if="store.afiliado.grupo === 'BASICO' && store.formMode !== 'veolia'"
      class="mb-3 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2"
    >
      <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span class="space-y-0.5 block">
        <strong class="block">Integral Grupo Básico — Parentescos permitidos:</strong>
        <span class="block">
          <strong>Soltero:</strong>
          Padre / Madre · Hermano(a) &lt; 30 años · Hermano con incapacidad (sin límite)
        </span>
        <span class="block">
          <strong>Casado / Unión libre:</strong>
          Cónyuge/Compañero(a) &lt; 65 años · Hijos &lt; 30 años · Hijo con incapacidad ·
          Padre/Madre &lt; 75 años · Suegro(a) &lt; 75 años (solo si no hay padre y madre)
        </span>
        <span class="block text-amber-700">
          Madrastra, abuelos, tíos, sobrinos, nietos y otros parentescos no aplican en este plan.
        </span>
      </span>
    </div>

    <div
      v-else-if="store.afiliado.grupo === 'UNIFAMILIAR'"
      class="mb-3 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 space-y-1"
    >
      <div class="flex items-center gap-1.5 font-semibold">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Integral Unifamiliar — Restricciones
      </div>
      <div class="pl-5 space-y-0.5">
        <p>
          <strong>Beneficiarios de ley:</strong>
          máx. <strong>{{ store.beneficiariosDeLey.length }}/6</strong> ·
          de ellos, máx. 2 con edad 61–75 años
          (<strong>{{ store.beneficiariosDeLey.filter(b => b.edad > 60 && b.edad < 76).length }}/2</strong>)
        </p>
        <p>
          <strong>Beneficiarios adicionales:</strong>
          máx. <strong>{{ store.beneficiariosAdicional.length }}/5</strong> ·
          todos deben tener menos de 65 años
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <!-- Tipo, parentesco, género, estado -->
      <BaseSelect
        v-model="form.tipoBeneficiario"
        label="Tipo"
        :options="tiposBeneficiario"
        :required="true"
      />

      <!-- Info tarifas adicionales Veolia -->
      <div
        v-if="store.formMode === 'veolia' && form.tipoBeneficiario === 'ADICIONAL'"
        class="col-span-full bg-purple-50 border border-purple-200 rounded-lg p-4"
      >
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-sm font-semibold text-purple-800">Este beneficiario genera un costo adicional mensual</span>
        </div>
        <div class="overflow-x-auto rounded-lg border border-purple-200">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="bg-purple-200 text-purple-900">
                <th class="px-3 py-1.5 text-left font-semibold rounded-tl-lg">Edad</th>
                <th class="px-3 py-1.5 text-center font-semibold">Plan PLATINO</th>
                <th class="px-3 py-1.5 text-center font-semibold rounded-tr-lg">Plan ORO</th>
              </tr>
            </thead>
            <tbody class="bg-white">
              <tr class="border-t border-purple-100">
                <td class="px-3 py-1.5 text-gray-700">Menor de 70 años</td>
                <td class="px-3 py-1.5 text-center font-medium text-gray-800">$ 4.207</td>
                <td class="px-3 py-1.5 text-center font-medium text-gray-800">$ 6.338</td>
              </tr>
              <tr class="border-t border-purple-100">
                <td class="px-3 py-1.5 text-gray-700">Entre 70 y 79 años</td>
                <td class="px-3 py-1.5 text-center font-medium text-gray-800">$ 20.215</td>
                <td class="px-3 py-1.5 text-center font-medium text-gray-800">$ 26.771</td>
              </tr>
              <tr class="border-t border-purple-100">
                <td class="px-3 py-1.5 text-gray-700">80 años o más</td>
                <td class="px-3 py-1.5 text-center font-medium text-gray-800">$ 29.800</td>
                <td class="px-3 py-1.5 text-center font-medium text-gray-800">$ 36.800</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <BaseSelect
        v-model="form.parentesco"
        label="Parentesco"
        :options="parentescos"
        :required="true"
        :disabled="parentescoLocked"
      />

      <BaseSelect
        v-model="form.genero"
        label="Genero"
        :options="opcionesGenero"
      />

      <BaseSelect
        v-model="form.estado"
        label="Tipo de solicitud"
        :options="opcionesEstado"
        :required="true"
      />

      <!-- Documento -->
      <BaseSelect
        v-model="form.tipoDocumento"
        label="Tipo de documento"
        :options="tiposDocumento"
        :required="true"
      />

      <!-- Leyenda ADT -->
      <p class="col-span-full flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
        <svg class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>
          ¿No conoces el número de documento del beneficiario? Selecciona
          <strong class="font-semibold">ADT</strong> como tipo — el sistema asignará
          un código automáticamente usando el documento del titular.
        </span>
      </p>

      <BaseInput
        v-model="form.numeroDocumento"
        label="Numero de documento"
        :placeholder="isDocumentoReadonly ? '' : 'Solo numeros'"
        inputmode="numeric"
        :required="true"
        :readonly="isDocumentoReadonly"
        :disabled="isDocumentoReadonly"
        :uppercase="true"
      />

      <!-- Nombres -->
      <BaseInput
        v-model="form.primerApellido"
        label="Primer apellido"
        :required="true"
        :uppercase="true"
      />

      <BaseInput
        v-model="form.segundoApellido"
        label="Segundo apellido"
        :uppercase="true"
      />

      <BaseInput
        v-model="form.primerNombre"
        label="Primer nombre"
        :required="true"
        :uppercase="true"
      />

      <BaseInput
        v-model="form.segundoNombre"
        label="Segundo nombre"
        :uppercase="true"
      />

      <!-- Fecha y edad -->
      <BaseInput
        v-model="form.fechaNacimiento"
        label="Fecha de nacimiento"
        type="date"
        :required="true"
        :uppercase="true"
      />

      <BaseInput
        :modelValue="edad"
        label="Edad"
        :readonly="true"
        :disabled="true"
        :uppercase="true"
      />

      <!-- Valor por persona (estándar: automático para adicionales, manual para de ley) -->
      <div v-if="store.formMode !== 'veolia'">
        <BaseInput
          v-model="form.valorPorPersona"
          label="Valor por persona"
          :placeholder="isValorReadonly ? '' : 'Ej: 8000'"
          inputmode="numeric"
          type="number"
          min="0"
          :readonly="isValorReadonly"
          :disabled="isValorReadonly"
        />
        <p v-if="form.tipoBeneficiario === 'ADICIONAL' && form.estado === 'RETIRO'"
           class="mt-1 text-xs text-amber-600 font-medium">
          Retiro: no suma al valor del contrato
        </p>
      </div>

      <!-- ── Documento adjunto (opcional) ─────────────────────── -->
      <div class="md:col-span-2 lg:col-span-3">
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          Documento adjunto
          <span class="ml-1 text-xs text-gray-400 font-normal">(opcional — imagen o PDF)</span>
        </label>

        <!-- Enlace al documento ya guardado (modo edición desde servidor) -->
        <div
          v-if="documentoActualUrl && !documentoFile"
          class="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <svg class="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
          </svg>
          <a :href="fileUrl(documentoActualUrl)" target="_blank"
             class="text-sm text-blue-600 hover:underline flex-1 truncate">
            Ver documento actual
          </a>
          <button
            @click="documentoActualUrl = ''"
            class="text-xs text-red-500 hover:text-red-700 whitespace-nowrap"
          >
            Reemplazar
          </button>
        </div>

        <!-- Input de archivo (oculto cuando ya hay doc guardado y no se quiere reemplazar) -->
        <div v-if="!documentoActualUrl || documentoFile">
          <label class="flex items-center gap-3 cursor-pointer group">
            <div class="flex-1 flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-lg bg-white hover:border-green-400 hover:bg-green-50/30 transition-colors">
              <svg class="w-4 h-4 text-gray-400 group-hover:text-green-600 flex-shrink-0 transition-colors"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              <span v-if="!documentoFile" class="text-sm text-gray-400">
                Seleccionar archivo...
              </span>
              <span v-else class="text-sm text-green-700 font-medium truncate">
                ✓ {{ documentoFile.name }}
              </span>
            </div>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*,.pdf"
              class="sr-only"
              @change="onDocumentoChange"
            />
          </label>
          <button
            v-if="documentoFile"
            @click="limpiarDocumento"
            class="mt-1 text-xs text-red-500 hover:text-red-700"
          >
            ✕ Quitar archivo
          </button>
        </div>
      </div>
    </div>

    <div class="flex gap-3 mt-4">
      <BaseButton
        :variant="modoEdicion ? 'warning' : 'success'"
        @click="handleAdd"
      >
        <span v-if="modoEdicion">✓ Actualizar beneficiario</span>
        <span v-else>+ Agregar beneficiario</span>
      </BaseButton>
      <BaseButton variant="secondary" @click="resetForm">
        {{ modoEdicion ? 'Cancelar' : 'Limpiar campos' }}
      </BaseButton>
    </div>
  </div>
</template>
