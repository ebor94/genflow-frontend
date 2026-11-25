import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/api/trackingApi', () => ({
  trackingApi: {
    iniciarJornada:   vi.fn(),
    batchPuntos:      vi.fn()
  }
}));

const chequear = vi.hoisted(() => vi.fn());
vi.mock('@/stores/useJornadaObligatoriaStore', () => ({
  useJornadaObligatoriaStore: () => ({ chequear })
}));

import { trackingApi } from '@/api/trackingApi';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTrackingStore } from '@/stores/useTrackingStore';

const HOY = '2026-11-25';
const AYER = '2026-11-24';
let geo;

function copia(extra = {}) {
  return { usr_id: 7, fecha: HOY, jor_id: 'J1', jor_inicio_at: '2026-11-25T13:00:00Z', ...extra };
}
function guardar(c, puntos) {
  if (c) localStorage.setItem('sv_tracking_jornada', JSON.stringify(c));
  if (puntos) localStorage.setItem('sv_tracking_buffer', JSON.stringify(puntos));
}
const pt = (n) => ({ ts: n, lat: 4 + n / 100, lng: -74, accuracy: 10, source: 'foreground' });
const diferida = () => {
  let resolve, reject;
  const promesa = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promesa, resolve, reject };
};
const lectura = (n) => ({ timestamp: n, coords: { latitude: 4 + n / 100, longitude: -74, accuracy: 10 } });
const errHttp = (status, error) => ({ response: { status, data: { success: false, error } } });

