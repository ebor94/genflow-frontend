<script setup>
/**
 * MarcarConvenioModal.vue — al firmar un convenio B2B, captura la vigencia.
 * Por defecto: inicio = hoy, vencimiento = inicio + 1 año.
 * El backend dispara el flujo de renovación 30 días antes del vencimiento.
 */
import { ref, computed, watch } from 'vue';
import { renovacionesApi } from '@/api/renovacionesApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import dayjs from 'dayjs';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open:      { type: Boolean, required: true },
  prospecto: { type: Object, default: null }
});
const emit = defineEmits(['close', 'firmado']);

const toast = useToastStore();
const { notify } = useApiError();

const fechaInicio = ref(dayjs().format('YYYY-MM-DD'));
const fechaVenc   = ref(dayjs().add(1, 'year').format('YYYY-MM-DD'));
const loading     = ref(false);

// Cada vez que cambia el inicio, auto-actualizar el vencimiento (+1 año)
watch(fechaInicio, (val) => {
  if (val) fechaVenc.value = dayjs(val).add(1, 'year').format('YYYY-MM-DD');
});

watch(() => props.open, (v) => {
  if (v) {
    fechaInicio.value = dayjs().format('YYYY-MM-DD');
    fechaVenc.value   = dayjs().add(1, 'year').format('YYYY-MM-DD');
  }
});

const meses = computed(() => {
  if (!fechaInicio.value || !fechaVenc.value) return 0;
  return dayjs(fechaVenc.value).diff(dayjs(fechaInicio.value), 'month');
});

async function firmar() {
  if (!fechaInicio.value || !fechaVenc.value) {
    toast.warning('Debes definir fecha de inicio y vencimiento'); return;
  }
  if (dayjs(fechaVenc.value).isBefore(dayjs(fechaInicio.value))) {
    toast.warning('La fecha de vencimiento debe ser posterior a la de inicio'); return;
  }
  loading.value = true;
  try {
    const r = await renovacionesApi.marcarConvenio(
      props.prospecto.prosp_id,
      fechaInicio.value,
      fechaVenc.value
    );
    toast.success('Convenio firmado registrado');
    emit('firmado', r.data);
    emit('close');
  } catch (e) {
    notify(e);
  } finally { loading.value = false; }
}
</script>

<template>
  <BaseModal :open="open" title="🤝 Firmar convenio B2B" max-width="max-w-lg" @close="emit('close')">
    <div v-if="prospecto" class="space-y-4">
      <div class="bg-cream/60 rounded-sv p-3">
        <div class="text-xs text-text3">Empresa</div>
        <div class="font-semibold text-text1">
          {{ prospecto.empresa?.empresa_razon_social || 'Empresa' }}
        </div>
      </div>

      <p class="text-sm text-text2">
        Registra la vigencia del convenio. <strong>30 días antes del vencimiento</strong>,
        el sistema creará automáticamente un prospecto de renovación asignado al mismo asesor.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BaseInput v-model="fechaInicio" label="Fecha de inicio" type="date" required />
        <BaseInput v-model="fechaVenc"   label="Fecha de vencimiento" type="date" required />
      </div>

      <div class="text-xs text-text3 bg-warning/5 border border-warning/30 rounded-sv p-3">
        ⏰ Vigencia: <strong>{{ meses }} meses</strong>
        ({{ dayjs(fechaInicio).format('DD/MM/YYYY') }} → {{ dayjs(fechaVenc).format('DD/MM/YYYY') }})
        <br/>
        🔄 Renovación se generará automáticamente el
        <strong>{{ dayjs(fechaVenc).subtract(30, 'day').format('DD/MM/YYYY') }}</strong>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="loading" @click="firmar">Firmar convenio</BaseButton>
    </template>
  </BaseModal>
</template>
