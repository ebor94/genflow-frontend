<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
        <h2 class="text-lg font-bold text-text1 mb-1">Confirma con el OTP</h2>
        <p class="text-sm text-text3 mb-1">
          Se envió un código de 6 dígitos al chat de tu jefe. Pídeselo para confirmar los cambios.
        </p>
        <p class="text-xs" :class="expirado ? 'text-red-600' : 'text-text3'">
          Vence en <span class="font-mono">{{ mmss }}</span>
        </p>

        <div class="flex justify-center gap-2 my-4">
          <input v-for="(_, i) in 6" :key="i"
                 :ref="el => refs[i] = el"
                 v-model="digitos[i]"
                 inputmode="numeric" maxlength="1"
                 class="w-10 h-12 text-center text-xl border border-gray-300 rounded font-mono focus:border-primary focus:outline-none"
                 @input="onInput(i, $event)"
                 @keydown.delete="onDelete(i, $event)"
                 @paste="onPaste($event)" />
        </div>

        <div v-if="mensajeError" class="text-sm text-red-600 mb-2 text-center">{{ mensajeError }}</div>

        <div class="flex gap-2 justify-end">
          <button type="button" class="text-xs px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  @click="cerrar">
            Cancelar
          </button>
          <button type="button"
                  :disabled="segundosReenviar > 0 || solicitando"
                  class="text-xs px-3 py-2 border border-primary text-primary rounded disabled:opacity-50"
                  @click="reenviar">
            {{ segundosReenviar > 0 ? `Reenviar (${segundosReenviar}s)` : 'Reenviar' }}
          </button>
          <button type="button"
                  data-testid="btn-otp-confirmar"
                  :disabled="codigo.length !== 6 || confirmando || expirado"
                  class="text-xs px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white rounded"
                  @click="confirmar">
            {{ confirmando ? '…' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * OtpConfirmarModal.vue — SP-3
 * Modal de 6 dígitos para confirmar el OTP enviado al chat del jefe.
 * No cierra con Escape ni click fuera durante la solicitud: solo el
 * botón "Cancelar" explícito emite `close`.
 *
 *   <OtpConfirmarModal :open="otp.open" :otp-id="otp.id" :expires-at="otp.expiresAt"
 *                       :evento="evento" :cambios="cambiosPendientes"
 *                       @close="otp.open = false" @confirmado="onConfirmado" />
 */
import { reactive, ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({
  open:      { type: Boolean, default: false },
  otpId:     { type: Number, required: true },
  expiresAt: { type: [String, Date], required: true },
  evento:    { type: Object, required: true },
  cambios:   { type: Object, required: true }
});
const emit = defineEmits(['close', 'confirmado', 'reenviado']);
const toast = useToastStore();

const digitos = reactive(['','','','','','']);
const refs = reactive([]);
const codigo = computed(() => digitos.join(''));
const confirmando = ref(false);
const solicitando = ref(false);
const mensajeError = ref('');
const segundosReenviar = ref(30);
const segundosRestantes = ref(0);
let timerReenv, timerExp;

const expirado = computed(() => segundosRestantes.value <= 0);
const mmss = computed(() => {
  const s = Math.max(0, segundosRestantes.value);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
});

function onInput(i, e) {
  digitos[i] = String(digitos[i] || '').replace(/\D/g, '').slice(0, 1);
  if (digitos[i] && i < 5) nextTick(() => refs[i+1]?.focus());
}
function onDelete(i, e) {
  if (!digitos[i] && i > 0) nextTick(() => refs[i-1]?.focus());
}
function onPaste(e) {
  const txt = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
  if (!txt) return;
  e.preventDefault();
  for (let i = 0; i < 6; i++) digitos[i] = txt[i] || '';
  nextTick(() => refs[Math.min(5, txt.length)]?.focus());
}

async function confirmar() {
  if (codigo.value.length !== 6 || confirmando.value) return;
  confirmando.value = true;
  mensajeError.value = '';
  try {
    const evento = await eventosAgendaApi.otpConfirmar(props.evento.evento_id, props.otpId, codigo.value);
    toast.success('Cambios aplicados');
    emit('confirmado', evento);
  } catch (e) {
    const st = e.response?.status;
    if (st === 401) mensajeError.value = 'Código incorrecto. Verifica con tu jefe.';
    else if (st === 410) mensajeError.value = 'El OTP expiró. Solicita uno nuevo.';
    else if (st === 409) mensajeError.value = 'El OTP ya fue consumido.';
    else mensajeError.value = e.response?.data?.error?.message || 'No se pudo confirmar';
    for (let i = 0; i < 6; i++) digitos[i] = '';
    nextTick(() => refs[0]?.focus());
  } finally {
    confirmando.value = false;
  }
}

async function reenviar() {
  if (segundosReenviar.value > 0 || solicitando.value) return;
  solicitando.value = true;
  try {
    const r = await eventosAgendaApi.otpSolicitar(props.evento.evento_id, props.cambios);
    emit('reenviado', r);
    toast.info('Nuevo código enviado a Google Chat');
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo reenviar');
  } finally {
    solicitando.value = false;
    iniciarReenv();
  }
}

function iniciarReenv() {
  segundosReenviar.value = 30;
  clearInterval(timerReenv);
  timerReenv = setInterval(() => {
    if (--segundosReenviar.value <= 0) clearInterval(timerReenv);
  }, 1000);
}

function iniciarExp() {
  const target = new Date(props.expiresAt).getTime();
  const tick = () => {
    segundosRestantes.value = Math.max(0, Math.round((target - Date.now()) / 1000));
    if (segundosRestantes.value <= 0) clearInterval(timerExp);
  };
  tick();
  clearInterval(timerExp);
  timerExp = setInterval(tick, 1000);
}

function cerrar() {
  clearInterval(timerReenv);
  clearInterval(timerExp);
  emit('close');
}

watch(() => props.open, (v) => {
  if (v) {
    for (let i = 0; i < 6; i++) digitos[i] = '';
    mensajeError.value = '';
    iniciarReenv();
    iniciarExp();
    nextTick(() => refs[0]?.focus());
  } else {
    clearInterval(timerReenv);
    clearInterval(timerExp);
  }
}, { immediate: true });

onBeforeUnmount(() => {
  clearInterval(timerReenv);
  clearInterval(timerExp);
});
</script>
