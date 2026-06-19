<script setup>
/**
 * FormContactoFideliz.vue — modal con formulario para registrar/editar un
 * contacto fidelización de una empresa, con N fechas especiales.
 */
import { ref, watch } from 'vue';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';

import BaseModal    from '@/components/ui/BaseModal.vue';
import BaseInput    from '@/components/ui/BaseInput.vue';
import BaseSelect   from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton   from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open:      { type: Boolean, required: true },
  empresaId: { type: Number, required: true }
});
const emit = defineEmits(['close', 'creado']);

const fidelizStore = useFidelizacionStore();
const toast        = useToastStore();
const { notify }   = useApiError();
const loading      = ref(false);

const persona = ref({
  persona_nombre: '',
  persona_apellido: '',
  persona_telefono_principal: '',
  persona_email: '',
  persona_fecha_nacimiento: '',
  persona_genero: ''
});
const cargo         = ref('');
const departamento  = ref('');
const fechaIngreso  = ref('');
const esTitular     = ref(false);
const observaciones = ref('');
const fechas        = ref([]); // [{tipo, fecha, descripcion}]

const TIPOS = [
  { value: 'nacimiento',          label: '🎂 Cumpleaños' },
  { value: 'aniversario_laboral', label: '💼 Aniversario laboral' },
  { value: 'aniversario_boda',    label: '💍 Aniversario boda' },
  { value: 'otro',                label: '🎉 Otro' }
];

const GENEROS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'N', label: 'No especificado' }
];

watch(() => props.open, (v) => {
  if (v) {
    persona.value = { persona_nombre: '', persona_apellido: '', persona_telefono_principal: '', persona_email: '', persona_fecha_nacimiento: '', persona_genero: '' };
    cargo.value = ''; departamento.value = ''; fechaIngreso.value = ''; esTitular.value = false; observaciones.value = '';
    fechas.value = [];
  }
});

function agregarFecha() {
  fechas.value.push({ tipo: 'nacimiento', fecha: '', descripcion: '' });
}
function quitarFecha(i) {
  fechas.value.splice(i, 1);
}

async function guardar() {
  if (!persona.value.persona_nombre || !persona.value.persona_telefono_principal) {
    toast.warning('Nombre y teléfono son requeridos'); return;
  }
  loading.value = true;
  try {
    const payload = {
      cargo:         cargo.value || null,
      departamento:  departamento.value || null,
      fecha_ingreso: fechaIngreso.value || null,
      es_titular:    esTitular.value,
      observaciones: observaciones.value || null,
      persona: {
        persona_nombre:             persona.value.persona_nombre,
        persona_apellido:           persona.value.persona_apellido || null,
        persona_telefono_principal: persona.value.persona_telefono_principal,
        persona_email:              persona.value.persona_email || null,
        persona_fecha_nacimiento:   persona.value.persona_fecha_nacimiento || null,
        persona_genero:             persona.value.persona_genero || null
      },
      fechas_especiales: fechas.value.filter(f => f.fecha && f.tipo)
    };
    const r = await fidelizStore.crearContacto(props.empresaId, payload);
    toast.success('Contacto registrado para fidelización');
    emit('creado', r);
    emit('close');
  } catch (e) {
    if (e.response?.data?.error === 'DUPLICATE_CONTACTO') {
      toast.warning('Esta persona ya es contacto de fidelización de esta empresa');
    } else { notify(e); }
  } finally { loading.value = false; }
}
</script>

<template>
  <BaseModal :open="open" title="Nuevo contacto fidelización" max-width="max-w-3xl" @close="emit('close')">
    <div class="space-y-6">
      <!-- Datos persona -->
      <fieldset>
        <legend class="font-serif text-base text-brown-deep mb-2">👤 Datos del contacto</legend>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BaseInput  v-model="persona.persona_nombre"   label="Nombres" required />
          <BaseInput  v-model="persona.persona_apellido" label="Apellidos" />
          <BaseInput  v-model="persona.persona_telefono_principal" label="Teléfono" required />
          <BaseInput  v-model="persona.persona_email" label="Email corporativo" type="email" />
          <BaseInput  v-model="persona.persona_fecha_nacimiento" label="Fecha nacimiento" type="date" />
          <BaseSelect v-model="persona.persona_genero" label="Género" :options="GENEROS" placeholder="Sin especificar" />
        </div>
      </fieldset>

      <!-- Datos del rol en la empresa -->
      <fieldset>
        <legend class="font-serif text-base text-brown-deep mb-2">💼 Rol en la empresa</legend>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BaseInput v-model="cargo"        label="Cargo" placeholder="Gerente General, Jefe RRHH..." />
          <BaseInput v-model="departamento" label="Departamento / Área" />
          <BaseInput v-model="fechaIngreso" label="Fecha ingreso" type="date" />
          <label class="flex items-center gap-2 mt-7">
            <input type="checkbox" v-model="esTitular" class="w-4 h-4 accent-warning" />
            <span class="text-sm text-text2">Es titular del convenio</span>
          </label>
        </div>
        <BaseTextarea v-model="observaciones" label="Observaciones" class="mt-3" />
      </fieldset>

      <!-- Fechas especiales adicionales -->
      <fieldset>
        <legend class="font-serif text-base text-brown-deep mb-2">📅 Fechas especiales adicionales</legend>
        <p class="text-xs text-text3 mb-2">
          El cumpleaños se toma de "Fecha nacimiento" arriba. Día de la madre/padre se calcula automáticamente
          del género. Aquí puedes agregar aniversarios laborales, bodas u otras fechas relevantes.
        </p>
        <div v-for="(f, i) in fechas" :key="i" class="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-2">
          <BaseSelect v-model="f.tipo"        :options="TIPOS" class="sm:col-span-3" />
          <BaseInput  v-model="f.fecha"       type="date" class="sm:col-span-3" />
          <BaseInput  v-model="f.descripcion" placeholder="Descripción" class="sm:col-span-5" />
          <BaseButton variant="ghost" size="sm" @click="quitarFecha(i)" class="sm:col-span-1">×</BaseButton>
        </div>
        <BaseButton variant="secondary" size="sm" @click="agregarFecha">+ Agregar fecha</BaseButton>
      </fieldset>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="loading" @click="guardar">Guardar contacto</BaseButton>
    </template>
  </BaseModal>
</template>
