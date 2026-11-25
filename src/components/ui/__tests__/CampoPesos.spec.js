import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import CampoPesos from '@/components/ui/CampoPesos.vue';

// El padre actualiza el valor, como con v-model.
function montar(modelValue = null) {
  const w = mount(CampoPesos, {
    attachTo: document.body,
    props: { modelValue, etiqueta: 'Precio', 'onUpdate:modelValue': (v) => w.setProps({ modelValue: v }) }
  });
  return { w, input: w.get('input') };
}
async function escribir(input, texto, cursor = texto.length) {
  input.element.value = texto;
  input.element.setSelectionRange(cursor, cursor);
  await input.trigger('input');
}

describe('CampoPesos', () => {
  it('muestra el valor con separador de miles y la etiqueta', () => {
    const { input } = montar(8770000);
    expect(input.element.value).toBe('8.770.000');
    expect(input.attributes('aria-label')).toBe('Precio');
    expect(input.attributes('type')).toBe('text');
  });
  it('al escribir da formato y emite el entero', async () => {
    const { w, input } = montar();
    await escribir(input, '8770000');
    expect(w.emitted('update:modelValue').at(-1)).toEqual([8770000]);
    expect(input.element.value).toBe('8.770.000');
  });
  it('descarta lo que no son dígitos, incluso pegado', async () => {
    const { w, input } = montar();
    await escribir(input, '$ 1.250.000 COP');
    expect(w.emitted('update:modelValue').at(-1)).toEqual([1250000]);
    await escribir(input, '1.250.000x');
    expect(input.element.value).toBe('1.250.000');
    expect(w.emitted('update:modelValue')).toHaveLength(1);
  });
  it('vacío emite null', async () => {
    const { w, input } = montar(500);
    await escribir(input, '');
    expect(w.emitted('update:modelValue').at(-1)).toEqual([null]);
    expect(input.element.value).toBe('');
  });
  it('el cursor no salta al editar en el medio', async () => {
    const { input } = montar(8770000);
    await escribir(input, '8.7570.000', 4); // escribió un 5 después del primer 7
    expect(input.element.value).toBe('87.570.000');
    expect(input.element.selectionStart).toBe(4); // sigue después del 5
  });
  it('no pasa de 10 dígitos', async () => {
    const { w, input } = montar();
    await escribir(input, '123456789012');
    expect(w.emitted('update:modelValue').at(-1)).toEqual([1234567890]);
  });
  describe('borrar', () => {
    async function borrar(input, texto, cursor, inputType) {
      input.element.value = texto;
      input.element.setSelectionRange(cursor, cursor);
      input.element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
      await input.trigger('blur');
    }
    it('Retroceso sobre un punto de miles borra el dígito de al lado', async () => {
      const { w, input } = montar(8770000);
      await borrar(input, '8770.000', 1, 'deleteContentBackward');
      expect(w.emitted('update:modelValue').at(-1)).toEqual([770000]);
      expect(input.element.value).toBe('770.000');
      expect(input.element.selectionStart).toBe(0);
    });
    it('Suprimir sobre un punto de miles borra el dígito siguiente', async () => {
      const { w, input } = montar(8770000);
      await borrar(input, '8770.000', 1, 'deleteContentForward');
      expect(w.emitted('update:modelValue').at(-1)).toEqual([870000]);
      expect(input.element.value).toBe('870.000');
      expect(input.element.selectionStart).toBe(1);
    });
    it('borrar un dígito normal funciona igual', async () => {
      const { w, input } = montar(8770000);
      await borrar(input, '8.770.00', 8, 'deleteContentBackward');
      expect(w.emitted('update:modelValue').at(-1)).toEqual([877000]);
      expect(input.element.value).toBe('877.000');
    });
  });
});
