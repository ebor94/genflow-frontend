<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import { useApiError } from '@/composables/useApiError';
import { reportesApi } from '@/api/reportesApi';
import { fmtFecha } from '@/utils/format';
import { AREAS, GRUPOS } from '@/utils/areasIds';

import AgeCard from '@/components/common/AgeCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import MetaBar from '@/components/common/MetaBar.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import CargarListaModal from '@/components/crm/CargarListaModal.vue';

const router = useRouter();
const auth = useAuthStore();
const store = useProspectosStore();
const gestiones = useGestionesStore();
const { notify } = useApiError();

const meta = ref(null);
const showCargarLista = ref(false);

const saludo = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
});

const hoyFmt = computed(() => fmtFecha(new Date(), 'dddd D [de] MMMM'));

async function cargar() {
  try {
    await store.fetchPanelDia({
      area_id:    AREAS.SVC,
      grupo_id:   GRUPOS.SVC_AGENTES,
      subproceso: 'recuperacion'
    });
    await gestiones.fetchResumenDia();
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
  router.push({ name: 'svc-ficha', params: { id: p.prosp_id } });
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <!-- Header morado SVC -->
    <header class="bg-area-svc text-cream rounded-sv p-5 mb-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="font-serif text-2xl text-cream">{{ saludo }}, {{ auth.usuario?.usr_nombre }}</h1>
          <p class="text-cream/80 text-sm capitalize">{{ hoyFmt }} · ♻️ Call Center · Recuperación</p>
        </div>
        <BaseButton variant="primary" size="sm" @click="cargar">↻</BaseButton>
      </div>

      <div class="grid grid-cols-3 gap-3 mt-4">
        <div class="bg-cream/15 rounded-sv p-3 border-l-2 border-red-300">
          <div class="text-2xl font-serif text-cream">{{ store.panelDia.urgentes.length }}</div>
          <div class="text-[10px] text-cream/80 uppercase">Urgentes</div>
        </div>
        <div class="bg-cream/15 rounded-sv p-3 border-l-2 border-amber-300">
          <div class="text-2xl font-serif text-cream">{{ store.panelDia.hoy.length }}</div>
          <div class="text-[10px] text-cream/80 uppercase">Para hoy</div>
        </div>
        <div class="bg-cream/15 rounded-sv p-3 border-l-2 border-green-300">
          <div class="text-2xl font-serif text-cream">{{ meta?.totales?.contratos ?? 0 }}</div>
          <div class="text-[10px] text-cream/80 uppercase">Recuperados mes</div>
        </div>
      </div>

      <div v-if="meta?.meta" class="mt-4">
        <MetaBar
          :actual="meta.totales.contratos"
          :meta="meta.meta.meta_contratos"
          label="Meta mensual de recuperación"
          unidad="clientes"
          color-hex="#E6AA3A"
        />
      </div>
    </header>

    <!-- CTA importar lista (acción primaria) -->
    <BaseButton variant="primary" class="w-full text-base py-4 mb-5 bg-area-svc hover:opacity-90"
                @click="showCargarLista = true">
      📥 Importar lista de clientes cancelados
    </BaseButton>

    <!-- Urgentes -->
    <section class="mb-6">
      <h2 class="font-serif text-xl text-brown-deep mb-3 flex items-center gap-2">
        <span class="text-danger">🔴</span> Urgentes
        <span class="text-sm text-text3 font-sans">({{ store.panelDia.urgentes.length }})</span>
      </h2>
      <div v-if="store.panelDia.urgentes.length" class="space-y-2">
        <AgeCard v-for="p in store.panelDia.urgentes" :key="p.prosp_id"
                 :prospecto="p" @abrir="abrirFicha" />
      </div>
      <EmptyState v-else titulo="Sin clientes urgentes vencidos" icono="🎉" />
    </section>

    <!-- Para hoy -->
    <section class="mb-6">
      <h2 class="font-serif text-xl text-brown-deep mb-3 flex items-center gap-2">
        <span class="text-warning">🟡</span> Contactar hoy
        <span class="text-sm text-text3 font-sans">({{ store.panelDia.hoy.length }})</span>
      </h2>
      <div v-if="store.panelDia.hoy.length" class="space-y-2">
        <AgeCard v-for="p in store.panelDia.hoy" :key="p.prosp_id" :prospecto="p" @abrir="abrirFicha" />
      </div>
      <EmptyState v-else titulo="No hay clientes asignados para hoy" mensaje="Importa una lista de cancelados para empezar." icono="📭">
        <BaseButton variant="primary" @click="showCargarLista = true">📥 Importar ahora</BaseButton>
      </EmptyState>
    </section>

    <!-- Nuevos asignados (recién importados) -->
    <section v-if="store.panelDia.nuevos.length" class="mb-6">
      <h2 class="font-serif text-xl text-brown-deep mb-3 flex items-center gap-2">
        <span class="text-brown-warm">🆕</span> Recién asignados (sin contactar)
        <span class="text-sm text-text3 font-sans">({{ store.panelDia.nuevos.length }})</span>
      </h2>
      <div class="space-y-2">
        <AgeCard v-for="p in store.panelDia.nuevos" :key="p.prosp_id" :prospecto="p" @abrir="abrirFicha" />
      </div>
    </section>

    <CargarListaModal
      :open="showCargarLista"
      fuente-codigo-default="LISTA_RECUPERA"
      rol-asesor="AGENTE_SVC"
      titulo="📥 Importar clientes cancelados a recuperar"
      @close="showCargarLista = false"
      @cargada="() => { showCargarLista = false; cargar(); }"
    />
  </div>
</template>
