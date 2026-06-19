<script setup>
/**
 * MapaZona.vue — mapa Leaflet de las visitas del día.
 * Carga Leaflet desde CDN (sin agregar dependencias npm).
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { papApi } from '@/api/papApi';
import { usuariosApi } from '@/api/usuariosApi';

import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const auth = useAuthStore();
const { notify } = useApiError();

// Rango de fechas: default hoy → hoy
const hoyISO = new Date().toISOString().slice(0, 10);
const desde = ref(hoyISO);
const hasta = ref(hoyISO);
const visitas = ref([]);
const loading = ref(false);
const mapaListo = ref(false);
const mapEl = ref(null);
let mapInstance = null;
let layerMarkers = null;

// Presets de rango
const PRESETS = [
  { label: 'Hoy',       dias: 0  },
  { label: '7 días',    dias: 6  },
  { label: '30 días',   dias: 29 },
  { label: 'Trimestre', dias: 89 }
];

function aplicarPreset(dias) {
  const hoy = new Date();
  const desdeDate = new Date(hoy.getTime() - dias * 86400000);
  desde.value = desdeDate.toISOString().slice(0, 10);
  hasta.value = hoy.toISOString().slice(0, 10);
}

const rangoLabel = computed(() => {
  if (desde.value === hasta.value) return desde.value;
  return `${desde.value} → ${hasta.value}`;
});

// Selector de asesor (supervisores/admin)
const puedeVerEquipo = computed(() => auth.rolNivel <= 3 || auth.rolCodigo === 'GERENTE_GENERAL');
const asesoresPap = ref([]);
const asesorFiltro = ref(''); // '' = todo el equipo, número = un asesor específico

const opcAsesores = computed(() => [
  { value: '', label: '👥 Todo el equipo PAP' },
  ...asesoresPap.value.map(u => ({
    value: String(u.usr_id),
    label: `${u.usr_nombre} ${u.usr_apellido || ''}`.trim()
  }))
]);

async function cargarAsesores() {
  if (!puedeVerEquipo.value) return;
  try {
    const r = await usuariosApi.list({ grupo_id: 3, activo: 1, limit: 100 });
    asesoresPap.value = (r.data?.items || r.data || [])
      .filter(u => u.rol?.rol_codigo === 'ASESOR');
  } catch (e) { /* silencioso */ }
}

const COLOR_RESULTADO = {
  'AFILIADO_HOY':  '#2A6E47',
  'INTERESADO':    '#C8902A',
  'VOLVER':        '#1A5C8A',
  'NO_INTERESADO': '#B83227',
  'SIN_RESPUESTA': '#8A6A52'
};

async function cargarLeaflet() {
  if (window.L) return;
  // CSS
  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }
  // JS
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    s.crossOrigin = '';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initMapa() {
  await cargarLeaflet();
  if (!mapEl.value) return;
  mapInstance = window.L.map(mapEl.value).setView([7.8939, -72.5078], 13); // Cúcuta
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(mapInstance);
  layerMarkers = window.L.layerGroup().addTo(mapInstance);
  mapaListo.value = true;
  dibujarMarkers();
}

function dibujarMarkers() {
  if (!mapInstance || !layerMarkers) return;
  layerMarkers.clearLayers();
  const coords = [];
  for (const v of visitas.value) {
    if (!v.gest_ubicacion_lat || !v.gest_ubicacion_lng) continue;
    const lat = parseFloat(v.gest_ubicacion_lat);
    const lng = parseFloat(v.gest_ubicacion_lng);
    const color = COLOR_RESULTADO[v.resultado?.resultado_codigo] || '#8A6A52';
    const persona = v.prospecto?.persona;
    const popup = `
      <div style="font-family:system-ui">
        <strong>${persona?.persona_nombre || ''} ${persona?.persona_apellido || ''}</strong><br/>
        <small>${v.prospecto?.prosp_zona_pap || ''}</small><br/>
        <span style="color:${color};font-weight:bold">${v.resultado?.resultado_icono || ''} ${v.resultado?.resultado_nombre || ''}</span><br/>
        <small>${new Date(v.gest_fecha_hora).toLocaleTimeString('es-CO')}</small>
      </div>`;
    const marker = window.L.circleMarker([lat, lng], {
      radius: 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.85
    }).bindPopup(popup);
    marker.addTo(layerMarkers);
    coords.push([lat, lng]);
  }
  if (coords.length) {
    mapInstance.fitBounds(coords, { padding: [40, 40] });
  }
}

async function cargar() {
  if (desde.value > hasta.value) {
    notify(new Error('La fecha "Desde" no puede ser mayor que "Hasta"'));
    return;
  }
  loading.value = true;
  try {
    const params = { desde: desde.value, hasta: hasta.value };
    if (asesorFiltro.value) params.asesor_id = asesorFiltro.value;
    const r = await papApi.mapa(params);
    visitas.value = r.data;
    if (mapaListo.value) dibujarMarkers();
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(async () => {
  await initMapa();
  await cargarAsesores();
  await cargar();
});

onUnmounted(() => {
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
});

watch([desde, hasta, asesorFiltro], cargar);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="mb-4">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h1 class="font-serif text-3xl text-brown-deep">Mapa de visitas</h1>
        <div class="flex items-end gap-2 flex-wrap">
          <BaseSelect v-if="puedeVerEquipo"
                      v-model="asesorFiltro"
                      :options="opcAsesores"
                      label="Asesor"
                      class="min-w-[220px]" />
          <BaseInput v-model="desde" type="date" label="Desde" class="max-w-[180px]" />
          <BaseInput v-model="hasta" type="date" label="Hasta" class="max-w-[180px]" />
          <BaseButton variant="secondary" size="sm" @click="cargar" title="Refrescar">↻</BaseButton>
        </div>
      </div>

      <!-- Presets rápidos -->
      <div class="flex items-center gap-2 flex-wrap text-xs">
        <span class="text-text3">Rango rápido:</span>
        <button v-for="p in PRESETS" :key="p.label"
                @click="aplicarPreset(p.dias)"
                class="px-3 py-1 rounded-full border border-text3/20 hover:border-area-pap hover:text-area-pap transition-colors text-text2 font-semibold">
          {{ p.label }}
        </button>
        <span class="ml-2 text-text3 italic">Mostrando: {{ rangoLabel }}</span>
      </div>
    </header>

    <div class="sv-card overflow-hidden">
      <div ref="mapEl" class="w-full h-[60vh] min-h-[400px] bg-cream"></div>
      <div v-if="loading" class="text-center py-3 text-text3 text-sm">Cargando...</div>
      <div v-else-if="!visitas.length" class="text-center py-3 text-text3 text-sm">
        Sin visitas con geolocalización en el rango {{ rangoLabel }}.
      </div>
      <div v-else class="px-4 py-2 text-xs text-text3 border-t border-text3/10 flex flex-wrap gap-3">
        <span><span class="inline-block w-3 h-3 rounded-full bg-sage mr-1"></span>Afiliadas</span>
        <span><span class="inline-block w-3 h-3 rounded-full bg-gold mr-1"></span>Interesadas</span>
        <span><span class="inline-block w-3 h-3 rounded-full bg-area-emp mr-1"></span>Volver</span>
        <span><span class="inline-block w-3 h-3 rounded-full bg-danger mr-1"></span>No interesadas</span>
        <span class="ml-auto"><strong>{{ visitas.length }}</strong> visitas geo-localizadas</span>
      </div>
    </div>
  </div>
</template>
