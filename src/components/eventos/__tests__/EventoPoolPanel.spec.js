import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventoPoolPanel from '@/components/eventos/EventoPoolPanel.vue';

vi.mock('@/api/agendaApi', () => ({
  eventosAgendaApi: {
    pool: vi.fn(),
    asignarPool: vi.fn()
  }
}));
import { eventosAgendaApi } from '@/api/agendaApi';

const evento = {
  evento_id: 500,
  asistentes: [
    { eva_id: 1, eva_usr_id: 10, eva_activo: 1, usuario: { usr_id: 10, usr_nombre: 'Juan', usr_apellido: 'P' } },
    { eva_id: 2, eva_usr_id: 11, eva_activo: 1, usuario: { usr_id: 11, usr_nombre: 'Ana',  usr_apellido: 'G' } }
  ]
};

function factory() {
  return mount(EventoPoolPanel, {
    props: { evento },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })]
    }
  });
}

beforeEach(() => vi.clearAllMocks());

describe('EventoPoolPanel', () => {
  it('carga pool al montar y muestra filas', async () => {
    eventosAgendaApi.pool.mockResolvedValue({ data: [
      { pool_id: 7, pool_nombre: 'Ana Test', pool_telefono: '3001111', pool_correo: 'a@x' },
      { pool_id: 8, pool_nombre: 'Bob Test', pool_telefono: '3002222', pool_correo: null }
    ]});
    const wrapper = factory();
    await flushPromises();
    expect(eventosAgendaApi.pool).toHaveBeenCalledWith(500, { asignado: 0 });
    expect(wrapper.text()).toContain('Ana Test');
    expect(wrapper.text()).toContain('Bob Test');
  });

  it('estado vacío si no hay registros pendientes', async () => {
    eventosAgendaApi.pool.mockResolvedValue({ data: [] });
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.text()).toContain('Sin registros pendientes');
  });

  it('al asignar llama asignarPool con asesor_id y emite asignado', async () => {
    eventosAgendaApi.pool.mockResolvedValue({ data: [
      { pool_id: 7, pool_nombre: 'Ana Test', pool_telefono: '3001111', pool_correo: null }
    ]});
    eventosAgendaApi.asignarPool.mockResolvedValue({ data: { prospecto: { prosp_id: 900 } } });
    const wrapper = factory();
    await flushPromises();

    await wrapper.find(`[data-testid="select-asesor-7"]`).setValue('10');
    await wrapper.find(`[data-testid="btn-asignar-7"]`).trigger('click');
    await flushPromises();

    expect(eventosAgendaApi.asignarPool).toHaveBeenCalledWith(500, 7, { asesor_id: 10 });
    expect(wrapper.emitted('asignado')).toBeTruthy();
  });
});
