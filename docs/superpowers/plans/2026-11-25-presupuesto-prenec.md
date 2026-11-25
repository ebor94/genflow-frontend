# Presupuesto contra realizado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cargar el presupuesto mensual por asesor y categoría con un Excel, y verlo contra lo realizado en ventas.

**Architecture:** Tabla propia `sv_org_presupuestos`; lo realizado se calcula al momento desde `sv_crm_ventas`. El Excel se revisa en el servidor sin guardar y se guarda en otra petición con los valores ya revisados. GenFlow: una vista nueva, una ventana para subir y una tarjeta en Mis métricas.

**Tech Stack:** Express 4, Sequelize 6, MySQL 8, exceljs, multer, Joi, Jest; Vue 3, Pinia, Tailwind, Vitest.

## Global Constraints

- Reglas 1 a 8 de `docs/superpowers/specs/2026-11-25-presupuesto-prenec-design.md`. Valores enteros de 0 a 999.999.999.999.
- Errores: `{ success: false, error, message }`; en los servicios, errores con `code` (`VALIDATION_ERROR` 422, `FORBIDDEN` 403, `NOT_FOUND` 404), que `svErrorHandler` responde.
- Las columnas DATEONLY llegan como `Date` a las 05:00Z (typeCast propio): para días usar `aISO`.
- Pruebas solo con `jest.mock`, sin base de datos; nunca `sequelize.sync`, `server.js` ni push. Comentarios en español y pocos. Cada commit lleva el trailer del modelo que lo escribe.
- BACK: `.wt/mantix-backend-ventas`; FRONT: `.wt/crm-frontend-ventas`; rama `feat/presupuesto-prenec` en ambos, desde `origin/main`.

---

### Task 1: Migración, modelo y consulta

Directorio: **BACK**.

**Files:**
- Create: `src/sv/migrations/028_presupuestos.sql`, `src/sv/models/Presupuesto.js`, `src/sv/services/presupuestos.service.js`, `src/sv/controllers/presupuestos.controller.js`, `src/sv/routes/presupuestos.routes.js`, `src/sv/validations/presupuestos.validation.js`
- Modify: `src/sv/models/index.js` (`SvPresupuesto`), `src/sv/routes/index.js` (`/presupuestos`, antes de `capturarAsync`)
- Test: `tests/presupuestos.models.test.js`, `tests/presupuestos.service.test.js`, `tests/presupuestos.routes.test.js`

**Interfaces:**
- Produces: `consultar({ user, areaId, anio, mes })` con la forma de la especificación; `alcance(user, areaId)` (filtro `where` de usuarios, o `null` sin acceso); `puedeCargar(user, areaId)`; `categoriasDe(areaId)` → `string[]`; `asesoresCargables(user, areaId)` → usuarios activos con rol ASESOR del área dentro del alcance; `valoresDelMes(areaId, anio, mes, ids?)` → `Map('usr_id|categoria' → número)`.

- [ ] **Step 1: Migración y modelo.**