describe('useTrackingStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 25, 10, 0, 0));
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
    geo = {
      watchPosition: vi.fn(() => 5),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn((ok) => ok({
        coords: { latitude: 4.6, longitude: -74.1, accuracy: 10, altitude: null, speed: null }, timestamp: 1
      }))
    };
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    useAuthStore().usuario = { usr_id: 7 };
  });
  afterEach(() => { vi.useRealTimers(); });

  describe('iniciar', () => {
    it('siempre llama al backend, aunque haya una jornada vieja de otro día y usuario', async () => {
      guardar(copia({ usr_id: 99, fecha: AYER, jor_id: 'VIEJA' }), { jor_id: 'VIEJA', puntos: [pt(1)] });
      trackingApi.iniciarJornada.mockResolvedValue({ data: { jor_id: 'J2', jor_inicio_at: 'x' } });
      const t = useTrackingStore();
      await t.iniciar();
      expect(trackingApi.iniciarJornada).toHaveBeenCalledTimes(1);
      expect(t.jornadaActiva.jor_id).toBe('J2');
      expect(t.bufferLocal).toEqual([]);
    });

    it('deja la copia local con usr_id y fecha', async () => {
      trackingApi.iniciarJornada.mockResolvedValue({ data: { jor_id: 'J2', jor_inicio_at: 'x' } });
      await useTrackingStore().iniciar();
      expect(JSON.parse(localStorage.getItem('sv_tracking_jornada'))).toEqual(
        { usr_id: 7, fecha: HOY, jor_id: 'J2', jor_inicio_at: 'x' }
      );
      expect(JSON.parse(localStorage.getItem('sv_tracking_buffer')).jor_id).toBe('J2');
    });

    it('llama al backend aunque ya esté activa en memoria', async () => {
      trackingApi.iniciarJornada.mockResolvedValue({ data: { jor_id: 'J2', jor_inicio_at: 'x' } });
      const t = useTrackingStore();
      await t.iniciar();
      await t.iniciar();
      expect(trackingApi.iniciarJornada).toHaveBeenCalledTimes(2);
      expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    });
  });

  describe('reanudar', () => {
    it('arranca la captura con ese id', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      expect(t.jornadaActiva.jor_id).toBe('J1');
      expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    });

    it('dos veces con la misma no duplica watchPosition ni temporizadores', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      expect(geo.watchPosition).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);
    });

    it('con la misma jornada ya activa no reinicia el avance', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      geo.watchPosition.mock.calls[0][0]({ timestamp: 5, coords: { latitude: 4.7, longitude: -74, accuracy: 10 } });
      t.enviadoCount = 3;
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      expect(t.bufferLocal).toHaveLength(1);
      expect(t.ultimaPos.lat).toBe(4.7);
      expect(t.enviadoCount).toBe(3);
    });

    it('con J1 en memoria y J2 nueva, no arrastra los puntos ni la posición de J1', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      geo.watchPosition.mock.calls[0][0](lectura(1));
      expect(t.bufferLocal).toHaveLength(1);
      t.reanudar({ jor_id: 'J2', jor_inicio_at: 'b' });
      expect(t.bufferLocal).toEqual([]);
      expect(t.ultimaPos).toBeNull();
    });

    it('con otra jornada descarta los puntos guardados de la anterior', () => {
      guardar(copia({ jor_id: 'J1' }), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J2', jor_inicio_at: 'b' });
      expect(t.bufferLocal).toEqual([]);
      expect(JSON.parse(localStorage.getItem('sv_tracking_buffer'))).toEqual({ jor_id: 'J2', puntos: [] });
    });

    it('con la misma jornada conserva los puntos guardados', () => {
      guardar(copia({ jor_id: 'J1' }), { jor_id: 'J1', puntos: [pt(1), pt(2)] });
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      expect(t.bufferLocal).toHaveLength(2);
    });
  });

  describe('reanudarLocal', () => {
    it('copia de este usuario y de hoy: true y arranca', () => {
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      expect(t.reanudarLocal()).toBe(true);
      expect(t.jornadaActiva.jor_id).toBe('J1');
      expect(t.bufferLocal).toHaveLength(1);
      expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['de ayer', copia({ fecha: AYER })],
      ['de otro usuario', copia({ usr_id: 8 })],
      ['sin usr_id (formato anterior)', { jor_id: 'J1', jor_inicio_at: 'a' }]
    ])('copia %s: false, la borra y no arranca', (_n, c) => {
      guardar(c, { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      expect(t.reanudarLocal()).toBe(false);
      expect(t.estaActiva).toBe(false);
      expect(geo.watchPosition).not.toHaveBeenCalled();
      expect(localStorage.getItem('sv_tracking_jornada')).toBeNull();
      expect(localStorage.getItem('sv_tracking_buffer')).toBeNull();
    });

    it('sin usuario en sesión no acepta una copia sin usr_id', () => {
      useAuthStore().usuario = null;
      guardar({ jor_id: 'J1', fecha: HOY, jor_inicio_at: 'a' });
      expect(useTrackingStore().reanudarLocal()).toBe(false);
    });

    it('una copia inválida no borra los pendientes de otra jornada', () => {
      guardar(copia({ fecha: AYER, jor_id: 'J1' }), { jor_id: 'J9', puntos: [pt(1)] });
      expect(useTrackingStore().reanudarLocal()).toBe(false);
      expect(localStorage.getItem('sv_tracking_jornada')).toBeNull();
      expect(JSON.parse(localStorage.getItem('sv_tracking_buffer')).jor_id).toBe('J9');
    });

    it('copia ilegible: false y la borra', () => {
      localStorage.setItem('sv_tracking_jornada', '{no es json');
      const t = useTrackingStore();
      expect(t.reanudarLocal()).toBe(false);
      expect(localStorage.getItem('sv_tracking_jornada')).toBeNull();
      expect(geo.watchPosition).not.toHaveBeenCalled();
    });
  });

  describe('pausar', () => {
    it('envía lo pendiente, detiene y limpia; no finaliza la jornada', async () => {
      trackingApi.batchPuntos.mockResolvedValue({ data: { aceptados: 2 } });
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1), pt(2)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      await t.pausar();
      expect(trackingApi.batchPuntos).toHaveBeenCalledWith('J1', [pt(1), pt(2)]);
      expect(trackingApi.finalizarJornada).toBeUndefined();
      expect(geo.clearWatch).toHaveBeenCalledWith(5);
      expect(t.estaActiva).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      expect(localStorage.getItem('sv_tracking_jornada')).toBeNull();
      expect(localStorage.getItem('sv_tracking_buffer')).toBeNull();
    });

    it('detiene aunque el envío falle', async () => {
      trackingApi.batchPuntos.mockRejectedValue(new Error('Network Error'));
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      await t.pausar();
      expect(t.estaActiva).toBe(false);
      expect(JSON.parse(localStorage.getItem('sv_tracking_buffer'))).toEqual({ jor_id: 'J1', puntos: [pt(1)] });
      expect(localStorage.getItem('sv_tracking_jornada')).toBeNull();
    });

    it('envía en bucle mientras avance', async () => {
      trackingApi.batchPuntos.mockResolvedValue({ data: { aceptados: 1 } });
      guardar(copia(), { jor_id: 'J1', puntos: Array.from({ length: 130 }, (_, i) => pt(i + 1)) });
      const t = useTrackingStore();
      t.reanudarLocal();
      await t.pausar();
      expect(trackingApi.batchPuntos).toHaveBeenCalledTimes(2);
      expect(localStorage.getItem('sv_tracking_buffer')).toBeNull();
    });

    it('lo que no salió se envía si la misma persona vuelve a la misma jornada', async () => {
      trackingApi.batchPuntos.mockRejectedValue(new Error('Network Error'));
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      await t.pausar();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      expect(t.bufferLocal).toEqual([pt(1)]);
      trackingApi.batchPuntos.mockResolvedValue({ data: { aceptados: 1 } });
      await t.flush();
      expect(trackingApi.batchPuntos).toHaveBeenLastCalledWith('J1', [pt(1)]);
    });

    it('lo guardado de otra jornada no se envía en la nueva', async () => {
      trackingApi.batchPuntos.mockRejectedValue(new Error('Network Error'));
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      await t.pausar();
      t.reanudar({ jor_id: 'J2', jor_inicio_at: 'b' });
      expect(t.bufferLocal).toEqual([]);
    });
  });

  describe('detener', () => {
    it('solo borra las claves de su jornada', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      guardar(copia({ jor_id: 'J9' }), { jor_id: 'J9', puntos: [pt(1)] });
      t.detener();
      expect(JSON.parse(localStorage.getItem('sv_tracking_jornada')).jor_id).toBe('J9');
      expect(JSON.parse(localStorage.getItem('sv_tracking_buffer')).jor_id).toBe('J9');
    });

    it('con borrarPendientes false conserva el buffer con puntos y quita la copia', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      geo.watchPosition.mock.calls[0][0](lectura(1));
      t.detener({ borrarPendientes: false });
      expect(localStorage.getItem('sv_tracking_jornada')).toBeNull();
      expect(JSON.parse(localStorage.getItem('sv_tracking_buffer')).puntos).toHaveLength(1);
    });

    it('por defecto borra también los pendientes', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      geo.watchPosition.mock.calls[0][0](lectura(1));
      t.detener();
      expect(localStorage.getItem('sv_tracking_buffer')).toBeNull();
    });

    it('suelta los listeners sin duplicarlos', () => {
      const add = vi.spyOn(document, 'addEventListener');
      const rem = vi.spyOn(document, 'removeEventListener');
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      expect(add.mock.calls.filter((c) => c[0] === 'visibilitychange')).toHaveLength(1);
      t.detener();
      expect(rem.mock.calls.filter((c) => c[0] === 'visibilitychange')).toHaveLength(1);
      add.mockRestore(); rem.mockRestore();
    });

    it('el wake lock que falla al pedirlo: auto en silencio, manual con aviso', async () => {
      localStorage.setItem('sv_tracking_wakelock', '1');
      const request = vi.fn().mockRejectedValue(new Error('no'));
      Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
      setActivePinia(createPinia());
      useAuthStore().usuario = { usr_id: 7 };
      const aviso = vi.spyOn(useToastStore(), 'warning');
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      await vi.advanceTimersByTimeAsync(0);
      await t.maybeReadquireWakeLock();
      expect(request).toHaveBeenCalledTimes(2);
      expect(aviso).not.toHaveBeenCalled();
      await t.toggleWakeLock(); await t.toggleWakeLock();
      expect(aviso).toHaveBeenCalledWith('No se pudo activar pantalla activa.');
      delete navigator.wakeLock;
    });

    it('el wake lock que no existe: reintentar al volver no avisa', async () => {
      localStorage.setItem('sv_tracking_wakelock', '1');
      setActivePinia(createPinia());
      useAuthStore().usuario = { usr_id: 7 };
      const aviso = vi.spyOn(useToastStore(), 'warning');
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      await t.maybeReadquireWakeLock();
      expect(aviso).not.toHaveBeenCalled();
    });

    it('suelta el wake lock', async () => {
      localStorage.setItem('sv_tracking_wakelock', '1');
      const release = vi.fn().mockResolvedValue();
      const request = vi.fn().mockResolvedValue({ release, addEventListener: vi.fn() });
      Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
      setActivePinia(createPinia());
      useAuthStore().usuario = { usr_id: 7 };
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      await vi.advanceTimersByTimeAsync(0);
      expect(request).toHaveBeenCalledTimes(1);
      t.detener();
      await vi.advanceTimersByTimeAsync(0);
      expect(release).toHaveBeenCalledTimes(1);
      delete navigator.wakeLock;
    });

    it('el wake lock automático no avisa si falla; el manual sí', async () => {
      localStorage.setItem('sv_tracking_wakelock', '1');
      setActivePinia(createPinia());
      useAuthStore().usuario = { usr_id: 7 };
      const aviso = vi.spyOn(useToastStore(), 'warning');
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      await vi.advanceTimersByTimeAsync(0);
      expect(aviso).not.toHaveBeenCalled();
      await t.toggleWakeLock();   // la desactiva
      await t.toggleWakeLock();   // la activa a mano: sin soporte, avisa
      expect(aviso).toHaveBeenCalled();
    });
  });

  describe('envíos', () => {
    it('un envío de J1 en curso no pisa a J2: el 409 no apaga J2', async () => {
      const d = diferida();
      trackingApi.batchPuntos.mockReturnValue(d.promesa);
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      const p = t.flush();
      t.reanudar({ jor_id: 'J2', jor_inicio_at: 'b' });
      d.reject(errHttp(409, 'JORNADA_CERRADA'));
      await p;
      expect(t.jornadaActiva.jor_id).toBe('J2');
      expect(geo.clearWatch).not.toHaveBeenCalled();
      expect(chequear).not.toHaveBeenCalled();
    });

    it('la respuesta buena de J1 no recorta el buffer de J2', async () => {
      const d = diferida();
      trackingApi.batchPuntos.mockReturnValue(d.promesa);
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      const p = t.flush();
      t.reanudar({ jor_id: 'J2', jor_inicio_at: 'b' });
      geo.watchPosition.mock.calls[0][0](lectura(5));
      d.resolve({ data: { aceptados: 1 } });
      await p;
      expect(t.bufferLocal).toHaveLength(1);
      expect(t.enviadoCount).toBe(0);
    });

    it('dos flush a la vez envían una sola vez', async () => {
      const d = diferida();
      trackingApi.batchPuntos.mockReturnValue(d.promesa);
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1), pt(2)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      const p = Promise.all([t.flush(), t.flush()]);
      d.resolve({ data: { aceptados: 2 } });
      await p;
      expect(trackingApi.batchPuntos).toHaveBeenCalledTimes(1);
      expect(t.bufferLocal).toEqual([]);
      expect(t.enviadoCount).toBe(2);
    });

    it('un punto nuevo durante el envío no se pierde', async () => {
      const d = diferida();
      trackingApi.batchPuntos.mockReturnValue(d.promesa);
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      const p = t.flush();
      geo.watchPosition.mock.calls[0][0](lectura(9));
      d.resolve({ data: { aceptados: 1 } });
      await p;
      expect(t.bufferLocal).toHaveLength(1);
      expect(t.bufferLocal[0].ts).toBe(9);
    });

    it('403 avisa que la jornada es de otra persona', async () => {
      trackingApi.batchPuntos.mockRejectedValue(errHttp(403, 'FORBIDDEN'));
      const aviso = vi.spyOn(useToastStore(), 'warning');
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      await t.flush();
      expect(aviso).toHaveBeenCalledWith('Esta jornada es de otra persona.');
    });

    it.each([[409, 'JORNADA_CERRADA'], [404, 'NOT_FOUND'], [403, 'FORBIDDEN']])('%s %s detiene y vuelve a preguntar al backend', async (st, cod) => {
      trackingApi.batchPuntos.mockRejectedValue(errHttp(st, cod));
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      await t.flush();
      await vi.advanceTimersByTimeAsync(0);
      expect(t.estaActiva).toBe(false);
      expect(chequear).toHaveBeenCalledWith({ force: true });
    });
  });

  describe('cruce de medianoche', () => {
    const manana = () => vi.setSystemTime(new Date(2026, 10, 26, 0, 5, 0));

    it('la jornada lleva el día y el usuario fijados al activar', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a', jor_fecha: '2026-11-25T05:00:00.000Z' });
      expect(JSON.parse(localStorage.getItem('sv_tracking_jornada'))).toMatchObject({ usr_id: 7, fecha: HOY });
      manana();
      geo.watchPosition.mock.calls[0][0](lectura(1));
      expect(JSON.parse(localStorage.getItem('sv_tracking_jornada')).fecha).toBe(HOY);
    });

    it('la copia conserva el día de la jornada aunque se guarde después de medianoche', async () => {
      const d = diferida();
      trackingApi.batchPuntos.mockReturnValue(d.promesa);
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      const p = t.flush();
      manana();
      d.resolve({ data: { aceptados: 1 } });
      await p;
      expect(JSON.parse(localStorage.getItem('sv_tracking_jornada')).fecha).toBe(HOY);
    });

    it('el día sale de jor_fecha del backend, no de la hora del equipo', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a', jor_fecha: '2026-11-24' });
      expect(JSON.parse(localStorage.getItem('sv_tracking_jornada')).fecha).toBe(AYER);
    });

    it('un punto capturado después de medianoche envía lo pendiente, detiene y pregunta de nuevo', async () => {
      trackingApi.batchPuntos.mockResolvedValue({ data: { aceptados: 1 } });
      guardar(copia(), { jor_id: 'J1', puntos: [pt(1)] });
      const t = useTrackingStore();
      t.reanudarLocal();
      manana();
      geo.watchPosition.mock.calls[0][0](lectura(2));
      await vi.advanceTimersByTimeAsync(0);
      expect(trackingApi.batchPuntos).toHaveBeenCalledWith('J1', [pt(1)]);
      expect(t.estaActiva).toBe(false);
      expect(chequear).toHaveBeenCalledWith({ force: true });
    });

    it('el temporizador de envío también detecta el cambio de día', async () => {
      guardar(copia(), { jor_id: 'J1', puntos: [] });
      const t = useTrackingStore();
      t.reanudarLocal();
      manana();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(t.estaActiva).toBe(false);
      expect(chequear).toHaveBeenCalledWith({ force: true });
    });

    it('al volver a la pestaña después de medianoche también', async () => {
      guardar(copia(), { jor_id: 'J1', puntos: [] });
      const t = useTrackingStore();
      t.reanudarLocal();
      manana();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
      expect(t.estaActiva).toBe(false);
      expect(chequear).toHaveBeenCalledWith({ force: true });
    });

    it('reanudarLocal usa la jornada en memoria si es de este usuario y de hoy, sin copia', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      localStorage.clear();
      expect(t.reanudarLocal()).toBe(true);
      expect(t.estaActiva).toBe(true);
    });

    it('reanudarLocal con la jornada en memoria de ayer: false y la detiene', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      manana();
      expect(t.reanudarLocal()).toBe(false);
      expect(t.estaActiva).toBe(false);
    });

    it('reanudarLocal con la jornada en memoria de otro usuario: false', () => {
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      useAuthStore().usuario = { usr_id: 8 };
      expect(t.reanudarLocal()).toBe(false);
      expect(t.estaActiva).toBe(false);
    });
  });

  describe('pausa de la pestaña', () => {
    it('si la jornada se detiene mientras se espera el GPS, el punto no se guarda', async () => {
      let cb;
      geo.getCurrentPosition = vi.fn((ok) => { cb = ok; });
      const t = useTrackingStore();
      t.reanudar({ jor_id: 'J1', jor_inicio_at: 'a' });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      t.detener();
      cb({ coords: { latitude: 4.6, longitude: -74, accuracy: 10 }, timestamp: 3 });
      await vi.advanceTimersByTimeAsync(0);
      expect(t.bufferLocal).toEqual([]);
      expect(localStorage.getItem('sv_tracking_buffer')).toBeNull();
      expect(trackingApi.batchPuntos).not.toHaveBeenCalled();
    });

    it('un buffer en formato anterior se trata como inexistente', () => {
      localStorage.setItem('sv_tracking_jornada', JSON.stringify(copia()));
      localStorage.setItem('sv_tracking_buffer', JSON.stringify([pt(1)]));
      const t = useTrackingStore();
      expect(t.reanudarLocal()).toBe(true);
      expect(t.bufferLocal).toEqual([]);
    });
  });

  describe('flush', () => {
    function conPuntos(n) {
      guardar(copia(), { jor_id: 'J1', puntos: Array.from({ length: n }, (_, i) => pt(i + 1)) });
      const t = useTrackingStore();
      t.reanudarLocal();
      return t;
    }

    it('JORNADA_CERRADA detiene y limpia', async () => {
      trackingApi.batchPuntos.mockRejectedValue(errHttp(409, 'JORNADA_CERRADA'));
      const t = conPuntos(2);
      await t.flush();
      expect(t.estaActiva).toBe(false);
      expect(geo.clearWatch).toHaveBeenCalled();
      expect(localStorage.getItem('sv_tracking_jornada')).toBeNull();
    });

    it('403 detiene y limpia', async () => {
      trackingApi.batchPuntos.mockRejectedValue(errHttp(403, 'FORBIDDEN'));
      const t = conPuntos(2);
      await t.flush();
      expect(t.estaActiva).toBe(false);
      expect(t.bufferLocal).toEqual([]);
      expect(localStorage.getItem('sv_tracking_buffer')).toBeNull();
    });

    it('422 descarta ese lote y conserva los siguientes', async () => {
      trackingApi.batchPuntos.mockRejectedValue(errHttp(422, 'VALIDATION_ERROR'));
      const t = conPuntos(130);
      await t.flush();
      expect(t.estaActiva).toBe(true);
      expect(t.bufferLocal).toHaveLength(30);
      expect(t.bufferLocal[0].ts).toBe(101);
      expect(JSON.parse(localStorage.getItem('sv_tracking_buffer')).puntos).toHaveLength(30);
    });

    it('sin red conserva todo', async () => {
      trackingApi.batchPuntos.mockRejectedValue(new Error('Network Error'));
      const t = conPuntos(3);
      await t.flush();
      expect(t.estaActiva).toBe(true);
      expect(t.bufferLocal).toHaveLength(3);
    });
  });
});
