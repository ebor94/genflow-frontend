import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/presupuestosApi', () => ({
  presupuestosApi: { obtener: vi.fn(), plantilla: vi.fn(), revisar: vi.fn(), guardar: vi.fn() }
}));

import { presupuestosApi } from '@/api/presupuestosApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { fmtCOP } from '@/utils/format';
import Presupuesto from '@/views/prenecesidad/Presupuesto.vue';

const cat = (p, r) => ({ presupuesto: p, realizado: r });
const A = (id, nombre, grupo, p, r, extra = {}) => ({
  usr_id: id, nombre, grupo_id: grupo, activo: true, presupuesto: p, realizado: r,
  categorias: { Exequial: cat(p, r), Lote: cat(0, 0) }, ...extra
});
function respuesta(extra = {}) {
  return {
    success: true,
    data: {
      area_id: 7, anio: 2026, mes: 11, puede_cargar: true, categorias: ['Exequial', 'Lote'],
      grupos: [{ grupo_id: 1, nombre: 'Grupo Norte' }],
      asesores: [A(10, 'Ana Ruiz', 1, 1000, 500), A(11, 'Luis Paz', 1, 2000, 2500)],
      total: { presupuesto: 3000, realizado: 3000, categorias: {} }, actualizado: null, ...extra
    }
  };
}

let pinia;
function factory() {
  pinia = createTestingPinia({ createSpy: vi.fn });
  const auth = useAuthStore(pinia);
  auth.areaActivaId = 7;
  return mount(Presupuesto, { global: { plugins: [pinia], stubs: { teleport: true } } });
}

