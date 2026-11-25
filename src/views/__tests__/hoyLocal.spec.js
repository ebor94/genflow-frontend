import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';

// Hora fija: 25 nov 2026, 8:30 p. m. en Colombia (ya es 26 en UTC).
const AHORA = '2026-11-25T20:30:00';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), RouterLink: { template: '<a><slot /></a>' } }));
vi.mock('@/api/agendaApi', () => ({
  agendaApi: { mes: vi.fn(), dia: vi.fn() },
  eventosAgendaApi: {}
}));
vi.mock('@/api/usuariosApi', () => ({ usuariosApi: { list: vi.fn() } }));
vi.mock('@/api/papApi', () => ({ papApi: { metricas: vi.fn(), mapa: vi.fn() } }));
vi.mock('@/api/reportesApi', () => ({ reportesApi: { asesor: vi.fn() } }));
vi.mock('@/api/propuestasApi', () => ({ propuestasApi: { list: vi.fn() } }));

import { agendaApi } from '@/api/agendaApi';
import { usuariosApi } from '@/api/usuariosApi';
import { papApi } from '@/api/papApi';
import { reportesApi } from '@/api/reportesApi';
import { propuestasApi } from '@/api/propuestasApi';
import { usePapStore } from '@/stores/usePapStore';
import AgendaUnificada from '@/views/comun/AgendaUnificada.vue';
import MisMetricasPap from '@/views/pap/MisMetricasPap.vue';
import MapaZona from '@/views/pap/MapaZona.vue';
import MisMetricasEmp from '@/views/empresariales/MisMetricasEmp.vue';

enableAutoUnmount(afterEach);

const opts = (extra = {}) => ({
  global: {
    plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false, initialState: { svAuth: { usuario: { usr_id: 7 } } } })],
    ...extra
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(AHORA));
  agendaApi.mes.mockResolvedValue({ data: {} });
  agendaApi.dia.mockResolvedValue({ data: { gestiones: [], eventos: [] } });
  usuariosApi.list.mockResolvedValue({ data: [] });
  papApi.metricas.mockResolvedValue({ data: {} });
  papApi.mapa.mockResolvedValue({ data: [] });
  reportesApi.asesor.mockResolvedValue({ data: {} });
  propuestasApi.list.mockResolvedValue({ data: { items: [] } });
});
afterEach(() => vi.useRealTimers());

describe('"hoy" en hora local (Colombia, 8:30 p. m.)', () => {
  it('AgendaUnificada pide el día de hoy al abrir', async () => {
    mount(AgendaUnificada, opts({ stubs: { MiniCalendar: true, NuevoEventoAgendaModal: true } }));
    await flushPromises();
    expect(agendaApi.dia).toHaveBeenCalledWith(expect.objectContaining({ fecha: '2026-11-25' }));
  });

  it('AgendaUnificada pide el día local que elige el calendario', async () => {
    const Cal = defineComponent({
      name: 'MiniCalendar',
      emits: ['update:modelValue'],
      setup(_, { emit }) {
        return () => h('button', { id: 'elegir', onClick: () => emit('update:modelValue', new Date('2026-11-26T20:30:00')) });
      }
    });
    const w = mount(AgendaUnificada, opts({ stubs: { MiniCalendar: Cal, NuevoEventoAgendaModal: true } }));
    await flushPromises();
    await w.find('#elegir').trigger('click');
    await flushPromises();
    expect(agendaApi.dia).toHaveBeenLastCalledWith(expect.objectContaining({ fecha: '2026-11-26' }));
  });

  it('usePapStore.refrescarMetricas pide hoy', async () => {
    createTestingPinia({ createSpy: vi.fn, stubActions: false });
    await usePapStore().refrescarMetricas();
    expect(papApi.metricas).toHaveBeenCalledWith({ desde: '2026-11-25', hasta: '2026-11-25' });
  });

  it('MisMetricasPap arranca con hoy como desde y hasta', async () => {
    mount(MisMetricasPap, opts());
    await flushPromises();
    expect(papApi.metricas).toHaveBeenCalledWith({ desde: '2026-11-25', hasta: '2026-11-25' });
  });

  describe('MapaZona', () => {
    beforeEach(() => {
      const mapa = { setView: () => mapa, remove: vi.fn(), fitBounds: vi.fn() };
      const capa = { addTo: () => capa, clearLayers: vi.fn() };
      window.L = { map: () => mapa, tileLayer: () => capa, layerGroup: () => capa };
    });
    afterEach(() => { delete window.L; });

    it('al abrir pide hoy', async () => {
      mount(MapaZona, opts());
      await flushPromises();
      expect(papApi.mapa).toHaveBeenCalledWith({ desde: '2026-11-25', hasta: '2026-11-25' });
    });

    it('el preset de 7 días va del 19 al 25', async () => {
      const w = mount(MapaZona, opts());
      await flushPromises();
      await w.findAll('button').find(b => b.text() === '7 días').trigger('click');
      await flushPromises();
      expect(papApi.mapa).toHaveBeenLastCalledWith({ desde: '2026-11-19', hasta: '2026-11-25' });
    });
  });

  it('MisMetricasEmp usa hoy como fin del rango', async () => {
    const w = mount(MisMetricasEmp, opts());
    await flushPromises();
    w.vm.periodo = 'trimestre';
    await w.vm.cargar();
    expect(reportesApi.asesor).toHaveBeenLastCalledWith(7, { desde: '2026-10-01', hasta: '2026-11-25' });
  });
});
