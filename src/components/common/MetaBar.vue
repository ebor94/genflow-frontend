<script setup>
import { computed } from 'vue';

const props = defineProps({
  actual: { type: Number, required: true },
  meta:   { type: Number, required: true },
  label:  { type: String, default: '' },
  unidad: { type: String, default: '' },
  colorHex: { type: String, default: '#C8902A' }
});

const porcentaje = computed(() => {
  if (!props.meta || props.meta <= 0) return 0;
  return Math.min(100, Math.round((props.actual / props.meta) * 100));
});
</script>

<template>
  <div>
    <div class="flex items-end justify-between mb-1">
      <span v-if="label" class="text-sm font-semibold text-text2">{{ label }}</span>
      <span class="text-xs text-text3">
        <strong class="text-text1">{{ actual }}</strong> / {{ meta }} {{ unidad }}
        · <strong :style="`color:${colorHex}`">{{ porcentaje }}%</strong>
      </span>
    </div>
    <div class="h-2 w-full rounded-full bg-text3/15 overflow-hidden">
      <div class="h-full rounded-full transition-all duration-300"
           :style="`width: ${porcentaje}%; background-color: ${colorHex}`"></div>
    </div>
  </div>
</template>
