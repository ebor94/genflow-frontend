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
function factory() {
  pinia = createTestingPinia({ createSpy: vi.fn });
  return mount(SubirPresupuestoModal, {
    props: { open: true, areaId: 7, anio: 2026, mes: 10 },
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

  it('una revisión vieja no pisa la del archivo nuevo', async () => {
    let soltar;
    presupuestosApi.revisar
      .mockImplementationOnce(() => new Promise((res) => { soltar = () => res(ok({ errores: [{ fila: 9, columna: 'Z', mensaje: 'Vieja' }] })); }))
      .mockResolvedValueOnce(ok());
    const w = factory();
    await elegir(w, 'a.xlsx');
    await elegir(w, 'b.xlsx');
    soltar();
    await flushPromises();
    expect(w.text()).not.toContain('Vieja');
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(true);
  });

  it('al reabrir queda en blanco', async () => {
    const w = factory();
    await elegir(w);
    await w.setProps({ open: false });
    await w.setProps({ open: true });
    expect(w.find('[data-testid="resumen"]').exists()).toBe(false);
    expect(w.find('[data-testid="btn-confirmar"]').exists()).toBe(false);
  });
});
