import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/authApi', () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({ data: { accessToken: 'a', refreshToken: 'r', identidad: {} } }),
    me:    vi.fn().mockResolvedValue({ data: { usr_id: 1, usr_area_id: 2, ad_usuario: 'psantafe' } })
  }
}));

import { authApi } from '@/api/authApi';
import { useAuthStore } from '@/stores/useAuthStore';

describe('useAuthStore.login', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.clearAllMocks(); });

  it('envía { usuario, password } al SSO', async () => {
    const auth = useAuthStore();
    await auth.login('psantafe', 'clave');
    expect(authApi.login).toHaveBeenCalledWith({ usuario: 'psantafe', password: 'clave' });
    expect(auth.usuario.ad_usuario).toBe('psantafe');
  });

  it('authApi ya no expone changePassword', () => {
    expect(authApi.changePassword).toBeUndefined();
  });
});
