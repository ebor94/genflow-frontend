<script setup>
/**
 * CallScreen.vue — pantalla En Llamada (full-screen modal).
 * Props: open, prospecto
 * Emit: close, terminar (duracion_seg, notas) → al colgar, el padre abre RegistrarGestion
 *
 * UI auxiliar (no es softphone real). El timer corre desde que se abre.
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import { useTelefono } from '@/composables/useTelefono';

const props = defineProps({
  open: { type: Boolean, required: true },
  prospecto: { type: Object, default: null }
});
const emit = defineEmits(['close', 'terminar']);

const { formato, linkTel } = useTelefono();

const segundos = ref(0);
const muteado  = ref(false);
const speaker  = ref(false);
const notas    = ref('');
const mostrarNotas = ref(false);
let intervalId = null;

const tiempo = computed(() => {
  const m = Math.floor(segundos.value / 60);
  const s = segundos.value % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

const persona = computed(() => props.prospecto?.persona);
const productos = computed(() => props.prospecto?.productos || []);
const iniciales = computed(() => {
  const p = persona.value;
  if (!p) return '';
  return `${(p.persona_nombre || '').charAt(0)}${(p.persona_apellido || '').charAt(0)}`.toUpperCase();
});

function start() {
  segundos.value = 0;
  notas.value = sessionStorage.getItem(`sv_call_notes_${props.prospecto?.prosp_id}`) || '';
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => { segundos.value += 1; }, 1000);
}

function stop() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

watch(() => props.open, (v) => { if (v) start(); else stop(); });
onUnmounted(stop);

watch(notas, (v) => {
  if (props.prospecto?.prosp_id) {
    if (v) sessionStorage.setItem(`sv_call_notes_${props.prospecto.prosp_id}`, v);
    else sessionStorage.removeItem(`sv_call_notes_${props.prospecto.prosp_id}`);
  }
});

function colgar() {
  stop();
  emit('terminar', { duracion_seg: segundos.value, notas: notas.value });
  // Limpiar notas en sessionStorage al colgar
  if (props.prospecto?.prosp_id) sessionStorage.removeItem(`sv_call_notes_${props.prospecto.prosp_id}`);
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && prospecto" class="fixed inset-0 z-50 bg-brown-deep text-cream flex flex-col">
      <header class="px-6 py-4 flex items-center justify-between">
        <button @click="emit('close')" class="text-cream/60 hover:text-cream text-sm">← Cerrar</button>
        <span class="text-xs text-cream/60 uppercase tracking-wide">En llamada</span>
        <div class="w-16"></div>
      </header>

      <div class="flex-1 flex flex-col items-center justify-center text-center px-6 gap-6">
        <div class="w-24 h-24 rounded-full bg-gold text-brown-deep flex items-center justify-center text-3xl font-bold">
          {{ iniciales }}
        </div>
        <div>
          <h1 class="font-serif text-3xl">{{ persona?.persona_nombre }} {{ persona?.persona_apellido || '' }}</h1>
          <a :href="linkTel(persona?.persona_telefono_principal)" class="text-gold-bright text-sm mt-1 block">
            {{ formato(persona?.persona_telefono_principal) }}
          </a>
        </div>
        <div class="text-5xl font-serif text-gold-bright tabular-nums">{{ tiempo }}</div>

        <div v-if="productos.length" class="bg-cream/10 rounded-sv px-4 py-2 max-w-md">
          <div class="text-xs text-cream/60 uppercase mb-1">Productos de interés</div>
          <div class="text-sm">{{ productos.map(p => p.producto?.prod_nombre).filter(Boolean).join(' · ') }}</div>
        </div>

        <div v-if="prospecto.prosp_nota_inicial" class="bg-cream/10 rounded-sv px-4 py-2 max-w-md">
          <div class="text-xs text-cream/60 uppercase mb-1">Última nota</div>
          <div class="text-sm">{{ prospecto.prosp_nota_inicial }}</div>
        </div>
      </div>

      <!-- Panel notas -->
      <div v-if="mostrarNotas" class="px-6 pb-4">
        <textarea v-model="notas"
                  rows="3"
                  placeholder="Notas mientras hablas..."
                  class="w-full rounded-sv bg-cream/10 border border-cream/20 text-cream placeholder:text-cream/40 px-3 py-2 text-sm"></textarea>
      </div>

      <!-- Botones -->
      <footer class="px-6 py-6 flex justify-center items-center gap-4">
        <button @click="muteado = !muteado" class="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
                :class="muteado ? 'bg-gold text-brown-deep' : 'bg-cream/10 hover:bg-cream/20'" aria-label="Mute">
          {{ muteado ? '🔇' : '🎙️' }}
        </button>
        <button @click="speaker = !speaker" class="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
                :class="speaker ? 'bg-gold text-brown-deep' : 'bg-cream/10 hover:bg-cream/20'" aria-label="Speaker">
          {{ speaker ? '🔊' : '🔈' }}
        </button>
        <button @click="mostrarNotas = !mostrarNotas" class="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
                :class="mostrarNotas ? 'bg-gold text-brown-deep' : 'bg-cream/10 hover:bg-cream/20'" aria-label="Notas">
          📝
        </button>
        <button @click="colgar" class="w-16 h-16 rounded-full bg-danger hover:bg-danger/90 text-white text-2xl flex items-center justify-center shadow-sv-pop"
                aria-label="Colgar">
          ☎️
        </button>
      </footer>
    </div>
  </Teleport>
</template>
