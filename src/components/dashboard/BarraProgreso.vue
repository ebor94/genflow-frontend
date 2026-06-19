<script setup>
import { computed } from 'vue';
defineProps({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  max:   { type: Number, required: true },
  colorHex: { type: String, default: '#C8902A' }
});
function pct(v, m) { return m > 0 ? Math.min(100, Math.round((v / m) * 100)) : 0; }
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="text-sm text-text2 w-28 truncate" :title="label">{{ label }}</span>
    <div class="flex-1 h-2 rounded-full bg-text3/15 overflow-hidden">
      <div class="h-full rounded-full transition-all duration-300"
           :style="`width: ${pct(value, max)}%; background:${colorHex}`"></div>
    </div>
    <span class="text-sm text-text2 w-20 text-right font-semibold">{{ value }} / {{ max }}</span>
  </div>
</template>
