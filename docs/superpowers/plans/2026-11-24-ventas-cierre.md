# Ventas al cerrar el contrato — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al cerrar un contrato de Prenecesidad queda registrado qué se vendió, cuánto y a qué precio, y ese valor alimenta las métricas del asesor.

**Architecture:** Tres tablas nuevas (`sv_crm_ventas`, `_items`, `_cambios`). `ventas.service` valida y guarda dentro de la transacción de `gestiones.crear`; el supervisor corrige o anula por `/ventas/:id`; los reportes suman en vivo. En GenFlow, la lógica está en `utils/ventas` y la pantalla en `ProductosVendidos`, que usan el cierre y la corrección.

**Tech Stack:** Express 4, Sequelize 6.37, MySQL 8, Jest 29. Vue 3 (script setup), Pinia, Vitest, @vue/test-utils, @pinia/testing.

**Spec:** `crm-frontend/docs/superpowers/specs/2026-11-24-ventas-cierre-design.md`

## Global Constraints

- BACK = `/Users/bortega/Shared/Files From c.localized/apps/mantix/.wt/mantix-backend-ventas` (Tasks 1 a 4). FRONT = `/Users/bortega/Shared/Files From c.localized/apps/mantix/.wt/crm-frontend-ventas` (Tasks 5 a 8). Ambos en la rama `feat/ventas-cierre`. `node_modules` es un enlace; no `npm install`. No se toca ningún otro checkout.
- Backend: pruebas solo con `jest.mock`; nunca `sequelize.sync` ni conexión a la base, porque la única es la de producción compartida. Los contenedores MySQL desechables van con `--network none`.
- El total y el precio ofrecido los pone el servidor; nunca se toman del cliente.
- La venta y la gestión se guardan en la misma transacción.
- Solo áreas con catálogo por tipos registran ventas; las demás conservan su comportamiento.
- Textos exactos: "Productos vendidos", "Total de la venta", "+ Agregar otro producto…", "no se vendió", "Marca al menos un producto vendido", "Escribe el motivo", "Solo el supervisor puede corregir o anular una venta".
- Precios con `fmtCOP`; fechas con `fmtFecha`.
- Los archivos nuevos y los diffs se extraen del brief con un script, no se reescriben a mano.
- Cada subagente firma sus commits con su propio modelo (`Co-Authored-By: <modelo> <noreply@anthropic.com>`). Nadie hace push.
- Cinco suites del backend fallan desde antes: `test/grupoIndivII`, `tests/invitacion.service`, `src/masajes/__tests__/adapters`, `src/masajes/__tests__/adapters.n8n` y `tests/afiliadoEmpresaAccess`.

---

### Task 1: Migración 027, modelos y validación

Directorio: **BACK**.

**Files:** Create `src/sv/migrations/027_ventas.sql`, `src/sv/models/Venta.js`, `src/sv/models/VentaItem.js`, `src/sv/models/VentaCambio.js`, `src/sv/validations/ventas.validation.js`. Modify `src/sv/models/index.js`, `src/sv/validations/crm.validation.js`, `src/sv/validations/salas.validation.js`. Test `tests/ventas.models.test.js`.

**Interfaces:** Produces `SvVenta`, `SvVentaItem`, `SvVentaCambio`; schemas `venta`, `corregir` y `anular`; campo opcional `venta` en `gestiones.create` y en la visita en sala.

- [ ] **Step 1: Write the failing test**

`tests/ventas.models.test.js` (nuevo):

```js
const { DataTypes } = require('sequelize');
const v = require('../src/sv/validations/ventas.validation');
const crm = require('../src/sv/validations/crm.validation');
const salas = require('../src/sv/validations/salas.validation');

function definir(factory) {
  let r = null;
  factory({ define: (nombre, attrs, opts) => { r = { nombre, attrs, opts }; return {}; } }, DataTypes);
  return r;
}

describe('modelos de ventas', () => {
  test('SvVenta', () => {
    const { attrs, opts } = definir(require('../src/sv/models/Venta'));
    expect(opts.tableName).toBe('sv_crm_ventas');
    expect(opts.createdAt).toBe('venta_created_at');
    expect(opts.updatedAt).toBe('venta_updated_at');
    expect(attrs.venta_gest_id.type.key).toBe('BIGINT');
    expect(attrs.venta_fecha.type.key).toBe('DATEONLY');
    expect(attrs.venta_anulada.defaultValue).toBe(0);
    for (const k of ['venta_prosp_id', 'venta_gest_id', 'venta_asesor_id', 'venta_area_id', 'venta_fecha', 'venta_total', 'venta_created_by']) {
      expect(attrs[k].allowNull).toBe(false);
    }
  });

  test('SvVentaItem', () => {
    const { attrs, opts } = definir(require('../src/sv/models/VentaItem'));
    expect(opts.tableName).toBe('sv_crm_ventas_items');
    expect(opts.timestamps).toBe(false);
    expect(Object.keys(attrs)).toEqual(['vi_id', 'vi_venta_id', 'vi_prod_id', 'vi_cantidad', 'vi_precio_ofrecido', 'vi_precio_unitario']);
  });

  test('SvVentaCambio', () => {
    const { attrs, opts } = definir(require('../src/sv/models/VentaCambio'));
    expect(opts.tableName).toBe('sv_crm_ventas_cambios');
    expect(opts.updatedAt).toBe(false);
    expect(attrs.vc_motivo.allowNull).toBe(false);
    expect(attrs.vc_detalle.type.key).toBe('JSON');
  });
});

describe('validación de la venta', () => {
  const ITEM = { prod_id: 1, cantidad: 2, precio_unitario: 8770000 };
  const valor = (schema, body) => schema.validate(body, { abortEarly: false, stripUnknown: true });

  test('acepta productos con cantidad y precio, y descarta un total enviado', () => {
    const { error, value } = valor(v.venta, { items: [{ ...ITEM, total: 1, vi_precio_ofrecido: 1 }], total: 5 });
    expect(error).toBeUndefined();
    expect(value).toEqual({ items: [ITEM] });
  });

  test.each([
    ['sin productos', []],
    ['cantidad 0', [{ ...ITEM, cantidad: 0 }]],
    ['cantidad decimal', [{ ...ITEM, cantidad: 1.5 }]],
    ['precio 0', [{ ...ITEM, precio_unitario: 0 }]],
    ['precio con decimales', [{ ...ITEM, precio_unitario: 10.5 }]],
    ['producto repetido', [ITEM, ITEM]],
    ['sin producto', [{ cantidad: 1, precio_unitario: 1 }]]
  ])('rechaza %s', (_n, items) => {
    expect(valor(v.venta, { items }).error).toBeDefined();
  });

  test('corregir y anular exigen motivo y cuántos cambios se vieron', () => {
    expect(valor(v.corregir, { items: [ITEM], motivo: 'precio mal', cambios_vistos: 0 }).error).toBeUndefined();
    expect(valor(v.corregir, { items: [ITEM], motivo: '   ', cambios_vistos: 0 }).error).toBeDefined();
    expect(valor(v.corregir, { items: [ITEM], motivo: 'precio mal' }).error).toBeDefined();
    expect(valor(v.anular, { motivo: 'se cayó', cambios_vistos: 1 }).error).toBeUndefined();
    expect(valor(v.anular, { cambios_vistos: 1 }).error).toBeDefined();
  });

  test('la gestión y la visita en sala la aceptan, y es opcional', () => {
    const g = { gest_prosp_id: 5 };
    expect(valor(crm.gestiones.create, g).error).toBeUndefined();
    expect(valor(crm.gestiones.create, { ...g, venta: { items: [ITEM] } }).value.venta).toEqual({ items: [ITEM] });
    expect(valor(crm.gestiones.create, { ...g, venta: { items: [] } }).error).toBeDefined();
    expect(valor(salas.visita, { gest_resultado_id: 3, venta: { items: [ITEM] } }).value.venta).toEqual({ items: [ITEM] });
    expect(valor(salas.visita, { gest_resultado_id: 3 }).error).toBeUndefined();
  });
});
```

- [ ] **Step 2:** `npx jest tests/ventas.models.test.js` → FAIL (no existen los módulos).
- [ ] **Step 3: Implementar**

`src/sv/migrations/027_ventas.sql` (nuevo):

```sql
-- =====================================================================
-- SerVentas CRM — Migración 027: ventas al cerrar el contrato
--
-- 1) sv_crm_ventas: una fila por contrato cerrado, unida a la gestión que lo cerró.
--    Suma a venta_asesor_id, el dueño del cliente, en venta_fecha (día en Colombia).
-- 2) sv_crm_ventas_items: productos vendidos, con cantidad y precio por unidad.
-- 3) sv_crm_ventas_cambios: correcciones y anulaciones del supervisor. Nada se borra.
-- Solo crea tablas. Idempotente. Inofensiva para el código anterior.
-- Debe correr ANTES de desplegar el backend que la usa.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS sv_crm_ventas (
  venta_id         INT           AUTO_INCREMENT PRIMARY KEY,
  venta_prosp_id   INT           NOT NULL,
  venta_gest_id    BIGINT        NOT NULL,
  venta_asesor_id  INT           NOT NULL,
  venta_area_id    INT           NOT NULL,
  venta_fecha      DATE          NOT NULL,
  venta_total      DECIMAL(14,2) NOT NULL,
  venta_anulada    TINYINT(1)    NOT NULL DEFAULT 0,
  venta_created_by INT           NOT NULL,
  venta_created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  venta_updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_venta_gestion (venta_gest_id),
  INDEX idx_venta_prosp (venta_prosp_id),
  INDEX idx_venta_asesor_fecha (venta_asesor_id, venta_fecha),
  INDEX idx_venta_area_fecha (venta_area_id, venta_fecha),
  CONSTRAINT fk_venta_prosp   FOREIGN KEY (venta_prosp_id)   REFERENCES sv_crm_prospectos(prosp_id),
  CONSTRAINT fk_venta_gestion FOREIGN KEY (venta_gest_id)    REFERENCES sv_crm_gestiones(gest_id),
  CONSTRAINT fk_venta_asesor  FOREIGN KEY (venta_asesor_id)  REFERENCES sv_org_usuarios(usr_id),
  CONSTRAINT fk_venta_area    FOREIGN KEY (venta_area_id)    REFERENCES sv_cfg_areas_negocio(area_id),
  CONSTRAINT fk_venta_creador FOREIGN KEY (venta_created_by) REFERENCES sv_org_usuarios(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'SerVentas: ventas registradas al cerrar el contrato';

CREATE TABLE IF NOT EXISTS sv_crm_ventas_items (
  vi_id              INT           AUTO_INCREMENT PRIMARY KEY,
  vi_venta_id        INT           NOT NULL,
  vi_prod_id         INT           NOT NULL,
  vi_cantidad        SMALLINT      NOT NULL,
  vi_precio_ofrecido DECIMAL(12,2) NULL,
  vi_precio_unitario DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uq_vi_venta_producto (vi_venta_id, vi_prod_id),
  INDEX idx_vi_producto (vi_prod_id),
  CONSTRAINT fk_vi_venta    FOREIGN KEY (vi_venta_id) REFERENCES sv_crm_ventas(venta_id),
  CONSTRAINT fk_vi_producto FOREIGN KEY (vi_prod_id)  REFERENCES sv_cfg_productos(prod_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'SerVentas: productos de cada venta';

CREATE TABLE IF NOT EXISTS sv_crm_ventas_cambios (
  vc_id            INT           AUTO_INCREMENT PRIMARY KEY,
  vc_venta_id      INT           NOT NULL,
  vc_usr_id        INT           NOT NULL,
  vc_accion        VARCHAR(10)   NOT NULL,   -- corregir, anular
  vc_motivo        VARCHAR(250)  NOT NULL,
  vc_total_antes   DECIMAL(14,2) NOT NULL,
  vc_total_despues DECIMAL(14,2) NOT NULL,
  vc_detalle       JSON          NULL,       -- { antes: [...], despues: [...] }
  vc_created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vc_venta (vc_venta_id),
  CONSTRAINT fk_vc_venta   FOREIGN KEY (vc_venta_id) REFERENCES sv_crm_ventas(venta_id),
  CONSTRAINT fk_vc_usuario FOREIGN KEY (vc_usr_id)   REFERENCES sv_org_usuarios(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'SerVentas: correcciones y anulaciones de ventas';
```

`src/sv/models/Venta.js` (nuevo):

```js
// sv/models/Venta.js — sv_crm_ventas (migración 027)
module.exports = (sequelize, DataTypes) => {
  const Venta = sequelize.define('SvVenta', {
    venta_id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    venta_prosp_id:   { type: DataTypes.INTEGER, allowNull: false },
    venta_gest_id:    { type: DataTypes.BIGINT, allowNull: false, unique: 'uq_venta_gestion' },
    venta_asesor_id:  { type: DataTypes.INTEGER, allowNull: false },   // dueño del cliente: a él le suma
    venta_area_id:    { type: DataTypes.INTEGER, allowNull: false },
    venta_fecha:      { type: DataTypes.DATEONLY, allowNull: false },  // día en Colombia
    venta_total:      { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    venta_anulada:    { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    venta_created_by: { type: DataTypes.INTEGER, allowNull: false }
  }, {
    tableName: 'sv_crm_ventas',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'venta_created_at',
    updatedAt: 'venta_updated_at'
  });

  Venta.associate = (models) => {
    Venta.belongsTo(models.SvProspecto, { as: 'prospecto', foreignKey: 'venta_prosp_id' });
    Venta.belongsTo(models.SvUsuario,   { as: 'asesor',    foreignKey: 'venta_asesor_id' });
    Venta.hasMany(models.SvVentaItem,   { as: 'items',     foreignKey: 'vi_venta_id' });
    Venta.hasMany(models.SvVentaCambio, { as: 'cambios',   foreignKey: 'vc_venta_id' });
  };
  return Venta;
};
```

`src/sv/models/VentaItem.js` (nuevo):

```js
// sv/models/VentaItem.js — sv_crm_ventas_items (migración 027)
module.exports = (sequelize, DataTypes) => {
  const VentaItem = sequelize.define('SvVentaItem', {
    vi_id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    vi_venta_id:        { type: DataTypes.INTEGER, allowNull: false },
    vi_prod_id:         { type: DataTypes.INTEGER, allowNull: false },
    vi_cantidad:        { type: DataTypes.SMALLINT, allowNull: false },
    vi_precio_ofrecido: { type: DataTypes.DECIMAL(12, 2) },                    // lo pone el servidor
    vi_precio_unitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false }   // por el que se vendió
  }, {
    tableName: 'sv_crm_ventas_items',
    freezeTableName: true,
    timestamps: false
  });

  VentaItem.associate = (models) => {
    VentaItem.belongsTo(models.SvVenta,    { as: 'venta',    foreignKey: 'vi_venta_id' });
    VentaItem.belongsTo(models.SvProducto, { as: 'producto', foreignKey: 'vi_prod_id' });
  };
  return VentaItem;
};
```

`src/sv/models/VentaCambio.js` (nuevo):

```js
// sv/models/VentaCambio.js — sv_crm_ventas_cambios (migración 027)
module.exports = (sequelize, DataTypes) => {
  const VentaCambio = sequelize.define('SvVentaCambio', {
    vc_id:            { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    vc_venta_id:      { type: DataTypes.INTEGER, allowNull: false },
    vc_usr_id:        { type: DataTypes.INTEGER, allowNull: false },
    vc_accion:        { type: DataTypes.STRING(10), allowNull: false },   // corregir, anular
    vc_motivo:        { type: DataTypes.STRING(250), allowNull: false },
    vc_total_antes:   { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    vc_total_despues: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    vc_detalle:       { type: DataTypes.JSON }
  }, {
    tableName: 'sv_crm_ventas_cambios',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'vc_created_at',
    updatedAt: false
  });

  VentaCambio.associate = (models) => {
    VentaCambio.belongsTo(models.SvVenta,   { as: 'venta',   foreignKey: 'vc_venta_id' });
    VentaCambio.belongsTo(models.SvUsuario, { as: 'usuario', foreignKey: 'vc_usr_id' });
  };
  return VentaCambio;
};
```

`src/sv/validations/ventas.validation.js` (nuevo):

```js
/**
 * sv/validations/ventas.validation.js — venta al cerrar el contrato y sus correcciones.
 * El total no se recibe: lo calcula el servidor.
 */
const Joi = require('joi');

const items = Joi.array().items(Joi.object({
  prod_id:         Joi.number().integer().positive().required(),
  cantidad:        Joi.number().integer().min(1).max(999).required(),
  precio_unitario: Joi.number().integer().min(1).max(9999999999).required()
})).min(1).max(50).unique('prod_id').required();

const motivo = Joi.string().trim().min(3).max(250).required();
// Correcciones que el supervisor vio al abrir la ventana: si hay más, otra persona cambió la venta.
const cambios_vistos = Joi.number().integer().min(0).required();

module.exports = {
  venta:    Joi.object({ items }),
  corregir: Joi.object({ items, motivo, cambios_vistos }),
  anular:   Joi.object({ motivo, cambios_vistos })
};
```

Aplica con `git apply` este diff, sin cambiarlo:

```diff
--- a/src/sv/models/index.js
+++ b/src/sv/models/index.js
@@ -53,7 +53,11 @@
   SvEmpresaPropuestaArchivo: require('./EmpresaPropuestaArchivo')(sequelize, Sequelize.DataTypes),
   SvFidelizMovimiento:       require('./FidelizMovimiento')(sequelize, Sequelize.DataTypes),
   // ─── Salas de velación: visitas de Prenecesidad (migración 023) ───
-  SvSalaContratante:         require('./SalaContratante')(sequelize, Sequelize.DataTypes)
+  SvSalaContratante:         require('./SalaContratante')(sequelize, Sequelize.DataTypes),
+  // ─── Ventas al cerrar el contrato (migración 027) ───
+  SvVenta:                   require('./Venta')(sequelize, Sequelize.DataTypes),
+  SvVentaItem:               require('./VentaItem')(sequelize, Sequelize.DataTypes),
+  SvVentaCambio:             require('./VentaCambio')(sequelize, Sequelize.DataTypes)
 };
 
 // Asociaciones
--- a/src/sv/validations/crm.validation.js
+++ b/src/sv/validations/crm.validation.js
@@ -3,6 +3,7 @@
  * Joi schemas para personas, prospectos, gestiones y listas.
  */
 const Joi = require('joi');
+const ventas = require('./ventas.validation');
 
 const personas = {
   buscar: Joi.object({
@@ -128,7 +129,8 @@
     gest_prox_hora:       Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null, ''),
     gest_ubicacion_lat:   Joi.number().min(-90).max(90).allow(null),
     gest_ubicacion_lng:   Joi.number().min(-180).max(180).allow(null),
-    gest_fecha_hora:      Joi.date().iso()
+    gest_fecha_hora:      Joi.date().iso(),
+    venta:                ventas.venta   // solo al cerrar el contrato; ver ventas.service
   }),
   list: Joi.object({
     page:  Joi.number().integer().min(1).default(1),
--- a/src/sv/validations/salas.validation.js
+++ b/src/sv/validations/salas.validation.js
@@ -1,5 +1,6 @@
 // sv/validations/salas.validation.js — schemas Joi planos (validate llama schema.validate).
 const Joi = require('joi');
+const ventas = require('./ventas.validation');
 
 const atender = Joi.object({
   nombre:   Joi.string().trim().max(100).allow('', null),
@@ -11,7 +12,8 @@
   gest_estado_nuevo_id: Joi.number().integer().positive().allow(null),
   gest_comentario:      Joi.string().allow('', null),
   gest_prox_fecha:      Joi.date().iso().allow(null),
-  gest_prox_hora:       Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null, '')
+  gest_prox_hora:       Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null, ''),
+  venta:                ventas.venta   // solo al cerrar el contrato; ver ventas.service
 });
 
 module.exports = { atender, visita };
```

