import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import BarrasPresupuesto from '@/components/prenec/BarrasPresupuesto.vue';
import { fmtCOP } from '@/utils/format';

const ASESORES = [
  { usr_id: 1, nombre: 'Ana Ruiz', presupuesto: 1000, realizado: 500 },
  { usr_id: 2, nombre: 'Luis Paz', presupuesto: 1000, realizado: 2500 },
  { usr_id: 3, nombre: 'Eva Gil', presupuesto: 0, realizado: 300 }
];
const montar = (props = {}) => mount(BarrasPresupuesto, { props: { asesores: ASESORES, ...props } });
const ancho = (w, id) => w.find(`[data-testid="barra-${id}"]`).attributes('style');

describe('BarrasPresupuesto', () => {
  it('una fila por asesor con nombre, "realizado de presupuesto" y chip', () => {
    const w = montar();
    expect(w.findAll('[data-testid^="asesor-"]')).toHaveLength(3);
    const f = w.find('[data-testid="asesor-1"]');
    expect(f.text()).toContain('Ana Ruiz');
    expect(f.text()).toContain(`${fmtCOP(500)} de ${fmtCOP(1000)}`);
    expect(f.find('[data-estado]').text()).toContain('50 %');
  });
  it('la barra llena es 100 % y más no se desborda', () => {
    const w = montar();
    expect(ancho(w, 1)).toContain('width: 50%');
    expect(ancho(w, 2)).toContain('width: 100%');
    expect(ancho(w, 3)).toContain('width: 0%');
  });
  it('título de la barra "$X de $Y"', () => {
    const w = montar();
    expect(w.find('[data-testid="barra-1"]').attributes('title')).toBe(`${fmtCOP(500)} de ${fmtCOP(1000)}`);
  });
  it('tocar una fila emite seleccionar y marca la elegida', async () => {
    const w = montar({ seleccionado: 2 });
    await w.find('[data-testid="asesor-1"]').trigger('click');
    expect(w.emitted('seleccionar')[0]).toEqual([1]);
    expect(w.find('[data-testid="asesor-2"]').attributes('aria-pressed')).toBe('true');
    expect(w.find('[data-testid="asesor-1"]').attributes('aria-pressed')).toBe('false');
  });
});
