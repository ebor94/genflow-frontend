<script setup>
/**
 * RecorridoAsesor.vue — vista de supervisor (o el propio asesor) que muestra
 * el recorrido GPS de una jornada sobre el mapa Leaflet:
 *  - Polilínea oro con los puntos.
 *  - Markers verdes en cada gestión registrada ese día.
 *  - Marker inicio (verde) y fin (rojo).
 *  - Sidebar con stats.
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { trackingApi } from '@/api/trackingApi';
import { usuariosApi } from '@/api/usuariosApi';
import dayjs from 'dayjs';

import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { notify } = useApiError();

const usrId = ref(parseInt(route.params.usrId) || auth.usuario?.usr_id);
const fecha = ref(route.query.fecha || dayjs().format('YYYY-MM-DD'));
const data  = ref(null);     // { usuario, jornadas, puntos, gestiones, resumen }
const loading = ref(false);
const mapEl = ref(null);
let mapInstance = null;
let polyline = null;
let layerMarkers = null;

const puedeVerEquipo = computed(() => auth.rolNivel <= 3 || auth.rolCodigo === 'GERENTE_GENERAL');
const asesores = ref([]);

const opcAsesores = computed(() => asesores.value.map(u => ({
  value: String(u.usr_id),
  label: `${u.usr_nombre} ${u.usr_apellido || ''}`.trim()
})));

async function cargarAsesores() {
  if (!puedeVerEquipo.value) return;
  try {
    const r = await usuariosApi.list({ limit: 200 });
    asesores.value = (r.data?.items || r.data || []).filter(u => u.rol?.rol_codigo === 'ASESOR');
  } catch { /* silencioso */ }
}

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
  mapInstance = window.L.map(mapEl.value).setView([7.8939, -72.5078], 13);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(mapInstance);
  layerMarkers = window.L.layerGroup().addTo(mapInstance);
}

