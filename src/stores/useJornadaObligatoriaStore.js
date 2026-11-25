/**
 * useJornadaObligatoriaStore — estado del popup bloqueante de inicio de jornada.
 * Consumido por App.vue y por el modal ModalInicioJornadaObligatorio.
 * No persiste en localStorage: siempre se re-chequea contra backend.
 * Es el único punto que arranca o detiene la captura según lo que dice el backend.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { trackingApi } from '@/api/trackingApi';
import { useTrackingStore } from '@/stores/useTrackingStore';
import { useAuthStore } from '@/stores/useAuthStore';

const CACHE_MS = 60_000;

// Roles sin jornada. Misma lista que ROLES_NO_OPERATIVOS en jornadaObligatoria.service del backend.
const ROLES_NO_OPERATIVOS = ['SUPER_ADMIN', 'GERENTE_GENERAL', 'DIRECTOR_COMERCIAL'];

export const useJornadaObligatoriaStore = defineStore('svJornadaObligatoria', () => {
  const estado          = ref('sin_chequear'); // 'sin_chequear' | 'ok' | 'bloqueado' | 'ausente'
  const ultimoChequeoAt = ref(0);
  const chequeando      = ref(false);

  const debeBloquear = computed(() => estado.value === 'bloqueado');

  // Cada cambio de estado invalida las respuestas que estén en camino.
  let turno = 0;
  function invalidar() { turno++; chequeando.value = false; }

  /** usr_id de la sesión actual, o null si no hay sesión. */
  function usuarioActual() {
    const auth = useAuthStore();
    return auth.isAuthenticated ? (auth.usuario?.usr_id ?? null) : null;
  }

  async function chequear({ force = false } = {}) {
    if (!force && Date.now() - ultimoChequeoAt.value < CACHE_MS) return;
    if (chequeando.value && !force) return;
    const usr = usuarioActual();
    if (usr == null) return;
    const tracking = useTrackingStore();
    const mi = ++turno;
    const vigente = () => mi === turno && usuarioActual() === usr;

    if (ROLES_NO_OPERATIVOS.includes(useAuthStore().rolCodigo)) {
      chequeando.value = false;
      estado.value = 'ok';
      ultimoChequeoAt.value = Date.now();
      tracking.detener();
      return;
    }

    chequeando.value = true;
    try {
      const r = await trackingApi.estadoJornadaHoy();
      if (!vigente()) return;
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
      if (!vigente()) return;
      // Sin red: sigue la copia del navegador si es de este usuario y de hoy;
      // si no, fail CLOSED (el popup se muestra).
      estado.value = tracking.reanudarLocal() ? 'ok' : 'bloqueado';
      ultimoChequeoAt.value = Date.now();
      console.warn('[jornada-obligatoria] chequeo falló:', e?.message || e);
    } finally {
      if (mi === turno) chequeando.value = false;
    }
  }

  async function marcarAusencia({ tipo, motivo }) {
    invalidar();
    await trackingApi.registrarAusenciaHoy({ tipo, motivo });
    invalidar();
    estado.value = 'ausente';
    ultimoChequeoAt.value = Date.now();
    useTrackingStore().detener();
  }

  function marcarJornadaIniciada() {
    invalidar();
    estado.value = 'ok';
    ultimoChequeoAt.value = Date.now();
  }

  function reset() {
    invalidar();
    estado.value = 'sin_chequear';
    ultimoChequeoAt.value = 0;
  }

  return {
    estado, ultimoChequeoAt, chequeando,
    debeBloquear,
    chequear, marcarAusencia, marcarJornadaIniciada, reset
  };
});
