import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import TablaPresupuesto from '@/components/prenec/TablaPresupuesto.vue';
import { fmtCOP } from '@/utils/format';

const ASESOR = {
  usr_id: 1, nombre: 'Ana Ruiz', presupuesto: 3000, realizado: 2400,
  categorias: { Exequial: { presupuesto: 2000, realizado: 2400 }, Cremación: { presupuesto: 0, realizado: 0 }, Lote: { presupuesto: 1000, realizado: 0 } }
};
const montar = (asesor = ASESOR) => mount(TablaPresupuesto, { props: { asesor, categorias: ['Exequial', 'Cremación', 'Lote'] } });

describe('TablaPresupuesto', () => {
  it('encabezados y una fila por categoría, en el orden dado', () => {
    const w = montar();
    expect(w.findAll('thead th').map((t) => t.text())).toEqual(['Categoría', 'Presupuesto', 'Realizado', 'Cumplimiento']);
    const filas = w.findAll('[data-testid^="fila-"]:not([data-testid="fila-total"])');
    expect(filas.map((f) => f.find('td').text())).toEqual(['Exequial', 'Cremación', 'Lote']);
    const c = w.find('[data-testid="fila-Exequial"]').findAll('td');
    expect(c[1].text()).toBe(fmtCOP(2000));
    expect(c[2].text()).toBe(fmtCOP(2400));
    expect(c[3].text()).toContain('120 %');
  });
  it('sin presupuesto muestra — en cumplimiento', () => {
    const w = montar();
    expect(w.find('[data-testid="fila-Cremación"]').findAll('td')[3].text()).toContain('—');
  });
  it('categoría que falta en el asesor cuenta como 0', () => {
    const w = montar({ ...ASESOR, categorias: {} });
    expect(w.find('[data-testid="fila-Lote"]').findAll('td')[1].text()).toBe(fmtCOP(0));
  });
  it('fila Total en negrita con los totales del asesor', () => {
    const w = montar();
    const t = w.find('[data-testid="fila-total"]');
    expect(t.classes()).toContain('font-bold');
    const c = t.findAll('td');
    expect(c[0].text()).toBe('Total');
    expect(c[1].text()).toBe(fmtCOP(3000));
    expect(c[2].text()).toBe(fmtCOP(2400));
    expect(c[3].text()).toContain('80 %');
  });
});
