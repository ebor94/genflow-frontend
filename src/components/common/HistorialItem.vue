<script setup>
/**
 * HistorialItem.vue — item de timeline de gestión inmutable.
 */
import { computed } from 'vue';
import { fmtFechaHora, fmtRelativo } from '@/utils/format';

const props = defineProps({ gestion: { type: Object, required: true } });

const color = computed(() => {
  const r = props.gestion.resultado;
  if (!r) return '#8A6A52';
  return r.resultado_es_positivo ? '#2A6E47' : '#B83227';
});

const iconoCanal = computed(() => ({
  llamada: '📞', presencial: '🤝', correo: '✉️'
}[props.gestion.gest_canal] || '📝'));
</script>

<template>
  <div class="relative pl-8 pb-5 border-l-2"
       :style="`border-left-color: ${color}33`">
    <div class="absolute -left-2 top-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-white border-2"
         :style="`border-color: ${color}; color: ${color}`">
      {{ iconoCanal }}
    </div>
    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span class="font-semibold text-text1">{{ gestion.resultado?.resultado_nombre || 'Gestión' }}</span>
      <span v-if="gestion.estadoNuevo" class="text-xs px-2 py-0.5 rounded-full"
            :style="`background:${gestion.estadoNuevo.estado_color_hex}1f; color:${gestion.estadoNuevo.estado_color_hex}`">
        → {{ gestion.estadoNuevo.estado_nombre }}
      </span>
      <span class="text-xs text-text3 ml-auto" :title="fmtFechaHora(gestion.gest_fecha_hora)">
        {{ fmtRelativo(gestion.gest_fecha_hora) }}
      </span>
    </div>
    <p v-if="gestion.gest_comentario" class="text-sm text-text2 mt-1 whitespace-pre-line">{{ gestion.gest_comentario }}</p>
    <div class="text-xs text-text3 mt-1 flex items-center gap-2">
      <span v-if="gestion.asesor">por {{ gestion.asesor.usr_nombre }} {{ gestion.asesor.usr_apellido }}</span>
      <span v-if="gestion.gest_duracion_seg">· {{ Math.floor(gestion.gest_duracion_seg / 60) }}m {{ gestion.gest_duracion_seg % 60 }}s</span>
      <span v-if="gestion.gest_prox_fecha">· próx: {{ gestion.gest_prox_fecha }} {{ gestion.gest_prox_hora?.slice(0,5) || '' }}</span>
    </div>
  </div>
</template>