```sql
-- =====================================================================
-- SerVentas CRM — Migración 028: presupuesto mensual por asesor y categoría
-- Solo crea la tabla. Idempotente. Debe correr ANTES de desplegar el backend que la usa.
-- =====================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS sv_org_presupuestos (
  pre_id         INT           AUTO_INCREMENT PRIMARY KEY,
  pre_usr_id     INT           NOT NULL,
  pre_area_id    INT           NOT NULL,
  pre_anio       SMALLINT      NOT NULL,
  pre_mes        TINYINT       NOT NULL,
  pre_categoria  VARCHAR(50)   NOT NULL,
  pre_valor      DECIMAL(14,2) NOT NULL DEFAULT 0,
  pre_created_by INT           NOT NULL,
  pre_updated_by INT           NOT NULL,
  pre_created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pre_updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_presupuesto (pre_usr_id, pre_area_id, pre_anio, pre_mes, pre_categoria),
  INDEX idx_pre_area_periodo (pre_area_id, pre_anio, pre_mes),
  CONSTRAINT fk_pre_usr     FOREIGN KEY (pre_usr_id)     REFERENCES sv_org_usuarios(usr_id),
  CONSTRAINT fk_pre_area    FOREIGN KEY (pre_area_id)    REFERENCES sv_cfg_areas_negocio(area_id),
  CONSTRAINT fk_pre_creador FOREIGN KEY (pre_created_by) REFERENCES sv_org_usuarios(usr_id),
  CONSTRAINT fk_pre_editor  FOREIGN KEY (pre_updated_by) REFERENCES sv_org_usuarios(usr_id),
  CONSTRAINT chk_pre_mes    CHECK (pre_mes BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'SerVentas: presupuesto mensual por asesor y categoría de producto';
```
El modelo refleja la tabla (`unique: 'uq_presupuesto'` en las cinco columnas, `createdAt: 'pre_created_at'`, `updatedAt: 'pre_updated_at'`); la prueba del modelo comprueba nombres, tipos y la única, como `tests/ventas.models.test.js`.

- [ ] **Step 2: Pruebas en rojo de la consulta.**
  - Alcance (tabla por rol, con `areasExtra`/`gruposExtra` y ids como texto): ASESOR solo él; SUPERVISOR y COORDINADOR sus grupos (varios incluidos); JEFE_PAP grupo 3; ADMIN_AREA, DIRECTOR y GERENTE, sus áreas (otra área → `null`); SUPER_ADMIN todo; AGENTE_SVC y rol desconocido, solo ellos; sin grupos o sin áreas → `null`.
  - `consultar`: área sin catálogo por tipos → `VALIDATION_ERROR`; sin alcance → `FORBIDDEN`; compone asesores × categorías con presupuesto y realizado (0 si falta), totales por asesor y general; usuario inactivo con datos ese mes sale (`activo: false`) y sin datos no; categoría con datos que ya no está en el catálogo sale al final; meses de 28, 30 y 31 días (`BETWEEN` correcto); `actualizado` con nombre y fecha del último cambio, `null` si no hay.
  - Rutas reales con `svAreaGuard` y `validate`: 422 con mes 0/13, año fuera de 2025-2099, `area_id` no entero; `puede_cargar` verdadero solo para SUPERVISOR, ADMIN_AREA y SUPER_ADMIN con alcance.
- [ ] **Step 3: Implementar.** `categoriasDe`: `prod_categoria` distintas de productos activos del área con `prod_tipo <> ''`, ordenadas por `MIN(prod_orden_display)`. Realizado:

```sql
SELECT v.venta_asesor_id AS usr_id, p.prod_categoria AS categoria, SUM(i.vi_cantidad * i.vi_precio_unitario) AS valor
  FROM sv_crm_ventas v
  JOIN sv_crm_ventas_items i ON i.vi_venta_id = v.venta_id
  JOIN sv_cfg_productos p    ON p.prod_id = i.vi_prod_id
 WHERE v.venta_anulada = 0 AND v.venta_area_id = :areaId AND v.venta_fecha BETWEEN :desde AND :hasta
 GROUP BY v.venta_asesor_id, p.prod_categoria
```
Usuarios: `{ ...alcance, [Op.or]: [{ usr_area_id: areaId, usr_activo: 1, '$rol.rol_codigo$': 'ASESOR' }, { usr_id: { [Op.in]: idsConDatos } }] }` con `rol` y `grupo`. Los datos de quien queda fuera del alcance no se devuelven ni suman. Todo número sale como `Number`.
- [ ] **Step 4:** verde, mutación por cada regla, suite completa (fallan solo `test/grupoIndivII`, `tests/invitacion.service`, `src/masajes/__tests__/adapters`, `adapters.n8n`, `tests/afiliadoEmpresaAccess`).
- [ ] **Step 5: Commit** `feat(presupuesto): tabla, modelo y consulta del mes`.