- [ ] **Step 4:** el mismo test → PASS. `npx jest tests/salas tests/gestiones` → sin cambios.
- [ ] **Step 5: Commit** `feat(ventas): migración 027, modelos y validación`

---

### Task 2: Registrar la venta al cerrar

Directorio: **BACK**.

**Files:** Create `src/sv/services/ventas.service.js`. Modify `src/sv/services/gestiones.service.js`, `src/sv/services/salas.service.js`. Test `tests/ventas.service.test.js`, `tests/gestionesVenta.service.test.js`, `tests/salas.service.test.js` (casos nuevos).

**Interfaces:** Consumes los modelos de la Task 1. Produces `ventas.service`: `areaRegistraVentas(areaId, transaction?)`, `registrarAlCerrar({ prospecto, gestId, estadoNuevo, venta, usuarioId, transaction })`, `listarDeProspecto(prospId)`, `obtener(ventaId)`, `corregir(ventaId, { items, motivo, cambios_vistos }, usuarioId)`, `anular(ventaId, { motivo, cambios_vistos }, usuarioId)`, `metricasPorAsesor(ids, desde, hasta)` → `Map(usr_id → { contratos, valor })`. Errores con `code` `VALIDATION_ERROR`, `NOT_FOUND` o `CONFLICT`.

- [ ] **Step 1: Write the failing tests**

`tests/ventas.service.test.js` (nuevo):

```js
jest.mock('../src/sv/models', () => ({
  sequelize: { transaction: jest.fn(), query: jest.fn() },
  SvVenta: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  SvVentaItem: { bulkCreate: jest.fn(), findAll: jest.fn(), destroy: jest.fn() },
  SvVentaCambio: { create: jest.fn(), count: jest.fn() },
  SvProducto: { findOne: jest.fn(), findAll: jest.fn() },
  SvProspectoProducto: { findAll: jest.fn() },
  SvUsuario: {}
}));
jest.mock('../src/sv/utils/fechas', () => ({ ...jest.requireActual('../src/sv/utils/fechas'), hoyBogotaISO: () => '2026-11-24' }));

const { Op } = require('sequelize');
const M = require('../src/sv/models');
const ventas = require('../src/sv/services/ventas.service');

const t = { commit: jest.fn(), rollback: jest.fn() };
const PRODUCTOS = [
  { prod_id: 10, prod_nombre: 'Osario A2', prod_activo: 1, prod_es_generico: 0, prod_precio_base: '8770000.00' },
  { prod_id: 11, prod_nombre: 'Columbario', prod_activo: 1, prod_es_generico: 0, prod_precio_base: '4785000.00' },
  { prod_id: 12, prod_nombre: 'Nivel 1A', prod_activo: 1, prod_es_generico: 0, prod_precio_base: '0.00' },
  { prod_id: 13, prod_nombre: 'Osarios', prod_activo: 1, prod_es_generico: 1, prod_precio_base: null },
  { prod_id: 14, prod_nombre: 'Velación', prod_activo: 0, prod_es_generico: 0, prod_precio_base: '1.00' }
];
const PROSPECTO = { prosp_id: 900, prosp_area_id: 1, prosp_asesor_id: 7 };
const GANADO = { estado_id: 5, estado_es_ganado: 1 };
const ITEMS = [{ prod_id: 10, cantidad: 2, precio_unitario: 8500000 }, { prod_id: 11, cantidad: 1, precio_unitario: 4785000 }];

beforeEach(() => {
  jest.resetAllMocks();
  M.sequelize.transaction.mockResolvedValue(t);
  M.SvProducto.findOne.mockResolvedValue({ prod_id: 10 });
  M.SvProducto.findAll.mockImplementation(async ({ where }) =>
    PRODUCTOS.filter((p) => where.prod_id[Op.in].includes(p.prod_id) && where.prod_area_id === 1));
  M.SvProspectoProducto.findAll.mockResolvedValue([]);
  M.SvVenta.create.mockResolvedValue({ venta_id: 40 });
  M.SvVentaCambio.count.mockResolvedValue(0);
});
const error = (p) => p.then(() => null, (e) => e);
const filas = () => M.SvVentaItem.bulkCreate.mock.calls[0][0];

describe('registrarAlCerrar', () => {
  const cerrar = (extra = {}) => ventas.registrarAlCerrar({
    prospecto: PROSPECTO, gestId: 77, estadoNuevo: GANADO, venta: { items: ITEMS }, usuarioId: 7, transaction: t, ...extra
  });

  test('guarda la venta del dueño con el total calculado y la fecha de Colombia', async () => {
    await cerrar();
    expect(M.SvVenta.create).toHaveBeenCalledWith({
      venta_prosp_id: 900, venta_gest_id: 77, venta_asesor_id: 7, venta_area_id: 1,
      venta_fecha: '2026-11-24', venta_total: 21785000, venta_created_by: 7
    }, { transaction: t });
    expect(M.SvVentaItem.bulkCreate.mock.calls[0][1]).toEqual({ transaction: t });
  });

  test('si la registra el supervisor, suma al dueño del cliente', async () => {
    await cerrar({ usuarioId: 3 });
    expect(M.SvVenta.create.mock.calls[0][0]).toEqual(expect.objectContaining({ venta_asesor_id: 7, venta_created_by: 3 }));
  });

  test('un cliente sin asesor suma a quien la registra', async () => {
    await cerrar({ prospecto: { ...PROSPECTO, prosp_asesor_id: null }, usuarioId: 3 });
    expect(M.SvVenta.create.mock.calls[0][0].venta_asesor_id).toBe(3);
  });

  test('el precio ofrecido sale del interés; si no hay, del catálogo; sin precio queda null', async () => {
    M.SvProspectoProducto.findAll.mockResolvedValue([{ pp_prod_id: 10, pp_precio_ofrecido: '8000000.00' }]);
    await cerrar({ venta: { items: [...ITEMS, { prod_id: 12, cantidad: 1, precio_unitario: 900000, vi_precio_ofrecido: 5 }] } });
    expect(filas()).toEqual([
      { vi_venta_id: 40, vi_prod_id: 10, vi_cantidad: 2, vi_precio_ofrecido: '8000000.00', vi_precio_unitario: 8500000 },
      { vi_venta_id: 40, vi_prod_id: 11, vi_cantidad: 1, vi_precio_ofrecido: '4785000.00', vi_precio_unitario: 4785000 },
      { vi_venta_id: 40, vi_prod_id: 12, vi_cantidad: 1, vi_precio_ofrecido: null, vi_precio_unitario: 900000 }
    ]);
    expect(M.SvProspectoProducto.findAll.mock.calls[0][0].where.pp_prosp_id).toBe(900);
  });

  test.each([
    ['sin venta', null, /productos vendidos/],
    ['sin productos', { items: [] }, /al menos un producto/],
    ['con un "por definir"', { items: [{ prod_id: 13, cantidad: 1, precio_unitario: 1 }] }, /"Osarios" está por definir/],
    ['con un producto inactivo', { items: [{ prod_id: 14, cantidad: 1, precio_unitario: 1 }] }, /ya no está disponible/],
    ['con un producto de otra área', { items: [{ prod_id: 99, cantidad: 1, precio_unitario: 1 }] }, /ya no está disponible/],
    ['con un producto repetido', { items: [ITEMS[0], ITEMS[0]] }, /dos veces/],
    ['con un total imposible', { items: [{ prod_id: 10, cantidad: 999, precio_unitario: 9999999999 }] }, /demasiado alto/]
  ])('cerrar %s → VALIDATION_ERROR y no guarda nada', async (_n, venta, mensaje) => {
    const e = await error(cerrar({ venta }));
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.message).toMatch(mensaje);
    expect(M.SvVenta.create).not.toHaveBeenCalled();
  });

  test('en un área sin catálogo por tipos no pide venta', async () => {
    M.SvProducto.findOne.mockResolvedValue(null);
    expect(await cerrar({ venta: null })).toBeNull();
    expect(M.SvVenta.create).not.toHaveBeenCalled();
    expect(M.SvProducto.findOne.mock.calls[0][0].where).toEqual({ prod_area_id: 1, prod_activo: 1, prod_tipo: { [Op.ne]: '' } });
  });

  test('una venta sin cerrar el contrato se rechaza', async () => {
    expect((await error(cerrar({ estadoNuevo: { estado_es_ganado: 0 } }))).message).toMatch(/solo se registra al cerrar/);
    expect((await error(cerrar({ estadoNuevo: null }))).code).toBe('VALIDATION_ERROR');
    M.SvProducto.findOne.mockResolvedValue(null);
    expect((await error(cerrar())).code).toBe('VALIDATION_ERROR');
  });
});

describe('corregir y anular', () => {
  const fila = (prod, cantidad, precio, ofrecido = null) => ({ vi_prod_id: prod, vi_cantidad: cantidad, vi_precio_unitario: precio, vi_precio_ofrecido: ofrecido });
  let venta;
  beforeEach(() => {
    venta = { venta_id: 40, venta_prosp_id: 900, venta_area_id: 1, venta_total: '21785000.00', venta_anulada: 0, update: jest.fn() };
    M.SvVenta.findByPk.mockResolvedValue(venta);
    M.SvVentaItem.findAll.mockResolvedValue([fila(10, 2, '8500000.00', '8000000.00'), fila(11, 1, '4785000.00')]);
  });
  const NUEVOS = [{ prod_id: 10, cantidad: 1, precio_unitario: 8500000 }];
  const corregir = (extra = {}) => ventas.corregir(40, { items: NUEVOS, motivo: 'eran uno', cambios_vistos: 0, ...extra }, 3);

  test('reemplaza los productos, guarda el cambio y el total, todo en la transacción', async () => {
    await corregir();
    expect(M.SvVentaItem.destroy).toHaveBeenCalledWith({ where: { vi_venta_id: 40 }, transaction: t });
    expect(filas()).toEqual([{ vi_venta_id: 40, vi_prod_id: 10, vi_cantidad: 1, vi_precio_ofrecido: '8000000.00', vi_precio_unitario: 8500000 }]);
    expect(M.SvVentaCambio.create).toHaveBeenCalledWith({
      vc_venta_id: 40, vc_usr_id: 3, vc_accion: 'corregir', vc_motivo: 'eran uno',
      vc_total_antes: '21785000.00', vc_total_despues: 8500000,
      vc_detalle: {
        antes: [{ prod_id: 10, cantidad: 2, precio_unitario: 8500000 }, { prod_id: 11, cantidad: 1, precio_unitario: 4785000 }],
        despues: [{ prod_id: 10, cantidad: 1, precio_unitario: 8500000 }]
      }
    }, { transaction: t });
    expect(venta.update).toHaveBeenCalledWith({ venta_total: 8500000 }, { transaction: t });
    expect(M.SvVenta.findByPk.mock.calls[0]).toEqual([40, { transaction: t, lock: true }]);
    expect(t.commit).toHaveBeenCalledTimes(1);
  });

  test('conserva un producto vendido que después desactivaron, pero no deja agregarlo', async () => {
    M.SvVentaItem.findAll.mockResolvedValue([fila(14, 1, '100.00')]);
    await corregir({ items: [{ prod_id: 14, cantidad: 2, precio_unitario: 100 }] });
    expect(filas()[0].vi_prod_id).toBe(14);
    M.SvVentaItem.findAll.mockResolvedValue([fila(10, 1, '100.00')]);
    expect((await error(corregir({ items: [{ prod_id: 14, cantidad: 1, precio_unitario: 100 }] }))).message).toMatch(/ya no está disponible/);
  });

  test('sin cambios no guarda nada', async () => {
    const e = await error(corregir({ items: [{ prod_id: 11, cantidad: 1, precio_unitario: 4785000 }, { prod_id: 10, cantidad: 2, precio_unitario: 8500000 }] }));
    expect(e.message).toBe('No hay cambios para guardar');
    expect(M.SvVentaItem.destroy).not.toHaveBeenCalled();
    expect(t.rollback).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['inexistente', () => M.SvVenta.findByPk.mockResolvedValue(null), 'NOT_FOUND'],
    ['anulada', () => { venta.venta_anulada = 1; }, 'CONFLICT'],
    ['cambiada por otra persona', () => M.SvVentaCambio.count.mockResolvedValue(1), 'CONFLICT']
  ])('venta %s: ni corrige ni anula', async (_n, preparar, code) => {
    preparar();
    expect((await error(corregir())).code).toBe(code);
    expect((await error(ventas.anular(40, { motivo: 'se cayó', cambios_vistos: 0 }, 3))).code).toBe(code);
    expect(M.SvVentaCambio.create).not.toHaveBeenCalled();
    expect(venta.update).not.toHaveBeenCalled();
  });

  test('anular la marca y deja el motivo y el total que tenía', async () => {
    await ventas.anular(40, { motivo: 'el cliente desistió', cambios_vistos: 0 }, 3);
    expect(M.SvVentaCambio.create).toHaveBeenCalledWith({
      vc_venta_id: 40, vc_usr_id: 3, vc_accion: 'anular', vc_motivo: 'el cliente desistió', vc_total_antes: '21785000.00', vc_total_despues: 0
    }, { transaction: t });
    expect(venta.update).toHaveBeenCalledWith({ venta_anulada: 1 }, { transaction: t });
    expect(M.SvVentaItem.destroy).not.toHaveBeenCalled();
  });

  test('si algo falla revierte y propaga el error original', async () => {
    M.SvVentaCambio.create.mockRejectedValue(new Error('db caída'));
    t.rollback.mockRejectedValue(new Error('rollback'));
    await expect(corregir()).rejects.toThrow('db caída');
    expect(t.commit).not.toHaveBeenCalled();
  });
});

describe('metricasPorAsesor', () => {
  test('devuelve números por asesor y consulta el rango completo', async () => {
    M.sequelize.query.mockResolvedValue([{ asesor: 7, contratos: '2', valor: '9770000.00' }]);
    const r = await ventas.metricasPorAsesor([7, 8], '2026-11-01', '2026-11-30');
    expect(r.get(7)).toEqual({ contratos: 2, valor: 9770000 });
    expect(r.has(8)).toBe(false);
    expect(M.sequelize.query.mock.calls[0][1].replacements).toEqual({
      ids: [7, 8], desde: '2026-11-01', hasta: '2026-11-30', inicio: '2026-11-01 00:00:00', fin: '2026-11-30 23:59:59'
    });
  });

  test('sin asesores no consulta', async () => {
    expect((await ventas.metricasPorAsesor([], '2026-11-01', '2026-11-30')).size).toBe(0);
    expect(M.sequelize.query).not.toHaveBeenCalled();
  });
});
```

`tests/gestionesVenta.service.test.js` (nuevo):

```js
/** gestiones.crear + venta: todo en la misma transacción. */
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../src/sv/services/recuperacionAuto.service', () => ({ intentarRecuperacion: jest.fn() }));
jest.mock('../src/sv/services/ventas.service', () => ({ registrarAlCerrar: jest.fn() }));
jest.mock('../src/sv/models', () => ({
  sequelize: { transaction: jest.fn() },
  SvGestion: { create: jest.fn(), findByPk: jest.fn() },
  SvProspecto: { findByPk: jest.fn(), update: jest.fn() },
  SvEstado: { findByPk: jest.fn() },
  SvResultado: {}, SvUsuario: {}
}));

const M = require('../src/sv/models');
const ventas = require('../src/sv/services/ventas.service');
const { crear } = require('../src/sv/services/gestiones.service');

const t = { commit: jest.fn(), rollback: jest.fn() };
const VENTA = { items: [{ prod_id: 10, cantidad: 1, precio_unitario: 5 }] };
const PROSPECTO = { prosp_id: 9, prosp_area_id: 1 };

beforeEach(() => {
  jest.resetAllMocks();
  M.sequelize.transaction.mockResolvedValue(t);
  M.SvGestion.create.mockResolvedValue({ gest_id: 77 });
  M.SvGestion.findByPk.mockResolvedValue({ gest_id: 77, dataValues: {} });
  M.SvProspecto.findByPk.mockResolvedValue(PROSPECTO);
  M.SvEstado.findByPk.mockResolvedValue({ estado_id: 5, estado_es_final: 1, estado_es_ganado: 1 });
});

test('al cerrar el contrato registra la venta con la gestión, en la misma transacción', async () => {
  await crear({ gest_prosp_id: 9, gest_estado_nuevo_id: 5, venta: VENTA }, 7);
  expect(ventas.registrarAlCerrar).toHaveBeenCalledWith({
    prospecto: PROSPECTO, gestId: 77, estadoNuevo: expect.objectContaining({ estado_es_ganado: 1 }),
    venta: VENTA, usuarioId: 7, transaction: t
  });
  expect(t.commit).toHaveBeenCalledTimes(1);
});

test('cerrar sin venta también pasa por la regla', async () => {
  await crear({ gest_prosp_id: 9, gest_estado_nuevo_id: 5 }, 7);
  expect(ventas.registrarAlCerrar.mock.calls[0][0].venta).toBeNull();
});

test('si la venta no es válida se revierte todo', async () => {
  ventas.registrarAlCerrar.mockRejectedValue(Object.assign(new Error('mal'), { code: 'VALIDATION_ERROR' }));
  await expect(crear({ gest_prosp_id: 9, gest_estado_nuevo_id: 5, venta: VENTA }, 7)).rejects.toThrow('mal');
  expect(t.rollback).toHaveBeenCalledTimes(1);
  expect(t.commit).not.toHaveBeenCalled();
});

test('una venta sin cambio de estado pasa por la regla, que la rechaza', async () => {
  await crear({ gest_prosp_id: 9, venta: VENTA }, 7);
  expect(ventas.registrarAlCerrar.mock.calls[0][0].estadoNuevo).toBeNull();
});

test('las demás gestiones no la llaman', async () => {
  M.SvEstado.findByPk.mockResolvedValue({ estado_id: 2, estado_es_final: 0, estado_es_ganado: 0 });
  await crear({ gest_prosp_id: 9, gest_estado_nuevo_id: 2 }, 7);
  await crear({ gest_prosp_id: 9 }, 7);
  expect(ventas.registrarAlCerrar).not.toHaveBeenCalled();
});
```

