import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/authApi', () => ({
  authApi: { logout: vi.fn().mockResolvedValue({}) }
}));
vi.mock('@/api/trackingApi', () => ({
  trackingApi: { finalizarJornada: vi.fn(), batchPuntos: vi.fn() }
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
    expect(trackingApi.finalizarJornada).not.toHaveBeenCalled();
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
});
