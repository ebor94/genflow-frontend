<script setup>
/**
 * Chip de cumplimiento: siempre con número e ícono, nunca solo color.
 * El color sale del % sin redondear; el texto muestra el redondeado.
 */
import { computed } from 'vue';
import { porcentaje, cumplimiento, estadoCumplimiento } from '@/utils/presupuesto';

const props = defineProps({
  realizado: { type: Number, default: 0 },
  presupuesto: { type: Number, default: 0 },
  soloIcono: { type: Boolean, default: false } // para la tarjeta, donde el número ya está en grande
});

const estado = computed(() => estadoCumplimiento(porcentaje(props.realizado, props.presupuesto)));
const pct = computed(() => cumplimiento(props.realizado, props.presupuesto));

const ICONOS = { ok: '✓', alerta: '!', mal: '✕', sin: '' };
const BORDES = { ok: 'border-sage bg-sage/10', alerta: 'border-warning bg-warning/10', mal: 'border-danger bg-danger/10', sin: 'border-text3/30 bg-text3/5' };
const TEXTOS = { ok: 'cumplido', alerta: 'cerca de la meta', mal: 'por debajo de la meta', sin: 'sin presupuesto' };
</script>

<template>
  <span
    class="inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold text-text1 whitespace-nowrap tabular-nums lining-nums"
    :class="BORDES[estado]"
    :data-estado="estado"
  >
    <span v-if="ICONOS[estado]" data-testid="chip-icono" aria-hidden="true">{{ ICONOS[estado] }}</span>
    <span v-if="!soloIcono" aria-hidden="true">{{ pct === null ? '—' : `${pct} %` }}</span>
    <span class="sr-only">{{ pct === null ? 'Cumplimiento: sin presupuesto' : `Cumplimiento ${pct} %: ${TEXTOS[estado]}` }}</span>
  </span>
</template>
