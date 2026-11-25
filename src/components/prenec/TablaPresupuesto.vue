<script setup>
/** Presupuesto, realizado y cumplimiento de un asesor por categoría, con total. */
import { fmtCOP } from '@/utils/format';
import ChipCumplimiento from './ChipCumplimiento.vue';

const props = defineProps({
  asesor: { type: Object, required: true },
  categorias: { type: Array, default: () => [] }
});

const celda = (cat) => props.asesor.categorias?.[cat] || { presupuesto: 0, realizado: 0 };
</script>

<template>
  <div class="overflow-x-auto tabular-nums lining-nums">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs uppercase tracking-wider text-text3 border-b border-text3/20">
          <th class="py-2 pr-3 font-semibold">Categoría</th>
          <th class="py-2 px-3 font-semibold text-right">Presupuesto</th>
          <th class="py-2 px-3 font-semibold text-right">Realizado</th>
          <th class="py-2 pl-3 font-semibold text-right">Cumplimiento</th>
        </tr>
      </thead>
      <tbody class="text-text1">
        <tr v-for="cat in categorias" :key="cat" :data-testid="`fila-${cat}`" class="border-b border-text3/10">
          <td class="py-2 pr-3">{{ cat }}</td>
          <td class="py-2 px-3 text-right">{{ fmtCOP(celda(cat).presupuesto) }}</td>
          <td class="py-2 px-3 text-right">{{ fmtCOP(celda(cat).realizado) }}</td>
          <td class="py-2 pl-3 text-right"><ChipCumplimiento :realizado="celda(cat).realizado" :presupuesto="celda(cat).presupuesto" /></td>
        </tr>
        <tr data-testid="fila-total" class="font-bold bg-text3/5">
          <td class="py-2 pr-3">Total</td>
          <td class="py-2 px-3 text-right">{{ fmtCOP(asesor.presupuesto) }}</td>
          <td class="py-2 px-3 text-right">{{ fmtCOP(asesor.realizado) }}</td>
          <td class="py-2 pl-3 text-right"><ChipCumplimiento :realizado="asesor.realizado" :presupuesto="asesor.presupuesto" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
