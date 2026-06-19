<script setup>
import { computed } from 'vue';

const props = defineProps({
  asesores: { type: Array, default: () => [] } // [{ usuario, snap_* fields, meta }]
});

function pct(v, m) { return m > 0 ? Math.min(100, Math.round((v / m) * 100)) : 0; }
</script>

<template>
  <div class="sv-card overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-cream text-text2">
        <tr>
          <th class="text-left px-4 py-3">Asesor</th>
          <th class="text-right px-4 py-3">Gestiones</th>
          <th class="text-right px-4 py-3">Interesados</th>
          <th class="text-right px-4 py-3">Contratos</th>
          <th class="text-right px-4 py-3">Vencidas</th>
          <th class="text-left  px-4 py-3 min-w-[140px]">Meta %</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-text3/10">
        <tr v-for="a in asesores" :key="a.snap_id">
          <td class="px-4 py-3">
            <div class="font-semibold text-text1">{{ a.usuario?.usr_nombre }} {{ a.usuario?.usr_apellido }}</div>
            <div class="text-xs text-text3">{{ a.usuario?.usr_email }}</div>
          </td>
          <td class="px-4 py-3 text-right">{{ a.snap_gestiones_realizadas }}</td>
          <td class="px-4 py-3 text-right">{{ a.snap_interesados_nuevos }}</td>
          <td class="px-4 py-3 text-right font-semibold text-sage">{{ a.snap_contratos_cerrados }}</td>
          <td class="px-4 py-3 text-right" :class="a.snap_vencidas_acumuladas > 0 ? 'text-danger font-semibold' : 'text-text3'">
            {{ a.snap_vencidas_acumuladas }}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <div class="flex-1 h-2 rounded-full bg-text3/15 overflow-hidden">
                <div class="h-full rounded-full bg-gold" :style="`width: ${pct(a.snap_contratos_cerrados, a.meta?.meta_contratos || 10)}%`"></div>
              </div>
              <span class="text-xs w-12 text-right">{{ pct(a.snap_contratos_cerrados, a.meta?.meta_contratos || 10) }}%</span>
            </div>
          </td>
        </tr>
        <tr v-if="!asesores.length"><td colspan="6" class="text-center py-8 text-text3">Sin datos del día.</td></tr>
      </tbody>
    </table>
  </div>
</template>
