import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import BaseSelect from '@/components/ui/BaseSelect.vue';

describe('BaseSelect', () => {
  it('ariaLabel da nombre accesible al select', () => {
    const w = mount(BaseSelect, { props: { modelValue: 'a', options: [{ value: 'a', label: 'A' }], ariaLabel: 'Mes' } });
    expect(w.find('select').attributes('aria-label')).toBe('Mes');
  });
  it('sin ariaLabel no pone el atributo', () => {
    const w = mount(BaseSelect, { props: { modelValue: 'a', options: [] } });
    expect(w.find('select').attributes('aria-label')).toBeUndefined();
  });
});
