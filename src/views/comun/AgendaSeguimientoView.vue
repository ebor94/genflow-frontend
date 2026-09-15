<template>
  <div class="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Seguimiento de agenda</h1>
        <p class="text-sm text-slate-500">Vista del equipo: eventos, links públicos y gestiones.</p>
      </div>
    </header>

    <!-- Selector de asesores + navegador -->
    <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      <div class="flex-1 max-w-md">
        <SelectorAsesoresMulti v-model="asesoresIds" />
      </div>
      <div v-if="tab === 'semana'" class="flex items-center gap-2">
        <button class="px-2 py-1 border rounded text-sm" @click="cambiarSemana(-1)">‹</button>
        <span class="text-sm text-slate-700 min-w-[7rem] text-center">
          Semana {{ semanaISO }} · {{ anio }}
        </span>
        <button class="px-2 py-1 border rounded text-sm" @click="cambiarSemana(1)">›</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
      <nav class="flex border-b border-gray-200 text-sm font-medium">
        <button v-for="t in tabs" :key="t.key" type="button"
                :class="tab === t.key
                  ? 'text-green-700 border-b-2 border-green-700'
                  : 'text-slate-500 hover:text-slate-700'"
                class="flex-1 py-3" @click="tab = t.key">
          {{ t.label }}
        </button>
      </nav>

      <div class="p-4">
        <div v-if="tab === 'semana'">
          <div v-if="cargando" class="text-center py-8 text-slate-400 text-sm">Cargando…</div>
          <SemanaGrid v-else-if="semanaData" :semana-data="semanaData" />
        </div>
        <div v-else-if="tab === 'listado'">
          <EventoListadoTabla :asesores-ids="asesoresIds" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { agendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';
import SelectorAsesoresMulti from '@/components/agenda/SelectorAsesoresMulti.vue';
import SemanaGrid from '@/components/agenda/SemanaGrid.vue';
import EventoListadoTabla from '@/components/agenda/EventoListadoTabla.vue';

const toast = useToastStore();

const tabs = [
  { key: 'semana',  label: 'Semana' },
  { key: 'listado', label: 'Listado' }
];

const tab = ref('semana');
const asesoresIds = ref([]);
const anio = ref(new Date().getFullYear());
const semanaISO = ref(currentISOWeek());
const cargando = ref(false);
const semanaData = ref(null);

function currentISOWeek() {
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((target - firstThursday) / 86400000 - 3) / 7);
}

async function cargarSemana() {
  cargando.value = true;
  try {
    const r = await agendaApi.semanaSeguimiento({ anio: anio.value, semana: semanaISO.value, asesoresIds: asesoresIds.value });
    semanaData.value = r.data || r;
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo cargar la semana');
    semanaData.value = null;
  } finally {
    cargando.value = false;
  }
}

function cambiarSemana(delta) {
  semanaISO.value += delta;
  if (semanaISO.value < 1) { anio.value -= 1; semanaISO.value = 52; }
  else if (semanaISO.value > 52) { anio.value += 1; semanaISO.value = 1; }
  cargarSemana();
}

watch([tab, asesoresIds], () => {
  if (tab.value === 'semana') cargarSemana();
});
onMounted(cargarSemana);
</script>
