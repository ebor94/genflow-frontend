import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/api/trackingApi', () => ({ trackingApi: { exportarMisDatos: vi.fn() } }));

import MiPerfil from '@/views/perfil/MiPerfil.vue';

function factory(usuario) {
  return mount(MiPerfil, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, initialState: { svAuth: { usuario } } })],
      stubs: { teleport: true }
    }
  });
}

describe('MiPerfil.vue', () => {
  it('muestra el usuario de red y no ofrece cambiar la contraseña', () => {
    const w = factory({ usr_nombre: 'Patricia', usr_apellido: 'S', usr_email: 'p@x.co', ad_usuario: 'psantafe' });
    const fila = w.find('[data-testid="fila-usuario-red"]');
    expect(fila.text()).toContain('Usuario de red');
    expect(fila.text()).toContain('psantafe');
    expect(fila.text()).toContain('La clave se cambia en Windows o con TI.');
    expect(w.text()).not.toContain('Cambiar contraseña');
    expect(w.find('input[type="password"]').exists()).toBe(false);
  });

  it('indica cuando el usuario no está vinculado', () => {
    const w = factory({ usr_nombre: 'Ana', usr_apellido: 'G', usr_email: 'a@x.co', ad_usuario: null });
    expect(w.find('[data-testid="fila-usuario-red"]').text()).toContain('sin vincular');
  });
});
