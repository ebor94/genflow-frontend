<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5">
        <h2 class="text-lg font-bold text-text1 mb-3">Editar evento</h2>

        <div class="space-y-3">
          <label class="block text-xs text-text3">
            Título
            <input v-model="form.titulo" type="text"
                   class="mt-1 w-full text-sm px-3 py-2 border border-gray-300 rounded" />
          </label>
          <label class="block text-xs text-text3">
            Descripción
            <textarea v-model="form.descripcion" rows="3"
                      class="mt-1 w-full text-sm px-3 py-2 border border-gray-300 rounded"></textarea>
          </label>
          <label class="block text-xs text-text3">
            Meta leads
            <input v-model.number="form.meta_leads" type="number" min="0"
                   class="mt-1 w-full text-sm px-3 py-2 border border-gray-300 rounded" />
          </label>
        </div>

        <p v-if="requiereOtp" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
          Como eres el dueño del evento, al guardar se te pedirá un OTP enviado a tu jefe por Google Chat.
        </p>

        <div class="flex gap-2 justify-end mt-4">
          <button type="button" class="text-xs px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  @click="cerrar">
            Cancelar
          </button>
          <button type="button"
                  :disabled="guardando"
                  class="text-xs px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white rounded"
                  @click="guardar">
            {{ guardando ? '…' : (requiereOtp ? 'Solicitar OTP' : 'Guardar') }}
          </button>
        </div>
      </div>
    </div>

    <OtpConfirmarModal v-if="otp.open"
                       :open="otp.open"
                       :otp-id="otp.id"
                       :expires-at="otp.expiresAt"
                       :evento="evento"
                       :cambios="cambiosPendientes"
                       @close="otp.open = false"
                       @confirmado="onOtpConfirmado" />
  </Teleport>
</template>

<script setup>
/**
 * EditarEventoModal.vue — SP-3
 * Edición simplificada (titulo/descripcion/meta_leads) del evento.
 * Jefes (roles supervisores) guardan directo con PUT; el dueño-asesor
 * pasa por el flujo OTP (OtpConfirmarModal) vía Google Chat.
 *
 *   <EditarEventoModal :open="editar" :evento="evento"
 *                       @close="editar = false" @guardado="cargar" />
 */
import { ref, reactive, computed, watch } from 'vue';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import OtpConfirmarModal from './OtpConfirmarModal.vue';

const props = defineProps({
  open:   { type: Boolean, default: false },
  evento: { type: Object, required: true }
});
const emit = defineEmits(['close', 'guardado']);

const auth = useAuthStore();
const toast = useToastStore();

const ROLES_SUPERVISORES = new Set([
  'SUPER_ADMIN','GERENTE_GENERAL','DIRECTOR_COMERCIAL','ADMIN_AREA',
  'COORDINADOR_PREVISION','JEFE_PAP','SUPERVISOR'
]);
// Nota: el store expone `usuario` (no `user`); ver src/stores/useAuthStore.js.
const rolCodigo = computed(() => auth.usuario?.rol?.rol_codigo);
const esSupervisor = computed(() => ROLES_SUPERVISORES.has(rolCodigo.value));
const esDueño = computed(() => auth.usuario?.usr_id === props.evento?.evento_asesor_id);
const requiereOtp = computed(() => !esSupervisor.value && esDueño.value);

const form = reactive({ titulo: '', descripcion: '', meta_leads: null });
const guardando = ref(false);
const cambiosPendientes = ref({});
const otp = reactive({ open: false, id: null, expiresAt: null });

watch(() => props.open, (v) => {
  if (v) {
    form.titulo      = props.evento.evento_titulo || '';
    form.descripcion = props.evento.evento_descripcion || '';
    form.meta_leads  = props.evento.evento_meta_leads || null;
  }
}, { immediate: true });

function diff() {
  const d = {};
  if (form.titulo !== props.evento.evento_titulo) d.titulo = form.titulo;
  if ((form.descripcion || null) !== (props.evento.evento_descripcion || null)) d.descripcion = form.descripcion || null;
  if ((form.meta_leads || null) !== (props.evento.evento_meta_leads || null)) d.meta_leads = form.meta_leads || null;
  return d;
}

async function guardar() {
  const cambios = diff();
  if (!Object.keys(cambios).length) {
    toast.info('No hay cambios');
    return;
  }
  guardando.value = true;
  try {
    if (requiereOtp.value) {
      const r = await eventosAgendaApi.otpSolicitar(props.evento.evento_id, cambios);
      cambiosPendientes.value = cambios;
      otp.id = r.otp_id;
      otp.expiresAt = r.expires_at;
      otp.open = true;
    } else {
      const ev = await eventosAgendaApi.update(props.evento.evento_id, cambios);
      toast.success('Evento actualizado');
      emit('guardado', ev);
      emit('close');
    }
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo guardar');
  } finally {
    guardando.value = false;
  }
}

function onOtpConfirmado(ev) {
  otp.open = false;
  emit('guardado', ev);
  emit('close');
}

function cerrar() {
  if (guardando.value) return;
  emit('close');
}
</script>
