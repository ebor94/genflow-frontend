/**
 * useJornadaObligatoriaStore — estado del popup bloqueante de inicio de jornada.
 * Consumido por App.vue y por el modal ModalInicioJornadaObligatorio.
 * No persiste en localStorage: siempre se re-chequea contra backend.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { trackingApi } from '@/api/trackingApi';
import { useTrackingStore } from '@/stores/useTrackingStore';

const CACHE_MS = 60_000;

export const useJornadaObligatoriaStore = defineStore('svJornadaObligatoria', () => {
  const estado          = ref('sin_chequear'); // 'sin_chequear' | 'ok' | 'bloqueado' | 'ausente'
  const ultimoChequeoAt = ref(0);
  const chequeando      = ref(false);

  const debeBloquear = computed(() => estado.value === 'bloqueado');

  async function chequear({ force = false } = {}) {
    if (!force && Date.now() - ultimoChequeoAt.value < CACHE_MS) return;
    if (chequeando.value) return;
    chequeando.value = true;
    const tracking = useTrackingStore();
    try {
      const r = await trackingApi.estadoJornadaHoy();
      const data = r?.data || r; // tolera envolturas {ok:true,data:{}} o crudas
      if (data.estado === 'activa' && data.jornada) {
        estado.value = 'ok';
        tracking.reanudar(data.jornada);
      } else if (data.estado === 'ausente') {
        estado.value = 'ausente';
        tracking.detener();
      } else if (data.requiere_popup) {
        estado.value = 'bloqueado';
        tracking.detener();
      } else {
        estado.value = 'ok';
        tracking.detener();
      }
      ultimoChequeoAt.value = Date.now();
    } catch (e) {
      // Sin red: sigue la copia del navegador si es de este usuario y de hoy;
      // si no, fail CLOSED (el popup se muestra).
      estado.value = tracking.reanudarLocal() ? 'ok' : 'bloqueado';
      ultimoChequeoAt.value = Date.now();
      console.warn('[jornada-obligatoria] chequear falló → chequeo falló:', e?.message || e);
    } finally {
      chequeando.value = false;
    }
  }

  async function marcarAusencia({ tipo, motivo }) {
    await trackingApi.registrarAusenciaHoy({ tipo, motivo });
    useTrackingStore().detener();
    estado.value = 'ausente';
    ultimoChequeoAt.value = Date.now();
  }

  function marcarJornadaIniciada() {
    estado.value = 'ok';
    ultimoChequeoAt.value = Date.now();
  }

  function reset() {
    estado.value = 'sin_chequear';
    ultimoChequeoAt.value = 0;
    chequeando.value = false;
  }

  return {
    estado, ultimoChequeoAt, chequeando,
    debeBloquear,
    chequear, marcarAusencia, marcarJornadaIniciada, reset
  };
});
