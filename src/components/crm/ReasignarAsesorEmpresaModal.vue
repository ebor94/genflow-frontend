<script setup>
import { ref, computed, watch } from 'vue';
import { usuariosApi } from '@/api/usuariosApi';
import { empresasApi } from '@/api/empresasApi';
import { useToastStore } from '@/stores/useToastStore';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  empresa: { type: Object, default: null }
});
const emit = defineEmits(['close', 'reasignado']);

const toast = useToastStore();
const cargando = ref(false);
const enviando = ref(false);
const asesores = ref([]);
const filtro = ref('');
const seleccionado = ref(null);
const motivo = ref('');

const prospectoMuestra = computed(() => props.empresa?.prospectos?.[0] || null);
const grupoId = computed(() => prospectoMuestra.value?.prosp_grupo_id || null);
const asesorActual = computed(() => prospectoMuestra.value?.asesor || null);

const asesoresFiltrados = computed(() => {
  const q = filtro.value.trim().toLowerCase();
  return asesores.value
    .filter(u => u.usr_id !== asesorActual.value?.usr_id)
    .filter(u => !q || `${u.usr_nombre} ${u.usr_apellido} ${u.usr_email}`.toLowerCase().includes(q));
});

const nombreCompleto = (u) => `${u.usr_nombre || ''} ${u.usr_apellido || ''}`.trim() || u.usr_email;

async function cargarAsesores() {
  if (!grupoId.value) return;
  cargando.value = true;
  try {
    const r = await usuariosApi.list({ grupo_id: grupoId.value, activo: 1 });
    const data = Array.isArray(r) ? r : (r?.data || []);
    asesores.value = data.filter(u => ['ASESOR', 'AGENTE_SVC'].includes(u.rol?.rol_codigo));
  } catch (e) {
    toast.error('No se pudieron cargar los asesores');
  } finally {
    cargando.value = false;
  }
}

async function confirmar() {
  if (!seleccionado.value) { toast.warning('Selecciona un asesor destino'); return; }
  enviando.value = true;
  try {
    const r = await empresasApi.reasignarAsesor(props.empresa.empresa_id, seleccionado.value.usr_id, motivo.value);
    toast.success(`Empresa reasignada a ${nombreCompleto(seleccionado.value)} (${r.reasignados || 0} prospectos)`);
    emit('reasignado', r);
    cerrar();
  } catch (e) {
    toast.error(e.response?.data?.message || 'Error al reasignar');
  } finally {
    enviando.value = false;
  }
}

function cerrar() {
  filtro.value = ''; seleccionado.value = null; motivo.value = '';
  emit('close');
}

watch(() => props.open, (n) => {
  if (n) { filtro.value = ''; seleccionado.value = null; motivo.value = ''; cargarAsesores(); }
});
</script>

<template>
  <BaseModal :open="open" title="🔄 Reasignar asesor de la empresa" max-width="max-w-lg" @close="cerrar">
    <div v-if="!empresa" class="text-text3 text-center py-8">Empresa no disponible.</div>
    <div v-else class="space-y-4">
      <div class="sv-card p-3 bg-cream/50">
        <div class="text-xs text-text3 uppercase tracking-wider mb-1">Empresa</div>
        <div class="font-semibold text-text1">{{ empresa.empresa_razon_social }}</div>
        <div class="text-xs text-text3 mt-1">
          Asesor actual: <strong>{{ asesorActual ? nombreCompleto(asesorActual) : 'Sin asignar' }}</strong>
        </div>
        <div v-if="empresa.prospectos?.length > 1" class="text-xs text-warning mt-1">
          ⚠️ Esta empresa tiene {{ empresa.prospectos.length }} prospectos. Todos se reasignarán al nuevo asesor.
        </div>
      </div>

      <div>
        <label class="sv-label">Asesor destino</label>
        <BaseInput v-model="filtro" placeholder="Buscar por nombre o email..." />
      </div>

      <div class="max-h-64 overflow-y-auto border border-text3/15 rounded-sv">
        <div v-if="cargando" class="text-text3 text-sm text-center py-6">Cargando asesores...</div>
        <div v-else-if="!asesoresFiltrados.length" class="text-text3 text-sm text-center py-6">
          {{ filtro ? 'Ningún asesor coincide' : 'No hay otros asesores activos en este grupo' }}
        </div>
        <button v-for="u in asesoresFiltrados" :key="u.usr_id"
                type="button" @click="seleccionado = u"
                class="w-full text-left px-3 py-2.5 border-b border-text3/10 last:border-0 flex items-center gap-3"
                :class="seleccionado?.usr_id === u.usr_id ? 'bg-gold/15 hover:bg-gold/20' : 'hover:bg-cream'">
          <div class="w-9 h-9 rounded-full bg-gold/20 text-brown-deep font-bold flex items-center justify-center text-sm shrink-0">
            {{ (u.usr_nombre?.[0] || '') + (u.usr_apellido?.[0] || '') }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-text1 truncate">{{ nombreCompleto(u) }}</div>
            <div class="text-xs text-text3 truncate">{{ u.usr_email }}</div>
          </div>
          <span v-if="seleccionado?.usr_id === u.usr_id" class="text-gold text-lg">✓</span>
        </button>
      </div>

      <div>
        <label class="sv-label">Motivo (opcional)</label>
        <BaseTextarea v-model="motivo" rows="2" placeholder="Vacaciones, carga balanceada..." maxlength="250" />
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="cerrar">Cancelar</BaseButton>
      <BaseButton variant="primary" :disabled="!seleccionado || enviando" @click="confirmar">
        {{ enviando ? 'Reasignando...' : 'Confirmar' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
