<script setup>
/**
 * PipelineVisual.vue — visualización horizontal del pipeline de un grupo.
 * Props:
 *   - estados: [{ estado_id, estado_nombre, estado_orden, estado_color_hex, estado_es_final, estado_es_ganado }]
 *   - estadoActualId: number (se acepta también string, se normaliza)
 *
 * Estados visuales:
 *   - pasado: ya superado → fondo claro + ✓
 *   - actual: estado normal en curso → fondo del color + número
 *   - actual_ganado: el prospecto está en estado final ganado → fondo verde sage + ✓
 *   - actual_perdido: el prospecto está en estado final no ganado → fondo rojo + ✗
 *   - futuro: aún por alcanzar → blanco con borde gris
 */
import { computed } from 'vue';

const props = defineProps({
  estados: { type: Array, required: true },
  estadoActualId: { type: [Number, String], default: null }
});

const ordenados = computed(() =>
  [...props.estados].sort((a, b) => a.estado_orden - b.estado_orden)
);

// Normalizar a número para evitar mismatches string vs number
const actualId = computed(() => props.estadoActualId != null ? parseInt(props.estadoActualId) : null);

const indiceActual = computed(() =>
  ordenados.value.findIndex(e => parseInt(e.estado_id) === actualId.value)
);

function estadoStatus(idx, estado) {
  if (idx === indiceActual.value) {
    if (estado.estado_es_final && estado.estado_es_ganado) return 'actual_ganado';
    if (estado.estado_es_final && !estado.estado_es_ganado) return 'actual_perdido';
    return 'actual';
  }
  if (idx < indiceActual.value) return 'pasado';
  return 'futuro';
}

function bg(status, estado) {
  switch (status) {
    case 'actual_ganado':  return 'background:#6B8F6E; border-color:#6B8F6E; color:#fff';
    case 'actual_perdido': return 'background:#B83227; border-color:#B83227; color:#fff';
    case 'actual':         return `background:${estado.estado_color_hex}; border-color:${estado.estado_color_hex}; color:#fff`;
    case 'pasado':         return `background:${estado.estado_color_hex}33; border-color:${estado.estado_color_hex}; color:${estado.estado_color_hex}`;
    default:               return 'background:#fff; border-color:#8A6A5240; color:#8A6A52';
  }
}

function icono(status, idx) {
  if (status === 'pasado')         return '✓';
  if (status === 'actual_ganado')  return '✓';
  if (status === 'actual_perdido') return '✗';
  return idx + 1;
}

function esResaltado(status) {
  return status === 'actual' || status === 'actual_ganado' || status === 'actual_perdido';
}
</script>

<template>
  <div class="overflow-x-auto">
    <div class="flex items-center gap-2 min-w-max py-3">
      <template v-for="(e, i) in ordenados" :key="e.estado_id">
        <div class="flex flex-col items-center min-w-[120px] flex-1">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
               :style="bg(estadoStatus(i, e), e)">
            {{ icono(estadoStatus(i, e), i) }}
          </div>
          <div class="text-[11px] mt-1 text-center max-w-[100px]"
               :class="esResaltado(estadoStatus(i, e)) ? 'font-bold text-text1' : 'text-text3'">
            {{ e.estado_nombre }}
          </div>
        </div>
        <div v-if="i < ordenados.length - 1"
             class="flex-1 h-0.5 mb-6 transition-colors"
             :style="i < indiceActual ? `background:${e.estado_color_hex}` : 'background:#8A6A5240'"></div>
      </template>
    </div>
  </div>
</template>