Los casos nuevos de `tests/salas.service.test.js` vienen en el diff del Step 3: aplica primero solo esa parte (`git apply --include=tests/salas.service.test.js`).

- [ ] **Step 2:** `npx jest tests/ventas.service.test.js tests/gestionesVenta.service.test.js tests/salas.service.test.js` → FAIL.
- [ ] **Step 3: Implementar**

`src/sv/services/ventas.service.js` (nuevo):

```js
/**
 * sv/services/ventas.service.js
 * Lo que se vendió al cerrar un contrato: productos, cantidades y precios.
 *  - Solo en áreas con catálogo por tipos (hoy, Prenecesidad).
 *  - Se guarda en la misma transacción que la gestión que cierra el contrato.
 *  - Suma al asesor dueño del cliente, aunque la registre otra persona.
 *  - El total y el precio ofrecido los pone el servidor; nunca llegan del cliente.
 * Los errores llevan `code` y los responde svErrorHandler.
 */
const { Op, QueryTypes } = require('sequelize');
const {
  sequelize, SvVenta, SvVentaItem, SvVentaCambio, SvProducto, SvProspectoProducto, SvUsuario
} = require('../models');
const { hoyBogotaISO } = require('../utils/fechas');

const TOTAL_MAXIMO = 999999999999; // venta_total es DECIMAL(14,2)

function error(code, mensaje) { return Object.assign(new Error(mensaje), { code }); }
const invalida = (mensaje) => error('VALIDATION_ERROR', mensaje);

async function areaRegistraVentas(areaId, transaction) {
  // prod_tipo <> '' deja por fuera también los NULL.
  const p = await SvProducto.findOne({
    where: { prod_area_id: areaId, prod_activo: 1, prod_tipo: { [Op.ne]: '' } },
    attributes: ['prod_id'],
    transaction
  });
  return !!p;
}

// Devuelve los productos por id y el total. Un producto que ya está en la venta se acepta
// aunque lo hayan desactivado después.
async function validarItems(items, areaId, transaction, yaVendidos = new Set()) {
  if (!Array.isArray(items) || !items.length) throw invalida('Registra al menos un producto vendido');
  const ids = items.map((i) => i.prod_id);
  if (new Set(ids).size !== ids.length) throw invalida('Un producto aparece dos veces en la venta');

  const productos = await SvProducto.findAll({
    where: { prod_id: { [Op.in]: ids }, prod_area_id: areaId }, transaction
  });
  const porId = new Map(productos.map((p) => [p.prod_id, p]));
  for (const i of items) {
    const p = porId.get(i.prod_id);
    if (!p || (!p.prod_activo && !yaVendidos.has(i.prod_id))) {
      throw invalida('Uno de los productos ya no está disponible. Recarga la página y vuelve a elegirlo');
    }
    if (p.prod_es_generico) throw invalida(`"${p.prod_nombre}" está por definir: elige el producto exacto`);
  }
  const total = items.reduce((suma, i) => suma + i.cantidad * i.precio_unitario, 0);
  if (total > TOTAL_MAXIMO) throw invalida('El total de la venta es demasiado alto');
  return { porId, total };
}

// Precio ofrecido de cada producto: el del interés del cliente o, si no lo tenía, el vigente.
async function preciosOfrecidos(prospId, porId, transaction) {
  const intereses = await SvProspectoProducto.findAll({
    where: { pp_prosp_id: prospId, pp_prod_id: { [Op.in]: [...porId.keys()] } }, transaction
  });
  const ofrecidos = new Map(intereses.map((pp) => [pp.pp_prod_id, pp.pp_precio_ofrecido]));
  return (prodId) => {
    if (ofrecidos.get(prodId) != null) return ofrecidos.get(prodId);
    const vigente = porId.get(prodId).prod_precio_base;
    return Number(vigente) > 0 ? vigente : null;
  };
}

function filasDe(ventaId, items, ofrecido) {
  return items.map((i) => ({
    vi_venta_id: ventaId,
    vi_prod_id: i.prod_id,
    vi_cantidad: i.cantidad,
    vi_precio_ofrecido: ofrecido(i.prod_id),
    vi_precio_unitario: i.precio_unitario
  }));
}

async function registrarAlCerrar({ prospecto, gestId, estadoNuevo, venta, usuarioId, transaction }) {
  const aplica = !!prospecto && !!estadoNuevo?.estado_es_ganado
    && await areaRegistraVentas(prospecto.prosp_area_id, transaction);
  if (!aplica) {
    if (venta) throw invalida('La venta solo se registra al cerrar el contrato');
    return null;
  }
  if (!venta) {
    throw invalida('Para cerrar el contrato registra los productos vendidos. Si no ves esa sección, recarga GenFlow');
  }

  const { porId, total } = await validarItems(venta.items, prospecto.prosp_area_id, transaction);
  const ofrecido = await preciosOfrecidos(prospecto.prosp_id, porId, transaction);
  const v = await SvVenta.create({
    venta_prosp_id: prospecto.prosp_id,
    venta_gest_id: gestId,
    venta_asesor_id: prospecto.prosp_asesor_id || usuarioId,
    venta_area_id: prospecto.prosp_area_id,
    venta_fecha: hoyBogotaISO(),
    venta_total: total,
    venta_created_by: usuarioId
  }, { transaction });
  await SvVentaItem.bulkCreate(filasDe(v.venta_id, venta.items, ofrecido), { transaction });
  return v;
}

const DETALLE = [
  { model: SvVentaItem, as: 'items', include: [{ model: SvProducto, as: 'producto', attributes: ['prod_id', 'prod_nombre', 'prod_activo'] }] },
  { model: SvUsuario, as: 'asesor', attributes: ['usr_id', 'usr_nombre', 'usr_apellido'] },
  { model: SvVentaCambio, as: 'cambios', include: [{ model: SvUsuario, as: 'usuario', attributes: ['usr_id', 'usr_nombre', 'usr_apellido'] }] }
];

async function listarDeProspecto(prospId) {
  return SvVenta.findAll({
    where: { venta_prosp_id: prospId },
    include: DETALLE,
    order: [['venta_fecha', 'DESC'], ['venta_id', 'DESC'],
      [{ model: SvVentaItem, as: 'items' }, 'vi_id', 'ASC'],
      [{ model: SvVentaCambio, as: 'cambios' }, 'vc_id', 'DESC']]
  });
}

async function obtener(ventaId) {
  return SvVenta.findByPk(ventaId, { include: DETALLE });
}

// Bloquea la venta y comprueba que siga como la vio quien la está cambiando.
async function bloquear(ventaId, cambiosVistos, transaction) {
  const venta = await SvVenta.findByPk(ventaId, { transaction, lock: true });
  if (!venta) throw error('NOT_FOUND', 'Venta no encontrada');
  if (venta.venta_anulada) throw error('CONFLICT', 'Esta venta ya está anulada');
  const cambios = await SvVentaCambio.count({ where: { vc_venta_id: ventaId }, transaction });
  if (cambios !== cambiosVistos) {
    throw error('CONFLICT', 'Otra persona cambió esta venta. Recarga la ficha y revisa antes de seguir');
  }
  return venta;
}

async function enTransaccion(fn) {
  const t = await sequelize.transaction();
  try {
    const r = await fn(t);
    await t.commit();
    return r;
  } catch (e) {
    try { await t.rollback(); } catch { /* el error que importa es el original */ }
    throw e;
  }
}

const resumen = (filas) => filas.map((f) => ({
  prod_id: f.vi_prod_id, cantidad: f.vi_cantidad, precio_unitario: Number(f.vi_precio_unitario)
}));

async function corregir(ventaId, { items, motivo, cambios_vistos: vistos }, usuarioId) {
  await enTransaccion(async (t) => {
    const venta = await bloquear(ventaId, vistos, t);
    const antes = await SvVentaItem.findAll({ where: { vi_venta_id: ventaId }, transaction: t });
    const anteriores = new Map(antes.map((f) => [f.vi_prod_id, f]));
    const { porId, total } = await validarItems(items, venta.venta_area_id, t, new Set(anteriores.keys()));

    const igual = items.length === antes.length && items.every((i) => {
      const f = anteriores.get(i.prod_id);
      return f && f.vi_cantidad === i.cantidad && Number(f.vi_precio_unitario) === i.precio_unitario;
    });
    if (igual) throw invalida('No hay cambios para guardar');

    const nuevo = await preciosOfrecidos(venta.venta_prosp_id, porId, t);
    const ofrecido = (id) => (anteriores.has(id) ? anteriores.get(id).vi_precio_ofrecido : nuevo(id));
    const despues = filasDe(ventaId, items, ofrecido);
    await SvVentaItem.destroy({ where: { vi_venta_id: ventaId }, transaction: t });
    await SvVentaItem.bulkCreate(despues, { transaction: t });
    await SvVentaCambio.create({
      vc_venta_id: ventaId, vc_usr_id: usuarioId, vc_accion: 'corregir', vc_motivo: motivo,
      vc_total_antes: venta.venta_total, vc_total_despues: total,
      vc_detalle: { antes: resumen(antes), despues: resumen(despues) }
    }, { transaction: t });
    await venta.update({ venta_total: total }, { transaction: t });
  });
  return obtener(ventaId);
}

async function anular(ventaId, { motivo, cambios_vistos: vistos }, usuarioId) {
  await enTransaccion(async (t) => {
    const venta = await bloquear(ventaId, vistos, t);
    await SvVentaCambio.create({
      vc_venta_id: ventaId, vc_usr_id: usuarioId, vc_accion: 'anular', vc_motivo: motivo,
      vc_total_antes: venta.venta_total, vc_total_despues: 0
    }, { transaction: t });
    await venta.update({ venta_anulada: 1 }, { transaction: t });
  });
  return obtener(ventaId);
}

/**
 * Contratos y valor vendido por asesor entre dos días (YYYY-MM-DD, ambos incluidos).
 * Un contrato es una venta activa del asesor dueño. Los cierres sin venta (otras áreas, o
 * anteriores a la migración 027) se cuentan como siempre: por la gestión de quien cerró.
 */
async function metricasPorAsesor(asesorIds, desde, hasta) {
  if (!asesorIds.length) return new Map();
  const filas = await sequelize.query(`
    SELECT asesor, SUM(contratos) AS contratos, SUM(valor) AS valor FROM (
      SELECT v.venta_asesor_id AS asesor, COUNT(*) AS contratos, SUM(v.venta_total) AS valor
        FROM sv_crm_ventas v
       WHERE v.venta_anulada = 0 AND v.venta_asesor_id IN (:ids) AND v.venta_fecha BETWEEN :desde AND :hasta
       GROUP BY v.venta_asesor_id
      UNION ALL
      SELECT g.gest_asesor_id, COUNT(DISTINCT g.gest_prosp_id, DATE(g.gest_fecha_hora)), 0
        FROM sv_crm_gestiones g
        JOIN sv_cfg_estados_gestion e ON e.estado_id = g.gest_estado_nuevo_id AND e.estado_es_ganado = 1
       WHERE g.gest_asesor_id IN (:ids) AND g.gest_fecha_hora BETWEEN :inicio AND :fin
         AND NOT EXISTS (SELECT 1 FROM sv_crm_ventas v WHERE v.venta_gest_id = g.gest_id)
       GROUP BY g.gest_asesor_id
    ) x GROUP BY asesor`, {
    replacements: { ids: asesorIds, desde, hasta, inicio: `${desde} 00:00:00`, fin: `${hasta} 23:59:59` },
    type: QueryTypes.SELECT
  });
  return new Map(filas.map((f) => [Number(f.asesor), { contratos: Number(f.contratos), valor: Number(f.valor) }]));
}

module.exports = {
  areaRegistraVentas, registrarAlCerrar, listarDeProspecto, obtener, corregir, anular, metricasPorAsesor
};
```

Aplica con `git apply` este diff, sin cambiarlo:

```diff
--- a/src/sv/services/gestiones.service.js
+++ b/src/sv/services/gestiones.service.js
@@ -9,6 +9,7 @@
 } = require('../models');
 const { rangoDia } = require('../utils/fechas');
 const recuperacionAuto = require('./recuperacionAuto.service');
+const ventas = require('./ventas.service');
 const logger = require('../../utils/logger');
 
 async function crear(payload, asesorId) {
@@ -58,6 +59,18 @@
       await SvProspecto.update(prospUpdate, { where: { prosp_id: payload.gest_prosp_id }, transaction: t });
     }
 
+    // Venta: obligatoria al cerrar el contrato en las áreas que venden por producto.
+    if (payload.venta || estadoNuevoAdvance?.estado_es_ganado) {
+      await ventas.registrarAlCerrar({
+        prospecto: await SvProspecto.findByPk(payload.gest_prosp_id, { transaction: t }),
+        gestId: gest.gest_id,
+        estadoNuevo: estadoNuevoAdvance,
+        venta: payload.venta || null,
+        usuarioId: asesorId,
+        transaction: t
+      });
+    }
+
     // Hook cross-área: si pasó a estado final NO ganado en Previsión, disparar recuperación SVC
     let recuperacionGenerada = null;
     if (payload.gest_estado_nuevo_id) {
--- a/src/sv/services/salas.service.js
+++ b/src/sv/services/salas.service.js
@@ -278,6 +278,9 @@
       where: { estado_id: body.gest_estado_nuevo_id, estado_grupo_id: cat.grupoId, estado_activo: 1 }
     });
     if (!estado) throw new SalaError('ESTADO_INVALIDO', 422, 'El estado no es de telemercadeo');
+    if (estado.estado_es_ganado && Number(p.prosp_asesor_id) !== Number(user.usr_id)) {
+      throw new SalaError('CLIENTE_DE_OTRO_ASESOR', 403, 'Este cliente es de otro asesor: solo quien lo tiene asignado puede cerrar el contrato');
+    }
   }
 
   if (resultado.resultado_requiere_fecha && !body.gest_prox_fecha) {
@@ -292,7 +295,8 @@
     gest_estado_nuevo_id: body.gest_estado_nuevo_id || null,
     gest_comentario: body.gest_comentario || null,
     gest_prox_fecha: body.gest_prox_fecha || null,
-    gest_prox_hora: body.gest_prox_hora || null
+    gest_prox_hora: body.gest_prox_hora || null,
+    venta: body.venta
   }, user.usr_id);
 
   logger.info(`[SALA_VISITA] homenaje_sala_id=${homenajeId} prosp_id=${p.prosp_id} usr_id=${user.usr_id}`);
--- a/tests/salas.service.test.js
+++ b/tests/salas.service.test.js
@@ -476,6 +476,26 @@
       gest_prox_fecha: '2026-11-25',
       gest_prox_hora: '10:00'
     }, 7);
+  });
+
+  describe('cerrar el contrato', () => {
+    const gestiones = require('../src/sv/services/gestiones.service');
+    const VENTA = { items: [{ prod_id: 10, cantidad: 1, precio_unitario: 5 }] };
+    beforeEach(() => {
+      M.SvEstado.findOne.mockImplementation(async ({ where }) => (where.estado_id === 5 ? { estado_id: 5, estado_es_ganado: 1 } : { estado_id: 11 }));
+    });
+
+    test('el dueño del cliente puede, con su venta', async () => {
+      M.SvProspecto.findByPk.mockResolvedValue({ prosp_id: 901, prosp_activo: 1, prosp_asesor_id: 7 });
+      await salas.registrarVisita(57, ASESOR, { ...BODY, gest_estado_nuevo_id: 5, venta: VENTA });
+      expect(gestiones.crear.mock.calls[0][0]).toEqual(expect.objectContaining({ gest_estado_nuevo_id: 5, venta: VENTA }));
+    });
+
+    test.each([['otro asesor', 8], ['nadie', null]])('403 CLIENTE_DE_OTRO_ASESOR si el cliente es de %s', async (_n, duenio) => {
+      M.SvProspecto.findByPk.mockResolvedValue({ prosp_id: 901, prosp_activo: 1, prosp_asesor_id: duenio });
+      await esperarError(salas.registrarVisita(57, ASESOR, { ...BODY, gest_estado_nuevo_id: 5, venta: VENTA }), 'CLIENTE_DE_OTRO_ASESOR', 403);
+      expect(gestiones.crear).not.toHaveBeenCalled();
+    });
   });
 
   test('el log lleva solo identificadores', async () => {
```

- [ ] **Step 4:** los mismos tests → PASS; `npx jest tests/gestiones tests/salas tests/prospectos` → PASS.
- [ ] **Step 5: Commit** `feat(ventas): la venta se guarda con la gestión que cierra el contrato`

---

### Task 3: Ver, corregir y anular

Directorio: **BACK**.

**Files:** Create `src/sv/controllers/ventas.controller.js`, `src/sv/routes/ventas.routes.js`. Modify `src/sv/routes/index.js`, `src/sv/routes/prospectos.routes.js`. Test `tests/ventas.routes.test.js`.

**Interfaces:** Consumes `ventas.service` (Task 2) y los schemas (Task 1). Produces `GET /api/sv/prospectos/:id/ventas`, `PUT /api/sv/ventas/:id`, `POST /api/sv/ventas/:id/anular`.

- [ ] **Step 1: Write the failing test**

`tests/ventas.routes.test.js` (nuevo):

