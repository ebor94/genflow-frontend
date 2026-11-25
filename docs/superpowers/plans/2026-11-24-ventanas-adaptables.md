# Ventanas que se ajustan a la pantalla — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las ventanas de GenFlow nunca son más altas que la pantalla y no se cierran por accidente.

**Architecture:** El cambio vive en `BaseModal.vue` (22 usos) y en una clase `.sv-modal` de `main.css`. Tres ventanas le pasan una propiedad nueva: el buscador global `cierra-afuera`, y Nuevo prospecto y Nueva empresa `:paso`.

**Tech Stack:** Vue 3 (script setup), Tailwind 3.4, Vitest con happy-dom, @vue/test-utils, @pinia/testing.

**Spec:** `docs/superpowers/specs/2026-11-24-ventanas-adaptables-design.md`

## Global Constraints

- Trabajar solo en `/Users/bortega/Shared/Files From c.localized/apps/mantix/.wt/crm-frontend-modal`, rama `feat/modal-adaptable`. `node_modules` es un enlace; no `npm install`.
- `BaseModal` no se cierra con Escape. Con clic afuera, solo si `cierraAfuera` es `true`; por defecto es `false`.
- La X y los botones de cada ventana cierran sin preguntar, como hoy.
- El contenido de los formularios no cambia.
- Las pruebas de `BaseModal` usan Teleport y Transition reales (`stubs: { teleport: false, transition: false }`).
- Cada subagente firma sus commits con su propio modelo (`Co-Authored-By: <modelo> <noreply@anthropic.com>`).

---

### Task 1: Ventana ajustada a la pantalla y sin cierre accidental

**Files:**
- Modify: `src/components/ui/BaseModal.vue`, `src/assets/styles/main.css`, `src/components/crm/BusquedaGlobalModal.vue`, `src/components/crm/NuevoProspecto.vue`, `src/components/crm/NuevaEmpresa.vue`
- Test: `src/components/ui/__tests__/BaseModal.spec.js`, `src/components/crm/__tests__/ventanas.spec.js`

**Interfaces:** Produces en `BaseModal`: `cierraAfuera: Boolean` (por defecto `false`), `paso: Number | String` (por defecto `null`), y los `data-testid` `modal-fondo` y `modal-cuerpo`. Las propiedades y el evento `close` de hoy no cambian.

- [ ] **Step 1: Write the failing tests**

`src/components/ui/__tests__/BaseModal.spec.js`:

```js
import { mount, DOMWrapper } from '@vue/test-utils';
import { afterEach, describe, it, expect } from 'vitest';
import BaseModal from '@/components/ui/BaseModal.vue';

// Teleport y Transition reales: los stubs vuelven a crear los nodos en cada cambio y las
// pruebas de desplazamiento pasarían sin probar nada.
let w;
function montar(props = {}) {
  w = mount(BaseModal, {
    props: { open: true, title: 'Registrar gestión', ...props },
    slots: { default: '<input class="campo" />', footer: '<button type="button">Registrar</button>' },
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
```

`src/components/crm/__tests__/ventanas.spec.js`:

```js
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ params: {}, query: {} }) }));
vi.mock('@/api/buscadorApi', () => ({ buscadorApi: { buscar: vi.fn() } }));
vi.mock('@/api/personasApi', () => ({ personasApi: { buscar: vi.fn(), create: vi.fn() } }));

import BaseModal from '@/components/ui/BaseModal.vue';
import BusquedaGlobalModal from '@/components/crm/BusquedaGlobalModal.vue';
import NuevoProspecto from '@/components/crm/NuevoProspecto.vue';
import NuevaEmpresa from '@/components/crm/NuevaEmpresa.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';

function montar(componente, props) {
  return mount(componente, {
    props,
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } }
  });
}
const fondo = (w) => w.get('[data-testid="modal-fondo"]');

describe('cierre de las ventanas', () => {
  it('el buscador global sí se cierra con clic afuera', async () => {
    const w = montar(BusquedaGlobalModal, { open: true });
    await fondo(w).trigger('click');
    expect(w.emitted('close')).toHaveLength(1);
  });

  it.each([
    ['Nuevo prospecto', NuevoProspecto, { open: true, areaId: 1, grupoId: 1 }],
    ['Nueva empresa', NuevaEmpresa, { open: true }],
    ['Registrar gestión', RegistrarGestion, { open: true, prospecto: null }]
  ])('%s no se cierra con clic afuera', async (_n, componente, props) => {
    const w = montar(componente, props);
    await fondo(w).trigger('click');
    expect(w.emitted('close')).toBeUndefined();
  });
});

describe('formularios por pasos', () => {
  it.each([
    ['Nuevo prospecto', NuevoProspecto, { open: true, areaId: 1, grupoId: 1 }],
    ['Nueva empresa', NuevaEmpresa, { open: true }]
  ])('%s le dice su paso a la ventana', (_n, componente, props) => {
    const w = montar(componente, props);
    expect(w.findComponent(BaseModal).props('paso')).toBe(1);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/components/ui src/components/crm/__tests__/ventanas.spec.js` → FAIL: 13 de 14 (solo pasa la de Escape, que ya se cumple hoy y queda como resguardo).

