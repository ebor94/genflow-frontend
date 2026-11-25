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
  it('el color de la barra sigue al semáforo', () => {
    const w = montar({ asesores: [
      { usr_id: 1, nombre: 'A', presupuesto: 1000, realizado: 1000 },
      { usr_id: 2, nombre: 'B', presupuesto: 1000, realizado: 900 },
      { usr_id: 3, nombre: 'C', presupuesto: 1000, realizado: 100 },
      { usr_id: 4, nombre: 'D', presupuesto: 0, realizado: 100 }
    ] });
    const clases = (id) => w.find(`[data-testid="barra-${id}"]`).classes();
    expect(clases(1)).toContain('bg-sage');
    expect(clases(2)).toContain('bg-warning');
    expect(clases(3)).toContain('bg-danger');
    expect(clases(4)).not.toContain('bg-danger');
  });
  it('un asesor retirado lleva la etiqueta Retirado; uno activo no', () => {
    const w = montar({ asesores: [
      { usr_id: 1, nombre: 'A', presupuesto: 1, realizado: 1, activo: false },
      { usr_id: 2, nombre: 'B', presupuesto: 1, realizado: 1, activo: true }
    ] });
    expect(w.find('[data-testid="asesor-1"]').text()).toContain('Retirado');
    expect(w.find('[data-testid="asesor-2"]').text()).not.toContain('Retirado');
  });
});