```js
jest.mock('../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../src/sv/models', () => ({}));
jest.mock('../src/sv/services/ventas.service', () => ({
  listarDeProspecto: jest.fn(), obtener: jest.fn(), corregir: jest.fn(), anular: jest.fn()
}));
jest.mock('../src/sv/services/prospectos.service', () => ({ obtenerAlcance: jest.fn() }));

const express = require('express');
const request = require('supertest');
const ventas = require('../src/sv/services/ventas.service');
const prospectos = require('../src/sv/services/prospectos.service');
const ctrl = require('../src/sv/controllers/ventas.controller');
const { svAreaGuard } = require('../src/sv/middleware/svAreaGuard');
const { capturarAsync } = require('../src/sv/utils/capturarAsync');
const { svErrorHandler } = require('../src/sv/middleware/svErrorHandler');
const { escuchar, cerrarTodos } = require('./helpers/servidorLocal');

const ASESOR     = { usr_id: 7, usr_area_id: 1, usr_grupo_id: 1, rol: { rol_codigo: 'ASESOR' } };
const OTRO       = { ...ASESOR, usr_id: 8 };
const SUPERVISOR = { usr_id: 3, usr_area_id: 1, usr_grupo_id: 1, gruposExtra: [], rol: { rol_codigo: 'SUPERVISOR' } };
const AJENO      = { ...SUPERVISOR, usr_id: 4, usr_grupo_id: 2 };
const BODY = { items: [{ prod_id: 10, cantidad: 1, precio_unitario: 5 }], motivo: 'precio mal', cambios_vistos: 0 };

function app(user) {
  const r = express.Router();
  r.get('/prospectos/:id/ventas', ctrl.listarDeProspecto);
  r.use('/ventas', require('../src/sv/routes/ventas.routes'));
  capturarAsync(r);
  r.use(svErrorHandler);
  const a = express();
  a.use(express.json());
  a.use((req, res, next) => { req.user = user; next(); });
  a.use(svAreaGuard);
  a.use('/api/sv', r);
  return escuchar(a);
}

beforeEach(() => {
  jest.resetAllMocks();
  prospectos.obtenerAlcance.mockImplementation(async (id) => (id === 900 ? { prosp_id: 900, prosp_asesor_id: 7, prosp_grupo_id: 1, prosp_area_id: 1 } : null));
  ventas.obtener.mockImplementation(async (id) => (id === 40 ? { venta_id: 40, venta_prosp_id: 900 } : null));
  ventas.listarDeProspecto.mockResolvedValue([{ venta_id: 40 }]);
  ventas.corregir.mockResolvedValue({ venta_id: 40, venta_total: '5.00' });
  ventas.anular.mockResolvedValue({ venta_id: 40, venta_anulada: 1 });
});
afterEach(cerrarTodos);

describe('ver las ventas del cliente', () => {
  test.each([
    ['su asesor', ASESOR, 900, 200], ['su supervisor', SUPERVISOR, 900, 200],
    ['otro asesor', OTRO, 900, 403], ['un supervisor de otro grupo', AJENO, 900, 403],
    ['un cliente que no existe', ASESOR, 901, 404], ['un id inválido', ASESOR, 'abc', 404]
  ])('%s', async (_n, user, id, estado) => {
    const r = await request(await app(user)).get(`/api/sv/prospectos/${id}/ventas`);
    expect(r.status).toBe(estado);
    expect(ventas.listarDeProspecto).toHaveBeenCalledTimes(estado === 200 ? 1 : 0);
  });
});

describe.each([['corregir', 'put', '/ventas/40', BODY], ['anular', 'post', '/ventas/40/anular', { motivo: 'se cayó', cambios_vistos: 0 }]])('%s', (accion, metodo, ruta, body) => {
  const pedir = async (user, r = ruta, b = body) => request(await app(user))[metodo](`/api/sv${r}`).send(b);

  test('el supervisor del cliente puede, y queda a su nombre', async () => {
    const r = await pedir(SUPERVISOR);
    expect(r.status).toBe(200);
    expect(ventas[accion]).toHaveBeenCalledWith(40, body, 3);
  });

  test('el asesor no puede, aunque sea su cliente', async () => {
    const r = await pedir(ASESOR);
    expect(r.status).toBe(403);
    expect(r.body.message).toBe('Solo el supervisor puede corregir o anular una venta');
    expect(ventas[accion]).not.toHaveBeenCalled();
  });

  test('un supervisor de otro grupo no puede', async () => {
    expect((await pedir(AJENO)).status).toBe(403);
    expect(ventas[accion]).not.toHaveBeenCalled();
  });

  test('una venta que no existe → 404', async () => {
    expect((await pedir(SUPERVISOR, ruta.replace('40', '41'))).status).toBe(404);
  });

  test('sin motivo → 422', async () => {
    expect((await pedir(SUPERVISOR, ruta, { ...body, motivo: '' })).status).toBe(422);
    expect(ventas[accion]).not.toHaveBeenCalled();
  });

  test('si otra persona la cambió → 409 con el mensaje', async () => {
    ventas[accion].mockRejectedValue(Object.assign(new Error('Otra persona cambió esta venta'), { code: 'CONFLICT' }));
    const r = await pedir(SUPERVISOR);
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ success: false, error: 'CONFLICT', message: 'Otra persona cambió esta venta' });
  });
});
```

- [ ] **Step 2:** `npx jest tests/ventas.routes.test.js` → FAIL.
- [ ] **Step 3: Implementar**

`src/sv/controllers/ventas.controller.js` (nuevo):

```js
/**
 * sv/controllers/ventas.controller.js — ventas de un cliente y sus correcciones.
 * Ver: quien puede ver al cliente. Corregir y anular: supervisor o superior, en su alcance.
 */
const ventas = require('../services/ventas.service');
const prospectos = require('../services/prospectos.service');
const { ok, fail } = require('../utils/response');
const { ERROR_CODES, ROLES_SUPERVISORES } = require('../config/constants');
const { fueraDeAlcance } = require('../utils/alcanceProspecto');

const idDe = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Verifica el alcance sobre el cliente. Devuelve false si ya respondió 404 / 403.
async function clienteEnAlcance(req, res, prospId, noEncontrado) {
  const p = prospId ? await prospectos.obtenerAlcance(prospId) : null;
  if (!p) { fail(res, 404, ERROR_CODES.NOT_FOUND, noEncontrado); return false; }
  const motivo = fueraDeAlcance(req.user, req.scope, p);
  if (motivo) { fail(res, 403, ERROR_CODES.FORBIDDEN, motivo); return false; }
  return true;
}

async function listarDeProspecto(req, res) {
  const id = idDe(req);
  if (!(await clienteEnAlcance(req, res, id, 'Prospecto no encontrado'))) return;
  return ok(res, await ventas.listarDeProspecto(id));
}

// Rol, existencia y alcance de la venta. Devuelve su id, o null si ya respondió.
async function ventaEditable(req, res) {
  if (!ROLES_SUPERVISORES.includes(req.user.rol?.rol_codigo)) {
    fail(res, 403, ERROR_CODES.FORBIDDEN, 'Solo el supervisor puede corregir o anular una venta');
    return null;
  }
  const id = idDe(req);
  const venta = id ? await ventas.obtener(id) : null;
  if (!(await clienteEnAlcance(req, res, venta?.venta_prosp_id, 'Venta no encontrada'))) return null;
  return id;
}

async function corregir(req, res) {
  const id = await ventaEditable(req, res);
  if (!id) return;
  return ok(res, await ventas.corregir(id, req.body, req.user.usr_id));
}

async function anular(req, res) {
  const id = await ventaEditable(req, res);
  if (!id) return;
  return ok(res, await ventas.anular(id, req.body, req.user.usr_id));
}

module.exports = { listarDeProspecto, corregir, anular };
```

`src/sv/routes/ventas.routes.js` (nuevo):

```js
const router = require('express').Router();
const ctrl = require('../controllers/ventas.controller');
const v    = require('../validations/ventas.validation');
const { validate } = require('../middleware/validate');

router.put ('/:id',        validate(v.corregir), ctrl.corregir);
router.post('/:id/anular', validate(v.anular),   ctrl.anular);

module.exports = router;
```

Aplica con `git apply` este diff, sin cambiarlo:

```diff
--- a/src/sv/routes/index.js
+++ b/src/sv/routes/index.js
@@ -55,6 +55,9 @@
 // ─── Salas de velación: visitas de Prenecesidad (migración 023) ───
 router.use('/salas',        svAuth, svAreaGuard, require('./salas.routes'));
 
+// ─── Ventas: correcciones y anulaciones del supervisor (migración 027) ───
+router.use('/ventas',       svAuth, svAreaGuard, require('./ventas.routes'));
+
 // ─── Errores: siempre al final, después de montar TODAS las rutas ───
 // Un handler async que falla llega a svErrorHandler en vez de terminar el proceso.
 capturarAsync(router);
--- a/src/sv/routes/prospectos.routes.js
+++ b/src/sv/routes/prospectos.routes.js
@@ -1,5 +1,6 @@
 const router = require('express').Router();
 const ctrl = require('../controllers/prospectos.controller');
+const ventas = require('../controllers/ventas.controller');
 const v    = require('../validations/crm.validation');
 const { validate } = require('../middleware/validate');
 
@@ -11,6 +12,7 @@
 router.get  ('/por-asesor',          ctrl.porAsesor);                              // conteo por asesor (reasignación)
 router.post ('/reasignacion-masiva', ctrl.reasignacionMasiva);                     // mover todos de un asesor a otros
 router.get  ('/:id',                 ctrl.getOne);
+router.get  ('/:id/ventas',          ventas.listarDeProspecto);                    // ventas del cliente
 router.post ('/',                  validate(v.prospectos.create),              ctrl.create);
 router.put  ('/:id',                 validate(v.prospectos.update),              ctrl.update);
 router.put  ('/:id/productos',       validate(v.prospectos.productos),           ctrl.actualizarProductos);
```

- [ ] **Step 4:** el mismo test → PASS; `npx jest tests/svRoutesCaptura tests/prospectos` → PASS.
- [ ] **Step 5: Commit** `feat(ventas): el supervisor corrige y anula ventas`

---

### Task 4: Métricas

Directorio: **BACK**.

**Files:** Modify `src/sv/services/reportes.service.js`, `src/sv/services/snapshot.service.js`. Test `tests/reportesVentas.service.test.js`.

**Interfaces:** Consumes `ventas.metricasPorAsesor` y `ventas.areaRegistraVentas`. Produces en `reporteEquipo`: `registra_ventas` y `snap_valor_vendido_cop` por asesor.

- [ ] **Step 1: Write the failing test**

`tests/reportesVentas.service.test.js` (nuevo):

```js
/** Contratos y valor vendido salen de ventas.metricasPorAsesor, no del snapshot. */
jest.mock('../src/sv/services/ventas.service', () => ({ metricasPorAsesor: jest.fn(), areaRegistraVentas: jest.fn() }));
jest.mock('../src/sv/models', () => ({
  sequelize: {}, SvArea: {}, SvResultado: {}, SvEstado: {},
  SvSnapshotDiario: { findAll: jest.fn() }, SvUsuario: { findAll: jest.fn() }, SvGrupo: { findByPk: jest.fn() },
  SvGestion: { findAll: jest.fn() }, SvProspecto: { findAll: jest.fn() }, SvMeta: { findOne: jest.fn(), findAll: jest.fn() }
}));
jest.mock('../src/sv/config/db', () => ({ execute: jest.fn() }));
jest.mock('../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const M = require('../src/sv/models');
const ventas = require('../src/sv/services/ventas.service');
const reportes = require('../src/sv/services/reportes.service');
const pool = require('../src/sv/config/db');
const { generarSnapshot } = require('../src/sv/services/snapshot.service');

beforeEach(() => {
  jest.resetAllMocks();
  M.SvGestion.findAll.mockResolvedValue([]);
  M.SvProspecto.findAll.mockResolvedValue([]);
  M.SvMeta.findAll.mockResolvedValue([]);
  M.SvSnapshotDiario.findAll.mockResolvedValue([
    { snap_gestiones_realizadas: 5, snap_interesados_nuevos: 2, snap_contratos_cerrados: 9, snap_valor_vendido_cop: '1.00' }
  ]);
  M.SvUsuario.findAll.mockResolvedValue([{ usr_id: 7, usr_nombre: 'D', usr_apellido: 'M', usr_email: 'd@x' }, { usr_id: 8, usr_nombre: 'E', usr_apellido: 'N', usr_email: 'e@x' }]);
  M.SvGrupo.findByPk.mockResolvedValue({ grupo_area_id: 1 });
  ventas.areaRegistraVentas.mockResolvedValue(true);
  ventas.metricasPorAsesor.mockResolvedValue(new Map([[7, { contratos: 2, valor: 9770000 }]]));
});

test('reporte del asesor: gestiones e interesados del snapshot; contratos y valor al momento', async () => {
  const r = await reportes.reporteAsesor(7, { desde: '2026-11-01', hasta: '2026-11-30' });
  expect(r.totales).toEqual({ gestiones: 5, interesados: 2, contratos: 2, valor: 9770000 });
  expect(ventas.metricasPorAsesor).toHaveBeenCalledWith([7], '2026-11-01', '2026-11-30');
});

test('sin ventas ni cierres, contratos y valor quedan en 0', async () => {
  ventas.metricasPorAsesor.mockResolvedValue(new Map());
  const r = await reportes.reporteAsesor(7, { desde: '2026-11-01', hasta: '2026-11-30' });
  expect(r.totales).toEqual({ gestiones: 5, interesados: 2, contratos: 0, valor: 0 });
});

test('reporte del equipo: contratos y valor por asesor, y si el área registra ventas', async () => {
  const r = await reportes.reporteEquipo({ grupoId: 1, desde: '2026-11-01', hasta: '2026-11-30' });
  expect(r.registra_ventas).toBe(true);
  expect(r.asesores.map((a) => [a.snap_usuario_id, a.snap_contratos_cerrados, a.snap_valor_vendido_cop])).toEqual([[7, 2, 9770000], [8, 0, 0]]);
  expect(ventas.metricasPorAsesor).toHaveBeenCalledWith([7, 8], '2026-11-01', '2026-11-30');
  expect(ventas.areaRegistraVentas).toHaveBeenCalledWith(1);
});

test('un grupo sin asesores también dice si registra ventas', async () => {
  M.SvUsuario.findAll.mockResolvedValue([]);
  ventas.areaRegistraVentas.mockResolvedValue(false);
  expect(await reportes.reporteEquipo({ grupoId: 1, desde: '2026-11-01', hasta: '2026-11-30' }))
    .toEqual({ desde: '2026-11-01', hasta: '2026-11-30', registra_ventas: false, asesores: [] });
});

test.each([['todos', undefined, 6], ['un usuario', 7, 7]])('snapshot de %s: un parámetro por cada marca del SQL', async (_n, usr, n) => {
  pool.execute.mockResolvedValue([{ affectedRows: 1 }]);
  await generarSnapshot('2026-11-20', usr);
  const [sql, params] = pool.execute.mock.calls[0];
  expect(params).toHaveLength(n);
  expect(sql.replace(/--.*$/gm, '').match(/\?/g)).toHaveLength(n);
  expect(params.slice(0, 6)).toEqual(Array(6).fill('2026-11-20'));
  expect(sql).toContain('SUM(v.venta_total)');
});
```

- [ ] **Step 2:** `npx jest tests/reportesVentas.service.test.js` → FAIL.
- [ ] **Step 3: Implementar**

Aplica con `git apply` este diff, sin cambiarlo:

```diff
--- a/src/sv/services/reportes.service.js
+++ b/src/sv/services/reportes.service.js
@@ -8,6 +8,7 @@
   sequelize, SvSnapshotDiario, SvUsuario, SvArea, SvGrupo, SvGestion, SvProspecto, SvResultado, SvMeta, SvEstado
 } = require('../models');
 const { aISO, hoyISO, rango } = require('../utils/fechas');
+const ventas = require('./ventas.service');
 
 async function dashboardArea({ scope, fecha }) {
   const dia = aISO(fecha) || hoyISO();
@@ -53,11 +54,14 @@
   const totales = snaps.reduce((acc, s) => {
     acc.gestiones   += s.snap_gestiones_realizadas;
     acc.interesados += s.snap_interesados_nuevos;
-    acc.contratos   += s.snap_contratos_cerrados;
-    acc.valor       += parseFloat(s.snap_valor_vendido_cop || 0);
     return acc;
-  }, { gestiones: 0, interesados: 0, contratos: 0, valor: 0 });
+  }, { gestiones: 0, interesados: 0 });
 
+  // Contratos y valor se calculan al momento: las correcciones y anulaciones del supervisor
+  // cambian días que el snapshot ya guardó.
+  const metricas = await ventas.metricasPorAsesor([usrId], dStart, dEnd);
+  Object.assign(totales, metricas.get(usrId) || { contratos: 0, valor: 0 });
+
   // Meta del periodo
   let meta = null;
   if (mes && anio) {
@@ -113,7 +117,9 @@
     where: { usr_grupo_id: grupoId, usr_activo: 1 },
     attributes: ['usr_id', 'usr_nombre', 'usr_apellido', 'usr_email', 'usr_rol_id']
   });
-  if (!asesores.length) return { desde: dDesde, hasta: dHasta, asesores: [] };
+  const grupo = await SvGrupo.findByPk(grupoId, { attributes: ['grupo_area_id'] });
+  const registraVentas = !!grupo && await ventas.areaRegistraVentas(grupo.grupo_area_id);
+  if (!asesores.length) return { desde: dDesde, hasta: dHasta, registra_ventas: registraVentas, asesores: [] };
   const asesorIds = asesores.map(u => u.usr_id);
 
   // 2) Conteo de gestiones por asesor en el rango
@@ -153,27 +159,8 @@
   });
   const mapInter = new Map(interesRows.map(r => [r.gest_asesor_id, parseInt(r.total)]));
 
-  // 4) Cambios a estados ganados (contratos firmados / afiliados) en el rango
-  const ganadosRows = await SvGestion.findAll({
-    where: {
-      gest_asesor_id: { [Op.in]: asesorIds },
-      gest_fecha_hora: { [Op.between]: [start, end] }
-    },
-    include: [{
-      model: SvEstado,
-      as: 'estadoNuevo',
-      where: { estado_es_ganado: 1 },
-      required: true,
-      attributes: []
-    }],
-    attributes: [
-      'gest_asesor_id',
-      [fn('COUNT', col('gest_id')), 'total']
-    ],
-    group: ['gest_asesor_id'],
-    raw: true
-  });
-  const mapGanados = new Map(ganadosRows.map(r => [r.gest_asesor_id, parseInt(r.total)]));
+  // 4) Contratos (firmados / afiliados) y valor vendido en el rango
+  const metricas = await ventas.metricasPorAsesor(asesorIds, dDesde, dHasta);
 
   // 5) Vencidas acumuladas (prospectos con prox_gestion_fecha < hoy y estado no final)
   const vencRows = await SvProspecto.findAll({
@@ -204,13 +191,14 @@
 
   // 7) Componer resultado — usa las mismas claves del snapshot para compatibilidad con TablaAsesores
   const filas = asesores.map(u => {
-    const contratos = mapGanados.get(u.usr_id) || 0;
+    const { contratos, valor } = metricas.get(u.usr_id) || { contratos: 0, valor: 0 };
     return {
       snap_usuario_id:           u.usr_id,
       usuario:                   { usr_id: u.usr_id, usr_nombre: u.usr_nombre, usr_apellido: u.usr_apellido, usr_email: u.usr_email },
       snap_gestiones_realizadas: mapGest.get(u.usr_id) || 0,
       snap_interesados_nuevos:   mapInter.get(u.usr_id) || 0,
       snap_contratos_cerrados:   contratos,
+      snap_valor_vendido_cop:    valor,
       snap_vencidas_acumuladas:  mapVenc.get(u.usr_id) || 0,
       snap_meta_contratos:       metaContratos,
       snap_meta_porcentaje:      metaContratos > 0 ? Math.round((contratos / metaContratos) * 100) : null
@@ -222,7 +210,7 @@
     || (b.snap_gestiones_realizadas - a.snap_gestiones_realizadas)
   );
 
-  return { desde: dDesde, hasta: dHasta, asesores: filas };
+  return { desde: dDesde, hasta: dHasta, registra_ventas: registraVentas, asesores: filas };
 }
 
 module.exports = { dashboardArea, reporteAsesor, reporteEquipo };
--- a/src/sv/services/snapshot.service.js
+++ b/src/sv/services/snapshot.service.js
@@ -21,12 +21,15 @@
 
   // Filtro opcional por usuario
   const userFilter = usuarioId ? 'AND u.usr_id = ?' : '';
-  const params = usuarioId ? [dia, dia, dia, dia, usuarioId] : [dia, dia, dia, dia];
+  const params = Array(6).fill(dia);
+  if (usuarioId) params.push(usuarioId);
 
   // Query agregada:
   //   - gestiones del día por asesor
   //   - interesados nuevos = gestiones cuyo resultado_es_positivo=1 del día
-  //   - contratos cerrados = prospectos que pasaron a estado_es_ganado=1 hoy (vía gestiones)
+  //   - contratos cerrados = ventas activas de hoy del asesor dueño + cierres sin venta (prospectos
+  //     que pasaron a estado_es_ganado=1 hoy). Misma regla que ventas.metricasPorAsesor.
+  //   - valor vendido = suma de esas ventas
   //   - vencidas acumuladas = prospectos activos con prox_fecha < hoy del asesor
   const sql = `
     INSERT INTO sv_rpt_snapshot_diario
