import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { trackingApi } from '@/api/trackingApi';
import { useToastStore } from '@/stores/useToastStore';

const LS_KEY  = 'sv_tracking_jornada';
const LS_BUF  = 'sv_tracking_buffer';
const LS_WAKE = 'sv_tracking_wakelock';     // pref del usuario: mantener pantalla activa
const FLUSH_EVERY_MS   = 60_000;            // flush cada 60s
const FLUSH_EVERY_PTS  = 10;                // o cada 10 puntos
const ACCURACY_MAX     = 100;               // descartar accuracy > 100m
const DELTA_MIN_M      = 20;                // ignorar deltas < 20m
const GAP_ALERT_MIN    = 5;                 // gap en min considerado relevante

function distM(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const useTrackingStore = defineStore('svTracking', () => {
  const toast = useToastStore();

  const jornadaActiva = ref(null);   // { jor_id, jor_inicio_at }
  const ultimaPos     = ref(null);   // { lat, lng, ts }
  const enviadoCount  = ref(0);
  const bufferLocal   = ref([]);
  const errorPermiso  = ref(null);
  // Wake Lock: mantiene pantalla encendida → watchPosition no se suspende
  const wakeLockActivo = ref(false);
  const wakeLockPref   = ref(localStorage.getItem(LS_WAKE) === '1');
  let wakeLockSentinel = null;
  // Detección de pausa por bloqueo de pantalla / cambio de pestaña
  const lastHiddenAt  = ref(null);
  const lastResumedAt = ref(null);
  let visibilityListener = null;
  let onlineListener     = null;

  let watchId    = null;
  let flushTimer = null;

  function restaurar() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) jornadaActiva.value = JSON.parse(raw);
      const buf = localStorage.getItem(LS_BUF);
      if (buf) bufferLocal.value = JSON.parse(buf);
    } catch { /* ignore */ }
    if (jornadaActiva.value) {
      iniciarWatch();
      registrarListeners();
      if (wakeLockPref.value) requestWakeLock().catch(() => {});
    }
  }

  function persistir() {
    if (jornadaActiva.value) localStorage.setItem(LS_KEY, JSON.stringify(jornadaActiva.value));
    else localStorage.removeItem(LS_KEY);
    localStorage.setItem(LS_BUF, JSON.stringify(bufferLocal.value));
  }

  const estaActiva = computed(() => !!jornadaActiva.value);
  const duracionMin = computed(() => {
    if (!jornadaActiva.value?.jor_inicio_at) return 0;
    return Math.round((Date.now() - new Date(jornadaActiva.value.jor_inicio_at)) / 60000);
  });
  /** Minutos transcurridos desde el último punto capturado (indicador de gap). */
  const minSinPunto = computed(() => {
    if (!ultimaPos.value?.ts) return null;
    return Math.floor((Date.now() - ultimaPos.value.ts) / 60000);
  });

  async function getActual(maxAge = 30000) {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, altitude: pos.coords.altitude, speed: pos.coords.speed,
          ts: pos.timestamp
        }),
        (err) => { errorPermiso.value = err.message; resolve(null); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: maxAge }
      );
    });
  }

  function iniciarWatch() {
    if (watchId != null || !('geolocation' in navigator)) return;
    watchId = navigator.geolocation.watchPosition(
      (pos) => handlePoint({
        ts:        pos.timestamp,
        lat:       pos.coords.latitude,
        lng:       pos.coords.longitude,
        accuracy:  pos.coords.accuracy,
        altitude:  pos.coords.altitude,
        speed:     pos.coords.speed,
        source:    'foreground'
      }),
      (err) => { errorPermiso.value = err.message; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    if (!flushTimer) flushTimer = setInterval(flush, FLUSH_EVERY_MS);
  }

  function detenerWatch() {
    if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    if (flushTimer)      { clearInterval(flushTimer); flushTimer = null; }
  }

  /** Filtra y enqueue un punto (validaciones de accuracy y delta). */
  function handlePoint(p) {
    if (p.accuracy != null && p.accuracy > ACCURACY_MAX) return false;
    if (ultimaPos.value) {
      const d = distM(ultimaPos.value, p);
      if (d < DELTA_MIN_M) return false;
    }
    ultimaPos.value = { lat: p.lat, lng: p.lng, ts: p.ts };
    bufferLocal.value.push(p);
    persistir();
    if (bufferLocal.value.length >= FLUSH_EVERY_PTS) flush();
    return true;
  }

  /** Envía el buffer al backend. No revienta si falla; deja los puntos en buffer. */
  async function flush() {
    if (!jornadaActiva.value || !bufferLocal.value.length) return;
    const lote = bufferLocal.value.slice(0, 100);
    try {
      const r = await trackingApi.batchPuntos(jornadaActiva.value.jor_id, lote);
      bufferLocal.value = bufferLocal.value.slice(lote.length);
      enviadoCount.value += r.data?.aceptados || 0;
      persistir();
    } catch (e) {
      if (e.response?.data?.error === 'JORNADA_CERRADA') {
        bufferLocal.value = [];
        jornadaActiva.value = null;
        persistir();
        detenerWatch();
        soltarListeners();
        toast.warning('Tu jornada fue cerrada automáticamente.');
      }
      // Si fue por offline, dejar buffer; los listeners de online lo intentarán de nuevo.
    }
  }

  // ──────────────────────────────────────────────────────────
  // Visibilitychange + Wake Lock + Background Sync (Fase 7.1)
  // ──────────────────────────────────────────────────────────

  /** Maneja cuando la pestaña vuelve visible tras pantalla bloqueada / app en background. */
  async function onResume() {
    lastResumedAt.value = Date.now();
    const gapMin = lastHiddenAt.value
      ? Math.floor((Date.now() - lastHiddenAt.value) / 60000)
      : 0;
    lastHiddenAt.value = null;

    if (!estaActiva.value) return;

    // Captura inmediata para cerrar el gap
    const pos = await getActual(0);
    if (pos) {
      handlePoint({
        ts: pos.ts || Date.now(),
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        altitude: pos.altitude,
        speed: pos.speed,
        source: gapMin >= GAP_ALERT_MIN ? 'post_resume' : 'foreground'
      });
    }
    await flush();
    if (gapMin >= GAP_ALERT_MIN) {
      toast.info(`📍 Tracking reanudado tras ${gapMin} min sin reporte`);
    }
  }

  function onHide() {
    lastHiddenAt.value = Date.now();
    // Intentar flush antes de que el navegador pause completamente
    flush().catch(() => {});
  }

  async function onOnlineRecovered() {
    // Cuando la red vuelve, intentar enviar buffer pendiente
    await flush();
  }

  function registrarListeners() {
    if (typeof document === 'undefined') return;
    if (!visibilityListener) {
      visibilityListener = () => {
        if (document.visibilityState === 'visible') onResume();
        else if (document.visibilityState === 'hidden') onHide();
      };
      document.addEventListener('visibilitychange', visibilityListener);
    }
    if (!onlineListener) {
      onlineListener = onOnlineRecovered;
      window.addEventListener('online', onlineListener);
    }
    // Escuchar mensajes del Service Worker (Background Sync → flush)
    if ('serviceWorker' in navigator && !navigator.serviceWorker.__sv_listener) {
      navigator.serviceWorker.__sv_listener = true;
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'SV_TRACKING_FLUSH') flush().catch(() => {});
      });
    }
    registrarBackgroundSync();
  }

  function soltarListeners() {
    if (visibilityListener) {
      document.removeEventListener('visibilitychange', visibilityListener);
      visibilityListener = null;
    }
    if (onlineListener) {
      window.removeEventListener('online', onlineListener);
      onlineListener = null;
    }
  }

  /** Registra un Background Sync con el Service Worker para flush al recuperar red. */
  async function registrarBackgroundSync() {
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        if (reg.sync) await reg.sync.register('sv-tracking-flush');
      }
    } catch { /* navegador no soporta */ }
  }

  /** Solicita Wake Lock para mantener pantalla activa mientras la jornada está abierta. */
  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) {
      toast.warning('Tu navegador no soporta mantener pantalla activa.');
      return false;
    }
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockActivo.value = true;
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockActivo.value = false;
      });
      return true;
    } catch (e) {
      toast.warning('No se pudo activar pantalla activa.');
      return false;
    }
  }

  async function releaseWakeLock() {
    if (wakeLockSentinel) {
      try { await wakeLockSentinel.release(); } catch {}
      wakeLockSentinel = null;
      wakeLockActivo.value = false;
    }
  }

  /** Toggle desde el widget. Persiste preferencia. */
  async function toggleWakeLock() {
    const nuevo = !wakeLockPref.value;
    wakeLockPref.value = nuevo;
    localStorage.setItem(LS_WAKE, nuevo ? '1' : '0');
    if (nuevo) {
      const ok = await requestWakeLock();
      if (ok) toast.success('Pantalla activa mientras dure la jornada');
    } else {
      await releaseWakeLock();
      toast.info('Pantalla puede bloquearse normalmente');
    }
  }

  // Si el wake lock se libera por el SO (p.ej. cambio de app), reintentarlo al volver
  async function maybeReadquireWakeLock() {
    if (wakeLockPref.value && estaActiva.value && !wakeLockActivo.value) {
      await requestWakeLock();
    }
  }

  // ──────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────

  async function iniciar() {
    if (estaActiva.value) return jornadaActiva.value;
    const pos = await getActual();
    try {
      const r = await trackingApi.iniciarJornada({
        lat: pos?.lat, lng: pos?.lng, dispositivo: navigator.userAgent
      });
      jornadaActiva.value = {
        jor_id: r.data.jor_id,
        jor_inicio_at: r.data.jor_inicio_at
      };
      ultimaPos.value = pos ? { lat: pos.lat, lng: pos.lng, ts: pos.ts || Date.now() } : null;
      bufferLocal.value = [];
      enviadoCount.value = 0;
      persistir();
      iniciarWatch();
      registrarListeners();
      if (wakeLockPref.value) await requestWakeLock();
      return jornadaActiva.value;
    } catch (e) { throw e; }
  }

  async function finalizar() {
    if (!estaActiva.value) return;
    await flush();
    const pos = await getActual();
    try {
      await trackingApi.finalizarJornada(jornadaActiva.value.jor_id, {
        lat: pos?.lat, lng: pos?.lng
      });
    } catch (e) { /* silencioso */ }
    detenerWatch();
    soltarListeners();
    await releaseWakeLock();
    jornadaActiva.value = null;
    bufferLocal.value = [];
    enviadoCount.value = 0;
    persistir();
  }

  function reset() {
    detenerWatch();
    soltarListeners();
    releaseWakeLock();
    jornadaActiva.value = null;
    ultimaPos.value = null;
    enviadoCount.value = 0;
    bufferLocal.value = [];
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_BUF);
  }

  return {
    jornadaActiva, ultimaPos, enviadoCount, bufferLocal, errorPermiso,
    estaActiva, duracionMin, minSinPunto,
    wakeLockActivo, wakeLockPref, lastResumedAt,
    restaurar, iniciar, finalizar, flush, reset,
    toggleWakeLock, maybeReadquireWakeLock
  };
});
