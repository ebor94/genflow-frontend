import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/presupuestosApi', () => ({
  presupuestosApi: { revisar: vi.fn(), guardar: vi.fn() }
}));

import { presupuestosApi } from '@/api/presupuestosApi';
import { useToastStore } from '@/stores/useToastStore';
import { fmtCOP } from '@/utils/format';
import SubirPresupuestoModal from '@/components/prenec/SubirPresupuestoModal.vue';

const FILAS = [
  { usr_id: 10, nombre: 'Ana Ruiz', valores: { Exequial: 1500, Lote: 0 } },
  { usr_id: 11, nombre: 'Luis Paz', valores: { Exequial: 0, Lote: 700 } }
];
const CAMBIOS = [
  { usr_id: 10, nombre: 'Ana Ruiz', categoria: 'Exequial', antes: 1000, despues: 1500 },
  { usr_id: 10, nombre: 'Ana Ruiz', categoria: 'Lote', antes: 0, despues: 200 },
  { usr_id: 11, nombre: 'Luis Paz', categoria: 'Lote', antes: 300, despues: 700 }
];
const ok = (extra = {}) => ({ success: true, data: { filas: FILAS, cambios: CAMBIOS, errores: [], ...extra } });

let pinia;
function factory(props = {}) {
  pinia = createTestingPinia({ createSpy: vi.fn });
  return mount(SubirPresupuestoModal, {
    props: { open: true, areaId: 7, anio: 2026, mes: 10, ...props },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
}
async function elegir(w, nombre = 'p.xlsx') {
  const input = w.find('[data-testid="archivo"]');
  const archivo = new File(['x'], nombre);
  Object.defineProperty(input.element, 'files', { value: [archivo], configurable: true });
  await input.trigger('change');
  await flushPromises();
  return archivo;
}

describe('SubirPresupuestoModal', () => {
  beforeEach(() => { vi.clearAllMocks(); presupuestosApi.revisar.mockResolvedValue(ok()); presupuestosApi.guardar.mockResolvedValue({ success: true }); });

  it('al elegir el archivo lo revisa con FormData (archivo, área, año, mes)', async () => {
    const w = factory();
    const archivo = await elegir(w);
    const fd = presupuestosApi.revisar.mock.calls[0][0];
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('archivo')).toBe(archivo);
    expect(fd.get('area_id')).toBe('7');
    expect(fd.get('anio')).toBe('2026');
    expect(fd.get('mes')).toBe('10');
  });

  it('el título es Subir hasta que hay cambios revisados, y luego Confirmar', async () => {
    presupuestosApi.revisar.mockResolvedValueOnce(ok({ errores: [{ fila: 4, columna: 'C', mensaje: 'Malo' }] }));
    const w = factory();
    expect(w.text()).toContain('Subir presupuesto de octubre 2026');
    await elegir(w);
    expect(w.text()).toContain('Subir presupuesto de octubre 2026');
    presupuestosApi.revisar.mockResolvedValueOnce(ok());
    await elegir(w, 'b.xlsx');
    expect(w.text()).toContain('Confirmar presupuesto de octubre 2026');
    expect(w.text()).not.toContain('Subir presupuesto de');
  });

  it('muestra el nombre del archivo elegido y usa el estilo del selector de listas', async () => {
    const w = factory();
    expect(w.find('[data-testid="nombre-archivo"]').exists()).toBe(false);
    expect(w.find('[data-testid="archivo"]').classes()).toContain('file:bg-gold');
    await elegir(w, 'ventas-nov.xlsx');
    expect(w.find('[data-testid="nombre-archivo"]').text()).toContain('ventas-nov.xlsx');
  });

  it('las cifras usan números alineados y de línea', async () => {
    const w = factory();
    await elegir(w);
    expect(w.find('[data-testid="resumen"]').element.closest('.tabular-nums.lining-nums')).not.toBeNull();
  });

  it('muestra cuántos asesores y valores cambian y la lista antes → después', async () => {
    const w = factory();
    await elegir(w);
    expect(w.text()).toContain('Confirmar presupuesto de octubre 2026');
    expect(w.find('[data-testid="resumen"]').text()).toContain('2 asesores');
    expect(w.find('[data-testid="resumen"]').text()).toContain('3 valores');
    const items = w.findAll('[data-testid="cambio"]').map((c) => c.text());
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('Ana Ruiz, Exequial');
    expect(items[0]).toContain(`${fmtCOP(1000)} → ${fmtCOP(1500)}`);
  });

  it('con errores muestra fila y columna y no deja guardar', async () => {
    presupuestosApi.revisar.mockResolvedValue(ok({ cambios: CAMBIOS, errores: [{ fila: 5, columna: 'D (Lote)', mensaje: 'Debe ser un entero' }] }));
    const w = factory();
    await elegir(w);
    const e = w.find('[data-testid="errores"]').text();
    expect(e).toContain('5');
    expect(e).toContain('D (Lote)');
    expect(e).toContain('Debe ser un entero');
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(false);
    expect(w.find('[data-testid="cambio"]').exists()).toBe(false);
  });

  it('sin cambios lo dice y no deja guardar', async () => {
    presupuestosApi.revisar.mockResolvedValue(ok({ cambios: [] }));
    const w = factory();
    await elegir(w);
    expect(w.text()).toContain('El archivo no trae cambios');
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(false);
  });

  it('confirmar guarda con las filas revisadas, avisa y recarga', async () => {
    const w = factory();
    await elegir(w);
    await w.find('[data-testid="btn-confirmar"]').trigger('click');
    await flushPromises();
    expect(presupuestosApi.guardar).toHaveBeenCalledWith({ area_id: 7, anio: 2026, mes: 10, filas: FILAS });
    expect(useToastStore(pinia).success).toHaveBeenCalled();
    expect(w.emitted('guardado')).toHaveLength(1);
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('si guardar falla muestra el mensaje y no recarga', async () => {
    presupuestosApi.guardar.mockRejectedValue({ response: { data: { message: 'Asesor fuera de tu alcance' } } });
    const w = factory();
    await elegir(w);
    await w.find('[data-testid="btn-confirmar"]').trigger('click');
    await flushPromises();
    expect(useToastStore(pinia).error).toHaveBeenCalledWith('Asesor fuera de tu alcance');
    expect(w.emitted('guardado')).toBeUndefined();
  });

  it('si revisar falla muestra el mensaje en la ventana', async () => {
    presupuestosApi.revisar.mockRejectedValue({ response: { data: { message: 'El archivo no es un Excel válido' } } });
    const w = factory();
    await elegir(w);
    expect(w.find('[data-testid="error-archivo"]').text()).toContain('El archivo no es un Excel válido');
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(false);
  });

  it('cambiar de archivo limpia lo anterior', async () => {
    presupuestosApi.revisar.mockResolvedValueOnce(ok({ errores: [{ fila: 4, columna: 'C', mensaje: 'Malo' }] }));
    const w = factory();
    await elegir(w, 'a.xlsx');
    expect(w.find('[data-testid="errores"]').exists()).toBe(true);
    presupuestosApi.revisar.mockResolvedValueOnce(ok());
    await elegir(w, 'b.xlsx');
    expect(w.find('[data-testid="errores"]').exists()).toBe(false);
    expect(w.findAll('[data-testid="cambio"]')).toHaveLength(3);
  });

  it('una revisión que llega tarde, después de cambiar el mes, no se muestra', async () => {
    let soltar;
    presupuestosApi.revisar.mockImplementationOnce(() => new Promise((res) => { soltar = () => res(ok({ errores: [{ fila: 9, columna: 'Z', mensaje: 'Vieja' }] })); }));
    const w = factory();
    await elegir(w, 'a.xlsx');
    await w.setProps({ mes: 11 });
    soltar();
    await flushPromises();
    expect(w.text()).not.toContain('Vieja');
    expect(w.find('[data-testid="archivo"]').attributes('disabled')).toBeUndefined();
  });

  it('al reabrir queda en blanco', async () => {
    const w = factory();
    await elegir(w);
    await w.setProps({ open: false });
    await w.setProps({ open: true });
    expect(w.find('[data-testid="resumen"]').exists()).toBe(false);
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(false);
  });

  it('errores del libro entero (fila y columna null) salen sin prefijo; con fila sin columna, solo la fila', async () => {
    presupuestosApi.revisar.mockResolvedValue(ok({ errores: [
      { fila: null, columna: null, mensaje: 'El archivo es de otro mes' },
      { fila: 5, columna: 'F (Mausoleos)', mensaje: 'Debe ser un entero' },
      { fila: 6, columna: null, mensaje: 'Falta el ID' },
      { fila: 7, mensaje: 'Repetido' }
    ] }));
    const w = factory();
    await elegir(w);
    const e = w.findAll('[data-testid="errores"] li').map((l) => l.text());
    expect(e).toEqual([
      'El archivo es de otro mes',
      'Fila 5, columna F (Mausoleos): Debe ser un entero',
      'Fila 6: Falta el ID',
      'Fila 7: Repetido'
    ]);
  });

  it('archivo sin filas dice que no trae asesores, distinto de sin cambios', async () => {
    presupuestosApi.revisar.mockResolvedValue(ok({ filas: [], cambios: [] }));
    const w = factory();
    await elegir(w);
    expect(w.text()).toContain('El archivo no trae asesores');
    expect(w.text()).not.toContain('no trae cambios');
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(false);
  });

  it.each([['mes', { mes: 11 }], ['anio', { anio: 2027 }], ['areaId', { areaId: 8 }]])('si cambia %s con la ventana abierta se limpia lo revisado y el archivo', async (_n, cambio) => {
    const w = factory();
    await elegir(w);
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(true);
    await w.setProps(cambio);
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(false);
    expect(w.find('[data-testid="resumen"]').exists()).toBe(false);
    expect(w.find('[data-testid="nombre-archivo"]').exists()).toBe(false);
  });

  it('guarda con el periodo y el área que se revisaron', async () => {
    const w = factory({ areaId: 7, anio: 2026, mes: 10 });
    await elegir(w);
    const fd = presupuestosApi.revisar.mock.calls[0][0];
    await w.find('[data-testid="btn-confirmar"]').trigger('click');
    expect(presupuestosApi.guardar).toHaveBeenCalledWith({ area_id: Number(fd.get('area_id')), anio: Number(fd.get('anio')), mes: Number(fd.get('mes')), filas: FILAS });
  });

  it('mientras revisa, el selector de archivo queda en espera y avisa', async () => {
    let soltar;
    presupuestosApi.revisar.mockImplementation(() => new Promise((res) => { soltar = () => res(ok()); }));
    const w = factory();
    await elegir(w);
    expect(w.find('[data-testid="archivo"]').attributes('disabled')).toBeDefined();
    expect(w.find('[aria-live="polite"]').text()).toContain('Revisando');
    soltar();
    await flushPromises();
    expect(w.find('[data-testid="archivo"]').attributes('disabled')).toBeUndefined();
    expect(w.find('[aria-live="polite"]').text()).not.toContain('Revisando');
  });

  it('mientras guarda, Cancelar y Confirmar quedan en espera y no se cierra', async () => {
    let soltar;
    presupuestosApi.guardar.mockImplementation(() => new Promise((res) => { soltar = () => res({ success: true }); }));
    const w = factory();
    await elegir(w);
    await w.find('[data-testid="btn-confirmar"]').trigger('click');
    expect(w.find('[data-testid="btn-confirmar"]').attributes('disabled')).toBeDefined();
    expect(w.find('[data-testid="btn-cancelar"]').attributes('disabled')).toBeDefined();
    expect(w.find('[data-testid="archivo"]').attributes('disabled')).toBeDefined();
    soltar();
    await flushPromises();
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('mientras guarda, la X de la ventana no la cierra', async () => {
    let soltar;
    presupuestosApi.guardar.mockImplementation(() => new Promise((res) => { soltar = () => res({ success: true }); }));
    const w = factory();
    await elegir(w);
    await w.find('[data-testid="btn-confirmar"]').trigger('click');
    await w.find('[aria-label="Cerrar"]').trigger('click');
    expect(w.emitted('close')).toBeUndefined();
    soltar();
    await flushPromises();
  });

  it('si guardar falla la ventana sigue abierta y se puede reintentar', async () => {
    presupuestosApi.guardar.mockRejectedValueOnce(new Error('x'));
    const w = factory();
    await elegir(w);
    await w.find('[data-testid="btn-confirmar"]').trigger('click');
    await flushPromises();
    expect(w.emitted('close')).toBeUndefined();
    expect(w.find('[data-testid="btn-confirmar"]').attributes('disabled')).toBeUndefined();
    await w.find('[data-testid="btn-confirmar"]').trigger('click');
    await flushPromises();
    expect(w.emitted('guardado')).toHaveLength(1);
  });

  it('volver a elegir el mismo archivo ya corregido lo revisa de nuevo', async () => {
    presupuestosApi.revisar.mockResolvedValueOnce(ok({ errores: [{ fila: 4, columna: 'C', mensaje: 'Malo' }] }));
    const w = factory();
    await elegir(w, 'mismo.xlsx');
    expect(w.find('[data-testid="errores"]').exists()).toBe(true);
    await elegir(w, 'mismo.xlsx');
    expect(presupuestosApi.revisar).toHaveBeenCalledTimes(2);
    expect(w.find('[data-testid="errores"]').exists()).toBe(false);
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(true);
  });

  it('accesibilidad: los errores tienen role alert', async () => {
    presupuestosApi.revisar.mockResolvedValueOnce(ok({ errores: [{ fila: 4, columna: 'C', mensaje: 'Malo' }] }));
    let w = factory();
    await elegir(w);
    expect(w.find('[data-testid="errores"]').attributes('role')).toBe('alert');
    presupuestosApi.revisar.mockRejectedValueOnce(new Error('roto'));
    w = factory();
    await elegir(w);
    expect(w.find('[data-testid="error-archivo"]').attributes('role')).toBe('alert');
  });
});
