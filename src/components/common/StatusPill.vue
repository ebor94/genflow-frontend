<script setup>
defineProps({
  label: { type: String, required: true },
  colorHex: { type: String, default: '#8A6A52' },
  icono: { type: String, default: '' }
});
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border"
        :style="`color:${colorHex}; border-color:${colorHex}66; background-color:${colorHex}1f`">
    <span v-if="icono" aria-hidden="true">{{ icono }}</span>
    {{ label }}
  </span>
</template>
