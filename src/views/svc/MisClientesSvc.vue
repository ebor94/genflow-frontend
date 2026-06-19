<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useApiError } from '@/composables/useApiError';
import { useTelefono } from '@/composables/useTelefono';
import { fmtRelativo } from '@/utils/format';
import { AREAS, GRUPOS } from '@/utils/areasIds';

import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import FilterChips from '@/components/common/FilterChips.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import CargarListaModal from '@/components/crm/CargarListaModal.vue';

const router = useRouter();
const store = useProspectosStore();
const { notify } = useApiError();
const { formato } = useTelefono();

const q = ref('');
const filtro = ref('');           // urgentes/hoy/proximas/sin_gestion/cerrados
const showCargarLista = ref(false);
let debounce = null;

const filtrosRapidos = [
  { value: '',            label: 'Todos' },
  { value: 'urgentes',    label: '🔴 Urgentes' },
  { value: 'hoy',         label: '📅 Hoy' },
  { value: 'proximas',    label: '➡️ Próximas' },
  { value: 'sin_gestion', label: '🆕 Sin contactar' },
  { value: 'cerrados',    label: '✅ Recuperados' }
];

async function cargar() {
  try {
    await store.fetchList({
      area_id:    AREAS.SVC,
      grupo_id:   GRUPOS.SVC_AGENTES,
      subproceso: 'recuperacion',
      q:          q.value || undefined,
      filtro_rapido: filtro.value || undefined,
      page: 1, limit: 100
    });
  } catch (e) { notify(e); }
}

onMounted(cargar);
watch(filtro, cargar);
watch(q, () => {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(cargar, 300);
});

function abrir(p) {
  router.push({ name: 'svc-ficha', params: { id: p.prosp_id } });
}

function iniciales(p) {
  return `${(p.persona_nombre || '?').charAt(0)}${(p.persona_apellido || '').charAt(0)}`.toUpperCase();
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h1 class="font-serif text-3xl text-brown-deep">Clientes a recuperar</h1>
        <p class="text-sm text-text3 mt-1">Cancelados de Previsión asignados a tu gestión</p>
      </div>
      <BaseButton variant="primary" size="sm" @click="showCargarLista = true">📥 Importar cancelados</BaseButton>
    </header>

    <div class="space-y-3 mb-4">
      <BaseInput v-model="q" placeholder="🔎 Buscar por nombre, teléfono..." />
      <FilterChips v-model="filtro" :options="filtrosRapidos" />
    </div>

    <div v-if="store.loading" class="text-center py-12 text-text3">Cargando...</div>
    <EmptyState v-else-if="!store.items.length" titulo="Sin clientes a recuperar" mensaje="Importa una lista de cancelados para empezar." icono="♻️">
      <BaseButton variant="primary" @click="showCargarLista = true">📥 Importar lista</BaseButton>
    </EmptyState>

    <ul v-else class="sv-card divide-y divide-text3/10">
      <li v-for="p in store.items" :key="p.prosp_id"
          @click="abrir(p)"
          class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-cream transition-colors">
        <div class="w-10 h-10 rounded-full bg-area-svc/15 text-area-svc font-bold flex items-center justify-center text-sm">
          {{ iniciales(p.persona || {}) }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-text1 truncate">
            {{ p.persona?.persona_nombre }} {{ p.persona?.persona_apellido || '' }}
          </div>
          <div class="text-xs text-text3 flex gap-2 items-center mt-0.5 flex-wrap">
            <span>{{ formato(p.persona?.persona_telefono_principal) }}</span>
            <span v-if="p.fuente" class="text-[10px] px-1.5 py-0.5 rounded-full bg-brown-warm/15 text-brown-warm">
              {{ p.fuente.fuente_nombre }}
            </span>
            <StatusPill v-if="p.estado" :label="p.estado.estado_nombre" :color-hex="p.estado.estado_color_hex || '#0f766e'" />
            <span class="ml-auto">{{ p.prosp_prox_gestion_fecha ? fmtRelativo(p.prosp_prox_gestion_fecha) : '—' }}</span>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="store.items.length" class="text-xs text-text3 text-center mt-3">
      Mostrando {{ store.items.length }} de {{ store.total }}
    </p>

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
