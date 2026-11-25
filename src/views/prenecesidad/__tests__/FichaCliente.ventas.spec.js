import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue');
  const ruta = reactive({ params: { id: '900' }, query: {} });
  return {
    useRoute: () => ruta,
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
    RouterLink: { template: '<a><slot /></a>' }
  };
});
vi.mock('@/api/salasApi', () => ({ salasApi: { obtener: vi.fn() } }));
vi.mock('@/api/personasApi', () => ({ personasApi: { prospectosActivos: vi.fn(async () => ({ data: [] })) } }));
vi.mock('@/api/prospectosApi', () => ({ prospectosApi: { get: vi.fn() } }));
vi.mock('@/api/gestionesApi', () => ({ gestionesApi: { historial: vi.fn() } }));
vi.mock('@/api/ventasApi', () => ({ ventasApi: { deProspecto: vi.fn() } }));

import { useRoute } from 'vue-router';
import { gestionesApi } from '@/api/gestionesApi';
import { prospectosApi } from '@/api/prospectosApi';
import { ventasApi } from '@/api/ventasApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConfigStore } from '@/stores/useConfigStore';
import { useProspectosStore } from '@/stores/useProspectosStore';
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

// La ruta es una sola para todas las pruebas: una ficha que quede montada reaccionaría a ella.
enableAutoUnmount(afterEach);

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

  it('la recarga espera a que llegue el cliente', async () => {
    const w = await montar('ASESOR');
    const version = () => w.findComponent(VentasCliente).props('version');
    const antes = version();
    let llega;
    useProspectosStore().fetchOne.mockImplementationOnce(() => new Promise((r) => { llega = r; }));
    w.findComponent(RegistrarGestion).vm.$emit('registrada', {});
    await flushPromises();
    expect(version()).toBe(antes);
    llega();
    await flushPromises();
    expect(version()).toBe(antes + 1);
  });
});

describe('FichaCliente: cuántas veces se piden las ventas', () => {
  const pedidas = () => ventasApi.deProspecto.mock.calls.map((c) => c[0]);

  async function abrir(id) {
    const ruta = useRoute();
    ruta.params.id = String(id);
    const w = mount(FichaCliente, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
        stubs: { teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true,
          ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true }
      }
    });
    await flushPromises();
    return { w, ruta };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prospectosApi.get.mockImplementation(async (id) => ({ data: { ...ACTIVO, prosp_id: id } }));
    gestionesApi.historial.mockResolvedValue({ data: { items: [], page: 1, total: 0, hasMore: false } });
    ventasApi.deProspecto.mockResolvedValue({ data: [] });
  });

  it('una al abrir la ficha y otra por cada gestión', async () => {
    const { w } = await abrir(900);
    expect(pedidas()).toEqual([900]);
    w.findComponent(RegistrarGestion).vm.$emit('registrada', null);
    await flushPromises();
    expect(pedidas()).toEqual([900, 900]);
  });

  it('al pasar a otro cliente, solo las del nuevo y una vez', async () => {
    const { ruta } = await abrir(900);
    ventasApi.deProspecto.mockClear();
    ruta.params.id = '901';
    await flushPromises();
    expect(pedidas()).toEqual([901]);
  });
});
