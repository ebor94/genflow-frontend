import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/api/trackingApi', () => ({
  trackingApi: {
    iniciarJornada:   vi.fn(),
    finalizarJornada: vi.fn(),
    batchPuntos:      vi.fn()
  }
}));

import { trackingApi } from '@/api/trackingApi';
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
      expect(trackingApi.finalizarJornada).not.toHaveBeenCalled();
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
