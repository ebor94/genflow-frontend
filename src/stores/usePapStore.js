/**
 * usePapStore — datos de la jornada PAP del asesor en campo.
 * Mantiene contadores en memoria (no espera a snapshot diario para mostrarlos).
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { papApi } from '@/api/papApi';

export const usePapStore = defineStore('svPap', () => {
  const visitasHoy = ref([]);           // últimas N gestiones del día
  const zonaActiva = ref('');            // zona seleccionada por el asesor
  const ultimaCoord = ref(null);         // última posición conocida
  const metricasDia = ref(null);

  const contadores = computed(() => {
    const arr = visitasHoy.value;
    return {
      total:        arr.length,
      afiliadas:    arr.filter(g => g.resultado_codigo === 'AFILIADO_HOY').length,
      interesadas:  arr.filter(g => g.resultado_codigo === 'INTERESADO').length,
      volver:       arr.filter(g => g.resultado_codigo === 'VOLVER').length,
      no_interes:   arr.filter(g => g.resultado_codigo === 'NO_INTERESADO').length,
      sin_resp:     arr.filter(g => g.resultado_codigo === 'SIN_RESPUESTA').length
    };
  });

  async function registrar(payload) {
    const r = await papApi.registroRapido(payload);
    visitasHoy.value = [
      {
        id: r.data.gestion_id,
        nombre: payload.nombre,
        telefono: payload.telefono,
        direccion: payload.direccion || payload.zona_pap || '',
        resultado_codigo: payload.resultado_codigo,
        resultado: r.data.resultado,
        ts: new Date(),
        lat: payload.lat || null,
        lng: payload.lng || null
      },
      ...visitasHoy.value
    ];
    if (payload.lat && payload.lng) ultimaCoord.value = { lat: payload.lat, lng: payload.lng };
    return r.data;
  }

  async function refrescarMetricas(fecha = null) {
    const hoy = fecha || new Date().toISOString().slice(0, 10);
    const r = await papApi.metricas({ desde: hoy, hasta: hoy });
    metricasDia.value = r.data;
    return r.data;
  }

  function setZonaActiva(z) {
    zonaActiva.value = z;
    if (z) localStorage.setItem('sv_pap_zona', z);
    else   localStorage.removeItem('sv_pap_zona');
  }

  function restore() {
    zonaActiva.value = localStorage.getItem('sv_pap_zona') || '';
  }

  function reset() {
    visitasHoy.value = [];
    metricasDia.value = null;
    ultimaCoord.value = null;
  }

  return { visitasHoy, zonaActiva, ultimaCoord, metricasDia, contadores,
           registrar, refrescarMetricas, setZonaActiva, restore, reset };
});
