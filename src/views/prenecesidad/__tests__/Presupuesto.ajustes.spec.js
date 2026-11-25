import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/presupuestosApi', () => ({
  presupuestosApi: { obtener: vi.fn(), plantilla: vi.fn(), revisar: vi.fn(), guardar: vi.fn() }
}));

import { presupuestosApi } from '@/api/presupuestosApi';
import { useAuthStore } from '@/stores/useAuthStore';
import Presupuesto from '@/views/prenecesidad/Presupuesto.vue';

const A = (id, nombre, grupo, extra = {}) => ({
  usr_id: id, nombre, grupo_id: grupo, activo: true, presupuesto: 1000, realizado: 500,
  categorias: { Exequial: { presupuesto: 1000, realizado: 500 } }, ...extra
});
const respuesta = (extra = {}) => ({
  success: true,
  data: {
    area_id: 3, anio: 2026, mes: 11, puede_cargar: true, categorias: ['Exequial'],
    grupos: [{ grupo_id: 1, nombre: 'Norte' }, { grupo_id: 2, nombre: 'Sur' }],
    asesores: [A(10, 'Ana Ruiz', 1), A(11, 'Luis Paz', 1), A(12, 'Eva Gil', 2)],
    total: { presupuesto: 3000, realizado: 1500, categorias: {} }, actualizado: null, ...extra
  }
});

function factory(area = { areasAccesibles: [{ area_id: 3, area_codigo: 'PRENEC' }, { area_id: 9, area_codigo: 'SVC' }], areaActivaId: 9 }) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  const auth = useAuthStore(pinia);
  auth.usuario = { areas_accesibles: area.areasAccesibles };
  auth.areasAccesibles = area.areasAccesibles;
  auth.areaActivaId = area.areaActivaId;
  return mount(Presupuesto, { global: { plugins: [pinia], stubs: { teleport: true } } });
}
async function elegir(w, nombre = 'p.xlsx') {
  const input = w.find('[data-testid="archivo"]');
  Object.defineProperty(input.element, 'files', { value: [new File(['x'], nombre)], configurable: true });
  await input.trigger('change');
  await flushPromises();
}

describe('Presupuesto: área de Prenecesidad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 25, 10));
    presupuestosApi.obtener.mockResolvedValue(respuesta());
    presupuestosApi.revisar.mockResolvedValue({ success: true, data: { filas: [{ usr_id: 10, nombre: 'Ana', valores: { Exequial: 5 } }], cambios: [{ usr_id: 10, nombre: 'Ana', categoria: 'Exequial', antes: 1, despues: 5 }], errores: [] } });
    presupuestosApi.guardar.mockResolvedValue({ success: true });
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('super admin con otra área activa: consulta, plantilla, revisión y guardado usan la de Prenecesidad', async () => {
    presupuestosApi.plantilla.mockResolvedValue({ data: new Blob(['x']), headers: {} });
    const w = factory();
    await flushPromises();
    expect(presupuestosApi.obtener).toHaveBeenCalledWith({ area_id: 3, anio: 2026, mes: 11 });
    await w.find('[data-testid="btn-plantilla"]').trigger('click');
    await flushPromises();
    expect(presupuestosApi.plantilla).toHaveBeenCalledWith({ area_id: 3, anio: 2026, mes: 11 });
    await w.find('[data-testid="btn-subir"]').trigger('click');
    await elegir(w);
    const fd = presupuestosApi.revisar.mock.calls[0][0];
    expect([fd.get('area_id'), fd.get('anio'), fd.get('mes')]).toEqual(['3', '2026', '11']);
    await w.find('[data-testid="btn-confirmar"]').trigger('click');
    await flushPromises();
    expect(presupuestosApi.guardar).toHaveBeenCalledWith(expect.objectContaining({ area_id: 3, anio: 2026, mes: 11 }));
  });

  it('el mes elegido llega a la revisión y al guardado', async () => {
    const w = factory();
    await flushPromises();
    await w.find('select').setValue('2026-10');
    await flushPromises();
    await w.find('[data-testid="btn-subir"]').trigger('click');
    await elegir(w);
    expect(presupuestosApi.revisar.mock.calls[0][0].get('mes')).toBe('10');
    expect(w.text()).toContain('Confirmar presupuesto de octubre 2026');
    await w.find('[data-testid="btn-confirmar"]').trigger('click');
    await flushPromises();
    expect(presupuestosApi.guardar).toHaveBeenCalledWith(expect.objectContaining({ mes: 10 }));
  });

  it('el año del mes elegido llega a la consulta y a la revisión', async () => {
    const w = factory();
    await flushPromises();
    await w.find('select').setValue('2025-12');
    await flushPromises();
    expect(presupuestosApi.obtener).toHaveBeenLastCalledWith({ area_id: 3, anio: 2025, mes: 12 });
    await w.find('[data-testid="btn-subir"]').trigger('click');
    await elegir(w);
    expect(presupuestosApi.revisar.mock.calls[0][0].get('anio')).toBe('2025');
  });

  it('sin áreas accesibles y sin activa, no rompe', async () => {
    factory({ areasAccesibles: [], areaActivaId: null });
    await flushPromises();
    expect(presupuestosApi.obtener).toHaveBeenCalledWith({ area_id: null, anio: 2026, mes: 11 });
  });

  it('sin Prenecesidad en la lista usa el área activa', async () => {
    factory({ areasAccesibles: [{ area_id: 9, area_codigo: 'SVC' }], areaActivaId: 9 });
    await flushPromises();
    expect(presupuestosApi.obtener).toHaveBeenCalledWith({ area_id: 9, anio: 2026, mes: 11 });
  });
});

