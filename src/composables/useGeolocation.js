/**
 * useGeolocation — wrapper de navigator.geolocation.
 * No bloquea si el usuario no da permiso; resuelve con null.
 *   - getCurrent({ timeout=10000, highAccuracy=true }) → { lat, lng, accuracy } | null
 *   - watch(cb, opts) → función para detener
 */
import { ref, onUnmounted } from 'vue';

export function useGeolocation() {
  const coords    = ref(null);
  const error     = ref(null);
  const obteniendo = ref(false);
  let watchId = null;

  async function getCurrent(opts = {}) {
    obteniendo.value = true;
    error.value = null;
    if (!('geolocation' in navigator)) {
      obteniendo.value = false;
      error.value = 'Tu navegador no soporta geolocalización.';
      return null;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          coords.value = c;
          obteniendo.value = false;
          resolve(c);
        },
        (err) => {
          obteniendo.value = false;
          error.value = err.code === 1
            ? 'Permiso de ubicación denegado'
            : err.code === 3
            ? 'Tiempo de espera agotado para obtener ubicación'
            : 'No se pudo obtener la ubicación';
          resolve(null);
        },
        { enableHighAccuracy: opts.highAccuracy ?? true, timeout: opts.timeout ?? 10000, maximumAge: 30000 }
      );
    });
  }

  function watchPos(cb, opts = {}) {
    if (!('geolocation' in navigator)) return () => {};
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        coords.value = c;
        cb(c);
      },
      (err) => { error.value = err.message; },
      { enableHighAccuracy: opts.highAccuracy ?? true, timeout: opts.timeout ?? 10000, maximumAge: 5000 }
    );
    return stopWatch;
  }

  function stopWatch() {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  onUnmounted(stopWatch);

  return { coords, error, obteniendo, getCurrent, watchPos, stopWatch };
}
