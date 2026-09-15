<template>
  <div class="overflow-x-auto">
    <div class="min-w-[900px]">
      <div class="grid grid-cols-7 gap-2">
        <div v-for="(dia, key) in dias" :key="key"
             class="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col min-h-[240px]">
          <div class="px-3 py-2 border-b bg-slate-50 text-xs">
            <div class="font-semibold text-slate-700">{{ etiqueta(key) }}</div>
            <div class="text-slate-400">{{ formatFecha(key) }}</div>
          </div>
          <div class="p-2 space-y-1.5 flex-1 overflow-y-auto max-h-[400px]">
            <RouterLink v-for="ev in dia.eventos" :key="ev.evento_id"
                        :to="{ name: 'evento-detalle', params: { id: ev.evento_id }}"
                        class="block px-2 py-1.5 rounded border border-green-200 bg-green-50 hover:bg-green-100 text-xs">
              <div class="font-medium text-slate-800 truncate">{{ ev.evento_titulo }}</div>
              <div class="text-slate-500 text-[10px] uppercase mt-0.5">{{ ev.evento_tipo }}</div>
              <div class="text-slate-400 text-[10px]">{{ hora(ev.evento_fecha_hora) }}</div>
            </RouterLink>
            <div v-for="g in dia.gestiones" :key="'g-'+g.prosp_id"
                 class="block px-2 py-1.5 rounded border border-slate-200 bg-slate-50 text-xs">
              <div class="font-medium text-slate-700 truncate">
                {{ g.persona?.persona_nombre || '' }} {{ g.persona?.persona_apellido || '' }}
              </div>
              <div class="text-slate-400 text-[10px]">Gestión · {{ g.prosp_prox_gestion_hora?.slice(0,5) || '' }}</div>
            </div>
            <div v-if="!dia.eventos.length && !dia.gestiones.length"
                 class="text-xs text-slate-300 text-center py-6">—</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps({ semanaData: { type: Object, required: true } });

const dias = computed(() => props.semanaData?.por_dia || {});

const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function etiqueta(fechaKey) {
  const d = new Date(`${fechaKey}T12:00:00`);
  return DIAS_SEMANA[(d.getDay() + 6) % 7];
}
function formatFecha(fechaKey) {
  const d = new Date(`${fechaKey}T12:00:00`);
  return d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short' });
}
function hora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
}
</script>
