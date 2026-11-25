import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { it, expect, vi } from 'vitest';

vi.mock('@/api/configApi', () => ({ configApi: { areas: { list: vi.fn(async () => ({ data: [] })) }, productos: {} } }));

import GestionProductos from '@/views/admin/GestionProductos.vue';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

it('administra el tipo y la marca por definir, apagada en un producto nuevo', async () => {
  const w = mount(GestionProductos, { global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { CrudCatalogo: true } } });
  await flushPromises();
  const { campos, columnas } = w.findComponent(CrudCatalogo).props();
  expect(campos.find((c) => c.key === 'prod_tipo')).toEqual({ key: 'prod_tipo', label: 'Tipo', type: 'text' });
  expect(campos.find((c) => c.key === 'prod_es_generico')).toEqual({ key: 'prod_es_generico', label: 'Es "por definir" (representa al tipo, sin precio)', type: 'switch', default: 0 });
  expect(columnas.some((c) => c.key === 'prod_tipo')).toBe(true);
});
