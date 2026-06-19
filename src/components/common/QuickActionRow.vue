<script setup>
/**
 * QuickActionRow — fila de 4 botones de acción rápida sobre una ficha.
 * Llamar, Registrar gestión, Agendar próxima, Compartir.
 */
import { useTelefono } from '@/composables/useTelefono';
import { useToastStore } from '@/stores/useToastStore';
const toast = useToastStore();
const { linkTel } = useTelefono();

const props = defineProps({
  telefono: { type: String, default: '' },
  shareUrl: { type: String, default: '' }
});
const emit = defineEmits(['registrar', 'agendar']);

function compartir() {
  const url = props.shareUrl || location.href;
  if (navigator.share) {
    navigator.share({ url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => toast.info('Link copiado al portapapeles'));
  }
}
</script>

<template>
  <div class="grid grid-cols-4 gap-2">
    <a :href="telefono ? linkTel(telefono) : '#'" class="sv-btn-secondary flex-col py-3" :class="{ 'opacity-40 pointer-events-none': !telefono }">
      <span class="text-xl" aria-hidden="true">📞</span>
      <span class="text-xs mt-1">Llamar</span>
    </a>
    <button class="sv-btn-primary flex-col py-3" @click="emit('registrar')">
      <span class="text-xl" aria-hidden="true">📝</span>
      <span class="text-xs mt-1">Registrar</span>
    </button>
    <button class="sv-btn-secondary flex-col py-3" @click="emit('agendar')">
      <span class="text-xl" aria-hidden="true">📅</span>
      <span class="text-xs mt-1">Agendar</span>
    </button>
    <button class="sv-btn-secondary flex-col py-3" @click="compartir">
      <span class="text-xl" aria-hidden="true">🔗</span>
      <span class="text-xs mt-1">Compartir</span>
    </button>
  </div>
</template>
