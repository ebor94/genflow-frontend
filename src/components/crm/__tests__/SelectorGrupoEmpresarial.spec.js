import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/categorizacionApi', () => ({
  gruposEmpresarialesApi: {
    list: vi.fn(() => Promise.resolve({ data: [{ grupemp_id: 1, grupemp_nombre: 'Grupo Éxito' }] })),
    findOrCreate: vi.fn()
  }
}));

import SelectorGrupoEmpresarial from '@/components/crm/SelectorGrupoEmpresarial.vue';

let w;
let scrollSpy;
const original = Element.prototype.scrollIntoView;

beforeEach(() => {
  vi.useFakeTimers();
  scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy;
  w = mount(SelectorGrupoEmpresarial, {
    attachTo: document.body,
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })] }
  });
});
afterEach(() => {
  w.unmount();
  vi.useRealTimers();
  Element.prototype.scrollIntoView = original;
});

async function escribir() {
  const input = w.get('input');
  await input.trigger('focus');
  await input.setValue('Gru');
  await vi.advanceTimersByTimeAsync(300);
  await flushPromises();
  return input;
}

describe('SelectorGrupoEmpresarial', () => {
  it('al llegar las opciones, la lista se acerca a lo visible', async () => {
    await escribir();
    expect(w.text()).toContain('Grupo Éxito');
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' });
    expect(scrollSpy.mock.contexts.at(-1)).toBe(w.get('.absolute.z-20').element);
  });

  it('al salir del campo, a los 200 ms la lista desaparece sin errores', async () => {
    const input = await escribir();
    await input.trigger('blur');
    expect(w.text()).toContain('Grupo Éxito');
    await vi.advanceTimersByTimeAsync(200);
    expect(w.text()).not.toContain('Grupo Éxito');
  });

  it('al elegir una opción se emite su id', async () => {
    await escribir();
    await w.get('button[type="button"]').trigger('mousedown');
    expect(w.emitted('update:modelValue').at(-1)).toEqual([1]);
  });
});
