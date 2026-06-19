<script setup>
/**
 * LiveEquipo.vue — vista del supervisor con la última posición conocida de
 * cada asesor del grupo/área. Refresh cada 30s.
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { trackingApi } from '@/api/trackingApi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
dayjs.extend(relativeTime);
dayjs.locale('es');

import BaseSelect from '@/components/ui/BaseSelect.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const auth = useAuthStore();
const { notify } = useApiError();

const grupoFiltro = ref('');  // '' = sin filtro (área activa)
const items = ref([]);
const mapEl = ref(null);
let mapInstance = null;
let layerMarkers = null;
let timer = null;

const COLOR_ESTADO = {
  activo:   '#6B8F6E',
  reciente: '#C8902A',
  sin_senal:'#B83227',
  inactivo: '#8A6A52'
};

const LABEL_ESTADO = {
  activo:    'Activo (últ. 5 min)',
  reciente:  'Reciente (5-15 min)',
  sin_senal: 'Sin señal (> 15 min)',
  inactivo:  'Inactivo (sin jornada)'
};

// Mapa de área activa → grupo principal
const opcGrupos = computed(() => {
  const area = auth.areaActual?.area_codigo;
  const grupos = [{ value: '', label: 'Todos los del área activa' }];
  if (area === 'PRENEC')   grupos.push({ value: '1', label: 'Telemercadeo' });
  if (area === 'PREV-EMP') grupos.push({ value: '2', label: 'Empresariales' });
  if (area === 'PREV-PAP') grupos.push({ value: '3', label: 'PAP — Campo' });
  return grupos;
});

async function cargarLeaflet() {
  if (window.L) return;
  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initMapa() {
  await cargarLeaflet();
  if (!mapEl.value || mapInstance) return;
  mapInstance = window.L.map(mapEl.value).setView([7.8939, -72.5078], 12);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(mapInstance);
  layerMarkers = window.L.layerGroup().addTo(mapInstance);
}

function dibujar() {
  if (!mapInstance) return;
  layerMarkers.clearLayers();
  const coords = [];
  for (const it of items.value) {
    if (!it.ultima_posicion) continue;
    const lat = it.ultima_posicion.lat, lng = it.ultima_posicion.lng;
    const color = COLOR_ESTADO[it.estado] || '#8A6A52';
    const minTras = Math.round((Date.now() - new Date(it.ultima_posicion.ts)) / 60000);
    const popup = `<div style="font-family:system-ui">
      <strong>${it.usuario.usr_nombre} ${it.usuario.usr_apellido}</strong><br/>
      <small style="color:${color}">● ${LABEL_ESTADO[it.estado]}</small><br/>
      <small>Hace ${minTras} min</small>
    </div>`;
    window.L.circleMarker([lat, lng], {
      radius: 10, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9
    }).bindPopup(popup).addTo(layerMarkers);
    coords.push([lat, lng]);
  }
  if (coords.length) mapInstance.fitBounds(coords, { padding: [60, 60], maxZoom: 14 });
}

async function cargar() {
  try {
    const params = {};
    if (grupoFiltro.value) params.grupo_id = grupoFiltro.value;
    else if (auth.areaActivaId) params.area_id = auth.areaActivaId;
    const r = await trackingApi.liveEquipo(params);
    items.value = r.data;
    dibujar();
  } catch (e) { notify(e); }
}

onMounted(async () => {
  await initMapa();
  await cargar();
  timer = setInterval(cargar, 30000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
});

watch(grupoFiltro, cargar);

const totalActivos = computed(() => items.value.filter(i => i.estado === 'activo').length);
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-4">
      <div>
        <h1 class="font-serif text-2xl text-brown-deep">🛰️ Equipo en vivo</h1>
        <p class="text-sm text-text2 mt-1">
          {{ totalActivos }} asesor{{ totalActivos === 1 ? '' : 'es' }} activo{{ totalActivos === 1 ? '' : 's' }} ahora ·
          actualización automática cada 30s
        </p>
      </div>
      <BaseSelect v-model="grupoFiltro" :options="opcGrupos" label="Grupo" class="min-w-[240px]" />
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="sv-card overflow-hidden lg:col-span-2">
        <div ref="mapEl" class="w-full h-[65vh] min-h-[400px] bg-cream"></div>
      </div>

      <aside class="sv-card p-4">
        <h3 class="font-serif text-base text-brown-deep border-b border-text3/10 pb-2 mb-3">
          Equipo ({{ items.length }})
        </h3>
        <EmptyState v-if="!items.length" titulo="Sin datos" size="sm" />
        <div v-for="it in items" :key="it.usuario.usr_id"
             class="flex items-center gap-3 py-2 border-b border-text3/5 last:border-0">
          <span class="w-3 h-3 rounded-full shrink-0"
                :style="`background-color:${COLOR_ESTADO[it.estado]}`"
                :title="LABEL_ESTADO[it.estado]"></span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-text1 truncate">
              {{ it.usuario.usr_nombre }} {{ it.usuario.usr_apellido }}
            </div>
            <div class="text-xs text-text3">
              <template v-if="it.ultima_posicion">
                Hace {{ dayjs(it.ultima_posicion.ts).fromNow(true) }}
                <span v-if="it.jornada_activa"> · {{ it.jornada_activa.jor_puntos_total }} puntos</span>
              </template>
              <template v-else>
                Sin reporte hoy
              </template>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
