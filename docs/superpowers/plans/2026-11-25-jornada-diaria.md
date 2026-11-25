# Jornada diaria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El popup de jornada sale una vez al día y la ubicación sigue sola durante la jornada.

**Architecture:** El backend es la fuente: `GET /tracking/jornadas/hoy` dice si hay jornada activa y GenFlow sigue con esa. `useJornadaObligatoriaStore.chequear` es el único punto que arranca o detiene la captura; `useTrackingStore` captura y envía.

**Tech Stack:** Express/Sequelize/Jest; Vue 3/Pinia/Vitest.

## Global Constraints

- Reglas 1 a 9 de `docs/superpowers/specs/2026-11-25-jornada-diaria-design.md`.
- No cambian el horario (8-12 y 14-18), los filtros (100 m, 20 m), los roles no operativos ni la captura en primer plano.
- Errores del backend: `{ success: false, error: CODIGO, message }`.
- Sin base de datos, `sequelize.sync`, `server.js` ni push. Comentarios en español y pocos. Cada commit lleva el trailer del modelo que lo escribe.
- BACK: `.wt/mantix-backend-ventas` (base e7989ac). FRONT: `.wt/crm-frontend-ventas` (base 9b67e11 más docs). Rama `feat/jornada-diaria` en ambos.

---

### Task 1: Backend

Directorio: **BACK**.

**Files:**
- Modify: `src/sv/services/tracking.service.js`, `src/sv/services/jornadaObligatoria.service.js`, `src/sv/controllers/tracking.controller.js`, `src/sv/validations/tracking.validation.js`
- Test: `tests/trackingJornada.service.test.js` (nuevo), `tests/trackingJornada.routes.test.js` (nuevo), `tests/jornadaObligatoria.service.test.js`

**Interfaces:**
- Produces: `POST /tracking/jornadas` → jornada activa de HOY (idempotente) o 409 `AUSENTE`; `GET /tracking/jornadas/hoy` sin cambio de forma (`estado`, `jornada`, `ausencia`, `requiere_popup`); `POST /tracking/jornadas/:id/puntos` y `PATCH …/finalizar` → 403 `FORBIDDEN` si la jornada es de otro; `source` acepta `post_resume`.

- [ ] **Step 1: Pruebas en rojo**
  - `iniciarJornada`: sin nada → crea con `jor_fecha` de hoy en Colombia; con activa de hoy → la devuelve sin crear ni cerrar; con activa de ayer → la cierra (`auto_cerrada`, fin 6 p. m. de ayer) y crea la de hoy; con activa de ayer y de hoy → cierra la de ayer y devuelve la de hoy; con ausencia hoy → `AUSENTE`, sin crear ni cerrar. `jor_fecha` llega como `Date` a las 05:00Z (typeCast) y como texto: ambas. Con el reloj a las 8:30 p. m. de Colombia, "hoy" es el día de Colombia.
  - `finalizarJornada` con `marcarAuto`: inició 8 a. m. → fin 6 p. m. y duración 600; inició 8 p. m. → fin 8 p. m. y duración 0; a las 3 p. m. de hoy → fin 3 p. m. (nunca en el futuro). Sin `marcarAuto`: fin = ahora, como hoy.
  - `registrarAusencia`: con jornada activa hoy → la cierra como `finalizada`; sin jornada → no toca nada; si la ausencia falla por duplicada, no cierra nada.
  - `estadoHoy`: con varias jornadas hoy manda la más reciente (comprobar `order`).
  - Rutas (con `svAreaGuard` y `validate` reales; servicio real y modelos simulados): iniciar con ausencia → 409 `AUSENTE`; puntos a una jornada ajena → 403 sin guardar; finalizar una ajena → 403 **sin cerrarla** (un rol de nivel 1 o 2 sí puede, como hoy); `source: 'post_resume'` → aceptado; un `source` raro → 422.
- [ ] **Step 2:** ver el rojo.
- [ ] **Step 3: Implementar.** En `tracking.service.js` (importar `SvJornadaAusencia`):

