import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRouter: () => ({ push: vi.fn(), afterEach: vi.fn() }),
  useRoute: () => ({ name: 'prenec-panel' })
}));

import { useAuthStore } from '@/stores/useAuthStore';
import AppHeader from '@/components/layout/AppHeader.vue';

describe('AppHeader', () => {
  it('Presupuesto está en el menú superior de Prenecesidad, después de Métricas', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn });
    const auth = useAuthStore(pinia);
    auth.areaActual = { area_codigo: 'PRENEC' };
    auth.areasAccesibles = [{ area_id: 3, area_codigo: 'PRENEC' }];
    const w = mount(AppHeader, { global: { plugins: [pinia], stubs: { AreaBadge: true, JornadaWidget: true } } });
    const e = w.findAll('a').map((a) => a.text().trim());
    const i = e.indexOf('Métricas');
    expect(i).toBeGreaterThan(-1);
    expect(e[i + 1]).toBe('Presupuesto');
  });
});
