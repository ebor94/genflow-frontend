import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/authApi', () => ({
  authApi: { logout: vi.fn().mockResolvedValue({}) }
}));
vi.mock('@/api/trackingApi', () => ({
  trackingApi: { batchPuntos: vi.fn() }
}));

import { authApi } from '@/api/authApi';
import { trackingApi } from '@/api/trackingApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTrackingStore } from '@/stores/useTrackingStore';

describe('useAuthStore.logout', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.clearAllMocks(); });

  function sesion() {
    const auth = useAuthStore();
    auth.accessToken = 'a'; auth.refreshToken = 'r'; auth.usuario = { usr_id: 1 };
    return auth;
  }

  it('pausa la captura y no finaliza la jornada', async () => {
    const auth = sesion();
    const tracking = useTrackingStore();
    const pausar = vi.spyOn(tracking, 'pausar').mockResolvedValue();
    await auth.logout();
    expect(pausar).toHaveBeenCalledTimes(1);
    expect(trackingApi.finalizarJornada).toBeUndefined();
    expect(authApi.logout).toHaveBeenCalledWith('r');
    expect(auth.accessToken).toBeNull();
  });

  it('cierra la sesión aunque pausar falle', async () => {
    const auth = sesion();
    vi.spyOn(useTrackingStore(), 'pausar').mockRejectedValue(new Error('boom'));
    await auth.logout();
    expect(authApi.logout).toHaveBeenCalledWith('r');
    expect(auth.accessToken).toBeNull();
    expect(auth.usuario).toBeNull();
  });

  it('espera a pausar antes de cerrar la sesión', async () => {
    const auth = sesion();
    let fin;
    vi.spyOn(useTrackingStore(), 'pausar').mockReturnValue(new Promise((r) => { fin = r; }));
    const p = auth.logout();
    await Promise.resolve(); await Promise.resolve();
    expect(auth.accessToken).toBe('a');
    expect(authApi.logout).not.toHaveBeenCalled();
    fin();
    await p;
    expect(auth.accessToken).toBeNull();
  });

  it('después de cerrar la sesión vuelve a detener la captura conservando los pendientes', async () => {
    const auth = sesion();
    const tracking = useTrackingStore();
    vi.spyOn(tracking, 'pausar').mockResolvedValue();
    const detener = vi.spyOn(tracking, 'detener');
    await auth.logout();
    expect(detener).toHaveBeenCalledWith({ borrarPendientes: false });
    expect(auth.accessToken).toBeNull();
  });
});
