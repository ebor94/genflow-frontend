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
// `pos` es la posición en la cuadrícula: el 28 de noviembre de 2026 es la celda 33 (la cuadrícula arranca el 26 de octubre).
const marcas = (w) => w.findAll('button.relative')
  .map((b, pos) => ({ b, pos }))
  .filter(({ b }) => b.find('span.rounded-full').exists())
  .map(({ b, pos }) => ({ pos, dia: b.find('span').text(), vencida: b.find('span.rounded-full').classes().includes('bg-danger') }));

enableAutoUnmount(afterEach);

describe('AgendaInteligente: marcas del calendario', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T09:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it.each(['2026-11-28', '2026-11-28T05:00:00.000Z'])('marca el día de la gestión (%s) y no el de hoy', async (f) => {
    const w = await montar([{ prosp_prox_gestion_fecha: f, total: 2, vencidas: 0 }]);
    expect(marcas(w)).toEqual([{ pos: 33, dia: '28', vencida: false }]);
  });

  it.each(['2026-11-28', '2026-11-28T05:00:00.000Z'])('con vencidas la marca es la de vencida (%s)', async (f) => {
    const w = await montar([{ prosp_prox_gestion_fecha: f, total: 2, vencidas: 1 }]);
    expect(marcas(w)).toEqual([{ pos: 33, dia: '28', vencida: true }]);
  });
});