```js
// Cierre automático: las 6 p. m. del día de la jornada, o su inicio si empezó después. Nunca en el futuro.
function finAutomatico(j) {
  const inicio = new Date(j.jor_inicio_at).getTime();
  const seis = new Date(`${aISO(j.jor_fecha)}T18:00:00-05:00`).getTime();
  return new Date(Math.min(Date.now(), Math.max(inicio, seis)));
}
```
`iniciarJornada`:

```js
  const hoy = hoyBogotaISO();
  if (await SvJornadaAusencia.findOne({ where: { aus_usr_id: usrId, aus_fecha: hoy } })) {
    throw new TrackingError('AUSENTE', 'Hoy marcaste que no laboras');
  }

  // Una por día: la de hoy se devuelve (idempotente) y las que quedaron abiertas de otros días se cierran.
  const abiertas = await SvJornada.findAll({ where: { jor_usr_id: usrId, jor_estado: 'activa' } });
  let deHoy = null;
  for (const j of abiertas) {
    if (aISO(j.jor_fecha) === hoy) deHoy = j;
    else await finalizarJornada(j.jor_id, { marcarAuto: true });
  }
  if (deHoy) return deHoy;
```
`finalizarJornada`: `const fin = marcarAuto ? finAutomatico(j) : new Date();`, usado en `jor_fin_at` y en la duración. `batchPuntos(jornadaId, puntos = [], usrId = null)`: después de leer la jornada, si `usrId != null && Number(j.jor_usr_id) !== Number(usrId)` → `TrackingError('FORBIDDEN', 'Esta jornada es de otra persona')`. Nuevo `obtenerJornada(jornadaId)` (`SvJornada.findByPk`) para que el controlador compruebe el dueño antes de cerrar.
Controlador: `AUSENTE` → 409 `AUSENTE`; `FORBIDDEN` → 403; `batchPuntos` pasa `req.user.usr_id`; `finalizarJornada` comprueba dueño (o `rol_nivel <= 2`, la misma regla de hoy) **antes** de cerrar, con 404 si no existe.
Validación: `source: Joi.string().valid('foreground', 'service_worker', 'manual', 'post_resume')` (verificar en el modelo que `tp_fuente` lo admite).
`jornadaObligatoria.service`: en `estadoHoy`, `order: [['jor_inicio_at', 'DESC']]`; en `registrarAusencia`, después de crear, cerrar con `finalizarJornada` las jornadas activas de hoy de ese usuario (cuidar que no quede un ciclo de `require`).
- [ ] **Step 4:** verde, mutación por cada regla y suite completa (fallan solo `test/grupoIndivII`, `tests/invitacion.service`, `src/masajes/__tests__/adapters`, `adapters.n8n`, `tests/afiliadoEmpresaAccess`; `tests/identidadLogin.routes` ha fallado alguna vez por tiempo en la corrida completa).
- [ ] **Step 5: Commit** `fix(jornada): una por día, y solo del dueño`.

### Task 2: GenFlow

Directorio: **FRONT**.

**Files:**
- Modify: `src/stores/useTrackingStore.js`, `src/stores/useJornadaObligatoriaStore.js`, `src/stores/useAuthStore.js` (logout), `src/components/tracking/JornadaWidget.vue`, `src/components/tracking/ModalInicioJornadaObligatorio.vue`
- Test: `src/stores/__tests__/useTrackingStore.spec.js` (nuevo), `src/stores/__tests__/useJornadaObligatoriaStore.spec.js`, `src/stores/__tests__/useAuthStore.logout.spec.js` (nuevo), `src/components/tracking/__tests__/ModalInicioJornadaObligatorio.spec.js`, `src/components/tracking/__tests__/JornadaWidget.spec.js` (nuevo)

**Interfaces:**
- Consumes: Task 1 (con el backend anterior no debe romperse: se comporta como hoy).
- Produces en `useTrackingStore`: `iniciar()`, `reanudar(jornada)`, `reanudarLocal(): boolean`, `pausar(): Promise`, `detener()`, `flush()`, y lo de hoy que se siga usando. Desaparecen `restaurar()`, `finalizar()` y `reset()` (buscar usos).

