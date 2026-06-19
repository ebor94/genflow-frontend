<script setup>
/**
 * AgendarProximaModal.vue — actualiza prosp_prox_gestion_fecha/hora sin crear gestión.
 * Útil para reagendar rápidamente.
 */
import { ref, watch } from 'vue';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  prospecto: { type: Object, default: null }
});
const emit = defineEmits(['close', 'actualizado']);

const store = useProspectosStore();
const toast = useToastStore();
const { notify } = useApiError();

const fecha = ref('');
const hora  = ref('');
const saving = ref(false);

watch(() => props.open, (v) => {
  if (v && props.prospecto) {
    fecha.value = props.prospecto.prosp_prox_gestion_fecha || '';
    hora.value  = props.prospecto.prosp_prox_gestion_hora?.slice(0,5) || '';
  }
});

async function guardar() {
  if (!fecha.value) { toast.warning('Selecciona una fecha'); return; }
  saving.value = true;
  try {
    const r = await store.actualizar(props.prospecto.prosp_id, {
      prosp_prox_gestion_fecha: fecha.value,
      prosp_prox_gestion_hora:  hora.value || null
    });
    toast.success('Próxima gestión actualizada');
    emit('actualizado', r);
    emit('close');
  } catch (e) {
    notify(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="Agendar próxima gestión" @close="emit('close')">
    <p class="text-sm text-text2 mb-4">Actualiza la próxima fecha sin registrar una gestión nueva.</p>
    <div class="grid grid-cols-2 gap-3">
      <BaseInput v-model="fecha" label="Fecha" type="date" required />
      <BaseInput v-model="hora"  label="Hora"  type="time" />
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="saving" @click="guardar">Guardar</BaseButton>
    </template>
  </BaseModal>
</template>
