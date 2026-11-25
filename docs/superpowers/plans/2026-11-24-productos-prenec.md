# Productos de Prenecesidad 2026 — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El asesor de Prenecesidad elige el tipo o el producto exacto de la lista 2026 como interés del cliente, y el precio ofrecido queda guardado.

**Architecture:** Los tipos y los productos viven en `sv_cfg_productos` (`prod_tipo`, `prod_es_generico`). El backend pone `pp_precio_ofrecido` al elegir y lo conserva al editar. En GenFlow, la lógica de agrupar, buscar y alternar está en un módulo puro (`catalogoProductos.js`), y `SelectorProductos.vue` la usa en los dos formularios cuando el catálogo del área tiene tipos.

**Tech Stack:** Express 4, Sequelize 6.37, MySQL 8, Jest 29. Vue 3 (script setup), Pinia, Vitest, @vue/test-utils, @pinia/testing.

**Spec:** `crm-frontend/docs/superpowers/specs/2026-11-24-productos-prenec-design.md`

## Global Constraints

- Backend: pruebas solo con `jest.mock`; nunca `sequelize.sync` ni conexión a la base, porque la única es la de producción compartida.
- El precio ofrecido lo decide el servidor. Nunca se toma del cliente.
- Las áreas sin productos con tipo conservan exactamente su pantalla y su comportamiento.
- Textos exactos: "por definir", "Sin elegir", "Ningún producto coincide. Prueba con otra palabra.", "Osario A2, cremación plus…" (placeholder del buscador), "Producto no disponible".
- Precios con `fmtCOP` de `src/utils/format.js`; un valor nulo, vacío o 0 no se muestra.
- GenFlow: specs con `createTestingPinia`, `stubs: { teleport: true }` y carpetas `__tests__`.
- Cada subagente firma sus commits con su propio modelo (`Co-Authored-By: <modelo> <noreply@anthropic.com>`).
- BACK = `/Users/bortega/Shared/Files From c.localized/apps/mantix/.wt/mantix-backend-productos` (Tasks 1, 2 y 7). FRONT = `/Users/bortega/Shared/Files From c.localized/apps/mantix/.wt/crm-frontend-productos` (Tasks 3 a 6). Ambos en la rama `feat/productos-prenec`. No se toca ningún otro checkout. Sin push ni despliegue salvo pedido del usuario.
- Cinco suites del backend fallan desde antes: `test/grupoIndivII`, `tests/invitacion.service`, `src/masajes/__tests__/adapters`, `src/masajes/__tests__/adapters.n8n` y `tests/afiliadoEmpresaAccess`.

---

### Task 1: Migración 025, modelos y validación del catálogo

Directorio: **BACK**.

**Files:**
- Create: `src/sv/migrations/025_productos_tipo_precio.sql`
- Modify: `src/sv/models/Producto.js`, `src/sv/models/ProspectoProducto.js`, `src/sv/validations/config.validation.js` (bloque `producto`)
- Test: `tests/productosTipo.models.test.js`

**Interfaces:** Produces `SvProducto.prod_tipo`, `SvProducto.prod_es_generico`, `SvProspectoProducto.pp_precio_ofrecido`.

- [ ] **Step 1: Write the failing test** `tests/productosTipo.models.test.js`

```js
const { DataTypes } = require('sequelize');
const v = require('../src/sv/validations/config.validation');

// Ejecuta la factory del modelo con un sequelize falso, sin abrir conexión a la base.
function atributosDe(factory) {
  let attrs = null;
  factory({ define: (_nombre, a) => { attrs = a; return {}; } }, DataTypes);
  return attrs;
}

describe('modelos', () => {
  test('SvProducto tiene tipo y marca de "por definir"', () => {
    const a = atributosDe(require('../src/sv/models/Producto'));
    expect(a.prod_tipo.type.key).toBe('STRING');
    expect(a.prod_tipo.type.options.length).toBe(50);
    expect(a.prod_tipo.allowNull).not.toBe(false);
    expect(a.prod_es_generico.type.key).toBe('TINYINT');
    expect(a.prod_es_generico.defaultValue).toBe(0);
  });

  test('SvProspectoProducto tiene el precio ofrecido, opcional', () => {
    const a = atributosDe(require('../src/sv/models/ProspectoProducto'));
    expect(a.pp_precio_ofrecido.type.key).toBe('DECIMAL');
    expect(a.pp_precio_ofrecido.allowNull).not.toBe(false);
  });
});

describe('validación del catálogo de productos', () => {
  const BASE = { prod_area_id: 1, prod_codigo: 'PRE-X', prod_nombre: 'X' };

  test('crear: sin tipo y sin marca nace como producto normal', () => {
    const { error, value } = v.producto.create.validate(BASE);
    expect(error).toBeUndefined();
    expect(value.prod_es_generico).toBe(0);
  });

  test('crear: acepta tipo y marca', () => {
    const { error, value } = v.producto.create.validate({ ...BASE, prod_tipo: 'Osarios', prod_es_generico: 1 });
    expect(error).toBeUndefined();
    expect(value).toEqual(expect.objectContaining({ prod_tipo: 'Osarios', prod_es_generico: 1 }));
  });

  test.each([[{ prod_tipo: 'a'.repeat(51) }], [{ prod_es_generico: 2 }]])('rechaza %j al crear y al editar', (extra) => {
    expect(v.producto.create.validate({ ...BASE, ...extra }).error).toBeDefined();
    expect(v.producto.update.validate(extra).error).toBeDefined();
  });

  test.each([[{ prod_tipo: '' }], [{ prod_tipo: null }], [{ prod_tipo: 'Lotes' }], [{ prod_es_generico: 0 }]])('editar acepta %j', (cambio) => {
    expect(v.producto.update.validate(cambio).error).toBeUndefined();
  });
});
```

- [ ] **Step 2:** `npx jest tests/productosTipo.models.test.js` → FAIL (`a.prod_tipo` es undefined).

- [ ] **Step 3: Create** `src/sv/migrations/025_productos_tipo_precio.sql`

```sql
-- =====================================================================
-- SerVentas CRM — Migración 025: productos por tipo y precio ofrecido
--
-- 1) sv_cfg_productos.prod_tipo: segundo nivel de la clasificación
--    (categoría → tipo → producto).
-- 2) sv_cfg_productos.prod_es_generico: fila que representa el tipo completo
--    ("Osarios, por definir"); no lleva precio.
-- 3) sv_crm_prospectos_productos.pp_precio_ofrecido: precio vigente cuando el
--    asesor eligió el producto. Lo pone el servidor y no cambia con la lista.
-- Solo estructura. Idempotente. Inofensiva para el código anterior.
-- Debe correr ANTES de desplegar el backend que la usa.
-- =====================================================================

SET NAMES utf8mb4;

SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sv_cfg_productos' AND COLUMN_NAME = 'prod_tipo');
SET @sql = IF(@existe = 0,
  'ALTER TABLE sv_cfg_productos ADD COLUMN prod_tipo VARCHAR(50) NULL AFTER prod_categoria',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sv_cfg_productos' AND COLUMN_NAME = 'prod_es_generico');
SET @sql = IF(@existe = 0,
  'ALTER TABLE sv_cfg_productos ADD COLUMN prod_es_generico TINYINT(1) NOT NULL DEFAULT 0 AFTER prod_tipo',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sv_crm_prospectos_productos' AND COLUMN_NAME = 'pp_precio_ofrecido');
SET @sql = IF(@existe = 0,
  'ALTER TABLE sv_crm_prospectos_productos ADD COLUMN pp_precio_ofrecido DECIMAL(12,2) NULL AFTER pp_es_principal',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
```

- [ ] **Step 4: Modelos.** En `src/sv/models/Producto.js`, debajo de `prod_categoria`, agrega:

```js
    prod_tipo:             { type: DataTypes.STRING(50) },                    // categoría → tipo → producto (migración 025)
    prod_es_generico:      { type: DataTypes.TINYINT, defaultValue: 0 },      // 1 = fila "por definir" del tipo, sin precio
```

En `src/sv/models/ProspectoProducto.js`, debajo de `pp_es_principal`, agrega:

```js
    pp_precio_ofrecido: { type: DataTypes.DECIMAL(12, 2) },  // precio vigente al elegirlo; lo pone el servidor (migración 025)
```

- [ ] **Step 5: Validación.** En `src/sv/validations/config.validation.js`, dentro de `producto.create`, debajo de `prod_categoria`, agrega:

```js
      prod_tipo:             Joi.string().max(50).allow('', null),
      prod_es_generico:      Joi.number().valid(0, 1).default(0),
```

y dentro de `producto.update`, debajo de `prod_categoria`:

```js
      prod_tipo:             Joi.string().max(50).allow('', null),
      prod_es_generico:      Joi.number().valid(0, 1),
```

- [ ] **Step 6:** `npx jest tests/productosTipo.models.test.js` → PASS (10).
- [ ] **Step 7: Commit** `feat(productos): migración 025, tipo de producto y precio ofrecido en los modelos`

---

### Task 2: Precio ofrecido en el servicio de prospectos

Directorio: **BACK**.

**Files:**
- Modify: `src/sv/services/prospectos.service.js` (imports, `crear`, `actualizarProductos`)
- Test: `tests/prospectosProductos.service.test.js`

**Interfaces:** Consumes `SvProducto.prod_precio_base`, `SvProspectoProducto.pp_precio_ofrecido` (Task 1). Produces `prospectos.crear(payload, asesorId)` y `prospectos.actualizarProductos(prospId, productos)` con la misma firma y respuesta.

- [ ] **Step 1: Write the failing test** `tests/prospectosProductos.service.test.js`

