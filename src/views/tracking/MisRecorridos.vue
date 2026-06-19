<script setup>
/**
 * MisRecorridos.vue — el propio asesor ve la lista de sus jornadas pasadas
 * y puede abrir cada una para ver el mapa.
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { trackingApi } from '@/api/trackingApi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
dayjs.extend(relativeTime);
dayjs.locale('es');

import EmptyState from '@/components/common/EmptyState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();
const auth = useAuthStore();
const { notify } = useApiError();

const jornadas = ref([]);
const loading  = ref(false);

const COLOR_ESTADO = {
  activa:        'bg-sage/20 text-sage',
  finalizada:    'bg-area-emp/15 text-area-emp',
  auto_cerrada:  'bg-warning/20 text-warning'
};

async function cargar() {
  loading.value = true;
  try {
    const r = await trackingApi.listarJornadas({ usr_id: auth.usuario.usr_id });
    jornadas.value = r.data;
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

function abrirRecorrido(j) {
  router.push({ name: 'tracking-asesor', params: { usrId: auth.usuario.usr_id }, query: { fecha: j.jor_fecha } });
}

async function exportarCSV() {
  try {
    const blob = await trackingApi.exportarMisDatos(
      dayjs().subtract(90, 'day').format('YYYY-MM-DD'),
      dayjs().format('YYYY-MM-DD')
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis_recorridos_${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) { notify(e); }
}

onMounted(cargar);
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-4">
      <div>
        <h1 class="font-serif text-2xl text-brown-deep">📍 Mis recorridos</h1>
        <p class="text-sm text-text2 mt-1">Historial de tus jornadas (últimas 100).</p>
      </div>
      <BaseButton variant="secondary" size="sm" @click="exportarCSV">📥 Exportar CSV</BaseButton>
    </header>

    <div v-if="loading" class="text-text3 text-center py-12">Cargando...</div>
    <EmptyState v-else-if="!jornadas.length"
                titulo="Aún no tienes jornadas registradas"
                descripcion="Pulsa 'Iniciar jornada' en el header para empezar tu tracking." />

    <article v-for="j in jornadas" :key="j.jor_id"
             class="sv-card p-4 mb-3 flex items-center gap-3 hover:shadow-sv-pop cursor-pointer transition-shadow"
             @click="abrirRecorrido(j)">
      <div class="w-12 h-12 rounded-full bg-gold/15 text-gold font-bold flex items-center justify-center text-lg">
        📅
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-text1">
          {{ dayjs(j.jor_fecha).format('dddd, D [de] MMMM [de] YYYY').replace(/^./, c => c.toUpperCase()) }}
        </div>
        <div class="text-xs text-text3">
          {{ dayjs(j.jor_inicio_at).format('HH:mm') }}
          <span v-if="j.jor_fin_at"> — {{ dayjs(j.jor_fin_at).format('HH:mm') }}</span>
          <span v-else class="text-sage font-semibold"> (en curso)</span>
          <span v-if="j.jor_duracion_min"> · {{ Math.floor(j.jor_duracion_min/60) }}h {{ j.jor_duracion_min%60 }}m</span>
        </div>
        <div class="text-xs text-text2 mt-1">
          📍 {{ j.jor_puntos_total }} puntos
          <span v-if="j.jor_km_recorridos != null"> · 🚗 {{ j.jor_km_recorridos }} km</span>
        </div>
      </div>
      <span class="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
            :class="COLOR_ESTADO[j.jor_estado] || 'bg-text3/10 text-text3'">
        {{ j.jor_estado }}
      </span>
    </article>
  </div>
</template>