- [ ] **Step 3: `src/components/ui/BaseModal.vue`**, completo:

```vue
<script setup>
/**
 * BaseModal.vue — ventana común.
 * Nunca es más alta que la pantalla: el título y los botones quedan fijos y se desplaza el
 * contenido. No se cierra con Escape ni con clic afuera, para no perder lo que se está
 * escribiendo: solo con la X o con los botones de cada ventana.
 *  - cierraAfuera: deja cerrar con clic afuera. Solo donde no se escribe información.
 *  - paso: en formularios por pasos, al cambiar devuelve el contenido arriba.
 */
import { ref, watch } from 'vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, default: '' },
  maxWidth: { type: String, default: 'max-w-lg' }, // tailwind class
  cierraAfuera: { type: Boolean, default: false },
  paso: { type: [Number, String], default: null }
});
const emit = defineEmits(['close']);

const cuerpo = ref(null);
watch(() => props.paso, () => {
  if (cuerpo.value) cuerpo.value.scrollTop = 0;
}, { flush: 'post' });

function clicAfuera() {
  if (props.cierraAfuera) emit('close');
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" data-testid="modal-fondo" class="fixed inset-0 z-50 flex items-center justify-center bg-brown-deep/60 px-4" @click.self="clicAfuera">
        <div class="sv-card sv-modal w-full" :class="maxWidth">
          <header v-if="title || $slots.header" class="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-text3/15">
            <h3 class="min-w-0 text-lg text-brown-deep">{{ title }}<slot name="header" /></h3>
            <button type="button" class="shrink-0 text-text3 hover:text-text1 transition-colors" @click="emit('close')" aria-label="Cerrar">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div ref="cuerpo" data-testid="modal-cuerpo" class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="shrink-0 px-5 py-3 border-t border-text3/15 bg-cream/40 flex flex-wrap justify-end gap-2 rounded-b-sv">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
```

- [ ] **Step 4: `src/assets/styles/main.css`.** Dentro de `@layer components`, justo debajo del bloque `.sv-card`, agrega:

```css
  /* Ventanas: nunca más altas que la pantalla. dvh descuenta la barra del navegador en el
     celular; la línea con vh queda para los navegadores que no lo conocen. */
  .sv-modal {
    @apply flex flex-col;
    max-height: calc(100vh - 1.5rem);
    max-height: calc(100dvh - 1.5rem);
  }
```

- [ ] **Step 5: las tres ventanas.**

`BusquedaGlobalModal.vue`: reemplaza

```html
  <BaseModal :open="open" title="" max-width="max-w-2xl" @close="emit('close')">
```

por

```html
  <BaseModal :open="open" title="" max-width="max-w-2xl" cierra-afuera @close="emit('close')">
```

`NuevoProspecto.vue`: en la etiqueta `<BaseModal …>` reemplaza `max-width="max-w-2xl" @close="emit('close')">` por `max-width="max-w-2xl" :paso="paso" @close="emit('close')">`.

`NuevaEmpresa.vue`: reemplaza

```html
             max-width="max-w-2xl"
             @close="emit('close')">
```

por

```html
             max-width="max-w-2xl"
             :paso="paso"
             @close="emit('close')">
```

- [ ] **Step 6:** los mismos specs → PASS (14). Suite completa `npx vitest run` → 27 archivos y 158 pruebas en verde. `npm run build` sin errores, y `grep -ohE "\.sv-modal\{[^}]*\}" dist/assets/*.css` debe mostrar las dos líneas de `max-height` (`100vh` y `100dvh`).
- [ ] **Step 7: Commit** `feat(ventanas): se ajustan al alto de la pantalla y no se cierran con clic afuera`

---

### Task 2: Verificación y publicación (con el usuario)

- [ ] **Step 1:** con el código final, medir en un navegador sin ventana (375, 800, 1366 y 1920 de ancho) que el pie quede visible, que nada desborde a lo ancho, que el clic afuera y Escape no cierren, y que el buscador sí cierre afuera.
- [ ] **Step 2 (con confirmación):** merge a `main` por fast-forward, push, build, respaldo, `rsync --delete --exclude '.htaccess'` y paridad de `dist`.
- [ ] **Step 3 (usuario), smoke:** en un portátil y en un celular, Nuevo prospecto (los dos pasos), Registrar gestión con el selector abierto, y Administración → Usuarios (la lista del usuario de red debe verse completa). Clic afuera y Escape no cierran; la X y Cancelar sí; el buscador (Cmd+K) sí se cierra con Escape y con clic afuera.
- [ ] **Reversión:** restaurar el respaldo de GenFlow o revertir el commit. No hay base de datos ni backend.
