<script setup>
/**
 * CumpleCard.vue — tarjeta de evento próximo en Panel Fidelización.
 *
 * Props.evento = {
 *   persona: { persona_nombre, persona_apellido, persona_telefono_principal, persona_genero, ... },
 *   empresa: { empresa_razon_social, empresa_nit, empresa_id },
 *   cargo, tipo, descripcion, fecha_evento, evento_anio, dias_restantes,
 *   envio_existente: null | { env_id, env_estado, env_fecha_envio }
 * }
 */
defineProps({
  evento: { type: Object, required: true }
});
defineEmits(['registrar', 'llamar']);

const ICONOS_TIPO = {
  nacimiento:           '🎂',
  aniversario_laboral:  '💼',
  aniversario_boda:     '💍',
  dia_madre:            '💐',
  dia_padre:            '👔',
  otro:                 '🎉'
};

function iniciales(p) {
  const n = p.persona_nombre?.[0] || '';
  const a = p.persona_apellido?.[0] || '';
  return (n + a).toUpperCase() || '?';
}

function colorUrgencia(dias) {
  if (dias <= 0) return 'bg-danger text-white';     // HOY
  if (dias === 1) return 'bg-warning text-white';   // mañana
  return 'bg-gold/20 text-gold';
}

function textoDias(dias) {
  if (dias === 0) return 'HOY';
  if (dias === 1) return 'MAÑANA';
  return `en ${dias} días`;
}
</script>

<template>
  <article class="sv-card p-4 flex items-center gap-3"
           :class="evento.envio_existente ? 'opacity-60' : ''">
    <!-- Avatar -->
    <div class="w-12 h-12 rounded-full bg-gold/20 text-gold flex items-center justify-center font-semibold text-sm shrink-0">
      {{ iniciales(evento.persona) }}
    </div>

    <!-- Cuerpo -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="text-lg">{{ ICONOS_TIPO[evento.tipo] || '🎉' }}</span>
        <span class="font-semibold text-text1 truncate">
          {{ evento.persona.persona_nombre }} {{ evento.persona.persona_apellido }}
        </span>
      </div>
      <div class="text-xs text-text2 truncate">
        {{ evento.cargo || 'Contacto' }} · {{ evento.empresa.empresa_razon_social }}
      </div>
      <div class="text-xs text-text3 mt-1">
        {{ evento.descripcion }} · {{ evento.fecha_evento }}
      </div>

      <!-- Envío existente -->
      <div v-if="evento.envio_existente" class="mt-2 text-xs text-sage">
        ✓ Ya enviado · {{ evento.envio_existente.env_estado }}
      </div>
    </div>

    <!-- Chip + acciones -->
    <div class="flex flex-col items-end gap-2 shrink-0">
      <span class="px-2 py-1 rounded-full text-xs font-semibold"
            :class="colorUrgencia(evento.dias_restantes)">
        {{ textoDias(evento.dias_restantes) }}
      </span>

      <div class="flex gap-1" v-if="!evento.envio_existente">
        <button class="p-1.5 rounded-sv bg-sage/20 hover:bg-sage/30 text-sage"
                @click="$emit('llamar', evento)" title="Llamar">
          📞
        </button>
        <button class="px-2 py-1 rounded-sv bg-gold text-white text-xs font-semibold hover:bg-gold-bright"
                @click="$emit('registrar', evento)" title="Registrar envío">
          + Envío
        </button>
      </div>
    </div>
  </article>
</template>
