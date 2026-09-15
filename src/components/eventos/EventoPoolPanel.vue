<template>
  <div class="space-y-3">
    <div v-if="cargando" class="text-sm text-text3 text-center py-8">Cargando pool...</div>

    <div v-else-if="!pool.length" class="text-sm text-text3 text-center py-8">
      Sin registros pendientes.
      <span v-if="evento?.evento_registros_publicos_habilitado" class="block mt-1 text-xs">
        Comparte el link público para captar leads.
      </span>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-text3 border-b">
          <tr>
            <th class="text-left px-2 py-2">Nombre</th>
            <th class="text-left px-2 py-2">Teléfono</th>
            <th class="text-left px-2 py-2">Correo</th>
            <th class="text-left px-2 py-2">Recibido</th>
            <th class="text-left px-2 py-2">Asignar a</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pool" :key="row.pool_id" class="border-b border-gray-100 hover:bg-gray-50">
            <td class="px-2 py-2 font-medium">{{ row.pool_nombre }}</td>
            <td class="px-2 py-2 text-text2">{{ row.pool_telefono }}</td>
            <td class="px-2 py-2 text-text2">{{ row.pool_correo || '—' }}</td>
            <td class="px-2 py-2 text-xs text-text3">{{ fecha(row.pool_created_at) }}</td>
            <td class="px-2 py-2">
              <div class="flex gap-1">
                <select v-model="asignaciones[row.pool_id]"
                        :data-testid="`select-asesor-${row.pool_id}`"
                        class="text-xs py-1 px-2 border border-gray-300 rounded">
                  <option :value="null">-- Elegir --</option>
                  <option v-for="a in asistentes" :key="a.eva_usr_id" :value="a.eva_usr_id">
                    {{ a.usuario?.usr_nombre }} {{ a.usuario?.usr_apellido }}
                  </option>
                </select>
                <button type="button"
                        :data-testid="`btn-asignar-${row.pool_id}`"
                        :disabled="!asignaciones[row.pool_id] || asignando === row.pool_id"
                        class="text-xs px-2 py-1 bg-primary hover:bg-primary/90 disabled:bg-gray-300 text-white rounded"
                        @click="asignar(row)">
                  {{ asignando === row.pool_id ? '…' : 'Asignar' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({ evento: { type: Object, required: true } });
const emit  = defineEmits(['asignado']);
const toast = useToastStore();

const cargando = ref(true);
const pool = ref([]);
const asignaciones = reactive({});
const asignando = ref(null);

const asistentes = computed(() => (props.evento.asistentes || []).filter(a => a.eva_activo));

async function cargar() {
  cargando.value = true;
  try {
    const r = await eventosAgendaApi.pool(props.evento.evento_id, { asignado: 0 });
    pool.value = r.data || r || [];
    pool.value.forEach(row => { asignaciones[row.pool_id] = null; });
  } catch (e) {
    toast.error('No se pudo cargar el pool');
    pool.value = [];
  } finally {
    cargando.value = false;
  }
}

async function asignar(row) {
  const asesorId = asignaciones[row.pool_id];
  if (!asesorId) return;
  asignando.value = row.pool_id;
  try {
    await eventosAgendaApi.asignarPool(props.evento.evento_id, row.pool_id, { asesor_id: parseInt(asesorId) });
    toast.success(`Asignado a ${row.pool_nombre}`);
    pool.value = pool.value.filter(x => x.pool_id !== row.pool_id);
    emit('asignado');
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo asignar');
  } finally {
    asignando.value = null;
  }
}

function fecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short'
  });
}

onMounted(cargar);
</script>
