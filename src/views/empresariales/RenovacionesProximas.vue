<script setup>
/**
 * RenovacionesProximas.vue — lista de empresas con convenio próximo a vencer
 * (ventana configurable, default 30 días). Incluye también el dashboard de
 * convenios VENCIDOS sin renovar.
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { renovacionesApi } from '@/api/renovacionesApi';
import { useApiError } from '@/composables/useApiError';
import { useNit } from '@/composables/useNit';
import dayjs from 'dayjs';

import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const router = useRouter();
const auth = useAuthStore();
const { notify } = useApiError();
const { formato: fmtNit } = useNit();

const ventana = ref(30);
const tab = ref('proximas');
const proximas = ref([]);
const vencidos = ref([]);
const loading = ref(false);

const OPCIONES_DIAS = [
  { value: 15,  label: '15 días' },
  { value: 30,  label: '30 días' },
  { value: 60,  label: '60 días' },
  { value: 90,  label: '90 días' }
];

const TABS = [
  { value: 'proximas', label: '🔄 Por vencer' },
  { value: 'vencidos', label: '⚠️ Vencidos sin renovar' }
];

function colorUrgencia(dias) {
  if (dias <= 7)   return 'bg-danger/15 text-danger';
  if (dias <= 15)  return 'bg-warning/15 text-warning';
  return 'bg-gold/15 text-gold';
}

async function cargar() {
  loading.value = true;
  try {
    const [p, v] = await Promise.all([
      renovacionesApi.proximas(ventana.value),
      renovacionesApi.vencidos()
    ]);
    proximas.value = p.data;
    vencidos.value = v.data;
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

function irFicha(empresaId) {
  router.push({ name: 'emp-ficha', params: { id: empresaId } });
}

onMounted(cargar);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="sv-card p-5 mb-4 border-l-4 border-area-emp">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="font-serif text-2xl text-brown-deep">🔄 Renovaciones de convenios B2B</h1>
          <p class="text-sm text-text2 mt-1">
            Empresas con convenio próximo a vencer o vencidos sin renovar.
            La renovación se genera automáticamente 30 días antes del vencimiento.
          </p>
        </div>
        <BaseSelect v-if="tab === 'proximas'"
                    v-model.number="ventana"
                    :options="OPCIONES_DIAS"
                    label="Ventana"
                    class="w-36"
                    @update:modelValue="cargar" />
      </div>
    </header>

    <!-- Tabs -->
    <div class="border-b border-text3/15 flex gap-1 mb-4">
      <button v-for="t in TABS" :key="t.value"
              @click="tab = t.value"
              class="px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors"
              :class="tab === t.value ? 'border-area-emp text-area-emp' : 'border-transparent text-text3 hover:text-text2'">
        {{ t.label }}
        <span class="ml-1 text-xs">({{ t.value === 'proximas' ? proximas.length : vencidos.length }})</span>
      </button>
    </div>

    <div v-if="loading" class="text-text3 text-center py-12">Cargando...</div>

    <!-- Tab: Por vencer -->
    <section v-else-if="tab === 'proximas'">
      <EmptyState v-if="!proximas.length"
                  titulo="Sin renovaciones próximas"
                  :descripcion="`No hay convenios que venzan en los próximos ${ventana} días.`" />
      <article v-for="p in proximas" :key="p.prosp_id"
               class="sv-card p-4 mb-3 flex items-center gap-3 hover:shadow-sv-pop cursor-pointer transition-shadow"
               @click="irFicha(p.empresa.empresa_id)">
        <div class="w-12 h-12 rounded-sv bg-area-emp/15 text-area-emp font-bold flex items-center justify-center text-xl">
          🏢
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-text1 truncate">{{ p.empresa.empresa_razon_social }}</div>
          <div class="text-xs text-text3">
            NIT {{ fmtNit(p.empresa.empresa_nit) }}
            <span v-if="p.empresa.empresa_sector"> · {{ p.empresa.empresa_sector }}</span>
          </div>
          <div class="text-xs text-text2 mt-1">
            👤 Asesor: {{ p.asesor?.usr_nombre }} {{ p.asesor?.usr_apellido }}
            <span class="text-text3"> · Vence: {{ dayjs(p.prosp_fecha_vencimiento_convenio).format('DD/MM/YYYY') }}</span>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <span class="px-2 py-1 rounded-full text-xs font-bold"
                :class="colorUrgencia(p.dias_restantes)">
            {{ p.dias_restantes === 0 ? 'HOY' : p.dias_restantes === 1 ? 'MAÑANA' : `${p.dias_restantes}d` }}
          </span>
          <span v-if="p.renovacion_ya_creada"
                class="text-[10px] px-2 py-0.5 rounded-full bg-sage/15 text-sage font-semibold">
            ✓ Renovación creada
          </span>
          <span v-else class="text-[10px] text-text3">
            Pendiente
          </span>
        </div>
      </article>
    </section>

    <!-- Tab: Vencidos sin renovar -->
    <section v-else>
      <EmptyState v-if="!vencidos.length"
                  titulo="Sin convenios vencidos"
                  descripcion="No hay convenios marcados como vencidos sin renovación." />
      <article v-for="p in vencidos" :key="p.prosp_id"
               class="sv-card p-4 mb-3 flex items-center gap-3 border border-danger/20 hover:shadow-sv-pop cursor-pointer transition-shadow"
               @click="irFicha(p.empresa.empresa_id)">
        <div class="w-12 h-12 rounded-sv bg-danger/15 text-danger font-bold flex items-center justify-center text-xl">
          ⚠️
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-text1 truncate">{{ p.empresa.empresa_razon_social }}</div>
          <div class="text-xs text-text3">
            NIT {{ fmtNit(p.empresa.empresa_nit) }}
            <span v-if="p.empresa.empresa_sector"> · {{ p.empresa.empresa_sector }}</span>
          </div>
          <div class="text-xs text-text2 mt-1">
            👤 Último asesor: {{ p.asesor?.usr_nombre }} {{ p.asesor?.usr_apellido }}
            <span class="text-danger"> · Venció: {{ dayjs(p.prosp_fecha_vencimiento_convenio).format('DD/MM/YYYY') }}</span>
          </div>
        </div>
        <span class="px-2 py-1 rounded-full bg-danger/15 text-danger text-xs font-bold shrink-0">
          Hace {{ p.dias_vencido }}d
        </span>
      </article>
    </section>
  </div>
</template>
