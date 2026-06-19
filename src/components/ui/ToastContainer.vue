<script setup>
import { useToastStore } from '@/stores/useToastStore';
const toast = useToastStore();

const colorMap = {
  success: 'bg-sage/10 border-sage text-sage',
  error:   'bg-danger/10 border-danger text-danger',
  warning: 'bg-warning/10 border-warning text-warning',
  info:    'bg-brown-warm/10 border-brown-warm text-brown-warm'
};
</script>

<template>
  <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
    <TransitionGroup
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="translate-x-full opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-full opacity-0"
    >
      <div
        v-for="t in toast.toasts"
        :key="t.id"
        class="flex items-start gap-3 p-3 rounded-sv border shadow-sv-pop bg-white"
        :class="colorMap[t.type]"
      >
        <p class="text-sm flex-1 font-medium">{{ t.message }}</p>
        <button @click="toast.removeToast(t.id)" class="opacity-60 hover:opacity-100" aria-label="Cerrar">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
