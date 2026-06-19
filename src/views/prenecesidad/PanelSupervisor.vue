<script setup>
/**
 * PanelSupervisor.vue
 * Si el supervisor tiene >1 grupo (auth.usuario.grupos_supervisados), muestra tabs:
 *   - Consolidado (suma de los grupos asignados)
 *   - Una tab por grupo
 * Si solo tiene 1 grupo, oculta los tabs.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { reportesApi } from '@/api/reportesApi';

import KpiCard from '@/components/dashboard/KpiCard.vue';
import TablaAsesores from '@/components/dashboard/TablaAsesores.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import CargarListaModal from '@/components/crm/CargarListaModal.vue';

const auth = useAuthStore();
const { notify } = useApiError();

// Rango de fechas (default: hoy)
const hoyISO = new Date().toISOString().slice(0, 10);
const desde = ref(hoyISO);
const hasta = ref(hoyISO);
const loading = ref(false);
const showCargarLista = ref(false);

// Presets de rango — utiles para el supervisor (Hoy, Semana, Mes, Trimestre)
const PRESETS = [
  { label: 'Hoy',        dias: 0  },
  { label: '7 días',     dias: 6  },
  { label: '30 días',    dias: 29 },
  { label: 'Trimestre',  dias: 89 }
];

function aplicarPreset(dias) {
  const hoy = new Date();
  const desdeDate = new Date(hoy.getTime() - dias * 86400000);
  desde.value = desdeDate.toISOString().slice(0, 10);
  hasta.value = hoy.toISOString().slice(0, 10);
}

const rangoLabel = computed(() => {
  if (desde.value === hasta.value) return desde.value;
  return `${desde.value} → ${hasta.value}`;
});

// Tab activo: 'consolidado' o el grupo_id como string
const tab = ref('consolidado');

// Data por grupo: Map<grupoId, { asesores: [] }>
const dataPorGrupo = ref(new Map());

const grupos = computed(() => auth.usuario?.grupos_supervisados || []);
const multiGrupo = computed(() => grupos.value.length > 1);

// Si solo hay 1 grupo, fuerza ese
watch(grupos, (g) => {
  if (g.length === 1) tab.value = String(g[0].grupo_id);
}, { immediate: true });

async function cargar() {
  if (!grupos.value.length) return;
  if (desde.value > hasta.value) {
    notify(new Error('La fecha "Desde" no puede ser mayor que "Hasta"'));
    return;
  }
  loading.value = true;
  dataPorGrupo.value = new Map();
  try {
    // Cargar reportes en paralelo de TODOS los grupos supervisados
    const resultados = await Promise.all(
      grupos.value.map(g =>
        reportesApi.equipo(g.grupo_id, { desde: desde.value, hasta: hasta.value })
          .then(r => [g.grupo_id, r.data])
      )
    );
    const m = new Map();
    for (const [gid, data] of resultados) m.set(gid, data);
    dataPorGrupo.value = m;
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(cargar);
watch([desde, hasta], cargar);

// Asesores y totales del tab activo
const asesoresVisibles = computed(() => {
  if (tab.value === 'consolidado') {
    // Concatena asesores de todos los grupos
    return Array.from(dataPorGrupo.value.values()).flatMap(d => d?.asesores || []);
  }
  const gid = parseInt(tab.value);
  return dataPorGrupo.value.get(gid)?.asesores || [];
});

const totales = computed(() => {
  const ases = asesoresVisibles.value;
  return {
    gestiones:   ases.reduce((s, a) => s + (a.snap_gestiones_realizadas || 0), 0),
    interesados: ases.reduce((s, a) => s + (a.snap_interesados_nuevos || 0), 0),
    contratos:   ases.reduce((s, a) => s + (a.snap_contratos_cerrados || 0), 0),
    vencidas:    ases.reduce((s, a) => s + (a.snap_vencidas_acumuladas || 0), 0)
  };
});

const titulo = computed(() => {
  if (tab.value === 'consolidado') return 'Panel del Supervisor — Consolidado';
  const g = grupos.value.find(g => g.grupo_id === parseInt(tab.value));
  return g ? `Panel del Supervisor — ${g.grupo_nombre}` : 'Panel del Supervisor';
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="mb-5">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h1 class="font-serif text-3xl text-brown-deep">{{ titulo }}</h1>
        <div class="flex gap-2 items-end flex-wrap">
          <BaseInput v-model="desde" type="date" label="Desde" />
          <BaseInput v-model="hasta" type="date" label="Hasta" />
          <BaseButton variant="secondary" size="sm" @click="cargar" title="Refrescar">↻</BaseButton>
          <BaseButton variant="primary" size="sm" @click="showCargarLista = true">📥 Asignar lista</BaseButton>
        </div>
      </div>

      <!-- Presets rápidos -->
      <div class="flex items-center gap-2 flex-wrap text-xs">
        <span class="text-text3">Rango rápido:</span>
        <button v-for="p in PRESETS" :key="p.label"
                @click="aplicarPreset(p.dias)"
                class="px-3 py-1 rounded-full border border-text3/20 hover:border-gold hover:text-gold transition-colors text-text2 font-semibold">
          {{ p.label }}
        </button>
        <span class="ml-2 text-text3 italic">Mostrando: {{ rangoLabel }}</span>
      </div>
    </header>

    <!-- Tabs solo si tiene más de un grupo -->
    <div v-if="multiGrupo" class="border-b border-text3/15 flex gap-1 mb-5 overflow-x-auto">
      <button
        @click="tab = 'consolidado'"
        class="px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap"
        :class="tab === 'consolidado' ? 'border-gold text-gold' : 'border-transparent text-text3 hover:text-text2'">
        📊 Consolidado
        <span class="ml-1 text-xs opacity-70">({{ grupos.length }} grupos)</span>
      </button>
      <button v-for="g in grupos" :key="g.grupo_id"
              @click="tab = String(g.grupo_id)"
              class="px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap"
              :class="tab === String(g.grupo_id) ? 'border-gold text-gold' : 'border-transparent text-text3 hover:text-text2'">
        {{ g.grupo_nombre }}
        <span class="ml-1 text-xs opacity-70">({{ (dataPorGrupo.get(g.grupo_id)?.asesores?.length || 0) }})</span>
      </button>
    </div>

    <div v-if="loading" class="text-text3 text-center py-12">Cargando...</div>

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Gestiones del día" icon="📞" :value="totales.gestiones" />
        <KpiCard label="Interesados"       icon="🎯" :value="totales.interesados" color-hex="#1A5C8A" />
        <KpiCard label="Contratos"         icon="✅" :value="totales.contratos"   color-hex="#2A6E47" />
        <KpiCard label="Vencidas"          icon="🔴" :value="totales.vencidas"    color-hex="#B83227" />
      </div>

      <h2 class="font-serif text-xl text-brown-deep mb-3">
        Rendimiento del equipo
        <span class="text-sm text-text3 font-sans">({{ asesoresVisibles.length }} asesores)</span>
      </h2>
      <TablaAsesores :asesores="asesoresVisibles" />
    </template>

    <CargarListaModal :open="showCargarLista" @close="showCargarLista = false" @cargada="() => { showCargarLista = false; cargar(); }" />
  </div>
</template>
