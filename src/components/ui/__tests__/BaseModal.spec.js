import { mount, DOMWrapper } from '@vue/test-utils';
import { afterEach, describe, it, expect } from 'vitest';
import BaseModal from '@/components/ui/BaseModal.vue';

// Teleport y Transition reales: los stubs vuelven a crear los nodos en cada cambio y las
// pruebas de desplazamiento pasarían sin probar nada.
let w;
function montar(props = {}, contenido = '<input class="campo" />') {
  w = mount(BaseModal, {
    props: { open: true, title: 'Registrar gestión', ...props },
    slots: { default: contenido, footer: '<button type="button">Registrar</button>' },
    attachTo: document.body,
    global: { stubs: { teleport: false, transition: false } }
  });
}
const en = (selector) => new DOMWrapper(document.body).get(selector);
const fondo = () => en('[data-testid="modal-fondo"]');
const cuerpo = () => en('[data-testid="modal-cuerpo"]');
afterEach(() => w.unmount());

describe('cierre', () => {
  it('un clic afuera no cierra', async () => {
    montar();
    await fondo().trigger('click');
    expect(w.emitted('close')).toBeUndefined();
  });

  it('un clic adentro tampoco, aunque la ventana deje cerrar afuera', async () => {
    montar({ cierraAfuera: true });
    await en('.campo').trigger('click');
    await cuerpo().trigger('click');
    expect(w.emitted('close')).toBeUndefined();
  });

  it('con cierraAfuera, un clic afuera cierra', async () => {
    montar({ cierraAfuera: true });
    await fondo().trigger('click');
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('Escape no cierra, ni desde un campo ni desde la página', async () => {
    montar({ cierraAfuera: true });
    await en('.campo').trigger('keydown', { key: 'Escape' });
    await en('.campo').trigger('keyup', { key: 'Escape' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(w.emitted('close')).toBeUndefined();
  });

  it('la X cierra y no envía formularios', async () => {
    montar();
    const x = en('[aria-label="Cerrar"]');
    expect(x.attributes('type')).toBe('button');
    await x.trigger('click');
    expect(w.emitted('close')).toHaveLength(1);
  });
});

describe('alto', () => {
  it('la tarjeta se limita a la pantalla y solo se desplaza el contenido', () => {
    montar();
    const tarjeta = fondo().element.firstElementChild;
    expect([...tarjeta.classList]).toContain('sv-modal');
    const [titulo, centro, pie] = tarjeta.children;
    expect(titulo.tagName).toBe('HEADER');
    expect([...titulo.classList]).toContain('shrink-0');
    expect(centro).toBe(cuerpo().element);
    expect([...centro.classList]).toEqual(expect.arrayContaining(['flex-1', 'min-h-0', 'overflow-y-auto']));
    expect(pie.tagName).toBe('FOOTER');
    expect([...pie.classList]).toContain('shrink-0');
  });

  it('al cambiar de paso el contenido vuelve arriba', async () => {
    montar({ paso: 1 });
    const centro = cuerpo().element;
    centro.scrollTop = 120;
    await w.setProps({ paso: 2 });
    expect(cuerpo().element).toBe(centro);
    expect(centro.scrollTop).toBe(0);
  });

  it('si el paso no cambia, conserva el desplazamiento', async () => {
    montar({ paso: 1 });
    const centro = cuerpo().element;
    centro.scrollTop = 120;
    await w.setProps({ title: 'Otro título' });
    expect(cuerpo().element).toBe(centro);
    expect(centro.scrollTop).toBe(120);
  });
});

describe('rueda', () => {
  it('rodar sobre un campo numérico enfocado le quita el foco para no cambiar su valor', async () => {
    montar({}, '<input type="number" class="numero" />');
    const campo = en('.numero').element;
    campo.focus();
    expect(document.activeElement).toBe(campo);
    await en('.numero').trigger('wheel');
    expect(document.activeElement).not.toBe(campo);
  });

  it('rodar sobre un campo de texto enfocado conserva el foco', async () => {
    montar();
    const campo = en('.campo').element;
    campo.focus();
    await en('.campo').trigger('wheel');
    expect(document.activeElement).toBe(campo);
  });
});
