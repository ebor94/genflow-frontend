<script setup>
/**
 * CalendarioFideliz.vue — calendario mensual de eventos de fidelización.
 * Click en un día muestra la lista de contactos con eventos ese día.
 */
import { ref, computed, onMounted } from 'vue';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useApiError } from '@/composables/useApiError';
import dayjs from 'dayjs';

import MiniCalendar from '@/components/common/MiniCalendar.vue';
import EmptyState   from '@/components/common/EmptyState.vue';

const store = useFidelizacionStore();
const { notify } = useApiError();

const anio = ref(dayjs().year());
const mes  = ref(dayjs().month() + 1);
const diaSelec = ref(null);

const eventos = computed(() => {
  const key = `${anio.value}-${String(mes.value).padStart(2, '0')}`;
  return store.calendarios.get(key) || [];
});

const eventosDelDia = computed(() => {
  if (!diaSelec.value) return [];
  const fmt = dayjs(diaSelec.value).format('YYYY-MM-DD');
  // proximos contiene los eventos completos; filtramos por fecha_evento
  return store.proximos.filter(e => e.fecha_evento === fmt);
});

const TIPO_LABEL = {
  nacimiento: '🎂 Cumpleaños',
  aniversario_laboral: '💼 Aniversario',
  aniversario_boda: '💍 Aniv. boda',
  dia_madre: '💐 Día Madre',
  dia_padre: '👔 Día Padre',
  otro: '🎉 Otro'
};

async function cargar() {
  try {
    await store.fetchCalendario(anio.value, mes.value);
    // Cargamos también próximos amplios para tener detalles al hacer click
    await store.fetchProximos(60);
  } catch (e) { notify(e); }
}

function onMonthChange(a, m) {
  anio.value = a;
  mes.value  = m;
  diaSelec.value = null;
  cargar();
}

function onSelectDia(d) {
  diaSelec.value = d;
}

onMounted(cargar);
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="sv-card p-5 mb-4 border-l-4" style="border-left-color: #be185d">
      <h1 class="font-serif text-2xl text-brown-deep">📅 Calendario Fidelización</h1>
      <p class="text-sm text-text2 mt-1">Cumpleaños y fechas especiales del mes.</p>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <MiniCalendar :model-value="diaSelec || new Date()" :eventos="eventos"
                    @update:modelValue="onSelectDia"
                    @month-change="onMonthChange" />

      <div class="sv-card p-4">
        <h3 class="text-sm font-semibold text-text2 mb-3">
          {{ diaSelec
              ? `Eventos del ${dayjs(diaSelec).format('DD [de] MMMM')}`
              : 'Selecciona un día' }}
        </h3>
        <EmptyState v-if="diaSelec && !eventosDelDia.length"
                    titulo="Sin eventos este día"
                    size="sm" />
        <div v-else class="space-y-2">
          <div v-for="ev in eventosDelDia" :key="`${ev.persona_id}-${ev.tipo}`"
               class="border-l-4 border-warning/40 pl-3 py-2">
            <div class="text-sm font-semibold text-text1">
              {{ ev.persona.persona_nombre }} {{ ev.persona.persona_apellido }}
            </div>
            <div class="text-xs text-text2">{{ ev.cargo || '—' }} · {{ ev.empresa.empresa_razon_social }}</div>
            <div class="text-xs text-text3 mt-1">{{ TIPO_LABEL[ev.tipo] || ev.tipo }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
