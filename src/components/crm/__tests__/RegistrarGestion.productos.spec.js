import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/salasApi', () => ({ salasApi: { registrarVisita: vi.fn() } }));
vi.mock('@/api/prospectosApi', () => ({ prospectosApi: { actualizarProductos: vi.fn() } }));

import { prospectosApi } from '@/api/prospectosApi';
import { useConfigStore } from '@/stores/useConfigStore';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import SelectorProductos from '@/components/crm/SelectorProductos.vue';

const prod = (prod_id, prod_nombre, prod_tipo, prod_activo = 1) => ({
  prod_id, prod_nombre, prod_tipo, prod_area_id: 1, prod_activo, prod_orden_display: prod_id, prod_categoria: 'Mausoleos', prod_es_generico: 0
});
const INACTIVO = prod(3, 'Velación', null, 0);
const PROSPECTO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1,
  persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' },
  productos: [{ pp_prod_id: 3, pp_es_principal: 1, pp_nota: null, pp_precio_ofrecido: null, producto: INACTIVO }]
};

async function abrir(productos) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore(pinia).actual = {
    productos, estados: [],
    resultados: [{ resultado_id: 3, resultado_grupo_id: 1, resultado_activo: 1, resultado_orden: 1, resultado_nombre: 'Interesado', resultado_requiere_fecha: 0 }]
  };
  const w = mount(RegistrarGestion, {
    props: { open: false, prospecto: PROSPECTO },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await w.setProps({ open: true });
  return w;
}
const editar = async (w) => w.findAll('button').find((b) => b.text().trim() === 'Editar').trigger('click');

describe('RegistrarGestion: productos de interés', () => {
  beforeEach(() => vi.clearAllMocks());

  it('un interés con producto inactivo se ve con su nombre, no con #id', async () => {
    const w = await abrir([prod(2, 'Osario A2', 'Osarios')]);
    expect(w.text()).toContain('Velación');
    expect(w.text()).not.toContain('#3');
  });

  it('con tipos edita con el selector y guarda lo elegido', async () => {
    const w = await abrir([prod(2, 'Osario A2', 'Osarios')]);
    await editar(w);
    const s = w.findComponent(SelectorProductos);
    expect(s.exists()).toBe(true);
    expect(s.props('actuales')).toEqual(PROSPECTO.productos);
    expect(s.props('modelValue')).toEqual([{ prod_id: 3, es_principal: true, nota: null }]);
    s.vm.$emit('update:modelValue', [{ prod_id: 2, es_principal: true, nota: null }]);
    await w.vm.$nextTick();
    await w.findAll('select')[1].setValue('3');
    await w.findAll('button').find((b) => b.text().trim() === 'Registrar').trigger('click');
    await flushPromises();
    expect(prospectosApi.actualizarProductos).toHaveBeenCalledWith(900, [{ prod_id: 2, es_principal: true, nota: null }]);
  });

  it('sin tipos conserva la lista de siempre', async () => {
    const w = await abrir([prod(5, 'Plan empresarial', null)]);
    await editar(w);
    expect(w.findComponent(SelectorProductos).exists()).toBe(false);
    expect(w.findAll('input[type="checkbox"]')).toHaveLength(1);
  });
});
