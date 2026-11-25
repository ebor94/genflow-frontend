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
import { useAuthStore } from '@/stores/useAuthStore';

function iniciarSesion(usrId = 1, rol = 'ASESOR') {
  const auth = useAuthStore();
  auth.accessToken = 'a';
  auth.usuario = { usr_id: usrId, rol: { rol_codigo: rol } };
  return auth;
}
function diferida() {
  let resolve, reject;
  const promesa = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promesa, resolve, reject };
}
const SIN_INICIAR = { data: { estado: 'sin_iniciar', requiere_popup: true } };
const ACTIVA = { data: { estado: 'activa', requiere_popup: false, jornada: { jor_id: 'x' } } };

describe('useJornadaObligatoriaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    tracking.reanudarLocal.mockReturnValue(false);
    iniciarSesion();
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

  it('sin sesión no consulta ni toca la captura', async () => {
    useAuthStore().accessToken = null;
    await useJornadaObligatoriaStore().chequear();
    expect(trackingApi.estadoJornadaHoy).not.toHaveBeenCalled();
    expect(tracking.detener).not.toHaveBeenCalled();
  });

  it.each(['SUPER_ADMIN', 'GERENTE_GENERAL', 'DIRECTOR_COMERCIAL'])('rol %s → ok y detiene sin consultar', async (rol) => {
    iniciarSesion(1, rol);
    trackingApi.estadoJornadaHoy.mockRejectedValue(new Error('Network Error'));
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(trackingApi.estadoJornadaHoy).not.toHaveBeenCalled();
    expect(s.estado).toBe('ok');
    expect(tracking.detener).toHaveBeenCalled();
    expect(tracking.reanudarLocal).not.toHaveBeenCalled();
  });

  it('activa sin jornada no arranca la captura', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({ data: { estado: 'activa', requiere_popup: false, jornada: null } });
    await useJornadaObligatoriaStore().chequear();
    expect(tracking.reanudar).not.toHaveBeenCalled();
    expect(tracking.detener).toHaveBeenCalled();
  });

  it('una respuesta sin_iniciar tardía no vuelve a mostrar el popup ni apaga la captura', async () => {
    const d = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValue(d.promesa);
    const s = useJornadaObligatoriaStore();
    const p = s.chequear();
    s.marcarJornadaIniciada();
    d.resolve(SIN_INICIAR);
    await p;
    expect(s.estado).toBe('ok');
    expect(tracking.detener).not.toHaveBeenCalled();
  });

  it('una activa tardía tras marcar ausencia no enciende la captura', async () => {
    const d = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValue(d.promesa);
    trackingApi.registrarAusenciaHoy.mockResolvedValue({});
    const s = useJornadaObligatoriaStore();
    const p = s.chequear();
    await s.marcarAusencia({ tipo: 'PERMISO', motivo: 'cita' });
    d.resolve(ACTIVA);
    await p;
    expect(s.estado).toBe('ausente');
    expect(tracking.reanudar).not.toHaveBeenCalled();
  });

  it('una respuesta que llega tras reset se ignora', async () => {
    const d = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValue(d.promesa);
    const s = useJornadaObligatoriaStore();
    const p = s.chequear();
    s.reset();
    d.resolve(ACTIVA);
    await p;
    expect(s.estado).toBe('sin_chequear');
    expect(tracking.reanudar).not.toHaveBeenCalled();
  });

  it('un error tardío tras reset se ignora', async () => {
    const d = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValue(d.promesa);
    const s = useJornadaObligatoriaStore();
    const p = s.chequear();
    s.reset();
    d.reject(new Error('Network Error'));
    await p;
    expect(s.estado).toBe('sin_chequear');
    expect(tracking.reanudarLocal).not.toHaveBeenCalled();
  });

  it('si cambia la persona mientras se chequea, la respuesta no se aplica', async () => {
    const d = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValue(d.promesa);
    const s = useJornadaObligatoriaStore();
    const p = s.chequear();
    iniciarSesion(2);
    d.resolve(ACTIVA);
    await p;
    expect(s.estado).toBe('sin_chequear');
    expect(tracking.reanudar).not.toHaveBeenCalled();
  });

  it('si se cierra la sesión mientras se chequea, la respuesta no se aplica', async () => {
    const d = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValue(d.promesa);
    const s = useJornadaObligatoriaStore();
    const p = s.chequear();
    useAuthStore().accessToken = null;
    d.resolve(ACTIVA);
    await p;
    expect(tracking.reanudar).not.toHaveBeenCalled();
  });

  it('force se adelanta a un chequeo en curso y la respuesta vieja se ignora', async () => {
    const d1 = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValueOnce(d1.promesa).mockResolvedValueOnce(ACTIVA);
    const s = useJornadaObligatoriaStore();
    const p1 = s.chequear();
    await s.chequear({ force: true });
    expect(s.estado).toBe('ok');
    d1.resolve(SIN_INICIAR);
    await p1;
    expect(s.estado).toBe('ok');
    expect(trackingApi.estadoJornadaHoy).toHaveBeenCalledTimes(2);
  });

  it('sin force no se adelanta a un chequeo en curso', async () => {
    const d1 = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValue(d1.promesa);
    const s = useJornadaObligatoriaStore();
    const p1 = s.chequear();
    await s.chequear();
    expect(trackingApi.estadoJornadaHoy).toHaveBeenCalledTimes(1);
    d1.resolve(ACTIVA);
    await p1;
  });

  it('una activa que llega mientras se registra la ausencia no enciende la captura', async () => {
    const d = diferida(); const da = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValue(d.promesa);
    trackingApi.registrarAusenciaHoy.mockReturnValue(da.promesa);
    const s = useJornadaObligatoriaStore();
    const p = s.chequear();
    const pa = s.marcarAusencia({ tipo: 'PERMISO', motivo: 'cita' });
    d.resolve(ACTIVA);
    await p;
    expect(tracking.reanudar).not.toHaveBeenCalled();
    da.resolve({});
    await pa;
    expect(s.estado).toBe('ausente');
  });

  it('la respuesta vieja que termina no libera el chequeo del turno nuevo', async () => {
    const d1 = diferida(); const d2 = diferida();
    trackingApi.estadoJornadaHoy.mockReturnValueOnce(d1.promesa).mockReturnValueOnce(d2.promesa);
    const s = useJornadaObligatoriaStore();
    const p1 = s.chequear();
    const p2 = s.chequear({ force: true });
    d1.resolve(SIN_INICIAR);
    await p1;
    expect(s.chequeando).toBe(true);
    await s.chequear();
    expect(trackingApi.estadoJornadaHoy).toHaveBeenCalledTimes(2);
    d2.resolve(ACTIVA);
    await p2;
    expect(s.chequeando).toBe(false);
  });
});
