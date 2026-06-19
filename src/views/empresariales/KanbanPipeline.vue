<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConfigStore } from '@/stores/useConfigStore';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { abrirProspecto } from '@/utils/abrirProspecto';
import { AREAS, GRUPOS } from '@/utils/areasIds';

import KanbanColumn from '@/components/crm/KanbanColumn.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import MarcarConvenioModal from '@/components/crm/MarcarConvenioModal.vue';

const router = useRouter();
const auth   = useAuthStore();
const config = useConfigStore();
const store  = useProspectosStore();
const gestiones = useGestionesStore();
const toast  = useToastStore();
const { notify } = useApiError();

const loading = ref(false);
const showConvenio = ref(false);
const prospectoFirma = ref(null);

async function cargar() {
  loading.value = true;
  try {
    await store.fetchList({
      area_id:  AREAS.PREV_EMP,
      grupo_id: GRUPOS.EMPRESARIALES,
      page: 1, limit: 200
    });
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(cargar);

const estadosGrupo = computed(() => (config.actual?.estados || [])
  .filter(e => e.estado_grupo_id === auth.usuario?.usr_grupo_id && e.estado_activo)
  .sort((a, b) => a.estado_orden - b.estado_orden));

const porEstado = computed(() => {
  const map = new Map();
  for (const e of estadosGrupo.value) map.set(e.estado_id, []);
  for (const p of store.items) {
    if (map.has(p.prosp_estado_id)) map.get(p.prosp_estado_id).push(p);
    else map.set(p.prosp_estado_id, [p]);
  }
  return map;
});

function abrir(p) {
  abrirProspecto(router, p);
}

async function mover(prospId, nuevoEstadoId) {
  const p = store.items.find(x => x.prosp_id === prospId);
  if (!p || p.prosp_estado_id === nuevoEstadoId) return;

  // Si el destino es un estado final-ganado (CONVENIO firmado), abrir modal de fechas
  const estadoDestino = estadosGrupo.value.find(e => e.estado_id === nuevoEstadoId);
  if (estadoDestino?.estado_es_final && estadoDestino?.estado_es_ganado) {
    prospectoFirma.value = p;
    showConvenio.value = true;
    return;
  }

  // Registrar gestión con cambio de estado (mantiene inmutabilidad y trazabilidad)
  try {
    await gestiones.registrar({
      gest_prosp_id: prospId,
      gest_estado_nuevo_id: nuevoEstadoId,
      gest_canal: 'presencial',
      gest_comentario: '[Kanban] Cambio de estado mediante drag-and-drop'
    });
    toast.success('Estado actualizado');
    await cargar();
  } catch (e) { notify(e); }
}

async function onConvenioFirmado() {
  toast.success('Convenio firmado con vigencia registrada');
  await cargar();
}
</script>

<template>
  <div class="max-w-full mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <h1 class="font-serif text-3xl text-brown-deep">Kanban — Pipeline B2B</h1>
      <div class="flex gap-2">
        <BaseButton size="sm" variant="secondary" @click="router.push({ name: 'emp-panel' })">📋 Vista tabla</BaseButton>
        <BaseButton size="sm" variant="secondary" @click="cargar">↻ Refrescar</BaseButton>
      </div>
    </header>

    <div v-if="loading" class="text-text3 text-center py-12">Cargando...</div>
    <div v-else class="flex gap-4 overflow-x-auto pb-4">
      <KanbanColumn v-for="estado in estadosGrupo" :key="estado.estado_id"
                    :estado="estado"
                    :prospectos="porEstado.get(estado.estado_id) || []"
                    @drop="mover" @card-click="abrir" />
    </div>

    <p class="text-xs text-text3 mt-3">💡 Arrastra una tarjeta a otra columna para cambiar su estado. Cada movimiento registra una gestión automática.</p>

    <MarcarConvenioModal :open="showConvenio" :prospecto="prospectoFirma"
                         @close="showConvenio = false"
                         @firmado="onConvenioFirmado" />
  </div>
</template>
