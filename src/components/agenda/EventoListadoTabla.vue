<template>
  <div class="space-y-3">
    <!-- Filtros -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
      <div class="sm:col-span-2">
        <input v-model="filtros.q" type="text" placeholder="Buscar por título..."
               class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div>
        <select v-model="filtros.tipo" class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm">
          <option value="">-- Todos los tipos --</option>
          <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div>
        <select v-model="filtros.link_publico" class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm">
          <option value="">-- Con o sin link --</option>
          <option value="1">Solo con link público</option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div>
        <label class="text-xs text-slate-500">Desde</label>
        <input v-model="filtros.desde" type="date"
               class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div>
        <label class="text-xs text-slate-500">Hasta</label>
        <input v-model="filtros.hasta" type="date"
               class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
      </div>
    </div>

    <div class="flex gap-2">
      <button type="button" class="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg"
              @click="cargar">Buscar</button>
      <button type="button" class="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-slate-50"
              @click="limpiar">Limpiar</button>
      <span v-if="cargando" class="text-sm text-slate-500 self-center">Cargando…</span>
    </div>

    <!-- Tabla -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-slate-500 border-b bg-slate-50">
          <tr>
            <th class="text-left px-2 py-2">Título</th>
            <th class="text-left px-2 py-2">Tipo</th>
            <th class="text-left px-2 py-2">Fechas</th>
            <th class="text-left px-2 py-2">Dueño</th>
            <th class="text-right px-2 py-2">Asis.</th>
            <th class="text-left px-2 py-2">Link</th>
            <th class="text-right px-2 py-2">Pool</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!eventos.length && !cargando">
            <td colspan="8" class="text-center py-6 text-slate-400 text-xs">Sin eventos con estos filtros</td>
          </tr>
          <tr v-for="e in eventos" :key="e.evento_id" class="border-b border-gray-100 hover:bg-slate-50">
            <td class="px-2 py-2 font-medium text-slate-800">{{ e.evento_titulo }}</td>
            <td class="px-2 py-2 text-slate-600">{{ e.evento_tipo }}</td>
            <td class="px-2 py-2 text-slate-500 text-xs">{{ fecha(e.evento_fecha_hora) }}<span v-if="e.evento_fecha_fin"> → {{ fecha(e.evento_fecha_fin) }}</span></td>
            <td class="px-2 py-2 text-slate-600">{{ nombre(e.dueño) }}</td>
            <td class="px-2 py-2 text-right text-slate-500">{{ e.count_asistentes }}</td>
            <td class="px-2 py-2">
              <span v-if="e.evento_registros_publicos_habilitado" class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Público</span>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>
            <td class="px-2 py-2 text-right text-xs">
              <span v-if="e.evento_registros_publicos_habilitado">{{ e.pool_pendientes }}/{{ e.pool_total }}</span>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="px-2 py-2 text-right">
              <RouterLink :to="{ name: 'evento-detalle', params: { id: e.evento_id }}"
                          class="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-white text-slate-600">
                Abrir
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';

const toast = useToastStore();

const props = defineProps({ asesoresIds: { type: Array, default: () => [] } });

const TIPOS = ['REUNION','VISITA','CAPACITACION','LLAMADA','FERIA','PERSONAL','OTRO','SEGUIMIENTO'];

const filtros = reactive({ q: '', tipo: '', link_publico: '', desde: '', hasta: '' });
const eventos = ref([]);
const cargando = ref(false);

function payloadLimpio() {
  const p = {};
  for (const k of ['q','tipo','link_publico','desde','hasta']) if (filtros[k]) p[k] = filtros[k];
  // MVP: backend `listado` sólo soporta un asesor_id singular. Si hay varios
  // seleccionados, sólo aplicamos el primero.
  // TODO follow-up: extender backend a asesores_ids CSV para soportar N.
  if (props.asesoresIds?.length) p.asesor_id = props.asesoresIds[0];
  return p;
}

async function cargar() {
  cargando.value = true;
  try {
    const r = await eventosAgendaApi.listado(payloadLimpio());
    eventos.value = r.data || r || [];
  } catch (e) {
    toast.error('No se pudo cargar el listado');
  } finally {
    cargando.value = false;
  }
}

watch(() => props.asesoresIds, cargar, { deep: true });

function limpiar() {
  for (const k of Object.keys(filtros)) filtros[k] = '';
  cargar();
}

function fecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });
}
function nombre(u) {
  if (!u) return '—';
  const n = `${u.usr_nombre || ''} ${u.usr_apellido || ''}`.trim();
  return n || `#${u.usr_id}`;
}

onMounted(cargar);
</script>
