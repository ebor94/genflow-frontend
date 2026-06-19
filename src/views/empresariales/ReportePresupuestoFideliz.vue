<script setup>
/**
 * Reporte gerencial de presupuesto de fidelización por categoría.
 * Muestra cuánto se asignó / gastó / queda disponible por nivel
 * (Bronce / Plata / Oro / Platino / Diamante / Sin categoría).
 * Acceso: SUPER_ADMIN, ADMIN_AREA, SUPERVISOR (controlado en backend).
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { empresasApi } from '@/api/empresasApi';
import { useToastStore } from '@/stores/useToastStore';
import BaseButton from '@/components/ui/BaseButton.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const router = useRouter();
const toast = useToastStore();
const cargando = ref(false);
const porCategoria = ref([]);
const totales = ref({});

const CAT_INFO = {
  BRONCE:   { icono: '🥉', color: '#cd7f32', orden: 1 },
  PLATA:    { icono: '🥈', color: '#b0b0b0', orden: 2 },
  ORO:      { icono: '🥇', color: '#d4af37', orden: 3 },
  PLATINO:  { icono: '💎', color: '#7ec0c0', orden: 4 },
  DIAMANTE: { icono: '💠', color: '#5ac8fa', orden: 5 }
};

async function cargar() {
  cargando.value = true;
  try {
    const r = await empresasApi.reportePresupuestoFideliz();
    porCategoria.value = r.por_categoria || [];
    totales.value = r.totales || {};
  } catch (e) {
    toast.error(e.response?.data?.message || 'Error cargando reporte');
  } finally {
    cargando.value = false;
  }
}

const fmtMoneda = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n || 0);

// Para visualizar la barra de cada categoría como fracción del asignado global
const maxAsignado = computed(() => {
  return Math.max(1, ...porCategoria.value.map(c => c.total_asignado));
});

const categoriasConDatos = computed(() =>
  porCategoria.value.filter(c => c.count_empresas > 0)
);

function exportarCSV() {
  const rows = [
    ['Categoría', 'Empresas', 'Asignado', 'Gastado', 'Disponible', '% Consumido', 'Envíos totales', 'Envíos con costo']
  ];
  porCategoria.value.forEach(c => {
    rows.push([
      c.categoria_label, c.count_empresas, c.total_asignado, c.total_gastado,
      c.total_disponible, c.pct_consumido, c.num_envios, c.num_envios_con_costo
    ]);
  });
  rows.push([
    'TOTAL', totales.value.count_empresas, totales.value.total_asignado, totales.value.total_gastado,
    totales.value.total_disponible, totales.value.pct_consumido, totales.value.num_envios, totales.value.num_envios_con_costo
  ]);
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presupuesto-fideliz-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(cargar);
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <button @click="router.back()" class="text-sm text-text3 hover:text-text1 mb-3">← Volver</button>

    <header class="sv-card p-5 mb-4 border-l-4 border-area-emp">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="font-serif text-2xl text-text1">📊 Presupuesto de Fidelización por Categoría</h1>
          <p class="text-sm text-text3 mt-1">Vista gerencial del ROI por nivel (Bronce → Diamante).</p>
        </div>
        <div class="flex gap-2">
          <BaseButton variant="secondary" size="sm" @click="cargar" :disabled="cargando">↻ Refrescar</BaseButton>
          <BaseButton variant="primary" size="sm" @click="exportarCSV" :disabled="cargando || !porCategoria.length">📥 Exportar CSV</BaseButton>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="cargando" class="text-center py-12 text-text3">Cargando reporte…</div>

    <template v-else>
      <!-- Totales globales -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div class="sv-card p-4 border-l-4 border-area-emp">
          <div class="text-xs text-text3 uppercase tracking-wide">Empresas activas</div>
          <div class="text-2xl font-serif text-text1 mt-1">{{ totales.count_empresas || 0 }}</div>
        </div>
        <div class="sv-card p-4 border-l-4 border-gold">
          <div class="text-xs text-text3 uppercase tracking-wide">Presupuesto asignado</div>
          <div class="text-2xl font-serif text-text1 mt-1">{{ fmtMoneda(totales.total_asignado) }}</div>
        </div>
        <div class="sv-card p-4 border-l-4 border-danger">
          <div class="text-xs text-text3 uppercase tracking-wide">Gastado</div>
          <div class="text-2xl font-serif text-text1 mt-1">{{ fmtMoneda(totales.total_gastado) }}</div>
          <div class="text-xs text-text3">{{ totales.pct_consumido || 0 }}% del asignado</div>
        </div>
        <div class="sv-card p-4 border-l-4 border-sage">
          <div class="text-xs text-text3 uppercase tracking-wide">Disponible</div>
          <div class="text-2xl font-serif text-text1 mt-1">{{ fmtMoneda(totales.total_disponible) }}</div>
          <div class="text-xs text-text3">{{ totales.num_envios || 0 }} envíos realizados</div>
        </div>
      </div>

      <!-- Barras horizontales por categoría -->
      <section v-if="categoriasConDatos.length" class="sv-card p-5 mb-5">
        <h2 class="font-serif text-lg text-text1 mb-3">Presupuesto vs gasto por categoría</h2>
        <div class="space-y-4">
          <div v-for="c in categoriasConDatos" :key="c.categoria_label">
            <div class="flex items-center justify-between mb-1 text-sm">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ CAT_INFO[c.categoria]?.icono || '•' }}</span>
                <span class="font-semibold text-text1">{{ c.categoria_label }}</span>
                <span class="text-xs text-text3">({{ c.count_empresas }} empresas)</span>
              </div>
              <div class="text-xs text-text2">
                <span class="font-semibold">{{ c.pct_consumido }}%</span>
                <span class="text-text3"> consumido</span>
              </div>
            </div>
            <!-- Barra: total ancho = max asignado; verde = disponible, rojo = gastado -->
            <div class="relative h-6 bg-cream rounded-sv overflow-hidden"
                 :style="{ width: ((c.total_asignado / maxAsignado) * 100) + '%' }">
              <div class="absolute top-0 left-0 h-full bg-danger transition-all"
                   :style="{ width: c.pct_consumido + '%' }"></div>
            </div>
            <div class="flex items-center justify-between mt-1 text-xs text-text3">
              <span>Asignado: <strong class="text-text1">{{ fmtMoneda(c.total_asignado) }}</strong></span>
              <span>Gastado: <strong class="text-danger">{{ fmtMoneda(c.total_gastado) }}</strong></span>
              <span>Disponible: <strong class="text-sage">{{ fmtMoneda(c.total_disponible) }}</strong></span>
            </div>
          </div>
        </div>
      </section>

      <!-- Tabla completa (incluye categorías sin datos) -->
      <section class="sv-card overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-cream/60 text-text3 uppercase text-[10px] tracking-wider">
            <tr>
              <th class="px-3 py-2 text-left">Categoría</th>
              <th class="px-3 py-2 text-right">Empresas</th>
              <th class="px-3 py-2 text-right">Asignado</th>
              <th class="px-3 py-2 text-right">Gastado</th>
              <th class="px-3 py-2 text-right">Disponible</th>
              <th class="px-3 py-2 text-right">% Consumido</th>
              <th class="px-3 py-2 text-right">Envíos</th>
              <th class="px-3 py-2 text-right">Con costo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in porCategoria" :key="c.categoria_label"
                class="border-t border-text3/10 hover:bg-cream/30">
              <td class="px-3 py-2 font-semibold text-text1 whitespace-nowrap">
                {{ CAT_INFO[c.categoria]?.icono || '⚪' }} {{ c.categoria_label }}
              </td>
              <td class="px-3 py-2 text-right">{{ c.count_empresas }}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">{{ fmtMoneda(c.total_asignado) }}</td>
              <td class="px-3 py-2 text-right text-danger whitespace-nowrap">{{ fmtMoneda(c.total_gastado) }}</td>
              <td class="px-3 py-2 text-right text-sage whitespace-nowrap">{{ fmtMoneda(c.total_disponible) }}</td>
              <td class="px-3 py-2 text-right">{{ c.pct_consumido }}%</td>
              <td class="px-3 py-2 text-right">{{ c.num_envios }}</td>
              <td class="px-3 py-2 text-right text-text3">{{ c.num_envios_con_costo }}</td>
            </tr>
            <tr class="border-t-2 border-text3/30 font-semibold bg-cream/40">
              <td class="px-3 py-2 text-text1">TOTAL</td>
              <td class="px-3 py-2 text-right">{{ totales.count_empresas || 0 }}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">{{ fmtMoneda(totales.total_asignado) }}</td>
              <td class="px-3 py-2 text-right text-danger whitespace-nowrap">{{ fmtMoneda(totales.total_gastado) }}</td>
              <td class="px-3 py-2 text-right text-sage whitespace-nowrap">{{ fmtMoneda(totales.total_disponible) }}</td>
              <td class="px-3 py-2 text-right">{{ totales.pct_consumido || 0 }}%</td>
              <td class="px-3 py-2 text-right">{{ totales.num_envios || 0 }}</td>
              <td class="px-3 py-2 text-right text-text3">{{ totales.num_envios_con_costo || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <EmptyState v-if="!porCategoria.length"
                  titulo="Sin empresas con categoría asignada"
                  descripcion="Asigna categorías a las empresas desde la ficha para ver el reporte agregado." />
    </template>
  </div>
</template>