describe('Presupuesto (vista)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 25, 10));
    presupuestosApi.obtener.mockResolvedValue(respuesta());
  });
  afterEach(() => vi.useRealTimers());

  it('pide con el área activa y el mes actual', async () => {
    factory();
    await flushPromises();
    expect(presupuestosApi.obtener).toHaveBeenCalledWith({ area_id: 7, anio: 2026, mes: 11 });
  });

  it('muestra totales y una barra por asesor', async () => {
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="total-presupuesto"]').text()).toContain(fmtCOP(3000));
    expect(w.find('[data-testid="total-realizado"]').text()).toContain(fmtCOP(3000));
    expect(w.find('[data-testid="total-cumplimiento"]').text()).toContain('100 %');
    expect(w.findAll('[data-testid^="asesor-"]')).toHaveLength(2);
    expect(w.find('[data-testid="tabla-presupuesto"]').exists()).toBe(false);
  });

  it('al tocar un asesor muestra su tabla', async () => {
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="asesor-11"]').trigger('click');
    const t = w.find('[data-testid="tabla-presupuesto"]');
    expect(t.exists()).toBe(true);
    expect(t.text()).toContain('Exequial');
    expect(w.find('[data-testid="fila-total"]').findAll('td')[2].text()).toBe(fmtCOP(2500));
    expect(w.find('[data-testid="tabla-titulo"]').text()).toContain('Luis Paz');
  });

  it('con varios grupos hay pestañas y los totales son los de la pestaña', async () => {
    presupuestosApi.obtener.mockResolvedValue(respuesta({
      grupos: [{ grupo_id: 1, nombre: 'Grupo Norte' }, { grupo_id: 2, nombre: 'Grupo Sur' }],
      asesores: [A(10, 'Ana Ruiz', 1, 1000, 500), A(12, 'Eva Gil', 2, 4000, 1000)]
    }));
    const w = factory();
    await flushPromises();
    const tabs = w.findAll('[role="tab"]');
    expect(tabs.map((t) => t.text())).toEqual(['Grupo Norte', 'Grupo Sur']);
    expect(w.findAll('[data-testid^="asesor-"]').map((a) => a.attributes('data-testid'))).toEqual(['asesor-10']);
    expect(w.find('[data-testid="total-presupuesto"]').text()).toContain(fmtCOP(1000));
    await tabs[1].trigger('click');
    expect(w.findAll('[data-testid^="asesor-"]').map((a) => a.attributes('data-testid'))).toEqual(['asesor-12']);
    expect(w.find('[data-testid="total-presupuesto"]').text()).toContain(fmtCOP(4000));
    expect(w.find('[data-testid="total-cumplimiento"]').text()).toContain('25 %');
  });

  it('muestra quién y cuándo actualizó, con o sin nombre', async () => {
    presupuestosApi.obtener.mockResolvedValue(respuesta({ actualizado: { por: 'Marta Díaz', en: '2026-11-20T15:00:00.000Z' } }));
    let w = factory();
    await flushPromises();
    expect(w.find('[data-testid="actualizado"]').text()).toContain('Marta Díaz');
    presupuestosApi.obtener.mockResolvedValue(respuesta({ actualizado: { por: null, en: '2026-11-20T15:00:00.000Z' } }));
    w = factory();
    await flushPromises();
    expect(w.find('[data-testid="actualizado"]').text()).not.toContain('null');
  });

  it('un asesor sin grupo (grupo_id null) no se pierde: va en la pestaña Sin grupo', async () => {
    presupuestosApi.obtener.mockResolvedValue(respuesta({
      asesores: [A(10, 'Ana Ruiz', 1, 1000, 500), A(13, 'Sin Grupo', null, 100, 50, { activo: false })]
    }));
    const w = factory();
    await flushPromises();
    const tabs = w.findAll('[role="tab"]');
    expect(tabs.map((t) => t.text())).toEqual(['Grupo Norte', 'Sin grupo']);
    await tabs[1].trigger('click');
    expect(w.find('[data-testid="asesor-13"]').exists()).toBe(true);
  });

  it('con un solo grupo no hay pestañas', async () => {
    const w = factory();
    await flushPromises();
    expect(w.find('[role="tab"]').exists()).toBe(false);
  });

  it('asesor con un solo registro ve su tabla sin barras ni botones', async () => {
    presupuestosApi.obtener.mockResolvedValue(respuesta({ puede_cargar: false, asesores: [A(10, 'Ana Ruiz', 1, 1000, 500)] }));
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="tabla-presupuesto"]').exists()).toBe(true);
    expect(w.find('[data-testid^="asesor-"]').exists()).toBe(false);
    expect(w.find('[data-testid="btn-plantilla"]').exists()).toBe(false);
  });

  it('los botones salen solo si puede_cargar', async () => {
    let w = factory();
    await flushPromises();
    expect(w.find('[data-testid="btn-plantilla"]').text()).toBe('Plantilla del mes');
    expect(w.find('[data-testid="btn-subir"]').text()).toBe('Subir presupuesto');
    presupuestosApi.obtener.mockResolvedValue(respuesta({ puede_cargar: false }));
    w = factory();
    await flushPromises();
    expect(w.find('[data-testid="btn-plantilla"]').exists()).toBe(false);
    expect(w.find('[data-testid="btn-subir"]').exists()).toBe(false);
  });

  it('subir abre la ventana y al guardar recarga el mes', async () => {
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="archivo"]').exists()).toBe(false);
    await w.find('[data-testid="btn-subir"]').trigger('click');
    expect(w.find('[data-testid="archivo"]').exists()).toBe(true);
    presupuestosApi.obtener.mockClear();
    w.findComponent({ name: 'SubirPresupuestoModal' }).vm.$emit('guardado');
    await flushPromises();
    expect(presupuestosApi.obtener).toHaveBeenCalledWith({ area_id: 7, anio: 2026, mes: 11 });
  });

  it('sin asesores muestra un aviso', async () => {
    presupuestosApi.obtener.mockResolvedValue(respuesta({ asesores: [] }));
    const w = factory();
    await flushPromises();
    expect(w.text()).toContain('No hay asesores para este mes');
  });

  it('cambiar de mes vuelve a pedir', async () => {
    const w = factory();
    await flushPromises();
    await w.find('select').setValue('2026-10');
    await flushPromises();
    expect(presupuestosApi.obtener).toHaveBeenLastCalledWith({ area_id: 7, anio: 2026, mes: 10 });
  });

  it('una respuesta vieja no pisa la nueva', async () => {
    let soltarVieja;
    presupuestosApi.obtener
      .mockImplementationOnce(() => new Promise((res) => { soltarVieja = () => res(respuesta({ asesores: [A(99, 'Vieja Va', 1, 1, 1)] })); }))
      .mockResolvedValueOnce(respuesta({ asesores: [A(50, 'Nueva Va', 1, 1000, 100)] }));
    const w = factory();
    await w.find('select').setValue('2026-10');
    await flushPromises();
    soltarVieja();
    await flushPromises();
    expect(w.text()).toContain('Nueva Va');
    expect(w.text()).not.toContain('Vieja Va');
  });

  it('una falla vieja tampoco apaga la nueva', async () => {
    let fallarVieja;
    presupuestosApi.obtener
      .mockImplementationOnce(() => new Promise((_, rej) => { fallarVieja = () => rej(new Error('viejo')); }))
      .mockResolvedValueOnce(respuesta());
    const w = factory();
    await w.find('select').setValue('2026-10');
    await flushPromises();
    fallarVieja();
    await flushPromises();
    expect(w.find('[data-testid="error-presupuesto"]').exists()).toBe(false);
    expect(w.findAll('[data-testid^="asesor-"]')).toHaveLength(2);
  });

  it('error al cargar: aviso en pantalla y mensaje', async () => {
    presupuestosApi.obtener.mockRejectedValue({ response: { data: { message: 'Sin permiso' } } });
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="error-presupuesto"]').exists()).toBe(true);
    expect(useToastStore(pinia).error).toHaveBeenCalledWith('Sin permiso');
  });
});

