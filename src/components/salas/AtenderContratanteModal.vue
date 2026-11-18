<script setup>
/**
 * AtenderContratanteModal.vue — confirma la atención del contratante de un homenaje en sala.
 * Props: open, homenaje (item de GET /sv/salas/homenajes)
 * Emit: close, atendido (respuesta de POST …/atender), cerrado (el homenaje ya no está en curso)
 * La validez del teléfono la decide el backend; si responde 422, se piden los datos.
 */
import { ref, computed, watch } from 'vue';
import { salasApi } from '@/api/salasApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  homenaje: { type: Object, default: null }
});
const emit = defineEmits(['close', 'atendido', 'cerrado']);

const toast = useToastStore();
const { notify, extract } = useApiError();

const CODIGOS_DATOS = ['NOMBRE_REQUERIDO', 'TELEFONO_REQUERIDO'];
const CODIGOS_CERRADO = ['HOMENAJE_CERRADO', 'HOMENAJE_NO_ENCONTRADO'];

const nombre = ref('');
const telefono = ref('');
const pedirDatos = ref(false);
const guardando = ref(false);

const faltanDatos = computed(() => !props.homenaje?.contratante_nombre || !props.homenaje?.contratante_telefono);
const mostrarCampos = computed(() => faltanDatos.value || pedirDatos.value);

watch(() => props.open, (abierto) => {
  if (!abierto) return;
  nombre.value = props.homenaje?.contratante_nombre || '';
  telefono.value = props.homenaje?.contratante_telefono || '';
  pedirDatos.value = false;
}, { immediate: true });

async function confirmar() {
  if (mostrarCampos.value && (!nombre.value.trim() || !telefono.value.trim())) {
    toast.warning('Escribe el nombre y el teléfono del contratante');
    return;
  }
  guardando.value = true;
  try {
    const datos = mostrarCampos.value ? { nombre: nombre.value.trim(), telefono: telefono.value.trim() } : {};
    const r = await salasApi.atender(props.homenaje.id, datos);
    emit('atendido', r.data);
  } catch (e) {
    const codigo = e?.response?.data?.error;
    if (CODIGOS_DATOS.includes(codigo)) {
      pedirDatos.value = true;
      toast.warning(extract(e));
    } else if (CODIGOS_CERRADO.includes(codigo)) {
      toast.warning(extract(e));
      emit('cerrado');
    } else {
      notify(e);
    }
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="Atender contratante" max-width="max-w-md" @close="emit('close')">
    <div v-if="homenaje" class="space-y-3">
      <div class="text-xs text-text3">{{ homenaje.sala_nombre }} · {{ homenaje.sede_nombre }}</div>
      <div class="text-sm">Homenaje de <strong>{{ homenaje.nombre_ser_querido || '—' }}</strong></div>

      <div class="sv-card p-3">
        <div class="text-xs text-text3">Contratante</div>
        <div class="font-semibold text-text1">{{ homenaje.contratante_nombre || 'Sin nombre registrado' }}</div>
        <div class="text-sm text-text2">{{ homenaje.contratante_telefono || 'Sin teléfono registrado' }}</div>
      </div>

      <div v-if="mostrarCampos" data-testid="campos-contratante" class="space-y-3">
        <p class="text-xs text-warning">Completa los datos del contratante para crear el cliente.</p>
        <BaseInput v-model="nombre" label="Nombre del contratante" required />
        <BaseInput v-model="telefono" label="Teléfono" type="tel" required />
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="guardando" @click="confirmar">Atender</BaseButton>
    </template>
  </BaseModal>
</template>
