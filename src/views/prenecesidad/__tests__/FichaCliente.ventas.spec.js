import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '900' }, query: {} }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' }
}));
vi.mock('@/api/salasApi', () => ({ salasApi: { obtener: vi.fn() } }));
vi.mock('@/api/personasApi', () => ({ personasApi: { prospectosActivos: vi.fn(async () => ({ data: [] })) } }));

import { useAuthStore } from '@/stores/useAuthStore';
import { useConfigStore } from '@/stores/useConfigStore';
import FichaCliente from '@/views/prenecesidad/FichaCliente.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import VentasCliente from '@/components/crm/VentasCliente.vue';

const ACTIVO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1, prosp_persona_id: 500, prosp_prioridad: 3, productos: [],
  persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' }, asesor: {}, estado: { estado_nombre: 'Nuevo' }
};

async function montar(rol) {
  const pinia = createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo: ACTIVO } } });
  useAuthStore(pinia).puedeReasignar = rol === 'SUPERVISOR';
  useConfigStore(pinia).actual = { productos: [
    { prod_id: 2, prod_area_id: 1, prod_activo: 1 }, { prod_id: 3, prod_area_id: 1, prod_activo: 0 }, { prod_id: 4, prod_area_id: 2, prod_activo: 1 }
  ] };
  const w = mount(FichaCliente, {
    global: {
      plugins: [pinia],
      stubs: { teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true,
        ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true, VentasCliente: true }
    }
  });
  await flushPromises();
  return w;
}

describe('FichaCliente: ventas', () => {
  it('pasa el cliente, el catálogo activo del área y si puede corregir', async () => {
    const v = (await montar('SUPERVISOR')).findComponent(VentasCliente);
    expect(v.props('prospId')).toBe(900);
    expect(v.props('productos').map((p) => p.prod_id)).toEqual([2]);
    expect(v.props('puedeCorregir')).toBe(true);
    expect((await montar('ASESOR')).findComponent(VentasCliente).props('puedeCorregir')).toBe(false);
  });

  it('al registrar una gestión recarga las ventas', async () => {
    const w = await montar('ASESOR');
    const antes = w.findComponent(VentasCliente).props('version');
    w.findComponent(RegistrarGestion).vm.$emit('registrada', {});
    await flushPromises();
    expect(w.findComponent(VentasCliente).props('version')).toBe(antes + 1);
  });
});