describe('Presupuesto (plantilla)', () => {
  let click, createObjectURL;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 25, 10));
    presupuestosApi.obtener.mockResolvedValue(respuesta());
    createObjectURL = vi.fn(() => 'blob:x');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { vi.useRealTimers(); click.mockRestore(); });

  it('descarga con el nombre de Content-Disposition', async () => {
    presupuestosApi.plantilla.mockResolvedValue({
      data: new Blob(['x'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      headers: { 'content-disposition': 'attachment; filename="presupuesto-prenecesidad-2026-11.xlsx"' }
    });
    const nombres = [];
    click.mockImplementation(function () { nombres.push(this.download); });
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-plantilla"]').trigger('click');
    await flushPromises();
    expect(presupuestosApi.plantilla).toHaveBeenCalledWith({ area_id: 7, anio: 2026, mes: 11 });
    expect(nombres).toEqual(['presupuesto-prenecesidad-2026-11.xlsx']);
  });

  it('sin Content-Disposition usa el nombre por defecto', async () => {
    presupuestosApi.plantilla.mockResolvedValue({ data: new Blob(['x']), headers: {} });
    const nombres = [];
    click.mockImplementation(function () { nombres.push(this.download); });
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-plantilla"]').trigger('click');
    await flushPromises();
    expect(nombres).toEqual(['presupuesto-prenecesidad-2026-11.xlsx']);
  });

  it('si el blob es un JSON de error muestra su mensaje y no descarga', async () => {
    presupuestosApi.plantilla.mockResolvedValue({
      data: new Blob([JSON.stringify({ success: false, message: 'No tienes acceso a esta área' })], { type: 'application/json' }),
      headers: {}
    });
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-plantilla"]').trigger('click');
    await flushPromises();
    expect(useToastStore(pinia).error).toHaveBeenCalledWith('No tienes acceso a esta área');
    expect(click).not.toHaveBeenCalled();
  });

  it('un rechazo con blob JSON también muestra el mensaje del servidor', async () => {
    presupuestosApi.plantilla.mockRejectedValue({
      response: { data: new Blob([JSON.stringify({ message: 'Mes inválido' })], { type: 'application/json' }) }
    });
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-plantilla"]').trigger('click');
    await flushPromises();
    expect(useToastStore(pinia).error).toHaveBeenCalledWith('Mes inválido');
  });
});
