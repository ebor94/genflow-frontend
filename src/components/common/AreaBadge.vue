<script setup>
import { computed } from 'vue';

const props = defineProps({
  codigo: { type: String, required: true },
  nombre: { type: String, default: '' },
  icono:  { type: String, default: '' },
  colorHex: { type: String, default: '' },
  size:   { type: String, default: 'md' }, // sm | md | lg
  onDark: { type: Boolean, default: false } // true cuando va sobre fondo oscuro (AppHeader)
});

// Paleta para fondos claros (default)
const PALETA_LIGHT = {
  'PRENEC':   { bg: 'bg-area-prenec/15', text: 'text-area-prenec', border: 'border-area-prenec/40', dot: 'bg-area-prenec' },
  'PREV-EMP': { bg: 'bg-area-emp/15',    text: 'text-area-emp',    border: 'border-area-emp/40',    dot: 'bg-area-emp' },
  'PREV-PAP': { bg: 'bg-area-pap/15',    text: 'text-area-pap',    border: 'border-area-pap/40',    dot: 'bg-area-pap' },
  'SVC':      { bg: 'bg-area-svc/15',    text: 'text-area-svc',    border: 'border-area-svc/40',    dot: 'bg-area-svc' }
};

// Paleta para fondos oscuros (header navegación) — alto contraste con cream
const PALETA_DARK = {
  'PRENEC':   { bg: 'bg-cream/10', text: 'text-cream', border: 'border-area-prenec/70', dot: 'bg-area-prenec' },
  'PREV-EMP': { bg: 'bg-cream/10', text: 'text-cream', border: 'border-area-emp/70',    dot: 'bg-area-emp' },
  'PREV-PAP': { bg: 'bg-cream/10', text: 'text-cream', border: 'border-area-pap/70',    dot: 'bg-area-pap' },
  'SVC':      { bg: 'bg-cream/10', text: 'text-cream', border: 'border-area-svc/70',    dot: 'bg-area-svc' }
};

const palette = computed(() => {
  const tabla = props.onDark ? PALETA_DARK : PALETA_LIGHT;
  return tabla[props.codigo] || {
    bg: props.onDark ? 'bg-cream/10' : 'bg-text3/15',
    text: props.onDark ? 'text-cream' : 'text-text2',
    border: 'border-text3/40',
    dot: 'bg-text3'
  };
});

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5'
};
</script>

<template>
  <span class="inline-flex items-center gap-1.5 rounded-full border font-semibold"
        :class="[palette.bg, palette.text, palette.border, sizes[size]]"
        :style="(colorHex && !onDark) ? `color:${colorHex}; border-color:${colorHex}66; background-color:${colorHex}22` : ''">
    <!-- Dot de color cuando va sobre dark sin icono: identifica área sin saturar -->
    <span v-if="onDark && !icono"
          class="w-1.5 h-1.5 rounded-full" :class="palette.dot"
          :style="colorHex ? `background-color:${colorHex}` : ''"
          aria-hidden="true"></span>
    <span v-if="icono" aria-hidden="true">{{ icono }}</span>
    <span>{{ nombre || codigo }}</span>
  </span>
</template>
