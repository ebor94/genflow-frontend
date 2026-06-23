<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useApiError } from '@/composables/useApiError';
import { papApi } from '@/api/papApi';
import { sumaDistancias } from '@/utils/haversine';

import KpiCard from '@/components/dashboard/KpiCard.vue';
import BarraProgreso from '@/components/dashboard/BarraProgreso.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const { notify } = useApiError();

const desde = ref(new Date().toISOString().slice(0, 10));
const hasta = ref(new Date().toISOString().slice(0, 10));
const data = ref(null);
const loading = ref(false);

async function cargar() {
  loading.value = true;
  try {
    const r = await papApi.metricas({ desde: desde.value, hasta: hasta.value });
    data.value = r.data;
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(cargar);

const km = computed(() => data.value?.coords ? sumaDistancias(data.value.coords).toFixed(1) : '0');

// Filas de la distribución (todas las opciones del modal de gestión)
const distribucion = computed(() => [
  { label: '✅ Afiliados',            valor: data.value?.afiliadas       ?? 0, color: '#2A6E47' },
  { label: '⭐ Interesados',           valor: data.value?.interesadas     ?? 0, color: '#C97B1A' },
  { label: '🔁 Volver a contactar',     valor: data.value?.volver          ?? 0, color: '#1A5C8A' },
  { label: '🚫 No interesados',       valor: data.value?.no_interesados  ?? 0, color: '#B83227' },
  { label: '🏠 Sin respuesta',        valor: data.value?.sin_respuesta   ?? 0, color: '#8A6A52' }
]);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <h1 class="font-serif text-3xl text-brown-deep">Métricas Individual</h1>
      <div class="flex gap-2 items-end">
        <BaseInput v-model="desde" type="date" label="Desde" />
        <BaseInput v-model="hasta" type="date" label="Hasta" />
        <BaseButton variant="secondary" size="sm" @click="cargar">↻</BaseButton>
      </div>
    </header>

    <div v-if="loading" class="text-center py-12 text-text3">Cargando...</div>

    <template v-else-if="data">
      <!-- KPIs principales -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KpiCard label="Visitas totales"    icon="🚶"  :value="data.total_visitas"           color-hex="#2A6E47" />
        <KpiCard label="Afiliadas"          icon="✅"  :value="data.afiliadas"               color-hex="#2A6E47" />
        <KpiCard label="Tasa afiliación"    icon="🎯"  :value="`${data.tasa_afiliacion}%`"   color-hex="#C8902A" />
        <KpiCard label="Km recorridos"      icon="🛣️"  :value="`${km} km`"                   color-hex="#1A5C8A" />
      </div>

      <!-- KPIs secundarios: todos los demás resultados -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Interesados"        icon="⭐"  :value="data.interesadas"              color-hex="#C97B1A" />
        <KpiCard label="Volver a contactar"   icon="🔁"  :value="data.volver"                   color-hex="#1A5C8A" />
        <KpiCard label="No interesados"     icon="🚫"  :value="data.no_interesados"           color-hex="#B83227" />
        <KpiCard label="Sin respuesta"      icon="🏠"  :value="data.sin_respuesta"            color-hex="#8A6A52" />
      </div>

      <!-- Indicador adicional: tasa de conversión = (afiliados + interesados) / total -->
      <div v-if="data.tasa_conversion != null" class="sv-card p-4 mb-5 flex items-center gap-3">
        <span class="text-2xl">📈</span>
        <div class="flex-1">
          <div class="text-xs text-text3 uppercase tracking-wider">Tasa de conversión total</div>
          <div class="font-serif text-2xl text-brown-deep">{{ data.tasa_conversion }}%</div>
          <div class="text-xs text-text2">Afiliados + interesados sobre el total de visitas</div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="sv-card p-5">
          <h3 class="font-serif text-lg text-brown-deep mb-4">Distribución por resultado</h3>
          <div class="space-y-3">
            <BarraProgreso v-for="d in distribucion" :key="d.label"
                           :label="`${d.label} (${d.valor})`"
                           :value="d.valor"
                           :max="data.total_visitas || 1"
                           :color-hex="d.color" />
          </div>
          <p v-if="!data.total_visitas" class="text-text3 text-sm text-center mt-4 italic">
            Sin visitas en este rango.
          </p>
        </div>

        <div class="sv-card p-5">
          <h3 class="font-serif text-lg text-brown-deep mb-4">Zonas trabajadas</h3>
          <div v-if="data.zonas_trabajadas?.length" class="flex flex-wrap gap-2">
            <span v-for="z in data.zonas_trabajadas" :key="z"
                  class="px-3 py-1.5 text-sm font-semibold rounded-full bg-area-pap/10 text-area-pap border border-area-pap/30">
              📍 {{ z }}
            </span>
          </div>
          <p v-else class="text-text3 text-sm">Sin zonas registradas.</p>

          <div v-if="data.total_visitas" class="mt-5 pt-4 border-t border-text3/10 text-sm text-text2 space-y-1">
            <div class="flex justify-between">
              <span>Productivas (afiliadas + interesadas)</span>
              <strong>{{ (data.afiliadas + data.interesadas) }}</strong>
            </div>
            <div class="flex justify-between">
              <span>Seguimiento pendiente</span>
              <strong>{{ data.volver }}</strong>
            </div>
            <div class="flex justify-between text-text3">
              <span>Descartadas / sin éxito</span>
              <strong>{{ data.no_interesados + data.sin_respuesta }}</strong>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
