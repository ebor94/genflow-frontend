<script setup>
/**
 * MisMetricasFideliz.vue — métricas del agente de Fidelización.
 */
import { ref, onMounted, computed } from 'vue';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useApiError } from '@/composables/useApiError';
import dayjs from 'dayjs';

import KpiCard from '@/components/dashboard/KpiCard.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';

const store = useFidelizacionStore();
const { notify } = useApiError();

const periodo = ref('mes');

const PERIODOS = [
  { value: 'hoy',     label: 'Hoy' },
  { value: 'semana',  label: 'Esta semana' },
  { value: 'mes',     label: 'Este mes' },
  { value: 'trim',    label: 'Trimestre' },
  { value: 'anio',    label: 'Año' }
];

function rangoPeriodo() {
  const hoy = dayjs();
  switch (periodo.value) {
    case 'hoy':    return { desde: hoy.format('YYYY-MM-DD'), hasta: hoy.format('YYYY-MM-DD') };
    case 'semana': return { desde: hoy.startOf('week').format('YYYY-MM-DD'), hasta: hoy.endOf('week').format('YYYY-MM-DD') };
    case 'mes':    return { desde: hoy.startOf('month').format('YYYY-MM-DD'), hasta: hoy.endOf('month').format('YYYY-MM-DD') };
    case 'trim':   return { desde: hoy.subtract(3, 'month').format('YYYY-MM-DD'), hasta: hoy.format('YYYY-MM-DD') };
    case 'anio':   return { desde: hoy.startOf('year').format('YYYY-MM-DD'), hasta: hoy.endOf('year').format('YYYY-MM-DD') };
  }
}

async function recargar() {
  try {
    const { desde, hasta } = rangoPeriodo();
    await store.fetchMetricas({ desde, hasta });
  } catch (e) { notify(e); }
}

const m = computed(() => store.metricas || {});

const TIPO_LABEL = {
  nacimiento: 'Cumpleaños',
  aniversario_laboral: 'Aniv. laboral',
  aniversario_boda: 'Aniv. boda',
  dia_madre: 'Día Madre',
  dia_padre: 'Día Padre',
  otro: 'Otro'
};

onMounted(recargar);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="sv-card p-5 mb-4 border-l-4" style="border-left-color: #be185d">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 class="font-serif text-2xl text-brown-deep">📊 Mis métricas</h1>
          <p class="text-sm text-text2 mt-1">Detalles enviados y tasa de confirmación.</p>
        </div>
        <BaseSelect v-model="periodo" :options="PERIODOS" class="w-44" @update:modelValue="recargar" />
      </div>
    </header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <KpiCard label="Total envíos" :value="m.total ?? 0" icon="📤" colorHex="#be185d" />
      <KpiCard label="Confirmados"  :value="m.confirmados ?? 0" icon="✅" colorHex="#6B8F6E" />
      <KpiCard label="Devueltos"    :value="m.devueltos ?? 0" icon="↩️" colorHex="#B83227" />
      <KpiCard label="% Confirmados" :value="`${m.porcentaje_confirmados ?? 0}%`" icon="📈" colorHex="#C8902A" />
    </div>

    <section v-if="m.por_tipo?.length" class="sv-card p-5">
      <h3 class="font-serif text-base text-brown-deep mb-3">Distribución por tipo de evento</h3>
      <div class="space-y-2">
        <div v-for="t in m.por_tipo" :key="t.tipo" class="flex items-center gap-3">
          <span class="text-sm text-text2 w-32">{{ TIPO_LABEL[t.tipo] || t.tipo }}</span>
          <div class="flex-1 h-2 rounded-full bg-cream overflow-hidden">
            <div class="h-full" style="background-color: #be185d"
                 :style="{ width: `${m.total ? (t.total / m.total) * 100 : 0}%` }"></div>
          </div>
          <span class="text-sm font-semibold w-12 text-right">{{ t.total }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
