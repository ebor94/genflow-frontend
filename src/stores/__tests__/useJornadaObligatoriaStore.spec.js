import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/trackingApi', () => ({
  trackingApi: {
    estadoJornadaHoy:     vi.fn(),
    registrarAusenciaHoy: vi.fn(),
    eliminarAusenciaHoy:  vi.fn()
  }
}));

const tracking = vi.hoisted(() => ({
  reanudar: vi.fn(), detener: vi.fn(), reanudarLocal: vi.fn(() => false)
}));
vi.mock('@/stores/useTrackingStore', () => ({ useTrackingStore: () => tracking }));

import { trackingApi } from '@/api/trackingApi';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';

describe('useJornadaObligatoriaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    tracking.reanudarLocal.mockReturnValue(false);
  });

  it('estado inicial es sin_chequear', () => {
    const s = useJornadaObligatoriaStore();
    expect(s.estado).toBe('sin_chequear');
    expect(s.debeBloquear).toBe(false);
  });

  it('chequear con requiere_popup=true → bloqueado', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({
      data: { estado: 'sin_iniciar', requiere_popup: true, jornada: null, ausencia: null }
    });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('bloqueado');
    expect(s.debeBloquear).toBe(true);
  });

  it('chequear con requiere_popup=false → ok', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({
      data: { estado: 'activa', requiere_popup: false, jornada: { jor_id: 'x' }, ausencia: null }
    });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('ok');
  });

  it('chequear con estado=ausente → ausente', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({
      data: { estado: 'ausente', requiere_popup: false, ausencia: { aus_id: 1 } }
    });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('ausente');
  });

  it('chequear con error de red → fail closed (bloqueado)', async () => {
    trackingApi.estadoJornadaHoy.mockRejectedValue(new Error('Network Error'));
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('bloqueado');
    expect(s.debeBloquear).toBe(true);
  });

  it('cachea 60s salvo force=true', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({
      data: { estado: 'sin_iniciar', requiere_popup: true }
    });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    await s.chequear();
    expect(trackingApi.estadoJornadaHoy).toHaveBeenCalledTimes(1);
    await s.chequear({ force: true });
    expect(trackingApi.estadoJornadaHoy).toHaveBeenCalledTimes(2);
  });

  it('marcarAusencia deja estado=ausente', async () => {
    trackingApi.registrarAusenciaHoy.mockResolvedValue({ data: { aus_id: 9 } });
    const s = useJornadaObligatoriaStore();
    await s.marcarAusencia({ tipo: 'PERMISO', motivo: 'cita' });
    expect(s.estado).toBe('ausente');
    expect(trackingApi.registrarAusenciaHoy).toHaveBeenCalledWith({
      tipo: 'PERMISO', motivo: 'cita'
    });
  });

  it('marcarJornadaIniciada deja estado=ok', () => {
    const s = useJornadaObligatoriaStore();
    s.marcarJornadaIniciada();
    expect(s.estado).toBe('ok');
  });

  it('reset vuelve a sin_chequear', () => {
    const s = useJornadaObligatoriaStore();
    s.marcarJornadaIniciada();
    s.reset();
    expect(s.estado).toBe('sin_chequear');
  });

  it('activa → ok y reanuda la captura con la jornada del backend', async () => {
    const jornada = { jor_id: 'x', jor_inicio_at: 'a' };
    trackingApi.estadoJornadaHoy.mockResolvedValue({ data: { estado: 'activa', requiere_popup: false, jornada } });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('ok');
    expect(tracking.reanudar).toHaveBeenCalledWith(jornada);
    expect(tracking.detener).not.toHaveBeenCalled();
  });

  it('ausente → detiene la captura', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({ data: { estado: 'ausente', requiere_popup: false } });
    await useJornadaObligatoriaStore().chequear();
    expect(tracking.detener).toHaveBeenCalled();
    expect(tracking.reanudar).not.toHaveBeenCalled();
  });

  it('sin_iniciar con popup → bloqueado y detiene', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({ data: { estado: 'sin_iniciar', requiere_popup: true } });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('bloqueado');
    expect(tracking.detener).toHaveBeenCalled();
  });

  it('finalizada → ok y detiene', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({ data: { estado: 'finalizada', requiere_popup: false, jornada: { jor_id: 'x' } } });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('ok');
    expect(tracking.detener).toHaveBeenCalled();
    expect(tracking.reanudar).not.toHaveBeenCalled();
  });

  it('rol no operativo (sin_iniciar sin popup) → ok y detiene', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({ data: { estado: 'sin_iniciar', requiere_popup: false } });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('ok');
    expect(tracking.detener).toHaveBeenCalled();
  });

  it('error de red con copia válida de hoy → ok', async () => {
    trackingApi.estadoJornadaHoy.mockRejectedValue(new Error('Network Error'));
    tracking.reanudarLocal.mockReturnValue(true);
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('ok');
  });

  it('marcarAusencia detiene la captura', async () => {
    trackingApi.registrarAusenciaHoy.mockResolvedValue({ data: { aus_id: 9 } });
    await useJornadaObligatoriaStore().marcarAusencia({ tipo: 'PERMISO', motivo: 'cita' });
    expect(tracking.detener).toHaveBeenCalled();
  });
});
