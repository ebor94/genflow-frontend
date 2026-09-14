import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import NuevoEventoAgendaModal from '@/components/crm/NuevoEventoAgendaModal.vue';

vi.mock('@/api/agendaApi', () => ({
  eventosAgendaApi: { create: vi.fn() }
}));
vi.mock('@/api/usuariosApi', () => ({
  usuariosApi: {
    list: vi.fn().mockResolvedValue({
      data: [
        { usr_id: 10, usr_nombre: 'Juan', usr_apellido: 'P', rol: { rol_codigo: 'ASESOR' } },
        { usr_id: 11, usr_nombre: 'Ana',  usr_apellido: 'G', rol: { rol_codigo: 'ASESOR' } },
        { usr_id: 20, usr_nombre: 'Coordinador', usr_apellido: 'X', rol: { rol_codigo: 'COORDINADOR_PREVISION' } }
      ]
    })
  }
}));

import { eventosAgendaApi } from '@/api/agendaApi';

function factory(props = {}) {
  return mount(NuevoEventoAgendaModal, {
    props: { open: true, ...props },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
      stubs: { teleport: true }
    },
    attachTo: document.body
  });
}

beforeEach(() => { vi.clearAllMocks(); document.body.innerHTML = ''; });

describe('NuevoEventoAgendaModal', () => {
  it('renderiza título y campos base', async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.text()).toContain('Nuevo evento');
    expect(wrapper.find('[data-testid="input-titulo"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="select-tipo"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="radio-modo-UNICO"]').exists()).toBe(true);
  });

  it('modo UNICO no muestra el picker de slots ni el date-range', async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.find('[data-testid="slots-picker"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="input-fecha-fin"]').exists()).toBe(false);
  });

  it('modo DIA_COMPLETO_MULTI muestra date-range', async () => {
    const wrapper = factory();
    await flushPromises();
    await wrapper.find('[data-testid="radio-modo-DIA_COMPLETO_MULTI"]').trigger('change');
    expect(wrapper.find('[data-testid="input-fecha-fin"]').exists()).toBe(true);
  });

  it('modo SLOTS muestra slots-picker', async () => {
    const wrapper = factory();
    await flushPromises();
    await wrapper.find('[data-testid="radio-modo-SLOTS"]').trigger('change');
    expect(wrapper.find('[data-testid="slots-picker"]').exists()).toBe(true);
  });

  it('permite agregar múltiples asistentes', async () => {
    const wrapper = factory();
    await flushPromises();
    // Selecciona los 3 chips
    const chips = wrapper.findAll('[data-testid^="chip-usr-"]');
    expect(chips.length).toBeGreaterThanOrEqual(3);
  });

  it('toggle "registro público" muestra el meta_leads', async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.find('[data-testid="input-meta-leads"]').exists()).toBe(false);
    await wrapper.find('[data-testid="toggle-publico"]').setValue(true);
    expect(wrapper.find('[data-testid="input-meta-leads"]').exists()).toBe(true);
  });

  it('submit envía payload con shape correcto', async () => {
    eventosAgendaApi.create.mockResolvedValue({ data: { evento_id: 500 } });
    const wrapper = factory();
    await flushPromises();

    await wrapper.find('[data-testid="input-titulo"]').setValue('Feria QA');
    await wrapper.find('[data-testid="select-tipo"]').setValue('FERIA');
    await wrapper.find('[data-testid="input-fecha-inicio"]').setValue('2026-11-01T13:00');
    // Selecciona 2 asistentes
    await wrapper.find('[data-testid="chip-usr-10"]').trigger('click');
    await wrapper.find('[data-testid="chip-usr-11"]').trigger('click');
    await wrapper.find('[data-testid="btn-crear"]').trigger('click');
    await flushPromises();

    expect(eventosAgendaApi.create).toHaveBeenCalledWith(expect.objectContaining({
      titulo: 'Feria QA',
      tipo: 'FERIA',
      modo_fechas: 'UNICO',
      asistentes_ids: [10, 11]
    }));
  });

  it('emite created al recibir respuesta OK', async () => {
    eventosAgendaApi.create.mockResolvedValue({ data: { evento_id: 500 } });
    const wrapper = factory();
    await flushPromises();
    await wrapper.find('[data-testid="input-titulo"]').setValue('Test');
    await wrapper.find('[data-testid="input-fecha-inicio"]').setValue('2026-11-01T13:00');
    await wrapper.find('[data-testid="chip-usr-10"]').trigger('click');
    await wrapper.find('[data-testid="btn-crear"]').trigger('click');
    await flushPromises();
    const emitted = wrapper.emitted('created');
    expect(emitted).toBeTruthy();
    expect(emitted[0][0].evento_id).toBe(500);
  });
});
