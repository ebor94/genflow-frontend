<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'
import { useToastStore } from '@afi/stores/useToastStore'
import { useAutosave } from '@afi/composables/useAutosave'
import { getBorrador } from '@afi/api/afiliadoApi'
import AfiliadoForm from '@afi/components/afiliado/AfiliadoForm.vue'
import SegurosForm from '@afi/components/afiliado/SegurosForm.vue'
import ValorContrato from '@afi/components/afiliado/ValorContrato.vue'
import BeneficiarioForm from '@afi/components/beneficiario/BeneficiarioForm.vue'
import BeneficiarioList from '@afi/components/beneficiario/BeneficiarioList.vue'
import BaseButton from '@afi/components/ui/BaseButton.vue'
import CaptchaModal from '@afi/components/ui/CaptchaModal.vue'
import PagoInicialSection from '@afi/components/ui/PagoInicialSection.vue'
import AceptacionDatosCheck from '@afi/components/ui/AceptacionDatosCheck.vue'
import ObservacionesField from '@afi/components/ui/ObservacionesField.vue'

const store = useAfiliadoStore()
const toast = useToastStore()
const route = useRoute()
const showCaptcha     = ref(false)
const pagoSectionRef  = ref(null)

// Auto-guardado de borrador (debounced 3 s)
useAutosave()

// Indicador de estado del borrador
const borradorEstadoTexto = computed(() => {
  if (store.borradorGuardando) return 'Guardando pre-afiliación...'
  if (store.borradorError)     return 'Error al guardar pre-afiliación'
  if (store.borradorGuardadoAt) return 'Pre-afiliación guardada ✓'
  return ''
})

// Cargar borrador si se navegó con ?borrador=:id
async function cargarOResetear(borradorId) {
  if (borradorId) {
    // Cargar el borrador solicitado por query
    try {
      const { data } = await getBorrador(borradorId)
      if (data.success) {
        store.cargarBorrador(data.data)
        toast.info('Pre-afiliación recuperada')
      }
    } catch {
      toast.error('No se pudo cargar la pre-afiliación')
    }
    return
  }
  // Sin ?borrador=: si el store quedó cargado de una sesión previa
  // (asesor entró a recuperar borrador y ahora pulsa "Nuevo registro"),
  // limpiar el formulario para empezar desde cero.
  if (store.borradorId || store.afiliado.numeroDocumento || store.afiliado.primerNombre) {
    store.resetForm()
  }
}

onMounted(() => {
  cargarOResetear(route.query.borrador)
})

// Si la query cambia mientras la vista sigue montada (cambio de borrador
// o quitar el query), recargar/resetear según corresponda.
watch(() => route.query.borrador, (nuevo, viejo) => {
  if (nuevo === viejo) return
  cargarOResetear(nuevo)
})

// Ref al componente BeneficiarioForm para llamar editarBeneficiario
const beneficiarioFormRef = ref(null)

function handleAddBeneficiario(beneficiario) {
  const added = store.addBeneficiario(beneficiario)
  if (added) toast.success('Beneficiario agregado')
}

// Recibe el evento @edit de BeneficiarioList y carga los datos en el form
function handleEditBeneficiario(beneficiario, index) {
  beneficiarioFormRef.value?.editarBeneficiario(beneficiario, index)
  beneficiarioFormRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleSubmitClick() {
  if (!store.isFormValid) {
    toast.warning('Complete todos los campos obligatorios del afiliado')
    return
  }
  // Validar sección de pago (se expande automáticamente si hay errores)
  if (!pagoSectionRef.value?.validar()) {
    pagoSectionRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  showCaptcha.value = true
}

async function handleCaptchaVerified() {
  showCaptcha.value = false
  try {
    await store.submitRegistro()
  } catch {
    // Error ya manejado en el store
  }
}

function handleCaptchaCancel() {
  showCaptcha.value = false
  toast.info('Registro cancelado')
}

function handleReset() {
  if (confirm('Esta seguro de limpiar todo el formulario?')) {
    store.descartarBorrador()   // elimina borrador del backend (si existe) + resetForm()
    toast.info('Formulario limpiado')
  }
}
</script>

<template>
  <div class="space-y-6">

    <!-- Titulo -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Registro de Afiliado / Grupo Familiar</h2>
        <p class="text-sm text-gray-500 mt-1">Complete los datos del afiliado y agregue los beneficiarios</p>
      </div>

      <!-- Indicador de borrador -->
      <div v-if="store.borradorId || store.borradorGuardando"
           class="flex items-center gap-1.5 text-xs shrink-0 mt-1 px-2.5 py-1.5 rounded-lg font-medium"
           :class="store.borradorError
             ? 'bg-red-50 text-red-600 border border-red-200'
             : store.borradorGuardando
               ? 'bg-gray-50 text-gray-500 border border-gray-200'
               : 'bg-green-50 text-green-700 border border-green-200'">
        <!-- Spinner guardando -->
        <svg v-if="store.borradorGuardando" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <!-- Icono error -->
        <svg v-else-if="store.borradorError" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
        </svg>
        <!-- Icono check -->
        <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>{{ borradorEstadoTexto }}</span>
      </div>
    </div>

    <!-- Secciones 1-7: AfiliadoForm contiene solicitud, datos personales,
         ubicacion, empresa, comercial, CENS y actividad economica -->
    <!-- :key se incrementa tras submit exitoso → remount completo limpia inputs file -->
    <AfiliadoForm :key="store.formResetKey" />

    <!-- Seccion 9: Grupo familiar
         - Oculto en grupos UNIPERSONAL/INDIVIDUAL del canal INDIVIDUAL
         - PERO se muestra si el asesor marca "El afiliado es diferente al
           contratante" para que pueda registrar al ASEGURADO PRINCIPAL -->
    <fieldset
      v-if="store.afiliado.diferenteAlContratante
            || !(store.afiliado.canal === 'INDIVIDUAL' && (store.afiliado.grupo === 'UNIPERSONAL' || store.afiliado.grupo === 'INDIVIDUAL'))"
      class="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
    >
      <legend class="text-base font-bold text-gray-800 px-2">Grupo Familiar</legend>
      <div class="space-y-5 mt-2">
        <BeneficiarioForm
          :key="store.formResetKey"
          ref="beneficiarioFormRef"
          @add="handleAddBeneficiario"
        />
        <BeneficiarioList @edit="handleEditBeneficiario" />
      </div>
    </fieldset>

    <!-- Seccion 10: Seguros -->
    <SegurosForm />

    <!-- Seccion 11: Valor del contrato -->
    <ValorContrato />

    <!-- Seccion 12: Primer pago -->
    <PagoInicialSection :key="store.formResetKey" ref="pagoSectionRef" />

    <!-- Observaciones (antes de la declaración de tratamiento de datos) -->
    <ObservacionesField :uppercase="true" />

    <!-- Aceptación de tratamiento de datos -->
    <AceptacionDatosCheck v-model="store.aceptaTratamiento" />

    <!-- Botones de accion -->
    <div class="flex flex-wrap gap-3 pb-8">
      <BaseButton
        variant="primary"
        :loading="store.isSubmitting"
        :disabled="!store.isFormValid"
        @click="handleSubmitClick"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Registrar Afiliado
      </BaseButton>

      <BaseButton variant="secondary" @click="handleReset">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
        </svg>
        Limpiar formulario
      </BaseButton>
    </div>

    <!-- Modal captcha matematico -->
    <CaptchaModal
      :visible="showCaptcha"
      @verified="handleCaptchaVerified"
      @cancel="handleCaptchaCancel"
    />

  </div>
</template>