function dibujar() {
  if (!mapInstance || !data.value) return;
  layerMarkers.clearLayers();
  if (polyline) { polyline.remove(); polyline = null; }

  const puntos = data.value.puntos.map(p => [parseFloat(p.tp_lat), parseFloat(p.tp_lng)]);
  if (puntos.length >= 2) {
    polyline = window.L.polyline(puntos, {
      color: '#C8902A', weight: 4, opacity: 0.8
    }).addTo(mapInstance);
  }

  // Marker inicio
  if (puntos.length) {
    window.L.circleMarker(puntos[0], { radius: 8, color: '#fff', weight: 2, fillColor: '#6B8F6E', fillOpacity: 1 })
      .bindPopup('<strong>Inicio</strong>').addTo(layerMarkers);
  }
  // Marker fin
  if (puntos.length > 1) {
    window.L.circleMarker(puntos[puntos.length - 1], { radius: 8, color: '#fff', weight: 2, fillColor: '#B83227', fillOpacity: 1 })
      .bindPopup('<strong>Fin</strong>').addTo(layerMarkers);
  }

  // Markers de gestiones del día (azul)
  for (const g of (data.value.gestiones || [])) {
    if (!g.gest_ubicacion_lat || !g.gest_ubicacion_lng) continue;
    const lat = parseFloat(g.gest_ubicacion_lat), lng = parseFloat(g.gest_ubicacion_lng);
    const persona = g.prospecto?.persona;
    const popup = `<div style="font-family:system-ui">
      <strong>${persona?.persona_nombre || ''} ${persona?.persona_apellido || ''}</strong><br/>
      <small>${dayjs(g.gest_fecha_hora).format('HH:mm')}</small><br/>
      <small>${g.gest_comentario || 'Gestión registrada'}</small>
    </div>`;
    window.L.circleMarker([lat, lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#1A5C8A', fillOpacity: 0.9 })
      .bindPopup(popup).addTo(layerMarkers);
  }

  if (puntos.length) mapInstance.fitBounds(puntos, { padding: [40, 40] });
}

async function cargar() {
  if (!usrId.value || !fecha.value) return;
  loading.value = true;
  try {
    const r = await trackingApi.recorrido(usrId.value, fecha.value);
    data.value = r.data;
    dibujar();
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

function cambiarAsesor(val) {
  usrId.value = parseInt(val);
  router.replace({ name: 'tracking-asesor', params: { usrId: val }, query: { fecha: fecha.value } });
}

onMounted(async () => {
  await cargarAsesores();
  await initMapa();
  await cargar();
});

onUnmounted(() => {
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
});

watch([usrId, fecha], cargar);
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-4">
      <div>
        <h1 class="font-serif text-2xl text-brown-deep">🗺️ Recorrido del asesor</h1>
        <p v-if="data?.usuario" class="text-sm text-text3 mt-1">
          {{ data.usuario.usr_nombre }} {{ data.usuario.usr_apellido }}
          <span v-if="data?.fecha"> · {{ dayjs(data.fecha).format('D [de] MMMM YYYY') }}</span>
        </p>
      </div>
      <div class="flex items-end gap-2 flex-wrap">
        <BaseSelect v-if="puedeVerEquipo"
                    :model-value="String(usrId)"
                    :options="opcAsesores"
                    label="Asesor"
                    class="min-w-[220px]"
                    @update:modelValue="cambiarAsesor" />
        <BaseInput v-model="fecha" type="date" label="Fecha" class="max-w-[180px]" />
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <!-- Mapa -->
      <div class="sv-card overflow-hidden lg:col-span-3">
        <div ref="mapEl" class="w-full h-[65vh] min-h-[420px] bg-cream"></div>
        <div v-if="loading" class="text-center py-3 text-text3 text-sm">Cargando...</div>
        <div v-else-if="data && !data.puntos.length" class="text-center py-3 text-text3 text-sm">
          Sin puntos GPS para esta fecha.
        </div>
        <div v-else class="px-4 py-2 text-xs text-text3 border-t border-text3/10 flex flex-wrap gap-3">
          <span><span class="inline-block w-3 h-3 rounded-full bg-sage mr-1"></span>Inicio</span>
          <span><span class="inline-block w-3 h-3 rounded-full bg-danger mr-1"></span>Fin</span>
          <span><span class="inline-block w-3 h-3 rounded-full bg-area-emp mr-1"></span>Gestión registrada</span>
          <span><span class="inline-block w-3 h-1.5 align-middle bg-gold mr-1"></span>Recorrido</span>
        </div>
      </div>

      <!-- Stats sidebar -->
      <aside v-if="data?.resumen" class="sv-card p-4 space-y-3">
        <h3 class="font-serif text-base text-brown-deep border-b border-text3/10 pb-2">📊 Resumen</h3>

        <div>
          <div class="text-xs text-text3 uppercase tracking-wider">Jornadas</div>
          <div class="font-serif text-xl text-text1">{{ data.resumen.jornadas_total }}</div>
        </div>
        <div>
          <div class="text-xs text-text3 uppercase tracking-wider">Distancia total</div>
          <div class="font-serif text-2xl text-gold">{{ data.resumen.km_total }} <span class="text-sm text-text3">km</span></div>
        </div>
        <div>
          <div class="text-xs text-text3 uppercase tracking-wider">Tiempo activo</div>
          <div class="font-serif text-xl text-text1">
            {{ Math.floor(data.resumen.minutos_total/60) }}h {{ data.resumen.minutos_total%60 }}m
          </div>
        </div>
        <div>
          <div class="text-xs text-text3 uppercase tracking-wider">Puntos GPS</div>
          <div class="font-serif text-xl text-text1">{{ data.resumen.puntos_total }}</div>
        </div>
        <div>
          <div class="text-xs text-text3 uppercase tracking-wider">Gestiones registradas</div>
          <div class="font-serif text-xl text-text1">{{ data.resumen.gestiones_total }}</div>
        </div>

        <div v-if="data.jornadas?.length" class="pt-3 border-t border-text3/10">
          <div class="text-xs text-text3 uppercase tracking-wider mb-1">Jornadas del día</div>
          <div v-for="j in data.jornadas" :key="j.jor_id" class="text-xs text-text2 mb-1">
            {{ dayjs(j.jor_inicio_at).format('HH:mm') }}
            <span v-if="j.jor_fin_at">→ {{ dayjs(j.jor_fin_at).format('HH:mm') }}</span>
            · {{ j.jor_km_recorridos || 0 }} km
            <span class="text-[10px] px-1 rounded ml-1"
                  :class="j.jor_estado === 'auto_cerrada' ? 'bg-warning/20 text-warning' : 'bg-cream'">
              {{ j.jor_estado }}
            </span>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
