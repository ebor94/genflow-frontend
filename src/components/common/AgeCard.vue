<script setup>
/**
 * AgeCard.vue — tarjeta de gestión en agenda
 * Props: prospecto (con persona/estado), onLlamar, onAbrir
 */
import { computed } from 'vue';
import { useAgenda } from '@/composables/useAgenda';
import { useTelefono } from '@/composables/useTelefono';
import StatusPill from './StatusPill.vue';

const props = defineProps({
  prospecto: { type: Object, required: true }
});
const emit = defineEmits(['abrir', 'llamar']);

const { urgencia, colorUrgencia } = useAgenda();
const { formato, linkTel } = useTelefono();

const u = computed(() => urgencia(props.prospecto.prosp_prox_gestion_fecha));
const color = computed(() => colorUrgencia(u.value));
const hora = computed(() => props.prospecto.prosp_prox_gestion_hora?.slice(0, 5) || '—');
const p = computed(() => props.prospecto.persona);
</script>

<template>
  <div class="sv-card p-3 flex items-center gap-3 border-l-4 hover:shadow-sv-pop transition-shadow cursor-pointer"
       :style="`border-left-color: ${color}`"
       @click="emit('abrir', prospecto)">
    <div class="text-xs text-text3 font-semibold min-w-[40px]">{{ hora }}</div>
    <div class="flex-1 min-w-0">
      <div class="font-semibold text-text1 truncate">
        {{ p?.persona_nombre }} {{ p?.persona_apellido || '' }}
      </div>
      <div class="text-xs text-text3 flex items-center gap-2 mt-0.5">
        <span>{{ formato(p?.persona_telefono_principal) }}</span>
        <span v-if="prospecto.estado">·</span>
        <StatusPill v-if="prospecto.estado"
                    :label="prospecto.estado.estado_nombre"
                    :color-hex="prospecto.estado.estado_color_hex || color" />
      </div>
    </div>
    <a :href="linkTel(p?.persona_telefono_principal)"
       @click.stop
       class="sv-btn-secondary py-1 px-3 text-xs">
      📞
    </a>
  </div>
</template>
