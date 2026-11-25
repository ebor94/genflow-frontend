<script setup>
/**
 * BaseModal.vue — ventana común.
 * Nunca es más alta que la pantalla: el título y los botones quedan fijos y se desplaza el
 * contenido. No se cierra con Escape ni con clic afuera, para no perder lo que se está
 * escribiendo: solo con la X o con los botones de cada ventana.
 *  - cierraAfuera: deja cerrar con clic afuera. Solo donde no se escribe información.
 *  - paso: en formularios por pasos, al cambiar devuelve el contenido arriba.
 */
import { ref, watch } from 'vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, default: '' },
  maxWidth: { type: String, default: 'max-w-lg' }, // tailwind class
  cierraAfuera: { type: Boolean, default: false },
  paso: { type: [Number, String], default: null }
});
const emit = defineEmits(['close']);

const cuerpo = ref(null);
watch(() => props.paso, () => {
  if (cuerpo.value) cuerpo.value.scrollTop = 0;
}, { flush: 'post' });

function clicAfuera() {
  if (props.cierraAfuera) emit('close');
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" data-testid="modal-fondo" class="fixed inset-0 z-50 flex items-center justify-center bg-brown-deep/60 px-4" @click.self="clicAfuera">
        <div class="sv-card sv-modal w-full" :class="maxWidth">
          <header v-if="title || $slots.header" class="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-text3/15">
            <h3 class="min-w-0 text-lg text-brown-deep">{{ title }}<slot name="header" /></h3>
            <button type="button" class="shrink-0 text-text3 hover:text-text1 transition-colors" @click="emit('close')" aria-label="Cerrar">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div ref="cuerpo" data-testid="modal-cuerpo" class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="shrink-0 px-5 py-3 border-t border-text3/15 bg-cream/40 flex flex-wrap justify-end gap-2 rounded-b-sv">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
