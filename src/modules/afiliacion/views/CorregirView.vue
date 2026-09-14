<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'
import { useToastStore } from '@afi/stores/useToastStore'
import { getAfiliadoPorHash } from '@afi/api/afiliadoApi'
import AfiliadoForm from '@afi/components/afiliado/AfiliadoForm.vue'
import SegurosForm from '@afi/components/afiliado/SegurosForm.vue'
import ValorContrato from '@afi/components/afiliado/ValorContrato.vue'
import BeneficiarioForm from '@afi/components/beneficiario/BeneficiarioForm.vue'
import BeneficiarioList from '@afi/components/beneficiario/BeneficiarioList.vue'
import BaseButton from '@afi/components/ui/BaseButton.vue'
import ObservacionesField from '@afi/components/ui/ObservacionesField.vue'

const route  = useRoute()
const router = useRouter()
const store  = useAfiliadoStore()
const toast  = useToastStore()

const cargando   = ref(true)
const errorCarga = ref(false)
const beneficiarioFormRef = ref(null)
const afiliadoInfo = ref(null)
const realId = ref(null)

function handleAddBeneficiario(beneficiario) {
  const added = store.addBeneficiario(beneficiario)
  if (added) toast.success('Beneficiario agregado')
}

function handleEditBeneficiario(beneficiario, index) {
  beneficiarioFormRef.value?.editarBeneficiario(beneficiario, index)
  beneficiarioFormRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Esta vista es solo canal ASESOR — Veolia se redirige a corregirVeolia en
// onMounted. El asesor está autenticado (JWT) por lo que no se pide OTP.
async function handleSubmitClick() {
  if (!store.isFormValid) {
    toast.warning('Complete todos los campos obligatorios del afiliado')
    return
  }
  try {
    await store.submitCorreccion()
    router.push({ name: 'misAfiliaciones' })
  } catch {
    // Errores ya manejados en el store (toast)
  }
}

function handleReset() {
  if (confirm('¿Descartar todos los cambios y volver?')) {
    store.resetForm()
    router.push({ name: 'misAfiliaciones' })
  }
}

onMounted(async () => {
  const hash = route.params.hash
  try {
    // getAfiliadoPorHash decodifica el hash en el backend y valida que esté rechazado
    const { data } = await getAfiliadoPorHash(hash)
    if (!data.success || !data.data) throw new Error('No encontrado')

    // Si el afiliado es de origen Veolia, redirigir al formulario correspondiente
    if (data.data.origen === 'VEOLIA') {
      router.replace({ name: 'corregirVeolia', params: { hash } })
      return
    }

    realId.value = data.data.id
    afiliadoInfo.value = data.data
    store.cargarParaCorregir(data.data)
  } catch (e) {
    errorCarga.value = true
    const msg = e.response?.data?.message || 'No se pudo cargar la afiliación'
    toast.error(msg)
  } finally {
    cargando.value = false
  }
})

// Al salir del view, limpiar el modo corrección si no se envió
onBeforeUnmount(() => {
  if (store.modoCorreccion) store.resetForm()
})
</script>

<template>
  <div class="space-y-6">

    <!-- ── Cargando ──────────────────────────────────────────── -->
    <div v-if="cargando" class="flex justify-center py-24">
      <div class="flex flex-col items-center gap-3 text-gray-400">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="text-sm">Cargando afiliación...</span>
      </div>
    </div>

    <!-- ── Error ────────────────────────────────────────────── -->
    <div v-else-if="errorCarga" class="text-center py-24">
      <svg class="mx-auto w-12 h-12 text-red-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <p class="text-gray-500 font-medium">No se pudo cargar la afiliación</p>
      <button @click="router.push({ name: 'misAfiliaciones' })"
              class="mt-4 text-sm text-blue-600 hover:underline">
        Volver a mis afiliaciones
      </button>
    </div>

    <!-- ── Formulario ────────────────────────────────────────── -->
    <template v-else>

      <!-- Header -->
      <div>
        <div class="flex items-center gap-2 mb-1">
          <button @click="router.push({ name: 'misAfiliaciones' })"
                  class="text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h2 class="text-2xl font-bold text-gray-900">Corregir Afiliación Rechazada</h2>
        </div>
        <p class="text-sm text-gray-500 ml-7">Edite los datos y reenvíe para nueva aprobación.</p>
      </div>

      <!-- Banner motivo de rechazo -->
      <div v-if="afiliadoInfo?.motivoRechazo"
           class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
        <svg class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <p class="text-sm font-semibold text-red-800">Motivo del rechazo:</p>
          <p class="text-sm text-red-700 mt-0.5">{{ afiliadoInfo.motivoRechazo }}</p>
        </div>
      </div>

      <!-- Formulario (reutiliza los mismos componentes que RegistroView) -->
      <AfiliadoForm />

      <fieldset class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <legend class="text-base font-bold text-gray-800 px-2">Grupo Familiar</legend>
        <div class="space-y-5 mt-2">
          <BeneficiarioForm
            ref="beneficiarioFormRef"
            @add="handleAddBeneficiario"
          />
          <BeneficiarioList @edit="handleEditBeneficiario" />
        </div>
      </fieldset>

      <SegurosForm />
      <ValorContrato />

      <!-- Observaciones -->
      <ObservacionesField :uppercase="true" />

      <!-- Botones de acción -->
      <div class="flex flex-wrap gap-3 pb-8">
        <BaseButton
          variant="primary"
          :loading="store.isSubmitting"
          :disabled="!store.isFormValid"
          @click="handleSubmitClick"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
          Reenviar para aprobación
        </BaseButton>

        <BaseButton variant="secondary" @click="handleReset">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          Cancelar
        </BaseButton>
      </div>

    </template>

  </div>
</template>
