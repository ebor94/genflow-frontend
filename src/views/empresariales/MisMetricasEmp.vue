<script setup>
/**
 * Métricas B2B — variante de MisMetricas con KPIs específicos.
 * KPIs: convenios firmados, valor promedio, tasa cierre B2B, propuestas enviadas.
 */
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { reportesApi } from '@/api/reportesApi';
import { propuestasApi } from '@/api/propuestasApi';
import { fmtCOP, fmtNumero } from '@/utils/format';

import KpiCard from '@/components/dashboard/KpiCard.vue';
import MetaBar from '@/components/common/MetaBar.vue';
import BarraProgreso from '@/components/dashboard/BarraProgreso.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';

const auth = useAuthStore();
const { notify } = useApiError();

const periodo = ref('mes');
const data = ref(null);
const propuestasPorEstado = ref([]);
const loading = ref(false);

const opcPeriodo = [
  { value: 'mes',       label: 'Este mes' },
  { value: 'trimestre', label: 'Este trimestre' },
  { value: 'anio',      label: 'Este año' }
];

function rangoPeriodo() {
  const hoy = new Date();
  const fin = hoy.toISOString().slice(0, 10);
  let inicio;
  switch (periodo.value) {
    case 'mes':       inicio = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`; break;
    case 'trimestre': { const m = hoy.getMonth(); const startM = m - (m % 3); inicio = `${hoy.getFullYear()}-${String(startM+1).padStart(2,'0')}-01`; } break;
    case 'anio':      inicio = `${hoy.getFullYear()}-01-01`; break;
  }
  return { desde: inicio, hasta: fin };
}

async function cargar() {
  loading.value = true;
  try {
    const params = periodo.value === 'mes'
      ? { mes: new Date().getMonth() + 1, anio: new Date().getFullYear() }
      : rangoPeriodo();
    const r = await reportesApi.asesor(auth.usuario.usr_id, params);
    data.value = r.data;
    // Propuestas del asesor
    const pr = await propuestasApi.list({ limit: 100 });
    propuestasPorEstado.value = pr.data.items;
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(cargar);

const totales = computed(() => data.value?.totales || { gestiones: 0, interesados: 0, contratos: 0, valor: 0 });
const tasaCierre = computed(() => totales.value.gestiones > 0
  ? Math.round((totales.value.contratos / totales.value.gestiones) * 100)
  : 0);

const propuestasStats = computed(() => {
  const enviadas  = propuestasPorEstado.value.filter(p => ['enviada','aceptada','rechazada'].includes(p.prop_estado));
  const aceptadas = propuestasPorEstado.value.filter(p => p.prop_estado === 'aceptada');
  const valorTotal = enviadas.reduce((s, p) => s + parseFloat(p.prop_valor_total || 0), 0);
  return {
    total: propuestasPorEstado.value.length,
    enviadas: enviadas.length,
    aceptadas: aceptadas.length,
    valorPromedio: enviadas.length ? valorTotal / enviadas.length : 0,
    tasaAceptacion: enviadas.length ? Math.round((aceptadas.length / enviadas.length) * 100) : 0
  };
});
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <h1 class="font-serif text-3xl text-brown-deep">Métricas B2B</h1>
      <BaseSelect v-model="periodo" :options="opcPeriodo" @change="cargar" class="max-w-[180px]" />
    </header>

    <div v-if="loading" class="text-text3 text-center py-12">Cargando...</div>
    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Convenios firmados" icon="✅" :value="totales.contratos" color-hex="#2A6E47" />
        <KpiCard label="Propuestas enviadas" icon="📄" :value="propuestasStats.enviadas" color-hex="#1A5C8A" />
        <KpiCard label="Tasa aceptación" icon="🎯" :value="`${propuestasStats.tasaAceptacion}%`" color-hex="#9B4F20" />
        <KpiCard label="Valor promedio" icon="💰" :value="fmtCOP(propuestasStats.valorPromedio)" color-hex="#C8902A" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="sv-card p-5">
          <h3 class="font-serif text-lg text-brown-deep mb-4">Meta del período</h3>
          <MetaBar v-if="data?.meta" :actual="totales.contratos" :meta="data.meta.meta_contratos" label="Convenios" unidad="convenios" color-hex="#1A5C8A" />
          <MetaBar v-if="data?.meta" :actual="totales.gestiones" :meta="data.meta.meta_gestiones" label="Gestiones" color-hex="#1A5C8A" class="mt-3" />
          <p class="text-xs text-text3 mt-4">Tasa de cierre: <strong class="text-sage">{{ tasaCierre }}%</strong></p>
        </div>

        <div class="sv-card p-5">
          <h3 class="font-serif text-lg text-brown-deep mb-4">Distribución por resultado</h3>
          <div v-if="data?.distribucion?.length" class="space-y-2">
            <BarraProgreso
              v-for="d in data.distribucion" :key="d.codigo"
              :label="d.nombre || d.codigo"
              :value="parseInt(d.total)"
              :max="Math.max(...data.distribucion.map(x => parseInt(x.total)))"
              color-hex="#1A5C8A"
            />
          </div>
          <p v-else class="text-text3 text-center text-sm py-6">Sin gestiones en el período</p>
        </div>
      </div>
    </template>
  </div>
</template>