### Task 2: Plantilla, revisión y guardado

Directorio: **BACK** (encima del Task 1).

**Files:**
- Create: `src/sv/services/presupuestosExcel.service.js` (leer y escribir el libro; sin base de datos)
- Modify: `src/sv/services/presupuestos.service.js` (`plantilla`, `revisar`, `guardar`), controlador, rutas y validaciones
- Test: `tests/presupuestosExcel.service.test.js`, `tests/presupuestos.carga.test.js`

**Interfaces:**
- Consumes: Task 1.
- Produces: `escribir({ titulo, areaId, anio, mes, categorias, filas }) → Promise<Buffer>`; `leer(buffer, { areaId, anio, mes, categorias, asesores }) → Promise<{ filas: [{ usr_id, nombre, valores }], errores: [{ fila, columna, mensaje }] }>`.

Formato del libro: hoja `Presupuesto` — fila 1 título, fila 2 "Cambia solo los valores. No agregues filas ni columnas.", fila 3 encabezados `ID | Usuario de red | Asesor | <categorías> | Total`, datos desde la 4; valores con formato `#,##0`, `Total` con `SUM`; encabezados en negrita y panel congelado en C3. Hoja `_datos` `veryHidden`: `A1='presupuesto-genflow'`, `A2=area_id`, `A3=anio`, `A4=mes`. Nombre del archivo: `presupuesto-prenecesidad-AAAA-MM.xlsx` (área en minúscula sin tildes).

- [ ] **Step 1: Pruebas en rojo.**
  - `escribir` → `leer` del mismo libro devuelve los mismos valores sin errores; un libro modificado con exceljs: valor con fórmula (toma `result`), número como texto `'14.000.000'` o `'14,000,000'`, celda vacía (0), decimal, negativo, texto, mayor al máximo → los inválidos dan error con fila y columna (letra y nombre de la categoría) y el resto se lee.
  - Errores de libro: sin `_datos`, otro mes, otra área, sin hoja `Presupuesto`, encabezado de categoría desconocido o faltante, ID vacío en fila con asesor, ID repetido, asesor fuera del alcance o inactivo, más de 300 filas, archivo que no es xlsx, zip sospechoso (simular `inspeccionarZip`). Filas totalmente vacías al final se ignoran.
  - `plantilla`: valores del mes si los hay; si no, los del mes anterior (enero → diciembre del año anterior); si tampoco, 0. Ordenada por grupo y nombre. Solo `asesoresCargables`.
  - `revisar`: no escribe; `cambios` solo los que difieren de lo guardado (`antes` = guardado o 0).
  - `guardar`: valida otra vez alcance, categorías y valores (nunca confía en `revisar`); upsert en una transacción (`bulkCreate` con `updateOnDuplicate: ['pre_valor', 'pre_updated_by', 'pre_updated_at']`), `pre_created_by`/`pre_updated_by` = quien guarda; un error deshace todo; asesores que no vienen no se tocan; lista vacía → `VALIDATION_ERROR`.
  - Rutas: SUPERVISOR y ADMIN_AREA sí; ASESOR, COORDINADOR, DIRECTOR y GERENTE → 403 en plantilla, revisar y guardar; sin archivo → 422; archivo de más de 2 MB → error de multer (413 o 422 según el manejador global, comprobar); cabeceras del xlsx.
- [ ] **Step 2: Implementar.** `inspeccionarZip` de `src/masajes/utils/zipSeguro`: sus errores se convierten en `VALIDATION_ERROR` 'El archivo no es un Excel válido'. `multer.memoryStorage()`, `fileSize: 2 * 1024 * 1024`, filtro por `.xlsx`. Usuario de red: `usuariosAd.adUsuariosPorIdentidad`. Los mensajes no repiten el valor de la celda.
- [ ] **Step 3:** verde, mutación, suite completa.
- [ ] **Step 4: Commit** `feat(presupuesto): plantilla de Excel, revisión y guardado`.

