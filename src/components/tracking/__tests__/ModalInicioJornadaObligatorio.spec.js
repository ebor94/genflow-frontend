import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ModalInicioJornadaObligatorio from '@/components/tracking/ModalInicioJornadaObligatorio.vue';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';
import { useTrackingStore } from '@/stores/useTrackingStore';

function factory() {
  return mount(ModalInicioJornadaObligatorio, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })]
    },
    attachTo: document.body
  });
}

describe('ModalInicioJornadaObligatorio', () => {
  beforeEach(() => document.body.innerHTML = '');

  it('renderiza dos tabs', () => {
    const wrapper = factory();
    expect(wrapper.text()).toContain('Iniciar jornada');
    expect(wrapper.text()).toContain('No laboro hoy');
  });

  it('tab por defecto: iniciar jornada', () => {
    const wrapper = factory();
    expect(wrapper.find('[data-testid="tab-iniciar"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-ausencia"]').exists()).toBe(false);
  });

  it('cambia a tab de ausencia', async () => {
    const wrapper = factory();
    await wrapper.find('[data-testid="btn-tab-ausencia"]').trigger('click');
    expect(wrapper.find('[data-testid="tab-ausencia"]').exists()).toBe(true);
  });

  it('valida motivo mínimo 5 chars', async () => {
    const wrapper = factory();
    await wrapper.find('[data-testid="btn-tab-ausencia"]').trigger('click');
    await wrapper.find('[data-testid="input-motivo"]').setValue('abc');
    const btn = wrapper.find('[data-testid="btn-confirmar-ausencia"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('bloquea Escape: preventDefault + stopPropagation', () => {
    factory();
    const preventDefault  = vi.fn();
    const stopPropagation = vi.fn();
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    Object.defineProperty(ev, 'preventDefault',  { value: preventDefault });
    Object.defineProperty(ev, 'stopPropagation', { value: stopPropagation });
    document.dispatchEvent(ev);
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('bloquea overflow del body mientras está montado', () => {
    document.body.style.overflow = '';
    const wrapper = factory();
    expect(document.body.style.overflow).toBe('hidden');
    wrapper.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('al confirmar iniciar jornada, llama tracking.iniciar y marcarJornadaIniciada', async () => {
    const wrapper = factory();
    const tracking = useTrackingStore();
    const jornStore = useJornadaObligatoriaStore();
    tracking.iniciar = vi.fn().mockResolvedValue({ jor_id: 'x' });
    jornStore.marcarJornadaIniciada = vi.fn();

    await wrapper.find('[data-testid="btn-iniciar-jornada"]').trigger('click');
    await flushPromises();

    expect(tracking.iniciar).toHaveBeenCalled();
    expect(jornStore.marcarJornadaIniciada).toHaveBeenCalled();
  });
});
