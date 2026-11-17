import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/api/usuariosApi', () => ({
  usuariosApi: {
    list: vi.fn().mockResolvedValue({ data: [
      { usr_id: 1, usr_nombre: 'Ana', usr_apellido: 'G', usr_email: 'a@x.co', usr_activo: 1, usr_rol_id: 4, ad_usuario: 'agomez', rol: { rol_codigo: 'ASESOR' } },
      { usr_id: 2, usr_nombre: 'Beto', usr_apellido: 'R', usr_email: 'b@x.co', usr_activo: 1, usr_rol_id: 4, ad_usuario: null, rol: { rol_codigo: 'ASESOR' } }
    ] }),
    create: vi.fn().mockResolvedValue({ data: {} }),
    update: vi.fn(), toggle: vi.fn(), directorio: vi.fn()
  }
}));
vi.mock('@/api/configApi', () => ({
  configApi: {
    areas:  { list: vi.fn().mockResolvedValue({ data: [] }) },
    grupos: { list: vi.fn().mockResolvedValue({ data: [] }) },
    puntos: { list: vi.fn().mockResolvedValue({ data: [] }) }
  }
}));

import { usuariosApi } from '@/api/usuariosApi';
import GestionUsuarios from '@/views/admin/GestionUsuarios.vue';
import BuscadorUsuarioRed from '@/components/admin/BuscadorUsuarioRed.vue';

async function factory() {
  const w = mount(GestionUsuarios, {
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } },
    attachTo: document.body
  });
  await flushPromises();
  return w;
}

describe('GestionUsuarios.vue', () => {
  it('muestra el usuario de red y marca los no vinculados', async () => {
    const w = await factory();
    expect(w.text()).toContain('agomez');
    expect(w.text()).toContain('sin vincular');
    expect(w.text()).not.toContain('🔑');
  });

  it('el alta pide usuario de red y no contraseña', async () => {
    const w = await factory();
    await w.findAll('button').find(b => b.text().includes('Nuevo Usuario')).trigger('click');
    expect(w.findComponent(BuscadorUsuarioRed).exists()).toBe(true);
    expect(w.find('input[type="password"]').exists()).toBe(false);
  });

  it('al elegir una cuenta del AD rellena nombre, apellido y correo vacíos, y la envía al crear', async () => {
    const w = await factory();
    await w.findAll('button').find(b => b.text().includes('Nuevo Usuario')).trigger('click');
    const buscador = w.findComponent(BuscadorUsuarioRed);
    buscador.vm.$emit('update:modelValue', 'psantafe');
    buscador.vm.$emit('seleccionar', { usuario: 'psantafe', nombre: 'PATRICIA SANTAFE', mail: 'PSantafe@X.co' });
    await flushPromises();

    await w.findAll('button').find(b => b.text() === 'Crear').trigger('click');
    await flushPromises();

    expect(usuariosApi.create).toHaveBeenCalledWith(expect.objectContaining({
      ad_usuario: 'psantafe', usr_nombre: 'PATRICIA', usr_apellido: 'SANTAFE', usr_email: 'psantafe@x.co'
    }));
    expect(usuariosApi.create.mock.calls[0][0]).not.toHaveProperty('usr_password');
  });
});