@@ -48,19 +51,26 @@
          WHERE g.gest_asesor_id = u.usr_id AND DATE(g.gest_fecha_hora) = ?
            AND r.resultado_es_positivo = 1
       ), 0) AS interesados,
-      COALESCE((
+      (
+        SELECT COUNT(*) FROM sv_crm_ventas v
+         WHERE v.venta_asesor_id = u.usr_id AND v.venta_fecha = ? AND v.venta_anulada = 0
+      ) + (
         SELECT COUNT(DISTINCT g.gest_prosp_id) FROM sv_crm_gestiones g
          JOIN sv_cfg_estados_gestion e ON e.estado_id = g.gest_estado_nuevo_id
          WHERE g.gest_asesor_id = u.usr_id AND DATE(g.gest_fecha_hora) = ?
            AND e.estado_es_ganado = 1
-      ), 0) AS contratos,
+           AND NOT EXISTS (SELECT 1 FROM sv_crm_ventas v WHERE v.venta_gest_id = g.gest_id)
+      ) AS contratos,
       COALESCE((
         SELECT COUNT(*) FROM sv_crm_prospectos p
          WHERE p.prosp_asesor_id = u.usr_id
            AND p.prosp_activo = 1
            AND p.prosp_prox_gestion_fecha < CURDATE()
       ), 0) AS vencidas,
-      0 AS valor   -- Se completa en Fase 4 al haber contratos con valor
+      COALESCE((
+        SELECT SUM(v.venta_total) FROM sv_crm_ventas v
+         WHERE v.venta_asesor_id = u.usr_id AND v.venta_fecha = ? AND v.venta_anulada = 0
+      ), 0) AS valor
     FROM sv_org_usuarios u
     WHERE u.usr_activo = 1
       AND u.usr_grupo_id IS NOT NULL
```

- [ ] **Step 4:** el mismo test → PASS.
- [ ] **Step 5: SQL en MySQL desechable.** `/private/tmp/claude-501/-Users-bortega-Shared-Files-From-c-localized-apps-mantix-crm-frontend/60a1a7ab-c576-4067-a00a-86698da3e988/scratchpad/probar027.sh <imagen> /private/tmp/claude-501/-Users-bortega-Shared-Files-From-c-localized-apps-mantix-crm-frontend/60a1a7ab-c576-4067-a00a-86698da3e988/scratchpad <BACK>` para `mysql:8.0` y `mysql:8` (ambas locales; los contenedores van sin red y se borran al final; léelo antes). Debe mostrar lo que el propio script anuncia: 3 tablas nuevas, métricas 4 / 10020000, 2 / 9770000 y 1 / 0, snapshots 1 / 0, 2 / 9770000 y 1 / 250000, y "Duplicate entry".
- [ ] **Step 6:** suite completa una vez: solo las cinco fallas conocidas.
- [ ] **Step 7: Commit** `feat(ventas): contratos y valor vendido en vivo`

---

### Task 5: Lógica y piezas de la venta

Directorio: **FRONT**.

**Files:** Create `src/api/ventasApi.js`, `src/utils/ventas.js`, `src/components/ui/CampoPesos.vue`, `src/components/crm/ProductosVendidos.vue`. Test `src/utils/__tests__/ventas.spec.js`, `src/components/ui/__tests__/CampoPesos.spec.js`, `src/components/crm/__tests__/ProductosVendidos.spec.js`.

**Interfaces:** Produces `ventasApi.deProspecto(prospId)`, `.corregir(id, datos)`, `.anular(id, datos)`; `lineaDe`, `lineasIniciales(seleccion, productos, intereses)`, `porDefinir(seleccion, productos)`, `lineasDeVenta(venta)`, `subtotal`, `totalVenta`, `errorVenta`, `itemsVenta`; `CampoPesos` (`modelValue: Number|null`, `etiqueta`); `ProductosVendidos` (`modelValue`, `productos`, `porDefinir`; testids `linea-`, `vendido-`, `cantidad-`, `precio-`, `subtotal-`, `agregar-producto`, `total-venta`, `por-definir`).

- [ ] **Step 1: Write the failing tests**

`src/utils/__tests__/ventas.spec.js` (nuevo):

```js
import { describe, it, expect } from 'vitest';
import { lineasIniciales, porDefinir, lineasDeVenta, lineaDe, subtotal, totalVenta, errorVenta, itemsVenta } from '@/utils/ventas';

const p = (prod_id, prod_nombre, prod_precio_base, prod_es_generico = 0) => ({ prod_id, prod_nombre, prod_precio_base, prod_es_generico });
const CATALOGO = [p(1, 'Osarios', null, 1), p(2, 'Osario A2', '8770000.00'), p(3, 'Lote doble', '18950000.00'), p(4, 'Nivel 1A', '0.00')];
const SEL = [{ prod_id: 1 }, { prod_id: 2 }, { prod_id: 4 }, { prod_id: 99 }];
const L = (datos = {}) => ({ prod_id: 2, nombre: 'Osario A2', vendido: true, cantidad: 2, precio_unitario: 100, ...datos });

describe('líneas iniciales', () => {
  it('toma los productos exactos con el precio ofrecido, o el del catálogo', () => {
    const r = lineasIniciales(SEL, CATALOGO, [{ pp_prod_id: 2, pp_precio_ofrecido: '8000000.00' }]);
    expect(r).toEqual([
      { prod_id: 2, nombre: 'Osario A2', vendido: true, cantidad: 1, precio_unitario: 8000000 },
      { prod_id: 4, nombre: 'Nivel 1A', vendido: true, cantidad: 1, precio_unitario: null }
    ]);
    expect(lineasIniciales([{ prod_id: 2 }], CATALOGO, [])[0].precio_unitario).toBe(8770000);
    expect(lineasIniciales([{ prod_id: 2 }], CATALOGO, [{ pp_prod_id: 2, pp_precio_ofrecido: null }])[0].precio_unitario).toBe(8770000);
  });
  it('los "por definir" van aparte', () => expect(porDefinir(SEL, CATALOGO)).toEqual(['Osarios']));
  it('sin selección ni catálogo no falla', () => {
    expect(lineasIniciales(null, null, null)).toEqual([]);
    expect(porDefinir(undefined, undefined)).toEqual([]);
  });
  it('una línea nueva usa el precio del catálogo', () => expect(lineaDe(CATALOGO[2])).toEqual({ prod_id: 3, nombre: 'Lote doble', vendido: true, cantidad: 1, precio_unitario: 18950000 }));
});

it('las líneas de una venta guardada conservan lo vendido', () => {
  expect(lineasDeVenta({ items: [
    { vi_prod_id: 2, vi_cantidad: 2, vi_precio_unitario: '8500000.00', producto: { prod_nombre: 'Osario A2' } },
    { vi_prod_id: 9, vi_cantidad: 1, vi_precio_unitario: '5.00', producto: null }
  ] })).toEqual([
    { prod_id: 2, nombre: 'Osario A2', vendido: true, cantidad: 2, precio_unitario: 8500000 },
    { prod_id: 9, nombre: 'Producto no disponible', vendido: true, cantidad: 1, precio_unitario: 5 }
  ]);
  expect(lineasDeVenta(null)).toEqual([]);
});

describe('total, validación y envío', () => {
  it('suma solo lo vendido', () => {
    expect(subtotal(L())).toBe(200);
    expect(totalVenta([L(), L({ prod_id: 3, cantidad: 1 }), L({ prod_id: 4, vendido: false })])).toBe(300);
    expect(totalVenta([L({ cantidad: null }), L({ prod_id: 3, precio_unitario: null })])).toBe(0);
  });
  it.each([
    ['nada marcado', [L({ vendido: false })], 'Marca al menos un producto vendido'],
    ['sin líneas', [], 'Marca al menos un producto vendido'],
    ['cantidad vacía', [L({ cantidad: null })], 'Revisa la cantidad de "Osario A2"'],
    ['cantidad 0', [L({ cantidad: 0 })], 'Revisa la cantidad de "Osario A2"'],
    ['sin precio', [L({ precio_unitario: null })], 'Escribe el precio de "Osario A2"'],
    ['precio 0', [L({ precio_unitario: 0 })], 'Escribe el precio de "Osario A2"'],
    ['completa', [L(), L({ prod_id: 3, vendido: false, precio_unitario: null })], '']
  ])('%s', (_n, lineas, mensaje) => expect(errorVenta(lineas)).toBe(mensaje));
  it('envía solo lo vendido y solo los datos que el servidor espera', () => {
    expect(itemsVenta([L(), L({ prod_id: 3, vendido: false })])).toEqual([{ prod_id: 2, cantidad: 2, precio_unitario: 100 }]);
  });
});
```

`src/components/ui/__tests__/CampoPesos.spec.js` (nuevo):

```js
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
});
```

`src/components/crm/__tests__/ProductosVendidos.spec.js` (nuevo):

```js
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ProductosVendidos from '@/components/crm/ProductosVendidos.vue';

const p = (prod_id, prod_nombre, prod_categoria, prod_tipo, prod_precio_base, prod_es_generico = 0) =>
  ({ prod_id, prod_nombre, prod_categoria, prod_tipo, prod_precio_base, prod_es_generico, prod_orden_display: prod_id });
const PRODUCTOS = [p(1, 'Osarios', 'Mausoleos', 'Osarios', null, 1), p(2, 'Osario A2', 'Mausoleos', 'Osarios', '8770000.00'), p(3, 'Lote doble', 'Mausoleos', 'Lotes', '18950000.00')];
const LINEA = { prod_id: 2, nombre: 'Osario A2', vendido: true, cantidad: 2, precio_unitario: 8500000 };

function montar(modelValue = [LINEA], extra = {}) {
  const w = mount(ProductosVendidos, {
    props: { modelValue, productos: PRODUCTOS, ...extra, 'onUpdate:modelValue': (v) => w.setProps({ modelValue: v }) }
  });
  return w;
}
const plano = (x) => x.text().replace(/\s+/g, ' ').trim();
const ultimo = (w) => w.emitted('update:modelValue').at(-1)[0];

