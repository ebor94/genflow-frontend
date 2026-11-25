import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ChipCumplimiento from '@/components/prenec/ChipCumplimiento.vue';

const chip = (realizado, presupuesto) => mount(ChipCumplimiento, { props: { realizado, presupuesto } });

describe('ChipCumplimiento', () => {
  it('verde desde 100 con número, ícono y texto accesible', () => {
    const w = chip(120, 100);
    expect(w.attributes('data-estado')).toBe('ok');
    expect(w.text()).toContain('120 %');
    expect(w.find('[data-testid="chip-icono"]').text()).toBe('✓');
    expect(w.find('.sr-only').text()).toContain('cumplido');
    expect(w.classes().join(' ')).toContain('border-sage');
    expect(w.classes().join(' ')).not.toMatch(/(^| )text-(sage|danger|warning)/);
  });
  it('amarillo: 99,6 muestra 100 % pero es alerta', () => {
    const w = chip(996, 1000);
    expect(w.attributes('data-estado')).toBe('alerta');
    expect(w.text()).toContain('100 %');
    expect(w.find('[data-testid="chip-icono"]').text()).toBe('!');
    expect(w.classes().join(' ')).toContain('border-warning');
  });
  it('rojo bajo 80', () => {
    const w = chip(79, 100);
    expect(w.attributes('data-estado')).toBe('mal');
    expect(w.find('[data-testid="chip-icono"]').text()).toBe('✕');
    expect(w.classes().join(' ')).toContain('border-danger');
  });
  it('sin presupuesto muestra —', () => {
    const w = chip(5000, 0);
    expect(w.attributes('data-estado')).toBe('sin');
    expect(w.text()).toContain('—');
    expect(w.text()).not.toContain('%');
    expect(w.find('.sr-only').text()).toContain('sin presupuesto');
  });
});
