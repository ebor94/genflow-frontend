<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import { useApiError } from '@/composables/useApiError';
import { reportesApi } from '@/api/reportesApi';

import AgeCard from '@/components/common/AgeCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import MetaBar from '@/components/common/MetaBar.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import NuevoProspecto from '@/components/crm/NuevoProspecto.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { fmtFecha } from '@/utils/format';
import { AREAS, GRUPOS } from '@/utils/areasIds';

const router = useRouter();
const auth = useAuthStore();
const store = useProspectosStore();
const gestiones = useGestionesStore();
const { notify } = useApiError();

const meta = ref(null);
const resumen = ref(null);
const showRegistrar = ref(false);
const showNuevo = ref(false);
const prospectoActivo = ref(null);

const saludo = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
});

const hoyFmt = computed(() => fmtFecha(new Date(), 'dddd D [de] MMMM'));

async function cargar() {
  try {
    await store.fetchPanelDia({ area_id: AREAS.PRENEC, grupo_id: GRUPOS.TELEMERCADEO });
    await gestiones.fetchResumenDia();
    resumen.value = gestiones.resumenDia;
    if (auth.usuario?.usr_id) {
      const r = await reportesApi.asesor(auth.usuario.usr_id, {
        mes: new Date().getMonth() + 1, anio: new Date().getFullYear()
      });
      meta.value = r.data;
    }
  } catch (e) { notify(e); }
}

onMounted(cargar);

function abrirFicha(p) {
  router.push({ name: 'prenec-ficha', params: { id: p.prosp_id } });
}

function registrarPara(p) {
  prospectoActivo.value = p;
  showRegistrar.value = true;
}

async function onRegistrada() {
  await cargar();
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <!-- Header -->
    <header class="bg-brown-deep text-cream rounded-sv p-5 mb-6">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="font-serif text-2xl text-cream">{{ saludo }}, {{ auth.usuario?.usr_nombre }}</h1>
          <p class="text-cream/70 text-sm capitalize">{{ hoyFmt }}</p>
        </div>
        <BaseButton variant="primary" size="sm" @click="cargar">↻ Refrescar</BaseButton>
      </div>

      <div class="grid grid-cols-3 gap-3 mt-4">
        <div class="bg-cream/15 rounded-sv p-3 border-l-2 border-red-300">
          <div class="text-2xl font-serif text-cream">{{ store.panelDia.urgentes.length }}</div>
          <div class="text-[10px] text-cream/80 uppercase">Urgentes</div>
        </div>
        <div class="bg-cream/15 rounded-sv p-3 border-l-2 border-amber-300">
          <div class="text-2xl font-serif text-cream">{{ store.panelDia.hoy.length }}</div>
          <div class="text-[10px] text-cream/80 uppercase">Hoy</div>
        </div>
        <div class="bg-cream/15 rounded-sv p-3 border-l-2 border-green-300">
          <div class="text-2xl font-serif text-cream">{{ meta?.totales?.contratos ?? 0 }}</div>
          <div class="text-[10px] text-cream/80 uppercase">Contratos mes</div>
        </div>
      </div>

      <div v-if="meta?.meta" class="mt-4">
        <MetaBar
          :actual="meta.totales.contratos"
          :meta="meta.meta.meta_contratos"
          label="Meta mensual"
          unidad="contratos"
          color-hex="#E6AA3A"
        />
      </div>
    </header>

    <!-- Urgentes -->
    <section class="mb-6">
      <h2 class="font-serif text-xl text-brown-deep mb-3 flex items-center gap-2">
        <span class="text-danger">🔴</span> Urgentes
        <span class="text-sm text-text3 font-sans">({{ store.panelDia.urgentes.length }})</span>
      </h2>
      <div v-if="store.panelDia.urgentes.length" class="space-y-2">
        <AgeCard v-for="p in store.panelDia.urgentes" :key="p.prosp_id"
                 :prospecto="p" @abrir="abrirFicha" @llamar="abrirFicha(p)" />
      </div>
      <EmptyState v-else titulo="Sin gestiones vencidas" mensaje="¡Buen trabajo!" icono="🎉" />
    </section>

    <!-- Hoy -->
    <section class="mb-6">
      <h2 class="font-serif text-xl text-brown-deep mb-3 flex items-center gap-2">
        <span class="text-warning">🟡</span> Para hoy
        <span class="text-sm text-text3 font-sans">({{ store.panelDia.hoy.length }})</span>
      </h2>
      <div v-if="store.panelDia.hoy.length" class="space-y-2">
        <AgeCard v-for="p in store.panelDia.hoy" :key="p.prosp_id" :prospecto="p" @abrir="abrirFicha" />
      </div>
      <EmptyState v-else titulo="No hay gestiones para hoy" icono="📭" />
    </section>

    <!-- Nuevos -->
    <section v-if="store.panelDia.nuevos.length" class="mb-6">
      <h2 class="font-serif text-xl text-brown-deep mb-3 flex items-center gap-2">
        <span class="text-brown-warm">🆕</span> Nuevos
        <span class="text-sm text-text3 font-sans">({{ store.panelDia.nuevos.length }})</span>
      </h2>
      <div class="space-y-2">
        <AgeCard v-for="p in store.panelDia.nuevos" :key="p.prosp_id" :prospecto="p" @abrir="abrirFicha" />
      </div>
    </section>

    <!-- Completados -->
    <section v-if="store.panelDia.completados_hoy.length" class="mb-6">
      <h2 class="font-serif text-xl text-brown-deep mb-3 flex items-center gap-2">
        <span class="text-sage">✅</span> Completados hoy
        <span class="text-sm text-text3 font-sans">({{ store.panelDia.completados_hoy.length }})</span>
      </h2>
      <div class="space-y-2">
        <div v-for="g in store.panelDia.completados_hoy" :key="g.gest_id"
             class="sv-card p-3 flex items-center gap-3 border-l-4 border-sage opacity-80">
          <span class="text-xs text-text3 w-12">{{ g.gest_fecha_hora?.slice(11,16) }}</span>
          <div class="flex-1">
            <div class="font-semibold text-text1">{{ g.prospecto?.persona?.persona_nombre }} {{ g.prospecto?.persona?.persona_apellido || '' }}</div>
            <div class="text-xs text-text3">{{ g.resultado?.resultado_nombre || 'Gestión registrada' }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAB nuevo -->
    <button @click="showNuevo = true"
            class="fixed bottom-20 right-5 md:bottom-6 w-14 h-14 rounded-full bg-gold text-white text-2xl shadow-sv-pop hover:bg-gold-bright transition-colors z-30">
      +
    </button>

    <NuevoProspecto :open="showNuevo" @close="showNuevo = false" @creado="(p) => { showNuevo = false; abrirFicha(p); }" />
    <RegistrarGestion :open="showRegistrar" :prospecto="prospectoActivo" @close="showRegistrar = false" @registrada="onRegistrada" />
  </div>
</template>