describe('ProductosVendidos', () => {
  it('muestra cantidad, precio, subtotal y total', () => {
    const w = montar();
    expect(w.get('[data-testid="cantidad-2"]').element.value).toBe('2');
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('8.500.000');
    expect(plano(w.get('[data-testid="subtotal-2"]'))).toBe('$ 17.000.000');
    expect(plano(w.get('[data-testid="total-venta"]'))).toBe('$ 17.000.000');
  });

  it('cambiar cantidad y precio recalcula', async () => {
    const w = montar();
    await w.get('[data-testid="cantidad-2"]').setValue('3');
    await w.get('[data-testid="precio-2"] input').setValue('1000');
    expect(ultimo(w)).toEqual([{ ...LINEA, cantidad: 3, precio_unitario: 1000 }]);
    expect(plano(w.get('[data-testid="total-venta"]'))).toBe('$ 3.000');
  });

  it('una cantidad sin dígitos queda vacía, no en cero', async () => {
    const w = montar();
    await w.get('[data-testid="cantidad-2"]').setValue('abc');
    expect(ultimo(w)[0].cantidad).toBeNull();
  });

  it('desmarcar saca el producto del total sin perder lo escrito', async () => {
    const w = montar();
    await w.get('[data-testid="vendido-2"]').setValue(false);
    expect(ultimo(w)).toEqual([{ ...LINEA, vendido: false }]);
    expect(w.text()).toContain('no se vendió');
    expect(w.find('[data-testid="precio-2"]').exists()).toBe(false);
    expect(plano(w.get('[data-testid="total-venta"]'))).toBe('$ 0');
  });

  it('agregar ofrece solo productos exactos que no están, agrupados', async () => {
    const w = montar();
    const select = w.get('[data-testid="agregar-producto"]');
    expect(select.findAll('optgroup').map((g) => g.attributes('label'))).toEqual(['Mausoleos › Lotes']);
    expect(select.findAll('option').map((o) => o.text())).toEqual(['+ Agregar otro producto…', 'Lote doble']);
    await select.setValue('3');
    expect(ultimo(w).at(-1)).toEqual({ prod_id: 3, nombre: 'Lote doble', vendido: true, cantidad: 1, precio_unitario: 18950000 });
    expect(select.element.value).toBe('');
  });

  it('avisa de los "por definir"', () => {
    expect(plano(montar([], { porDefinir: ['Osarios', 'Lotes'] }).get('[data-testid="por-definir"]')))
      .toBe('Falta definir: Osarios, Lotes. Agrega abajo el producto exacto que se vendió.');
    expect(montar().find('[data-testid="por-definir"]').exists()).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/utils/__tests__/ventas.spec.js src/components/ui/__tests__/CampoPesos.spec.js src/components/crm/__tests__/ProductosVendidos.spec.js` → FAIL.
- [ ] **Step 3: Implementar**

`src/api/ventasApi.js` (nuevo):

```js
import api from './axios';

export const ventasApi = {
  deProspecto: (prospId)   => api.get(`/prospectos/${prospId}/ventas`).then(r => r.data),
  corregir:    (id, datos) => api.put(`/ventas/${id}`, datos).then(r => r.data),
  anular:      (id, datos) => api.post(`/ventas/${id}/anular`, datos).then(r => r.data)
};
```

`src/utils/ventas.js` (nuevo):

```js
/**
 * Venta al cerrar un contrato. Una línea por producto:
 * { prod_id, nombre, vendido, cantidad, precio_unitario }.
 * El total que vale es el del servidor; aquí se calcula para mostrarlo.
 */
import { precioDe } from '@/utils/catalogoProductos';

export function lineaDe(producto, precioOfrecido = null) {
  return {
    prod_id: producto.prod_id,
    nombre: producto.prod_nombre,
    vendido: true,
    cantidad: 1,
    precio_unitario: precioDe(precioOfrecido) ?? precioDe(producto.prod_precio_base)
  };
}

function elegidos(seleccion, productos) {
  const catalogo = new Map((productos || []).map((p) => [p.prod_id, p]));
  return (seleccion || []).map((s) => catalogo.get(s.prod_id)).filter(Boolean);
}

/** Los productos exactos que le interesan al cliente, con el precio que se le ofreció. */
export function lineasIniciales(seleccion, productos, intereses) {
  const ofrecidos = new Map((intereses || []).map((pp) => [pp.pp_prod_id, pp.pp_precio_ofrecido]));
  return elegidos(seleccion, productos)
    .filter((p) => !p.prod_es_generico)
    .map((p) => lineaDe(p, ofrecidos.get(p.prod_id)));
}

/** Intereses "por definir": no se pueden vender hasta elegir el producto. */
export function porDefinir(seleccion, productos) {
  return elegidos(seleccion, productos).filter((p) => p.prod_es_generico).map((p) => p.prod_nombre);
}

export function lineasDeVenta(venta) {
  return (venta?.items || []).map((i) => ({
    prod_id: i.vi_prod_id,
    nombre: i.producto?.prod_nombre || 'Producto no disponible',
    vendido: true,
    cantidad: i.vi_cantidad,
    precio_unitario: Number(i.vi_precio_unitario)
  }));
}

const vendidas = (lineas) => lineas.filter((l) => l.vendido);

export function subtotal(linea) {
  return (linea.cantidad || 0) * (linea.precio_unitario || 0);
}

export function totalVenta(lineas) {
  return vendidas(lineas).reduce((suma, l) => suma + subtotal(l), 0);
}

/** Qué falta para poder guardar, o '' si la venta está completa. */
export function errorVenta(lineas) {
  const v = vendidas(lineas);
  if (!v.length) return 'Marca al menos un producto vendido';
  const sinCantidad = v.find((l) => !Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > 999);
  if (sinCantidad) return `Revisa la cantidad de "${sinCantidad.nombre}"`;
  const sinPrecio = v.find((l) => !(l.precio_unitario > 0));
  if (sinPrecio) return `Escribe el precio de "${sinPrecio.nombre}"`;
  return '';
}

export function itemsVenta(lineas) {
  return vendidas(lineas).map(({ prod_id, cantidad, precio_unitario }) => ({ prod_id, cantidad, precio_unitario }));
}
```

`src/components/ui/CampoPesos.vue` (nuevo):

```vue
<script setup>
/**
 * CampoPesos.vue — valor en pesos con separador de miles.
 * v-model: entero, o null si está vacío. Es un campo de texto: la rueda no lo cambia.
 */
const props = defineProps({
  modelValue: { type: Number, default: null },
  etiqueta: { type: String, required: true }, // para lectores de pantalla
  disabled: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const MAX_DIGITOS = 10;
const miles = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const formato = (n) => (n === null || n === undefined ? '' : miles.format(n));

function alEscribir(e) {
  const campo = e.target;
  const cursor = campo.selectionStart ?? campo.value.length;
  let aLaDerecha = campo.value.slice(cursor).replace(/\D/g, '').length;
  const digitos = campo.value.replace(/\D/g, '').slice(0, MAX_DIGITOS);
  const valor = digitos ? Number(digitos) : null;

  campo.value = formato(valor);
  // El cursor queda delante de los mismos dígitos aunque se muevan los puntos.
  let pos = campo.value.length;
  while (pos > 0 && aLaDerecha > 0) {
    pos -= 1;
    if (/\d/.test(campo.value[pos])) aLaDerecha -= 1;
  }
  campo.setSelectionRange(pos, pos);
  if (valor !== props.modelValue) emit('update:modelValue', valor);
}
</script>

<template>
  <span class="relative block">
    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-text3" aria-hidden="true">$</span>
    <input type="text" inputmode="numeric" autocomplete="off" :value="formato(modelValue)"
           :aria-label="etiqueta" :disabled="disabled" class="sv-input pl-6 text-right" @input="alEscribir" />
  </span>
</template>
```

`src/components/crm/ProductosVendidos.vue` (nuevo):

```vue
<script setup>
/**
 * ProductosVendidos.vue — qué se vendió, cuánto y a qué precio.
 * Props: modelValue (líneas de utils/ventas), productos (catálogo activo del área),
 *        porDefinir (nombres de intereses sin producto exacto).
 */
import { computed } from 'vue';
import { fmtCOP } from '@/utils/format';
import { agruparProductos } from '@/utils/catalogoProductos';
import { lineaDe, subtotal, totalVenta } from '@/utils/ventas';
import CampoPesos from '@/components/ui/CampoPesos.vue';

const props = defineProps({
  modelValue: { type: Array, required: true },
  productos:  { type: Array, required: true },
  porDefinir: { type: Array, default: () => [] }
});
const emit = defineEmits(['update:modelValue']);

const total = computed(() => totalVenta(props.modelValue));

// Lo que se puede agregar: productos exactos que aún no están en la lista.
const grupos = computed(() => {
  const puestos = new Set(props.modelValue.map((l) => l.prod_id));
  return agruparProductos(props.productos.filter((p) => !p.prod_es_generico && !puestos.has(p.prod_id)))
    .flatMap((g) => g.tipos.map((t) => ({ titulo: `${g.categoria} › ${t.tipo}`, productos: t.productos })));
});

function cambiar(prodId, datos) {
  emit('update:modelValue', props.modelValue.map((l) => (l.prod_id === prodId ? { ...l, ...datos } : l)));
}

function cambiarCantidad(prodId, texto) {
  const digitos = texto.replace(/\D/g, '').slice(0, 3);
  cambiar(prodId, { cantidad: digitos ? Number(digitos) : null });
}

function agregar(e) {
  const p = props.productos.find((x) => x.prod_id === Number(e.target.value));
  e.target.value = '';
  if (p) emit('update:modelValue', [...props.modelValue, lineaDe(p)]);
}
</script>

<template>
  <div class="space-y-2">
    <p v-if="porDefinir.length" data-testid="por-definir" class="text-xs text-warning">
      Falta definir: {{ porDefinir.join(', ') }}. Agrega abajo el producto exacto que se vendió.
    </p>
    <p v-if="!modelValue.length" class="text-xs text-text3 italic">Agrega los productos que se vendieron.</p>

    <div v-for="l in modelValue" :key="l.prod_id" :data-testid="`linea-${l.prod_id}`"
         class="rounded-sv border px-2 py-2" :class="l.vendido ? 'border-gold/40 bg-gold/5' : 'border-text3/20'">
      <label class="flex items-start gap-2 text-sm text-text1 cursor-pointer">
        <input type="checkbox" class="mt-0.5 w-4 h-4 accent-gold" :checked="l.vendido"
               :data-testid="`vendido-${l.prod_id}`" @change="cambiar(l.prod_id, { vendido: $event.target.checked })" />
        <span class="flex-1 min-w-0">{{ l.nombre }}</span>
        <span v-if="!l.vendido" class="text-xs text-text3 whitespace-nowrap">no se vendió</span>
      </label>
      <div v-if="l.vendido" class="mt-2 grid grid-cols-[4rem_1fr] sm:grid-cols-[4rem_10rem_1fr] gap-2 items-center">
        <input type="text" inputmode="numeric" autocomplete="off" class="sv-input text-center" :value="l.cantidad ?? ''"
               :aria-label="`Cantidad de ${l.nombre}`" :data-testid="`cantidad-${l.prod_id}`"
               @input="cambiarCantidad(l.prod_id, $event.target.value)" />
        <CampoPesos :model-value="l.precio_unitario" :etiqueta="`Precio por unidad de ${l.nombre}`"
                    :data-testid="`precio-${l.prod_id}`" @update:model-value="cambiar(l.prod_id, { precio_unitario: $event })" />
        <span :data-testid="`subtotal-${l.prod_id}`"
              class="col-span-2 sm:col-span-1 text-right text-sm font-semibold text-text1 whitespace-nowrap">{{ fmtCOP(subtotal(l)) }}</span>
      </div>
    </div>

    <select data-testid="agregar-producto" aria-label="Agregar otro producto" class="sv-input" @change="agregar">
      <option value="">+ Agregar otro producto…</option>
      <optgroup v-for="g in grupos" :key="g.titulo" :label="g.titulo">
        <option v-for="p in g.productos" :key="p.prod_id" :value="p.prod_id">{{ p.prod_nombre }}</option>
      </optgroup>
    </select>

    <div class="flex items-center justify-between border-t border-text3/15 pt-2">
      <span class="text-sm font-semibold text-text1">Total de la venta</span>
      <span data-testid="total-venta" class="text-lg font-bold text-sage">{{ fmtCOP(total) }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 4:** los mismos specs → PASS (26).
- [ ] **Step 5: Commit** `feat(ventas): campo de pesos y productos vendidos`

---

### Task 6: Cerrar el contrato desde la gestión

Directorio: **FRONT**.

**Files:** Modify `src/components/crm/RegistrarGestion.vue`. Test `src/components/crm/__tests__/RegistrarGestion.venta.spec.js`.

**Interfaces:** Consumes la Task 5 y `POST /gestiones` / `registrarVisita` con `venta`.

- [ ] **Step 1: Write the failing test**

`src/components/crm/__tests__/RegistrarGestion.venta.spec.js` (nuevo):

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/salasApi', () => ({ salasApi: { registrarVisita: vi.fn() } }));
vi.mock('@/api/prospectosApi', () => ({ prospectosApi: { actualizarProductos: vi.fn() } }));
vi.mock('@/api/ventasApi', () => ({ ventasApi: { deProspecto: vi.fn() } }));

import { salasApi } from '@/api/salasApi';
import { ventasApi } from '@/api/ventasApi';
import { useConfigStore } from '@/stores/useConfigStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import { useToastStore } from '@/stores/useToastStore';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import ProductosVendidos from '@/components/crm/ProductosVendidos.vue';

const prod = (prod_id, prod_nombre, prod_precio_base, extra = {}) => ({
  prod_id, prod_nombre, prod_tipo: 'Osarios', prod_categoria: 'Mausoleos', prod_area_id: 1, prod_activo: 1,
  prod_orden_display: prod_id, prod_es_generico: 0, prod_precio_base, ...extra
});
const PRODUCTOS = [prod(1, 'Osarios', null, { prod_es_generico: 1 }), prod(2, 'Osario A2', '8770000.00'), prod(3, 'Osario F1', '6380000.00')];
const ESTADOS = [
  { estado_id: 11, estado_grupo_id: 1, estado_activo: 1, estado_orden: 2, estado_nombre: 'Contactado', estado_es_ganado: 0 },
  { estado_id: 15, estado_grupo_id: 1, estado_activo: 1, estado_orden: 5, estado_nombre: 'Contrato cerrado', estado_es_ganado: 1 }
];
const RESULTADOS = [
  { resultado_id: 3, resultado_codigo: 'INTERESADO_INFO', resultado_grupo_id: 1, resultado_activo: 1, resultado_orden: 1, resultado_nombre: 'Interesado' },
  { resultado_id: 7, resultado_codigo: 'CONTRATO', resultado_grupo_id: 1, resultado_activo: 1, resultado_orden: 7, resultado_nombre: 'Contrato firmado' }
];
const PROSPECTO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1,
  persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' },
  productos: [
    { pp_prod_id: 1, pp_es_principal: 1, pp_precio_ofrecido: null, producto: PRODUCTOS[0] },
    { pp_prod_id: 2, pp_es_principal: 0, pp_precio_ofrecido: '8000000.00', producto: PRODUCTOS[1] }
  ]
};

async function abrir(props = {}, productos = PRODUCTOS) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore(pinia).actual = { productos, estados: ESTADOS, resultados: RESULTADOS };
  const w = mount(RegistrarGestion, {
    props: { open: false, prospecto: PROSPECTO, ...props },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await w.setProps({ open: true });
  return { w, gestiones: useGestionesStore(pinia), toast: useToastStore(pinia) };
}
// Selects: canal (solo fuera de sala), resultado, estado.
const selects = (w) => w.findAll('form > div select, form select').filter((s) => !s.attributes('data-testid'));
const resultado = (w) => selects(w).at(-2);
const estado = (w) => selects(w).at(-1);
async function cerrarContrato(w) {
  await resultado(w).setValue('3');
  await estado(w).setValue('15');
  await flushPromises();
}
async function registrar(w) {
  await w.findAll('button').find((b) => b.text().trim() === 'Registrar').trigger('click');
  await flushPromises();
}
const plano = (x) => x.text().replace(/\s+/g, ' ').trim();

describe('RegistrarGestion: cerrar el contrato', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ventasApi.deProspecto.mockResolvedValue({ data: [] });
  });

  it('muestra la venta en vez de los intereses, con lo que se le ofreció', async () => {
    const { w } = await abrir();
    expect(w.find('[data-testid="venta"]').exists()).toBe(false);
    await cerrarContrato(w);
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('8.000.000');
    expect(plano(w.get('[data-testid="por-definir"]'))).toContain('Falta definir: Osarios.');
    expect(w.text()).not.toContain('Productos de interés');
  });

  it('envía la venta con la gestión', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await cerrarContrato(w);
    await w.get('[data-testid="cantidad-2"]').setValue('2');
    await registrar(w);
    expect(gestiones.registrar.mock.calls[0][0]).toEqual(expect.objectContaining({
      gest_prosp_id: 900, gest_estado_nuevo_id: 15, venta: { items: [{ prod_id: 2, cantidad: 2, precio_unitario: 8000000 }] }
    }));
  });

  it('si falta algo avisa y no envía', async () => {
    const { w, gestiones, toast } = await abrir();
    await cerrarContrato(w);
    await w.get('[data-testid="vendido-2"]').setValue(false);
    await registrar(w);
    expect(toast.warning).toHaveBeenCalledWith('Marca al menos un producto vendido');
    expect(gestiones.registrar).not.toHaveBeenCalled();
  });

  it('las demás gestiones no llevan venta', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await cerrarContrato(w);
    await estado(w).setValue('11');
    await registrar(w);
    expect(gestiones.registrar.mock.calls[0][0]).not.toHaveProperty('venta');
  });

  it('cambiar de estado y volver conserva lo escrito', async () => {
    const { w } = await abrir();
    await cerrarContrato(w);
    await w.get('[data-testid="precio-2"] input').setValue('7500000');
    await estado(w).setValue('11');
    await estado(w).setValue('15');
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('7.500.000');
    expect(w.findAll('[data-testid^="linea-"]')).toHaveLength(1);
  });

  it('al abrir de nuevo no queda nada de la venta anterior', async () => {
    const { w } = await abrir();
    await cerrarContrato(w);
    await w.get('[data-testid="precio-2"] input').setValue('1');
    await w.setProps({ open: false });
    await w.setProps({ open: true });
    await cerrarContrato(w);
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('8.000.000');
  });

  it('"Contrato firmado" pasa el estado solo a "Contrato cerrado", sin pisar uno elegido', async () => {
    const { w } = await abrir();
    await resultado(w).setValue('7');
    await flushPromises();
    expect(estado(w).element.value).toBe('15');
    expect(w.find('[data-testid="venta"]').exists()).toBe(true);

    const otra = (await abrir()).w;
    await estado(otra).setValue('11');
    await resultado(otra).setValue('7');
    expect(estado(otra).element.value).toBe('11');
  });

  it('avisa si el cliente ya tiene una venta activa', async () => {
    ventasApi.deProspecto.mockResolvedValue({ data: [
      { venta_id: 2, venta_anulada: 1, venta_total: '1.00', venta_fecha: '2026-11-20' },
      { venta_id: 1, venta_anulada: 0, venta_total: '42550000.00', venta_fecha: '2026-11-10' }
    ] });
    const { w } = await abrir();
    await cerrarContrato(w);
    expect(ventasApi.deProspecto).toHaveBeenCalledWith(900);
    expect(plano(w.get('[data-testid="venta-previa"]'))).toContain('ya tiene una venta de $ 42.550.000');
  });

  it('si no se pueden consultar las ventas, igual se puede cerrar', async () => {
    ventasApi.deProspecto.mockRejectedValue(new Error('sin red'));
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await cerrarContrato(w);
    await registrar(w);
    expect(gestiones.registrar).toHaveBeenCalledTimes(1);
  });

  it('en sala, el dueño cierra con su venta', async () => {
    salasApi.registrarVisita.mockResolvedValue({ data: { gest_id: 2 } });
    const { w } = await abrir({ homenajeSalaId: 55 });
    await cerrarContrato(w);
    await registrar(w);
    expect(salasApi.registrarVisita.mock.calls[0][1].venta).toEqual({ items: [{ prod_id: 2, cantidad: 1, precio_unitario: 8000000 }] });
  });

  it('en sala, quien visita al cliente de otro no ve "Contrato cerrado"', async () => {
    const { w } = await abrir({ homenajeSalaId: 55, resumenCliente: { duenio_nombre: 'Otro', estado_nombre: 'Contactado' } });
    expect(estado(w).text()).not.toContain('Contrato cerrado');
    await resultado(w).setValue('7');
    expect(estado(w).element.value).toBe('');
    expect(w.findComponent(ProductosVendidos).exists()).toBe(false);
  });

  it('en un área sin tipos no pide venta ni cambia el estado solo', async () => {
    const { w, gestiones } = await abrir({}, [prod(2, 'Plan', '1.00', { prod_tipo: null })]);
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await resultado(w).setValue('7');
    expect(estado(w).element.value).toBe('');
    await cerrarContrato(w);
    expect(w.find('[data-testid="venta"]').exists()).toBe(false);
    await registrar(w);
    expect(gestiones.registrar.mock.calls[0][0]).not.toHaveProperty('venta');
  });
});
```

- [ ] **Step 2:** `npx vitest run src/components/crm/__tests__/RegistrarGestion.venta.spec.js` → FAIL.
- [ ] **Step 3: Implementar**

Aplica con `git apply` este diff, sin cambiarlo:

```diff
--- a/src/components/crm/RegistrarGestion.vue
+++ b/src/components/crm/RegistrarGestion.vue
@@ -17,8 +17,10 @@
 import { useApiError } from '@/composables/useApiError';
 import { prospectosApi } from '@/api/prospectosApi';
 import { salasApi } from '@/api/salasApi';
+import { ventasApi } from '@/api/ventasApi';
 import { tieneTipos } from '@/utils/catalogoProductos';
-import { fmtFecha, fmtFechaHora } from '@/utils/format';
+import { lineasIniciales, porDefinir, errorVenta, itemsVenta } from '@/utils/ventas';
+import { fmtCOP, fmtFecha, fmtFechaHora } from '@/utils/format';
 
 import BaseModal from '@/components/ui/BaseModal.vue';
 import BaseSelect from '@/components/ui/BaseSelect.vue';
@@ -26,6 +28,7 @@
 import BaseTextarea from '@/components/ui/BaseTextarea.vue';
 import BaseButton from '@/components/ui/BaseButton.vue';
 import SelectorProductos from '@/components/crm/SelectorProductos.vue';
+import ProductosVendidos from '@/components/crm/ProductosVendidos.vue';
 
 const props = defineProps({
   open: { type: Boolean, required: true },
@@ -113,9 +116,39 @@
 const opcEstados = computed(() => [
   { value: '', label: '— sin cambio —' },
   ...estadosDelGrupo.value
+    // Quien visita en sala al cliente de otro asesor no puede cerrarle el contrato.
+    .filter(e => !(props.resumenCliente && e.estado_es_ganado))
     .sort((a, b) => a.estado_orden - b.estado_orden)
     .map(e => ({ value: e.estado_id, label: e.estado_nombre }))
 ]);
+
+// ─── Venta al cerrar el contrato (áreas con catálogo por tipos) ───
+const estadoGanado = computed(() => estadosDelGrupo.value.find(e => e.estado_es_ganado));
+const cierra = computed(() => conProductos.value && conTipos.value
+  && !!estadosDelGrupo.value.find(e => e.estado_id === parseInt(form.value.gest_estado_nuevo_id))?.estado_es_ganado);
+const lineasVenta = ref([]);
+const ventaPrevia = ref(null);
+
+// "Contrato firmado" sin cambio de estado no contaba como contrato: el estado pasa solo.
+watch(() => form.value.gest_resultado_id, () => {
+  if (conProductos.value && conTipos.value && resultadoSeleccionado.value?.resultado_codigo === 'CONTRATO'
+      && !form.value.gest_estado_nuevo_id && estadoGanado.value) {
+    form.value.gest_estado_nuevo_id = estadoGanado.value.estado_id;
+  }
+});
+
+watch(cierra, async (v) => {
+  if (!v) return;
+  // Si cambia de estado y vuelve, conserva lo que ya había escrito.
+  const puestas = new Set(lineasVenta.value.map(l => l.prod_id));
+  lineasVenta.value = [...lineasVenta.value,
+    ...lineasIniciales(productosSel.value, productosDisponibles.value, props.prospecto?.productos).filter(l => !puestas.has(l.prod_id))];
+  const prospId = props.prospecto?.prosp_id;
+  try {
+    const ventas = (await ventasApi.deProspecto(prospId)).data || [];
+    if (prospId === props.prospecto?.prosp_id) ventaPrevia.value = ventas.find(x => !x.venta_anulada) || null;
+  } catch { /* es solo un aviso: sin él se puede cerrar igual */ }
+});
 
 const opcCanales = [
   { value: 'llamada',    label: '📞 Llamada' },
@@ -135,6 +168,8 @@
     productosSel.value = JSON.parse(JSON.stringify(actuales));
     productosOriginales.value = JSON.parse(JSON.stringify(actuales));
     editandoProductos.value = false;
+    lineasVenta.value = [];
+    ventaPrevia.value = null;
   }
 });
 
@@ -187,6 +222,10 @@
   if (principales > 1) {
     toast.warning('Solo puede haber un producto principal'); return;
   }
+  if (cierra.value) {
+    const falta = errorVenta(lineasVenta.value);
+    if (falta) { toast.warning(falta); return; }
+  }
   saving.value = true;
   try {
     // 1) Si los productos cambiaron, guardarlos primero
@@ -203,6 +242,7 @@
       gest_prox_fecha: form.value.gest_prox_fecha || null,
       gest_prox_hora:  form.value.gest_prox_hora || null
     };
+    if (cierra.value) base.venta = { items: itemsVenta(lineasVenta.value) };
     let g;
     if (modoSala.value) {
       g = (await salasApi.registrarVisita(props.homenajeSalaId, base)).data;
@@ -282,8 +322,18 @@
         </div>
       </div>
 
+      <!-- Venta: reemplaza a los intereses mientras se cierra el contrato -->
+      <div v-if="cierra" data-testid="venta" class="border-t border-text3/10 pt-3 space-y-2">
+        <div class="text-sm font-semibold text-text1">🧾 Productos vendidos</div>
+        <p v-if="ventaPrevia" data-testid="venta-previa" class="text-xs text-warning">
+          Este cliente ya tiene una venta de {{ fmtCOP(Number(ventaPrevia.venta_total)) }} del {{ fmtFecha(ventaPrevia.venta_fecha) }}. Si registras otra, se suman.
+        </p>
+        <ProductosVendidos v-model="lineasVenta" :productos="productosDisponibles"
+                           :por-definir="porDefinir(productosSel, productosDisponibles)" />
+      </div>
+
       <!-- Editor de productos de interés -->
-      <div v-if="conProductos" class="border-t border-text3/10 pt-3">
+      <div v-else-if="conProductos" class="border-t border-text3/10 pt-3">
         <div class="flex items-center justify-between mb-2">
           <div>
             <div class="text-sm font-semibold text-text1">🛒 Productos de interés</div>
```

- [ ] **Step 4:** el mismo spec, `RegistrarGestion.sala.spec.js` y `RegistrarGestion.productos.spec.js` → PASS.
- [ ] **Step 5: Commit** `feat(ventas): registrar lo vendido al cerrar el contrato`

---

### Task 7: Ventas en la ficha

Directorio: **FRONT**.

**Files:** Create `src/components/crm/CambiarVentaModal.vue`, `src/components/crm/VentasCliente.vue`. Modify `src/views/prenecesidad/FichaCliente.vue` y los stubs de `FichaCliente.productos.spec.js` y `FichaCliente.sala.spec.js` (sin ellos la prueba saldría a la red). Test `src/components/crm/__tests__/VentasCliente.spec.js`, `src/views/prenecesidad/__tests__/FichaCliente.ventas.spec.js`.

**Interfaces:** Consumes la Task 5 y las rutas de la Task 3. `VentasCliente`: props `prospId`, `productos`, `puedeCorregir`, `version`.

- [ ] **Step 1: Write the failing tests**

`src/components/crm/__tests__/VentasCliente.spec.js` (nuevo):

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/ventasApi', () => ({ ventasApi: { deProspecto: vi.fn(), corregir: vi.fn(), anular: vi.fn() } }));

import { ventasApi } from '@/api/ventasApi';
import { useToastStore } from '@/stores/useToastStore';
import VentasCliente from '@/components/crm/VentasCliente.vue';
import CambiarVentaModal from '@/components/crm/CambiarVentaModal.vue';

const DENIS = { usr_nombre: 'Denis', usr_apellido: 'Moreno' };
const ANA = { usr_nombre: 'Ana', usr_apellido: 'Ruiz' };
const ACTIVA = {
  venta_id: 40, venta_fecha: '2026-11-24', venta_total: '17000000.00', venta_anulada: 0, asesor: DENIS,
  items: [{ vi_id: 1, vi_prod_id: 2, vi_cantidad: 2, vi_precio_unitario: '8500000.00', producto: { prod_nombre: 'Osario A2' } }],
  cambios: [{ vc_id: 9, vc_accion: 'corregir', vc_motivo: 'precio mal', vc_total_antes: '9000000.00', vc_total_despues: '17000000.00', usuario: ANA, vc_created_at: '2026-11-24T10:00:00' }]
};
const ANULADA = {
  ...ACTIVA, venta_id: 39, venta_total: '8770000.00', venta_anulada: 1,
  cambios: [{ vc_id: 8, vc_accion: 'anular', vc_motivo: 'el cliente desistió', vc_total_antes: '8770000.00', vc_total_despues: '0.00', usuario: ANA, vc_created_at: '2026-11-12T10:00:00' }]
};
const PRODUCTOS = [{ prod_id: 2, prod_nombre: 'Osario A2', prod_categoria: 'Mausoleos', prod_tipo: 'Osarios', prod_precio_base: '8770000.00', prod_es_generico: 0 }];
const plano = (x) => x.text().replace(/\s+/g, ' ').trim();
const boton = (w, t) => w.findAll('button').find((b) => b.text().trim() === t);

async function montar(props = {}, ventas = [ACTIVA, ANULADA]) {
  ventasApi.deProspecto.mockResolvedValue({ data: ventas });
  const pinia = createTestingPinia({ createSpy: vi.fn });
  const w = mount(VentasCliente, {
    props: { prospId: 900, productos: PRODUCTOS, puedeCorregir: true, ...props },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await flushPromises();
  return { w, toast: useToastStore(pinia) };
}

describe('VentasCliente', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin ventas no muestra nada', async () => {
    expect((await montar({}, [])).w.find('[data-testid="ventas"]').exists()).toBe(false);
  });

  it('muestra fecha, asesor, productos, total, correcciones y anulación', async () => {
    const { w } = await montar();
    const activa = plano(w.get('[data-testid="venta-40"]'));
    expect(activa).toContain('Denis Moreno');
    expect(activa).toContain('$ 17.000.000');
    expect(activa).toContain('2 × Osario A2 · $ 8.500.000');
    expect(activa).toContain('Corregida de $ 9.000.000 a $ 17.000.000: precio mal · Ana Ruiz');
    expect(plano(w.get('[data-testid="venta-39"] [data-testid="anulada"]'))).toContain('Anulada: el cliente desistió · Ana Ruiz');
  });

  it('solo quien puede corregir ve los botones, y no en una anulada', async () => {
    const { w } = await montar();
    expect(w.get('[data-testid="venta-40"]').findAll('button')).toHaveLength(2);
    expect(w.get('[data-testid="venta-39"]').findAll('button')).toHaveLength(0);
    expect((await montar({ puedeCorregir: false })).w.findAll('article button')).toHaveLength(0);
  });

  it('recarga al cambiar de cliente o de versión', async () => {
    const { w } = await montar();
    await w.setProps({ version: 1 });
    await w.setProps({ prospId: 901 });
    expect(ventasApi.deProspecto.mock.calls.map((c) => c[0])).toEqual([900, 900, 901]);
  });

  it('una respuesta que llega tarde de otro cliente no se muestra', async () => {
    let tarde;
    const { w } = await montar({}, []);
    ventasApi.deProspecto.mockImplementationOnce(() => new Promise((r) => { tarde = r; })).mockResolvedValueOnce({ data: [] });
    await w.setProps({ prospId: 901 });
    await w.setProps({ prospId: 902 });
    tarde({ data: [ACTIVA] });
    await flushPromises();
    expect(w.find('[data-testid="ventas"]').exists()).toBe(false);
  });

  it('corregir envía los productos, el motivo y los cambios vistos, y recarga', async () => {
    const { w } = await montar();
    ventasApi.corregir.mockResolvedValue({ data: {} });
    await boton(w, 'Corregir').trigger('click');
    await w.get('[data-testid="cantidad-2"]').setValue('1');
    await w.get('textarea').setValue('  era uno  ');
    await boton(w, 'Guardar corrección').trigger('click');
    await flushPromises();
    expect(ventasApi.corregir).toHaveBeenCalledWith(40, { items: [{ prod_id: 2, cantidad: 1, precio_unitario: 8500000 }], motivo: 'era uno', cambios_vistos: 1 });
    expect(ventasApi.deProspecto).toHaveBeenCalledTimes(2);
    expect(w.findComponent(CambiarVentaModal).props('venta')).toBeNull();
  });

  it('anular pide motivo y avisa que el estado del cliente no cambia', async () => {
    const { w, toast } = await montar();
    ventasApi.anular.mockResolvedValue({ data: {} });
    await boton(w, 'Anular').trigger('click');
    expect(w.text()).toContain('El estado del cliente no cambia');
    await boton(w, 'Anular venta').trigger('click');
    expect(toast.warning).toHaveBeenCalledWith('Escribe el motivo');
    expect(ventasApi.anular).not.toHaveBeenCalled();
    await w.get('textarea').setValue('desistió');
    await boton(w, 'Anular venta').trigger('click');
    await flushPromises();
    expect(ventasApi.anular).toHaveBeenCalledWith(40, { motivo: 'desistió', cambios_vistos: 1 });
  });

  it('una corrección incompleta no se envía', async () => {
    const { w, toast } = await montar();
    await boton(w, 'Corregir').trigger('click');
    await w.get('[data-testid="vendido-2"]').setValue(false);
    await w.get('textarea').setValue('motivo');
    await boton(w, 'Guardar corrección').trigger('click');
    expect(toast.warning).toHaveBeenCalledWith('Marca al menos un producto vendido');
    expect(ventasApi.corregir).not.toHaveBeenCalled();
  });

  it('si otra persona la cambió (409), recarga y cierra; con otro error deja la ventana abierta', async () => {
    const { w } = await montar();
    ventasApi.anular.mockRejectedValueOnce({ response: { status: 500, data: {} } }).mockRejectedValueOnce({ response: { status: 409, data: { message: 'Otra persona…' } } });
    await boton(w, 'Anular').trigger('click');
    await w.get('textarea').setValue('desistió');
    await boton(w, 'Anular venta').trigger('click');
    await flushPromises();
    expect(w.findComponent(CambiarVentaModal).props('venta')).not.toBeNull();
    expect(ventasApi.deProspecto).toHaveBeenCalledTimes(1);
    await boton(w, 'Anular venta').trigger('click');
    await flushPromises();
    expect(w.findComponent(CambiarVentaModal).props('venta')).toBeNull();
    expect(ventasApi.deProspecto).toHaveBeenCalledTimes(2);
  });
});
```

`src/views/prenecesidad/__tests__/FichaCliente.ventas.spec.js` (nuevo):

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '900' }, query: {} }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' }
}));
vi.mock('@/api/salasApi', () => ({ salasApi: { obtener: vi.fn() } }));
vi.mock('@/api/personasApi', () => ({ personasApi: { prospectosActivos: vi.fn(async () => ({ data: [] })) } }));

