<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePapStore } from '@/stores/usePapStore';
import { useApiError } from '@/composables/useApiError';
import { papApi } from '@/api/papApi';
import { fmtRelativo } from '@/utils/format';

import BaseButton from '@/components/ui/BaseButton.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import RegistroRapidoModal from '@/components/crm/RegistroRapidoModal.vue';

const router = useRouter();
const auth = useAuthStore();
const pap = usePapStore();
const { notify } = useApiError();

const zonas = ref([]);
const showRegistro = ref(false);

async function cargar() {
  try {
    const [z] = await Promise.all([
      papApi.zonas({}),
      pap.refrescarMetricas()
    ]);
    zonas.value = z.data;
  } catch (e) { notify(e); }
}

onMounted(() => {
  pap.restore();
  cargar();
});

const saludo = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
});

const totales = computed(() => {
  // Combina visitas registradas en sesión + lo que viene de metricasDia (servidor)
  const srv = pap.metricasDia || {};
  const mem = pap.contadores;
  return {
    visitas:    Math.max(mem.total,       srv.total_visitas || 0),
    afiliadas:  Math.max(mem.afiliadas,   srv.afiliadas     || 0),
    interesadas: Math.max(mem.interesadas, srv.interesadas  || 0),
    sin_resp:   Math.max(mem.sin_resp,    srv.sin_respuesta || 0),
    tasa: srv.tasa_afiliacion ?? (mem.total ? Math.round((mem.afiliadas / mem.total) * 100) : 0)
  };
});

async function onRegistrada() {
  await cargar();
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-32">
    <!-- Header verde PAP -->
    <header class="bg-area-pap text-cream rounded-sv p-5 mb-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="font-serif text-2xl text-cream">{{ saludo }}, {{ auth.usuario?.usr_nombre }}</h1>
          <p class="text-cream/80 text-sm mt-1">
            <span v-if="pap.zonaActiva">📍 Zona: <strong>{{ pap.zonaActiva }}</strong></span>
            <span v-else>📍 Sin zona asignada — defínela en tu primera visita</span>
          </p>
        </div>
        <BaseButton variant="secondary" size="sm" @click="cargar">↻</BaseButton>
      </div>

      <div class="grid grid-cols-4 gap-2 mt-4">
        <div class="bg-cream/15 rounded-sv p-2 text-center border-l-2 border-cream/50">
          <div class="text-2xl font-serif text-cream">{{ totales.visitas }}</div>
          <div class="text-[10px] uppercase text-cream/80">Visitas</div>
        </div>
        <div class="bg-cream/15 rounded-sv p-2 text-center border-l-2 border-green-300">
          <div class="text-2xl font-serif text-cream">{{ totales.afiliadas }}</div>
          <div class="text-[10px] uppercase text-cream/80">Afiliadas</div>
        </div>
        <div class="bg-cream/15 rounded-sv p-2 text-center border-l-2 border-amber-300">
          <div class="text-2xl font-serif text-cream">{{ totales.interesadas }}</div>
          <div class="text-[10px] uppercase text-cream/80">Interesadas</div>
        </div>
        <div class="bg-cream/15 rounded-sv p-2 text-center border-l-2 border-cream/50">
          <div class="text-2xl font-serif text-cream">{{ totales.tasa }}%</div>
          <div class="text-[10px] uppercase text-cream/80">Conv.</div>
        </div>
      </div>
    </header>

    <!-- CTA grande -->
    <BaseButton variant="success" class="w-full text-lg py-5 mb-5" @click="showRegistro = true">
      ⚡ Registrar Visita Rápida
    </BaseButton>

    <!-- Lista últimas visitas (en sesión) -->
    <section v-if="pap.visitasHoy.length">
      <h2 class="font-serif text-xl text-brown-deep mb-3">Últimas visitas</h2>
      <ul class="sv-card divide-y divide-text3/10">
        <li v-for="v in pap.visitasHoy.slice(0, 20)" :key="v.id" class="px-4 py-3 flex items-center gap-3">
          <span class="text-2xl">
            {{ v.resultado_codigo === 'AFILIADO_HOY' ? '✅' :
               v.resultado_codigo === 'INTERESADO' ? '💬' :
               v.resultado_codigo === 'VOLVER' ? '🔁' :
               v.resultado_codigo === 'SIN_RESPUESTA' ? '🏠' : '🚫' }}
          </span>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-text1 truncate">{{ v.nombre }}</div>
            <div class="text-xs text-text3 truncate">{{ v.direccion }} · {{ v.telefono }}</div>
          </div>
          <div class="text-xs text-text3 text-right">
            <div>{{ fmtRelativo(v.ts) }}</div>
            <div v-if="v.lat" class="text-[10px]">📍</div>
          </div>
        </li>
      </ul>
    </section>

    <EmptyState v-else titulo="Sin visitas registradas hoy" icono="🚶">
      <BaseButton variant="primary" @click="showRegistro = true">⚡ Registrar primera visita</BaseButton>
    </EmptyState>

    <!-- Zonas con counts (si hay) -->
    <section v-if="zonas.length" class="mt-6">
      <h3 class="font-serif text-lg text-brown-deep mb-2">Zonas trabajadas</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button v-for="z in zonas" :key="z.zona"
                @click="pap.setZonaActiva(z.zona)"
                class="sv-card p-3 text-left transition-shadow hover:shadow-sv-pop"
                :class="pap.zonaActiva === z.zona ? 'border-2 border-area-pap' : ''">
          <div class="font-semibold text-text1 truncate">{{ z.zona }}</div>
          <div class="text-xs text-text3 mt-1">
            {{ z.total_prospectos }} prospectos · <strong>{{ z.visitas_hoy }}</strong> hoy
          </div>
        </button>
      </div>
    </section>

    <RegistroRapidoModal :open="showRegistro" @close="showRegistro = false" @registrada="onRegistrada" />
  </div>
</template>
