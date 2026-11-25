import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), RouterLink: { template: '<a><slot /></a>' } }));

import AgendaInteligente from '@/views/prenecesidad/AgendaInteligente.vue';

async function montar(agendaMes) {
  const pinia = createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { agendaMes, items: [] } } });
  const w = mount(AgendaInteligente, { global: { plugins: [pinia] } });
  await flushPromises();
  return w;
}

// Celdas del calendario que llevan marca (punto) y su color.
const marcas = (w) => w.findAll('button.relative')
  .filter((b) => b.find('span.rounded-full').exists())
  .map((b) => ({ dia: b.find('span').text(), vencida: b.find('span.rounded-full').classes().includes('bg-danger') }));

enableAutoUnmount(afterEach);

describe('AgendaInteligente: marcas del calendario', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T09:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('marca el día de la gestión y no el de hoy', async () => {
    const w = await montar([{ prosp_prox_gestion_fecha: '2026-11-28', total: 2, vencidas: 0 }]);
    expect(marcas(w)).toEqual([{ dia: '28', vencida: false }]);
  });

  it('con vencidas la marca es la de vencida', async () => {
    const w = await montar([{ prosp_prox_gestion_fecha: '2026-11-28', total: 2, vencidas: 1 }]);
    expect(marcas(w)).toEqual([{ dia: '28', vencida: true }]);
  });
});