describe('Presupuesto: selección, retirados y accesibilidad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 25, 10));
    presupuestosApi.obtener.mockResolvedValue(respuesta());
  });
  afterEach(() => vi.useRealTimers());

  it('el selector de mes tiene nombre accesible', async () => {
    const w = factory();
    await flushPromises();
    expect(w.find('select').attributes('aria-label')).toBe('Mes del presupuesto');
  });

  it('pestañas con aria-controls y panel tabpanel enlazado a la pestaña elegida', async () => {
    const w = factory();
    await flushPromises();
    const tabs = w.findAll('[role="tab"]');
    const panel = w.find('[role="tabpanel"]');
    expect(panel.exists()).toBe(true);
    expect(tabs[0].attributes('aria-controls')).toBe(panel.attributes('id'));
    expect(panel.attributes('aria-labelledby')).toBe(tabs[0].attributes('id'));
    await tabs[1].trigger('click');
    expect(w.find('[role="tabpanel"]').attributes('aria-labelledby')).toBe(tabs[1].attributes('id'));
  });

  it('un asesor retirado se muestra como Retirado en la barra y en su tabla', async () => {
    presupuestosApi.obtener.mockResolvedValue(respuesta({ asesores: [A(10, 'Ana Ruiz', 1, { activo: false }), A(11, 'Luis Paz', 1)] }));
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="asesor-10"]').text()).toContain('Retirado');
    await w.find('[data-testid="asesor-10"]').trigger('click');
    expect(w.find('[data-testid="tabla-titulo"]').text()).toContain('Retirado');
    await w.find('[data-testid="asesor-11"]').trigger('click');
    expect(w.find('[data-testid="tabla-titulo"]').text()).not.toContain('Retirado');
  });

  it('al recargar el mismo mes (guardar) se conservan la pestaña y el asesor', async () => {
    const w = factory();
    await flushPromises();
    await w.findAll('[role="tab"]')[1].trigger('click');
    await w.find('[data-testid="asesor-12"]').trigger('click');
    w.findComponent({ name: 'SubirPresupuestoModal' }).vm.$emit('guardado');
    await flushPromises();
    expect(w.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true');
    expect(w.find('[data-testid="tabla-titulo"]').text()).toContain('Eva Gil');
  });

  it('si el asesor o el grupo ya no existen al recargar, vuelve al primero', async () => {
    const w = factory();
    await flushPromises();
    await w.findAll('[role="tab"]')[1].trigger('click');
    await w.find('[data-testid="asesor-12"]').trigger('click');
    presupuestosApi.obtener.mockResolvedValue(respuesta({ asesores: [A(10, 'Ana Ruiz', 1), A(13, 'Otro Sur', 2)] }));
    w.findComponent({ name: 'SubirPresupuestoModal' }).vm.$emit('guardado');
    await flushPromises();
    expect(w.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true');
    expect(w.find('[data-testid="tabla-presupuesto"]').exists()).toBe(false);
    presupuestosApi.obtener.mockResolvedValue(respuesta({ grupos: [{ grupo_id: 1, nombre: 'Norte' }, { grupo_id: 5, nombre: 'Nuevo' }], asesores: [A(10, 'Ana Ruiz', 1), A(14, 'Nuevo A', 5)] }));
    w.findComponent({ name: 'SubirPresupuestoModal' }).vm.$emit('guardado');
    await flushPromises();
    expect(w.findAll('[role="tab"]')[0].attributes('aria-selected')).toBe('true');
  });

  it('al cambiar de mes la selección se reinicia', async () => {
    const w = factory();
    await flushPromises();
    await w.findAll('[role="tab"]')[1].trigger('click');
    await w.find('[data-testid="asesor-12"]').trigger('click');
    await w.find('select').setValue('2026-10');
    await flushPromises();
    expect(w.findAll('[role="tab"]')[0].attributes('aria-selected')).toBe('true');
    expect(w.find('[data-testid="tabla-presupuesto"]').exists()).toBe(false);
  });
});
