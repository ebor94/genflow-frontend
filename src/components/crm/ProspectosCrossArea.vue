<script setup>
/**
 * ProspectosCrossArea.vue
 * Muestra lista compacta de prospectos activos del cliente en otras áreas.
 * Sirve como warning cuando se detecta duplicado al crear nuevo prospecto,
 * y como sección informativa en fichas.
 */
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { fmtRelativo } from '@/utils/format';
import { abrirProspecto } from '@/utils/abrirProspecto';
import AreaBadge from '@/components/common/AreaBadge.vue';
import StatusPill from '@/components/common/StatusPill.vue';

const router = useRouter();
const auth = useAuthStore();

const props = defineProps({
  prospectos: { type: Array, required: true },
  // Si se pasa, oculta prospectos del área indicada (para no mostrar el "propio")
  ocultarAreaId: { type: Number, default: null },
  tono: { type: String, default: 'warning' }   // warning | info
});

const emit = defineEmits(['abrir']);

function visibles() {
  if (!props.ocultarAreaId) return props.prospectos;
  return props.prospectos.filter(p => p.prosp_area_id !== props.ocultarAreaId);
}

function ir(p) {
  emit('abrir', p);
  abrirProspecto(router, p);
}
</script>

<template>
  <div v-if="visibles().length" class="sv-card border p-4"
       :class="tono === 'warning' ? 'border-warning/40 bg-warning/5' : 'border-area-emp/30 bg-area-emp/5'">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-lg">{{ tono === 'warning' ? '⚠️' : 'ℹ️' }}</span>
      <h4 class="font-semibold text-text1">
        Este cliente ya tiene actividad en otras áreas
      </h4>
    </div>
    <p class="text-xs text-text3 mb-3">
      Antes de crear un nuevo prospecto, considera si debería gestionarse desde donde ya está activo.
    </p>

    <ul class="space-y-2">
      <li v-for="p in visibles()" :key="p.prosp_id"
          @click="ir(p)"
          class="sv-card p-3 bg-white border border-text3/15 cursor-pointer hover:shadow-sv-pop transition-shadow flex items-center gap-3">
        <AreaBadge v-if="p.area"
                   :codigo="p.area.area_codigo"
                   :nombre="p.area.area_codigo"
                   :icono="p.area.area_icono"
                   :color-hex="p.area.area_color_hex"
                   size="sm" />
        <div class="flex-1 min-w-0">
          <div class="text-xs text-text3">
            {{ p.grupo?.grupo_nombre || '' }}
            <span v-if="p.prosp_subproceso" class="ml-1">
              · {{ p.prosp_subproceso === 'recuperacion' ? '♻️ recuperación' : '🆕 nuevo' }}
            </span>
          </div>
          <div class="text-sm font-semibold text-text1 truncate">
            {{ p.asesor?.usr_nombre }} {{ p.asesor?.usr_apellido }}
          </div>
          <div class="text-xs text-text3 flex gap-2 items-center mt-1 flex-wrap">
            <StatusPill v-if="p.estado" :label="p.estado.estado_nombre" :color-hex="p.estado.estado_color_hex || '#8A6A52'" />
            <span v-if="p.empresa"     class="text-text2">{{ p.empresa.empresa_razon_social }}</span>
            <span class="ml-auto">{{ fmtRelativo(p.prosp_updated_at) }}</span>
          </div>
        </div>
        <span class="text-text3 text-xs">→</span>
      </li>
    </ul>
  </div>
</template>
