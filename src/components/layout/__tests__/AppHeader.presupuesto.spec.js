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

function montar(rol) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  const auth = useAuthStore(pinia);
  auth.areaActual = { area_codigo: 'PRENEC' };
  auth.areasAccesibles = [{ area_id: 3, area_codigo: 'PRENEC' }];
  auth.rolCodigo = rol;
  return mount(AppHeader, { global: { plugins: [pinia], stubs: { AreaBadge: true, JornadaWidget: true } } });
}

describe('AppHeader: Presupuesto', () => {
  it('asesor: no está en esta barra; llega por Mis métricas o el menú lateral', () => {
    const e = montar('ASESOR').findAll('a').map((a) => a.text().trim());
    expect(e).toContain('Métricas');
    expect(e).not.toContain('Presupuesto');
  });

  it('supervisor: está en el menú Supervisión, primero, y no suelto', async () => {
    const w = montar('SUPERVISOR');
    // suelto = fuera de cualquier desplegable
    const fuera = w.findAll('a').filter((a) => !a.element.closest('.w-64') && a.text().trim() === 'Presupuesto');
    expect(fuera).toHaveLength(0);
    const boton = w.findAll('button').find((b) => b.text().includes('Supervisión'));
    await boton.trigger('click');
    const items = w.findAll('.w-64 a').map((a) => a.text());
    expect(items[0]).toContain('Presupuesto');
    expect(items[0]).toContain('Meta y realizado del equipo');
  });
});
