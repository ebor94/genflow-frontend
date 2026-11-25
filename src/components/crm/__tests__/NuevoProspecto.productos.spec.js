import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/personasApi', () => ({ personasApi: { buscar: vi.fn(), create: vi.fn() } }));

import { personasApi } from '@/api/personasApi';
import { useConfigStore } from '@/stores/useConfigStore';
import { useProspectosStore } from '@/stores/useProspectosStore';
import NuevoProspecto from '@/components/crm/NuevoProspecto.vue';
import SelectorProductos from '@/components/crm/SelectorProductos.vue';

const prod = (prod_id, prod_nombre, prod_tipo) => ({
  prod_id, prod_nombre, prod_tipo, prod_area_id: 1, prod_activo: 1, prod_orden_display: prod_id, prod_categoria: 'Mausoleos', prod_es_generico: 0
});

async function enPaso2(productos) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore(pinia).actual = {
    productos, fuentes: [], puntos: [],
    estados: [
      { estado_id: 11, estado_grupo_id: 1, estado_activo: 1, estado_orden: 1, estado_nombre: 'Nuevo', estado_es_ganado: 0 },
      { estado_id: 15, estado_grupo_id: 1, estado_activo: 1, estado_orden: 5, estado_nombre: 'Contrato cerrado', estado_es_ganado: 1 }
    ]
  };
  personasApi.buscar.mockRejectedValue({ response: { status: 404 } });
  const w = mount(NuevoProspecto, {
    props: { open: false, areaId: 1, grupoId: 1 },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await w.setProps({ open: true });
  await w.find('input').setValue('3001234567');
  await w.findAll('button').find((b) => b.text().trim() === 'Validar teléfono').trigger('click');
  await flushPromises();
  return { w, store: useProspectosStore(pinia) };
}

describe('NuevoProspecto: productos de interés', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con tipos usa el selector y envía lo elegido', async () => {
    const { w, store } = await enPaso2([prod(2, 'Osario A2', 'Osarios')]);
    personasApi.create.mockResolvedValue({ data: { persona_id: 500 } });
    store.crear.mockResolvedValue({ prosp_id: 900 });
    const s = w.findComponent(SelectorProductos);
    expect(s.exists()).toBe(true);
    s.vm.$emit('update:modelValue', [{ prod_id: 2, es_principal: true, nota: null }]);
    await w.vm.$nextTick();
    const nombre = w.findAll('input').find((i) => i.element.value === '' && i.attributes('type') !== 'email');
    await nombre.setValue('Marta');
    await w.findAll('button').find((b) => b.text().trim() === 'Crear prospecto').trigger('click');
    await flushPromises();
    expect(store.crear.mock.calls[0][0].productos).toEqual([{ prod_id: 2, es_principal: true, nota: null }]);
  });

  it('sin tipos conserva los botones de siempre', async () => {
    const { w } = await enPaso2([prod(3, 'Contrato SAP', null)]);
    expect(w.findComponent(SelectorProductos).exists()).toBe(false);
    expect(w.findAll('button').some((b) => b.text().trim() === 'Contrato SAP')).toBe(true);
  });
});

describe('NuevoProspecto: estado inicial', () => {
  beforeEach(() => vi.clearAllMocks());
  const estados = (w) => w.findAll('label').find((l) => l.text().startsWith('Estado inicial'))
    .element.parentElement.querySelectorAll('option:not([disabled])');
  const nombres = (w) => [...estados(w)].map((o) => o.textContent.trim());

  it('donde se registran ventas no se ofrece un estado ganado', async () => {
    expect(nombres((await enPaso2([prod(2, 'Osario A2', 'Osarios')])).w)).toEqual(['Nuevo']);
  });

  it('en las demás áreas se ofrecen todos, como siempre', async () => {
    expect(nombres((await enPaso2([prod(3, 'Contrato SAP', null)])).w)).toEqual(['Nuevo', 'Contrato cerrado']);
  });
});
