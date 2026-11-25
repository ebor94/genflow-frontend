import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AgendarProximaModal from '@/components/crm/AgendarProximaModal.vue';
import { useProspectosStore } from '@/stores/useProspectosStore';

enableAutoUnmount(afterEach);

async function abrir(fecha) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  const w = mount(AgendarProximaModal, {
    props: { open: false, prospecto: { prosp_id: 7, prosp_prox_gestion_fecha: fecha, prosp_prox_gestion_hora: '10:00:00' } },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await w.setProps({ open: true });
  await flushPromises();
  return { w, store: useProspectosStore() };
}

describe('AgendarProximaModal: fecha guardada', () => {
  it.each(['2026-11-28', '2026-11-28T05:00:00.000Z'])('al abrir con %s el campo vale 2026-11-28 y se guarda igual', async (valor) => {
    const { w, store } = await abrir(valor);
    expect(w.find('input[type="date"]').element.value).toBe('2026-11-28');
    await w.findAll('button').find((b) => b.text() === 'Guardar').trigger('click');
    await flushPromises();
    expect(store.actualizar).toHaveBeenCalledWith(7, { prosp_prox_gestion_fecha: '2026-11-28', prosp_prox_gestion_hora: '10:00' });
  });
});
