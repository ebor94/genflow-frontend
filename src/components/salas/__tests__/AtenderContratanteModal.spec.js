import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/salasApi', () => ({ salasApi: { atender: vi.fn() } }));

import { salasApi } from '@/api/salasApi';
import AtenderContratanteModal from '@/components/salas/AtenderContratanteModal.vue';

const H = (extra = {}) => ({
  id: 55, sala_nombre: 'Sala 3', sede_nombre: 'Sede Norte', nombre_ser_querido: 'Luis Pérez',
  contratante_nombre: 'MARTA GOMEZ', contratante_telefono: '3001234567', ...extra
});

function factory(homenaje) {
  return mount(AtenderContratanteModal, {
    props: { open: true, homenaje },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } }
  });
}

async function confirmar(w) {
  await w.findAll('button').find((b) => b.text().trim() === 'Atender').trigger('click');
  await flushPromises();
}

describe('AtenderContratanteModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con datos completos no pide campos y atiende con un objeto vacío', async () => {
    salasApi.atender.mockResolvedValue({ success: true, data: { prosp_id: 905, es_mio: true } });
    const w = factory(H());
    expect(w.find('[data-testid="campos-contratante"]').exists()).toBe(false);
    expect(w.text()).toContain('MARTA GOMEZ');
    await confirmar(w);
    expect(salasApi.atender).toHaveBeenCalledWith(55, {});
    expect(w.emitted('atendido')[0]).toEqual([{ prosp_id: 905, es_mio: true }]);
  });

  it('sin teléfono pide los datos y no llama hasta completarlos', async () => {
    salasApi.atender.mockResolvedValue({ success: true, data: { prosp_id: 905, es_mio: true } });
    const w = factory(H({ contratante_telefono: '' }));
    expect(w.find('[data-testid="campos-contratante"]').exists()).toBe(true);
    await confirmar(w);
    expect(salasApi.atender).not.toHaveBeenCalled();
    const [, telefono] = w.findAll('[data-testid="campos-contratante"] input');
    await telefono.setValue('312 555 0101');
    await confirmar(w);
    expect(salasApi.atender).toHaveBeenCalledWith(55, { nombre: 'MARTA GOMEZ', telefono: '312 555 0101' });
  });

  it('si el backend responde TELEFONO_REQUERIDO muestra los campos', async () => {
    salasApi.atender.mockRejectedValue({ response: { data: { error: 'TELEFONO_REQUERIDO', message: 'Escribe un teléfono válido del contratante' } } });
    const w = factory(H());
    await confirmar(w);
    expect(w.find('[data-testid="campos-contratante"]').exists()).toBe(true);
    expect(w.emitted('atendido')).toBeUndefined();
  });

  it('si el homenaje ya finalizó emite cerrado', async () => {
    salasApi.atender.mockRejectedValue({ response: { data: { error: 'HOMENAJE_CERRADO', message: 'Este homenaje ya finalizó' } } });
    const w = factory(H());
    await confirmar(w);
    expect(w.emitted('cerrado')).toHaveLength(1);
  });
});
