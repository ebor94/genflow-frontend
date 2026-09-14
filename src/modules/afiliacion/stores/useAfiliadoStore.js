import { defineStore } from 'pinia'
import { ref, reactive, computed, nextTick } from 'vue'
import {
  createAfiliado, createAfiliadoVeolia, reenviarAfiliacionPublico as reenviarApi,
  crearBorrador, actualizarBorrador, eliminarBorrador as eliminarBorradorApi
} from '@afi/api/afiliadoApi'
import { useToastStore } from './useToastStore'

function isoHoy() {
  return new Date().toISOString().slice(0, 10)
}
function isoUnAnio() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export const useAfiliadoStore = defineStore('afiliado', () => {
  // Modo del formulario: 'standard' requiere info comercial, 'veolia' no
  const formMode = ref('standard')

  // Contador reactivo que se incrementa en resetForm(). Las vistas lo usan
  // como :key en los componentes con <input type="file"> para forzar remount
  // y limpiar previews + DOM (los refs del store no llegan al .value de los
  // inputs file del DOM ni a refs locales de los hijos).
  const formResetKey = ref(0)

  // Aceptación de tratamiento de datos — obligatorio para registrar
  const aceptaTratamiento = ref(false)

  const afiliado = reactive({
    // ── Datos de la solicitud ─────────────────────────────────
    sucursal: '',
    novedad: '',
    vigenciaDesde: isoHoy(),
    vigenciaHasta: isoUnAnio(),

    // ── Identificación ────────────────────────────────────────
    tipoDocumento: '',
    numeroDocumento: '',
    primerApellido: '',
    segundoApellido: '',
    primerNombre: '',
    segundoNombre: '',
    fechaNacimiento: '',
    edad: 0,
    sexo: '',
    estadoCivil: '',

    // ── Contacto ──────────────────────────────────────────────
    celular: '',
    celularTieneWhatsapp: false,
    celular2: '',
    email: '',

    // ── Ubicación ─────────────────────────────────────────────
    departamento: '',
    ciudad: '',
    barrio: '',
    direccion: '',

    // ── Empresa ───────────────────────────────────────────────
    nit: '',
    nombreEmpresa: '',
    empresaId: null,

    // ── Veolia ────────────────────────────────────────────────
    unidadNegocio: '',
    planVeolia: '',

    // ── Información comercial ─────────────────────────────────
    canal: '',
    producto: '',
    grupo: '',
    asistenciaFueraDeCasa: '',

    // ── Actividad económica ───────────────────────────────────
    actividadEconomica: '',
    ocupacion: '',
    codigoCiiu: '',

    // ── Campos CENS ───────────────────────────────────────────
    usuarioCens: '',
    cicloEstrato: '',
    relacionPredio: '',

    // ── Observaciones ─────────────────────────────────────────
    observaciones: '',

    // ── Afiliado diferente al contratante ─────────────────────
    diferenteAlContratante: false
  })

  const beneficiarios      = ref([])
  const beneficiariosFiles = ref([])   // File objects paralelos a beneficiarios[]
  const seguros = ref([])

  // Contrato / valor
  const contrato = reactive({
    tarifaId: null,
    valorPlanExequial: 0,
    valorAdicionales: 0,
    valorAsistencia: 0,
    valorSeguros: 0,
    valorTotal: 0,
    periodicidad: 'MENSUAL',
    nCuotas: 11,
    valorCuota: 0
  })

  // Tarifa activa compartida entre componentes (ValorContrato la asigna, BeneficiarioForm la lee)
  const tarifaActiva = ref(null)

  // Flag que se enciende mientras se carga un borrador o una afiliación
  // para corregir. Los watchers de canal/producto (que normalmente
  // limpian los campos hijos en cascada al cambiar) lo respetan para
  // no destruir los valores que se acaban de hidratar desde la BD.
  const cargandoFormulario = ref(false)

  // URLs de servidor para mostrar previews al retomar pre-afiliaciones.
  // Se poblan en cargarBorrador cuando la pre-afiliación ya tenía archivos.
  // Los componentes muestran el preview desde estas URLs cuando no hay File local.
  const cedulaFrontalUrl       = ref('')
  const cedulaReversoUrl       = ref('')
  const soportePagoUrl         = ref('')
  const contratoCompetenciaUrl = ref('')

  // ── Datos de la primera cuota / pago inicial ────────────────
  const pago = reactive({
    formaPago:          '',
    soporteFile:        null,   // File object — no se serializa al servidor como JSON
    valorRecibido:      '',
    referenciaPago1:    '',
    referenciaPago2:    '',
    referenciaPago3:    '',
    fechaPagoTentativa: ''
  })

  // ── Cédula del afiliado (frontal + reverso) ─────────────────
  const cedulaFrontal = ref(null)  // File object
  const cedulaReverso = ref(null)  // File object

  // ── Contrato de la competencia (novedad TRASLADO_COMPETENCIA) ─
  const contratoCompetenciaFile = ref(null)

  function setContratoCompetenciaFile(file) {
    contratoCompetenciaFile.value = file
  }

  // ── Modo corrección (editar afiliación rechazada) ───────────
  const modoCorreccion     = ref(false)
  const afiliadoEditandoId = ref(null)

  const isSubmitting = ref(false)
  const errors = ref({})

  // ── Borrador ──────────────────────────────────────────────────
  const borradorId         = ref(null)   // ID en el backend
  const borradorGuardando  = ref(false)
  const borradorGuardadoAt = ref(null)   // Date del último guardado exitoso
  const borradorError      = ref(false)

  // ── Computed ───────────────────────────────────────────────
  const beneficiariosDeLey = computed(() =>
    beneficiarios.value.filter(b => b.tipoBeneficiario === 'DE_LEY')
  )

  const beneficiariosAdicional = computed(() =>
    beneficiarios.value.filter(b => b.tipoBeneficiario === 'ADICIONAL')
  )

  const esCanalCens = computed(() => afiliado.canal === 'CENS')

  const isFormValid = computed(() => {
    const baseValid = Boolean(
      afiliado.tipoDocumento &&
      afiliado.numeroDocumento &&
      afiliado.primerApellido &&
      afiliado.primerNombre &&
      afiliado.fechaNacimiento &&
      afiliado.sexo &&
      afiliado.estadoCivil &&
      afiliado.celular
    )

    if (formMode.value === 'veolia') return baseValid && aceptaTratamiento.value

    // Si el afiliado es diferente al contratante, la edad del titular no se valida aquí
    const afiliadoMenor65Valid = afiliado.diferenteAlContratante || afiliado.edad < 65

    const comercialValid = Boolean(afiliado.canal && afiliado.producto && afiliado.grupo)

    const censValid = afiliado.canal === 'CENS'
      ? Boolean(afiliado.usuarioCens && afiliado.cicloEstrato && afiliado.relacionPredio)
      : true

    // Cédula frontal obligatoria para afiliado > 50 años (no Veolia)
    const cedulaValid = afiliado.edad > 50 ? !!cedulaFrontal.value : true

    // UNIPERSONAL menores de 50 — solo se valida la edad del CONTRATANTE
    // cuando NO está marcado "diferente al contratante". Si está marcado,
    // la validación cae sobre el ASEGURADO PRINCIPAL en BeneficiarioForm.
    const unipersonalMenor50Valid =
      (afiliado.canal === 'INDIVIDUAL' && afiliado.grupo === 'UNIPERSONAL' && !afiliado.diferenteAlContratante)
        ? (afiliado.edad > 0 && afiliado.edad < 50)
        : true

    // INDIVIDUAL 50-65 — misma lógica. Rango ≥50 y ≤65.
    const unipersonal5065Valid =
      (afiliado.canal === 'INDIVIDUAL' && afiliado.grupo === 'INDIVIDUAL' && !afiliado.diferenteAlContratante)
        ? (afiliado.edad >= 50 && afiliado.edad <= 65)
        : true

    // Si el check está marcado en estos grupos, debe existir al menos un
    // beneficiario ASEGURADO PRINCIPAL (el real afiliado del plan).
    const asegPrincipalRequerido =
      (afiliado.canal === 'INDIVIDUAL'
       && (afiliado.grupo === 'UNIPERSONAL' || afiliado.grupo === 'INDIVIDUAL')
       && afiliado.diferenteAlContratante)
        ? beneficiarios.value.some(b => b.parentesco === 'ASEGURADO PRINCIPAL')
        : true

    return baseValid
        && comercialValid
        && censValid
        && afiliadoMenor65Valid
        && cedulaValid
        && unipersonalMenor50Valid
        && unipersonal5065Valid
        && asegPrincipalRequerido
        && aceptaTratamiento.value
  })

  // ── Métodos ────────────────────────────────────────────────
  function setFormMode(mode) {
    formMode.value = mode
  }

  function addBeneficiario(beneficiario) {
    // Extraer el archivo antes de guardar el objeto (no se serializa)
    const { _documentoFile, ...benData } = beneficiario
    const toast = useToastStore()
    const exists = beneficiarios.value.some(
      b => b.numeroDocumento === benData.numeroDocumento
    )
    if (exists) {
      toast.error('Este numero de documento ya fue agregado')
      return false
    }

    // Cap defensivo por grupo — segunda línea de defensa al cap del form.
    // Aplica solo al canal estándar (no Veolia).
    if (formMode.value !== 'veolia') {
      const grupo = afiliado.grupo
      const yaDeLey = beneficiarios.value.filter(b => b.tipoBeneficiario === 'DE_LEY').length
      const yaAdic  = beneficiarios.value.filter(b => b.tipoBeneficiario === 'ADICIONAL').length

      if (grupo === 'UNIFAMILIAR') {
        // max 6 sin check, 7 con check (incluye al ASEGURADO PRINCIPAL)
        const maxDeLey = afiliado.diferenteAlContratante ? 7 : 6
        if (benData.tipoBeneficiario === 'DE_LEY' && yaDeLey >= maxDeLey) {
          toast.error(`Integral Unifamiliar permite máximo ${maxDeLey} beneficiarios de ley`)
          return false
        }
        if (benData.tipoBeneficiario === 'ADICIONAL' && yaAdic >= 5) {
          toast.error('Integral Unifamiliar permite máximo 5 beneficiarios adicionales')
          return false
        }
      }
      if (grupo === 'BASICO') {
        if (benData.tipoBeneficiario === 'ADICIONAL' && yaAdic >= 5) {
          toast.error('Integral Grupo Básico permite máximo 5 beneficiarios adicionales')
          return false
        }
      }
      if (grupo === 'UNIPERSONAL' || grupo === 'INDIVIDUAL') {
        if (beneficiarios.value.length >= 1) {
          toast.error(`En ${grupo} solo se permite un beneficiario (ASEGURADO PRINCIPAL)`)
          return false
        }
      }
    }

    beneficiarios.value.push({ ...benData })
    beneficiariosFiles.value.push(_documentoFile || null)
    return true
  }

  function removeBeneficiario(index) {
    beneficiarios.value.splice(index, 1)
    beneficiariosFiles.value.splice(index, 1)
  }

  function updateBeneficiario(index, data) {
    if (index >= 0 && index < beneficiarios.value.length) {
      const { _documentoFile, ...benData } = data
      beneficiarios.value[index] = { ...beneficiarios.value[index], ...benData }
      // Solo actualizar el archivo si se proporcionó uno nuevo
      if (_documentoFile !== undefined) {
        beneficiariosFiles.value[index] = _documentoFile
      }
    }
  }

  function addSeguro(seguro) {
    seguros.value.push({ ...seguro })
  }

  function removeSeguro(index) {
    seguros.value.splice(index, 1)
  }

  function updateContrato(data) {
    Object.assign(contrato, data)
  }

  function setPago(datos) {
    Object.assign(pago, datos)
  }

  // ── Borrador: helpers y acciones ─────────────────────────────
  function buildBorradorPayload() {
    return {
      afiliado: { ...afiliado },
      beneficiarios: beneficiarios.value.map(b => {
        // eslint-disable-next-line no-unused-vars
        const { _documentoFile, documentoFile, ...benData } = b
        return benData
      }),
      seguros:  seguros.value.map(s => ({ ...s })),
      contrato: { ...contrato }
    }
  }

  async function guardarBorrador() {
    if (formMode.value === 'veolia') return
    if (!afiliado.primerNombre && !afiliado.numeroDocumento) return

    borradorGuardando.value = true
    borradorError.value     = false
    try {
      const payload = buildBorradorPayload()

      // Determinar si hay archivos en esta sesión para enviar multipart
      const hayArchivos =
        cedulaFrontal.value ||
        cedulaReverso.value ||
        pago.soporteFile ||
        contratoCompetenciaFile.value ||
        beneficiariosFiles.value.some(f => f != null)

      let requestPayload = payload
      if (hayArchivos) {
        const fd = new FormData()
        fd.append('data', JSON.stringify(payload))
        if (cedulaFrontal.value)          fd.append('cedulaFrontal', cedulaFrontal.value)
        if (cedulaReverso.value)          fd.append('cedulaReverso', cedulaReverso.value)
        if (pago.soporteFile)             fd.append('soporte', pago.soporteFile)
        if (contratoCompetenciaFile.value) fd.append('contratoCompetencia', contratoCompetenciaFile.value)
        beneficiariosFiles.value.forEach((file, i) => {
          if (file) fd.append(`beneficiario_doc_${i}`, file)
        })
        requestPayload = fd
      }

      if (!borradorId.value) {
        const { data } = await crearBorrador(requestPayload)
        borradorId.value = data.data.id
      } else {
        await actualizarBorrador(borradorId.value, requestPayload)
      }
      borradorGuardadoAt.value = new Date()
    } catch {
      borradorError.value = true
    } finally {
      borradorGuardando.value = false
    }
  }

  function cargarBorrador(data) {
    const a = data.afiliado || {}
    // Bloquear cascada de watchers durante la hidratación inicial
    cargandoFormulario.value = true
    Object.assign(afiliado, {
      sucursal:              a.sucursal              || '',
      novedad:               a.novedad               || '',
      vigenciaDesde:         a.vigenciaDesde?.split('T')[0]  || '',
      vigenciaHasta:         a.vigenciaHasta?.split('T')[0]  || '',
      tipoDocumento:         a.tipoDocumento         || '',
      numeroDocumento:       a.numeroDocumento       || '',
      primerApellido:        a.primerApellido        || '',
      segundoApellido:       a.segundoApellido       || '',
      primerNombre:          a.primerNombre          || '',
      segundoNombre:         a.segundoNombre         || '',
      fechaNacimiento:       a.fechaNacimiento?.split('T')[0] || '',
      edad:                  a.edad                  ?? 0,
      sexo:                  a.sexo                  || '',
      estadoCivil:           a.estadoCivil           || '',
      celular:               a.celular               || '',
      celularTieneWhatsapp:  !!Number(a.celularTieneWhatsapp || 0),
      celular2:              a.celular2              || '',
      email:                 a.email                 || '',
      departamento:          a.departamento          || '',
      ciudad:                a.ciudad                || '',
      barrio:                a.barrio                || '',
      direccion:             a.direccion             || '',
      nit:                   a.nit                   || '',
      nombreEmpresa:         a.nombreEmpresa         || '',
      empresaId:             a.empresaId             || null,
      unidadNegocio:         a.unidadNegocio         || '',
      planVeolia:            a.planVeolia            || '',
      canal:                 a.canal                 || '',
      producto:              a.producto              || '',
      grupo:                 a.grupo                 || '',
      asistenciaFueraDeCasa: a.asistenciaFueraDeCasa || '',
      actividadEconomica:    a.actividadEconomica    || '',
      ocupacion:             a.ocupacion             || '',
      codigoCiiu:            a.codigoCiiu            || '',
      usuarioCens:           a.usuarioCens           || '',
      cicloEstrato:          a.cicloEstrato          || '',
      relacionPredio:        a.relacionPredio        || '',
      observaciones:         a.observaciones         || '',
      diferenteAlContratante: Boolean(a.diferenteAlContratante)
    })
    beneficiarios.value      = (data.beneficiarios || []).map(b => ({ ...b }))
    beneficiariosFiles.value = (data.beneficiarios || []).map(() => null)
    seguros.value            = (data.seguros       || []).map(s => ({ ...s }))
    if (data.contrato) {
      Object.assign(contrato, {
        tarifaId:          data.contrato.tarifaId          || null,
        valorPlanExequial: data.contrato.valorPlanExequial || 0,
        valorAdicionales:  data.contrato.valorAdicionales  || 0,
        valorAsistencia:   data.contrato.valorAsistencia   || 0,
        valorSeguros:      data.contrato.valorSeguros       || 0,
        valorTotal:        data.contrato.valorTotal         || 0,
        periodicidad:      data.contrato.periodicidad       || 'MENSUAL',
        nCuotas:           data.contrato.nCuotas            || 11,
        valorCuota:        data.contrato.valorCuota         || 0
      })
    }
    borradorId.value = data.id

    // Poblar URLs de servidor para previews de archivos ya subidos.
    // Los componentes muestran el preview usando VITE_API_URL + '/uploads/' + nombre.
    const a2 = data.afiliado || {}
    cedulaFrontalUrl.value       = a2.cedulaFrontal       || ''
    cedulaReversoUrl.value       = a2.cedulaReverso       || ''
    soportePagoUrl.value         = a2.soportePago         || ''
    contratoCompetenciaUrl.value = a2.contratoCompetencia || ''

    nextTick(() => { cargandoFormulario.value = false })
  }

  async function descartarBorrador() {
    if (borradorId.value) {
      try { await eliminarBorradorApi(borradorId.value) } catch { /* silencioso */ }
    }
    resetForm()
  }

  // ── Carga de afiliación rechazada para corrección ────────────
  function cargarParaCorregir(afiliadoData) {
    const a = afiliadoData
    // Bloquear watchers de cascada (canal→producto→grupo, etc.) mientras
    // hidratamos el form. Se libera al final de la función.
    cargandoFormulario.value = true
    Object.assign(afiliado, {
      sucursal:            a.sucursal            || '',
      novedad:             a.novedad             || '',
      vigenciaDesde:       a.vigenciaDesde?.split('T')[0] || '',
      vigenciaHasta:       a.vigenciaHasta?.split('T')[0] || '',
      tipoDocumento:       a.tipoDocumento       || '',
      numeroDocumento:     a.numeroDocumento     || '',
      primerApellido:      a.primerApellido      || '',
      segundoApellido:     a.segundoApellido     || '',
      primerNombre:        a.primerNombre        || '',
      segundoNombre:       a.segundoNombre       || '',
      fechaNacimiento:     a.fechaNacimiento?.split('T')[0] || '',
      edad:                a.edad               ?? 0,
      sexo:                a.sexo               || '',
      estadoCivil:         a.estadoCivil        || '',
      celular:             a.celular            || '',
      celularTieneWhatsapp: !!Number(a.celularTieneWhatsapp || 0),
      celular2:            a.celular2           || '',
      email:               a.email             || '',
      departamento:        a.departamento       || '',
      ciudad:              a.ciudad             || '',
      barrio:              a.barrio             || '',
      direccion:           a.direccion          || '',
      nit:                 a.nit               || '',
      nombreEmpresa:       a.nombreEmpresa      || '',
      empresaId:           a.empresaId          || null,
      unidadNegocio:       a.unidadNegocio      || '',
      planVeolia:          a.planVeolia         || '',
      canal:               a.canal             || '',
      producto:            a.producto          || '',
      grupo:               a.grupo             || '',
      asistenciaFueraDeCasa: a.asistenciaFueraDeCasa || '',
      actividadEconomica:  a.actividadEconomica || '',
      ocupacion:           a.ocupacion          || '',
      codigoCiiu:          a.codigoCiiu         || '',
      usuarioCens:         a.usuarioCens        || '',
      cicloEstrato:        a.cicloEstrato       || '',
      relacionPredio:      a.relacionPredio     || '',
      observaciones:       a.observaciones      || '',
      diferenteAlContratante: Boolean(a.diferenteAlContratante)
    })

    // Normalizar fechaNacimiento (viene del backend como ISO con T) para que
    // los <input type="date"> la muestren correctamente y se pueda editar.
    beneficiarios.value = (a.beneficiarios || []).map(b => ({
      ...b,
      fechaNacimiento: b.fechaNacimiento
        ? String(b.fechaNacimiento).split('T')[0]
        : ''
    }))
    beneficiariosFiles.value = (a.beneficiarios || []).map(() => null)  // sin archivos al cargar
    seguros.value            = (a.seguros       || []).map(s => ({ ...s }))

    if (a.contrato) {
      Object.assign(contrato, {
        tarifaId:          a.contrato.tarifaId        || null,
        valorPlanExequial: a.contrato.valorPlanExequial || 0,
        valorAdicionales:  a.contrato.valorAdicionales  || 0,
        valorAsistencia:   a.contrato.valorAsistencia   || 0,
        valorSeguros:      a.contrato.valorSeguros       || 0,
        valorTotal:        a.contrato.valorTotal         || 0,
        periodicidad:      a.contrato.periodicidad       || 'MENSUAL',
        nCuotas:           a.contrato.nCuotas            || 11,
        valorCuota:        a.contrato.valorCuota         || 0
      })
    }

    // El afiliado ya aceptó el tratamiento al registrarse; en modo corrección
    // no se vuelve a mostrar el checkbox, así que se fuerza true para que
    // isFormValid no quede bloqueado.
    aceptaTratamiento.value = true

    // Determinar el modo de formulario según el origen del afiliado
    formMode.value = a.origen === 'VEOLIA' ? 'veolia' : 'standard'

    modoCorreccion.value     = true
    afiliadoEditandoId.value = a.id

    // Liberar el guard DESPUÉS de que Vue procese los watchers (nextTick),
    // así la cascada inicial los ignora y los cambios manuales posteriores
    // del asesor sí limpian normalmente.
    nextTick(() => { cargandoFormulario.value = false })
  }

  async function submitCorreccion(otp = '') {
    const toast = useToastStore()
    isSubmitting.value = true
    errors.value = {}

    try {
      const payload = {
        ...afiliado,
        diferenteAlContratante: afiliado.diferenteAlContratante ? 1 : 0,
        beneficiarios: beneficiarios.value,
        seguros:       seguros.value,
        contrato:      { ...contrato }
      }
      // OTP solo se incluye si llegó (solo lo necesita el flujo Veolia)
      if (otp) payload.otp = otp

      let response
      const hayDocsBenef = beneficiariosFiles.value.some(f => f != null)
      if (hayDocsBenef) {
        const fd = new FormData()
        fd.append('data', JSON.stringify(payload))
        beneficiariosFiles.value.forEach((file, i) => {
          if (file) fd.append(`beneficiario_doc_${i}`, file)
        })
        response = await reenviarApi(afiliadoEditandoId.value, fd)
      } else {
        response = await reenviarApi(afiliadoEditandoId.value, payload)
      }
      const { data } = response
      toast.success('Afiliación corregida y reenviada para aprobación')
      resetForm()
      return data
    } catch (err) {
      if (err.response?.status === 400 && err.response.data?.errors) {
        const serverErrors = {}
        err.response.data.errors.forEach(e => { serverErrors[e.field] = e.message })
        errors.value = serverErrors
        toast.error('Por favor corrija los errores del formulario')
      } else {
        toast.error('Error al reenviar la afiliación. Intente de nuevo.')
      }
      throw err
    } finally {
      isSubmitting.value = false
    }
  }

  function resetForm() {
    Object.assign(afiliado, {
      sucursal: '',
      novedad: '',
      vigenciaDesde: isoHoy(),
      vigenciaHasta: isoUnAnio(),
      tipoDocumento: '',
      numeroDocumento: '',
      primerApellido: '',
      segundoApellido: '',
      primerNombre: '',
      segundoNombre: '',
      fechaNacimiento: '',
      edad: 0,
      sexo: '',
      estadoCivil: '',
      celular: '',
      celularTieneWhatsapp: false,
      celular2: '',
      email: '',
      departamento: '',
      ciudad: '',
      barrio: '',
      direccion: '',
      nit: '',
      nombreEmpresa: '',
      empresaId: null,
      unidadNegocio: '',
      planVeolia: '',
      canal: '',
      producto: '',
      grupo: '',
      asistenciaFueraDeCasa: '',
      actividadEconomica: '',
      ocupacion: '',
      codigoCiiu: '',
      usuarioCens: '',
      cicloEstrato: '',
      relacionPredio: '',
      observaciones: '',
      diferenteAlContratante: false
    })
    beneficiarios.value      = []
    beneficiariosFiles.value = []
    seguros.value = []
    tarifaActiva.value = null
    cedulaFrontal.value = null
    cedulaReverso.value = null
    Object.assign(contrato, {
      tarifaId: null,
      valorPlanExequial: 0,
      valorAdicionales: 0,
      valorAsistencia: 0,
      valorSeguros: 0,
      valorTotal: 0,
      periodicidad: 'MENSUAL',
      nCuotas: 11,
      valorCuota: 0
    })
    contratoCompetenciaFile.value = null
    Object.assign(pago, {
      formaPago:          '',
      soporteFile:        null,
      valorRecibido:      '',
      referenciaPago1:    '',
      referenciaPago2:    '',
      referenciaPago3:    '',
      fechaPagoTentativa: ''
    })
    modoCorreccion.value     = false
    afiliadoEditandoId.value = null
    errors.value = {}
    aceptaTratamiento.value  = false
    borradorId.value         = null
    borradorGuardadoAt.value = null
    borradorError.value      = false
    cedulaFrontalUrl.value       = ''
    cedulaReversoUrl.value       = ''
    soportePagoUrl.value         = ''
    contratoCompetenciaUrl.value = ''
    // Incrementar la key reactiva → fuerza remount de componentes con archivos
    // (limpia previews locales y .value de los <input type="file">)
    formResetKey.value++
  }

  async function submitRegistro() {
    const toast = useToastStore()
    isSubmitting.value = true
    errors.value = {}

    try {
      const payload = {
        ...afiliado,
        diferenteAlContratante: afiliado.diferenteAlContratante ? 1 : 0,
        beneficiarios: beneficiarios.value,
        seguros: seguros.value,
        contrato: { ...contrato },
        formaPago:          pago.formaPago,
        valorRecibido:      pago.valorRecibido !== '' ? parseFloat(pago.valorRecibido) : null,
        referenciaPago1:    pago.referenciaPago1,
        referenciaPago2:    pago.referenciaPago2,
        referenciaPago3:    pago.referenciaPago3,
        fechaPagoTentativa: pago.fechaPagoTentativa || null
      }

      const apiFn = formMode.value === 'veolia' ? createAfiliadoVeolia : createAfiliado

      let response
      const hayDocsBenef = beneficiariosFiles.value.some(f => f != null)
      const hayContratoComp = !!contratoCompetenciaFile.value
      if (pago.soporteFile || cedulaFrontal.value || cedulaReverso.value || hayDocsBenef || hayContratoComp) {
        const fd = new FormData()
        fd.append('data', JSON.stringify(payload))
        if (pago.soporteFile)              fd.append('soporte',              pago.soporteFile)
        if (cedulaFrontal.value)           fd.append('cedulaFrontal',        cedulaFrontal.value)
        if (cedulaReverso.value)           fd.append('cedulaReverso',        cedulaReverso.value)
        if (contratoCompetenciaFile.value) fd.append('contratoCompetencia',  contratoCompetenciaFile.value)
        // Documentos adjuntos por beneficiario (opcionales)
        beneficiariosFiles.value.forEach((file, i) => {
          if (file) fd.append(`beneficiario_doc_${i}`, file)
        })
        response = await apiFn(fd)
      } else {
        response = await apiFn(payload)
      }

      const { data } = response
      toast.success('Afiliado registrado exitosamente')
      await descartarBorrador()   // elimina borrador del backend (si existe) y llama resetForm()
      return data
    } catch (err) {
      if (err.response?.status === 400 && err.response.data?.errors) {
        const serverErrors = {}
        err.response.data.errors.forEach(e => {
          serverErrors[e.field] = e.message
        })
        errors.value = serverErrors
        toast.error('Por favor corrija los errores del formulario')
      } else {
        // 409 ya no aplica: el numeroDocumento dejó de ser unique
        // (una persona puede tener varios contratos).
        toast.error(err.response?.data?.message || 'Error al registrar. Intente de nuevo.')
      }
      throw err
    } finally {
      isSubmitting.value = false
    }
  }

  /**
   * Precarga SOLO los datos personales / contacto / ubicación / actividad
   * económica de un afiliado existente. No toca contrato, beneficiarios,
   * seguros, pago, ni archivos — el asesor está creando un segundo contrato
   * para el mismo cliente.
   * @param {object} a Afiliado existente retornado por GET /afiliados/buscar/:doc
   */
  function precargarDatosPersonales(a) {
    // Bloquear cascada de watchers (departamento → ciudad='') que de otra
    // forma borraría la ciudad recién precargada.
    cargandoFormulario.value = true
    Object.assign(afiliado, {
      tipoDocumento:        a.tipoDocumento        || afiliado.tipoDocumento,
      numeroDocumento:      a.numeroDocumento      || afiliado.numeroDocumento,
      primerNombre:         a.primerNombre         || '',
      segundoNombre:        a.segundoNombre        || '',
      primerApellido:       a.primerApellido       || '',
      segundoApellido:      a.segundoApellido      || '',
      fechaNacimiento:      a.fechaNacimiento?.split('T')[0] || '',
      edad:                 a.edad                 ?? 0,
      sexo:                 a.sexo                 || '',
      estadoCivil:          a.estadoCivil          || '',
      celular:              a.celular              || '',
      celularTieneWhatsapp: !!Number(a.celularTieneWhatsapp || 0),
      celular2:             a.celular2             || '',
      email:                a.email                || '',
      departamento:         a.departamento         || '',
      ciudad:               a.ciudad               || '',
      barrio:               a.barrio               || '',
      direccion:            a.direccion            || '',
      actividadEconomica:   a.actividadEconomica   || '',
      ocupacion:            a.ocupacion            || '',
      codigoCiiu:           a.codigoCiiu           || '',
      // CENS y estrato — antes faltaban y quedaban en blanco al precargar
      cicloEstrato:         a.cicloEstrato         || '',
      usuarioCens:          a.usuarioCens          || '',
      relacionPredio:       a.relacionPredio       || ''
    })
    // limpiar errores de validación previos que ya quedaron resueltos
    errors.value = {}
    nextTick(() => { cargandoFormulario.value = false })
  }

  return {
    afiliado,
    formMode,
    formResetKey,
    aceptaTratamiento,
    beneficiarios,
    beneficiariosFiles,
    seguros,
    contrato,
    pago,
    cedulaFrontal,
    cedulaReverso,
    contratoCompetenciaFile,
    setContratoCompetenciaFile,
    tarifaActiva,
    cargandoFormulario,
    cedulaFrontalUrl,
    cedulaReversoUrl,
    soportePagoUrl,
    contratoCompetenciaUrl,
    modoCorreccion,
    afiliadoEditandoId,
    isSubmitting,
    errors,
    beneficiariosDeLey,
    beneficiariosAdicional,
    esCanalCens,
    isFormValid,
    setFormMode,
    addBeneficiario,
    removeBeneficiario,
    updateBeneficiario,
    addSeguro,
    removeSeguro,
    updateContrato,
    setPago,
    cargarParaCorregir,
    submitCorreccion,
    resetForm,
    submitRegistro,
    precargarDatosPersonales,
    // Borrador
    borradorId,
    borradorGuardando,
    borradorGuardadoAt,
    borradorError,
    guardarBorrador,
    cargarBorrador,
    descartarBorrador
  }
})
