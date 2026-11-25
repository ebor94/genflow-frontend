import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ProductosVendidos from '@/components/crm/ProductosVendidos.vue';

const p = (prod_id, prod_nombre, prod_categoria, prod_tipo, prod_precio_base, prod_es_generico = 0) =>
  ({ prod_id, prod_nombre, prod_categoria, prod_tipo, prod_precio_base, prod_es_generico, prod_orden_display: prod_id });
const PRODUCTOS = [p(1, 'Osarios', 'Mausoleos', 'Osarios', null, 1), p(2, 'Osario A2', 'Mausoleos', 'Osarios', '8770000.00'), p(3, 'Lote doble', 'Mausoleos', 'Lotes', '18950000.00')];
const LINEA = { prod_id: 2, nombre: 'Osario A2', vendido: true, cantidad: 2, precio_unitario: 8500000 };

function montar(modelValue = [LINEA], extra = {}) {
  const w = mount(ProductosVendidos, {
    props: { modelValue, productos: PRODUCTOS, ...extra, 'onUpdate:modelValue': (v) => w.setProps({ modelValue: v }) }
  });
  return w;
}
const plano = (x) => x.text().replace(/\s+/g, ' ').trim();
const ultimo = (w) => w.emitted('update:modelValue').at(-1)[0];

describe('ProductosVendidos', () => {
  it('muestra cantidad, precio, subtotal y total', () => {
    const w = montar();
    expect(w.get('[data-testid="cantidad-2"]').element.value).toBe('2');
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('8.500.000');
    expect(plano(w.get('[data-testid="subtotal-2"]'))).toBe('$ 17.000.000');
    expect(plano(w.get('[data-testid="total-venta"]'))).toBe('$ 17.000.000');
  });

  it('cambiar cantidad y precio recalcula', async () => {
    const w = montar();
    await w.get('[data-testid="cantidad-2"]').setValue('3');
    await w.get('[data-testid="precio-2"] input').setValue('1000');
    expect(ultimo(w)).toEqual([{ ...LINEA, cantidad: 3, precio_unitario: 1000 }]);
    expect(plano(w.get('[data-testid="total-venta"]'))).toBe('$ 3.000');
  });

  it('una cantidad sin dígitos queda vacía, no en cero', async () => {
    const w = montar();
    await w.get('[data-testid="cantidad-2"]').setValue('abc');
    expect(ultimo(w)[0].cantidad).toBeNull();
  });

  it('desmarcar saca el producto del total sin perder lo escrito', async () => {
    const w = montar();
    await w.get('[data-testid="vendido-2"]').setValue(false);
    expect(ultimo(w)).toEqual([{ ...LINEA, vendido: false }]);
    expect(w.text()).toContain('no se vendió');
    expect(w.find('[data-testid="precio-2"]').exists()).toBe(false);
    expect(plano(w.get('[data-testid="total-venta"]'))).toBe('$ 0');
  });

  it('agregar ofrece solo productos exactos que no están, agrupados', async () => {
    const w = montar();
    const select = w.get('[data-testid="agregar-producto"]');
    expect(select.findAll('optgroup').map((g) => g.attributes('label'))).toEqual(['Mausoleos › Lotes']);
    expect(select.findAll('option').map((o) => o.text())).toEqual(['+ Agregar otro producto…', 'Lote doble']);
    await select.setValue('3');
    expect(ultimo(w).at(-1)).toEqual({ prod_id: 3, nombre: 'Lote doble', vendido: true, cantidad: 1, precio_unitario: 18950000 });
    expect(select.element.value).toBe('');
  });

  it('avisa de los "por definir"', () => {
    expect(plano(montar([], { porDefinir: ['Osarios', 'Lotes'] }).get('[data-testid="por-definir"]')))
      .toBe('Falta definir: Osarios, Lotes. Agrega abajo el producto exacto que se vendió.');
    expect(montar().find('[data-testid="por-definir"]').exists()).toBe(false);
  });

  it('Enter en la cantidad y en el precio no envía el formulario', async () => {
    const w = montar();
    for (const el of [w.get('[data-testid="cantidad-2"]').element, w.get('[data-testid="precio-2"] input').element]) {
      const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
  });
});
