<script setup>
/**
 * PanelSupervisorFideliz.vue — vista del supervisor de Previsión sobre el
 * equipo de Fidelización. Por ahora reusa el panel del agente (próximos
 * cumples + métricas) ampliado con vista por agente.
 *
 * En un futuro: tabla TablaAsesores filtrada por grupo FIDELIZACION.
 */
import { onMounted, computed } from 'vue';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useApiError } from '@/composables/useApiError';

import KpiCard from '@/components/dashboard/KpiCard.vue';
import CumpleCard from '@/components/fideliz/CumpleCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const store = useFidelizacionStore();
const { notify } = useApiError();

async function recargar() {
  try {
    await store.fetchProximos(7);
    await store.fetchMetricas({});
  } catch (e) { notify(e); }
}

const m = computed(() => store.metricas || {});

onMounted(recargar);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="sv-card p-5 mb-4 border-l-4" style="border-left-color: #be185d">
      <h1 class="font-serif text-2xl text-brown-deep">👁️‍🗨️ Supervisor — Fidelización</h1>
      <p class="text-sm text-text2 mt-1">Equipo de Fidelización Empresas: envíos y eventos próximos.</p>
    </header>

    <!-- KPIs consolidados -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <KpiCard label="Total envíos"     :value="m.total ?? 0" icon="📤" colorHex="#be185d" />
      <KpiCard label="Confirmados"      :value="m.confirmados ?? 0" icon="✅" colorHex="#6B8F6E" />
      <KpiCard label="Pendientes envío" :value="m.enviados_pendientes ?? 0" icon="⏳" colorHex="#C8902A" />
      <KpiCard label="% Confirmados"    :value="`${m.porcentaje_confirmados ?? 0}%`" icon="📈" colorHex="#C8902A" />
    </div>

    <!-- Próximos eventos (7 días) -->
    <section class="sv-card p-5">
      <h3 class="font-serif text-base text-brown-deep mb-3">Próximos 7 días</h3>
      <EmptyState v-if="!store.proximos.length" titulo="Sin eventos próximos" size="sm" />
      <div v-else class="space-y-3">
        <CumpleCard v-for="(ev, i) in store.proximos.slice(0, 10)" :key="`s-${ev.persona_id}-${ev.tipo}-${i}`"
                    :evento="ev"
                    @registrar="() => {}" @llamar="() => {}" />
      </div>
    </section>
  </div>
</template>
