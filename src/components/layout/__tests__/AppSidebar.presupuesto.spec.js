import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { nextTick } from 'vue';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ name: 'prenec-panel' })
}));

import { useAuthStore } from '@/stores/useAuthStore';
import AppSidebar from '@/components/layout/AppSidebar.vue';

async function etiquetas() {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  const auth = useAuthStore(pinia);
  auth.areaActual = { area_codigo: 'PRENEC' };
  auth.areasAccesibles = [{ area_codigo: 'PRENEC', area_nombre: 'Prenecesidad' }];
  auth.rutaInicio = vi.fn(() => ({ name: 'inicio' }));
  const w = mount(AppSidebar, { global: { plugins: [pinia] } });
  await nextTick();
  return w.findAll('a').map((a) => a.text().trim());
}

describe('AppSidebar', () => {
  it('Presupuesto va justo después de Mis métricas en Prenecesidad', async () => {
    const e = await etiquetas();
    const i = e.findIndex((t) => t.includes('Mis métricas'));
    expect(i).toBeGreaterThan(-1);
    expect(e[i + 1]).toContain('Presupuesto');
    expect(e[i + 1]).toContain('🎯');
  });
});
