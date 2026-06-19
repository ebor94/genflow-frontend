<script setup>
/**
 * KanbanColumn.vue — columna draggable de Kanban.
 * Props: estado, prospectos
 * Emit: drop (prospId, nuevoEstadoId)
 */
import { ref } from 'vue';
const props = defineProps({
  estado: { type: Object, required: true },
  prospectos: { type: Array, default: () => [] }
});
const emit = defineEmits(['drop', 'cardClick']);
const overEl = ref(false);

function onDragStart(e, p) {
  e.dataTransfer.setData('text/plain', String(p.prosp_id));
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) { e.preventDefault(); overEl.value = true; }
function onDragLeave()  { overEl.value = false; }
function onDrop(e) {
  e.preventDefault();
  overEl.value = false;
  const prospId = parseInt(e.dataTransfer.getData('text/plain'));
  if (prospId && prospId > 0) emit('drop', prospId, props.estado.estado_id);
}
</script>

<template>
  <div class="flex flex-col min-w-[280px] max-w-[280px] sv-card overflow-hidden"
       @dragover.prevent="onDragOver" @dragleave="onDragLeave" @drop="onDrop"
       :class="{ 'ring-2 ring-gold': overEl }">
    <header class="px-3 py-2 border-b border-text3/10"
            :style="`background:${estado.estado_color_hex}11; border-top: 3px solid ${estado.estado_color_hex}`">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-text1">{{ estado.estado_nombre }}</h3>
        <span class="text-xs text-text3">{{ prospectos.length }}</span>
      </div>
    </header>
    <ul class="flex-1 p-2 space-y-2 min-h-[200px] overflow-y-auto max-h-[600px]">
      <li v-for="p in prospectos" :key="p.prosp_id"
          draggable="true" @dragstart="(e) => onDragStart(e, p)"
          @click="$emit('cardClick', p)"
          class="sv-card p-2 cursor-grab active:cursor-grabbing hover:shadow-sv-pop transition-shadow">
        <div class="font-semibold text-sm text-text1 truncate">
          {{ p.empresa?.empresa_razon_social || p.persona?.persona_nombre }}
        </div>
        <div v-if="p.empresa" class="text-[10px] text-text3 mt-0.5">NIT: {{ p.empresa.empresa_nit }}</div>
        <div v-if="p.contacto" class="text-[11px] text-text2 mt-1">👤 {{ p.contacto.persona_nombre }} {{ p.contacto.persona_apellido }}</div>
        <div v-if="p.asesor" class="text-[10px] text-text3 mt-1">{{ p.asesor.usr_nombre }} {{ p.asesor.usr_apellido }}</div>
      </li>
      <li v-if="!prospectos.length" class="text-center py-6 text-text3 text-xs">Vacío</li>
    </ul>
  </div>
</template>
