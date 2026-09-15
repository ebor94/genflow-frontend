<template>
  <div class="space-y-2">
    <div v-if="!asistentes.length" class="text-sm text-text3 text-center py-6">
      Este evento no tiene asistentes activos.
    </div>
    <table v-else class="w-full text-sm">
      <thead class="text-xs text-text3 border-b">
        <tr>
          <th class="text-left px-2 py-2">Asistente</th>
          <th class="text-left px-2 py-2">Estado</th>
          <th class="text-right px-2 py-2">Leads</th>
          <th class="text-right px-2 py-2">Prospectos</th>
          <th class="text-right px-2 py-2">Ventas</th>
          <th class="text-right px-2 py-2"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in asistentes" :key="a.eva_id" class="border-b border-gray-100">
          <td class="px-2 py-2 font-medium">{{ nombre(a) }}</td>
          <td class="px-2 py-2">
            <select v-model="edits[a.eva_id].estado"
                    class="text-xs py-1 px-2 border border-gray-300 rounded"
                    @change="cambio(a.eva_id)">
              <option value="CONFIRMADO">Confirmado</option>
              <option value="ASISTIO">Asistió</option>
              <option value="NO_ASISTIO">No asistió</option>
              <option value="JUSTIFICADO">Justificado</option>
            </select>
          </td>
          <td class="px-2 py-2 text-right">
            <input v-model.number="edits[a.eva_id].leads_captados"
                   type="number" min="0"
                   class="w-16 text-xs py-1 px-1 border border-gray-300 rounded text-right"
                   @change="cambio(a.eva_id)" />
          </td>
          <td class="px-2 py-2 text-right">
            <input v-model.number="edits[a.eva_id].prospectos_creados"
                   type="number" min="0"
                   class="w-16 text-xs py-1 px-1 border border-gray-300 rounded text-right"
                   @change="cambio(a.eva_id)" />
          </td>
          <td class="px-2 py-2 text-right">
            <input v-model.number="edits[a.eva_id].ventas_cerradas"
                   type="number" min="0"
                   class="w-16 text-xs py-1 px-1 border border-gray-300 rounded text-right"
                   @change="cambio(a.eva_id)" />
          </td>
          <td class="px-2 py-2 text-right">
            <button v-if="dirty[a.eva_id]" type="button"
                    :disabled="guardando === a.eva_id"
                    class="text-xs px-2 py-1 bg-primary hover:bg-primary/90 text-white rounded"
                    @click="guardar(a.eva_id)">
              {{ guardando === a.eva_id ? '…' : 'Guardar' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({ evento: { type: Object, required: true } });
const emit  = defineEmits(['refresh']);
const toast = useToastStore();

const asistentes = computed(() => (props.evento.asistentes || []).filter(a => a.eva_activo));

const edits     = reactive({});
const dirty     = reactive({});
const guardando = ref(null);

function nombre(a) {
  return `${a.usuario?.usr_nombre || ''} ${a.usuario?.usr_apellido || ''}`.trim();
}

function seedEdits() {
  asistentes.value.forEach(a => {
    edits[a.eva_id] = {
      estado:              a.eva_estado || 'CONFIRMADO',
      leads_captados:      a.eva_leads_captados     ?? null,
      prospectos_creados:  a.eva_prospectos_creados ?? null,
      ventas_cerradas:     a.eva_ventas_cerradas    ?? null
    };
    dirty[a.eva_id] = false;
  });
}
watch(asistentes, seedEdits, { immediate: true, deep: true });

function cambio(evaId) { dirty[evaId] = true; }

async function guardar(evaId) {
  guardando.value = evaId;
  try {
    await eventosAgendaApi.metricasAsistente(evaId, edits[evaId]);
    toast.success('Métricas actualizadas');
    dirty[evaId] = false;
    emit('refresh');
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo guardar');
  } finally {
    guardando.value = null;
  }
}
</script>
