<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { reportesApi } from '@/api/reportesApi';
import { fmtCOP, fmtNumero } from '@/utils/format';

import KpiCard from '@/components/dashboard/KpiCard.vue';
import MetaBar from '@/components/common/MetaBar.vue';
import BarraProgreso from '@/components/dashboard/BarraProgreso.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';

const auth = useAuthStore();
const { notify } = useApiError();

const periodo = ref('mes');
const data = ref(null);
const loading = ref(false);

const opcPeriodo = [
  { value: 'hoy',       label: 'Hoy' },
  { value: 'semana',    label: 'Esta semana' },
  { value: 'mes',       label: 'Este mes' },
  { value: 'trimestre', label: 'Este trimestre' },
  { value: 'anio',      label: 'Este año' }
];

function rangoPeriodo() {
  const hoy = new Date();
  const fin = hoy.toISOString().slice(0, 10);
  let inicio;
  switch (periodo.value) {
    case 'hoy':       inicio = fin; break;
    case 'semana':    { const d = new Date(); d.setDate(d.getDate() - 6); inicio = d.toISOString().slice(0,10); } break;
    case 'mes':       inicio = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`; break;
    case 'trimestre': { const m = hoy.getMonth(); const startM = m - (m % 3); inicio = `${hoy.getFullYear()}-${String(startM+1).padStart(2,'0')}-01`; } break;
    case 'anio':      inicio = `${hoy.getFullYear()}-01-01`; break;
  }
  return { desde: inicio, hasta: fin };
}

async function cargar() {
  loading.value = true;
  try {
    const { desde, hasta } = rangoPeriodo();
    const params = periodo.value === 'mes'
      ? { mes: new Date().getMonth() + 1, anio: new Date().getFullYear() }
      : { desde, hasta };
    const r = await reportesApi.asesor(auth.usuario.usr_id, params);
    data.value = r.data;
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(cargar);

const totales = computed(() => data.value?.totales || { gestiones: 0, interesados: 0, contratos: 0, valor: 0 });
const tasaCierre = computed(() => totales.value.gestiones > 0
  ? Math.round((totales.value.contratos / totales.value.gestiones) * 100)
  : 0);
const distribucion = computed(() => data.value?.distribucion || []);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <h1 class="font-serif text-3xl text-brown-deep">Mis métricas</h1>
      <BaseSelect v-model="periodo" :options="opcPeriodo" @change="cargar" class="max-w-[180px]" />
    </header>

    <div v-if="loading" class="text-text3 text-center py-12">Cargando...</div>
    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Contratos"   icon="✅" :value="totales.contratos"   color-hex="#2A6E47" />
        <KpiCard label="Gestiones"   icon="📞" :value="fmtNumero(totales.gestiones)" />
        <KpiCard label="Interesados" icon="🎯" :value="totales.interesados" color-hex="#1A5C8A" />
        <KpiCard label="Valor vendido" icon="💰" :value="fmtCOP(totales.valor)" color-hex="#9B4F20" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="sv-card p-5">
          <h3 class="font-serif text-lg text-brown-deep mb-4">Cumplimiento de meta</h3>
          <MetaBar v-if="data?.meta" :actual="totales.contratos" :meta="data.meta.meta_contratos" label="Contratos del mes" unidad="contratos" />
          <MetaBar v-if="data?.meta" :actual="totales.gestiones" :meta="data.meta.meta_gestiones" label="Gestiones del mes" unidad="" color-hex="#1A5C8A" class="mt-3" />
          <p class="text-xs text-text3 mt-4">Tasa de cierre: <strong class="text-sage">{{ tasaCierre }}%</strong> (contratos / gestiones)</p>
        </div>

        <div class="sv-card p-5">
          <h3 class="font-serif text-lg text-brown-deep mb-4">Distribución por resultado</h3>
          <div v-if="distribucion.length" class="space-y-2">
            <BarraProgreso
              v-for="d in distribucion" :key="d.codigo"
              :label="d.nombre || d.codigo"
              :value="parseInt(d.total)"
              :max="Math.max(...distribucion.map(x => parseInt(x.total)))"
            />
          </div>
          <p v-else class="text-text3 text-center text-sm py-6">Sin gestiones en el período</p>
        </div>
      </div>
    </template>
  </div>
</template>
