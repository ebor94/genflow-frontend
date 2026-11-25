import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ruta, push, back } = vi.hoisted(() => ({
  ruta: { params: { id: '900' }, query: {} }, push: vi.fn(), back: vi.fn()
}));
vi.mock('vue-router', () => ({
  useRoute: () => ruta,
  useRouter: () => ({ push, back }),
  RouterLink: { template: '<a><slot /></a>' }
}));
vi.mock('@/api/salasApi', () => ({ salasApi: { obtener: vi.fn() } }));
vi.mock('@/api/personasApi', () => ({ personasApi: { prospectosActivos: vi.fn(async () => ({ data: [] })) } }));

import { salasApi } from '@/api/salasApi';
import { useProspectosStore } from '@/stores/useProspectosStore';
import FichaCliente from '@/views/prenecesidad/FichaCliente.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';

const PROSPECTO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1, prosp_persona_id: 500, prosp_prioridad: 3,
  persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' },
  estado: { estado_nombre: 'Nuevo', estado_color_hex: '#8A6A52' },
  asesor: { usr_nombre: 'Denis', usr_apellido: 'Moreno' }, productos: []
};
const HOMENAJE = {
  id: 56, estado: 'ABIERTO', sala_nombre: 'Sala 3', sede_nombre: 'Sede Norte',
  nombre_ser_querido: 'Luis Pérez', cliente: { prosp_id: 900, es_mio: true }, puede_atender: true
};

function factory() {
  return mount(FichaCliente, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo: PROSPECTO } } })],
      stubs: {
        teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true,
        ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true, VentasCliente: true
      }
    }
  });
}

describe('FichaCliente con ?homenaje', () => {
  beforeEach(() => { vi.clearAllMocks(); ruta.query = {}; });

  it('muestra el aviso y pasa el homenaje al formulario cuando es el mismo cliente', async () => {
    ruta.query = { homenaje: '56' };
    salasApi.obtener.mockResolvedValue({ success: true, data: HOMENAJE });
    const w = factory();
    await flushPromises();
    expect(salasApi.obtener).toHaveBeenCalledWith(56);
    expect(w.find('[data-testid="aviso-visita-sala"]').text())
      .toContain('Visita en sala — Sala 3, Sede Norte · homenaje de Luis Pérez');
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBe(56);
  });

  it('ignora el homenaje de otro cliente', async () => {
    ruta.query = { homenaje: '56' };
    salasApi.obtener.mockResolvedValue({ success: true, data: { ...HOMENAJE, cliente: { prosp_id: 901, es_mio: false } } });
    const w = factory();
    await flushPromises();
    expect(salasApi.obtener).toHaveBeenCalledWith(56);
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(false);
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBeNull();
  });

  it('ignora el homenaje si el usuario no puede atender', async () => {
    ruta.query = { homenaje: '56' };
    salasApi.obtener.mockResolvedValue({ success: true, data: { ...HOMENAJE, puede_atender: false } });
    const w = factory();
    await flushPromises();
    expect(salasApi.obtener).toHaveBeenCalledWith(56);
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(false);
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBeNull();
  });

  it('al cerrarse el homenaje desde el formulario quita el aviso y suelta el modo sala', async () => {
    ruta.query = { homenaje: '56' };
    salasApi.obtener.mockResolvedValue({ success: true, data: HOMENAJE });
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(true);
    w.findComponent(RegistrarGestion).vm.$emit('sala-cerrada');
    await flushPromises();
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(false);
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBeNull();
  });

  it('ignora un homenaje finalizado o con error', async () => {
    ruta.query = { homenaje: '56' };
    salasApi.obtener.mockResolvedValue({ success: true, data: { ...HOMENAJE, estado: 'FINALIZADO' } });
    let w = factory();
    await flushPromises();
    expect(salasApi.obtener).toHaveBeenCalledWith(56);
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(false);

    salasApi.obtener.mockRejectedValue({ response: { status: 404 } });
    w = factory();
    await flushPromises();
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(false);
  });

  it('al cambiar de cliente, la visita del anterior no se aplica al nuevo', async () => {
    ruta.query = { homenaje: '56' };
    salasApi.obtener.mockResolvedValue({ success: true, data: HOMENAJE });
    const pinia = createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo: PROSPECTO } } });
    const w = mount(FichaCliente, {
      global: { plugins: [pinia], stubs: {
        teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true,
        ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true, VentasCliente: true } }
    });
    await flushPromises();
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBe(56);
    const store = useProspectosStore(pinia);
    store.activo = { ...PROSPECTO, prosp_id: 901 };
    await w.vm.$nextTick();
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBeNull();
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(false);
  });

  it('sin ?homenaje no consulta salas', async () => {
    const w = factory();
    await flushPromises();
    expect(salasApi.obtener).not.toHaveBeenCalled();
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBeNull();
  });
});