```js
jest.mock('../src/sv/models', () => ({
  sequelize: { transaction: jest.fn() },
  SvProspecto: { create: jest.fn(), findByPk: jest.fn() },
  SvProspectoProducto: { create: jest.fn(), findAll: jest.fn(), destroy: jest.fn() },
  SvProducto: { findAll: jest.fn() },
  SvPersona: {}, SvUsuario: {}, SvEstado: {}, SvFuente: {}, SvPunto: {},
  SvLista: {}, SvGestion: {}, SvResultado: {}, SvEmpresa: {}
}));

const { Op } = require('sequelize');
const M = require('../src/sv/models');
const prospectos = require('../src/sv/services/prospectos.service');

const t = { commit: jest.fn(), rollback: jest.fn() };
const PRECIOS = { 10: '8770000.00', 11: '5315000.00', 12: null };

beforeEach(() => {
  jest.resetAllMocks();
  M.sequelize.transaction.mockResolvedValue(t);
  M.SvProspecto.create.mockResolvedValue({ prosp_id: 900 });
  M.SvProspecto.findByPk.mockResolvedValue({ prosp_id: 900 });
  M.SvProspectoProducto.findAll.mockResolvedValue([]);
  M.SvProducto.findAll.mockImplementation(async ({ where }) =>
    where.prod_id[Op.in].filter((id) => id in PRECIOS).map((id) => ({ prod_id: id, prod_precio_base: PRECIOS[id] })));
});

const creados = () => M.SvProspectoProducto.create.mock.calls.map(([d]) => d);

describe('crear', () => {
  const BASE = { prosp_area_id: 1, prosp_grupo_id: 1, prosp_persona_id: 5, prosp_estado_id: 1 };

  test('guarda el precio vigente de cada producto', async () => {
    await prospectos.crear({ ...BASE, productos: [{ prod_id: 10, es_principal: true, nota: 'n' }, { prod_id: 11 }] }, 7);
    expect(creados()).toEqual([
      { pp_prosp_id: 900, pp_prod_id: 10, pp_es_principal: 1, pp_nota: 'n', pp_precio_ofrecido: '8770000.00' },
      { pp_prosp_id: 900, pp_prod_id: 11, pp_es_principal: 0, pp_nota: null, pp_precio_ofrecido: '5315000.00' }
    ]);
    expect(M.SvProducto.findAll.mock.calls[0][0]).toEqual(expect.objectContaining({ transaction: t }));
    expect(t.commit).toHaveBeenCalledTimes(1);
  });

  test('sin precio (por definir o sin lista) guarda null', async () => {
    await prospectos.crear({ ...BASE, productos: [{ prod_id: 12 }] }, 7);
    expect(creados()[0].pp_precio_ofrecido).toBeNull();
  });

  test('ignora un precio enviado por el cliente', async () => {
    await prospectos.crear({ ...BASE, productos: [{ prod_id: 10, pp_precio_ofrecido: 1, precio: 1, prod_precio_base: 1 }] }, 7);
    expect(creados()[0].pp_precio_ofrecido).toBe('8770000.00');
  });

  test('ignora repetidos y los que no traen prod_id', async () => {
    await prospectos.crear({ ...BASE, productos: [{ prod_id: 10, es_principal: true }, { prod_id: '10' }, { es_principal: false }] }, 7);
    expect(creados()).toHaveLength(1);
    expect(creados()[0]).toEqual(expect.objectContaining({ pp_prod_id: 10, pp_es_principal: 1 }));
  });

  test('sin productos no consulta precios', async () => {
    await prospectos.crear({ ...BASE }, 7);
    expect(M.SvProducto.findAll).not.toHaveBeenCalled();
    expect(M.SvProspectoProducto.create).not.toHaveBeenCalled();
  });
});

describe('actualizarProductos', () => {
  const fila = (pp_id, pp_prod_id, pp_precio_ofrecido) => ({ pp_id, pp_prod_id, pp_precio_ofrecido, update: jest.fn(async () => {}) });

  test('conserva el precio ofrecido de los que siguen: solo cambia principal y nota', async () => {
    const a = fila(1, 10, '5000000.00');
    M.SvProspectoProducto.findAll.mockResolvedValue([a]);
    await prospectos.actualizarProductos(900, [{ prod_id: 10, es_principal: true, nota: 'nueva' }]);
    expect(a.update).toHaveBeenCalledWith({ pp_es_principal: 1, pp_nota: 'nueva' }, { transaction: t });
    expect(M.SvProspectoProducto.create).not.toHaveBeenCalled();
    expect(M.SvProspectoProducto.destroy).not.toHaveBeenCalled();
    expect(M.SvProducto.findAll).not.toHaveBeenCalled();
  });

  test('el que se agrega toma el precio de hoy y el que se quita se borra', async () => {
    const a = fila(1, 10, '5000000.00');
    const b = fila(2, 12, null);
    M.SvProspectoProducto.findAll.mockResolvedValue([a, b]);
    await prospectos.actualizarProductos(900, [{ prod_id: 10 }, { prod_id: 11, es_principal: true }]);
    expect(M.SvProspectoProducto.destroy).toHaveBeenCalledWith({ where: { pp_id: { [Op.in]: [2] } }, transaction: t });
    expect(creados()).toEqual([{ pp_prosp_id: 900, pp_prod_id: 11, pp_es_principal: 1, pp_nota: null, pp_precio_ofrecido: '5315000.00' }]);
    expect(a.update).toHaveBeenCalledWith({ pp_es_principal: 0, pp_nota: null }, { transaction: t });
  });

  test('una lista vacía quita todos los intereses', async () => {
    M.SvProspectoProducto.findAll.mockResolvedValue([fila(1, 10, null), fila(2, 11, null)]);
    await prospectos.actualizarProductos(900, []);
    expect(M.SvProspectoProducto.destroy).toHaveBeenCalledWith({ where: { pp_id: { [Op.in]: [1, 2] } }, transaction: t });
    expect(t.commit).toHaveBeenCalledTimes(1);
  });

  test('lee las filas del prospecto con bloqueo, dentro de la transacción', async () => {
    await prospectos.actualizarProductos(900, [{ prod_id: 10 }]);
    expect(M.SvProspectoProducto.findAll).toHaveBeenCalledWith({ where: { pp_prosp_id: 900 }, transaction: t, lock: true });
  });

  test('dos principales → VALIDATION_ERROR sin abrir transacción', async () => {
    const e = await prospectos.actualizarProductos(900, [{ prod_id: 10, es_principal: true }, { prod_id: 11, es_principal: true }]).catch((x) => x);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(M.sequelize.transaction).not.toHaveBeenCalled();
  });

  test('prospecto inexistente → NOT_FOUND', async () => {
    M.SvProspecto.findByPk.mockResolvedValue(null);
    const e = await prospectos.actualizarProductos(999, []).catch((x) => x);
    expect(e.code).toBe('NOT_FOUND');
  });

  test('si algo falla, revierte y propaga el error', async () => {
    M.SvProspectoProducto.create.mockRejectedValue(new Error('db caída'));
    await expect(prospectos.actualizarProductos(900, [{ prod_id: 10 }])).rejects.toThrow('db caída');
    expect(t.rollback).toHaveBeenCalledTimes(1);
    expect(t.commit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2:** `npx jest tests/prospectosProductos.service.test.js` → FAIL (sin `pp_precio_ofrecido`; borra y recrea).

- [ ] **Step 3: Implementar** en `src/sv/services/prospectos.service.js`

3a. En el `require('../models')` del inicio, agrega `SvProducto` después de `SvProspectoProducto,`.

3b. Antes de `async function crear(payload, asesorId) {` agrega:

```js
// Intereses sin repetidos ni vacíos; gana la primera aparición. Solo se toman estos
// campos: un precio enviado por el cliente se ignora.
function interesesUnicos(productos) {
  const unicos = new Map();
  for (const p of productos || []) {
    const prodId = Number(p?.prod_id);
    if (!prodId || unicos.has(prodId)) continue;
    unicos.set(prodId, { prod_id: prodId, es_principal: !!p.es_principal, nota: p.nota || null });
  }
  return [...unicos.values()];
}

// Precio de lista vigente de cada producto. Sin precio (o "por definir") queda null.
async function preciosVigentes(prodIds, transaction) {
  if (!prodIds.length) return new Map();
  const filas = await SvProducto.findAll({
    where: { prod_id: { [Op.in]: prodIds } },
    attributes: ['prod_id', 'prod_precio_base'],
    transaction
  });
  return new Map(filas.map((f) => [f.prod_id, f.prod_precio_base]));
}
```

3c. En `crear`, reemplaza

```js
    const productos = payload.productos || []; // [{prod_id, es_principal, nota}]
```

por

```js
    const intereses = interesesUnicos(payload.productos); // [{prod_id, es_principal, nota}]
```

y reemplaza

```js
    for (const prod of productos) {
      await SvProspectoProducto.create({
        pp_prosp_id: p.prosp_id,
        pp_prod_id:  prod.prod_id,
        pp_es_principal: prod.es_principal ? 1 : 0,
        pp_nota: prod.nota || null
      }, { transaction: t });
    }
```

por

```js
    const precios = await preciosVigentes(intereses.map((i) => i.prod_id), t);
    for (const i of intereses) {
      await SvProspectoProducto.create({
        pp_prosp_id: p.prosp_id,
        pp_prod_id:  i.prod_id,
        pp_es_principal: i.es_principal ? 1 : 0,
        pp_nota: i.nota,
        pp_precio_ofrecido: precios.get(i.prod_id) ?? null
      }, { transaction: t });
    }
```

3d. Reemplaza el comentario y el cuerpo de `actualizarProductos` (desde `/**` con "Reemplaza la lista de productos de interés de un prospecto." hasta el `}` que cierra la función) por:

```js
/**
 * Reemplaza la lista de productos de interés de un prospecto.
 * payload.productos = [{ prod_id, es_principal, nota }]
 *
 * Los que siguen conservan su fila (y con ella el precio ofrecido y la fecha): solo
 * cambian principal y nota. Los que se quitan se borran; los nuevos toman el precio de hoy.
 */
async function actualizarProductos(prospId, productos = []) {
  const p = await SvProspecto.findByPk(prospId);
  if (!p) { const e = new Error('Prospecto no encontrado'); e.code = 'NOT_FOUND'; throw e; }

  const intereses = interesesUnicos(productos);

  // Validar: máximo 1 principal
  if (intereses.filter((i) => i.es_principal).length > 1) {
    const e = new Error('Solo puede haber un producto principal'); e.code = 'VALIDATION_ERROR'; throw e;
  }

  const t = await sequelize.transaction();
  try {
    const actuales = await SvProspectoProducto.findAll({ where: { pp_prosp_id: prospId }, transaction: t, lock: true });
    const porProducto = new Map(actuales.map((a) => [a.pp_prod_id, a]));
    const pedidos = new Set(intereses.map((i) => i.prod_id));

    const quitar = actuales.filter((a) => !pedidos.has(a.pp_prod_id)).map((a) => a.pp_id);
    if (quitar.length) {
      await SvProspectoProducto.destroy({ where: { pp_id: { [Op.in]: quitar } }, transaction: t });
    }

    const nuevos = intereses.filter((i) => !porProducto.has(i.prod_id));
    const precios = await preciosVigentes(nuevos.map((i) => i.prod_id), t);

    for (const i of intereses) {
      const datos = { pp_es_principal: i.es_principal ? 1 : 0, pp_nota: i.nota };
      const actual = porProducto.get(i.prod_id);
      if (actual) {
        await actual.update(datos, { transaction: t });
      } else {
        await SvProspectoProducto.create({
          pp_prosp_id: prospId,
          pp_prod_id: i.prod_id,
          ...datos,
          pp_precio_ofrecido: precios.get(i.prod_id) ?? null
        }, { transaction: t });
      }
    }
    await t.commit();
  } catch (e) {
    await t.rollback();
    throw e;
  }
  return obtenerCompleto(prospId);
}
```

- [ ] **Step 4:** `npx jest tests/prospectosProductos.service.test.js tests/prospectosObtenerAlcance.test.js tests/prospectosGetOne.test.js` → PASS.
- [ ] **Step 5: Commit** `feat(productos): el precio ofrecido queda guardado y se conserva al editar los intereses`

---

### Task 3: `catalogoProductos.js`, la lógica del selector

Directorio: **FRONT**.

**Files:** Create `src/utils/catalogoProductos.js`, `src/utils/__tests__/catalogoProductos.spec.js`

**Interfaces:** Produces `tieneTipos(productos)`, `agruparProductos(productos)` → `[{ categoria, tipos: [{ tipo, generico, productos }] }]`, `filtrarGrupos(grupos, texto)`, `alternarInteres(seleccion, producto, catalogo)`, `marcarPrincipalEn(seleccion, prodId)`, `precioDe(valor)` → número o null, `detalleInteres(pp)` → texto.

- [ ] **Step 1: Write the failing test** `src/utils/__tests__/catalogoProductos.spec.js`

```js
import { describe, it, expect } from 'vitest';
import {
  tieneTipos, agruparProductos, filtrarGrupos, alternarInteres, marcarPrincipalEn, precioDe, detalleInteres
} from '@/utils/catalogoProductos';

const p = (prod_id, prod_nombre, prod_categoria, prod_tipo, extra = {}) =>
  ({ prod_id, prod_nombre, prod_categoria, prod_tipo, prod_es_generico: 0, prod_orden_display: prod_id, ...extra });

const CATALOGO = [
  p(1, 'Osarios', 'Mausoleos', 'Osarios', { prod_es_generico: 1 }),
  p(2, 'Osario mural mármol sector A2, sencillo', 'Mausoleos', 'Osarios', { prod_precio_base: '8770000.00' }),
  p(3, 'Osario mural en cerámica, sencillo', 'Mausoleos', 'Osarios', { prod_precio_base: '8140000.00' }),
  p(4, 'Columbario', 'Mausoleos', 'Columbarios', { prod_precio_base: '4785000.00' }),
  p(5, 'Inhumación de osarios', 'Inhumaciones', 'Osarios', { prod_es_generico: 1 }),
  p(6, 'Inhumación osario mármol', 'Inhumaciones', 'Osarios', { prod_precio_base: '876000.00' })
];
const sel = (prod_id, es_principal = false) => ({ prod_id, es_principal, nota: null });
const plano = (t) => t.replace(/\s/g, ' ');

describe('tieneTipos', () => {
  it('solo si algún producto tiene tipo', () => {
    expect(tieneTipos(CATALOGO)).toBe(true);
    expect(tieneTipos([{ prod_id: 1, prod_tipo: null }, { prod_id: 2, prod_tipo: '' }])).toBe(false);
    expect(tieneTipos(undefined)).toBe(false);
  });
});

describe('agruparProductos', () => {
  it('categoría → tipo → productos, con la fila por definir aparte', () => {
    const g = agruparProductos(CATALOGO);
    expect(g.map((x) => x.categoria)).toEqual(['Mausoleos', 'Inhumaciones']);
    expect(g[0].tipos.map((x) => x.tipo)).toEqual(['Osarios', 'Columbarios']);
    expect(g[0].tipos[0].generico.prod_id).toBe(1);
    expect(g[0].tipos[0].productos.map((x) => x.prod_id)).toEqual([2, 3]);
    expect(g[0].tipos[1].generico).toBeNull();
  });

  it('respeta prod_orden_display sin cambiar el arreglo original', () => {
    const al = [...CATALOGO].reverse();
    expect(agruparProductos(al).map((x) => x.categoria)).toEqual(['Mausoleos', 'Inhumaciones']);
    expect(al[0].prod_id).toBe(6);
  });

  it('lo que no tiene categoría o tipo va en Otros', () => {
    const g = agruparProductos([p(9, 'Suelto', null, null)]);
    expect(g).toEqual([{ categoria: 'Otros', tipos: [expect.objectContaining({ tipo: 'Otros' })] }]);
  });
});

describe('filtrarGrupos', () => {
  const grupos = agruparProductos(CATALOGO);
  const ids = (g) => g.flatMap((x) => x.tipos.flatMap((t) => [t.generico, ...t.productos].filter(Boolean).map((y) => y.prod_id)));

  it('sin texto devuelve todo', () => expect(filtrarGrupos(grupos, '  ')).toBe(grupos));
  it('busca por palabras sueltas, sin tildes ni mayúsculas', () => expect(ids(filtrarGrupos(grupos, 'MARMOL a2'))).toEqual([2]));
  it('también busca por categoría y tipo', () => expect(ids(filtrarGrupos(grupos, 'inhumaciones osarios'))).toEqual([5, 6]));
  it('sin coincidencias devuelve vacío', () => expect(filtrarGrupos(grupos, 'xyz')).toEqual([]));
});

describe('alternarInteres', () => {
  it('el primero que se elige es el principal', () => {
    expect(alternarInteres([], CATALOGO[1], CATALOGO)).toEqual([sel(2, true)]);
  });
  it('el segundo no es principal', () => {
    expect(alternarInteres([sel(2, true)], CATALOGO[3], CATALOGO)).toEqual([sel(2, true), sel(4)]);
  });
  it('elegir un producto quita el por definir de su tipo y hereda el principal', () => {
    expect(alternarInteres([sel(1, true)], CATALOGO[1], CATALOGO)).toEqual([sel(2, true)]);
  });
  it('no quita el por definir del mismo tipo en otra categoría', () => {
    expect(alternarInteres([sel(5, true)], CATALOGO[1], CATALOGO)).toEqual([sel(5, true), sel(2)]);
  });
  it('volver a tocarlo lo quita, y si era el principal pasa al primero que quede', () => {
    expect(alternarInteres([sel(2, true), sel(4)], CATALOGO[1], CATALOGO)).toEqual([sel(4, true)]);
  });
  it('conserva la nota de los demás y no cambia la selección recibida', () => {
    const antes = [{ prod_id: 2, es_principal: true, nota: 'con descuento' }];
    expect(alternarInteres(antes, CATALOGO[3], CATALOGO)[0].nota).toBe('con descuento');
    expect(antes).toHaveLength(1);
  });
});

describe('marcarPrincipalEn', () => {
  it('deja un solo principal', () => {
    expect(marcarPrincipalEn([sel(2, true), sel(4)], 4)).toEqual([sel(2), sel(4, true)]);
  });
});

describe('precioDe', () => {
  it.each([['8770000.00', 8770000], [876000, 876000], [null, null], [undefined, null], ['', null], [0, null], ['0.00', null], ['x', null]])('%s → %s', (v, e) => {
    expect(precioDe(v)).toBe(e);
  });
});

describe('detalleInteres', () => {
  it('por definir', () => expect(detalleInteres({ producto: CATALOGO[0], pp_precio_ofrecido: null })).toBe('por definir'));
  it('precio ofrecido igual al vigente', () => {
    expect(plano(detalleInteres({ producto: CATALOGO[1], pp_precio_ofrecido: '8770000.00' }))).toBe('$ 8.770.000');
  });
  it('precio ofrecido distinto del vigente', () => {
    expect(plano(detalleInteres({ producto: CATALOGO[1], pp_precio_ofrecido: '8000000.00' }))).toBe('$ 8.000.000 (vigente $ 8.770.000)');
  });
  it('sin precio guardado no muestra nada', () => {
    expect(detalleInteres({ producto: CATALOGO[1], pp_precio_ofrecido: null })).toBe('');
    expect(detalleInteres({ producto: null })).toBe('');
  });
});
```

- [ ] **Step 2:** `npx vitest run src/utils/__tests__/catalogoProductos.spec.js` → FAIL (no existe el módulo).

- [ ] **Step 3: Implementar** `src/utils/catalogoProductos.js`

```js
/**
 * Catálogo de productos con tres niveles: categoría → tipo → producto.
 * Un tipo puede tener una fila "por definir" (prod_es_generico): el cliente pregunta
 * por el tipo, pero todavía no hay un producto exacto.
 * Selección: [{ prod_id, es_principal, nota }].
 */
import { fmtCOP } from '@/utils/format';

export function tieneTipos(productos) {
  return (productos || []).some((p) => !!p.prod_tipo);
}

/** Número positivo o null: sin precio, 0 y vacío no se muestran. */
export function precioDe(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function agruparProductos(productos) {
  const categorias = new Map();
  const ordenados = [...(productos || [])].sort((a, b) => (a.prod_orden_display || 0) - (b.prod_orden_display || 0));
  for (const p of ordenados) {
    const categoria = p.prod_categoria || 'Otros';
    const tipo = p.prod_tipo || 'Otros';
    if (!categorias.has(categoria)) categorias.set(categoria, new Map());
    const tipos = categorias.get(categoria);
    if (!tipos.has(tipo)) tipos.set(tipo, { tipo, generico: null, productos: [] });
    if (p.prod_es_generico) tipos.get(tipo).generico = p;
    else tipos.get(tipo).productos.push(p);
  }
  return [...categorias].map(([categoria, tipos]) => ({ categoria, tipos: [...tipos.values()] }));
}

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filtrarGrupos(grupos, texto) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return grupos;
  const coincide = (...partes) => {
    const t = normalizar(partes.join(' '));
    return palabras.every((palabra) => t.includes(palabra));
  };
  return grupos
    .map((g) => ({
      ...g,
      tipos: g.tipos
        .map((t) => ({
          ...t,
          generico: t.generico && coincide(g.categoria, t.tipo, t.generico.prod_nombre) ? t.generico : null,
          productos: t.productos.filter((p) => coincide(g.categoria, t.tipo, p.prod_nombre))
        }))
        .filter((t) => t.generico || t.productos.length)
    }))
    .filter((g) => g.tipos.length);
}

// Siempre debe haber un principal mientras haya algo elegido.
function conPrincipal(seleccion) {
  if (!seleccion.length || seleccion.some((s) => s.es_principal)) return seleccion;
  return seleccion.map((s, i) => ({ ...s, es_principal: i === 0 }));
}

const claveTipo = (p) => `${p.prod_categoria || ''}|${p.prod_tipo || ''}`;

export function alternarInteres(seleccion, producto, catalogo) {
  if (seleccion.some((s) => s.prod_id === producto.prod_id)) {
    return conPrincipal(seleccion.filter((s) => s.prod_id !== producto.prod_id));
  }
  let base = seleccion;
  if (!producto.prod_es_generico && producto.prod_tipo) {
    // Ya se sabe qué quiere: sobra el "por definir" de ese mismo tipo.
    const genericos = new Set((catalogo || [])
      .filter((p) => p.prod_es_generico && claveTipo(p) === claveTipo(producto))
      .map((p) => p.prod_id));
    base = seleccion.filter((s) => !genericos.has(s.prod_id));
  }
  return conPrincipal([...base, { prod_id: producto.prod_id, es_principal: false, nota: null }]);
}

export function marcarPrincipalEn(seleccion, prodId) {
  return seleccion.map((s) => ({ ...s, es_principal: s.prod_id === prodId }));
}

/** Texto junto al nombre de un interés guardado (fila pp con su producto). */
export function detalleInteres(pp) {
  if (pp?.producto?.prod_es_generico) return 'por definir';
  const ofrecido = precioDe(pp?.pp_precio_ofrecido);
  if (!ofrecido) return '';
  const vigente = precioDe(pp.producto?.prod_precio_base);
  return vigente && vigente !== ofrecido ? `${fmtCOP(ofrecido)} (vigente ${fmtCOP(vigente)})` : fmtCOP(ofrecido);
}
```

- [ ] **Step 4:** el mismo comando → PASS.
- [ ] **Step 5: Commit** `feat(productos): agrupar, buscar y elegir intereses por categoría, tipo y producto`

---

### Task 4: `SelectorProductos.vue`

Directorio: **FRONT**.

**Files:** Create `src/components/crm/SelectorProductos.vue`, `src/components/crm/__tests__/SelectorProductos.spec.js`

**Interfaces:** Consumes Task 3 y `fmtCOP`. Produces el componente con props `modelValue: [{prod_id, es_principal, nota}]`, `productos` (catálogo activo del área) y `actuales` (filas `pp` del prospecto, con `producto`; por defecto `[]`), y el evento `update:modelValue`.

- [ ] **Step 1: Write the failing test** `src/components/crm/__tests__/SelectorProductos.spec.js`

```js
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import SelectorProductos from '@/components/crm/SelectorProductos.vue';

const p = (prod_id, prod_nombre, prod_categoria, prod_tipo, extra = {}) =>
  ({ prod_id, prod_nombre, prod_categoria, prod_tipo, prod_es_generico: 0, prod_orden_display: prod_id, ...extra });
const PRODUCTOS = [
  p(1, 'Osarios', 'Mausoleos', 'Osarios', { prod_es_generico: 1 }),
  p(2, 'Osario mural mármol sector A2, sencillo', 'Mausoleos', 'Osarios', { prod_precio_base: '8770000.00' }),
  p(4, 'Lote doble', 'Mausoleos', 'Lotes', { prod_precio_base: '18950000.00', prod_descripcion: 'No incluye el valor del traspaso.' }),
  p(7, 'Inhumación nivel 1A', 'Inhumaciones', 'Lotes', { prod_precio_base: null })
];
const sel = (prod_id, es_principal = false) => ({ prod_id, es_principal, nota: null });
const plano = (t) => t.replace(/\s+/g, ' ');
const montar = (props = {}) => mount(SelectorProductos, { props: { modelValue: [], productos: PRODUCTOS, ...props } });
const ultimo = (w) => w.emitted('update:modelValue').at(-1)[0];

describe('SelectorProductos', () => {
  it('sin nada elegido dice Sin elegir y muestra las categorías cerradas', () => {
    const w = montar();
    expect(w.find('[data-testid="elegidos"]').text()).toBe('Sin elegir');
    expect(w.findAll('[data-testid="categoria"]').map((c) => c.text())).toEqual(['Mausoleos', 'Inhumaciones']);
    expect(w.find('[data-testid="producto-2"]').exists()).toBe(false);
  });

  it('abre y cierra una categoría: tipo por definir y productos con precio', async () => {
    const w = montar();
    await w.findAll('[data-testid="categoria"]')[0].trigger('click');
    expect(plano(w.find('[data-testid="producto-1"]').text())).toBe('Osarios por definir');
    expect(plano(w.find('[data-testid="producto-2"]').text())).toContain('$ 8.770.000');
    expect(w.findAll('[data-testid="categoria"]')[0].attributes('aria-expanded')).toBe('true');
    await w.findAll('[data-testid="categoria"]')[0].trigger('click');
    expect(w.find('[data-testid="producto-1"]').exists()).toBe(false);
  });

  it('un tipo sin fila por definir muestra su nombre como título', async () => {
    const w = montar();
    await w.findAll('[data-testid="categoria"]')[1].trigger('click');
    expect(w.text()).toContain('Lotes');
    expect(w.find('[data-testid="producto-7"]').text()).toBe('Inhumación nivel 1A');
  });

  it('elegir y quitar emiten la nueva selección', async () => {
    const w = montar();
    await w.findAll('[data-testid="categoria"]')[0].trigger('click');
    await w.find('[data-testid="producto-2"]').trigger('click');
    expect(ultimo(w)).toEqual([sel(2, true)]);
    await w.setProps({ modelValue: [sel(2, true), sel(4)] });
    expect(w.find('[data-testid="producto-2"]').attributes('aria-pressed')).toBe('true');
    await w.find('[data-testid="quitar-2"]').trigger('click');
    expect(ultimo(w)).toEqual([sel(4, true)]);
  });

  it('la estrella cambia el principal', async () => {
    const w = montar({ modelValue: [sel(2, true), sel(4)] });
    await w.find('[data-testid="principal-4"]').trigger('click');
    expect(ultimo(w)).toEqual([sel(2), sel(4, true)]);
  });

  it('muestra lo elegido con su precio y su nota', () => {
    const w = montar({ modelValue: [sel(4, true), sel(1)] });
    const t = plano(w.find('[data-testid="elegidos"]').text());
    expect(t).toContain('Lote doble · $ 18.950.000');
    expect(t).toContain('No incluye el valor del traspaso.');
    expect(t).toContain('Osarios · por definir');
  });

  it('de lo ya guardado muestra el precio ofrecido, no el vigente', () => {
    const w = montar({
      modelValue: [sel(2, true)],
      actuales: [{ pp_prod_id: 2, pp_precio_ofrecido: '8000000.00', producto: PRODUCTOS[1] }]
    });
    const t = plano(w.find('[data-testid="elegidos"]').text());
    expect(t).toContain('$ 8.000.000');
    expect(t).not.toContain('8.770.000');
  });

  it('un interés con producto inactivo se ve con su nombre y se puede quitar', async () => {
    const w = montar({
      modelValue: [sel(99, true)],
      actuales: [{ pp_prod_id: 99, pp_precio_ofrecido: null, producto: p(99, 'Velación', 'Servicio', null) }]
    });
    expect(w.find('[data-testid="elegidos"]').text()).toContain('Velación');
    await w.find('[data-testid="quitar-99"]').trigger('click');
    expect(ultimo(w)).toEqual([]);
  });

  it('un interés que no se encuentra dice Producto no disponible', () => {
    expect(montar({ modelValue: [sel(123, true)] }).find('[data-testid="elegidos"]').text()).toContain('Producto no disponible');
  });

  it('buscar abre lo que coincide y avisa si no hay nada', async () => {
    const w = montar();
    await w.find('input').setValue('marmol a2');
    expect(w.find('[data-testid="producto-2"]').exists()).toBe(true);
    expect(w.find('[data-testid="producto-4"]').exists()).toBe(false);
    await w.find('input').setValue('zzz');
    expect(w.text()).toContain('Ningún producto coincide. Prueba con otra palabra.');
  });

  it('Enter en el buscador no envía el formulario que lo contiene', async () => {
    const w = montar();
    const e = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
    w.find('input').element.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('todos sus botones son type=button, para no enviar el formulario', async () => {
    const w = montar({ modelValue: [sel(2, true)] });
    await w.findAll('[data-testid="categoria"]')[0].trigger('click');
    expect(w.findAll('button').every((b) => b.attributes('type') === 'button')).toBe(true);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/components/crm/__tests__/SelectorProductos.spec.js` → FAIL (no existe).

- [ ] **Step 3: Implementar** `src/components/crm/SelectorProductos.vue`

```vue
<script setup>
/**
 * SelectorProductos.vue — elegir el interés del cliente por categoría, tipo y producto.
 * Props: modelValue [{ prod_id, es_principal, nota }], productos (catálogo activo del área),
 *        actuales (filas pp del prospecto con su producto: dan el precio ya ofrecido y el
 *        nombre de los productos inactivos).
 * El precio es informativo: el que se guarda lo pone el servidor.
 */
import { ref, computed } from 'vue';
import { fmtCOP } from '@/utils/format';
import {
  agruparProductos, filtrarGrupos, alternarInteres, marcarPrincipalEn, precioDe
} from '@/utils/catalogoProductos';

const props = defineProps({
  modelValue: { type: Array, required: true },
  productos:  { type: Array, required: true },
  actuales:   { type: Array, default: () => [] }
});
const emit = defineEmits(['update:modelValue']);

const texto = ref('');
const abierta = ref(null); // categoría abierta

const grupos = computed(() => agruparProductos(props.productos));
const visibles = computed(() => filtrarGrupos(grupos.value, texto.value));
const buscando = computed(() => texto.value.trim().length > 0);
const porId = computed(() => new Map(props.productos.map((p) => [p.prod_id, p])));
const guardados = computed(() => new Map(props.actuales.map((a) => [a.pp_prod_id, a])));
const elegidosIds = computed(() => new Set(props.modelValue.map((s) => s.prod_id)));

const elegidos = computed(() => props.modelValue.map((s) => {
  const guardado = guardados.value.get(s.prod_id);
  const p = porId.value.get(s.prod_id) || guardado?.producto || null;
  const precio = guardado ? precioDe(guardado.pp_precio_ofrecido) : precioDe(p?.prod_precio_base);
  return {
    ...s,
    nombre: p?.prod_nombre || 'Producto no disponible',
    detalle: p?.prod_es_generico ? 'por definir' : (precio ? fmtCOP(precio) : ''),
    nota_producto: p?.prod_descripcion || ''
  };
}));

function estaAbierta(categoria) { return buscando.value || abierta.value === categoria; }
function alternarCategoria(categoria) { abierta.value = abierta.value === categoria ? null : categoria; }
function alternar(producto) { emit('update:modelValue', alternarInteres(props.modelValue, producto, props.productos)); }
function quitar(prodId) { alternar({ prod_id: prodId }); }
function marcarPrincipal(prodId) { emit('update:modelValue', marcarPrincipalEn(props.modelValue, prodId)); }
function precioTexto(p) { const n = precioDe(p.prod_precio_base); return n ? fmtCOP(n) : ''; }
</script>

<template>
  <div class="space-y-2">
    <ul data-testid="elegidos" class="space-y-1.5">
      <li v-if="!elegidos.length" class="text-xs text-text3 italic">Sin elegir</li>
      <li v-for="e in elegidos" :key="e.prod_id"
          class="flex items-start gap-2 rounded-sv border px-2 py-1.5 text-sm"
          :class="e.es_principal ? 'border-gold bg-gold/10' : 'border-text3/30 bg-cream'">
        <button type="button" :data-testid="`principal-${e.prod_id}`" class="shrink-0 leading-none pt-0.5"
                :class="e.es_principal ? 'text-gold' : 'text-text3 hover:text-gold'"
                :aria-label="e.es_principal ? 'Es el principal' : 'Marcar como principal'"
                @click="marcarPrincipal(e.prod_id)">{{ e.es_principal ? '★' : '☆' }}</button>
        <div class="flex-1 min-w-0">
          <div class="text-text1">{{ e.nombre }}<span v-if="e.detalle" class="text-text3"> · {{ e.detalle }}</span></div>
          <div v-if="e.nota_producto" class="text-xs text-text3">{{ e.nota_producto }}</div>
        </div>
        <button type="button" :data-testid="`quitar-${e.prod_id}`" class="shrink-0 text-text3 hover:text-danger leading-none pt-0.5"
                aria-label="Quitar" @click="quitar(e.prod_id)">✕</button>
      </li>
    </ul>

    <input v-model="texto" type="text" aria-label="Buscar producto" placeholder="Osario A2, cremación plus…"
           class="w-full rounded-sv border border-text3/30 px-3 py-2 text-sm" @keydown.enter.prevent />

    <p v-if="!visibles.length" class="text-xs text-text3">Ningún producto coincide. Prueba con otra palabra.</p>

    <div v-else class="max-h-72 overflow-y-auto pr-1">
      <section v-for="g in visibles" :key="g.categoria" class="border-t border-text3/10 first:border-t-0">
        <button type="button" data-testid="categoria" :aria-expanded="estaAbierta(g.categoria) ? 'true' : 'false'"
                class="w-full flex items-center justify-between py-2 text-sm font-semibold text-text1 text-left"
                @click="alternarCategoria(g.categoria)">{{ g.categoria }}</button>
        <div v-if="estaAbierta(g.categoria)" class="pb-2">
          <div v-for="t in g.tipos" :key="t.tipo" class="mb-1">
            <button v-if="t.generico" type="button" :data-testid="`producto-${t.generico.prod_id}`"
                    :aria-pressed="elegidosIds.has(t.generico.prod_id) ? 'true' : 'false'"
                    class="w-full flex justify-between gap-3 rounded-sv px-2 py-1.5 text-sm text-left font-semibold"
                    :class="elegidosIds.has(t.generico.prod_id) ? 'bg-gold/15 text-gold' : 'hover:bg-cream/40 text-text1'"
                    @click="alternar(t.generico)">
              <span>{{ t.tipo }}</span> <span class="text-xs font-normal text-text3 whitespace-nowrap">por definir</span>
            </button>
            <div v-else class="px-2 py-1 text-xs font-semibold text-text3">{{ t.tipo }}</div>
            <button v-for="p in t.productos" :key="p.prod_id" type="button" :data-testid="`producto-${p.prod_id}`"
                    :aria-pressed="elegidosIds.has(p.prod_id) ? 'true' : 'false'"
                    class="w-full flex justify-between gap-3 rounded-sv pl-5 pr-2 py-1.5 text-sm text-left"
                    :class="elegidosIds.has(p.prod_id) ? 'bg-gold/15 text-gold' : 'hover:bg-cream/40 text-text2'"
                    @click="alternar(p)">
              <span>{{ p.prod_nombre }}</span> <span v-if="precioTexto(p)" class="text-xs text-text3 whitespace-nowrap">{{ precioTexto(p) }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
```

- [ ] **Step 4:** el mismo comando → PASS (13).
- [ ] **Step 5: Commit** `feat(productos): selector de interés por categoría, tipo y producto`

---

### Task 5: Usarlo al crear el prospecto y al registrar la gestión

Directorio: **FRONT**.

**Files:** Modify `src/components/crm/NuevoProspecto.vue`, `src/components/crm/RegistrarGestion.vue`. Test `src/components/crm/__tests__/NuevoProspecto.productos.spec.js`, `src/components/crm/__tests__/RegistrarGestion.productos.spec.js`

**Interfaces:** Consumes `SelectorProductos` (Task 4) y `tieneTipos` (Task 3).

- [ ] **Step 1: Write the failing tests**

`src/components/crm/__tests__/NuevoProspecto.productos.spec.js`:

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/personasApi', () => ({ personasApi: { buscar: vi.fn(), create: vi.fn() } }));

import { personasApi } from '@/api/personasApi';
import { useConfigStore } from '@/stores/useConfigStore';
import { useProspectosStore } from '@/stores/useProspectosStore';
import NuevoProspecto from '@/components/crm/NuevoProspecto.vue';
import SelectorProductos from '@/components/crm/SelectorProductos.vue';

const prod = (prod_id, prod_nombre, prod_tipo) => ({
  prod_id, prod_nombre, prod_tipo, prod_area_id: 1, prod_activo: 1, prod_orden_display: prod_id, prod_categoria: 'Mausoleos', prod_es_generico: 0
});

async function enPaso2(productos) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore(pinia).actual = {
    productos, fuentes: [], puntos: [],
    estados: [{ estado_id: 11, estado_grupo_id: 1, estado_activo: 1, estado_orden: 1, estado_nombre: 'Nuevo' }]
  };
  personasApi.buscar.mockRejectedValue({ response: { status: 404 } });
  const w = mount(NuevoProspecto, {
    props: { open: false, areaId: 1, grupoId: 1 },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await w.setProps({ open: true });
  await w.find('input').setValue('3001234567');
  await w.findAll('button').find((b) => b.text().trim() === 'Validar teléfono').trigger('click');
  await flushPromises();
  return { w, store: useProspectosStore(pinia) };
}

describe('NuevoProspecto: productos de interés', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con tipos usa el selector y envía lo elegido', async () => {
    const { w, store } = await enPaso2([prod(2, 'Osario A2', 'Osarios')]);
    personasApi.create.mockResolvedValue({ data: { persona_id: 500 } });
    store.crear.mockResolvedValue({ prosp_id: 900 });
    const s = w.findComponent(SelectorProductos);
    expect(s.exists()).toBe(true);
    s.vm.$emit('update:modelValue', [{ prod_id: 2, es_principal: true, nota: null }]);
    await w.vm.$nextTick();
    const nombre = w.findAll('input').find((i) => i.element.value === '' && i.attributes('type') !== 'email');
    await nombre.setValue('Marta');
    await w.findAll('button').find((b) => b.text().trim() === 'Crear prospecto').trigger('click');
    await flushPromises();
    expect(store.crear.mock.calls[0][0].productos).toEqual([{ prod_id: 2, es_principal: true, nota: null }]);
  });

  it('sin tipos conserva los botones de siempre', async () => {
    const { w } = await enPaso2([prod(3, 'Contrato SAP', null)]);
    expect(w.findComponent(SelectorProductos).exists()).toBe(false);
    expect(w.findAll('button').some((b) => b.text().trim() === 'Contrato SAP')).toBe(true);
  });
});
```

`src/components/crm/__tests__/RegistrarGestion.productos.spec.js`:

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/salasApi', () => ({ salasApi: { registrarVisita: vi.fn() } }));
vi.mock('@/api/prospectosApi', () => ({ prospectosApi: { actualizarProductos: vi.fn() } }));

import { prospectosApi } from '@/api/prospectosApi';
import { useConfigStore } from '@/stores/useConfigStore';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import SelectorProductos from '@/components/crm/SelectorProductos.vue';

const prod = (prod_id, prod_nombre, prod_tipo, prod_activo = 1) => ({
  prod_id, prod_nombre, prod_tipo, prod_area_id: 1, prod_activo, prod_orden_display: prod_id, prod_categoria: 'Mausoleos', prod_es_generico: 0
});
const INACTIVO = prod(3, 'Velación', null, 0);
const PROSPECTO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1,
  persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' },
  productos: [{ pp_prod_id: 3, pp_es_principal: 1, pp_nota: null, pp_precio_ofrecido: null, producto: INACTIVO }]
};

async function abrir(productos) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore(pinia).actual = {
    productos, estados: [],
    resultados: [{ resultado_id: 3, resultado_grupo_id: 1, resultado_activo: 1, resultado_orden: 1, resultado_nombre: 'Interesado', resultado_requiere_fecha: 0 }]
  };
  const w = mount(RegistrarGestion, {
    props: { open: false, prospecto: PROSPECTO },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await w.setProps({ open: true });
  return w;
}
const editar = async (w) => w.findAll('button').find((b) => b.text().trim() === 'Editar').trigger('click');

describe('RegistrarGestion: productos de interés', () => {
  beforeEach(() => vi.clearAllMocks());

  it('un interés con producto inactivo se ve con su nombre, no con #id', async () => {
    const w = await abrir([prod(2, 'Osario A2', 'Osarios')]);
    expect(w.text()).toContain('Velación');
    expect(w.text()).not.toContain('#3');
  });

  it('con tipos edita con el selector y guarda lo elegido', async () => {
    const w = await abrir([prod(2, 'Osario A2', 'Osarios')]);
    await editar(w);
    const s = w.findComponent(SelectorProductos);
    expect(s.exists()).toBe(true);
    expect(s.props('actuales')).toEqual(PROSPECTO.productos);
    expect(s.props('modelValue')).toEqual([{ prod_id: 3, es_principal: true, nota: null }]);
    s.vm.$emit('update:modelValue', [{ prod_id: 2, es_principal: true, nota: null }]);
    await w.vm.$nextTick();
    await w.findAll('select')[1].setValue('3');
    await w.findAll('button').find((b) => b.text().trim() === 'Registrar').trigger('click');
    await flushPromises();
    expect(prospectosApi.actualizarProductos).toHaveBeenCalledWith(900, [{ prod_id: 2, es_principal: true, nota: null }]);
  });

  it('sin tipos conserva la lista de siempre', async () => {
    const w = await abrir([prod(5, 'Plan empresarial', null)]);
    await editar(w);
    expect(w.findComponent(SelectorProductos).exists()).toBe(false);
    expect(w.findAll('input[type="checkbox"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/components/crm/__tests__/NuevoProspecto.productos.spec.js src/components/crm/__tests__/RegistrarGestion.productos.spec.js` → FAIL.

- [ ] **Step 3: `NuevoProspecto.vue`**

3a. Debajo de `import { personasApi } from '@/api/personasApi';` agrega `import { tieneTipos } from '@/utils/catalogoProductos';`, y debajo de `import ProspectosCrossArea …;` agrega `import SelectorProductos from '@/components/crm/SelectorProductos.vue';`.

3b. Debajo del bloque `const opcProductos = computed(...)` agrega:

```js
// Con catálogo por tipos (Prenecesidad) se usa el selector; las demás áreas, los botones.
const conTipos = computed(() => tieneTipos(opcProductos.value));
```

3c. En el template, reemplaza

```html
          <label class="sv-label">Productos de interés</label>
          <div class="flex flex-wrap gap-2">
```

por

```html
          <label class="sv-label">Productos de interés</label>
          <SelectorProductos v-if="conTipos" v-model="prospecto.productos" :productos="opcProductos" />
          <div v-else class="flex flex-wrap gap-2">
```

- [ ] **Step 4: `RegistrarGestion.vue`**

4a. Debajo de `import { salasApi } from '@/api/salasApi';` agrega `import { tieneTipos } from '@/utils/catalogoProductos';`, y debajo de los imports de componentes `import SelectorProductos from '@/components/crm/SelectorProductos.vue';`.

4b. Debajo del bloque `const productosDisponibles = computed(...)` agrega:

```js
const conTipos = computed(() => tieneTipos(productosDisponibles.value));

// Un producto inactivo ya no está en el catálogo, pero el interés guardado trae su nombre.
function nombreProducto(prodId) {
  return productosDisponibles.value.find((p) => p.prod_id === prodId)?.prod_nombre
    || (props.prospecto?.productos || []).find((p) => p.pp_prod_id === prodId)?.producto?.prod_nombre
    || 'Producto no disponible';
}
```

4c. En el template, reemplaza

```html
            {{ productosDisponibles.find(pr => pr.prod_id === p.prod_id)?.prod_nombre || `#${p.prod_id}` }}
```

por

```html
            {{ nombreProducto(p.prod_id) }}
```

4d. Reemplaza

```html
        <!-- Editor expandido -->
        <div v-if="editandoProductos" class="space-y-2 max-h-56 overflow-y-auto pr-1">
```

por

```html
        <!-- Editor expandido -->
        <SelectorProductos v-if="editandoProductos && conTipos" v-model="productosSel"
                           :productos="productosDisponibles" :actuales="prospecto?.productos || []" />
        <div v-else-if="editandoProductos" class="space-y-2 max-h-56 overflow-y-auto pr-1">
```

- [ ] **Step 5:** los mismos specs y `src/components/crm/__tests__/RegistrarGestion.sala.spec.js` → PASS.
- [ ] **Step 6: Commit** `feat(productos): elegir el interés por tipo o producto al crear y al gestionar`

---

### Task 6: Ficha y administración

Directorio: **FRONT**.

**Files:** Modify `src/views/prenecesidad/FichaCliente.vue`, `src/views/admin/GestionProductos.vue`, `src/components/admin/CrudCatalogo.vue`. Test `src/views/prenecesidad/__tests__/FichaCliente.productos.spec.js`, `src/views/admin/__tests__/GestionProductos.spec.js`, `src/components/admin/__tests__/CrudCatalogo.spec.js`

**Interfaces:** Consumes `detalleInteres` (Task 3). Produces `default` por campo en `CrudCatalogo`.

- [ ] **Step 1: Write the failing tests**

`src/views/prenecesidad/__tests__/FichaCliente.productos.spec.js`:

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

import FichaCliente from '@/views/prenecesidad/FichaCliente.vue';

const pp = (pp_id, producto, pp_precio_ofrecido, pp_es_principal = 0) => ({ pp_id, pp_prod_id: pp_id, pp_es_principal, pp_precio_ofrecido, producto });

it('cada interés muestra por definir, el precio ofrecido o solo el nombre', async () => {
  const activo = {
    prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1, prosp_persona_id: 500, prosp_prioridad: 3,
    persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' },
    estado: { estado_nombre: 'Nuevo', estado_color_hex: '#8A6A52' }, asesor: { usr_nombre: 'D', usr_apellido: 'M' },
    productos: [
      pp(1, { prod_nombre: 'Osarios', prod_es_generico: 1 }, null, 1),
      pp(2, { prod_nombre: 'Osario A2', prod_precio_base: '8770000.00' }, '8770000.00'),
      pp(3, { prod_nombre: 'Lote doble', prod_precio_base: '18950000.00' }, '18000000.00'),
      pp(4, { prod_nombre: 'Velación', prod_precio_base: '1200000.00' }, null)
    ]
  };
  const w = mount(FichaCliente, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo } } })],
      stubs: { teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true, ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true }
    }
  });
  await flushPromises();
  const chips = w.findAll('[data-testid="interes"]').map((c) => c.text().replace(/\s+/g, ' ').trim());
  expect(chips).toEqual([
    '⭐ Osarios · por definir',
    'Osario A2 · $ 8.770.000',
    'Lote doble · $ 18.000.000 (vigente $ 18.950.000)',
    'Velación'
  ]);
});
```

`src/views/admin/__tests__/GestionProductos.spec.js`:

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { it, expect, vi } from 'vitest';

vi.mock('@/api/configApi', () => ({ configApi: { areas: { list: vi.fn(async () => ({ data: [] })) }, productos: {} } }));

import GestionProductos from '@/views/admin/GestionProductos.vue';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

it('administra el tipo y la marca por definir, apagada en un producto nuevo', async () => {
  const w = mount(GestionProductos, { global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { CrudCatalogo: true } } });
  await flushPromises();
  const { campos, columnas } = w.findComponent(CrudCatalogo).props();
  expect(campos.find((c) => c.key === 'prod_tipo')).toEqual({ key: 'prod_tipo', label: 'Tipo', type: 'text' });
  expect(campos.find((c) => c.key === 'prod_es_generico')).toEqual({ key: 'prod_es_generico', label: 'Es "por definir" (representa al tipo, sin precio)', type: 'switch', default: 0 });
  expect(columnas.some((c) => c.key === 'prod_tipo')).toBe(true);
});
```

`src/components/admin/__tests__/CrudCatalogo.spec.js`:

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { it, expect, vi } from 'vitest';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

it('al crear usa el default del campo; sin él, los valores de siempre', async () => {
  const apiResource = { list: vi.fn(async () => ({ data: [] })), create: vi.fn(async () => ({})) };
  const w = mount(CrudCatalogo, {
    props: {
      titulo: 'Catálogo', apiResource, filaIdKey: 'id', columnas: [],
      campos: [
        { key: 'nombre', label: 'Nombre', type: 'text' },
        { key: 'orden', label: 'Orden', type: 'number' },
        { key: 'activo', label: 'Activo', type: 'switch' },
        { key: 'generico', label: 'Genérico', type: 'switch', default: 0 }
      ]
    },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } }
  });
  await flushPromises();
  await w.findAll('button').find((b) => b.text().includes('Nuevo')).trigger('click');
  await w.find('form').trigger('submit');
  await flushPromises();
  expect(apiResource.create).toHaveBeenCalledWith({ nombre: '', orden: 0, activo: 1, generico: 0 });
});
```

- [ ] **Step 2:** `npx vitest run src/views/prenecesidad/__tests__/FichaCliente.productos.spec.js src/views/admin/__tests__/GestionProductos.spec.js src/components/admin/__tests__/CrudCatalogo.spec.js` → FAIL.

- [ ] **Step 3: `FichaCliente.vue`.** Debajo de `import { salasApi } from '@/api/salasApi';` agrega `import { detalleInteres } from '@/utils/catalogoProductos';`. Reemplaza

```html
          <span v-for="pp in p.productos" :key="pp.pp_id"
                class="px-3 py-1 text-xs rounded-full bg-gold/10 text-gold border border-gold/30 font-semibold">
            <span v-if="pp.pp_es_principal">⭐</span>
            {{ pp.producto?.prod_nombre }}
          </span>
```

por

```html
          <span v-for="pp in p.productos" :key="pp.pp_id" data-testid="interes"
                class="px-3 py-1 text-xs rounded-full bg-gold/10 text-gold border border-gold/30 font-semibold">
            <span v-if="pp.pp_es_principal">⭐</span>
            {{ pp.producto?.prod_nombre }}
            <span v-if="detalleInteres(pp)" class="font-normal">· {{ detalleInteres(pp) }}</span>
          </span>
```

- [ ] **Step 4: `GestionProductos.vue`.** En `columnas`, debajo de `prod_categoria`, agrega `{ key: 'prod_tipo', label: 'Tipo' },`. En `campos`, debajo de `prod_categoria`, agrega:

```js
  { key: 'prod_tipo',        label: 'Tipo', type: 'text' },
  { key: 'prod_es_generico', label: 'Es "por definir" (representa al tipo, sin precio)', type: 'switch', default: 0 },
```

- [ ] **Step 5: `CrudCatalogo.vue`.** Reemplaza

```js
      form.value[c.key] = c.type === 'switch' ? 1 : (c.type === 'number' ? 0 : '');
```

por

```js
      form.value[c.key] = c.default ?? (c.type === 'switch' ? 1 : (c.type === 'number' ? 0 : ''));
```

- [ ] **Step 6:** los tres specs, más `src/views/prenecesidad/__tests__/FichaCliente.sala.spec.js` → PASS. Después `npx vitest run` completo en verde y `npm run build` limpio.
- [ ] **Step 7: Commit** `feat(productos): precio ofrecido en la ficha y tipo en la administración`

---

### Task 7: Migración 026 con el catálogo 2026

Directorio: **BACK**. El contenido de abajo ya incluye las respuestas de §8 del spec y está probado.

- [ ] **Step 1: Create** `src/sv/migrations/026_prenec_productos_2026.sql`, exactamente con este contenido:

```sql
-- =====================================================================
-- SerVentas CRM — Migración 026: catálogo de Prenecesidad 2026
--
-- 78 productos de la "Lista de precios 2026" y 17 filas "por definir" (una por
-- cada tipo con más de un producto, y Exhumación de cenizarios, que no tiene).
-- PRE-OSR, PRE-CNZ, PRE-CLM y PRE-PRR ya existen: pasan a ser la fila de su tipo, así los
-- clientes que las tienen no pierden el interés. Los demás productos de PRENEC se desactivan.
-- Los intereses ya elegidos sobre unos y otros quedan sin precio ofrecido.
-- "Inhumación nivel 1A para lote triple" queda en 0: la lista 2026 no trae su precio.
-- Solo datos. Requiere la 025. Idempotente, pero correrla de nuevo devuelve los precios a
-- los de 2026: es de una sola vez.
-- =====================================================================

SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO sv_cfg_productos
  (prod_area_id, prod_codigo, prod_nombre, prod_descripcion, prod_categoria, prod_tipo,
   prod_es_generico, prod_precio_base, prod_activo, prod_orden_display)
SELECT a.area_id, p.codigo, p.nombre, p.descripcion, p.categoria, p.tipo, p.generico, p.precio, 1, p.orden
  FROM sv_cfg_areas_negocio a
  JOIN (
    SELECT 'PRE-UT' AS codigo, 'Usos temporales' AS nombre, CAST(NULL AS CHAR) AS descripcion, 'Usos temporales' AS categoria, 'Usos temporales' AS tipo, 1 AS generico, CAST(NULL AS DECIMAL(12,2)) AS precio, 1100 AS orden
    UNION ALL SELECT 'PRE-UT-01', 'Uso temporal de lote, sector Olivos, 5 años', 'Incluye inhumación y exhumación. Sectores A1, A2, A3, A4, A5, A6, A7, SB1, H4, H5, H6, LF1, C6, C1, C3, C5, E1, E2, E3, E4, H1, H2 y H3.', 'Usos temporales', 'Usos temporales', 0, 9190000, 1101
    UNION ALL SELECT 'PRE-UT-02', 'Uso temporal de lote, sector Olivos, 10 años', 'Incluye inhumación y exhumación. Sectores A1, A2, A3, A4, A5, A6, A7, SB1, H4, H5, H6, LF1, C6, C1, C3, C5, E1, E2, E3, E4, H1, H2 y H3.', 'Usos temporales', 'Usos temporales', 0, 13850000, 1102
    UNION ALL SELECT 'PRE-UT-03', 'Uso temporal de lote, sector San José, 5 años', 'Incluye inhumación y exhumación. Sectores C2, C4, F1, F2, F3, F4, F5, SC1, SC2, D1, D2, D3, D4, G1, G2, G3 y G4.', 'Usos temporales', 'Usos temporales', 0, 8650000, 1103
    UNION ALL SELECT 'PRE-UT-04', 'Uso temporal de lote, sector San José, 10 años', 'Incluye inhumación y exhumación. Sectores C2, C4, F1, F2, F3, F4, F5, SC1, SC2, D1, D2, D3, D4, G1, G2, G3 y G4.', 'Usos temporales', 'Usos temporales', 0, 13050000, 1104
    UNION ALL SELECT 'PRE-UT-05', 'Uso temporal de lote, sector Cristo Rey, 5 años', 'Incluye inhumación y exhumación. Sectores J1, J2, J3, I1, I2, I3, I4 y D5.', 'Usos temporales', 'Usos temporales', 0, 7890000, 1105
    UNION ALL SELECT 'PRE-UT-06', 'Uso temporal de lote, sector Cristo Rey, 10 años', 'Incluye inhumación y exhumación. Sectores J1, J2, J3, I1, I2, I3, I4 y D5.', 'Usos temporales', 'Usos temporales', 0, 11850000, 1106
    UNION ALL SELECT 'PRE-PRR', 'Prórrogas', NULL, 'Usos temporales', 'Prórrogas', 1, NULL, 1200
    UNION ALL SELECT 'PRE-PRR-01', 'Prórroga, sector Olivos, 1 año', 'No incluye el valor de la exhumación. Sectores A1, A2, A3, A4, A5, A6, A7, SB1, H4, H5, H6, LF1, C6, C1, C3, C5, E1, E2, E3, E4, H1, H2 y H3.', 'Usos temporales', 'Prórrogas', 0, 2365000, 1201
    UNION ALL SELECT 'PRE-PRR-02', 'Prórroga, sector Olivos, 4 años', 'No incluye el valor de la exhumación. Sectores A1, A2, A3, A4, A5, A6, A7, SB1, H4, H5, H6, LF1, C6, C1, C3, C5, E1, E2, E3, E4, H1, H2 y H3.', 'Usos temporales', 'Prórrogas', 0, 7865000, 1202
    UNION ALL SELECT 'PRE-PRR-03', 'Prórroga, sector Olivos, 10 años', 'No incluye el valor de la exhumación. Sectores A1, A2, A3, A4, A5, A6, A7, SB1, H4, H5, H6, LF1, C6, C1, C3, C5, E1, E2, E3, E4, H1, H2 y H3.', 'Usos temporales', 'Prórrogas', 0, 13310000, 1203
    UNION ALL SELECT 'PRE-PRR-04', 'Prórroga, sector San José, 1 año', 'No incluye el valor de la exhumación. Sectores C2, C4, F1, F2, F3, F4, F5, SC1, SC2, D1, D2, D3, D4, G1, G2, G3 y G4.', 'Usos temporales', 'Prórrogas', 0, 2255000, 1204
    UNION ALL SELECT 'PRE-PRR-05', 'Prórroga, sector San José, 4 años', 'No incluye el valor de la exhumación. Sectores C2, C4, F1, F2, F3, F4, F5, SC1, SC2, D1, D2, D3, D4, G1, G2, G3 y G4.', 'Usos temporales', 'Prórrogas', 0, 6655000, 1205
    UNION ALL SELECT 'PRE-PRR-06', 'Prórroga, sector San José, 10 años', 'No incluye el valor de la exhumación. Sectores C2, C4, F1, F2, F3, F4, F5, SC1, SC2, D1, D2, D3, D4, G1, G2, G3 y G4.', 'Usos temporales', 'Prórrogas', 0, 12100000, 1206
    UNION ALL SELECT 'PRE-PRR-07', 'Prórroga, sector Cristo Rey, 1 año', 'No incluye el valor de la exhumación. Sectores J1, J2, J3, I1, I2, I3, I4 y D5.', 'Usos temporales', 'Prórrogas', 0, 2145000, 1207
    UNION ALL SELECT 'PRE-PRR-08', 'Prórroga, sector Cristo Rey, 4 años', 'No incluye el valor de la exhumación. Sectores J1, J2, J3, I1, I2, I3, I4 y D5.', 'Usos temporales', 'Prórrogas', 0, 5445000, 1208
    UNION ALL SELECT 'PRE-PRR-09', 'Prórroga, sector Cristo Rey, 10 años', 'No incluye el valor de la exhumación. Sectores J1, J2, J3, I1, I2, I3, I4 y D5.', 'Usos temporales', 'Prórrogas', 0, 10890000, 1209
    UNION ALL SELECT 'PRE-PRR-10', 'Prórroga cuerpo momificado, sector Olivos, 1 año', 'No incluye el valor de la exhumación. Se vende con autorización previa del jefe inmediato. Mínimo 1 año y máximo 2. Sectores A1, A2, A3, A4, A5, A6, A7, SB1, H4, H5, H6, LF1, C6, C1, C3, C5, E1, E2, E3, E4, H1, H2 y H3.', 'Usos temporales', 'Prórrogas', 0, 1950000, 1210
    UNION ALL SELECT 'PRE-PRR-11', 'Prórroga cuerpo momificado, sector San José, 1 año', 'No incluye el valor de la exhumación. Se vende con autorización previa del jefe inmediato. Mínimo 1 año y máximo 2. Sectores C2, C4, F1, F2, F3, F4, F5, SC1, SC2, D1, D2, D3, D4, G1, G2, G3 y G4.', 'Usos temporales', 'Prórrogas', 0, 1850000, 1211
    UNION ALL SELECT 'PRE-PRR-12', 'Prórroga cuerpo momificado, sector Cristo Rey, 1 año', 'No incluye el valor de la exhumación. Se vende con autorización previa del jefe inmediato. Mínimo 1 año y máximo 2. Sectores J1, J2, J3, I1, I2, I3, I4 y D5.', 'Usos temporales', 'Prórrogas', 0, 1250000, 1212
    UNION ALL SELECT 'PRE-PRR-13', 'Prórroga bóveda Cementerio Central, 1 año', 'Uso temporal en bóvedas del Cementerio Central.', 'Usos temporales', 'Prórrogas', 0, 1200000, 1213
    UNION ALL SELECT 'PRE-LOT', 'Lotes', NULL, 'Mausoleos', 'Lotes', 1, NULL, 2100
    UNION ALL SELECT 'PRE-LOT-01', 'Lote sencillo (otros parques privados)', 'No incluye el valor del traspaso.', 'Mausoleos', 'Lotes', 0, 13950000, 2101
    UNION ALL SELECT 'PRE-LOT-02', 'Lote doble (otros parques privados)', 'No incluye el valor del traspaso.', 'Mausoleos', 'Lotes', 0, 18950000, 2102
    UNION ALL SELECT 'PRE-OSR', 'Osarios', NULL, 'Mausoleos', 'Osarios', 1, NULL, 2200
    UNION ALL SELECT 'PRE-OSR-01', 'Osario mural sector A2 (Memorial), sencillo', NULL, 'Mausoleos', 'Osarios', 0, 10150000, 2201
    UNION ALL SELECT 'PRE-OSR-02', 'Osario mural mármol sector A2, sencillo', NULL, 'Mausoleos', 'Osarios', 0, 8770000, 2202
    UNION ALL SELECT 'PRE-OSR-03', 'Osario mural mármol sector F1 (Monumento San Martín), sencillo', NULL, 'Mausoleos', 'Osarios', 0, 6380000, 2203
    UNION ALL SELECT 'PRE-OSR-04', 'Osario cerámica (Monumento SC y EV), sencillo', NULL, 'Mausoleos', 'Osarios', 0, 5780000, 2204
    UNION ALL SELECT 'PRE-OSR-05', 'Osario mural en cerámica, sencillo', NULL, 'Mausoleos', 'Osarios', 0, 8140000, 2205
    UNION ALL SELECT 'PRE-OSR-06', 'Osario mural Cementerio Central', NULL, 'Mausoleos', 'Osarios', 0, 1950000, 2206
    UNION ALL SELECT 'PRE-OSR-07', 'Boveditas Cementerio Central', NULL, 'Mausoleos', 'Osarios', 0, 1980000, 2207
    UNION ALL SELECT 'PRE-CNV', 'Conversiones', NULL, 'Mausoleos', 'Conversiones', 1, NULL, 2300
    UNION ALL SELECT 'PRE-CNV-01', 'Conversión de lote sencillo a doble', 'No aplica en el sector G5.', 'Mausoleos', 'Conversiones', 0, 7650000, 2301
    UNION ALL SELECT 'PRE-CNV-02', 'Conversión de lote doble a triple', 'No aplica en los sectores D2, D3, D4, F5, G2, G5, H1, H5, I2, J1, J2 y SC.', 'Mausoleos', 'Conversiones', 0, 9750000, 2302
    UNION ALL SELECT 'PRE-CNV-03', 'Conversión de lote sencillo a triple', 'No aplica en los sectores D2, D3, D4, F5, G2, G5, H1, H5, I2, J1, J2 y SC.', 'Mausoleos', 'Conversiones', 0, 12500000, 2303
    UNION ALL SELECT 'PRE-CNV-04', 'Conversión de osario en tierra, de sencillo a doble', NULL, 'Mausoleos', 'Conversiones', 0, 1760000, 2304
    UNION ALL SELECT 'PRE-CNV-05', 'Conversión de cenizario en cerámica, de sencillo a doble', NULL, 'Mausoleos', 'Conversiones', 0, 1760000, 2305
    UNION ALL SELECT 'PRE-CLM', 'Columbarios', NULL, 'Mausoleos', 'Columbarios', 1, NULL, 2400
    UNION ALL SELECT 'PRE-CLM-01', 'Columbario', NULL, 'Mausoleos', 'Columbarios', 0, 4785000, 2401
    UNION ALL SELECT 'PRE-CLM-02', '1 columbario + inhumación', NULL, 'Mausoleos', 'Columbarios', 0, 5315000, 2402
    UNION ALL SELECT 'PRE-CLM-03', '4 columbarios + inhumación', NULL, 'Mausoleos', 'Columbarios', 0, 19850000, 2403
    UNION ALL SELECT 'PRE-CLM-04', '6 columbarios + inhumación', NULL, 'Mausoleos', 'Columbarios', 0, 29405000, 2404
    UNION ALL SELECT 'PRE-CLM-05', '8 columbarios + inhumación', NULL, 'Mausoleos', 'Columbarios', 0, 38710000, 2405
    UNION ALL SELECT 'PRE-CNZ', 'Cenizarios', NULL, 'Mausoleos', 'Cenizarios', 1, NULL, 2500
    UNION ALL SELECT 'PRE-CNZ-01', 'Cenizario mural sector A2 Memorial, sencillo', NULL, 'Mausoleos', 'Cenizarios', 0, 7480000, 2501
    UNION ALL SELECT 'PRE-CNZ-02', 'Cenizario mármol sector O (Monumento Niña María), doble', NULL, 'Mausoleos', 'Cenizarios', 0, 6550000, 2502
    UNION ALL SELECT 'PRE-CNZ-03', 'Cenizario mármol sector F1 (Monumento San Martín), doble', NULL, 'Mausoleos', 'Cenizarios', 0, 5230000, 2503
    UNION ALL SELECT 'PRE-CNZ-04', 'Cenizario mural cerámica, doble', NULL, 'Mausoleos', 'Cenizarios', 0, 6540000, 2504
    UNION ALL SELECT 'PRE-CNZ-05', 'Cenizario mural cerámica, sencillo', NULL, 'Mausoleos', 'Cenizarios', 0, 5330000, 2505
    UNION ALL SELECT 'PRE-CRT', 'Cremación tradicional', NULL, 'Cremaciones', 'Tradicional', 1, NULL, 3100
    UNION ALL SELECT 'PRE-CRT-01', 'Cremación tradicional, cofre clásico', NULL, 'Cremaciones', 'Tradicional', 0, 2180000, 3101
    UNION ALL SELECT 'PRE-CRT-02', 'Cremación niños hasta 12 meses tradicional, cofre clásico', NULL, 'Cremaciones', 'Tradicional', 0, 1020000, 3102
    UNION ALL SELECT 'PRE-CRP', 'Cremación plus', NULL, 'Cremaciones', 'Plus', 1, NULL, 3200
    UNION ALL SELECT 'PRE-CRP-01', 'Cremación tradicional plus, cofre presidencial', NULL, 'Cremaciones', 'Plus', 0, 2475000, 3201
    UNION ALL SELECT 'PRE-CRP-02', 'Cremación niños hasta 12 meses tradicional plus, cofre presidencial', NULL, 'Cremaciones', 'Plus', 0, 1380000, 3202
    UNION ALL SELECT 'PRE-CRR', 'Cremación de restos', NULL, 'Cremaciones', 'Restos', 1, NULL, 3300
    UNION ALL SELECT 'PRE-CRR-01', 'Cremación de restos tradicional, cofre clásico', NULL, 'Cremaciones', 'Restos', 0, 1200000, 3301
    UNION ALL SELECT 'PRE-CRR-02', 'Cremación de restos tradicional plus, cofre presidencial', NULL, 'Cremaciones', 'Restos', 0, 1695000, 3302
    UNION ALL SELECT 'PRE-CMM-01', 'Cremación de cuerpo momificado, cofre clásico', 'Se vende con autorización previa del jefe inmediato.', 'Cremaciones', 'Cuerpo momificado', 0, 715000, 3401
    UNION ALL SELECT 'PRE-SJE-01', 'Servicio exequial Jericó', 'En sala de velación.', 'Servicios exequiales', 'Jericó', 0, 10950000, 4101
    UNION ALL SELECT 'PRE-SSG', 'Servicio San Gabriel', NULL, 'Servicios exequiales', 'San Gabriel', 1, NULL, 4200
    UNION ALL SELECT 'PRE-SSG-01', 'Servicio exequial San Gabriel Gold (para cremación)', 'En sala de velación.', 'Servicios exequiales', 'San Gabriel', 0, 9160000, 4201
    UNION ALL SELECT 'PRE-SSG-02', 'Servicio exequial San Gabriel (para cremación)', 'En sala de velación.', 'Servicios exequiales', 'San Gabriel', 0, 6650000, 4202
    UNION ALL SELECT 'PRE-SED-01', 'Servicio exequial Edén', 'En sala de velación.', 'Servicios exequiales', 'Edén', 0, 8900000, 4301
    UNION ALL SELECT 'PRE-SOL-01', 'Servicio exequial Olivos', 'En sala de velación.', 'Servicios exequiales', 'Olivos', 0, 7150000, 4401
    UNION ALL SELECT 'PRE-SSJ-01', 'Servicio exequial San José (San Martín, San José y Santísima Trinidad)', 'En sala de velación.', 'Servicios exequiales', 'San José', 0, 6765000, 4501
    UNION ALL SELECT 'PRE-SSI-01', 'Servicio exequial Sinaí Olivos', 'En residencia.', 'Servicios exequiales', 'Sinaí', 0, 5950000, 4601
    UNION ALL SELECT 'PRE-SCR-01', 'Servicio exequial + cremación', 'En sala de velación.', 'Servicios exequiales', 'Servicio + cremación', 0, 7950000, 4701
    UNION ALL SELECT 'PRE-INL', 'Inhumación de lotes', NULL, 'Inhumaciones', 'Lotes', 1, NULL, 5100
    UNION ALL SELECT 'PRE-INL-01', 'Inhumación 1 parte, lote', NULL, 'Inhumaciones', 'Lotes', 0, 4650000, 5101
    UNION ALL SELECT 'PRE-INL-02', 'Inhumación 2 parte, lote', NULL, 'Inhumaciones', 'Lotes', 0, 3950000, 5102
    UNION ALL SELECT 'PRE-INL-03', 'Inhumación nivel 1A para lote triple', 'Sin precio en la lista 2026.', 'Inhumaciones', 'Lotes', 0, 0, 5103
    UNION ALL SELECT 'PRE-INO', 'Inhumación de osarios', NULL, 'Inhumaciones', 'Osarios', 1, NULL, 5200
    UNION ALL SELECT 'PRE-INO-01', 'Inhumación osario tierra, 1 parte', NULL, 'Inhumaciones', 'Osarios', 0, 1550000, 5201
    UNION ALL SELECT 'PRE-INO-02', 'Inhumación osario tierra, 2 parte', NULL, 'Inhumaciones', 'Osarios', 0, 1200000, 5202
    UNION ALL SELECT 'PRE-INO-03', 'Inhumación osario mural cerámica, sencilla', NULL, 'Inhumaciones', 'Osarios', 0, 876000, 5203
    UNION ALL SELECT 'PRE-INO-04', 'Inhumación simultánea osario mural cerámica, doble', NULL, 'Inhumaciones', 'Osarios', 0, 980000, 5204
    UNION ALL SELECT 'PRE-INO-05', 'Inhumación osario mármol', NULL, 'Inhumaciones', 'Osarios', 0, 876000, 5205
    UNION ALL SELECT 'PRE-INO-06', 'Inhumación simultánea osario mármol, doble', NULL, 'Inhumaciones', 'Osarios', 0, 980000, 5206
    UNION ALL SELECT 'PRE-INC', 'Inhumación de cenizarios', NULL, 'Inhumaciones', 'Cenizarios', 1, NULL, 5300
    UNION ALL SELECT 'PRE-INC-01', 'Inhumación cenizario cerámica', NULL, 'Inhumaciones', 'Cenizarios', 0, 876000, 5301
    UNION ALL SELECT 'PRE-INC-02', 'Inhumación cenizario mármol', NULL, 'Inhumaciones', 'Cenizarios', 0, 876000, 5302
    UNION ALL SELECT 'PRE-INC-03', 'Inhumación simultánea cenizario mármol, doble', NULL, 'Inhumaciones', 'Cenizarios', 0, 980000, 5303
    UNION ALL SELECT 'PRE-INB-01', 'Inhumación columbario', NULL, 'Inhumaciones', 'Columbarios', 0, 876000, 5401
    UNION ALL SELECT 'PRE-EXL', 'Exhumación de lotes', NULL, 'Exhumaciones', 'Lotes', 1, NULL, 6100
    UNION ALL SELECT 'PRE-EXL-01', 'Exhumación 1 parte completa tradicional', NULL, 'Exhumaciones', 'Lotes', 0, 3950000, 6101
    UNION ALL SELECT 'PRE-EXL-02', 'Exhumación 2 parte completa tradicional', NULL, 'Exhumaciones', 'Lotes', 0, 3270000, 6102
    UNION ALL SELECT 'PRE-EXL-03', 'Exhumación fosa', NULL, 'Exhumaciones', 'Lotes', 0, 230000, 6103
    UNION ALL SELECT 'PRE-EXO', 'Exhumación de osarios', NULL, 'Exhumaciones', 'Osarios', 1, NULL, 6200
    UNION ALL SELECT 'PRE-EXO-01', 'Exhumación osario mural / cenizario completa tradicional', NULL, 'Exhumaciones', 'Osarios', 0, 650000, 6201
    UNION ALL SELECT 'PRE-EXO-02', 'Exhumación osario tierra, 1 parte completa tradicional', NULL, 'Exhumaciones', 'Osarios', 0, 870000, 6202
    UNION ALL SELECT 'PRE-EXO-03', 'Exhumación osario tierra, 2 parte completa tradicional', NULL, 'Exhumaciones', 'Osarios', 0, 750000, 6203
    UNION ALL SELECT 'PRE-EXC', 'Exhumación de cenizarios', NULL, 'Exhumaciones', 'Cenizarios', 1, NULL, 6300
    UNION ALL SELECT 'PRE-EXB-01', 'Exhumación columbario', NULL, 'Exhumaciones', 'Columbarios', 0, 350000, 6401
  ) p
 WHERE a.area_codigo = 'PRENEC'
ON DUPLICATE KEY UPDATE
  prod_nombre        = p.nombre,
  prod_descripcion   = p.descripcion,
  prod_categoria     = p.categoria,
  prod_tipo          = p.tipo,
  prod_es_generico   = p.generico,
  prod_precio_base   = p.precio,
  prod_activo        = 1,
  prod_orden_display = p.orden;

UPDATE sv_cfg_productos pr
  JOIN sv_cfg_areas_negocio a ON a.area_id = pr.prod_area_id
   SET pr.prod_activo = 0
 WHERE a.area_codigo = 'PRENEC'
   AND pr.prod_codigo NOT IN (
     'PRE-UT', 'PRE-UT-01', 'PRE-UT-02', 'PRE-UT-03', 'PRE-UT-04', 'PRE-UT-05', 'PRE-UT-06', 'PRE-PRR',
     'PRE-PRR-01', 'PRE-PRR-02', 'PRE-PRR-03', 'PRE-PRR-04', 'PRE-PRR-05', 'PRE-PRR-06', 'PRE-PRR-07',
     'PRE-PRR-08', 'PRE-PRR-09', 'PRE-PRR-10', 'PRE-PRR-11', 'PRE-PRR-12', 'PRE-PRR-13', 'PRE-LOT',
     'PRE-LOT-01', 'PRE-LOT-02', 'PRE-OSR', 'PRE-OSR-01', 'PRE-OSR-02', 'PRE-OSR-03', 'PRE-OSR-04',
     'PRE-OSR-05', 'PRE-OSR-06', 'PRE-OSR-07', 'PRE-CNV', 'PRE-CNV-01', 'PRE-CNV-02', 'PRE-CNV-03',
     'PRE-CNV-04', 'PRE-CNV-05', 'PRE-CLM', 'PRE-CLM-01', 'PRE-CLM-02', 'PRE-CLM-03', 'PRE-CLM-04',
     'PRE-CLM-05', 'PRE-CNZ', 'PRE-CNZ-01', 'PRE-CNZ-02', 'PRE-CNZ-03', 'PRE-CNZ-04', 'PRE-CNZ-05',
     'PRE-CRT', 'PRE-CRT-01', 'PRE-CRT-02', 'PRE-CRP', 'PRE-CRP-01', 'PRE-CRP-02', 'PRE-CRR',
     'PRE-CRR-01', 'PRE-CRR-02', 'PRE-CMM-01', 'PRE-SJE-01', 'PRE-SSG', 'PRE-SSG-01', 'PRE-SSG-02',
     'PRE-SED-01', 'PRE-SOL-01', 'PRE-SSJ-01', 'PRE-SSI-01', 'PRE-SCR-01', 'PRE-INL', 'PRE-INL-01',
     'PRE-INL-02', 'PRE-INL-03', 'PRE-INO', 'PRE-INO-01', 'PRE-INO-02', 'PRE-INO-03', 'PRE-INO-04',
     'PRE-INO-05', 'PRE-INO-06', 'PRE-INC', 'PRE-INC-01', 'PRE-INC-02', 'PRE-INC-03', 'PRE-INB-01',
     'PRE-EXL', 'PRE-EXL-01', 'PRE-EXL-02', 'PRE-EXL-03', 'PRE-EXO', 'PRE-EXO-01', 'PRE-EXO-02',
     'PRE-EXO-03', 'PRE-EXC', 'PRE-EXB-01'
   );

-- Lo elegido antes sobre un producto que ahora es "por definir", o que se retira, guardó el
-- precio de la lista vieja: no es un precio ofrecido vigente.
UPDATE sv_crm_prospectos_productos pp
  JOIN sv_cfg_productos pr     ON pr.prod_id = pp.pp_prod_id
  JOIN sv_cfg_areas_negocio a  ON a.area_id = pr.prod_area_id
   SET pp.pp_precio_ofrecido = NULL
 WHERE a.area_codigo = 'PRENEC'
   AND (pr.prod_es_generico = 1 OR pr.prod_tipo IS NULL OR pr.prod_tipo = '');

COMMIT;
```

- [ ] **Step 2:** correr 025 y 026 dos veces en MySQL 8 desechable y sin red (seed + intereses previos): segunda corrida sin cambios; otras áreas intactas; cada interés conserva su fila; los de genéricos y retirados quedan sin precio ofrecido; un precio ofrecido después de la 026 no cambia en la segunda corrida; 78 productos y 17 por definir.
- [ ] **Step 3: Commit** `feat(prenec): migración 026 con el catálogo 2026`

---

### Task 8: Integración y despliegue (con el usuario)

**Orden obligatorio:** la migración 025 va **antes** de que el backend llegue a `main`, porque los modelos piden las columnas nuevas en cada consulta de productos y otra sesión puede correr `deploy-mantix` en cualquier momento. Sin las columnas fallan la ficha y los catálogos de las cuatro áreas, y GenFlow mostraría los catálogos vacíos sin avisar.

- [ ] **Step 1:** suites completas: BACK solo con las cinco fallas conocidas; FRONT en verde y build limpio.
- [ ] **Step 2:** `git fetch origin && git merge origin/main` en BACK y FRONT; repetir las pruebas de las tareas. Verificar que el número 025 siga libre.
- [ ] **Step 3 (con confirmación):** push **solo de la rama** `feat/productos-prenec` del backend.
- [ ] **Step 4 (usuario):** migración 025, en Workbench (pegar el archivo con `USE serfuweb;` al inicio) o en el servidor desde la rama, y verificación **obligatoria** de las tres columnas (si `git show` falla, `mysql` termina sin error y no hace nada):

```bash
git fetch origin && git show origin/feat/productos-prenec:src/sv/migrations/025_productos_tipo_precio.sql | mysql -u root -p --default-character-set=utf8mb4 serfuweb
```

```sql
SHOW COLUMNS FROM sv_cfg_productos LIKE 'prod_%';
SHOW COLUMNS FROM sv_crm_prospectos_productos LIKE 'pp_precio_ofrecido';
```

- [ ] **Step 5 (con confirmación, y solo si la verificación salió bien):** push del backend a `main`. **(usuario)** `deploy-mantix`; en los logs no debe aparecer `Unknown column`.
- [ ] **Step 6 (con confirmación):** GenFlow: merge a `main`, build, respaldo, `rsync --delete --exclude '.htaccess'` y paridad de `dist/assets`.
- [ ] **Step 7 (usuario), smoke sin 026:** crear un prospecto y registrar una gestión en Prenecesidad y en otra área; todo como hoy.
- [ ] **Step 8 (usuario):** respaldo, migración 026 y recarga de GenFlow. Desde Workbench (el `mysql -u root` del servidor le dio error al usuario). Si las copias ya existen, `CREATE TABLE` falla y no las pisa: no borrarlas para repetir el paso. Durante la 026 no editar productos en Administración: un formulario abierto antes desharía el tipo de esa fila.

```sql
USE serfuweb;
CREATE TABLE sv_cfg_productos_resp20261124 AS SELECT * FROM sv_cfg_productos;
CREATE TABLE sv_crm_prospectos_productos_resp20261124 AS SELECT * FROM sv_crm_prospectos_productos;
SELECT (SELECT COUNT(*) FROM sv_cfg_productos) AS productos,
       (SELECT COUNT(*) FROM sv_cfg_productos_resp20261124) AS copia_productos,
       (SELECT COUNT(*) FROM sv_crm_prospectos_productos) AS intereses,
       (SELECT COUNT(*) FROM sv_crm_prospectos_productos_resp20261124) AS copia_intereses;
```

Los cuatro números deben coincidir de a pares. Después, con `USE serfuweb; SET SQL_SAFE_UPDATES = 0;` al inicio, el contenido completo de `026_prenec_productos_2026.sql` (Workbench rechaza en modo seguro los UPDATE con JOIN), y al final:

```sql
-- Verificación: 78 productos (0) y 17 "por definir" (1)
SELECT pr.prod_es_generico, COUNT(*) AS filas
  FROM sv_cfg_productos pr JOIN sv_cfg_areas_negocio a ON a.area_id = pr.prod_area_id
 WHERE a.area_codigo = 'PRENEC' AND pr.prod_activo = 1
 GROUP BY pr.prod_es_generico;
```

Debe dar 78 y 17. Si sale vacío, `PRENEC` no coincidió y no se cargó nada.

- [ ] **Step 9 (usuario), smoke con 026:** elegir "Osarios, por definir" y después un osario exacto; ver el precio en la ficha. Para probar que el ofrecido no cambia: editar en Administración el precio de **ese** osario, comprobar que la ficha muestra el ofrecido y el vigente, editar los intereses y comprobar que el ofrecido sigue igual, y **devolver el precio** enseguida (la ficha vuelve a mostrar solo el ofrecido). Hacerlo con un cliente de prueba y sin demora: quien elija ese producto mientras tanto guarda el precio de prueba, y ese no se corrige solo.
- [ ] **Reversión:** restaurar GenFlow y revertir el backend. La 025 puede quedarse; no borrar sus columnas mientras corra el backend nuevo. La 026 se revierte con las copias del Step 8 (probado en 8.0 y 8.4: los productos activos quedan exactamente como antes, y la 026 se puede volver a aplicar):

```sql
USE serfuweb;
SET SQL_SAFE_UPDATES = 0;
START TRANSACTION;
UPDATE sv_cfg_productos pr JOIN sv_cfg_areas_negocio a ON a.area_id = pr.prod_area_id
   SET pr.prod_activo = 0
 WHERE a.area_codigo = 'PRENEC' AND pr.prod_tipo IS NOT NULL AND pr.prod_tipo <> '';
UPDATE sv_cfg_productos p
  JOIN sv_cfg_productos_resp20261124 r ON r.prod_id = p.prod_id
  JOIN sv_cfg_areas_negocio a ON a.area_id = p.prod_area_id
   SET p.prod_nombre = r.prod_nombre, p.prod_descripcion = r.prod_descripcion, p.prod_categoria = r.prod_categoria,
       p.prod_tipo = r.prod_tipo, p.prod_es_generico = r.prod_es_generico, p.prod_precio_base = r.prod_precio_base,
       p.prod_activo = r.prod_activo, p.prod_orden_display = r.prod_orden_display
 WHERE a.area_codigo = 'PRENEC';
COMMIT;
```

La copia de intereses es solo de consulta. Con el backend anterior, editar los intereses de un cliente borra sus precios ofrecidos, porque ese código borra y recrea las filas. Cuando el catálogo quede estable, borrar las dos tablas `_resp20261124`.
