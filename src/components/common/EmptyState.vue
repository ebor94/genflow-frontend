<script setup>
defineProps({
  titulo:  { type: String, default: 'Sin resultados' },
  mensaje: { type: String, default: '' },
  icono:   { type: String, default: '📭' }
});
</script>

<template>
  <div class="text-center py-12 px-4 text-text3">
    <div class="text-5xl mb-3" aria-hidden="true">{{ icono }}</div>
    <h3 class="text-lg font-semibold text-text2">{{ titulo }}</h3>
    <p v-if="mensaje" class="mt-1 text-sm">{{ mensaje }}</p>
    <div class="mt-4 flex justify-center"><slot /></div>
  </div>
</template>
