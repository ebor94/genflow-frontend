<template>
  <div class="space-y-6">
    <!-- Banner de actualización de datos -->
    <div class="relative w-full overflow-hidden rounded-xl shadow-md">
      <img
        src="@afi/assets/images/ActualizacionVeolia.jpeg"
        alt="Actualizar tus datos - La mejor forma de estar en contacto contigo"
        class="w-full h-auto object-cover"
      />
    </div>

    <!-- Panel de consulta: ¿Ya estás registrado? -->
    <div class="bg-teal-50 border border-teal-200 rounded-xl px-5 py-4">
      <button
        @click="showConsulta = !showConsulta"
        class="flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900 transition-colors w-full text-left"
      >
        <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span class="flex-1">{{ showConsulta ? 'Ocultar consulta' : '¿Ya estás registrado? Consulta y actualiza tu información' }}</span>
        <svg
          :class="['w-4 h-4 transition-transform duration-200', showConsulta && 'rotate-180']"
          fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-if="showConsulta" class="mt-4">
        <ConsultaAfiliadoView />
      </div>
    </div>

    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Registro de Afiliado / Grupo Familiar</h2>
        <p class="text-sm text-gray-500 mt-1">Complete los datos del afiliado y agregue los beneficiarios</p>
      </div>

      <!-- Botón para re-abrir el modal informativo -->
      <button
        @click="showInfo = true"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors flex-shrink-0"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Grupos asegurables y tarifas
      </button>
    </div>

    <!-- Formulario del afiliado -->
    <!-- :key se incrementa tras submit exitoso → remount limpia inputs file y previews -->
    <AfiliadoForm :key="store.formResetKey" />

    <!-- Seccion de beneficiarios -->
    <fieldset class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <legend class="text-base font-bold text-gray-800 px-2">Grupo Familiar</legend>

      <div class="space-y-5 mt-2">
        <!-- Formulario para agregar beneficiario -->
        <BeneficiarioForm :key="store.formResetKey" ref="beneficiarioFormRef" @add="handleAddBeneficiario" />

        <!-- Lista de beneficiarios -->
        <BeneficiarioList @edit="handleEditBeneficiario" />
      </div>
    </fieldset>

    <!-- Asistencia fuera de casa -->
    <fieldset class="bg-white rounded-xl border border-teal-200 shadow-sm p-5">
      <legend class="flex items-center gap-2 text-base font-bold text-gray-800 px-2">
        Asistencia fuera de casa (Opcional)
        <button
          type="button"
          @click="showAsistenciaInfo = true"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                 bg-teal-100 hover:bg-teal-200 text-teal-700 border border-teal-300
                 cursor-pointer transition-colors shadow-sm"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          Ver beneficios
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </legend>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <BaseSelect
          v-model="store.afiliado.asistenciaFueraDeCasa"
          label="¿Desea incluir asistencia fuera de casa por solo $ 2.100 mes?"
          :options="opcionesSiNo"
          :error="store.errors['asistenciaFueraDeCasa']"
        />
      </div>
    </fieldset>

    <AsistenciaInfoModal :visible="showAsistenciaInfo" @close="showAsistenciaInfo = false" />

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

    <!-- Modal informativo: grupos asegurables y tarifas (se abre automáticamente al cargar) -->
    <InfoGruposModal
      :visible="showInfo"
      @close="showInfo = false"
    />

    <!-- Modal captcha matematico -->
    <CaptchaModal
      :visible="showCaptcha"
      @verified="handleCaptchaVerified"
      @cancel="handleCaptchaCancel"
    />

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'
import { useToastStore } from '@afi/stores/useToastStore'
import AfiliadoForm from '@afi/components/afiliado/AfiliadoVeoliaForm.vue'
import BeneficiarioForm from '@afi/components/beneficiario/BeneficiarioForm.vue'
import BeneficiarioList from '@afi/components/beneficiario/BeneficiarioList.vue'
import BaseButton from '@afi/components/ui/BaseButton.vue'
import BaseSelect from '@afi/components/ui/BaseSelect.vue'
import CaptchaModal from '@afi/components/ui/CaptchaModal.vue'
import InfoGruposModal from '@afi/components/ui/InfoGruposModal.vue'
import AceptacionDatosCheck from '@afi/components/ui/AceptacionDatosCheck.vue'
import AsistenciaInfoModal from '@afi/components/ui/AsistenciaInfoModal.vue'
import ConsultaAfiliadoView from '@afi/views/ConsultaAfiliadoView.vue'

const store  = useAfiliadoStore()
const toast  = useToastStore()

const showCaptcha        = ref(false)
const showInfo           = ref(true)   // Se abre automáticamente al cargar la página
const showConsulta       = ref(false)
const showAsistenciaInfo = ref(false)

const opcionesSiNo = [
  { value: 'SI', label: 'Sí, deseo la asistencia' },
  { value: 'NO', label: 'No deseo la asistencia' }
]

const beneficiarioFormRef = ref(null)

onMounted(() => {
  store.setFormMode('veolia')

  // ── Widget de chat WhatsApp ───────────────────────────────
  const widgetOptions = {
    enabled: true,
    chatButtonSetting: {
      backgroundColor: '#34ba73',
      ctaText: 'Escribenos, te ayudamos',
      position: 'right',
      marginLeft: '20',
      marginRight: '20',
      marginBottom: '20'
    },
    brandSetting: {
      autoShow: false,
      brandName: 'Los Olivos - Veolia',
      brandImg: 'https://storage.googleapis.com/formailfiles/logo-1msg.svg',
      welcomeText: 'Necesitas ayuda? Estamos para servirle',
      messageText: 'Hola, Soy colaborador de Veolia, necesito asesoria',
      ctaText: 'Escribenos, te ayudamos',
      phoneNumber: '573176652197'
    }
  }
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = 'https://storage.googleapis.com/formailfiles/1msgWidget.js'
  script.onload = () => {
    if (window.CreateWhatsappChatWidget) {
      window.CreateWhatsappChatWidget(widgetOptions)
    }
  }
  document.head.appendChild(script)
})

onBeforeUnmount(() => {
  // Remover el widget al salir de la página
  document.querySelectorAll('[class*="wachat"], [id*="wachat"], [class*="1msg"], [id*="1msg"]')
    .forEach(el => el.remove())
})

function handleAddBeneficiario(beneficiario) {
  const added = store.addBeneficiario(beneficiario)
  if (added) toast.success('Beneficiario agregado')
}

function handleEditBeneficiario(beneficiario, index) {
  beneficiarioFormRef.value?.editarBeneficiario(beneficiario, index)
  beneficiarioFormRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleSubmitClick() {
  if (!store.isFormValid) {
    toast.warning('Complete todos los campos obligatorios del afiliado')
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
    store.resetForm()
    toast.info('Formulario limpiado')
  }
}
</script>