- [ ] **Step 1: Pruebas en rojo** (API y `navigator.geolocation` simulados; hora fija)
  - `iniciar()` SIEMPRE llama al backend, aunque el navegador tenga una jornada vieja, de otro día o de otro usuario; deja la copia local con `usr_id` y `fecha`.
  - `reanudar(jornada)`: arranca la captura con ese id; llamarla dos veces con la misma no duplica `watchPosition` ni temporizadores; con otra jornada descarta los puntos guardados de la anterior; con la misma los conserva.
  - `reanudarLocal()`: copia de este usuario y de hoy → `true` y arranca; de ayer, de otro usuario, sin `usr_id` (formato anterior) o ilegible → `false`, la borra y no arranca.
  - `pausar()`: envía lo pendiente, detiene la captura y limpia la copia; **no** llama a `finalizarJornada`.
  - `flush()`: `JORNADA_CERRADA` o 403 → detiene y limpia; 422 → descarta ese lote y conserva los siguientes; sin red → conserva todo.
  - `chequear()`: `activa` → `ok` y `reanudar(data.jornada)`; `ausente` → `detener()`; `sin_iniciar` con popup → `bloqueado` y `detener()`; `finalizada` o rol no operativo → `ok` y `detener()`; error de red con copia válida de hoy → `ok`; sin copia → `bloqueado` (como hoy).
  - `marcarAusencia` detiene la captura.
  - `logout` llama a `pausar()` y no a `finalizarJornada`, y cierra la sesión aunque `pausar()` falle.
  - `JornadaWidget` ya no arranca ni restaura nada al montarse.
  - Modal: al fallar muestra `response.data.message`; con 409 `AUSENTE` vuelve a preguntar (`chequear({ force: true })`).
- [ ] **Step 2:** ver el rojo.
- [ ] **Step 3: Implementar.**
  - `useTrackingStore`: copia local `LS_KEY = { usr_id, fecha, jor_id, jor_inicio_at }` y `LS_BUF = { jor_id, puntos }` (un valor con el formato anterior se trata como inexistente). `usr_id` sale de `useAuthStore().usuario?.usr_id` (import estático: `useAuthStore` importa este store de forma dinámica) y `fecha` de `diaLocal()` de `@/utils/format`. Un `activar(jornada, pos)` interno común a `iniciar` y `reanudar`: fija `jornadaActiva`, carga el buffer solo si es de ese `jor_id`, persiste, `iniciarWatch()`, `registrarListeners()` y el wake lock si la persona lo tenía activo. `detener()`: `detenerWatch`, `soltarListeners`, `releaseWakeLock`, limpia memoria y ambas claves. `pausar()`: `await flush()` con su error ignorado y `detener()`.
  - `useJornadaObligatoriaStore.chequear`: según las pruebas; importa `useTrackingStore`.
  - `useAuthStore.logout`: `await tracking.pausar()` dentro del `try` que ya existe.
  - `JornadaWidget`: quitar `restaurar`, `autoIniciar` y su `watch`; conservar lo demás.
  - `ModalInicioJornadaObligatorio`: `e?.response?.data?.message || …` en los dos `catch`; en 409 `AUSENTE`, `jornObl.chequear({ force: true })`.
  - Las claves de `localStorage` siguen dentro de `try/catch`.
- [ ] **Step 4:** verde, mutación por cada regla, suite completa (hoy 363) y `npx vite build --outDir <temporal> --emptyOutDir`.
- [ ] **Step 5: Commits** `fix(tracking): la captura sigue la jornada de hoy` y `fix(jornada): el popup sale una vez al día`.

### Task 3: Publicación (con el usuario)

- [ ] Backend a `main` (con permiso), `deploy-mantix`, y después GenFlow (con permiso) con `publicar-genflow.sh`.
- [ ] Prueba: entrar sin jornada → popup; iniciar; recargar → no sale; cerrar sesión y volver → no sale y la ubicación sigue; otro usuario en el mismo navegador → su propio popup; "No laboro hoy" → no sale y no hay ubicación.
