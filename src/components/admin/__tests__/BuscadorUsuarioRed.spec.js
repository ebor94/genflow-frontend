import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/usuariosApi', () => ({ usuariosApi: { directorio: vi.fn() } }));

import { usuariosApi } from '@/api/usuariosApi';
import BuscadorUsuarioRed from '@/components/admin/BuscadorUsuarioRed.vue';

function factory(props = {}) {
  return mount(BuscadorUsuarioRed, {
    props: { modelValue: '', ...props },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })] }
  });
}

async function escribir(w, texto) {
  await w.find('[data-testid="buscador-usuario-red"]').setValue(texto);
  vi.advanceTimersByTime(300);
  await flushPromises();
}

describe('BuscadorUsuarioRed', () => {
  // Solo se falsea setTimeout: flushPromises usa setImmediate y se colgaría si también se falsea.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); vi.clearAllMocks(); });
  afterEach(() => vi.useRealTimers());

  it('no consulta con menos de 3 caracteres', async () => {
    const w = factory();
    await escribir(w, 'pa');
    expect(usuariosApi.directorio).not.toHaveBeenCalled();
  });

  it('consulta tras 300 ms y lista los resultados', async () => {
    usuariosApi.directorio.mockResolvedValue({ data: [{ usuario: 'psantafe', nombre: 'PATRICIA SANTAFE', mail: 'p@x.co' }] });
    const w = factory();
    await escribir(w, 'santa');
    expect(usuariosApi.directorio).toHaveBeenCalledWith('santa');
    expect(w.find('[data-testid="resultados-usuario-red"]').text()).toContain('PATRICIA SANTAFE');
    expect(w.text()).toContain('psantafe');
  });

  it('al elegir emite el usuario y el item', async () => {
    const item = { usuario: 'psantafe', nombre: 'PATRICIA SANTAFE', mail: 'p@x.co' };
    usuariosApi.directorio.mockResolvedValue({ data: [item] });
    const w = factory();
    await escribir(w, 'santa');
    await w.find('[data-testid="resultados-usuario-red"] button').trigger('click');
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['psantafe']);
    expect(w.emitted('seleccionar')[0]).toEqual([item]);
    expect(w.find('[data-testid="resultados-usuario-red"]').exists()).toBe(false);
  });

  it('muestra el error del backend', async () => {
    usuariosApi.directorio.mockRejectedValue({ response: { data: { message: 'No hay conexión con el directorio activo, intenta en unos minutos.' } } });
    const w = factory();
    await escribir(w, 'santa');
    expect(w.text()).toContain('No hay conexión con el directorio activo, intenta en unos minutos.');
  });
});
