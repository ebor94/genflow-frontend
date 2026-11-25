import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import SelectorProductos from '@/components/crm/SelectorProductos.vue';

const p = (prod_id, prod_nombre, prod_categoria, prod_tipo, extra = {}) =>
  ({ prod_id, prod_nombre, prod_categoria, prod_tipo, prod_es_generico: 0, prod_orden_display: prod_id, ...extra });
const PRODUCTOS = [
  p(1, 'Osarios', 'Mausoleos', 'Osarios', { prod_es_generico: 1 }),
  p(2, 'Osario mural mármol sector A2, sencillo', 'Mausoleos', 'Osarios', { prod_precio_base: '8770000.00' }),
  p(4, 'Lote doble', 'Mausoleos', 'Lotes', { prod_precio_base: '18950000.00', prod_descripcion: 'No incluye el valor del traspaso.' }),
  p(7, 'Inhumación nivel 1A', 'Inhumaciones', 'Lotes', { prod_precio_base: null })
];
const sel = (prod_id, es_principal = false) => ({ prod_id, es_principal, nota: null });
const plano = (t) => t.replace(/\s+/g, ' ');
const montar = (props = {}) => mount(SelectorProductos, { props: { modelValue: [], productos: PRODUCTOS, ...props } });
const ultimo = (w) => w.emitted('update:modelValue').at(-1)[0];

describe('SelectorProductos', () => {
  it('sin nada elegido dice Sin elegir y muestra las categorías cerradas', () => {
    const w = montar();
    expect(w.find('[data-testid="elegidos"]').text()).toBe('Sin elegir');
    expect(w.findAll('[data-testid="categoria"]').map((c) => c.text())).toEqual(['Mausoleos', 'Inhumaciones']);
    expect(w.find('[data-testid="producto-2"]').exists()).toBe(false);
  });

  it('abre y cierra una categoría: tipo por definir y productos con precio', async () => {
    const w = montar();
    await w.findAll('[data-testid="categoria"]')[0].trigger('click');
    expect(plano(w.find('[data-testid="producto-1"]').text())).toBe('Osarios por definir');
    expect(plano(w.find('[data-testid="producto-2"]').text())).toContain('$ 8.770.000');
    expect(w.findAll('[data-testid="categoria"]')[0].attributes('aria-expanded')).toBe('true');
    await w.findAll('[data-testid="categoria"]')[0].trigger('click');
    expect(w.find('[data-testid="producto-1"]').exists()).toBe(false);
  });

  it('un tipo sin fila por definir muestra su nombre como título', async () => {
    const w = montar();
    await w.findAll('[data-testid="categoria"]')[1].trigger('click');
    expect(w.text()).toContain('Lotes');
    expect(w.find('[data-testid="producto-7"]').text()).toBe('Inhumación nivel 1A');
  });

  it('elegir y quitar emiten la nueva selección', async () => {
    const w = montar();
    await w.findAll('[data-testid="categoria"]')[0].trigger('click');
    await w.find('[data-testid="producto-2"]').trigger('click');
    expect(ultimo(w)).toEqual([sel(2, true)]);
    await w.setProps({ modelValue: [sel(2, true), sel(4)] });
    expect(w.find('[data-testid="producto-2"]').attributes('aria-pressed')).toBe('true');
    await w.find('[data-testid="quitar-2"]').trigger('click');
    expect(ultimo(w)).toEqual([sel(4, true)]);
  });

  it('la estrella cambia el principal', async () => {
    const w = montar({ modelValue: [sel(2, true), sel(4)] });
    await w.find('[data-testid="principal-4"]').trigger('click');
    expect(ultimo(w)).toEqual([sel(2), sel(4, true)]);
  });

  it('muestra lo elegido con su precio y su nota', () => {
    const w = montar({ modelValue: [sel(4, true), sel(1)] });
    const t = plano(w.find('[data-testid="elegidos"]').text());
    expect(t).toContain('Lote doble · $ 18.950.000');
    expect(t).toContain('No incluye el valor del traspaso.');
    expect(t).toContain('Osarios · por definir');
  });

  it('de lo ya guardado muestra el precio ofrecido, no el vigente', () => {
    const w = montar({
      modelValue: [sel(2, true)],
      actuales: [{ pp_prod_id: 2, pp_precio_ofrecido: '8000000.00', producto: PRODUCTOS[1] }]
    });
    const t = plano(w.find('[data-testid="elegidos"]').text());
    expect(t).toContain('$ 8.000.000');
    expect(t).not.toContain('8.770.000');
  });

  it('un interés con producto inactivo se ve con su nombre y se puede quitar', async () => {
    const w = montar({
      modelValue: [sel(99, true)],
      actuales: [{ pp_prod_id: 99, pp_precio_ofrecido: null, producto: p(99, 'Velación', 'Servicio', null) }]
    });
    expect(w.find('[data-testid="elegidos"]').text()).toContain('Velación');
    await w.find('[data-testid="quitar-99"]').trigger('click');
    expect(ultimo(w)).toEqual([]);
  });

  it('un interés que no se encuentra dice Producto no disponible', () => {
    expect(montar({ modelValue: [sel(123, true)] }).find('[data-testid="elegidos"]').text()).toContain('Producto no disponible');
  });

  it('buscar abre lo que coincide y avisa si no hay nada', async () => {
    const w = montar();
    await w.find('input').setValue('marmol a2');
    expect(w.find('[data-testid="producto-2"]').exists()).toBe(true);
    expect(w.find('[data-testid="producto-4"]').exists()).toBe(false);
    await w.find('input').setValue('zzz');
    expect(w.text()).toContain('Ningún producto coincide. Prueba con otra palabra.');
  });

  it('Enter en el buscador no envía el formulario que lo contiene', async () => {
    const w = montar();
    const e = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
    w.find('input').element.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('todos sus botones son type=button, para no enviar el formulario', async () => {
    const w = montar({ modelValue: [sel(2, true)] });
    await w.findAll('[data-testid="categoria"]')[0].trigger('click');
    expect(w.findAll('button').every((b) => b.attributes('type') === 'button')).toBe(true);
  });
});
