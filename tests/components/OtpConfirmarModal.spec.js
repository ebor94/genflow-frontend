import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OtpConfirmarModal from '@/components/eventos/OtpConfirmarModal.vue';

vi.mock('@/api/agendaApi', () => ({
  eventosAgendaApi: {
    otpConfirmar: vi.fn(),
    otpSolicitar: vi.fn()
  }
}));
import { eventosAgendaApi } from '@/api/agendaApi';

function mkProps(over = {}) {
  return {
    open: true,
    otpId: 7,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    evento: { evento_id: 5, evento_titulo: 'T' },
    cambios: { titulo: 'Editado' },
    ...over
  };
}

describe('OtpConfirmarModal', () => {
  beforeEach(() => vi.resetAllMocks());

  it('renderiza 6 inputs numéricos', () => {
    const w = mount(OtpConfirmarModal, {
      props: mkProps(),
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: { teleport: true }
      }
    });
    expect(w.findAll('input[inputmode="numeric"]')).toHaveLength(6);
  });

  it('botón Confirmar deshabilitado hasta llenar 6 dígitos', async () => {
    const w = mount(OtpConfirmarModal, {
      props: mkProps(),
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: { teleport: true }
      }
    });
    expect(w.find('[data-testid="btn-otp-confirmar"]').attributes('disabled')).toBeDefined();
    const inputs = w.findAll('input[inputmode="numeric"]');
    for (let i = 0; i < 6; i++) {
      await inputs[i].setValue(String(i));
    }
    // Re-consultar en vivo: con stubs.teleport el subárbol se re-crea en cada
    // render, así que un wrapper capturado antes del cambio queda obsoleto.
    expect(w.find('[data-testid="btn-otp-confirmar"]').attributes('disabled')).toBeUndefined();
  });

  it('confirmar llama a otpConfirmar con código concatenado y emite confirmado', async () => {
    eventosAgendaApi.otpConfirmar.mockResolvedValue({ evento_id: 5, evento_titulo: 'Editado' });
    const w = mount(OtpConfirmarModal, {
      props: mkProps(),
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: { teleport: true }
      }
    });
    const inputs = w.findAll('input[inputmode="numeric"]');
    const codigo = ['4','9','3','7','1','2'];
    for (let i = 0; i < 6; i++) await inputs[i].setValue(codigo[i]);
    await w.find('[data-testid="btn-otp-confirmar"]').trigger('click');
    await flushPromises();
    expect(eventosAgendaApi.otpConfirmar).toHaveBeenCalledWith(5, 7, '493712');
    expect(w.emitted('confirmado')).toBeTruthy();
  });
});
