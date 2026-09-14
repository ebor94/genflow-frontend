import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/trackingApi', () => ({
  trackingApi: {
    estadoJornadaHoy:     vi.fn(),
    registrarAusenciaHoy: vi.fn(),
    eliminarAusenciaHoy:  vi.fn()
  }
}));

import { trackingApi } from '@/api/trackingApi';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';

describe('useJornadaObligatoriaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
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
});
