import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }
}));
vi.mock('@/api/reportesApi', () => ({ reportesApi: { asesor: vi.fn() } }));
vi.mock('@/api/presupuestosApi', () => ({ presupuestosApi: { obtener: vi.fn() } }));

import { reportesApi } from '@/api/reportesApi';
import { presupuestosApi } from '@/api/presupuestosApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { fmtCOP } from '@/utils/format';
import MisMetricas from '@/views/prenecesidad/MisMetricas.vue';

const propio = { usr_id: 5, nombre: 'Yo', presupuesto: 2000, realizado: 1000, categorias: {} };
const otro = { usr_id: 6, nombre: 'Otro', presupuesto: 9000, realizado: 9000, categorias: {} };

function factory() {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  const auth = useAuthStore(pinia);
  auth.areaActivaId = 7;
  auth.usuario = { usr_id: 5 };
  return mount(MisMetricas, { global: { plugins: [pinia], stubs: { teleport: true } } });
}

describe('MisMetricas: tarjeta de presupuesto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 25, 10));
    reportesApi.asesor.mockResolvedValue({ data: { totales: {}, distribucion: [] } });
    presupuestosApi.obtener.mockResolvedValue({ success: true, data: { asesores: [otro, propio] } });
  });
  afterEach(() => vi.useRealTimers());

  it('pide el mes actual del área activa y muestra lo propio', async () => {
    const w = factory();
    await flushPromises();
    expect(presupuestosApi.obtener).toHaveBeenCalledWith({ area_id: 7, anio: 2026, mes: 11 });
    const t = w.find('[data-testid="tarjeta-presupuesto"]');
    expect(t.text()).toContain('Presupuesto del mes');
    expect(t.text()).toContain(`${fmtCOP(1000)} de ${fmtCOP(2000)}`);
    expect(t.text()).toContain('50 %');
    expect(t.attributes('data-to')).toContain('prenec-presupuesto');
  });

  it('usa el área de Prenecesidad aunque la activa sea otra', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn });
    const auth = useAuthStore(pinia);
    auth.areasAccesibles = [{ area_id: 3, area_codigo: 'PRENEC' }, { area_id: 9, area_codigo: 'SVC' }];
    auth.areaActivaId = 9;
    auth.usuario = { usr_id: 5 };
    mount(MisMetricas, { global: { plugins: [pinia], stubs: { teleport: true } } });
    await flushPromises();
    expect(presupuestosApi.obtener).toHaveBeenCalledWith({ area_id: 3, anio: 2026, mes: 11 });
  });

  it('sin presupuesto este mes', async () => {
    presupuestosApi.obtener.mockResolvedValue({ success: true, data: { asesores: [{ ...propio, presupuesto: 0 }] } });
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="tarjeta-presupuesto"]').text()).toContain('Sin presupuesto este mes');
  });

  it('si no hay registro propio dice sin presupuesto', async () => {
    presupuestosApi.obtener.mockResolvedValue({ success: true, data: { asesores: [otro] } });
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="tarjeta-presupuesto"]').text()).toContain('Sin presupuesto este mes');
  });

  it('si la consulta falla, Mis métricas sigue entera y no hay tarjeta', async () => {
    presupuestosApi.obtener.mockRejectedValue(new Error('caído'));
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="tarjeta-presupuesto"]').exists()).toBe(false);
    expect(w.text()).toContain('Mis métricas');
    expect(w.text()).toContain('Cumplimiento de meta');
  });
});
