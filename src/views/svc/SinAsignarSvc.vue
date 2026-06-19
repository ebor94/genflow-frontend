<script setup>
/**
 * SinAsignarSvc.vue
 * Cola de prospectos SVC sin asesor (generados por recuperación automática
 * o importación de listas sin asignar). El supervisor SVC los distribuye
 * entre sus agentes.
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { useTelefono } from '@/composables/useTelefono';
import { prospectosApi } from '@/api/prospectosApi';
import { usuariosApi } from '@/api/usuariosApi';
import { fmtRelativo } from '@/utils/format';
import { AREAS, GRUPOS } from '@/utils/areasIds';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import AreaBadge from '@/components/common/AreaBadge.vue';

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();
const { notify } = useApiError();
const { formato } = useTelefono();

const items = ref([]);
const total = ref(0);
const loading = ref(false);
const agentes = ref([]);

// Modal asignación
const showAsignar = ref(false);
const prospectoActivo = ref(null);
const asesorIdElegido = ref('');

// Selección múltiple para asignación masiva
const seleccionados = ref(new Set());
const showAsignarMasivo = ref(false);
const asesorMasivo = ref('');

async function cargar() {
  loading.value = true;
  try {
    const [colaResp, agentesResp] = await Promise.all([
      prospectosApi.sinAsignar({ area_id: AREAS.SVC, grupo_id: GRUPOS.SVC_AGENTES, page: 1, limit: 100 }),
      usuariosApi.list({ area_id: AREAS.SVC })
    ]);
    items.value = colaResp.data.items;
    total.value = colaResp.data.total;
    agentes.value = agentesResp.data.filter(u =>
      (u.rol?.rol_codigo === 'AGENTE_SVC' || u.rol?.rol_codigo === 'ASESOR') && u.usr_activo
    );
    seleccionados.value = new Set();
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(cargar);

const opcAgentes = computed(() => agentes.value.map(u => ({
  value: u.usr_id,
  label: `${u.usr_nombre} ${u.usr_apellido}`
})));

function abrirAsignar(p) {
  prospectoActivo.value = p;
  asesorIdElegido.value = '';
  showAsignar.value = true;
}

async function asignarUno() {
  if (!asesorIdElegido.value) return toast.warning('Selecciona un agente');
  try {
    await prospectosApi.asignar(prospectoActivo.value.prosp_id, parseInt(asesorIdElegido.value));
    toast.success('Prospecto asignado');
    showAsignar.value = false;
    await cargar();
  } catch (e) { notify(e); }
}

function toggleSeleccion(prospId) {
  const s = new Set(seleccionados.value);
  if (s.has(prospId)) s.delete(prospId); else s.add(prospId);
  seleccionados.value = s;
}

function seleccionarTodos() {
  if (seleccionados.value.size === items.value.length) {
    seleccionados.value = new Set();
  } else {
    seleccionados.value = new Set(items.value.map(p => p.prosp_id));
  }
}

async function asignarMasivoSubmit() {
  if (!asesorMasivo.value) return toast.warning('Selecciona un agente');
  if (!seleccionados.value.size) return toast.warning('Selecciona al menos un prospecto');
  try {
    const ids = [...seleccionados.value];
    await Promise.all(ids.map(id => prospectosApi.asignar(id, parseInt(asesorMasivo.value))));
    toast.success(`${ids.length} prospectos asignados`);
    showAsignarMasivo.value = false;
    await cargar();
  } catch (e) { notify(e); }
}

// Distribución round-robin entre agentes activos
async function distribuirRoundRobin() {
  if (!agentes.value.length) return toast.warning('No hay agentes SVC activos');
  if (!items.value.length)   return toast.warning('No hay prospectos sin asignar');
  if (!confirm(`Distribuir ${items.value.length} prospectos entre ${agentes.value.length} agentes (round-robin)?`)) return;

  try {
    let i = 0;
    for (const p of items.value) {
      const agente = agentes.value[i % agentes.value.length];
      await prospectosApi.asignar(p.prosp_id, agente.usr_id);
      i++;
    }
    toast.success(`${i} prospectos distribuidos entre ${agentes.value.length} agentes`);
    await cargar();
  } catch (e) { notify(e); }
}

function iniciales(p) {
  return `${(p?.persona_nombre || '?').charAt(0)}${(p?.persona_apellido || '').charAt(0)}`.toUpperCase();
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <div>
        <h1 class="font-serif text-3xl text-brown-deep">📥 Cola sin asignar</h1>
        <p class="text-sm text-text3 mt-1">Prospectos SVC generados por recuperación automática o importación</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <BaseButton variant="secondary" size="sm" @click="cargar">↻</BaseButton>
        <BaseButton v-if="items.length" variant="secondary" size="sm" @click="seleccionarTodos">
          {{ seleccionados.size === items.length ? '☐ Deseleccionar' : '☑ Seleccionar todos' }}
        </BaseButton>
        <BaseButton v-if="seleccionados.size" variant="primary" size="sm" @click="showAsignarMasivo = true">
          📤 Asignar {{ seleccionados.size }} seleccionados
        </BaseButton>
        <BaseButton v-if="items.length && agentes.length" variant="success" size="sm" @click="distribuirRoundRobin">
          🔀 Distribuir todo (round-robin)
        </BaseButton>
      </div>
    </header>

    <div v-if="loading" class="text-text3 text-center py-12">Cargando cola...</div>
    <EmptyState v-else-if="!items.length" titulo="No hay prospectos sin asignar" mensaje="Cuando un cliente cancele en Previsión, aparecerá aquí." icono="✅" />

    <div v-else class="sv-card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-cream text-text2">
          <tr>
            <th class="w-10 px-3 py-3"></th>
            <th class="text-left px-4 py-3">Cliente</th>
            <th class="text-left px-4 py-3">Teléfono</th>
            <th class="text-left px-4 py-3">Origen</th>
            <th class="text-left px-4 py-3">En cola</th>
            <th class="text-right px-4 py-3">Acción</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-text3/10">
          <tr v-for="p in items" :key="p.prosp_id" class="hover:bg-cream/40">
            <td class="px-3 py-3 text-center">
              <input type="checkbox"
                     :checked="seleccionados.has(p.prosp_id)"
                     @change="toggleSeleccion(p.prosp_id)"
                     class="w-4 h-4 rounded text-area-svc focus:ring-area-svc" />
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-area-svc/15 text-area-svc font-bold flex items-center justify-center text-xs">
                  {{ iniciales(p.persona) }}
                </div>
                <div>
                  <div class="font-semibold text-text1">{{ p.persona?.persona_nombre }} {{ p.persona?.persona_apellido || '' }}</div>
                  <div class="text-xs text-text3">{{ p.persona?.persona_barrio || '' }}</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-text2">{{ formato(p.persona?.persona_telefono_principal) }}</td>
            <td class="px-4 py-3">
              <span v-if="p.fuente" class="text-[10px] px-2 py-0.5 rounded-full bg-brown-warm/15 text-brown-warm font-semibold">
                {{ p.fuente.fuente_nombre }}
              </span>
              <span v-else class="text-text3">—</span>
            </td>
            <td class="px-4 py-3 text-text3 text-xs">{{ fmtRelativo(p.prosp_created_at) }}</td>
            <td class="px-4 py-3 text-right">
              <BaseButton size="sm" variant="primary" @click="abrirAsignar(p)">Asignar</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-xs text-text3 text-center py-3">{{ items.length }} de {{ total }} en cola</p>
    </div>

    <!-- Modal asignar uno -->
    <BaseModal :open="showAsignar" title="Asignar prospecto a agente" @close="showAsignar = false">
      <div v-if="prospectoActivo" class="space-y-4">
        <div class="text-sm">
          Cliente: <strong>{{ prospectoActivo.persona?.persona_nombre }} {{ prospectoActivo.persona?.persona_apellido || '' }}</strong>
          <div class="text-xs text-text3">{{ formato(prospectoActivo.persona?.persona_telefono_principal) }}</div>
        </div>
        <BaseSelect v-model="asesorIdElegido" label="Agente SVC" :options="opcAgentes" required />
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showAsignar = false">Cancelar</BaseButton>
        <BaseButton variant="primary" @click="asignarUno">Asignar</BaseButton>
      </template>
    </BaseModal>

    <!-- Modal asignar masivo -->
    <BaseModal :open="showAsignarMasivo" title="Asignar varios prospectos" @close="showAsignarMasivo = false">
      <p class="text-sm text-text2 mb-3">Se asignarán {{ seleccionados.size }} prospectos al agente elegido.</p>
      <BaseSelect v-model="asesorMasivo" label="Agente SVC" :options="opcAgentes" required />
      <template #footer>
        <BaseButton variant="secondary" @click="showAsignarMasivo = false">Cancelar</BaseButton>
        <BaseButton variant="primary" @click="asignarMasivoSubmit">Asignar {{ seleccionados.size }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
