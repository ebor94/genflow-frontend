<script setup>
/**
 * HistorialClienteCompleto.vue — vista 360° del cliente cross-área.
 * Solo visible a SUPERVISOR+ (nivelMaximo:3 en el router).
 * Muestra:
 *   - Datos persona
 *   - Resumen de prospectos por área (cards)
 *   - Timeline unificado de TODAS las gestiones cross-área con filtros
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApiError } from '@/composables/useApiError';
import { useTelefono } from '@/composables/useTelefono';
import { personasApi } from '@/api/personasApi';
import { fmtFechaHora, fmtRelativo } from '@/utils/format';

import AreaBadge from '@/components/common/AreaBadge.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import FilterChips from '@/components/common/FilterChips.vue';

const route  = useRoute();
const router = useRouter();
const { notify } = useApiError();
const { formato } = useTelefono();

const data = ref(null);
const loading = ref(false);
const filtroArea = ref('');

async function cargar() {
  loading.value = true;
  try {
    const r = await personasApi.historialCompleto(parseInt(route.params.personaId));
    data.value = r.data;
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(cargar);
watch(() => route.params.personaId, cargar);

const persona = computed(() => data.value?.persona);
const prospectos = computed(() => data.value?.prospectos || []);
const gestiones = computed(() => data.value?.gestiones || []);

const areasConActividad = computed(() => {
  const set = new Map();
  for (const p of prospectos.value) {
    if (p.area) set.set(p.area.area_codigo, p.area);
  }
  return [...set.values()];
});

const filtrosAreaChips = computed(() => [
  { value: '', label: `Todas (${gestiones.value.length})` },
  ...areasConActividad.value.map(a => ({
    value: a.area_codigo,
    label: `${a.area_icono || ''} ${a.area_codigo}`,
    count: gestiones.value.filter(g => g.prospecto?.area?.area_codigo === a.area_codigo).length
  })).map(c => ({ ...c, label: `${c.label} (${c.count})` }))
]);

const gestionesVisibles = computed(() => {
  if (!filtroArea.value) return gestiones.value;
  return gestiones.value.filter(g => g.prospecto?.area?.area_codigo === filtroArea.value);
});

function iniciales(p) {
  return `${(p?.persona_nombre || '?').charAt(0)}${(p?.persona_apellido || '').charAt(0)}`.toUpperCase();
}

function colorCanal(canal) {
  return { llamada: '📞', presencial: '🤝', correo: '✉️' }[canal] || '📝';
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <button @click="router.back()" class="text-sm text-text3 hover:text-text1 mb-3">← Volver</button>

    <div v-if="loading" class="text-text3 text-center py-12">Cargando historial completo...</div>

    <template v-else-if="persona">
      <!-- Header persona -->
      <header class="sv-card p-5 mb-5">
        <div class="flex items-start gap-4">
          <div class="w-16 h-16 rounded-full bg-gold text-brown-deep font-bold flex items-center justify-center text-xl">
            {{ iniciales(persona) }}
          </div>
          <div class="flex-1">
            <h1 class="font-serif text-2xl text-brown-deep">
              {{ persona.persona_nombre }} {{ persona.persona_apellido || '' }}
            </h1>
            <p class="text-sm text-text2">{{ formato(persona.persona_telefono_principal) }} · {{ persona.persona_email || 'sin email' }}</p>
            <p class="text-xs text-text3 mt-1">
              {{ data.total_prospectos }} prospecto(s) ·
              {{ data.total_gestiones }} gestión(es) ·
              {{ data.areas_con_actividad.length }} área(s) con actividad
            </p>
          </div>
        </div>
      </header>

      <!-- Cards por área con resumen -->
      <section v-if="prospectos.length" class="mb-6">
        <h2 class="font-serif text-xl text-brown-deep mb-3">Prospectos por área</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div v-for="p in prospectos" :key="p.prosp_id" class="sv-card p-4 border-l-4"
               :style="`border-left-color: ${p.area?.area_color_hex || '#8A6A52'}`">
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <AreaBadge v-if="p.area"
                         :codigo="p.area.area_codigo" :nombre="p.area.area_nombre"
                         :icono="p.area.area_icono" :color-hex="p.area.area_color_hex" size="sm" />
              <span v-if="p.prosp_subproceso" class="text-[10px] px-1.5 py-0.5 rounded-full bg-brown-warm/15 text-brown-warm">
                {{ p.prosp_subproceso === 'recuperacion' ? '♻️ recuperación' : '🆕 nuevo' }}
              </span>
            </div>
            <div class="text-xs text-text3 mb-1">Grupo: {{ p.grupo?.grupo_nombre }}</div>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <StatusPill v-if="p.estado" :label="p.estado.estado_nombre" :color-hex="p.estado.estado_color_hex || '#8A6A52'" />
              <span class="text-xs text-text2">Asesor: <strong>{{ p.asesor?.usr_nombre }} {{ p.asesor?.usr_apellido }}</strong></span>
            </div>
            <div v-if="p.empresa" class="text-xs text-text3 mt-1">Empresa: {{ p.empresa.empresa_razon_social }}</div>
            <div v-if="p.prosp_prox_gestion_fecha" class="text-xs text-text3 mt-1">
              📅 Próx: {{ p.prosp_prox_gestion_fecha }} {{ p.prosp_prox_gestion_hora?.slice(0,5) || '' }}
            </div>
          </div>
        </div>
      </section>

      <!-- Timeline cross-área -->
      <section>
        <div class="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 class="font-serif text-xl text-brown-deep">
            Historial cronológico
            <span class="text-sm text-text3 font-sans">({{ gestionesVisibles.length }})</span>
          </h2>
        </div>

        <FilterChips v-model="filtroArea" :options="filtrosAreaChips" class="mb-4" />

        <EmptyState v-if="!gestionesVisibles.length" titulo="Sin gestiones para este filtro" icono="📭" />

        <div v-else class="space-y-0">
          <div v-for="g in gestionesVisibles" :key="g.gest_id"
               class="relative pl-10 pb-5 border-l-2"
               :style="`border-left-color: ${g.prospecto?.area?.area_color_hex || '#8A6A52'}33`">
            <div class="absolute -left-3 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs bg-white border-2"
                 :style="`border-color: ${g.prospecto?.area?.area_color_hex || '#8A6A52'}`">
              {{ colorCanal(g.gest_canal) }}
            </div>
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <AreaBadge v-if="g.prospecto?.area"
                         :codigo="g.prospecto.area.area_codigo"
                         :nombre="g.prospecto.area.area_codigo"
                         :color-hex="g.prospecto.area.area_color_hex"
                         size="sm" />
              <span class="font-semibold text-text1">{{ g.resultado?.resultado_nombre || 'Gestión' }}</span>
              <span v-if="g.estadoNuevo" class="text-xs px-2 py-0.5 rounded-full"
                    :style="`background:${g.estadoNuevo.estado_color_hex}1f; color:${g.estadoNuevo.estado_color_hex}`">
                → {{ g.estadoNuevo.estado_nombre }}
              </span>
              <span class="text-xs text-text3 ml-auto" :title="fmtFechaHora(g.gest_fecha_hora)">
                {{ fmtRelativo(g.gest_fecha_hora) }}
              </span>
            </div>
            <p v-if="g.gest_comentario" class="text-sm text-text2 mt-1 whitespace-pre-line">{{ g.gest_comentario }}</p>
            <div class="text-xs text-text3 mt-1">
              por <strong>{{ g.asesor?.usr_nombre }} {{ g.asesor?.usr_apellido }}</strong>
              <span v-if="g.gest_duracion_seg"> · {{ Math.floor(g.gest_duracion_seg / 60) }}m {{ g.gest_duracion_seg % 60 }}s</span>
              <span v-if="g.gest_prox_fecha"> · próx: {{ g.gest_prox_fecha }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>

    <EmptyState v-else titulo="Cliente no encontrado" />
  </div>
</template>
