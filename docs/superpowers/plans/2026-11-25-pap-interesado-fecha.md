# PAP: "Interesado" pide fecha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un resultado de PAP marcado "requiere fecha" en Administración pide la próxima visita en las dos ventanas y se guarda.

**Architecture:** La regla vive en un punto por lado: `pap.service` (con el `resultado` que ya consulta) y `src/utils/pap.js` (con el catálogo ya cargado). Las pantallas dejan de comparar con `'VOLVER'`.

**Tech Stack:** Express/Sequelize/Jest; Vue 3/Pinia/Vitest.

## Global Constraints

- Regla: pide fecha si `resultado_codigo === 'VOLVER'` o si el resultado del grupo PAP (3) tiene `resultado_requiere_fecha`.
- Los resultados que no la piden guardan fecha y hora nulas.
- Sin base de datos, `sequelize.sync`, `server.js` ni push. Comentarios en español y pocos. Cada commit lleva el trailer del modelo que lo escribe.
- BACK: `.wt/mantix-backend-ventas` (base 10fface). FRONT: `.wt/crm-frontend-ventas` (base 1098539). Rama `feat/pap-interesado-fecha` en ambos.

---

### Task 1: Backend guarda la fecha según el catálogo

Directorio: **BACK**.

**Files:**
- Modify: `src/sv/services/pap.service.js` (~86-88 y ~121-122)
- Test: `tests/papVolver.test.js`

- [ ] **Step 1: Pruebas en rojo.** En `tests/papVolver.test.js`: cliente nuevo con `INTERESADO` y `resultado_requiere_fecha: 1` guarda fecha y hora en el prospecto y en la gestión (`gest_prox_fecha`, `gest_prox_hora`); cliente existente, igual en `update`; `INTERESADO` con `resultado_requiere_fecha: 0` guarda nulas; `VOLVER` con `resultado_requiere_fecha: 0` (o sin el campo) guarda la fecha; `NO_INTERESADO` con 0 guarda nulas aunque llegue `prox_fecha`. Ajustar la prueba existente "otro resultado guarda null" solo si hace falta para que siga significando lo mismo.
- [ ] **Step 2:** `npx jest tests/papVolver.test.js` → fallan las nuevas de INTERESADO.
- [ ] **Step 3: Implementar.** Reemplazar las comparaciones con `'VOLVER'` por una sola constante, y reutilizar `proxima` en la gestión:

```js
    // Piden próxima visita "Volver" y los que Administración marca con "requiere fecha".
    const pideFecha = resultadoCodigo === 'VOLVER' || !!resultado.resultado_requiere_fecha;
    const proxima = {
      prosp_prox_gestion_fecha: pideFecha ? payload.prox_fecha || null : null,
      prosp_prox_gestion_hora:  pideFecha ? payload.prox_hora  || null : null
    };
```
y en la gestión `gest_prox_fecha: proxima.prosp_prox_gestion_fecha`, `gest_prox_hora: proxima.prosp_prox_gestion_hora`.
- [ ] **Step 4:** verde, mutación (quitar cada mitad de `pideFecha`) y suite completa: solo fallan `test/grupoIndivII`, `tests/invitacion.service`, `src/masajes/__tests__/adapters`, `adapters.n8n`, `tests/afiliadoEmpresaAccess`.
- [ ] **Step 5: Commit** `feat(pap): la próxima visita se guarda según el catálogo`.

### Task 2: GenFlow pide la fecha según el catálogo

Directorio: **FRONT**.

**Files:**
- Create: `src/utils/pap.js`, `src/utils/__tests__/pap.spec.js`
- Modify: `src/components/crm/NuevaGestionPapModal.vue`, `src/components/crm/RegistroRapidoModal.vue`, `src/views/pap/MisVisitas.vue`
- Test: `src/components/crm/__tests__/NuevaGestionPapModal.spec.js`, `src/components/crm/__tests__/RegistroRapidoModal.spec.js`, `src/views/pap/__tests__/MisVisitas.spec.js` (nuevo)

**Interfaces:**
- Produces: `pideFechaPap(resultados: Array, codigo: string): boolean`

- [ ] **Step 1: Pruebas en rojo.** `pideFechaPap`: VOLVER → true aunque el catálogo diga 0 o esté vacío; INTERESADO con `resultado_requiere_fecha: 1` (número o `true`) → true; con 0 → false; un resultado con el mismo código de otro grupo o inactivo no cuenta; `null` → false.
  - NuevaGestionPapModal: con INTERESADO marcado aparece el campo de fecha; sin fecha avisa y no registra; con fecha manda `gest_prox_fecha` y `quitar_prox: false`. Con INTERESADO no marcado, como hoy (`quitar_prox: true`, fecha nula). Los casos actuales de VOLVER siguen. El fixture actual no trae `resultado_requiere_fecha`: no lo cambies en las pruebas existentes, agrega el caso nuevo.
  - RegistroRapidoModal: con INTERESADO marcado aparece el campo, sugiere mañana y 09:00, y manda ambas; si se borra la fecha, avisa y no registra; con NO_INTERESADO manda nulas aunque antes se haya elegido fecha. "Sin respuesta" sin marcar registra de una vez; marcado, no registra hasta tener fecha.
  - MisVisitas: estado `VOLVER` → "🔁 Volver"; estado `INTERESADO` → "📅 Seguimiento".
- [ ] **Step 2:** correr y ver el rojo.
- [ ] **Step 3: Implementar.** `src/utils/pap.js`:

```js
const GRUPO_PAP = 3;

/** ¿El resultado pide próxima visita? "Volver" siempre; los demás, según Administración. */
export function pideFechaPap(resultados, codigo) {
  if (codigo === 'VOLVER') return true;
  return !!(resultados || []).find((r) =>
    r.resultado_grupo_id === GRUPO_PAP && r.resultado_codigo === codigo && r.resultado_activo)?.resultado_requiere_fecha;
}
```
  - `NuevaGestionPapModal`: `requiereFecha = computed(() => pideFechaPap(config.actual?.resultados, resultadoSel.value))`. El título del campo: "¿Cuándo volver?" con VOLVER y "¿Cuándo es el seguimiento?" en los demás. El aviso: "Indica la fecha de la próxima visita".
  - `RegistroRapidoModal`: `pideFecha = computed(() => pideFechaPap(config.actual?.resultados, form.value.resultado_codigo))` en lugar de las cinco comparaciones con `'VOLVER'` (validaciones, sugerencia, payload y bloque del formulario), con los mismos textos según el resultado. `sinRespuesta()`: después de fijar el código, si `pideFecha.value` y no hay fecha, avisa y no registra. Los comentarios que dicen "solo VOLVER" se actualizan.
  - `MisVisitas.vue:165`: `{{ p.estado?.estado_codigo === 'VOLVER' ? '🔁 Volver' : '📅 Seguimiento' }}: …`.
- [ ] **Step 4:** verde, mutación por cada cambio, suite completa (hoy 342) y `npx vite build --outDir <temporal> --emptyOutDir`.
- [ ] **Step 5: Commit** `feat(pap): Interesado pide la fecha de seguimiento`.
