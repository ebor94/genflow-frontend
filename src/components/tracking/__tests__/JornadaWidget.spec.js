import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';
import JornadaWidget from '@/components/tracking/JornadaWidget.vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTrackingStore } from '@/stores/useTrackingStore';

describe('JornadaWidget', () => {
  it('al montarse no arranca ni restaura la captura', async () => {
    const wrapper = mount(JornadaWidget, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true })] }
    });
    const auth = useAuthStore();
    const tracking = useTrackingStore();
    auth.accessToken = 'a';
    auth.usuario = { usr_id: 1, rol: { rol_codigo: 'ASESOR' }, area: { area_codigo: 'PREV-PAP' } };
    await flushPromises();
    for (const k of ['iniciar', 'reanudar', 'reanudarLocal']) expect(tracking[k]).not.toHaveBeenCalled();
    expect(tracking.restaurar).toBeUndefined();
    wrapper.unmount();
  });

  it('montado con la persona ya puesta (recarga real) tampoco arranca nada', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
    const auth = useAuthStore(pinia);
    auth.accessToken = 'a';
    auth.usuario = { usr_id: 1, rol: { rol_codigo: 'ASESOR' }, area: { area_codigo: 'PREV-PAP' } };
    const tracking = useTrackingStore(pinia);
    const wrapper = mount(JornadaWidget, { global: { plugins: [pinia] } });
    await flushPromises();
    for (const k of ['iniciar', 'reanudar', 'reanudarLocal']) expect(tracking[k]).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