import { useAuthStore } from '@/stores/useAuthStore';
import { useConfigStore } from '@/stores/useConfigStore';
import FichaCliente from '@/views/prenecesidad/FichaCliente.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import VentasCliente from '@/components/crm/VentasCliente.vue';

const ACTIVO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1, prosp_persona_id: 500, prosp_prioridad: 3, productos: [],
  persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' }, asesor: {}, estado: { estado_nombre: 'Nuevo' }
};

async function montar(rol) {
  const pinia = createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo: ACTIVO } } });
  useAuthStore(pinia).puedeReasignar = rol === 'SUPERVISOR';
  useConfigStore(pinia).actual = { productos: [
    { prod_id: 2, prod_area_id: 1, prod_activo: 1 }, { prod_id: 3, prod_area_id: 1, prod_activo: 0 }, { prod_id: 4, prod_area_id: 2, prod_activo: 1 }
  ] };
  const w = mount(FichaCliente, {
    global: {
      plugins: [pinia],
      stubs: { teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true,
        ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true, VentasCliente: true }
    }
  });
  await flushPromises();
  return w;
}

describe('FichaCliente: ventas', () => {
  it('pasa el cliente, el catálogo activo del área y si puede corregir', async () => {
    const v = (await montar('SUPERVISOR')).findComponent(VentasCliente);
    expect(v.props('prospId')).toBe(900);
    expect(v.props('productos').map((p) => p.prod_id)).toEqual([2]);
    expect(v.props('puedeCorregir')).toBe(true);
    expect((await montar('ASESOR')).findComponent(VentasCliente).props('puedeCorregir')).toBe(false);
  });

  it('al registrar una gestión recarga las ventas', async () => {
    const w = await montar('ASESOR');
    const antes = w.findComponent(VentasCliente).props('version');
    w.findComponent(RegistrarGestion).vm.$emit('registrada', {});
    await flushPromises();
    expect(w.findComponent(VentasCliente).props('version')).toBe(antes + 1);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/components/crm/__tests__/VentasCliente.spec.js src/views/prenecesidad/__tests__/FichaCliente.ventas.spec.js` → FAIL.
- [ ] **Step 3: Implementar**

`src/components/crm/CambiarVentaModal.vue` (nuevo):

```vue
<script setup>
/**
 * CambiarVentaModal.vue — el supervisor corrige o anula una venta, con motivo.
 * Props: venta (fila de la API, o null = cerrada), modo 'corregir' | 'anular', productos.
 * Emits: close, cambiada.
 */
import { ref, computed, watch } from 'vue';
import { ventasApi } from '@/api/ventasApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { errorVenta, itemsVenta, lineasDeVenta } from '@/utils/ventas';
import { fmtCOP, fmtFecha } from '@/utils/format';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import ProductosVendidos from '@/components/crm/ProductosVendidos.vue';

const props = defineProps({
  venta: { type: Object, default: null },
  modo: { type: String, default: 'corregir' },
  productos: { type: Array, default: () => [] }
});
const emit = defineEmits(['close', 'cambiada']);

const toast = useToastStore();
const { notify } = useApiError();
const lineas = ref([]);
const motivo = ref('');
const guardando = ref(false);
const anula = computed(() => props.modo === 'anular');

watch(() => [props.venta, props.modo], () => {
  lineas.value = lineasDeVenta(props.venta);
  motivo.value = '';
}, { immediate: true });

async function guardar() {
  const falta = anula.value ? '' : errorVenta(lineas.value);
  if (falta) { toast.warning(falta); return; }
  if (motivo.value.trim().length < 3) { toast.warning('Escribe el motivo'); return; }

  const datos = { motivo: motivo.value.trim(), cambios_vistos: (props.venta.cambios || []).length };
  guardando.value = true;
  try {
    if (anula.value) await ventasApi.anular(props.venta.venta_id, datos);
    else await ventasApi.corregir(props.venta.venta_id, { items: itemsVenta(lineas.value), ...datos });
    toast.success(anula.value ? 'Venta anulada' : 'Venta corregida');
    emit('cambiada');
    emit('close');
  } catch (e) {
    notify(e);
    // Otra persona la cambió: se recarga la lista para que vea el valor actual.
    if (e?.response?.status === 409) { emit('cambiada'); emit('close'); }
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <BaseModal :open="!!venta" :title="anula ? 'Anular venta' : 'Corregir venta'" max-width="max-w-xl" @close="emit('close')">
    <div v-if="venta" class="space-y-4">
      <p class="text-sm text-text2">
        Venta del {{ fmtFecha(venta.venta_fecha) }} por <strong>{{ fmtCOP(Number(venta.venta_total)) }}</strong>.
      </p>
      <p v-if="anula" class="text-sm text-warning">
        Dejará de sumar y de contar como contrato. El estado del cliente no cambia: si vuelve a proceso, registra una gestión.
      </p>
      <ProductosVendidos v-else v-model="lineas" :productos="productos" />
      <BaseTextarea v-model="motivo" label="Motivo *" rows="2" />
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton :variant="anula ? 'danger' : 'primary'" :loading="guardando" @click="guardar">
        {{ anula ? 'Anular venta' : 'Guardar corrección' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
```

`src/components/crm/VentasCliente.vue` (nuevo):

```vue
<script setup>
/**
 * VentasCliente.vue — tarjeta "Ventas" de la ficha. No se muestra si el cliente no tiene.
 * Props: prospId, productos (catálogo del área), puedeCorregir, version (al cambiar, recarga).
 */
import { ref, watch } from 'vue';
import { ventasApi } from '@/api/ventasApi';
import { useApiError } from '@/composables/useApiError';
import { fmtCOP, fmtFecha } from '@/utils/format';
import BaseButton from '@/components/ui/BaseButton.vue';
import CambiarVentaModal from '@/components/crm/CambiarVentaModal.vue';

const props = defineProps({
  prospId: { type: Number, required: true },
  productos: { type: Array, default: () => [] },
  puedeCorregir: { type: Boolean, default: false },
  version: { type: Number, default: 0 }
});

const { notify } = useApiError();
const ventas = ref([]);
const enCambio = ref(null);
const modo = ref('corregir');

async function cargar() {
  const id = props.prospId;
  try {
    const r = await ventasApi.deProspecto(id);
    if (id === props.prospId) ventas.value = r.data || [];
  } catch (e) {
    if (id === props.prospId) ventas.value = [];
    notify(e);
  }
}
watch(() => [props.prospId, props.version], cargar, { immediate: true });

function abrir(venta, queModo) { modo.value = queModo; enCambio.value = venta; }
const persona = (u) => [u?.usr_nombre, u?.usr_apellido].filter(Boolean).join(' ') || '—';
const anulacion = (v) => (v.cambios || []).find((c) => c.vc_accion === 'anular');
const correcciones = (v) => (v.cambios || []).filter((c) => c.vc_accion === 'corregir');
</script>

<template>
  <section v-if="ventas.length" data-testid="ventas" class="sv-card p-4 mb-4">
    <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">🧾 Ventas</h3>
    <article v-for="v in ventas" :key="v.venta_id" :data-testid="`venta-${v.venta_id}`"
             class="py-3 border-t border-text3/10 first:border-t-0 first:pt-0" :class="{ 'opacity-60': v.venta_anulada }">
      <div class="flex items-baseline justify-between gap-3">
        <div class="text-sm text-text2">{{ fmtFecha(v.venta_fecha) }} · {{ persona(v.asesor) }}</div>
        <div class="font-semibold whitespace-nowrap" :class="v.venta_anulada ? 'line-through text-text3' : 'text-sage'">{{ fmtCOP(Number(v.venta_total)) }}</div>
      </div>
      <ul class="text-xs text-text3 mt-1 space-y-0.5">
        <li v-for="i in v.items" :key="i.vi_id">{{ i.vi_cantidad }} × {{ i.producto?.prod_nombre || 'Producto no disponible' }} · {{ fmtCOP(Number(i.vi_precio_unitario)) }}</li>
      </ul>
      <p v-for="c in correcciones(v)" :key="c.vc_id" class="text-xs text-text3 mt-1">
        Corregida de {{ fmtCOP(Number(c.vc_total_antes)) }} a {{ fmtCOP(Number(c.vc_total_despues)) }}: {{ c.vc_motivo }} · {{ persona(c.usuario) }}, {{ fmtFecha(c.vc_created_at) }}
      </p>
      <p v-if="v.venta_anulada" data-testid="anulada" class="text-xs text-danger mt-1">
        Anulada<template v-if="anulacion(v)">: {{ anulacion(v).vc_motivo }} · {{ persona(anulacion(v).usuario) }}, {{ fmtFecha(anulacion(v).vc_created_at) }}</template>
      </p>
      <div v-else-if="puedeCorregir" class="flex justify-end gap-2 mt-2">
        <BaseButton variant="ghost" size="sm" @click="abrir(v, 'corregir')">Corregir</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="abrir(v, 'anular')">Anular</BaseButton>
      </div>
    </article>

    <CambiarVentaModal :venta="enCambio" :modo="modo" :productos="productos" @close="enCambio = null" @cambiada="cargar" />
  </section>
</template>
```

Aplica con `git apply` este diff, sin cambiarlo:

```diff
--- a/src/views/prenecesidad/FichaCliente.vue
+++ b/src/views/prenecesidad/FichaCliente.vue
@@ -4,6 +4,7 @@
 import { useProspectosStore } from '@/stores/useProspectosStore';
 import { useGestionesStore } from '@/stores/useGestionesStore';
 import { useAuthStore } from '@/stores/useAuthStore';
+import { useConfigStore } from '@/stores/useConfigStore';
 import { useApiError } from '@/composables/useApiError';
 import { useTelefono } from '@/composables/useTelefono';
 import { personasApi } from '@/api/personasApi';
@@ -17,6 +18,7 @@
 import QuickActionRow from '@/components/common/QuickActionRow.vue';
 import BaseButton from '@/components/ui/BaseButton.vue';
 import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
+import VentasCliente from '@/components/crm/VentasCliente.vue';
 import AgendarProximaModal from '@/components/crm/AgendarProximaModal.vue';
 import ProspectosCrossArea from '@/components/crm/ProspectosCrossArea.vue';
 import ReasignarProspectoModal from '@/components/crm/ReasignarProspectoModal.vue';
@@ -26,6 +28,7 @@
 const store  = useProspectosStore();
 const gestiones = useGestionesStore();
 const auth = useAuthStore();
+const config = useConfigStore();
 const { notify } = useApiError();
 
 const otrosProspectos = ref([]);
@@ -57,8 +60,14 @@
 const persona = computed(() => p.value?.persona);
 const historial = computed(() => gestiones.historial.get(parseInt(route.params.id)) || { items: [], hasMore: false, loading: false });
 
+// Catálogo para corregir una venta, y aviso a la tarjeta de ventas de que debe recargar.
+const productosArea = computed(() => (config.actual?.productos || [])
+  .filter((x) => x.prod_area_id === p.value?.prosp_area_id && x.prod_activo));
+const versionVentas = ref(0);
+
 async function cargar() {
   const id = parseInt(route.params.id);
+  versionVentas.value += 1;
   try {
     await store.fetchOne(id);
     await gestiones.fetchHistorial(id, { reset: true });
@@ -177,6 +186,8 @@
         </div>
       </section>
 
+      <VentasCliente :prosp-id="p.prosp_id" :productos="productosArea" :puede-corregir="auth.puedeReasignar" :version="versionVentas" />
+
       <!-- Nota inicial -->
       <section v-if="p.prosp_nota_inicial" class="sv-card p-4 mb-4">
         <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">Nota inicial</h3>
--- a/src/views/prenecesidad/__tests__/FichaCliente.productos.spec.js
+++ b/src/views/prenecesidad/__tests__/FichaCliente.productos.spec.js
@@ -30,7 +30,7 @@
   const w = mount(FichaCliente, {
     global: {
       plugins: [createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo } } })],
-      stubs: { teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true, ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true }
+      stubs: { teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true, ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true, VentasCliente: true }
     }
   });
   await flushPromises();
--- a/src/views/prenecesidad/__tests__/FichaCliente.sala.spec.js
+++ b/src/views/prenecesidad/__tests__/FichaCliente.sala.spec.js
@@ -34,7 +34,7 @@
       plugins: [createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo: PROSPECTO } } })],
       stubs: {
         teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true,
-        ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true
+        ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true, VentasCliente: true
       }
     }
   });
