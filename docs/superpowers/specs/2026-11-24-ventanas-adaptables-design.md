# Ventanas que se ajustan a la pantalla — diseño

**Fecha:** 2026-11-24 · **Repositorio:** `crm-frontend` (GenFlow) · **Estado:** opción A y alcance aprobados por el usuario

## 1. Objetivo

Pedido del usuario tras probar Productos 2026: la ventana "se pierde a lo vertical porque es muy largo", y no debe desaparecer con Escape ni con un clic por fuera, porque se puede perder lo que se está escribiendo.

## 2. Causa

`src/components/ui/BaseModal.vue`, que usan 22 archivos, no limita su alto ni se desplaza: centra la tarjeta en la pantalla y lo que sobra queda fuera, sin forma de llegar a los botones. Además se cierra con cualquier clic en el fondo; eso incluye seleccionar texto arrastrando y soltar fuera de la tarjeta. Escape no cierra ninguna de estas ventanas: en la aplicación solo cierra el buscador global (`App.vue`).

## 3. Decisiones del usuario

| Tema | Decisión |
|---|---|
| Alcance | Todas las ventanas que usan `BaseModal` (22). No las del módulo de afiliación, que tienen las suyas |
| Alto | A: título y botones siempre visibles; solo se desplaza el contenido |
| Cierre | Solo con la X, con los botones de cada ventana o al guardar. La X y Cancelar cierran sin preguntar |
| Excepción | El buscador global sigue cerrándose con Escape y con clic afuera: ahí no se escribe información |

## 4. Comportamiento

- La tarjeta mide como máximo el alto visible menos 1,5rem. Se usa `100dvh`, que en el celular descuenta la barra del navegador, con `100vh` para los navegadores que no lo conocen (clase `.sv-modal`).
- El título y el pie no se encogen. El contenido se desplaza y no arrastra la página de atrás. El pie parte sus botones en dos líneas si no caben.
- `cierraAfuera` (por defecto `false`): solo el buscador global lo activa.
- `paso`: Nuevo prospecto y Nueva empresa le pasan su paso; al cambiar, el contenido vuelve arriba. Otros cambios, como el título, no mueven el contenido.
- La X es `type="button"`.
- Rodar sobre un campo numérico enfocado le quita el foco antes: el navegador cambiaría su valor (80000 → 79997) en vez de desplazar la ventana.
- La lista de "Grupo empresarial" se lleva a la vista al abrirse y se cierra al salir del campo (antes lanzaba un error).
- El buscador global limita su lista para no mostrar dos barras en pantallas bajas.

## 5. Casos de borde

| Caso | Qué pasa |
|---|---|
| Ventana más corta que la pantalla | Igual que hoy: centrada y sin desplazamiento |
| Seleccionar texto y soltar afuera | No cierra |
| Listas flotantes | La de grupo empresarial se lleva a la vista al abrirse. La del usuario de red es el primer campo de su ventana y se ve completa, salvo en pantallas de unos 400 px de alto, donde se llega desplazando |
| Selector de productos, que ya tiene su propio desplazamiento | Se conserva; quedan dos barras cuando el formulario es más alto que la pantalla |
| Ventanas con su propio contenedor (agenda, eventos, OTP, jornada, afiliación) | No cambian |

## 6. Pruebas

`BaseModal.spec.js`: clic afuera con y sin permiso, clic adentro, Escape, X, clases de alto, paso y título. Con Teleport y Transition reales: con los stubs los nodos se vuelven a crear en cada cambio y las pruebas de desplazamiento pasarían sin probar nada. `ventanas.spec.js`: el buscador cierra afuera; Nuevo prospecto, Nueva empresa y Registrar gestión no; las dos por pasos informan su paso.

`SelectorGrupoEmpresarial.spec.js`: la lista se lleva a la vista, se cierra al salir y elegir emite el grupo. Las pruebas de cierre, alto, paso y rueda se comprobaron rompiendo el código a propósito (2026-11-24); las clases CSS que happy-dom no puede medir se revisaron en el navegador. En un navegador, con el catálogo real, el pie queda visible y nada desborda a lo ancho en 500×580, 800×393, 1366×553 y 1920×993, y en celular (375×667).

## 7. Fuera de alcance

- Preguntar antes de descartar al usar la X o Cancelar.
- Rediseñar formularios en dos columnas o quitar el desplazamiento interno del selector.
- Ventanas que no usan `BaseModal`.
