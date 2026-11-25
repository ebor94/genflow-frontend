import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/composables/useGeolocation', () => ({
  useGeolocation: () => ({ coords: { value: null }, getCurrent: vi.fn(async () => null), error: { value: null }, obteniendo: { value: false } })
}));

import RegistroRapidoModal from '@/components/crm/RegistroRapidoModal.vue';

enableAutoUnmount(afterEach);

describe('RegistroRapidoModal: fecha sugerida al volver', () => {
  afterEach(() => vi.useRealTimers());

  it('después de las 7 p. m. sugiere mañana, no pasado mañana', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T20:30:00'));
    const w = mount(RegistroRapidoModal, {
      props: { open: false },
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } }
    });
    await w.setProps({ open: true });
    await flushPromises();
    await w.findAll('button').find((b) => b.text().includes('Volver')).trigger('click');
    await flushPromises();
    expect(w.find('input[type="date"]').element.value).toBe('2026-11-26');
  });
});
