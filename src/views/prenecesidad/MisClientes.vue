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
import NuevoProspecto from '@/components/crm/NuevoProspecto.vue';
import CargarListaModal from '@/components/crm/CargarListaModal.vue';

const router = useRouter();
const store = useProspectosStore();
const { notify } = useApiError();
const { formato } = useTelefono();

const q = ref('');
const filtro = ref('');
const showNuevo = ref(false);
const showCargarLista = ref(false);
let debounce = null;

const filtros = [
  { value: '',            label: 'Todos' },
  { value: 'urgentes',    label: '🔴 Urgentes' },
  { value: 'hoy',         label: '📅 Hoy' },
  { value: 'proximas',    label: '➡️ Próximas' },
  { value: 'sin_gestion', label: '❓ Sin gestión' },
  { value: 'cerrados',    label: '✅ Cerrados' }
];

async function cargar() {
  try {
    await store.fetchList({
      area_id:  AREAS.PRENEC,
      grupo_id: GRUPOS.TELEMERCADEO,
      q: q.value || undefined,
      filtro_rapido: filtro.value || undefined,
      page: 1, limit: 50
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
  router.push({ name: 'prenec-ficha', params: { id: p.prosp_id } });
}

function iniciales(p) {
  return `${(p.persona_nombre || '?').charAt(0)}${(p.persona_apellido || '').charAt(0)}`.toUpperCase();
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h1 class="font-serif text-3xl text-brown-deep">Mis clientes</h1>
      <div class="flex gap-2">
        <BaseButton variant="secondary" size="sm" @click="showCargarLista = true">📥 Importar lista</BaseButton>
        <BaseButton variant="primary" size="sm" @click="showNuevo = true">+ Nuevo</BaseButton>
      </div>
    </header>

    <div class="space-y-3 mb-4">
      <BaseInput v-model="q" placeholder="🔎 Buscar por nombre, teléfono, email..." />
      <FilterChips v-model="filtro" :options="filtros" />
    </div>

    <div v-if="store.loading" class="text-center py-12 text-text3">Cargando...</div>
    <EmptyState v-else-if="!store.items.length" titulo="Sin clientes" mensaje="Crea un nuevo prospecto o importa una lista." />

    <ul v-else class="sv-card divide-y divide-text3/10">
      <li v-for="p in store.items" :key="p.prosp_id"
          @click="abrir(p)"
          class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-cream transition-colors">
        <div class="w-10 h-10 rounded-full bg-gold/15 text-gold font-bold flex items-center justify-center text-sm">
          {{ iniciales(p.persona || {}) }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-text1 truncate">
            {{ p.persona?.persona_nombre }} {{ p.persona?.persona_apellido || '' }}
          </div>
          <div class="text-xs text-text3 flex gap-2 items-center mt-0.5">
            <span>{{ formato(p.persona?.persona_telefono_principal) }}</span>
            <StatusPill v-if="p.estado" :label="p.estado.estado_nombre" :color-hex="p.estado.estado_color_hex || '#8A6A52'" />
            <span class="ml-auto">{{ p.prosp_prox_gestion_fecha ? fmtRelativo(p.prosp_prox_gestion_fecha) : '—' }}</span>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="store.items.length" class="text-xs text-text3 text-center mt-3">
      Mostrando {{ store.items.length }} de {{ store.total }}
    </p>

    <NuevoProspecto :open="showNuevo" @close="showNuevo = false" @creado="(p) => { showNuevo = false; abrir(p); }" />
    <CargarListaModal :open="showCargarLista" @close="showCargarLista = false" @cargada="() => { showCargarLista = false; cargar(); }" />
  </div>
</template>
