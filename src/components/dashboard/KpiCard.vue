<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], required: true },
  icon:  { type: String, default: '' },
  trend: { type: Number, default: null },         // % vs período anterior
  unidad: { type: String, default: '' },
  colorHex: { type: String, default: '#C8902A' }
});

const trendColor = computed(() => {
  if (props.trend == null) return '';
  return props.trend >= 0 ? 'text-sage' : 'text-danger';
});

const trendArrow = computed(() => {
  if (props.trend == null) return '';
  return props.trend >= 0 ? '↑' : '↓';
});
</script>

<template>
  <div class="sv-card p-5">
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs text-text3 font-semibold uppercase tracking-wider">{{ label }}</span>
      <span v-if="icon" class="text-xl opacity-70" aria-hidden="true">{{ icon }}</span>
    </div>
    <div class="flex items-baseline gap-2">
      <span class="font-serif text-3xl" :style="`color:${colorHex}`">{{ value }}</span>
      <span v-if="unidad" class="text-sm text-text3">{{ unidad }}</span>
    </div>
    <div v-if="trend != null" :class="['text-xs mt-1 font-semibold', trendColor]">
      {{ trendArrow }} {{ Math.abs(trend) }}% vs período anterior
    </div>
  </div>
</template>
