<script setup>
import { computed } from 'vue';

const props = defineProps({
  niveles: { type: Array, required: true } // [{ label, count, colorHex }]
});

const maxCount = computed(() => Math.max(1, ...props.niveles.map(n => n.count)));
function widthPct(c) { return Math.max(15, Math.round((c / maxCount.value) * 100)); }
</script>

<template>
  <div class="sv-card p-5">
    <h3 class="font-serif text-lg text-brown-deep mb-4">Embudo</h3>
    <div class="space-y-2">
      <div v-for="(n, i) in niveles" :key="n.label" class="flex flex-col items-center">
        <div class="text-xs text-text3 mb-0.5">{{ n.label }}</div>
        <div class="h-10 rounded-md flex items-center justify-center text-white font-bold text-sm transition-all"
             :style="`width: ${widthPct(n.count)}%; background:${n.colorHex || '#C8902A'}`">
          {{ n.count }}
        </div>
        <div v-if="i < niveles.length - 1" class="text-text3/40 text-lg my-0.5">▼</div>
      </div>
    </div>
  </div>
</template>
