<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { dayjs } from '@/utils/format';
import { abrirProspecto } from '@/utils/abrirProspecto';

import MiniCalendar from '@/components/common/MiniCalendar.vue';
import AgeCard from '@/components/common/AgeCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const router = useRouter();
const auth = useAuthStore();
const store = useProspectosStore();
const { notify } = useApiError();

const fechaSel = ref(new Date());
const cargandoDia = ref(false);

// Área activa: para que la agenda no mezcle áreas en multi-área
const areaIdActiva = computed(() => auth.areaActivaId || auth.areaActual?.area_id);

const fmtFechaSel = computed(() =>
  dayjs(fechaSel.value).format('dddd D [de] MMMM YYYY').replace(/^./, c => c.toUpperCase())
);

async function cargarMes(anio, mes) {
  try { await store.fetchAgendaMes(anio, mes); } catch (e) { notify(e); }
}

async function cargarDia(fecha) {
  cargandoDia.value = true;
  try {
    const f = dayjs(fecha).format('YYYY-MM-DD');
    await store.fetchList({
      area_id: areaIdActiva.value,
      prox_gestion_fecha: f,
      page: 1, limit: 50
    });
  } catch (e) { notify(e); }
  finally { cargandoDia.value = false; }
}

onMounted(async () => {
  const d = dayjs(fechaSel.value);
  await cargarMes(d.year(), d.month() + 1);
  await cargarDia(fechaSel.value);
});

watch(fechaSel, (v) => cargarDia(v));

function onMesChange(anio, mes) {
  cargarMes(anio, mes);
}

function abrir(p) {
  abrirProspecto(router, p);
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <h1 class="font-serif text-3xl text-brown-deep mb-4">Agenda</h1>

    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
      <MiniCalendar
        v-model="fechaSel"
        :eventos="store.agendaMes"
        @month-change="onMesChange"
      />

      <section>
        <h2 class="text-base font-semibold text-text2 mb-3 capitalize">{{ fmtFechaSel }}</h2>
        <div v-if="cargandoDia" class="text-text3 text-center py-8 text-sm">Cargando...</div>
        <EmptyState v-else-if="!store.items.length" titulo="Sin gestiones para este día" icono="📭" />
        <div v-else class="space-y-2">
          <AgeCard v-for="p in store.items" :key="p.prosp_id" :prospecto="p" @abrir="abrir" />
        </div>
      </section>
    </div>
  </div>
</template>
