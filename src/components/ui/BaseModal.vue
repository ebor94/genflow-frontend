<script setup>
defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, default: '' },
  maxWidth: { type: String, default: 'max-w-lg' } // tailwind class
});
const emit = defineEmits(['close']);
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
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-brown-deep/60 px-4" @click.self="emit('close')">
        <div class="sv-card w-full" :class="maxWidth">
          <header v-if="title || $slots.header" class="flex items-center justify-between px-5 py-4 border-b border-text3/15">
            <h3 class="text-lg text-brown-deep">{{ title }}<slot name="header" /></h3>
            <button class="text-text3 hover:text-text1 transition-colors" @click="emit('close')" aria-label="Cerrar">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div class="px-5 py-4">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="px-5 py-3 border-t border-text3/15 bg-cream/40 flex justify-end gap-2 rounded-b-sv">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
