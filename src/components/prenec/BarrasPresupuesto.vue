<script setup>
/** Una barra por asesor: llena = 100 % del presupuesto; más de eso no se desborda. */
import { fmtCOP } from '@/utils/format';
import { porcentaje, estadoCumplimiento } from '@/utils/presupuesto';
import ChipCumplimiento from './ChipCumplimiento.vue';

defineProps({
  asesores: { type: Array, default: () => [] },
  seleccionado: { type: [Number, String], default: null }
});
defineEmits(['seleccionar']);

const COLORES = { ok: 'bg-sage', alerta: 'bg-warning', mal: 'bg-danger', sin: 'bg-text3/40' };

function ancho(a) {
  const pct = porcentaje(a.realizado, a.presupuesto);
  return pct === null ? 0 : Math.min(100, Math.max(0, pct));
}
const relleno = (a) => COLORES[estadoCumplimiento(porcentaje(a.realizado, a.presupuesto))];
const detalle = (a) => `${fmtCOP(a.realizado)} de ${fmtCOP(a.presupuesto)}`;
</script>

<template>
  <ul class="space-y-2 tabular-nums lining-nums">
    <li v-for="a in asesores" :key="a.usr_id">
      <button
        type="button"
        :data-testid="`asesor-${a.usr_id}`"
        :aria-pressed="String(String(a.usr_id) === String(seleccionado))"
        class="w-full text-left rounded-sv border px-3 py-2.5 transition-colors hover:bg-text3/5 focus:outline-none focus:ring-2 focus:ring-gold"
        :class="String(a.usr_id) === String(seleccionado) ? 'border-gold bg-gold/5' : 'border-text3/15'"
        @click="$emit('seleccionar', a.usr_id)"
      >
        <div class="flex items-center justify-between gap-3 mb-1.5">
          <span class="font-semibold text-text1 truncate">{{ a.nombre }}</span>
          <ChipCumplimiento :realizado="a.realizado" :presupuesto="a.presupuesto" />
        </div>
        <div
          :data-testid="`barra-${a.usr_id}-pista`"
          class="h-2.5 rounded-full bg-text3/15 overflow-hidden"
          :title="detalle(a)"
        >
          <div
            :data-testid="`barra-${a.usr_id}`"
            :title="detalle(a)"
            class="h-full rounded-full transition-[width] duration-300"
            :class="relleno(a)"
            :style="`width: ${ancho(a)}%`"
          />
        </div>
        <p class="mt-1 text-xs text-text2">{{ detalle(a) }}</p>
      </button>
    </li>
  </ul>
</template>