```

- [ ] **Step 4:** los mismos specs y `src/views/prenecesidad` → PASS, sin intentos de red (`ECONNRESET`).
- [ ] **Step 5: Commit** `feat(ventas): ventas en la ficha, con corrección y anulación`

---

### Task 8: Valor vendido para el supervisor

Directorio: **FRONT**.

**Files:** Modify `src/utils/format.js`, `src/components/dashboard/TablaAsesores.vue`, `src/views/prenecesidad/PanelSupervisor.vue`, `src/views/prenecesidad/MisMetricas.vue`. Test `src/components/dashboard/__tests__/TablaAsesores.spec.js`.

**Interfaces:** Consumes `registra_ventas` y `snap_valor_vendido_cop` (Task 4). Produces `diaLocal(fecha?)` en `utils/format`.

- [ ] **Step 1: Write the failing test**

`src/components/dashboard/__tests__/TablaAsesores.spec.js` (nuevo):

```js
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import TablaAsesores from '@/components/dashboard/TablaAsesores.vue';

const FILA = { snap_id: 1, usuario: { usr_nombre: 'Denis', usr_apellido: 'M', usr_email: 'd@x' }, snap_gestiones_realizadas: 5, snap_interesados_nuevos: 2, snap_contratos_cerrados: 3, snap_vencidas_acumuladas: 0, snap_valor_vendido_cop: 9770000 };
const titulos = (w) => w.findAll('th').map((t) => t.text());
const plano = (w) => w.text().replace(/\s+/g, ' ');

describe('TablaAsesores', () => {
  it('sin metas cargadas no muestra Meta %', () => {
    const w = mount(TablaAsesores, { props: { asesores: [FILA] } });
    expect(titulos(w)).toEqual(['Asesor', 'Gestiones', 'Interesados', 'Contratos', 'Vencidas']);
    expect(plano(w)).not.toContain('%');
  });

  it('con metas sí, comparada con la meta real', () => {
    const w = mount(TablaAsesores, { props: { asesores: [{ ...FILA, meta: { meta_contratos: 12 } }] } });
    expect(titulos(w)).toContain('Meta %');
    expect(plano(w)).toContain('25%');
  });

  it('con ventas muestra lo vendido', () => {
    const w = mount(TablaAsesores, { props: { asesores: [FILA], conVentas: true } });
    expect(titulos(w)).toContain('Vendido');
    expect(plano(w)).toContain('$ 9.770.000');
  });

  it('vacía ocupa todas las columnas', () => {
    expect(mount(TablaAsesores, { props: { asesores: [] } }).get('td').attributes('colspan')).toBe('5');
    expect(mount(TablaAsesores, { props: { asesores: [], conVentas: true } }).get('td').attributes('colspan')).toBe('6');
  });
});
```

- [ ] **Step 2:** `npx vitest run src/components/dashboard` → FAIL.
- [ ] **Step 3: Implementar**

Aplica con `git apply` este diff, sin cambiarlo:

```diff
--- a/src/utils/format.js
+++ b/src/utils/format.js
@@ -33,4 +33,9 @@
   return new Intl.NumberFormat('es-CO').format(n);
 }
 
+/** Día local en formato YYYY-MM-DD. toISOString() da el de UTC: después de las 7 p. m. sería mañana. */
+export function diaLocal(d = new Date()) {
+  return dayjs(d).format('YYYY-MM-DD');
+}
+
 export { dayjs };
--- a/src/components/dashboard/TablaAsesores.vue
+++ b/src/components/dashboard/TablaAsesores.vue
@@ -1,10 +1,16 @@
 <script setup>
 import { computed } from 'vue';
+import { fmtCOP } from '@/utils/format';
 
 const props = defineProps({
-  asesores: { type: Array, default: () => [] } // [{ usuario, snap_* fields, meta }]
+  asesores: { type: Array, default: () => [] }, // [{ usuario, snap_* fields, meta }]
+  conVentas: { type: Boolean, default: false }  // el área registra el valor vendido
 });
 
+// Sin metas cargadas no hay con qué comparar: la columna no se muestra.
+const conMeta = computed(() => props.asesores.some((a) => a.meta?.meta_contratos > 0));
+const columnas = computed(() => 5 + (props.conVentas ? 1 : 0) + (conMeta.value ? 1 : 0));
+
 function pct(v, m) { return m > 0 ? Math.min(100, Math.round((v / m) * 100)) : 0; }
 </script>
 
@@ -17,8 +23,9 @@
           <th class="text-right px-4 py-3">Gestiones</th>
           <th class="text-right px-4 py-3">Interesados</th>
           <th class="text-right px-4 py-3">Contratos</th>
+          <th v-if="conVentas" class="text-right px-4 py-3">Vendido</th>
           <th class="text-right px-4 py-3">Vencidas</th>
-          <th class="text-left  px-4 py-3 min-w-[140px]">Meta %</th>
+          <th v-if="conMeta" class="text-left  px-4 py-3 min-w-[140px]">Meta %</th>
         </tr>
       </thead>
       <tbody class="divide-y divide-text3/10">
@@ -30,19 +37,20 @@
           <td class="px-4 py-3 text-right">{{ a.snap_gestiones_realizadas }}</td>
           <td class="px-4 py-3 text-right">{{ a.snap_interesados_nuevos }}</td>
           <td class="px-4 py-3 text-right font-semibold text-sage">{{ a.snap_contratos_cerrados }}</td>
+          <td v-if="conVentas" class="px-4 py-3 text-right whitespace-nowrap">{{ fmtCOP(Number(a.snap_valor_vendido_cop || 0)) }}</td>
           <td class="px-4 py-3 text-right" :class="a.snap_vencidas_acumuladas > 0 ? 'text-danger font-semibold' : 'text-text3'">
             {{ a.snap_vencidas_acumuladas }}
           </td>
-          <td class="px-4 py-3">
+          <td v-if="conMeta" class="px-4 py-3">
             <div class="flex items-center gap-2">
               <div class="flex-1 h-2 rounded-full bg-text3/15 overflow-hidden">
-                <div class="h-full rounded-full bg-gold" :style="`width: ${pct(a.snap_contratos_cerrados, a.meta?.meta_contratos || 10)}%`"></div>
+                <div class="h-full rounded-full bg-gold" :style="`width: ${pct(a.snap_contratos_cerrados, a.meta?.meta_contratos)}%`"></div>
               </div>
-              <span class="text-xs w-12 text-right">{{ pct(a.snap_contratos_cerrados, a.meta?.meta_contratos || 10) }}%</span>
+              <span class="text-xs w-12 text-right">{{ pct(a.snap_contratos_cerrados, a.meta?.meta_contratos) }}%</span>
             </div>
           </td>
         </tr>
-        <tr v-if="!asesores.length"><td colspan="6" class="text-center py-8 text-text3">Sin datos del día.</td></tr>
+        <tr v-if="!asesores.length"><td :colspan="columnas" class="text-center py-8 text-text3">Sin datos del día.</td></tr>
       </tbody>
     </table>
   </div>
--- a/src/views/prenecesidad/PanelSupervisor.vue
+++ b/src/views/prenecesidad/PanelSupervisor.vue
@@ -10,6 +10,7 @@
 import { useAuthStore } from '@/stores/useAuthStore';
 import { useApiError } from '@/composables/useApiError';
 import { reportesApi } from '@/api/reportesApi';
+import { diaLocal, fmtCOP } from '@/utils/format';
 
 import KpiCard from '@/components/dashboard/KpiCard.vue';
 import TablaAsesores from '@/components/dashboard/TablaAsesores.vue';
@@ -21,7 +22,7 @@
 const { notify } = useApiError();
 
 // Rango de fechas (default: hoy)
-const hoyISO = new Date().toISOString().slice(0, 10);
+const hoyISO = diaLocal();
 const desde = ref(hoyISO);
 const hasta = ref(hoyISO);
 const loading = ref(false);
@@ -38,8 +39,8 @@
 function aplicarPreset(dias) {
   const hoy = new Date();
   const desdeDate = new Date(hoy.getTime() - dias * 86400000);
-  desde.value = desdeDate.toISOString().slice(0, 10);
-  hasta.value = hoy.toISOString().slice(0, 10);
+  desde.value = diaLocal(desdeDate);
+  hasta.value = diaLocal(hoy);
 }
 
 const rangoLabel = computed(() => {
@@ -103,10 +104,16 @@
     gestiones:   ases.reduce((s, a) => s + (a.snap_gestiones_realizadas || 0), 0),
     interesados: ases.reduce((s, a) => s + (a.snap_interesados_nuevos || 0), 0),
     contratos:   ases.reduce((s, a) => s + (a.snap_contratos_cerrados || 0), 0),
+    valor:       ases.reduce((s, a) => s + Number(a.snap_valor_vendido_cop || 0), 0),
     vencidas:    ases.reduce((s, a) => s + (a.snap_vencidas_acumuladas || 0), 0)
   };
 });
 
+// Solo las áreas que venden por producto tienen valor vendido.
+const conVentas = computed(() => (tab.value === 'consolidado'
+  ? Array.from(dataPorGrupo.value.values())
+  : [dataPorGrupo.value.get(parseInt(tab.value))]).some((d) => d?.registra_ventas));
+
 const titulo = computed(() => {
   if (tab.value === 'consolidado') return 'Panel del Supervisor — Consolidado';
   const g = grupos.value.find(g => g.grupo_id === parseInt(tab.value));
@@ -160,10 +167,11 @@
     <div v-if="loading" class="text-text3 text-center py-12">Cargando...</div>
 
     <template v-else>
-      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
+      <div class="grid grid-cols-2 gap-3 mb-5" :class="conVentas ? 'lg:grid-cols-5' : 'lg:grid-cols-4'">
         <KpiCard label="Gestiones del día" icon="📞" :value="totales.gestiones" />
         <KpiCard label="Interesados"       icon="🎯" :value="totales.interesados" color-hex="#1A5C8A" />
         <KpiCard label="Contratos"         icon="✅" :value="totales.contratos"   color-hex="#2A6E47" />
+        <KpiCard v-if="conVentas" label="Valor vendido" icon="💰" :value="fmtCOP(totales.valor)" color-hex="#9B4F20" />
         <KpiCard label="Vencidas"          icon="🔴" :value="totales.vencidas"    color-hex="#B83227" />
       </div>
 
@@ -171,7 +179,7 @@
         Rendimiento del equipo
         <span class="text-sm text-text3 font-sans">({{ asesoresVisibles.length }} asesores)</span>
       </h2>
-      <TablaAsesores :asesores="asesoresVisibles" />
+      <TablaAsesores :asesores="asesoresVisibles" :con-ventas="conVentas" />
     </template>
 
     <CargarListaModal :open="showCargarLista" @close="showCargarLista = false" @cargada="() => { showCargarLista = false; cargar(); }" />
--- a/src/views/prenecesidad/MisMetricas.vue
+++ b/src/views/prenecesidad/MisMetricas.vue
@@ -3,7 +3,7 @@
 import { useAuthStore } from '@/stores/useAuthStore';
 import { useApiError } from '@/composables/useApiError';
 import { reportesApi } from '@/api/reportesApi';
-import { fmtCOP, fmtNumero } from '@/utils/format';
+import { diaLocal, fmtCOP, fmtNumero } from '@/utils/format';
 
 import KpiCard from '@/components/dashboard/KpiCard.vue';
 import MetaBar from '@/components/common/MetaBar.vue';
@@ -27,11 +27,11 @@
 
 function rangoPeriodo() {
   const hoy = new Date();
-  const fin = hoy.toISOString().slice(0, 10);
+  const fin = diaLocal(hoy);
   let inicio;
   switch (periodo.value) {
     case 'hoy':       inicio = fin; break;
-    case 'semana':    { const d = new Date(); d.setDate(d.getDate() - 6); inicio = d.toISOString().slice(0,10); } break;
+    case 'semana':    { const d = new Date(); d.setDate(d.getDate() - 6); inicio = diaLocal(d); } break;
     case 'mes':       inicio = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`; break;
     case 'trimestre': { const m = hoy.getMonth(); const startM = m - (m % 3); inicio = `${hoy.getFullYear()}-${String(startM+1).padStart(2,'0')}-01`; } break;
     case 'anio':      inicio = `${hoy.getFullYear()}-01-01`; break;
```

- [ ] **Step 4:** el mismo spec → PASS. Suite completa `npx vitest run` → 35 archivos y 220 pruebas en verde; `npm run build` sin errores.
- [ ] **Step 5: Commit** `feat(ventas): valor vendido en el panel y Meta % solo con metas`

---

### Ajustes de las revisiones (commits aparte)

Las revisiones de tarea encontraron tres caminos que registraban una venta equivocada (estado automático que no se deshacía, reenvío que duplicaba, cambio de cliente con la ventana abierta) y huecos menores. Se corrigieron en `33abe62` y `1267750` (backend) y `4a3af17` (GenFlow); las reglas quedaron en el spec §3 (14 a 16), §5 y §7. El código de las tareas de arriba es el anterior a esos ajustes.

---

### Task 9: Integración y despliegue (con el usuario)

**Orden obligatorio:** 027 antes de que el backend llegue a `main` (los reportes y el snapshot de las 11:55 p. m. consultan las tablas nuevas), y backend antes que GenFlow (el actual descarta la venta en silencio). Entre el backend y GenFlow, cerrar un contrato de Prenecesidad responde 422 pidiendo recargar.

- [ ] **Step 1:** `git fetch` y `git merge origin/main` en ambos; suites completas; verificar que 027 siga libre.
- [ ] **Step 2 (con confirmación):** push **solo de la rama** del backend.
- [ ] **Step 3 (usuario):** en Workbench, `USE serfuweb;` y el contenido de `027_ventas.sql`. Verificar:

```sql
SELECT TABLE_NAME, COUNT(*) AS columnas FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = 'serfuweb' AND TABLE_NAME LIKE 'sv_crm_ventas%' GROUP BY TABLE_NAME;
```

Debe dar `sv_crm_ventas` 12, `sv_crm_ventas_cambios` 9 y `sv_crm_ventas_items` 6.

- [ ] **Step 4 (con confirmación):** push del backend a `main`. **(usuario)** `deploy-mantix`; sin `doesn't exist` ni `Cannot find module` en los logs.
- [ ] **Step 5 (con confirmación):** GenFlow: merge a `main`, push, build, respaldo, `rsync --delete --exclude '.htaccess'` y paridad.
- [ ] **Step 6 (usuario), smoke:** con un cliente de prueba de Prenecesidad, elegir "Contrato firmado" y ver que el estado pasa solo; editar cantidad y precio; registrar; ver la venta en la ficha y el valor en Mis métricas (Hoy) y en el panel del supervisor. Como supervisor, corregir y después anular con motivo: el valor baja y la venta queda como anulada. En otra área, cerrar como siempre. Anular al final las ventas de prueba.
- [ ] **Reversión:** restaurar GenFlow y revertir el backend. Las tablas 027 pueden quedarse: el código anterior no las usa.