### Task 3: GenFlow

Directorio: **FRONT**.

**Files:**
- Create: `src/api/presupuestosApi.js`, `src/utils/presupuesto.js`, `src/components/prenec/ChipCumplimiento.vue`, `src/components/prenec/BarrasPresupuesto.vue`, `src/components/prenec/TablaPresupuesto.vue`, `src/components/prenec/SubirPresupuestoModal.vue`, `src/views/prenecesidad/Presupuesto.vue`
- Modify: `src/router/index.js` (`/prenec/presupuesto`, name `prenec-presupuesto`, `areaCodigo: 'PRENEC'`), `src/components/layout/AppSidebar.vue` (ítem "Presupuesto" 🎯 después de Mis métricas), `src/views/prenecesidad/MisMetricas.vue` (tarjeta)
- Test: specs de utilidades, componentes, vista y tarjeta

**Interfaces:**
- Consumes: la API de la especificación (respuestas `{ success, data }`).
- Produces: `cumplimiento(realizado, presupuesto)` → entero o `null` si el presupuesto es 0; `estadoCumplimiento(pct)` → `'ok' | 'alerta' | 'mal' | 'sin'`; `mesesOpciones(n)`; `mesLabel(anio, mes)`.

- [ ] **Step 1: Pruebas en rojo.** Utilidades: bordes 79/80/99/100 (el redondeo no cambia de color: 99,6 % redondea a 100 pero es amarillo → el color sale del valor sin redondear y el texto muestra 99 %), presupuesto 0, ejecutado sin presupuesto. Componentes: chip con número, ícono y texto accesible; barra llena al 100 % y más (no se desborda) con título "`$X de $Y`"; tabla por categoría con total y "—" sin presupuesto. Vista: pide con `area_id` del área activa y el mes elegido; supervisor con barras, pestañas por grupo si hay más de uno (los totales son los de la pestaña) y tabla al tocar un asesor; asesor con un solo registro ve su tabla sin barras ni botones; cambiar de mes vuelve a pedir y una respuesta vieja no pisa la nueva; error → aviso. Ventana: sube con `FormData`, muestra errores por fila sin dejar guardar, muestra los cambios antes → después, "sin cambios" no deja guardar, confirma con las filas revisadas, al terminar recarga; cambiar de archivo limpia lo anterior. Tarjeta: mes actual, propio, "Sin presupuesto este mes" si no hay; si la consulta falla no rompe Mis métricas. Ruta y menú.
- [ ] **Step 2: Implementar** siguiendo los componentes vecinos (BaseModal, BaseSelect, BaseButton, KpiCard, `fmtCOP`, `useApiError`). Colores de estado: `sage`, `warning`, `danger`; texto siempre en tokens de texto. Plantilla: `responseType: 'blob'` y descarga con el nombre de `Content-Disposition` o `presupuesto-prenecesidad-AAAA-MM.xlsx`; si el blob es un JSON de error, mostrar su mensaje. Nada de `localStorage`.
- [ ] **Step 3:** verde, mutación, suite completa (hoy 488) y `npx vite build --outDir <temporal> --emptyOutDir`.
- [ ] **Step 4: Commits** `feat(presupuesto): vista del mes y tarjeta en Mis métricas` y `feat(presupuesto): subir el Excel del mes`.

### Task 4: Publicación (con el usuario)

- [ ] 028 en Workbench (antes: `SHOW TABLES LIKE 'sv_org_presupuestos'` vacío; después: 11 columnas, 4 llaves foráneas, única `uq_presupuesto`), probada antes en un contenedor; backend a `main` (con permiso) y `deploy-mantix`; GenFlow con `~/respaldos/herramientas/publicar-genflow.sh` (con permiso).
- [ ] Prueba: descargar la plantilla de un mes, llenarla, subirla, ver cambios y guardar; un error a propósito; ver el mes como supervisor y como asesor; registrar una venta y ver subir el realizado; anularla y verlo bajar.
