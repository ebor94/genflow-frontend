import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { it, expect, vi } from 'vitest';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

it('al crear usa el default del campo; sin él, los valores de siempre', async () => {
  const apiResource = { list: vi.fn(async () => ({ data: [] })), create: vi.fn(async () => ({})) };
  const w = mount(CrudCatalogo, {
    props: {
      titulo: 'Catálogo', apiResource, filaIdKey: 'id', columnas: [],
      campos: [
        { key: 'nombre', label: 'Nombre', type: 'text' },
        { key: 'orden', label: 'Orden', type: 'number' },
        { key: 'activo', label: 'Activo', type: 'switch' },
        { key: 'generico', label: 'Genérico', type: 'switch', default: 0 }
      ]
    },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } }
  });
  await flushPromises();
  await w.findAll('button').find((b) => b.text().includes('Nuevo')).trigger('click');
  await w.find('form').trigger('submit');
  await flushPromises();
  expect(apiResource.create).toHaveBeenCalledWith({ nombre: '', orden: 0, activo: 1, generico: 0 });
});
