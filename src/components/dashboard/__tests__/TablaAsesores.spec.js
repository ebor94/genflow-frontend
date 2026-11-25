import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import TablaAsesores from '@/components/dashboard/TablaAsesores.vue';

const FILA = { snap_id: 1, usuario: { usr_nombre: 'Denis', usr_apellido: 'M', usr_email: 'd@x' }, snap_gestiones_realizadas: 5, snap_interesados_nuevos: 2, snap_contratos_cerrados: 3, snap_vencidas_acumuladas: 0, snap_valor_vendido_cop: 9770000 };
const titulos = (w) => w.findAll('th').map((t) => t.text());
const plano = (w) => w.text().replace(/\s+/g, ' ');

describe('TablaAsesores', () => {
  it('sin metas cargadas no muestra Meta %', () => {
    const w = mount(TablaAsesores, { props: { asesores: [FILA] } });
    expect(titulos(w)).toEqual(['Asesor', 'Gestiones', 'Interesados', 'Contratos', 'Vencidas']);
    expect(plano(w)).not.toContain('%');
  });

  it('con metas sí, comparada con la meta real', () => {
    const w = mount(TablaAsesores, { props: { asesores: [{ ...FILA, meta: { meta_contratos: 12 } }] } });
    expect(titulos(w)).toContain('Meta %');
    expect(plano(w)).toContain('25%');
  });

  it('con ventas muestra lo vendido', () => {
    const w = mount(TablaAsesores, { props: { asesores: [FILA], conVentas: true } });
    expect(titulos(w)).toContain('Vendido');
    expect(plano(w)).toContain('$ 9.770.000');
  });

  it('vacía ocupa todas las columnas', () => {
    expect(mount(TablaAsesores, { props: { asesores: [] } }).get('td').attributes('colspan')).toBe('5');
    expect(mount(TablaAsesores, { props: { asesores: [], conVentas: true } }).get('td').attributes('colspan')).toBe('6');
  });
});
