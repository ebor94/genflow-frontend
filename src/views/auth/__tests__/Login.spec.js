import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

const push = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

import Login from '@/views/auth/Login.vue';
import { useAuthStore } from '@/stores/useAuthStore';

function factory() {
  return mount(Login, {
    global: {
      plugins: [createTestingPinia({
        createSpy: vi.fn,
        initialState: { svAuth: { usuario: { usr_nombre: 'Patricia' } } }
      })]
    }
  });
}

async function enviar(w, usuario, password) {
  const inputs = w.findAll('input');
  await inputs[0].setValue(usuario);
  await inputs[1].setValue(password);
  await w.find('form').trigger('submit');
  await flushPromises();
}

describe('Login.vue', () => {
  it('muestra el copy de usuario de red', () => {
    const w = factory();
    expect(w.text()).toContain('Usuario de red o correo');
    expect(w.text()).toContain('Usa el mismo usuario y clave de Windows');
    const input = w.findAll('input')[0];
    expect(input.attributes('placeholder')).toBe('psantafe');
    expect(input.attributes('type')).toBe('text');
    expect(input.attributes('autocomplete')).toBe('username');
  });

  it('llama a auth.login con el usuario recortado', async () => {
    const w = factory();
    await enviar(w, '  psantafe  ', 'clave');
    expect(useAuthStore().login).toHaveBeenCalledWith('psantafe', 'clave');
  });

  it('exige usuario y contraseña', async () => {
    const w = factory();
    await enviar(w, '', '');
    expect(w.text()).toContain('Usuario y contraseña son requeridos');
    expect(useAuthStore().login).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'Usuario o contraseña incorrectos'],
    [403, 'Tu usuario de red no tiene acceso a GenFlow.'],
    [429, 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.'],
    [503, 'No hay conexión con el directorio activo, intenta en unos minutos.']
  ])('muestra el mensaje del backend para %i', async (status, message) => {
    const w = factory();
    useAuthStore().login.mockRejectedValue({ response: { status, data: { message } } });
    await enviar(w, 'psantafe', 'clave');
    expect(w.text()).toContain(message);
  });
});
