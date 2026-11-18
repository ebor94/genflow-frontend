# Visitas de Prenecesidad en salas de velación — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los asesores de Prenecesidad ven en GenFlow los homenajes en curso de las salas de velación (datos de Homenajes360), atienden al contratante y registran cada visita con el proceso de telemercadeo y el canal `visita_sala`.

**Architecture:** En el backend, el módulo `sv` lee las tablas de Homenajes360 en modo de solo lectura (están en la misma base). Un servicio `salas.service` vincula cada homenaje con un cliente de Prenecesidad (tabla `sv_crm_salas_contratantes`) y registra las visitas reutilizando `gestiones.service.crear`, con cuatro endpoints propios bajo `/sv/salas`. En GenFlow se agregan una pantalla nueva `/prenec/salas`, una ventana para atender al contratante, el modo sala de `RegistrarGestion` y un aviso en la ficha cuando llega `?homenaje=`.

**Tech Stack:** Express 4, Sequelize 6, MySQL 8, Joi y Jest con supertest en `mantix-backend`. Vue 3 (script setup), Pinia, Vitest, @vue/test-utils y @pinia/testing en `crm-frontend`.

**Spec:** `crm-frontend/docs/superpowers/specs/2026-11-18-visitas-salas-velacion-design.md`

## Global Constraints

- Pruebas del backend solo con `jest.mock`: nunca `sequelize.sync` ni conexión a la base, porque la única base es la de producción compartida.
- Todo handler Express nuevo es async con `try/catch` y termina en `next(e)` o en una respuesta. `server.js` hace `process.exit(1)` ante un `unhandledRejection`.
- Las tablas de Homenajes360 (`homenajes_sala`, `asistencias`, `salas_velacion`, `sedes`) solo se leen con `SELECT`. Nunca se escribe en ellas.
- Los catálogos se buscan por código: área `PRENEC`, grupo `TELEMERCADEO`, fuente `SALA_VELACION`. El código nunca lleva identificadores numéricos fijos.
- El valor del canal es exactamente `visita_sala`. En la interfaz se muestra exactamente "🏛️ Visita en sala".
- Las líneas de log `SALA_ATENDER` y `SALA_VISITA` llevan solo identificadores. Nunca el nombre ni el teléfono del contratante.
- Códigos de error exactos:

  | Código | HTTP |
  |---|---|
  | `HOMENAJE_NO_ENCONTRADO` | 404 |
  | `HOMENAJE_CERRADO` | 409 |
  | `SIN_ATENDER` | 409 |
  | `CLIENTE_INACTIVO` | 409 |
  | `TELEFONO_REQUERIDO` | 422 |
  | `NOMBRE_REQUERIDO` | 422 |
  | `RESULTADO_INVALIDO` | 422 |
  | `ESTADO_INVALIDO` | 422 |
  | `PROX_FECHA_REQUERIDA` | 422 |
  | `FORBIDDEN` | 403 |
  | `CATALOGO_INCOMPLETO` | 500 |

- No se tocan `src/sv/controllers/gestiones.controller.js`, `src/sv/routes/gestiones.routes.js` ni `src/sv/validations/crm.validation.js`, que cambian en la rama `fix/permisos-gestiones` de otra sesión. De `gestiones.service.js` solo se agrega un campo.
- Textos en español, exactamente como aparecen en las tareas.
- Cada subagente firma sus commits con su propio modelo (`Co-Authored-By: <su modelo> <noreply@anthropic.com>`).
- Se trabaja solo en los worktrees indicados. No se toca la rama `main` de los checkouts compartidos.

## Preparación (la hace el controlador antes de la Task 1)

```bash
M="/Users/bortega/Shared/Files From c.localized/apps/mantix"
mkdir -p "$M/.wt"
git -C "$M/mantix-backend" fetch origin
git -C "$M/mantix-backend" worktree add -b feat/salas-velacion "$M/.wt/mantix-backend-salas" origin/main
ln -s "$M/mantix-backend/node_modules" "$M/.wt/mantix-backend-salas/node_modules"
git -C "$M/crm-frontend" worktree add -b feat/salas-velacion "$M/.wt/crm-frontend-salas" main
ln -s "$M/crm-frontend/node_modules" "$M/.wt/crm-frontend-salas/node_modules"
```

- **BACK** = `/Users/bortega/Shared/Files From c.localized/apps/mantix/.wt/mantix-backend-salas` (Tasks 1-6)
- **FRONT** = `/Users/bortega/Shared/Files From c.localized/apps/mantix/.wt/crm-frontend-salas` (Tasks 7-11)

Antes de empezar, confirma que el número 023 sigue libre:

```bash
git -C "$M/mantix-backend" ls-tree --name-only origin/main src/sv/migrations/
```

Si ya existe un `023_*`, usa el siguiente número libre en todo el plan.

## Mapa de archivos

**Backend (BACK)**

| Archivo | Responsabilidad |
|---|---|
| `src/sv/migrations/023_salas_velacion.sql` (nuevo) | Fuente `SALA_VELACION`, columna `gest_homenaje_sala_id` y tabla `sv_crm_salas_contratantes` |
| `src/sv/models/SalaContratante.js` (nuevo) | Modelo `SvSalaContratante` |
| `src/sv/models/Gestion.js` | Atributo `gest_homenaje_sala_id` |
| `src/sv/models/index.js` | Registro de `SvSalaContratante` |
| `src/sv/services/gestiones.service.js` | Guardar `gest_homenaje_sala_id` |
| `src/sv/services/homenajesSala.repo.js` (nuevo) | Lectura de Homenajes360 |
| `src/sv/utils/contratante.js` (nuevo) | `primerTelefonoValido` y `formatearNombre` |
| `src/sv/services/salaError.js` (nuevo) | Clase `SalaError(code, status, message)` |
| `src/sv/services/salas.service.js` (nuevo) | `listar`, `obtener`, `atender`, `registrarVisita` |
| `src/sv/validations/salas.validation.js` (nuevo) | Esquemas Joi `atender` y `visita` |
| `src/sv/controllers/salas.controller.js` (nuevo) | Handlers HTTP |
| `src/sv/routes/salas.routes.js` (nuevo) | Rutas `/homenajes…` |
| `src/sv/routes/index.js` | Montaje de `/salas` |

**GenFlow (FRONT)**

| Archivo | Responsabilidad |
|---|---|
| `src/api/salasApi.js` (nuevo) | Cliente de los cuatro endpoints |
| `src/components/common/HistorialItem.vue` | Ícono y texto de `visita_sala` |
| `src/views/comun/HistorialClienteCompleto.vue` | Ícono y texto de `visita_sala` |
| `src/components/crm/RegistrarGestion.vue` | Modo sala (`homenajeSalaId`, `resumenCliente`) |
| `src/components/salas/AtenderContratanteModal.vue` (nuevo) | Confirmar la atención y pedir los datos que falten |
| `src/views/prenecesidad/SalasVelacion.vue` (nuevo) | Pantalla de salas |
| `src/router/index.js` | Ruta `prenec-salas` |
| `src/components/layout/BottomNav.vue`, `AppSidebar.vue`, `AppHeader.vue` | Entrada "Salas" en el menú |
| `src/views/prenecesidad/FichaCliente.vue` | Aviso y modo sala con `?homenaje=` |

---

### Task 1: Migración 023, modelos y campo en `gestiones.service`

Directorio: **BACK**.

**Files:**
- Create: `src/sv/migrations/023_salas_velacion.sql`
- Create: `src/sv/models/SalaContratante.js`
- Modify: `src/sv/models/Gestion.js:17` (atributo nuevo)
- Modify: `src/sv/models/index.js:54` (registro)
- Modify: `src/sv/services/gestiones.service.js:17-30` (campo nuevo en `SvGestion.create`)
- Test: `tests/salasVelacion.models.test.js`, `tests/gestionesHomenaje.service.test.js`

**Interfaces:**
- Produce: el modelo `SvSalaContratante`, con los atributos `sc_id`, `sc_homenaje_sala_id`, `sc_prosp_id`, `sc_usr_id` y `sc_created_at`, y las asociaciones `prospecto` (hacia `SvProspecto`) y `vinculadoPor` (hacia `SvUsuario`).
- Produce: el atributo `SvGestion.gest_homenaje_sala_id`.
- Produce: `gestiones.service.crear(payload, asesorId)`, que ahora guarda `payload.gest_homenaje_sala_id`, o `null` si no viene.

- [ ] **Step 1: Write the failing tests**

`tests/salasVelacion.models.test.js`:

```js
const { DataTypes } = require('sequelize');

// Ejecuta la factory del modelo con un sequelize falso, sin abrir conexión a la base.
function atributosDe(factory) {
  let attrs = null;
  let opts = null;
  const modelo = { beforeUpdate() {}, beforeDestroy() {} };
  const fakeSequelize = { define: (_nombre, a, o) => { attrs = a; opts = o; return modelo; } };
  factory(fakeSequelize, DataTypes);
  return { attrs, opts };
}

describe('modelos de salas de velación', () => {
  test('SvGestion tiene gest_homenaje_sala_id entero y opcional', () => {
    const { attrs } = atributosDe(require('../src/sv/models/Gestion'));
    expect(attrs.gest_homenaje_sala_id).toBeDefined();
    expect(attrs.gest_homenaje_sala_id.type.key).toBe('INTEGER');
    expect(attrs.gest_homenaje_sala_id.allowNull).not.toBe(false);
  });

  test('SvSalaContratante apunta a sv_crm_salas_contratantes', () => {
    const { attrs, opts } = atributosDe(require('../src/sv/models/SalaContratante'));
    expect(opts.tableName).toBe('sv_crm_salas_contratantes');
    expect(attrs.sc_homenaje_sala_id.allowNull).toBe(false);
    expect(attrs.sc_prosp_id.allowNull).toBe(false);
    expect(attrs.sc_usr_id.allowNull).toBe(false);
    expect(opts.createdAt).toBe('sc_created_at');
    expect(opts.updatedAt).toBe(false);
  });
});
```

`tests/gestionesHomenaje.service.test.js`:

```js
jest.mock('../src/sv/models', () => {
  const t = { commit: jest.fn(), rollback: jest.fn() };
  return {
    sequelize: { transaction: jest.fn(async () => t) },
    SvGestion: {
      create: jest.fn(async (d) => ({ gest_id: 1, ...d })),
      findByPk: jest.fn(async () => ({ gest_id: 1, dataValues: {} }))
    },
    SvProspecto: { update: jest.fn(), findByPk: jest.fn(async () => ({ prosp_id: 9 })) },
    SvResultado: {},
    SvEstado: { findByPk: jest.fn(async () => null) },
    SvUsuario: {}
  };
});
jest.mock('../src/sv/services/recuperacionAuto.service', () => ({ intentarRecuperacion: jest.fn(async () => null) }));
jest.mock('../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { SvGestion } = require('../src/sv/models');
const gestiones = require('../src/sv/services/gestiones.service');

beforeEach(() => jest.clearAllMocks());

test('guarda gest_homenaje_sala_id cuando viene', async () => {
  await gestiones.crear({ gest_prosp_id: 9, gest_canal: 'visita_sala', gest_homenaje_sala_id: 55 }, 7);
  expect(SvGestion.create.mock.calls[0][0]).toEqual(expect.objectContaining({
    gest_prosp_id: 9, gest_canal: 'visita_sala', gest_homenaje_sala_id: 55, gest_asesor_id: 7
  }));
});

test('deja gest_homenaje_sala_id en null cuando no viene', async () => {
  await gestiones.crear({ gest_prosp_id: 9 }, 7);
  expect(SvGestion.create.mock.calls[0][0].gest_homenaje_sala_id).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/salasVelacion.models.test.js tests/gestionesHomenaje.service.test.js`
Expected: FAIL. El modelo `SalaContratante` no existe y `gest_homenaje_sala_id` es `undefined`.

- [ ] **Step 3: Create the migration** `src/sv/migrations/023_salas_velacion.sql`

```sql
-- =====================================================================
-- SerVentas CRM — Migración 023: visitas de Prenecesidad en salas de velación
--
-- 1) Fuente SALA_VELACION ("Sala de velación") en Prenecesidad.
-- 2) sv_crm_gestiones.gest_homenaje_sala_id: homenaje en sala (Homenajes360)
--    donde se hizo la visita. Sin FK para no acoplar los módulos.
-- 3) sv_crm_salas_contratantes: qué cliente de Prenecesidad es el contratante
--    de cada homenaje (uno por homenaje).
-- Idempotente. Inofensiva para el código anterior.
-- =====================================================================

SET NAMES utf8mb4;

INSERT INTO sv_cfg_fuentes_prospecto (fuente_area_id, fuente_codigo, fuente_nombre, fuente_es_masiva, fuente_orden)
SELECT a.area_id, 'SALA_VELACION', 'Sala de velación', 0, 7
  FROM sv_cfg_areas_negocio a
 WHERE a.area_codigo = 'PRENEC'
   AND NOT EXISTS (SELECT 1 FROM sv_cfg_fuentes_prospecto f
                    WHERE f.fuente_area_id = a.area_id AND f.fuente_codigo = 'SALA_VELACION');

SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'sv_crm_gestiones'
                  AND COLUMN_NAME  = 'gest_homenaje_sala_id');
SET @sql = IF(@existe = 0,
  'ALTER TABLE sv_crm_gestiones ADD COLUMN gest_homenaje_sala_id INT NULL AFTER gest_ubicacion_lng',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @existe = (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'sv_crm_gestiones'
                  AND INDEX_NAME   = 'idx_gest_homenaje');
SET @sql = IF(@existe = 0,
  'ALTER TABLE sv_crm_gestiones ADD INDEX idx_gest_homenaje (gest_homenaje_sala_id)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS sv_crm_salas_contratantes (
  sc_id               INT      AUTO_INCREMENT PRIMARY KEY,
  sc_homenaje_sala_id INT      NOT NULL,
  sc_prosp_id         INT      NOT NULL,
  sc_usr_id           INT      NOT NULL,
  sc_created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sc_homenaje (sc_homenaje_sala_id),
  INDEX idx_sc_prosp (sc_prosp_id),
  CONSTRAINT fk_sc_prosp FOREIGN KEY (sc_prosp_id) REFERENCES sv_crm_prospectos(prosp_id),
  CONSTRAINT fk_sc_usr   FOREIGN KEY (sc_usr_id)   REFERENCES sv_org_usuarios(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'SerVentas: contratante (cliente PRENEC) de cada homenaje en sala';
```

- [ ] **Step 4: Create the model** `src/sv/models/SalaContratante.js`

```js
// sv/models/SalaContratante.js — sv_crm_salas_contratantes (migración 023)
module.exports = (sequelize, DataTypes) => {
  const SalaContratante = sequelize.define('SvSalaContratante', {
    sc_id:               { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sc_homenaje_sala_id: { type: DataTypes.INTEGER, allowNull: false, unique: 'uq_sc_homenaje' },
    sc_prosp_id:         { type: DataTypes.INTEGER, allowNull: false },
    sc_usr_id:           { type: DataTypes.INTEGER, allowNull: false }
  }, {
    tableName: 'sv_crm_salas_contratantes',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'sc_created_at',
    updatedAt: false
  });

  SalaContratante.associate = (models) => {
    SalaContratante.belongsTo(models.SvProspecto, { as: 'prospecto',    foreignKey: 'sc_prosp_id' });
    SalaContratante.belongsTo(models.SvUsuario,   { as: 'vinculadoPor', foreignKey: 'sc_usr_id' });
  };
  return SalaContratante;
};
```

- [ ] **Step 5: Add the attribute** in `src/sv/models/Gestion.js`

Reemplaza la línea de `gest_ubicacion_lng`:

```js
    gest_ubicacion_lng:    { type: DataTypes.DECIMAL(11, 8) },
    gest_homenaje_sala_id: { type: DataTypes.INTEGER }   // homenaje en sala de Homenajes360 (migración 023)
```

La línea anterior era `    gest_ubicacion_lng:    { type: DataTypes.DECIMAL(11, 8) }` y no llevaba coma.

- [ ] **Step 6: Register the model** in `src/sv/models/index.js`

Reemplaza:

```js
  SvFidelizMovimiento:       require('./FidelizMovimiento')(sequelize, Sequelize.DataTypes)
};
```

por:

```js
  SvFidelizMovimiento:       require('./FidelizMovimiento')(sequelize, Sequelize.DataTypes),
  // ─── Salas de velación: visitas de Prenecesidad (migración 023) ───
  SvSalaContratante:         require('./SalaContratante')(sequelize, Sequelize.DataTypes)
};
```

- [ ] **Step 7: Save the field** in `src/sv/services/gestiones.service.js`

Dentro de `SvGestion.create({ ... })`, en `crear`, reemplaza:

```js
      gest_ubicacion_lng:   payload.gest_ubicacion_lng || null,
      gest_fecha_hora:      payload.gest_fecha_hora || new Date()
```

por:

```js
      gest_ubicacion_lng:   payload.gest_ubicacion_lng || null,
      gest_homenaje_sala_id: payload.gest_homenaje_sala_id || null,
      gest_fecha_hora:      payload.gest_fecha_hora || new Date()
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest tests/salasVelacion.models.test.js tests/gestionesHomenaje.service.test.js`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/sv/migrations/023_salas_velacion.sql src/sv/models/SalaContratante.js src/sv/models/Gestion.js src/sv/models/index.js src/sv/services/gestiones.service.js tests/salasVelacion.models.test.js tests/gestionesHomenaje.service.test.js
git commit -m "feat(salas): migración 023, modelo de contratantes y homenaje en la gestión"
```

---

### Task 2: Lectura de Homenajes360 y datos del contratante

Directorio: **BACK**.

**Files:**
- Create: `src/sv/services/homenajesSala.repo.js`
- Create: `src/sv/utils/contratante.js`
- Test: `tests/homenajesSala.repo.test.js`, `tests/contratante.utils.test.js`

**Interfaces:**
- Produce `repo.listarEnCurso() → Promise<Fila[]>` y `repo.obtener(id) → Promise<Fila|null>`. Cada `Fila` es `{ id, estado, registrado_at, sala_nombre, sede_nombre, asistencia_codigo, nombre_ser_querido, contrato, contratante_nombre, contratante_telefono }`.
- Produce `repo.estaEnCurso(fila) → boolean`.
- Produce `primerTelefonoValido(texto) → string|null`, que devuelve el teléfono normalizado o `null`, y `formatearNombre(texto) → string`, que devuelve `''` si no hay nombre.

- [ ] **Step 1: Write the failing tests**

`tests/homenajesSala.repo.test.js`:

```js
jest.mock('../src/sv/models', () => ({ sequelize: { query: jest.fn() } }));

const { sequelize } = require('../src/sv/models');
const repo = require('../src/sv/services/homenajesSala.repo');

beforeEach(() => jest.clearAllMocks());

describe('homenajesSala.repo', () => {
  test('listarEnCurso excluye FINALIZADO y ordena del más reciente', async () => {
    sequelize.query.mockResolvedValue([{ id: 1 }]);
    const filas = await repo.listarEnCurso();
    expect(filas).toEqual([{ id: 1 }]);
    const [sql, opts] = sequelize.query.mock.calls[0];
    expect(sql).toMatch(/FROM homenajes_sala h/);
    expect(sql).toMatch(/h\.estado <> :fin/);
    expect(sql).toMatch(/ORDER BY h\.created_at DESC/);
    expect(opts.replacements).toEqual({ fin: 'FINALIZADO' });
    expect(opts.type).toBe('SELECT');
  });

  test('obtener devuelve la fila o null', async () => {
    sequelize.query.mockResolvedValueOnce([{ id: 56 }]).mockResolvedValueOnce([]);
    expect(await repo.obtener(56)).toEqual({ id: 56 });
    expect(sequelize.query.mock.calls[0][1].replacements).toEqual({ id: 56 });
    expect(await repo.obtener(99)).toBeNull();
  });

  test('las consultas solo leen', async () => {
    sequelize.query.mockResolvedValue([]);
    await repo.listarEnCurso();
    await repo.obtener(1);
    for (const [sql] of sequelize.query.mock.calls) {
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER)\b/i);
    }
  });

  test('estaEnCurso', () => {
    expect(repo.estaEnCurso({ estado: 'ABIERTO' })).toBe(true);
    expect(repo.estaEnCurso({ estado: 'SALIDA_REGISTRADA' })).toBe(true);
    expect(repo.estaEnCurso({ estado: 'FINALIZADO' })).toBe(false);
    expect(repo.estaEnCurso(null)).toBe(false);
  });
});
```

`tests/contratante.utils.test.js`:

```js
const { primerTelefonoValido, formatearNombre } = require('../src/sv/utils/contratante');

describe('primerTelefonoValido', () => {
  test.each([
    ['3001234567', '3001234567'],
    ['300 123 4567', '3001234567'],
    ['300-123-4567', '3001234567'],
    ['+57 300 123 4567', '3001234567'],
    ['3001234567 / 3109876543', '3001234567'],
    ['3001234567 - 3109876543', '3001234567'],
    ['abc / 3109876543', '3109876543'],
    ['12; 3109876543', '3109876543']
  ])('%s → %s', (entrada, esperado) => {
    expect(primerTelefonoValido(entrada)).toBe(esperado);
  });

  test.each([[null], [undefined], [''], ['   '], ['abc'], ['12']])('%p → null', (entrada) => {
    expect(primerTelefonoValido(entrada)).toBeNull();
  });
});

describe('formatearNombre', () => {
  test('mayúscula inicial en cada palabra y espacios simples', () => {
    expect(formatearNombre('CASTILLA MORENO ANA CELIS')).toBe('Castilla Moreno Ana Celis');
    expect(formatearNombre('  luz   dary  pérez ')).toBe('Luz Dary Pérez');
    expect(formatearNombre('ÁNGEL')).toBe('Ángel');
  });
  test('vacío si no hay nombre', () => {
    expect(formatearNombre(null)).toBe('');
    expect(formatearNombre('   ')).toBe('');
  });
  test('máximo 100 caracteres', () => {
    expect(formatearNombre('a'.repeat(150))).toHaveLength(100);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/homenajesSala.repo.test.js tests/contratante.utils.test.js`
Expected: FAIL con "Cannot find module".

- [ ] **Step 3: Implement** `src/sv/services/homenajesSala.repo.js`

```js
/**
 * sv/services/homenajesSala.repo.js
 * Lectura (solo SELECT) de los homenajes en sala de Homenajes360, que viven en
 * la misma base. El módulo sv nunca escribe en estas tablas.
 */
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const ESTADO_FINALIZADO = 'FINALIZADO';

const SELECT_HOMENAJE = `
  SELECT h.id, h.estado, h.created_at AS registrado_at,
         sv.nombre AS sala_nombre, s.nombre AS sede_nombre,
         a.codigo AS asistencia_codigo, a.nombre_ser_querido, a.contrato,
         a.nombre_contacto AS contratante_nombre, a.telefono_contacto AS contratante_telefono
    FROM homenajes_sala h
    LEFT JOIN asistencias a     ON a.id  = h.asistencia_id
    LEFT JOIN salas_velacion sv ON sv.id = h.sala_id
    LEFT JOIN sedes s           ON s.id  = sv.sede_id`;

async function listarEnCurso() {
  return sequelize.query(
    `${SELECT_HOMENAJE}
     WHERE h.estado <> :fin
     ORDER BY h.created_at DESC, h.id DESC
     LIMIT 200`,
    { replacements: { fin: ESTADO_FINALIZADO }, type: QueryTypes.SELECT }
  );
}

async function obtener(id) {
  const filas = await sequelize.query(
    `${SELECT_HOMENAJE} WHERE h.id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return filas[0] || null;
}

function estaEnCurso(fila) {
  return !!fila && fila.estado !== ESTADO_FINALIZADO;
}

module.exports = { listarEnCurso, obtener, estaEnCurso };
```

- [ ] **Step 4: Implement** `src/sv/utils/contratante.js`

```js
/**
 * sv/utils/contratante.js
 * Datos del contratante de un homenaje en sala, tal como vienen de Homenajes360.
 */
const { normalizar, esValido } = require('./telefono');

// Separadores entre varios números en un mismo campo. " - " va con espacios para no
// partir un número escrito como 300-123-4567.
const SEPARADORES = /\s*[\/,;|]\s*|\s+-\s+/;

function primerTelefonoValido(texto) {
  if (texto == null) return null;
  for (const parte of String(texto).split(SEPARADORES)) {
    const p = parte.trim();
    if (p && esValido(p)) return normalizar(p);
  }
  return null;
}

function formatearNombre(texto) {
  return String(texto || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_m, espacio, letra) => espacio + letra.toUpperCase())
    .slice(0, 100);
}

module.exports = { primerTelefonoValido, formatearNombre };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/homenajesSala.repo.test.js tests/contratante.utils.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sv/services/homenajesSala.repo.js src/sv/utils/contratante.js tests/homenajesSala.repo.test.js tests/contratante.utils.test.js
git commit -m "feat(salas): lectura de homenajes en curso y datos del contratante"
```

---

### Task 3: Servicio de salas — catálogos, permisos, `listar` y `obtener`

Directorio: **BACK**.

**Files:**
- Create: `src/sv/services/salaError.js`
- Create: `src/sv/services/salas.service.js`
- Test: `tests/salas.service.test.js`. Las Tasks 4 y 5 agregan bloques `describe` a este mismo archivo.

**Interfaces:**
- Consume: `repo.listarEnCurso`, `repo.obtener` y `repo.estaEnCurso` (Task 2); `SvSalaContratante` y `SvGestion.gest_homenaje_sala_id` (Task 1).
- Produce: `class SalaError extends Error { code, status }`, exportada como `module.exports = SalaError`.
- Produce: `salas.listar(user) → Promise<Item[]>` y `salas.obtener(id, user) → Promise<Item>`. Cada `Item` es una fila del repo más:
  - `cliente`: `null`, o `{ prosp_id, es_mio, duenio_nombre, estado_nombre }`
  - `visitas`: `[{ asesor_nombre, fecha_hora }]`
  - `puede_atender`: `boolean`
- Produce (internos que usan las Tasks 4 y 5): `catalogos() → { areaId, grupoId, fuenteId, estadoInicialId }`, `exigirAsesor(user, cat)` y `nombreDe(usuario)`.

- [ ] **Step 1: Write the failing tests** `tests/salas.service.test.js`

```js
// Mocks compartidos por las Tasks 3, 4 y 5 (listar/obtener, atender, visitas).
jest.mock('../src/sv/models', () => ({
  sequelize: { transaction: jest.fn() },
  SvArea: { findOne: jest.fn() },
  SvGrupo: { findOne: jest.fn() },
  SvFuente: { findOne: jest.fn() },
  SvEstado: { findOne: jest.fn() },
  SvResultado: { findOne: jest.fn() },
  SvProspecto: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  SvPersona: {},
  SvUsuario: {},
  SvGestion: { findAll: jest.fn(), findOne: jest.fn() },
  SvSalaContratante: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() }
}));
jest.mock('../src/sv/services/homenajesSala.repo', () => ({
  listarEnCurso: jest.fn(),
  obtener: jest.fn(),
  estaEnCurso: jest.fn((h) => !!h && h.estado !== 'FINALIZADO')
}));
jest.mock('../src/sv/services/personas.service', () => ({ buscarPorTelefono: jest.fn(), crear: jest.fn() }));
jest.mock('../src/sv/services/gestiones.service', () => ({ crear: jest.fn() }));
jest.mock('../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const M = require('../src/sv/models');
const repo = require('../src/sv/services/homenajesSala.repo');
const salas = require('../src/sv/services/salas.service');
const SalaError = require('../src/sv/services/salaError');

const ASESOR     = { usr_id: 7, usr_area_id: 1, rol: { rol_codigo: 'ASESOR' } };
const SUPERVISOR = { usr_id: 3, usr_area_id: 1, rol: { rol_codigo: 'SUPERVISOR' } };
const AJENO      = { usr_id: 20, usr_area_id: 2, rol: { rol_codigo: 'ASESOR' } };
const ADMIN      = { usr_id: 1, rol: { rol_codigo: 'SUPER_ADMIN' } };

const H = (id, extra = {}) => ({
  id, estado: 'ABIERTO', registrado_at: '2026-11-18T09:00:00',
  sala_nombre: 'Sala 3', sede_nombre: 'Sede Norte', asistencia_codigo: 'A-1',
  nombre_ser_querido: 'Luis Pérez', contrato: 'C-9',
  contratante_nombre: 'MARTA GOMEZ', contratante_telefono: '300 123 4567', ...extra
});

function catalogosOk() {
  M.SvArea.findOne.mockResolvedValue({ area_id: 1 });
  M.SvGrupo.findOne.mockResolvedValue({ grupo_id: 1 });
  M.SvFuente.findOne.mockResolvedValue({ fuente_id: 40 });
  // Sin estado_id en el where = búsqueda del estado inicial del grupo.
  M.SvEstado.findOne.mockImplementation(async ({ where }) => (where.estado_id ? null : { estado_id: 11 }));
}

async function esperarError(promesa, code, status) {
  const e = await promesa.then(() => null, (err) => err);
  expect(e).toBeInstanceOf(SalaError);
  expect(e.code).toBe(code);
  expect(e.status).toBe(status);
}

beforeEach(() => {
  jest.resetAllMocks();
  repo.estaEnCurso.mockImplementation((h) => !!h && h.estado !== 'FINALIZADO');
  catalogosOk();
  M.SvSalaContratante.findAll.mockResolvedValue([]);
  M.SvGestion.findAll.mockResolvedValue([]);
});

describe('listar', () => {
  test('403 para un usuario sin acceso a Prenecesidad', async () => {
    await esperarError(salas.listar(AJENO), 'FORBIDDEN', 403);
    expect(repo.listarEnCurso).not.toHaveBeenCalled();
  });

  test('500 CATALOGO_INCOMPLETO si falta la fuente', async () => {
    M.SvFuente.findOne.mockResolvedValue(null);
    await esperarError(salas.listar(ASESOR), 'CATALOGO_INCOMPLETO', 500);
  });

  test('busca los catálogos por código', async () => {
    repo.listarEnCurso.mockResolvedValue([]);
    await salas.listar(ASESOR);
    expect(M.SvArea.findOne).toHaveBeenCalledWith({ where: { area_codigo: 'PRENEC' } });
    expect(M.SvGrupo.findOne).toHaveBeenCalledWith({ where: { grupo_codigo: 'TELEMERCADEO', grupo_area_id: 1 } });
    expect(M.SvFuente.findOne).toHaveBeenCalledWith({ where: { fuente_codigo: 'SALA_VELACION', fuente_area_id: 1 } });
  });

  test('sin homenajes devuelve [] sin consultar vínculos', async () => {
    repo.listarEnCurso.mockResolvedValue([]);
    expect(await salas.listar(ASESOR)).toEqual([]);
    expect(M.SvSalaContratante.findAll).not.toHaveBeenCalled();
  });

  test('arma cliente, visitas y puede_atender', async () => {
    repo.listarEnCurso.mockResolvedValue([H(55), H(56), H(57)]);
    M.SvSalaContratante.findAll.mockResolvedValue([
      { sc_homenaje_sala_id: 56, sc_prosp_id: 900,
        prospecto: { prosp_id: 900, prosp_asesor_id: 7, asesor: { usr_nombre: 'Denis', usr_apellido: 'Moreno' }, estado: { estado_nombre: 'Interesado' } } },
      { sc_homenaje_sala_id: 57, sc_prosp_id: 901,
        prospecto: { prosp_id: 901, prosp_asesor_id: 8, asesor: { usr_nombre: 'Carmen', usr_apellido: 'Contreras' }, estado: { estado_nombre: 'Contactado' } } }
    ]);
    M.SvGestion.findAll.mockResolvedValue([
      { gest_homenaje_sala_id: 57, gest_fecha_hora: '2026-11-18T15:05:00', asesor: { usr_nombre: 'Denis', usr_apellido: 'Moreno' } },
      { gest_homenaje_sala_id: 57, gest_fecha_hora: '2026-11-18T10:40:00', asesor: { usr_nombre: 'Carmen', usr_apellido: 'Contreras' } }
    ]);

    const [a, b, c] = await salas.listar(ASESOR);

    expect(a.cliente).toBeNull();
    expect(a.visitas).toEqual([]);
    expect(a.puede_atender).toBe(true);
    expect(a.sala_nombre).toBe('Sala 3');
    expect(b.cliente).toEqual({ prosp_id: 900, es_mio: true, duenio_nombre: 'Denis Moreno', estado_nombre: 'Interesado' });
    expect(c.cliente).toEqual({ prosp_id: 901, es_mio: false, duenio_nombre: 'Carmen Contreras', estado_nombre: 'Contactado' });
    expect(c.visitas).toEqual([
      { asesor_nombre: 'Denis Moreno', fecha_hora: '2026-11-18T15:05:00' },
      { asesor_nombre: 'Carmen Contreras', fecha_hora: '2026-11-18T10:40:00' }
    ]);
    const consultaVisitas = M.SvGestion.findAll.mock.calls[0][0];
    expect(consultaVisitas.order).toEqual([['gest_fecha_hora', 'DESC']]);
  });

  test('supervisor y super admin ven la lista sin poder atender', async () => {
    repo.listarEnCurso.mockResolvedValue([H(55)]);
    expect((await salas.listar(SUPERVISOR))[0].puede_atender).toBe(false);
    expect((await salas.listar(ADMIN))[0].puede_atender).toBe(false);
  });
});

describe('obtener', () => {
  test('404 si el homenaje no existe', async () => {
    repo.obtener.mockResolvedValue(null);
    await esperarError(salas.obtener(99, ASESOR), 'HOMENAJE_NO_ENCONTRADO', 404);
  });

  test('403 sin acceso a Prenecesidad', async () => {
    await esperarError(salas.obtener(55, AJENO), 'FORBIDDEN', 403);
  });

  test('devuelve el homenaje armado', async () => {
    repo.obtener.mockResolvedValue(H(55));
    const item = await salas.obtener(55, ASESOR);
    expect(item.id).toBe(55);
    expect(item.cliente).toBeNull();
    expect(item.puede_atender).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/salas.service.test.js`
Expected: FAIL con "Cannot find module '../src/sv/services/salas.service'".

- [ ] **Step 3: Implement** `src/sv/services/salaError.js`

```js
// sv/services/salaError.js — error de negocio de salas de velación (código + HTTP).
class SalaError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = 'SalaError';
    this.code = code;
    this.status = status;
  }
}

module.exports = SalaError;
```

- [ ] **Step 4: Implement** `src/sv/services/salas.service.js`

```js
/**
 * sv/services/salas.service.js
 * Visitas de Prenecesidad en salas de velación (spec 2026-11-18).
 * Lee los homenajes en curso de Homenajes360 y vincula a su contratante con un
 * cliente de Prenecesidad.
 */
const { Op } = require('sequelize');
const {
  SvArea, SvGrupo, SvFuente, SvEstado, SvProspecto, SvUsuario, SvGestion, SvSalaContratante
} = require('../models');
const { ROLES, AREAS } = require('../config/constants');
const { areaIdsAccesibles } = require('../utils/acceso');
const repo = require('./homenajesSala.repo');
const SalaError = require('./salaError');

const GRUPO_TELEMERCADEO = 'TELEMERCADEO';
const FUENTE_SALA = 'SALA_VELACION';

async function catalogos() {
  const area = await SvArea.findOne({ where: { area_codigo: AREAS.PRENEC } });
  const grupo = area && await SvGrupo.findOne({ where: { grupo_codigo: GRUPO_TELEMERCADEO, grupo_area_id: area.area_id } });
  const fuente = area && await SvFuente.findOne({ where: { fuente_codigo: FUENTE_SALA, fuente_area_id: area.area_id } });
  const estadoInicial = grupo && await SvEstado.findOne({
    where: { estado_grupo_id: grupo.grupo_id, estado_activo: 1 },
    order: [['estado_orden', 'ASC']]
  });
  if (!area || !grupo || !fuente || !estadoInicial) {
    throw new SalaError('CATALOGO_INCOMPLETO', 500,
      'Falta configurar Prenecesidad para salas de velación (¿se aplicó la migración 023?)');
  }
  return {
    areaId: area.area_id,
    grupoId: grupo.grupo_id,
    fuenteId: fuente.fuente_id,
    estadoInicialId: estadoInicial.estado_id
  };
}

function tieneAccesoPrenec(user, areaId) {
  const ids = areaIdsAccesibles(user);
  return ids === null || ids.includes(areaId);
}

function puedeAtender(user, areaId) {
  return user?.rol?.rol_codigo === ROLES.ASESOR && tieneAccesoPrenec(user, areaId);
}

function exigirAcceso(user, cat) {
  if (!tieneAccesoPrenec(user, cat.areaId)) throw new SalaError('FORBIDDEN', 403, 'Fuera de tu área');
}

function exigirAsesor(user, cat) {
  if (!puedeAtender(user, cat.areaId)) {
    throw new SalaError('FORBIDDEN', 403, 'Solo los asesores de Prenecesidad atienden contratantes');
  }
}

function nombreDe(usuario) {
  return usuario ? `${usuario.usr_nombre || ''} ${usuario.usr_apellido || ''}`.trim() : null;
}

function clienteDe(vinculo, user) {
  const p = vinculo?.prospecto;
  if (!p) return null;
  return {
    prosp_id: p.prosp_id,
    es_mio: p.prosp_asesor_id === user.usr_id,
    duenio_nombre: nombreDe(p.asesor),
    estado_nombre: p.estado?.estado_nombre || null
  };
}

async function armar(homenajes, user, cat) {
  if (!homenajes.length) return [];
  const ids = homenajes.map((h) => h.id);
  const [vinculos, visitas] = await Promise.all([
    SvSalaContratante.findAll({
      where: { sc_homenaje_sala_id: { [Op.in]: ids } },
      include: [{
        model: SvProspecto, as: 'prospecto',
        attributes: ['prosp_id', 'prosp_asesor_id'],
        include: [
          { model: SvUsuario, as: 'asesor', attributes: ['usr_nombre', 'usr_apellido'] },
          { model: SvEstado,  as: 'estado', attributes: ['estado_nombre'] }
        ]
      }]
    }),
    SvGestion.findAll({
      where: { gest_homenaje_sala_id: { [Op.in]: ids } },
      attributes: ['gest_homenaje_sala_id', 'gest_fecha_hora'],
      include: [{ model: SvUsuario, as: 'asesor', attributes: ['usr_nombre', 'usr_apellido'] }],
      order: [['gest_fecha_hora', 'DESC']]
    })
  ]);

  const vinculoPor = new Map(vinculos.map((v) => [v.sc_homenaje_sala_id, v]));
  const visitasPor = new Map();
  for (const g of visitas) {
    const lista = visitasPor.get(g.gest_homenaje_sala_id) || [];
    lista.push({ asesor_nombre: nombreDe(g.asesor), fecha_hora: g.gest_fecha_hora });
    visitasPor.set(g.gest_homenaje_sala_id, lista);
  }

  const puede = puedeAtender(user, cat.areaId);
  return homenajes.map((h) => ({
    ...h,
    cliente: clienteDe(vinculoPor.get(h.id), user),
    visitas: visitasPor.get(h.id) || [],
    puede_atender: puede
  }));
}

async function listar(user) {
  const cat = await catalogos();
  exigirAcceso(user, cat);
  return armar(await repo.listarEnCurso(), user, cat);
}

async function obtener(homenajeId, user) {
  const cat = await catalogos();
  exigirAcceso(user, cat);
  const h = await repo.obtener(homenajeId);
  if (!h) throw new SalaError('HOMENAJE_NO_ENCONTRADO', 404, 'Homenaje no encontrado');
  return (await armar([h], user, cat))[0];
}

module.exports = { listar, obtener, SalaError };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest tests/salas.service.test.js`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add src/sv/services/salaError.js src/sv/services/salas.service.js tests/salas.service.test.js
git commit -m "feat(salas): servicio con catálogos, permisos y lista de homenajes en curso"
```

---

### Task 4: `atender` — vincular el contratante con un cliente de Prenecesidad

Directorio: **BACK**.

**Files:**
- Modify: `src/sv/services/salas.service.js` (requires nuevos, funciones nuevas y exports)
- Test: `tests/salas.service.test.js` (agrega `describe('atender')`)

**Interfaces:**
- Consume: `catalogos`, `exigirAsesor` y `nombreDe` (Task 3); `primerTelefonoValido` y `formatearNombre` (Task 2); `personas.buscarPorTelefono(tel)` y `personas.crear(payload)`. `personas.crear` lanza un error con `code === 'DUPLICATE_PHONE'` y `.persona`.
- Produce: `salas.atender(homenajeId, user, body) → Promise<RespuestaVinculo>`, donde `RespuestaVinculo` es:

  ```js
  {
    prosp_id, prosp_area_id, prosp_grupo_id, es_mio, creado, persona_nombre, persona_telefono,
    resumen: {
      duenio_nombre, estado_nombre, prox_gestion_fecha,
      ultima_gestion: { fecha_hora, canal, resultado_nombre } | null
    }
  }
  ```

- [ ] **Step 1: Write the failing tests** (agregar al final de `tests/salas.service.test.js`)

```js
describe('atender', () => {
  const t = { commit: jest.fn(), rollback: jest.fn() };

  function prospectoCompleto(prosp_id, prosp_asesor_id) {
    return {
      prosp_id, prosp_area_id: 1, prosp_grupo_id: 1, prosp_asesor_id, prosp_prox_gestion_fecha: '2026-11-20',
      persona: { persona_nombre: 'Marta Gomez', persona_apellido: null, persona_telefono_principal: '3001234567' },
      asesor: prosp_asesor_id === 7 ? { usr_nombre: 'Denis', usr_apellido: 'Moreno' } : { usr_nombre: 'Carmen', usr_apellido: 'Contreras' },
      estado: { estado_nombre: 'Nuevo' }
    };
  }

  beforeEach(() => {
    t.commit.mockReset(); t.rollback.mockReset();
    M.sequelize.transaction.mockResolvedValue(t);
    repo.obtener.mockResolvedValue(H(55));
    M.SvSalaContratante.findOne.mockResolvedValue(null);
    M.SvGestion.findOne.mockResolvedValue(null);
  });

  test('403 para supervisor', async () => {
    await esperarError(salas.atender(55, SUPERVISOR, {}), 'FORBIDDEN', 403);
  });

  test('404 si el homenaje no existe', async () => {
    repo.obtener.mockResolvedValue(null);
    await esperarError(salas.atender(55, ASESOR, {}), 'HOMENAJE_NO_ENCONTRADO', 404);
  });

  test('409 si el homenaje finalizó', async () => {
    repo.obtener.mockResolvedValue(H(55, { estado: 'FINALIZADO' }));
    await esperarError(salas.atender(55, ASESOR, {}), 'HOMENAJE_CERRADO', 409);
  });

  test('con vínculo existente lo devuelve sin crear nada', async () => {
    M.SvSalaContratante.findOne.mockResolvedValue({ sc_homenaje_sala_id: 55, sc_prosp_id: 901 });
    M.SvProspecto.findByPk.mockResolvedValue(prospectoCompleto(901, 8));
    M.SvGestion.findOne.mockResolvedValue({ gest_fecha_hora: '2026-11-18T10:40:00', gest_canal: 'visita_sala', resultado: { resultado_nombre: 'No interesado' } });

    const r = await salas.atender(55, ASESOR, {});

    expect(r).toEqual({
      prosp_id: 901, prosp_area_id: 1, prosp_grupo_id: 1, es_mio: false, creado: false,
      persona_nombre: 'Marta Gomez', persona_telefono: '3001234567',
      resumen: {
        duenio_nombre: 'Carmen Contreras', estado_nombre: 'Nuevo', prox_gestion_fecha: '2026-11-20',
        ultima_gestion: { fecha_hora: '2026-11-18T10:40:00', canal: 'visita_sala', resultado_nombre: 'No interesado' }
      }
    });
    expect(M.sequelize.transaction).not.toHaveBeenCalled();
  });

  test('cliente nuevo: crea persona, prospecto y vínculo', async () => {
    const personas = require('../src/sv/services/personas.service');
    personas.buscarPorTelefono.mockResolvedValue(null);
    personas.crear.mockResolvedValue({ persona_id: 500 });
    M.SvProspecto.findOne.mockResolvedValue(null);
    M.SvProspecto.create.mockResolvedValue({ prosp_id: 905 });
    M.SvProspecto.findByPk.mockResolvedValue(prospectoCompleto(905, 7));

    const r = await salas.atender(55, ASESOR, {});

    expect(personas.buscarPorTelefono).toHaveBeenCalledWith('3001234567');
    expect(personas.crear).toHaveBeenCalledWith({ persona_nombre: 'Marta Gomez', persona_telefono_principal: '3001234567' });
    expect(M.SvProspecto.create).toHaveBeenCalledWith({
      prosp_area_id: 1, prosp_grupo_id: 1, prosp_persona_id: 500, prosp_asesor_id: 7,
      prosp_estado_id: 11, prosp_fuente_id: 40
    }, { transaction: t });
    expect(M.SvSalaContratante.create).toHaveBeenCalledWith(
      { sc_homenaje_sala_id: 55, sc_prosp_id: 905, sc_usr_id: 7 }, { transaction: t });
    expect(t.commit).toHaveBeenCalled();
    expect(r.creado).toBe(true);
    expect(r.es_mio).toBe(true);
  });

  test('toma el primer número válido cuando la asistencia trae varios', async () => {
    const personas = require('../src/sv/services/personas.service');
    repo.obtener.mockResolvedValue(H(55, { contratante_telefono: 'fijo / 310 987 6543 / 3001234567' }));
    personas.buscarPorTelefono.mockResolvedValue({ persona_id: 500 });
    M.SvProspecto.findOne.mockResolvedValue({ prosp_id: 905 });
    M.SvProspecto.findByPk.mockResolvedValue(prospectoCompleto(905, 7));
    await salas.atender(55, ASESOR, {});
    expect(personas.buscarPorTelefono).toHaveBeenCalledWith('3109876543');
  });

  test('usa el teléfono escrito cuando la asistencia no trae uno válido', async () => {
    const personas = require('../src/sv/services/personas.service');
    repo.obtener.mockResolvedValue(H(55, { contratante_telefono: '' }));
    personas.buscarPorTelefono.mockResolvedValue({ persona_id: 500 });
    M.SvProspecto.findOne.mockResolvedValue({ prosp_id: 905 });
    M.SvProspecto.findByPk.mockResolvedValue(prospectoCompleto(905, 7));
    await salas.atender(55, ASESOR, { telefono: '312 555 0101' });
    expect(personas.buscarPorTelefono).toHaveBeenCalledWith('3125550101');
  });

  test('422 TELEFONO_REQUERIDO sin teléfono válido', async () => {
    repo.obtener.mockResolvedValue(H(55, { contratante_telefono: 'no tiene' }));
    await esperarError(salas.atender(55, ASESOR, { telefono: '12' }), 'TELEFONO_REQUERIDO', 422);
  });

  test('422 NOMBRE_REQUERIDO sin nombre', async () => {
    repo.obtener.mockResolvedValue(H(55, { contratante_nombre: '  ' }));
    await esperarError(salas.atender(55, ASESOR, {}), 'NOMBRE_REQUERIDO', 422);
  });

  test('usa el nombre escrito cuando la asistencia no trae', async () => {
    const personas = require('../src/sv/services/personas.service');
    repo.obtener.mockResolvedValue(H(55, { contratante_nombre: null }));
    personas.buscarPorTelefono.mockResolvedValue(null);
    personas.crear.mockResolvedValue({ persona_id: 500 });
    M.SvProspecto.findOne.mockResolvedValue({ prosp_id: 905 });
    M.SvProspecto.findByPk.mockResolvedValue(prospectoCompleto(905, 7));
    await salas.atender(55, ASESOR, { nombre: 'ana lucía rojas' });
    expect(personas.crear).toHaveBeenCalledWith({ persona_nombre: 'Ana Lucía Rojas', persona_telefono_principal: '3001234567' });
  });

  test('cliente de Prenecesidad de otro asesor: lo vincula sin crear prospecto', async () => {
    const personas = require('../src/sv/services/personas.service');
    personas.buscarPorTelefono.mockResolvedValue({ persona_id: 500 });
    M.SvProspecto.findOne.mockResolvedValue({ prosp_id: 901 });
    M.SvProspecto.findByPk.mockResolvedValue(prospectoCompleto(901, 8));

    const r = await salas.atender(55, ASESOR, {});

    expect(M.SvProspecto.findOne).toHaveBeenCalledWith({
      where: { prosp_persona_id: 500, prosp_area_id: 1, prosp_activo: 1 },
      order: [['prosp_created_at', 'DESC']],
      transaction: t
    });
    expect(M.SvProspecto.create).not.toHaveBeenCalled();
    expect(M.SvSalaContratante.create).toHaveBeenCalledWith(
      { sc_homenaje_sala_id: 55, sc_prosp_id: 901, sc_usr_id: 7 }, { transaction: t });
    expect(r.es_mio).toBe(false);
    expect(r.creado).toBe(false);
  });

  test('persona creada al mismo tiempo (DUPLICATE_PHONE): reutiliza la existente', async () => {
    const personas = require('../src/sv/services/personas.service');
    personas.buscarPorTelefono.mockResolvedValue(null);
    const dup = new Error('DUPLICATE_PHONE'); dup.code = 'DUPLICATE_PHONE'; dup.persona = { persona_id: 501 };
    personas.crear.mockRejectedValue(dup);
    M.SvProspecto.findOne.mockResolvedValue(null);
    M.SvProspecto.create.mockResolvedValue({ prosp_id: 906 });
    M.SvProspecto.findByPk.mockResolvedValue(prospectoCompleto(906, 7));
    await salas.atender(55, ASESOR, {});
    expect(M.SvProspecto.create.mock.calls[0][0].prosp_persona_id).toBe(501);
  });

  test('dos asesores al mismo tiempo: revierte y devuelve el vínculo ganador', async () => {
    const personas = require('../src/sv/services/personas.service');
    personas.buscarPorTelefono.mockResolvedValue({ persona_id: 500 });
    M.SvProspecto.findOne.mockResolvedValue(null);
    M.SvProspecto.create.mockResolvedValue({ prosp_id: 907 });
    const choque = new Error('Duplicate entry'); choque.name = 'SequelizeUniqueConstraintError';
    M.SvSalaContratante.create.mockRejectedValue(choque);
    M.SvSalaContratante.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ sc_homenaje_sala_id: 55, sc_prosp_id: 901 });
    M.SvProspecto.findByPk.mockResolvedValue(prospectoCompleto(901, 8));

    const r = await salas.atender(55, ASESOR, {});

    expect(t.rollback).toHaveBeenCalled();
    expect(t.commit).not.toHaveBeenCalled();
    expect(r.prosp_id).toBe(901);
    expect(r.creado).toBe(false);
  });

  test('un error inesperado revierte y se propaga', async () => {
    const personas = require('../src/sv/services/personas.service');
    personas.buscarPorTelefono.mockResolvedValue({ persona_id: 500 });
    M.SvProspecto.findOne.mockRejectedValue(new Error('db caída'));
    await expect(salas.atender(55, ASESOR, {})).rejects.toThrow('db caída');
    expect(t.rollback).toHaveBeenCalled();
  });

  test('el log lleva solo identificadores', async () => {
    const personas = require('../src/sv/services/personas.service');
    const logger = require('../src/utils/logger');
    personas.buscarPorTelefono.mockResolvedValue({ persona_id: 500 });
    M.SvProspecto.findOne.mockResolvedValue(null);
    M.SvProspecto.create.mockResolvedValue({ prosp_id: 905 });
    M.SvProspecto.findByPk.mockResolvedValue(prospectoCompleto(905, 7));
    await salas.atender(55, ASESOR, {});
    const linea = logger.info.mock.calls.map((c) => c[0]).find((l) => l.includes('SALA_ATENDER'));
    expect(linea).toBe('[SALA_ATENDER] homenaje_sala_id=55 prosp_id=905 usr_id=7 creado=true');
    expect(linea).not.toMatch(/3001234567|Marta/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/salas.service.test.js -t atender`
Expected: FAIL con "salas.atender is not a function".

- [ ] **Step 3: Implement** en `src/sv/services/salas.service.js`

Reemplaza el bloque de imports del inicio:

```js
const { Op } = require('sequelize');
const {
  SvArea, SvGrupo, SvFuente, SvEstado, SvProspecto, SvUsuario, SvGestion, SvSalaContratante
} = require('../models');
const { ROLES, AREAS } = require('../config/constants');
const { areaIdsAccesibles } = require('../utils/acceso');
const repo = require('./homenajesSala.repo');
const SalaError = require('./salaError');
```

por:

```js
const { Op } = require('sequelize');
const {
  sequelize, SvArea, SvGrupo, SvFuente, SvEstado, SvResultado, SvProspecto, SvPersona,
  SvUsuario, SvGestion, SvSalaContratante
} = require('../models');
const { ROLES, AREAS } = require('../config/constants');
const { areaIdsAccesibles } = require('../utils/acceso');
const { primerTelefonoValido, formatearNombre } = require('../utils/contratante');
const repo = require('./homenajesSala.repo');
const personas = require('./personas.service');
const SalaError = require('./salaError');
const logger = require('../../utils/logger');
```

Agrega estas funciones antes de `module.exports`:

```js
async function homenajeEnCurso(homenajeId) {
  const h = await repo.obtener(homenajeId);
  if (!h) throw new SalaError('HOMENAJE_NO_ENCONTRADO', 404, 'Homenaje no encontrado');
  if (!repo.estaEnCurso(h)) throw new SalaError('HOMENAJE_CERRADO', 409, 'Este homenaje ya finalizó');
  return h;
}

async function respuestaVinculo(prospId, user, creado) {
  const p = await SvProspecto.findByPk(prospId, {
    include: [
      { model: SvPersona, as: 'persona', attributes: ['persona_nombre', 'persona_apellido', 'persona_telefono_principal'] },
      { model: SvUsuario, as: 'asesor',  attributes: ['usr_nombre', 'usr_apellido'] },
      { model: SvEstado,  as: 'estado',  attributes: ['estado_nombre'] }
    ]
  });
  const ultima = await SvGestion.findOne({
    where: { gest_prosp_id: prospId },
    order: [['gest_fecha_hora', 'DESC'], ['gest_id', 'DESC']],
    include: [{ model: SvResultado, as: 'resultado', attributes: ['resultado_nombre'] }]
  });
  return {
    prosp_id: p.prosp_id,
    prosp_area_id: p.prosp_area_id,
    prosp_grupo_id: p.prosp_grupo_id,
    es_mio: p.prosp_asesor_id === user.usr_id,
    creado,
    persona_nombre: [p.persona?.persona_nombre, p.persona?.persona_apellido].filter(Boolean).join(' '),
    persona_telefono: p.persona?.persona_telefono_principal || null,
    resumen: {
      duenio_nombre: nombreDe(p.asesor),
      estado_nombre: p.estado?.estado_nombre || null,
      prox_gestion_fecha: p.prosp_prox_gestion_fecha || null,
      ultima_gestion: ultima ? {
        fecha_hora: ultima.gest_fecha_hora,
        canal: ultima.gest_canal,
        resultado_nombre: ultima.resultado?.resultado_nombre || null
      } : null
    }
  };
}

// Persona fuera de la transacción: una persona sin prospecto es inofensiva.
async function personaPorTelefono(telefono, nombre) {
  const existente = await personas.buscarPorTelefono(telefono);
  if (existente) return existente;
  try {
    return await personas.crear({ persona_nombre: nombre, persona_telefono_principal: telefono });
  } catch (e) {
    if (e.code === 'DUPLICATE_PHONE' && e.persona) return e.persona;
    if (e.name === 'SequelizeUniqueConstraintError') {
      const otra = await personas.buscarPorTelefono(telefono);
      if (otra) return otra;
    }
    throw e;
  }
}

async function atender(homenajeId, user, body = {}) {
  const cat = await catalogos();
  exigirAsesor(user, cat);
  const h = await homenajeEnCurso(homenajeId);

  const existente = await SvSalaContratante.findOne({ where: { sc_homenaje_sala_id: homenajeId } });
  if (existente) return respuestaVinculo(existente.sc_prosp_id, user, false);

  const telefono = primerTelefonoValido(h.contratante_telefono) || primerTelefonoValido(body.telefono);
  if (!telefono) throw new SalaError('TELEFONO_REQUERIDO', 422, 'Escribe un teléfono válido del contratante');
  const nombre = formatearNombre(h.contratante_nombre) || formatearNombre(body.nombre);
  if (!nombre) throw new SalaError('NOMBRE_REQUERIDO', 422, 'Escribe el nombre del contratante');

  const persona = await personaPorTelefono(telefono, nombre);

  const t = await sequelize.transaction();
  let prospId;
  let creado = false;
  try {
    const activo = await SvProspecto.findOne({
      where: { prosp_persona_id: persona.persona_id, prosp_area_id: cat.areaId, prosp_activo: 1 },
      order: [['prosp_created_at', 'DESC']],
      transaction: t
    });
    if (activo) {
      prospId = activo.prosp_id;
    } else {
      const nuevo = await SvProspecto.create({
        prosp_area_id: cat.areaId,
        prosp_grupo_id: cat.grupoId,
        prosp_persona_id: persona.persona_id,
        prosp_asesor_id: user.usr_id,
        prosp_estado_id: cat.estadoInicialId,
        prosp_fuente_id: cat.fuenteId
      }, { transaction: t });
      prospId = nuevo.prosp_id;
      creado = true;
    }
    await SvSalaContratante.create(
      { sc_homenaje_sala_id: homenajeId, sc_prosp_id: prospId, sc_usr_id: user.usr_id },
      { transaction: t }
    );
    await t.commit();
  } catch (e) {
    await t.rollback();
    if (e.name === 'SequelizeUniqueConstraintError') {
      const ganador = await SvSalaContratante.findOne({ where: { sc_homenaje_sala_id: homenajeId } });
      if (ganador) return respuestaVinculo(ganador.sc_prosp_id, user, false);
    }
    throw e;
  }

  logger.info(`[SALA_ATENDER] homenaje_sala_id=${homenajeId} prosp_id=${prospId} usr_id=${user.usr_id} creado=${creado}`);
  return respuestaVinculo(prospId, user, creado);
}
```

Reemplaza `module.exports = { listar, obtener, SalaError };` por:

```js
module.exports = { listar, obtener, atender, SalaError };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/salas.service.test.js`
Expected: PASS: los 9 tests de la Task 3 y los 15 de `atender`.

- [ ] **Step 5: Commit**

```bash
git add src/sv/services/salas.service.js tests/salas.service.test.js
git commit -m "feat(salas): atender al contratante y vincularlo con un cliente de Prenecesidad"
```

---

### Task 5: `registrarVisita` — gestión con canal `visita_sala`

Directorio: **BACK**.

**Files:**
- Modify: `src/sv/services/salas.service.js` (un require, una función y los exports)
- Test: `tests/salas.service.test.js` (agrega `describe('registrarVisita')`)

**Interfaces:**
- Consume: `catalogos`, `exigirAsesor` y `homenajeEnCurso` (Tasks 3 y 4); `gestiones.crear(payload, asesorId)` (Task 1).
- Produce: `salas.registrarVisita(homenajeId, user, body) → Promise<Gestion>`. `body` es `{ gest_resultado_id, gest_estado_nuevo_id?, gest_comentario?, gest_prox_fecha?, gest_prox_hora? }`.

- [ ] **Step 1: Write the failing tests** (agregar al final de `tests/salas.service.test.js`)

```js
describe('registrarVisita', () => {
  const RESULTADO = { resultado_id: 3, resultado_requiere_fecha: 0 };
  const BODY = { gest_resultado_id: 3, gest_comentario: 'Habló con la hija' };

  beforeEach(() => {
    repo.obtener.mockResolvedValue(H(57));
    M.SvSalaContratante.findOne.mockResolvedValue({ sc_homenaje_sala_id: 57, sc_prosp_id: 901 });
    M.SvProspecto.findByPk.mockResolvedValue({ prosp_id: 901, prosp_activo: 1 });
    M.SvResultado.findOne.mockResolvedValue(RESULTADO);
    require('../src/sv/services/gestiones.service').crear.mockResolvedValue({ gest_id: 77 });
  });

  test('403 para supervisor', async () => {
    await esperarError(salas.registrarVisita(57, SUPERVISOR, BODY), 'FORBIDDEN', 403);
  });

  test('409 HOMENAJE_CERRADO', async () => {
    repo.obtener.mockResolvedValue(H(57, { estado: 'FINALIZADO' }));
    await esperarError(salas.registrarVisita(57, ASESOR, BODY), 'HOMENAJE_CERRADO', 409);
  });

  test('409 SIN_ATENDER', async () => {
    M.SvSalaContratante.findOne.mockResolvedValue(null);
    await esperarError(salas.registrarVisita(57, ASESOR, BODY), 'SIN_ATENDER', 409);
  });

  test('409 CLIENTE_INACTIVO', async () => {
    M.SvProspecto.findByPk.mockResolvedValue({ prosp_id: 901, prosp_activo: 0 });
    await esperarError(salas.registrarVisita(57, ASESOR, BODY), 'CLIENTE_INACTIVO', 409);
  });

  test('422 RESULTADO_INVALIDO si no es de telemercadeo', async () => {
    M.SvResultado.findOne.mockResolvedValue(null);
    await esperarError(salas.registrarVisita(57, ASESOR, BODY), 'RESULTADO_INVALIDO', 422);
    expect(M.SvResultado.findOne).toHaveBeenCalledWith({
      where: { resultado_id: 3, resultado_grupo_id: 1, resultado_activo: 1 }
    });
  });

  test('422 ESTADO_INVALIDO si el estado no es de telemercadeo', async () => {
    await esperarError(salas.registrarVisita(57, ASESOR, { ...BODY, gest_estado_nuevo_id: 99 }), 'ESTADO_INVALIDO', 422);
  });

  test('422 PROX_FECHA_REQUERIDA cuando el resultado la pide', async () => {
    M.SvResultado.findOne.mockResolvedValue({ resultado_id: 3, resultado_requiere_fecha: 1 });
    await esperarError(salas.registrarVisita(57, ASESOR, BODY), 'PROX_FECHA_REQUERIDA', 422);
  });

  test('crea la gestión con visita_sala, el homenaje y el asesor de la sesión', async () => {
    const gestiones = require('../src/sv/services/gestiones.service');
    M.SvEstado.findOne.mockImplementation(async ({ where }) => (where.estado_id === 12 ? { estado_id: 12 } : { estado_id: 11 }));

    const g = await salas.registrarVisita(57, ASESOR, {
      ...BODY, gest_estado_nuevo_id: 12, gest_prox_fecha: '2026-11-25', gest_prox_hora: '10:00',
      gest_prosp_id: 1, gest_asesor_id: 99, gest_canal: 'llamada'
    });

    expect(g).toEqual({ gest_id: 77 });
    expect(gestiones.crear).toHaveBeenCalledWith({
      gest_prosp_id: 901,
      gest_canal: 'visita_sala',
      gest_homenaje_sala_id: 57,
      gest_resultado_id: 3,
      gest_estado_nuevo_id: 12,
      gest_comentario: 'Habló con la hija',
      gest_prox_fecha: '2026-11-25',
      gest_prox_hora: '10:00'
    }, 7);
  });

  test('el log lleva solo identificadores', async () => {
    const logger = require('../src/utils/logger');
    await salas.registrarVisita(57, ASESOR, BODY);
    const linea = logger.info.mock.calls.map((c) => c[0]).find((l) => l.includes('SALA_VISITA'));
    expect(linea).toBe('[SALA_VISITA] homenaje_sala_id=57 prosp_id=901 usr_id=7');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/salas.service.test.js -t registrarVisita`
Expected: FAIL con "salas.registrarVisita is not a function".

- [ ] **Step 3: Implement** en `src/sv/services/salas.service.js`

Debajo de `const personas = require('./personas.service');` agrega:

```js
const gestiones = require('./gestiones.service');
```

Agrega antes de `module.exports`:

```js
async function registrarVisita(homenajeId, user, body = {}) {
  const cat = await catalogos();
  exigirAsesor(user, cat);
  await homenajeEnCurso(homenajeId);

  const vinculo = await SvSalaContratante.findOne({ where: { sc_homenaje_sala_id: homenajeId } });
  if (!vinculo) throw new SalaError('SIN_ATENDER', 409, 'Primero atiende al contratante de este homenaje');

  const p = await SvProspecto.findByPk(vinculo.sc_prosp_id);
  if (!p || !p.prosp_activo) {
    throw new SalaError('CLIENTE_INACTIVO', 409, 'El cliente está inactivo; pide al supervisor reactivarlo');
  }

  const resultado = await SvResultado.findOne({
    where: { resultado_id: body.gest_resultado_id, resultado_grupo_id: cat.grupoId, resultado_activo: 1 }
  });
  if (!resultado) throw new SalaError('RESULTADO_INVALIDO', 422, 'El resultado no es de telemercadeo');

  if (body.gest_estado_nuevo_id) {
    const estado = await SvEstado.findOne({
      where: { estado_id: body.gest_estado_nuevo_id, estado_grupo_id: cat.grupoId, estado_activo: 1 }
    });
    if (!estado) throw new SalaError('ESTADO_INVALIDO', 422, 'El estado no es de telemercadeo');
  }

  if (resultado.resultado_requiere_fecha && !body.gest_prox_fecha) {
    throw new SalaError('PROX_FECHA_REQUERIDA', 422, 'Este resultado requiere agendar la próxima gestión');
  }

  const g = await gestiones.crear({
    gest_prosp_id: p.prosp_id,
    gest_canal: 'visita_sala',
    gest_homenaje_sala_id: homenajeId,
    gest_resultado_id: resultado.resultado_id,
    gest_estado_nuevo_id: body.gest_estado_nuevo_id || null,
    gest_comentario: body.gest_comentario || null,
    gest_prox_fecha: body.gest_prox_fecha || null,
    gest_prox_hora: body.gest_prox_hora || null
  }, user.usr_id);

  logger.info(`[SALA_VISITA] homenaje_sala_id=${homenajeId} prosp_id=${p.prosp_id} usr_id=${user.usr_id}`);
  return g;
}
```

Reemplaza `module.exports = { listar, obtener, atender, SalaError };` por:

```js
module.exports = { listar, obtener, atender, registrarVisita, SalaError };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/salas.service.test.js`
Expected: PASS (todos los bloques).

- [ ] **Step 5: Commit**

```bash
git add src/sv/services/salas.service.js tests/salas.service.test.js
git commit -m "feat(salas): registrar visitas en sala con el proceso de telemercadeo"
```

---

### Task 6: Validación, controlador, rutas y montaje de `/sv/salas`

Directorio: **BACK**.

**Files:**
- Create: `src/sv/validations/salas.validation.js`
- Create: `src/sv/controllers/salas.controller.js`
- Create: `src/sv/routes/salas.routes.js`
- Modify: `src/sv/routes/index.js:51` (montaje)
- Test: `tests/salas.routes.test.js`

**Interfaces:**
- Consume: `salas.listar`, `salas.obtener`, `salas.atender`, `salas.registrarVisita` y `SalaError`.
- Produce, bajo `/api/sv/salas`:
  - `GET /homenajes` → 200 `{ success, data: Item[] }`
  - `GET /homenajes/:id` → 200 `{ success, data: Item }`
  - `POST /homenajes/:id/atender` → 200 `{ success, data: RespuestaVinculo }`
  - `POST /homenajes/:id/visitas` → 201 `{ success, data: Gestion }`
  - Los errores de negocio responden `{ success: false, error: <código>, message }`.

- [ ] **Step 1: Write the failing test** `tests/salas.routes.test.js`

```js
const express = require('express');
const request = require('supertest');

jest.mock('../src/sv/services/salas.service', () => ({
  listar: jest.fn(), obtener: jest.fn(), atender: jest.fn(), registrarVisita: jest.fn()
}));

const salas = require('../src/sv/services/salas.service');
const SalaError = require('../src/sv/services/salaError');

const ASESOR = { usr_id: 7, usr_area_id: 1, rol: { rol_codigo: 'ASESOR' } };

function app(user = ASESOR) {
  const a = express();
  a.use(express.json());
  a.use((req, res, next) => { req.user = user; next(); });
  a.use('/api/sv/salas', require('../src/sv/routes/salas.routes'));
  a.use((err, req, res, next) => res.status(500).json({ success: false, error: 'INTERNAL_ERROR' }));
  return a;
}

beforeEach(() => jest.resetAllMocks());

describe('rutas /sv/salas', () => {
  test('GET /homenajes devuelve la lista del servicio', async () => {
    salas.listar.mockResolvedValue([{ id: 55 }]);
    const r = await request(app()).get('/api/sv/salas/homenajes');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, data: [{ id: 55 }] });
    expect(salas.listar).toHaveBeenCalledWith(ASESOR);
  });

  test('GET /homenajes/:id con id no numérico responde 404 sin llamar al servicio', async () => {
    const r = await request(app()).get('/api/sv/salas/homenajes/abc');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('HOMENAJE_NO_ENCONTRADO');
    expect(salas.obtener).not.toHaveBeenCalled();
  });

  test('GET /homenajes/:id pasa el id como número', async () => {
    salas.obtener.mockResolvedValue({ id: 56 });
    const r = await request(app()).get('/api/sv/salas/homenajes/56');
    expect(r.status).toBe(200);
    expect(salas.obtener).toHaveBeenCalledWith(56, ASESOR);
  });

  test('un SalaError responde con su estado, código y mensaje', async () => {
    salas.atender.mockRejectedValue(new SalaError('FORBIDDEN', 403, 'Solo los asesores de Prenecesidad atienden contratantes'));
    const r = await request(app()).post('/api/sv/salas/homenajes/55/atender').send({});
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ success: false, error: 'FORBIDDEN', message: 'Solo los asesores de Prenecesidad atienden contratantes' });
  });

  test('POST atender pasa solo nombre y teléfono', async () => {
    salas.atender.mockResolvedValue({ prosp_id: 905 });
    const r = await request(app()).post('/api/sv/salas/homenajes/55/atender')
      .send({ nombre: 'Ana', telefono: '3125550101', prosp_asesor_id: 99 });
    expect(r.status).toBe(200);
    expect(salas.atender).toHaveBeenCalledWith(55, ASESOR, { nombre: 'Ana', telefono: '3125550101' });
  });

  test('POST visitas exige gest_resultado_id', async () => {
    const r = await request(app()).post('/api/sv/salas/homenajes/57/visitas').send({ gest_comentario: 'x' });
    expect(r.status).toBe(422);
    expect(salas.registrarVisita).not.toHaveBeenCalled();
  });

  test('POST visitas descarta gest_prosp_id, gest_asesor_id y gest_canal', async () => {
    salas.registrarVisita.mockResolvedValue({ gest_id: 77 });
    const r = await request(app()).post('/api/sv/salas/homenajes/57/visitas')
      .send({ gest_resultado_id: 3, gest_prosp_id: 1, gest_asesor_id: 99, gest_canal: 'llamada' });
    expect(r.status).toBe(201);
    expect(r.body.data).toEqual({ gest_id: 77 });
    const body = salas.registrarVisita.mock.calls[0][2];
    expect(body).toEqual(expect.objectContaining({ gest_resultado_id: 3 }));
    expect(body).not.toHaveProperty('gest_prosp_id');
    expect(body).not.toHaveProperty('gest_asesor_id');
    expect(body).not.toHaveProperty('gest_canal');
  });

  test('un error inesperado llega al manejador de errores (next) sin tumbar el proceso', async () => {
    salas.listar.mockRejectedValue(new Error('db caída'));
    const r = await request(app()).get('/api/sv/salas/homenajes');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('INTERNAL_ERROR');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/salas.routes.test.js`
Expected: FAIL con "Cannot find module '../src/sv/routes/salas.routes'".

- [ ] **Step 3: Implement** `src/sv/validations/salas.validation.js`

```js
// sv/validations/salas.validation.js — schemas Joi planos (validate llama schema.validate).
const Joi = require('joi');

const atender = Joi.object({
  nombre:   Joi.string().trim().max(100).allow('', null),
  telefono: Joi.string().trim().max(40).allow('', null)
});

const visita = Joi.object({
  gest_resultado_id:    Joi.number().integer().positive().required(),
  gest_estado_nuevo_id: Joi.number().integer().positive().allow(null),
  gest_comentario:      Joi.string().allow('', null),
  gest_prox_fecha:      Joi.date().iso().allow(null),
  gest_prox_hora:       Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null, '')
});

module.exports = { atender, visita };
```

- [ ] **Step 4: Implement** `src/sv/controllers/salas.controller.js`

```js
/**
 * sv/controllers/salas.controller.js — visitas de Prenecesidad en salas de velación.
 * Cada handler captura sus errores: los de negocio (SalaError) se responden aquí;
 * el resto va a next(e) para no tumbar el proceso.
 */
const salas = require('../services/salas.service');
const SalaError = require('../services/salaError');
const { ok, created, fail } = require('../utils/response');

function idDe(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function noEncontrado(res) {
  return fail(res, 404, 'HOMENAJE_NO_ENCONTRADO', 'Homenaje no encontrado');
}

function responderError(e, res, next) {
  if (e instanceof SalaError) return fail(res, e.status, e.code, e.message);
  return next(e);
}

async function listar(req, res, next) {
  try {
    return ok(res, await salas.listar(req.user));
  } catch (e) { return responderError(e, res, next); }
}

async function obtener(req, res, next) {
  const id = idDe(req);
  if (!id) return noEncontrado(res);
  try {
    return ok(res, await salas.obtener(id, req.user));
  } catch (e) { return responderError(e, res, next); }
}

async function atender(req, res, next) {
  const id = idDe(req);
  if (!id) return noEncontrado(res);
  try {
    return ok(res, await salas.atender(id, req.user, req.body));
  } catch (e) { return responderError(e, res, next); }
}

async function registrarVisita(req, res, next) {
  const id = idDe(req);
  if (!id) return noEncontrado(res);
  try {
    return created(res, await salas.registrarVisita(id, req.user, req.body));
  } catch (e) { return responderError(e, res, next); }
}

module.exports = { listar, obtener, atender, registrarVisita };
```

- [ ] **Step 5: Implement** `src/sv/routes/salas.routes.js`

```js
const router = require('express').Router();
const ctrl = require('../controllers/salas.controller');
const v    = require('../validations/salas.validation');
const { validate } = require('../middleware/validate');

router.get ('/homenajes',             ctrl.listar);
router.get ('/homenajes/:id',         ctrl.obtener);
router.post('/homenajes/:id/atender', validate(v.atender), ctrl.atender);
router.post('/homenajes/:id/visitas', validate(v.visita),  ctrl.registrarVisita);

module.exports = router;
```

- [ ] **Step 6: Mount** en `src/sv/routes/index.js`

Reemplaza:

```js
router.use('/renovaciones', svAuth, svAreaGuard, require('./renovaciones.routes'));
```

por:

```js
router.use('/renovaciones', svAuth, svAreaGuard, require('./renovaciones.routes'));

// ─── Salas de velación: visitas de Prenecesidad (migración 023) ───
router.use('/salas',        svAuth, svAreaGuard, require('./salas.routes'));
```

- [ ] **Step 7: Run the tests**

Run: `npx jest tests/salas.routes.test.js tests/salas.service.test.js tests/homenajesSala.repo.test.js tests/contratante.utils.test.js tests/salasVelacion.models.test.js tests/gestionesHomenaje.service.test.js`
Expected: PASS.

No cargues `src/sv/routes/index.js` con `node -e`: arrastra modelos y servicios que abren conexiones. El montaje es una línea que revisa el reviewer, y el smoke de la Task 12 lo confirma.

- [ ] **Step 8: Commit**

```bash
git add src/sv/validations/salas.validation.js src/sv/controllers/salas.controller.js src/sv/routes/salas.routes.js src/sv/routes/index.js tests/salas.routes.test.js
git commit -m "feat(salas): endpoints /sv/salas con validación y manejo de errores"
```

---

### Task 7: `salasApi` y canal `visita_sala` en el historial

Directorio: **FRONT**.

**Files:**
- Create: `src/api/salasApi.js`
- Modify: `src/components/common/HistorialItem.vue:16-18,39-43`
- Modify: `src/views/comun/HistorialClienteCompleto.vue:74-76,169-173`
- Test: `src/api/__tests__/salasApi.spec.js`, `src/components/common/__tests__/HistorialItem.spec.js`

**Interfaces:**
- Produce: `salasApi.listar()`, `salasApi.obtener(id)`, `salasApi.atender(id, datos = {})` y `salasApi.registrarVisita(id, payload)`. Todas devuelven el cuerpo `{ success, data }`.

- [ ] **Step 1: Write the failing tests**

`src/api/__tests__/salasApi.spec.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '@/api/axios';
import { salasApi } from '@/api/salasApi';

describe('salasApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listar', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [] } });
    expect(await salasApi.listar()).toEqual({ success: true, data: [] });
    expect(api.get).toHaveBeenCalledWith('/salas/homenajes');
  });

  it('obtener', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { id: 56 } } });
    await salasApi.obtener(56);
    expect(api.get).toHaveBeenCalledWith('/salas/homenajes/56');
  });

  it('atender envía los datos o un objeto vacío', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: {} } });
    await salasApi.atender(55);
    expect(api.post).toHaveBeenCalledWith('/salas/homenajes/55/atender', {});
    await salasApi.atender(55, { telefono: '3001234567' });
    expect(api.post).toHaveBeenLastCalledWith('/salas/homenajes/55/atender', { telefono: '3001234567' });
  });

  it('registrarVisita', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { gest_id: 1 } } });
    await salasApi.registrarVisita(57, { gest_resultado_id: 3 });
    expect(api.post).toHaveBeenCalledWith('/salas/homenajes/57/visitas', { gest_resultado_id: 3 });
  });
});
```

`src/components/common/__tests__/HistorialItem.spec.js`:

```js
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import HistorialItem from '@/components/common/HistorialItem.vue';

const base = { gest_id: 1, gest_fecha_hora: '2026-11-18T10:40:00', asesor: { usr_nombre: 'Carmen', usr_apellido: 'Contreras' } };

describe('HistorialItem', () => {
  it('muestra 🏛️ y "Visita en sala" para el canal visita_sala', () => {
    const w = mount(HistorialItem, { props: { gestion: { ...base, gest_canal: 'visita_sala' } } });
    expect(w.text()).toContain('🏛️');
    expect(w.text()).toContain('Visita en sala');
  });

  it('no lo muestra para una llamada', () => {
    const w = mount(HistorialItem, { props: { gestion: { ...base, gest_canal: 'llamada' } } });
    expect(w.text()).toContain('📞');
    expect(w.text()).not.toContain('Visita en sala');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/api/__tests__/salasApi.spec.js src/components/common/__tests__/HistorialItem.spec.js`
Expected: FAIL. `salasApi` no existe y HistorialItem no muestra "Visita en sala".

- [ ] **Step 3: Implement** `src/api/salasApi.js`

```js
import api from './axios';

export const salasApi = {
  listar:          ()            => api.get('/salas/homenajes').then(r => r.data),
  obtener:         (id)          => api.get(`/salas/homenajes/${id}`).then(r => r.data),
  atender:         (id, datos = {}) => api.post(`/salas/homenajes/${id}/atender`, datos).then(r => r.data),
  registrarVisita: (id, payload) => api.post(`/salas/homenajes/${id}/visitas`, payload).then(r => r.data)
};
```

- [ ] **Step 4: Update** `src/components/common/HistorialItem.vue`

Reemplaza:

```js
const iconoCanal = computed(() => ({
  llamada: '📞', presencial: '🤝', correo: '✉️'
}[props.gestion.gest_canal] || '📝'));
```

por:

```js
const iconoCanal = computed(() => ({
  llamada: '📞', presencial: '🤝', correo: '✉️', visita_sala: '🏛️'
}[props.gestion.gest_canal] || '📝'));
```

Reemplaza:

```html
      <span v-if="gestion.asesor">por {{ gestion.asesor.usr_nombre }} {{ gestion.asesor.usr_apellido }}</span>
```

por:

```html
      <span v-if="gestion.asesor">por {{ gestion.asesor.usr_nombre }} {{ gestion.asesor.usr_apellido }}</span>
      <span v-if="gestion.gest_canal === 'visita_sala'">· Visita en sala</span>
```

- [ ] **Step 5: Update** `src/views/comun/HistorialClienteCompleto.vue`

Reemplaza:

```js
  return { llamada: '📞', presencial: '🤝', correo: '✉️' }[canal] || '📝';
```

por:

```js
  return { llamada: '📞', presencial: '🤝', correo: '✉️', visita_sala: '🏛️' }[canal] || '📝';
```

Reemplaza:

```html
              por <strong>{{ g.asesor?.usr_nombre }} {{ g.asesor?.usr_apellido }}</strong>
```

por:

```html
              por <strong>{{ g.asesor?.usr_nombre }} {{ g.asesor?.usr_apellido }}</strong>
              <span v-if="g.gest_canal === 'visita_sala'"> · Visita en sala</span>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/api/__tests__/salasApi.spec.js src/components/common/__tests__/HistorialItem.spec.js`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add src/api/salasApi.js src/api/__tests__/salasApi.spec.js src/components/common/HistorialItem.vue src/components/common/__tests__/HistorialItem.spec.js src/views/comun/HistorialClienteCompleto.vue
git commit -m "feat(salas): cliente API de salas y canal visita en sala en el historial"
```

---

### Task 8: `RegistrarGestion` en modo sala

Directorio: **FRONT**.

**Files:**
- Modify: `src/components/crm/RegistrarGestion.vue`
- Test: `src/components/crm/__tests__/RegistrarGestion.sala.spec.js`

**Interfaces:**
- Consume: `salasApi.registrarVisita(id, payload)` (Task 7).
- Produce: las props nuevas `homenajeSalaId: Number|null` (por defecto `null`) y `resumenCliente: Object|null` (por defecto `null`). `resumenCliente` tiene la forma `{ duenio_nombre, estado_nombre, prox_gestion_fecha, ultima_gestion: { fecha_hora, canal, resultado_nombre } | null }`. Los eventos siguen siendo `close` y `registrada`.

- [ ] **Step 1: Write the failing test** `src/components/crm/__tests__/RegistrarGestion.sala.spec.js`

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/salasApi', () => ({ salasApi: { registrarVisita: vi.fn() } }));
vi.mock('@/api/prospectosApi', () => ({ prospectosApi: { actualizarProductos: vi.fn() } }));

import { salasApi } from '@/api/salasApi';
import { prospectosApi } from '@/api/prospectosApi';
import { useConfigStore } from '@/stores/useConfigStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';

const PROSPECTO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1,
  persona: { persona_nombre: 'Marta Gomez', persona_telefono_principal: '3001234567' },
  productos: [{ pp_prod_id: 5, pp_es_principal: 1 }]
};
const CATALOGO = {
  resultados: [{ resultado_id: 3, resultado_grupo_id: 1, resultado_activo: 1, resultado_orden: 1, resultado_nombre: 'Interesado', resultado_requiere_fecha: 0 }],
  estados: [],
  productos: [{ prod_id: 5, prod_area_id: 1, prod_activo: 1, prod_nombre: 'Osario' }]
};
const RESUMEN = {
  duenio_nombre: 'Carmen Contreras', estado_nombre: 'Contactado', prox_gestion_fecha: '2026-11-20',
  ultima_gestion: { fecha_hora: '2026-11-18T10:40:00', canal: 'llamada', resultado_nombre: 'No contesta' }
};

function factory(props = {}) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore(pinia).actual = CATALOGO;
  const w = mount(RegistrarGestion, {
    props: { open: true, prospecto: PROSPECTO, ...props },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  return { w, gestiones: useGestionesStore(pinia) };
}

async function elegirResultadoYRegistrar(w, indiceSelectResultado) {
  await w.findAll('select')[indiceSelectResultado].setValue('3');
  const boton = w.findAll('button').find((b) => b.text().trim() === 'Registrar');
  await boton.trigger('click');
  await flushPromises();
}

describe('RegistrarGestion en modo sala', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deja el canal fijo en visita en sala, sin selector ni duración', () => {
    const { w } = factory({ homenajeSalaId: 55 });
    expect(w.find('[data-testid="canal-fijo-sala"]').text()).toContain('🏛️ Visita en sala');
    expect(w.findAll('select')).toHaveLength(2); // resultado y estado
    expect(w.text()).not.toContain('Duración');
  });

  it('registra por salasApi y no por el store de gestiones', async () => {
    salasApi.registrarVisita.mockResolvedValue({ success: true, data: { gest_id: 77 } });
    const { w, gestiones } = factory({ homenajeSalaId: 55 });
    await elegirResultadoYRegistrar(w, 0);
    expect(salasApi.registrarVisita).toHaveBeenCalledWith(55, {
      gest_resultado_id: 3, gest_estado_nuevo_id: null, gest_comentario: null,
      gest_prox_fecha: null, gest_prox_hora: null
    });
    expect(gestiones.registrar).not.toHaveBeenCalled();
    expect(w.emitted('registrada')[0]).toEqual([{ gest_id: 77 }]);
  });

  it('con resumenCliente muestra el resumen y oculta los productos', async () => {
    salasApi.registrarVisita.mockResolvedValue({ success: true, data: { gest_id: 78 } });
    const { w } = factory({ homenajeSalaId: 57, resumenCliente: RESUMEN });
    const resumen = w.find('[data-testid="resumen-cliente-sala"]');
    expect(resumen.text()).toContain('Carmen Contreras');
    expect(resumen.text()).toContain('Contactado');
    expect(resumen.text()).toContain('No contesta');
    expect(w.text()).not.toContain('Productos de interés');
    await elegirResultadoYRegistrar(w, 0);
    expect(prospectosApi.actualizarProductos).not.toHaveBeenCalled();
  });

  it('sin props de sala funciona como siempre', async () => {
    const { w, gestiones } = factory();
    expect(w.findAll('select')).toHaveLength(3); // canal, resultado y estado
    expect(w.find('[data-testid="canal-fijo-sala"]').exists()).toBe(false);
    expect(w.text()).toContain('Productos de interés');
    await elegirResultadoYRegistrar(w, 1);
    expect(gestiones.registrar).toHaveBeenCalledWith(expect.objectContaining({
      gest_prosp_id: 900, gest_canal: 'llamada', gest_resultado_id: 3
    }));
    expect(salasApi.registrarVisita).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/crm/__tests__/RegistrarGestion.sala.spec.js`
Expected: FAIL. No existe `[data-testid="canal-fijo-sala"]` y en modo sala se muestran 3 selects.

- [ ] **Step 3: Implement** los cambios en `src/components/crm/RegistrarGestion.vue`

3a. Reemplaza el comentario de cabecera (líneas 2-10) por:

```js
/**
 * RegistrarGestion.vue — modal para registrar gestión inmutable.
 * Props: open, prospecto (objeto con prosp_id, prosp_grupo_id, prosp_area_id, persona, productos),
 *        homenajeSalaId (modo sala: canal fijo "visita_sala" y guardado por /sv/salas),
 *        resumenCliente (cliente de otro asesor: muestra resumen y oculta productos)
 * Emit: close, registrada (gestion)
 *
 * Incluye editor opcional de productos de interés del cliente.
 * Si se modifican, se guardan antes de registrar la gestión.
 * Catálogos se leen del configStore (bootstrap por área).
 */
```

3b. Debajo de `import { prospectosApi } from '@/api/prospectosApi';` agrega:

```js
import { salasApi } from '@/api/salasApi';
import { fmtFecha, fmtFechaHora } from '@/utils/format';
```

3c. Reemplaza el bloque de `defineProps` y del `form` inicial:

```js
const props = defineProps({
  open: { type: Boolean, required: true },
  prospecto: { type: Object, default: null }
});
const emit = defineEmits(['close', 'registrada']);

const config = useConfigStore();
const gestiones = useGestionesStore();
const toast = useToastStore();
const { notify } = useApiError();

const form = ref({
  gest_canal: 'llamada',
  gest_resultado_id: '',
  gest_estado_nuevo_id: '',
  gest_comentario: '',
  gest_duracion_seg: null,
  gest_prox_fecha: '',
  gest_prox_hora: ''
});
```

por:

```js
const props = defineProps({
  open: { type: Boolean, required: true },
  prospecto: { type: Object, default: null },
  homenajeSalaId: { type: Number, default: null },
  resumenCliente: { type: Object, default: null }
});
const emit = defineEmits(['close', 'registrada']);

const config = useConfigStore();
const gestiones = useGestionesStore();
const toast = useToastStore();
const { notify } = useApiError();

const modoSala = computed(() => props.homenajeSalaId != null);
// Quien visita el cliente de otro asesor no edita sus productos.
const conProductos = computed(() => !props.resumenCliente);

const ETIQUETAS_CANAL = { llamada: '📞 Llamada', presencial: '🤝 Presencial', correo: '✉️ Correo', visita_sala: '🏛️ Visita en sala' };
function etiquetaCanal(canal) { return ETIQUETAS_CANAL[canal] || canal; }

function formVacio() {
  return {
    gest_canal: props.homenajeSalaId != null ? 'visita_sala' : 'llamada',
    gest_resultado_id: '',
    gest_estado_nuevo_id: '',
    gest_comentario: '',
    gest_duracion_seg: null,
    gest_prox_fecha: '',
    gest_prox_hora: ''
  };
}

const form = ref(formVacio());
```

3d. Dentro del `watch(() => props.open, ...)`, reemplaza:

```js
    form.value = {
      gest_canal: 'llamada',
      gest_resultado_id: '',
      gest_estado_nuevo_id: '',
      gest_comentario: '',
      gest_duracion_seg: null,
      gest_prox_fecha: '',
      gest_prox_hora: ''
    };
```

por:

```js
    form.value = formVacio();
```

3e. En `submit()`, reemplaza desde `// 1) Si los productos cambiaron, guardarlos primero` hasta `const g = await gestiones.registrar(payload);`, inclusive, por:

```js
    // 1) Si los productos cambiaron, guardarlos primero
    if (conProductos.value && productosCambiaron.value) {
      await prospectosApi.actualizarProductos(props.prospecto.prosp_id, productosSel.value);
      toast.info(`Productos actualizados (${productosSel.value.length})`);
    }

    // 2) Registrar gestión
    const base = {
      gest_resultado_id: parseInt(form.value.gest_resultado_id),
      gest_estado_nuevo_id: form.value.gest_estado_nuevo_id ? parseInt(form.value.gest_estado_nuevo_id) : null,
      gest_comentario: form.value.gest_comentario || null,
      gest_prox_fecha: form.value.gest_prox_fecha || null,
      gest_prox_hora:  form.value.gest_prox_hora || null
    };
    let g;
    if (modoSala.value) {
      g = (await salasApi.registrarVisita(props.homenajeSalaId, base)).data;
    } else {
      g = await gestiones.registrar({
        gest_prosp_id: props.prospecto.prosp_id,
        gest_canal: form.value.gest_canal,
        gest_duracion_seg: form.value.gest_duracion_seg || null,
        ...base
      });
    }
```

Las líneas siguientes (`toast.success('Gestión registrada'); emit('registrada', g); emit('close');`) quedan igual.

3f. En el template, debajo del bloque `<div v-if="prospecto?.persona" ...>…</div>` (el que termina con `{{ prospecto.persona.persona_telefono_principal }}</div>` y `</div>`), agrega:

```html
    <div v-if="resumenCliente" data-testid="resumen-cliente-sala"
         class="sv-card border border-gold/30 bg-gold/5 p-3 mb-4 text-sm space-y-1">
      <div>
        <span class="text-text3">Cliente de</span>
        <strong>{{ resumenCliente.duenio_nombre || '—' }}</strong>
        · {{ resumenCliente.estado_nombre || '—' }}
      </div>
      <div v-if="resumenCliente.prox_gestion_fecha">
        <span class="text-text3">Próxima gestión:</span> {{ fmtFecha(resumenCliente.prox_gestion_fecha) }}
      </div>
      <div v-if="resumenCliente.ultima_gestion">
        <span class="text-text3">Última gestión:</span>
        {{ fmtFechaHora(resumenCliente.ultima_gestion.fecha_hora) }}
        · {{ etiquetaCanal(resumenCliente.ultima_gestion.canal) }}
        · {{ resumenCliente.ultima_gestion.resultado_nombre || 'sin resultado' }}
      </div>
    </div>
```

3g. Reemplaza:

```html
      <BaseSelect v-model="form.gest_canal"    label="Canal"     :options="opcCanales"   required />
```

por:

```html
      <BaseSelect v-if="!modoSala" v-model="form.gest_canal" label="Canal" :options="opcCanales" required />
      <div v-else data-testid="canal-fijo-sala" class="text-sm text-text2">
        Canal: <strong>🏛️ Visita en sala</strong>
      </div>
```

3h. Reemplaza la línea que abre el editor de productos:

```html
      <div class="border-t border-text3/10 pt-3">
```

por:

```html
      <div v-if="conProductos" class="border-t border-text3/10 pt-3">
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/crm/__tests__/RegistrarGestion.sala.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/crm/RegistrarGestion.vue src/components/crm/__tests__/RegistrarGestion.sala.spec.js
git commit -m "feat(salas): RegistrarGestion en modo sala con canal fijo y resumen del cliente"
```

---

### Task 9: `AtenderContratanteModal`

Directorio: **FRONT**.

**Files:**
- Create: `src/components/salas/AtenderContratanteModal.vue`
- Test: `src/components/salas/__tests__/AtenderContratanteModal.spec.js`

**Interfaces:**
- Consume: `salasApi.atender(id, datos)` (Task 7).
- Produce: el componente con props `open: Boolean` y `homenaje: Object|null` (un `Item` de la lista), y los eventos `close`, `atendido(respuestaVinculo)` y `cerrado`.

- [ ] **Step 1: Write the failing test** `src/components/salas/__tests__/AtenderContratanteModal.spec.js`

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/salasApi', () => ({ salasApi: { atender: vi.fn() } }));

import { salasApi } from '@/api/salasApi';
import AtenderContratanteModal from '@/components/salas/AtenderContratanteModal.vue';

const H = (extra = {}) => ({
  id: 55, sala_nombre: 'Sala 3', sede_nombre: 'Sede Norte', nombre_ser_querido: 'Luis Pérez',
  contratante_nombre: 'MARTA GOMEZ', contratante_telefono: '3001234567', ...extra
});

function factory(homenaje) {
  return mount(AtenderContratanteModal, {
    props: { open: true, homenaje },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } }
  });
}

async function confirmar(w) {
  await w.findAll('button').find((b) => b.text().trim() === 'Atender').trigger('click');
  await flushPromises();
}

describe('AtenderContratanteModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con datos completos no pide campos y atiende con un objeto vacío', async () => {
    salasApi.atender.mockResolvedValue({ success: true, data: { prosp_id: 905, es_mio: true } });
    const w = factory(H());
    expect(w.find('[data-testid="campos-contratante"]').exists()).toBe(false);
    expect(w.text()).toContain('MARTA GOMEZ');
    await confirmar(w);
    expect(salasApi.atender).toHaveBeenCalledWith(55, {});
    expect(w.emitted('atendido')[0]).toEqual([{ prosp_id: 905, es_mio: true }]);
  });

  it('sin teléfono pide los datos y no llama hasta completarlos', async () => {
    salasApi.atender.mockResolvedValue({ success: true, data: { prosp_id: 905, es_mio: true } });
    const w = factory(H({ contratante_telefono: '' }));
    expect(w.find('[data-testid="campos-contratante"]').exists()).toBe(true);
    await confirmar(w);
    expect(salasApi.atender).not.toHaveBeenCalled();
    const [, telefono] = w.findAll('[data-testid="campos-contratante"] input');
    await telefono.setValue('312 555 0101');
    await confirmar(w);
    expect(salasApi.atender).toHaveBeenCalledWith(55, { nombre: 'MARTA GOMEZ', telefono: '312 555 0101' });
  });

  it('si el backend responde TELEFONO_REQUERIDO muestra los campos', async () => {
    salasApi.atender.mockRejectedValue({ response: { data: { error: 'TELEFONO_REQUERIDO', message: 'Escribe un teléfono válido del contratante' } } });
    const w = factory(H());
    await confirmar(w);
    expect(w.find('[data-testid="campos-contratante"]').exists()).toBe(true);
    expect(w.emitted('atendido')).toBeUndefined();
  });

  it('si el homenaje ya finalizó emite cerrado', async () => {
    salasApi.atender.mockRejectedValue({ response: { data: { error: 'HOMENAJE_CERRADO', message: 'Este homenaje ya finalizó' } } });
    const w = factory(H());
    await confirmar(w);
    expect(w.emitted('cerrado')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/salas/__tests__/AtenderContratanteModal.spec.js`
Expected: FAIL con "Failed to resolve import".

- [ ] **Step 3: Implement** `src/components/salas/AtenderContratanteModal.vue`

```vue
<script setup>
/**
 * AtenderContratanteModal.vue — confirma la atención del contratante de un homenaje en sala.
 * Props: open, homenaje (item de GET /sv/salas/homenajes)
 * Emit: close, atendido (respuesta de POST …/atender), cerrado (el homenaje ya no está en curso)
 * La validez del teléfono la decide el backend; si responde 422, se piden los datos.
 */
import { ref, computed, watch } from 'vue';
import { salasApi } from '@/api/salasApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  homenaje: { type: Object, default: null }
});
const emit = defineEmits(['close', 'atendido', 'cerrado']);

const toast = useToastStore();
const { notify, extract } = useApiError();

const CODIGOS_DATOS = ['NOMBRE_REQUERIDO', 'TELEFONO_REQUERIDO'];
const CODIGOS_CERRADO = ['HOMENAJE_CERRADO', 'HOMENAJE_NO_ENCONTRADO'];

const nombre = ref('');
const telefono = ref('');
const pedirDatos = ref(false);
const guardando = ref(false);

const faltanDatos = computed(() => !props.homenaje?.contratante_nombre || !props.homenaje?.contratante_telefono);
const mostrarCampos = computed(() => faltanDatos.value || pedirDatos.value);

watch(() => props.open, (abierto) => {
  if (!abierto) return;
  nombre.value = props.homenaje?.contratante_nombre || '';
  telefono.value = props.homenaje?.contratante_telefono || '';
  pedirDatos.value = false;
}, { immediate: true });

async function confirmar() {
  if (mostrarCampos.value && (!nombre.value.trim() || !telefono.value.trim())) {
    toast.warning('Escribe el nombre y el teléfono del contratante');
    return;
  }
  guardando.value = true;
  try {
    const datos = mostrarCampos.value ? { nombre: nombre.value.trim(), telefono: telefono.value.trim() } : {};
    const r = await salasApi.atender(props.homenaje.id, datos);
    emit('atendido', r.data);
  } catch (e) {
    const codigo = e?.response?.data?.error;
    if (CODIGOS_DATOS.includes(codigo)) {
      pedirDatos.value = true;
      toast.warning(extract(e));
    } else if (CODIGOS_CERRADO.includes(codigo)) {
      toast.warning(extract(e));
      emit('cerrado');
    } else {
      notify(e);
    }
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="Atender contratante" max-width="max-w-md" @close="emit('close')">
    <div v-if="homenaje" class="space-y-3">
      <div class="text-xs text-text3">{{ homenaje.sala_nombre }} · {{ homenaje.sede_nombre }}</div>
      <div class="text-sm">Homenaje de <strong>{{ homenaje.nombre_ser_querido || '—' }}</strong></div>

      <div class="sv-card p-3">
        <div class="text-xs text-text3">Contratante</div>
        <div class="font-semibold text-text1">{{ homenaje.contratante_nombre || 'Sin nombre registrado' }}</div>
        <div class="text-sm text-text2">{{ homenaje.contratante_telefono || 'Sin teléfono registrado' }}</div>
      </div>

      <div v-if="mostrarCampos" data-testid="campos-contratante" class="space-y-3">
        <p class="text-xs text-warning">Completa los datos del contratante para crear el cliente.</p>
        <BaseInput v-model="nombre" label="Nombre del contratante" required />
        <BaseInput v-model="telefono" label="Teléfono" type="tel" required />
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="guardando" @click="confirmar">Atender</BaseButton>
    </template>
  </BaseModal>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/salas/__tests__/AtenderContratanteModal.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/salas/AtenderContratanteModal.vue src/components/salas/__tests__/AtenderContratanteModal.spec.js
git commit -m "feat(salas): ventana para atender al contratante de un homenaje"
```

---

### Task 10: Pantalla "Salas de velación", ruta y menú

Directorio: **FRONT**.

**Files:**
- Create: `src/views/prenecesidad/SalasVelacion.vue`
- Modify: `src/router/index.js:80-81` (ruta nueva)
- Modify: `src/components/layout/BottomNav.vue:15`, `src/components/layout/AppSidebar.vue:75`, `src/components/layout/AppHeader.vue:69`
- Test: `src/views/prenecesidad/__tests__/SalasVelacion.spec.js`

**Interfaces:**
- Consume: `salasApi.listar()` y `salasApi.atender(id)` (Task 7); `RegistrarGestion` con `homenajeSalaId` y `resumenCliente` (Task 8); `AtenderContratanteModal` (Task 9).
- Produce: la ruta `prenec-salas` en `/prenec/salas`.

- [ ] **Step 1: Write the failing test** `src/views/prenecesidad/__tests__/SalasVelacion.spec.js`

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/api/salasApi', () => ({ salasApi: { listar: vi.fn(), atender: vi.fn() } }));

import { salasApi } from '@/api/salasApi';
import SalasVelacion from '@/views/prenecesidad/SalasVelacion.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import AtenderContratanteModal from '@/components/salas/AtenderContratanteModal.vue';

const H = (id, extra = {}) => ({
  id, estado: 'ABIERTO', registrado_at: '2026-11-18T09:00:00', sala_nombre: 'Sala 3', sede_nombre: 'Sede Norte',
  nombre_ser_querido: 'Luis Pérez', contrato: 'C-9', contratante_nombre: 'MARTA GOMEZ', contratante_telefono: '3001234567',
  cliente: null, visitas: [], puede_atender: true, ...extra
});
const LISTA = [
  H(55),
  H(56, { cliente: { prosp_id: 900, es_mio: true, duenio_nombre: 'Denis Moreno', estado_nombre: 'Interesado' } }),
  H(57, {
    cliente: { prosp_id: 901, es_mio: false, duenio_nombre: 'Carmen Contreras', estado_nombre: 'Contactado' },
    visitas: [{ asesor_nombre: 'Carmen Contreras', fecha_hora: '2026-11-18T10:40:00' }]
  })
];

function factory() {
  return mount(SalasVelacion, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: { teleport: true, RegistrarGestion: true, AtenderContratanteModal: true }
    }
  });
}

describe('SalasVelacion', () => {
  beforeEach(() => { vi.clearAllMocks(); salasApi.listar.mockResolvedValue({ success: true, data: LISTA }); });

  it('muestra la etiqueta y el botón que corresponde a cada caso', async () => {
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="etiqueta-55"]').text()).toBe('Sin atender');
    expect(w.find('[data-testid="etiqueta-56"]').text()).toBe('Tu cliente · Interesado');
    expect(w.find('[data-testid="etiqueta-57"]').text()).toBe('Cliente de Carmen Contreras · Contactado');
    expect(w.find('[data-testid="btn-atender-55"]').text()).toBe('Atender contratante');
    expect(w.find('[data-testid="btn-ficha-56"]').text()).toBe('Abrir ficha');
    expect(w.find('[data-testid="btn-visita-57"]').text()).toBe('Registrar visita');
    expect(w.find('[data-testid="homenaje-57"]').text()).toContain('Carmen Contreras');
  });

  it('sin puede_atender no muestra botones', async () => {
    salasApi.listar.mockResolvedValue({ success: true, data: LISTA.map((h) => ({ ...h, puede_atender: false })) });
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid^="btn-"]').exists()).toBe(false);
  });

  it('estado vacío', async () => {
    salasApi.listar.mockResolvedValue({ success: true, data: [] });
    const w = factory();
    await flushPromises();
    expect(w.text()).toContain('No hay homenajes en curso en las salas');
  });

  it('Abrir ficha navega con el homenaje en la query', async () => {
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-ficha-56"]').trigger('click');
    expect(push).toHaveBeenCalledWith({ name: 'prenec-ficha', params: { id: 900 }, query: { homenaje: 56 } });
  });

  it('Registrar visita abre el formulario en modo sala con el resumen', async () => {
    salasApi.atender.mockResolvedValue({ success: true, data: {
      prosp_id: 901, prosp_area_id: 1, prosp_grupo_id: 1, es_mio: false, creado: false,
      persona_nombre: 'Marta Gomez', persona_telefono: '3001234567',
      resumen: { duenio_nombre: 'Carmen Contreras', estado_nombre: 'Contactado', prox_gestion_fecha: null, ultima_gestion: null }
    } });
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-visita-57"]').trigger('click');
    await flushPromises();
    expect(salasApi.atender).toHaveBeenCalledWith(57);
    const rg = w.findComponent(RegistrarGestion);
    expect(rg.props('open')).toBe(true);
    expect(rg.props('homenajeSalaId')).toBe(57);
    expect(rg.props('resumenCliente').duenio_nombre).toBe('Carmen Contreras');
    expect(rg.props('prospecto')).toEqual({
      prosp_id: 901, prosp_area_id: 1, prosp_grupo_id: 1,
      persona: { persona_nombre: 'Marta Gomez', persona_telefono_principal: '3001234567' }, productos: []
    });
  });

  it('Atender contratante abre la ventana y, si el cliente queda propio, navega a la ficha', async () => {
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-atender-55"]').trigger('click');
    const modal = w.findComponent(AtenderContratanteModal);
    expect(modal.props('open')).toBe(true);
    expect(modal.props('homenaje').id).toBe(55);
    modal.vm.$emit('atendido', { prosp_id: 905, es_mio: true });
    await flushPromises();
    expect(push).toHaveBeenCalledWith({ name: 'prenec-ficha', params: { id: 905 }, query: { homenaje: 55 } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/views/prenecesidad/__tests__/SalasVelacion.spec.js`
Expected: FAIL con "Failed to resolve import".

- [ ] **Step 3: Implement** `src/views/prenecesidad/SalasVelacion.vue`

```vue
<script setup>
/**
 * SalasVelacion.vue — homenajes en curso en las salas de velación (Homenajes360)
 * para que los asesores de Prenecesidad atiendan al contratante y registren visitas.
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { salasApi } from '@/api/salasApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { fmtFecha, fmtRelativo } from '@/utils/format';

import BaseButton from '@/components/ui/BaseButton.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import AtenderContratanteModal from '@/components/salas/AtenderContratanteModal.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';

const router = useRouter();
const toast = useToastStore();
const { notify, extract } = useApiError();

const CODIGOS_RECARGA = ['HOMENAJE_CERRADO', 'HOMENAJE_NO_ENCONTRADO', 'SIN_ATENDER'];

const homenajes = ref([]);
const cargando = ref(false);
const atendiendo = ref(null); // homenaje en la ventana de atención
const visita = ref(null);     // { homenajeId, prospecto, resumen } para RegistrarGestion

async function cargar() {
  cargando.value = true;
  try {
    homenajes.value = (await salasApi.listar()).data || [];
  } catch (e) {
    notify(e);
  } finally {
    cargando.value = false;
  }
}

function etiqueta(h) {
  if (!h.cliente) return 'Sin atender';
  if (h.cliente.es_mio) return `Tu cliente · ${h.cliente.estado_nombre}`;
  return `Cliente de ${h.cliente.duenio_nombre} · ${h.cliente.estado_nombre}`;
}

function claseEtiqueta(h) {
  if (!h.cliente) return 'bg-warning/10 text-warning';
  return h.cliente.es_mio ? 'bg-sage/10 text-sage' : 'bg-cream text-text2';
}

function cuando(fecha) {
  const d = new Date(fecha);
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `hoy ${hora}` : `${fmtFecha(fecha)} ${hora}`;
}

function irAFicha(prospId, homenajeId) {
  router.push({ name: 'prenec-ficha', params: { id: prospId }, query: { homenaje: homenajeId } });
}

function onAtendido(homenaje, data) {
  atendiendo.value = null;
  if (data.es_mio) return irAFicha(data.prosp_id, homenaje.id);
  visita.value = {
    homenajeId: homenaje.id,
    resumen: data.resumen,
    prospecto: {
      prosp_id: data.prosp_id,
      prosp_area_id: data.prosp_area_id,
      prosp_grupo_id: data.prosp_grupo_id,
      persona: { persona_nombre: data.persona_nombre, persona_telefono_principal: data.persona_telefono },
      productos: []
    }
  };
}

async function registrarVisita(h) {
  try {
    const r = await salasApi.atender(h.id);
    onAtendido(h, r.data);
  } catch (e) {
    const codigo = e?.response?.data?.error;
    if (CODIGOS_RECARGA.includes(codigo)) {
      toast.warning(extract(e));
      cargar();
    } else {
      notify(e);
    }
  }
}

function onCerrado() {
  atendiendo.value = null;
  cargar();
}

function onVisitaRegistrada() {
  visita.value = null;
  cargar();
}

onMounted(cargar);
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h1 class="font-serif text-2xl text-brown-deep">🏛️ Salas de velación</h1>
        <p class="text-sm text-text3">Homenajes en curso para atender al contratante</p>
      </div>
      <BaseButton variant="secondary" size="sm" :loading="cargando" @click="cargar">Recargar</BaseButton>
    </div>

    <EmptyState v-if="!cargando && !homenajes.length"
                titulo="No hay homenajes en curso en las salas"
                mensaje="Cuando Homenajes360 registre un homenaje en sala, aparecerá aquí."
                icono="🏛️" />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <article v-for="h in homenajes" :key="h.id" :data-testid="`homenaje-${h.id}`" class="sv-card p-4 space-y-2">
        <div class="flex items-center justify-between gap-2 text-xs text-text3">
          <span class="font-semibold truncate">{{ h.sala_nombre }} · {{ h.sede_nombre }}</span>
          <span class="shrink-0">{{ fmtRelativo(h.registrado_at) }}</span>
        </div>
        <div class="font-semibold text-text1">{{ h.nombre_ser_querido || '—' }}</div>
        <div v-if="h.contrato" class="text-xs text-text3">Contrato {{ h.contrato }}</div>
        <div class="text-sm">
          <span class="text-text3">Contratante:</span>
          {{ h.contratante_nombre || 'Sin nombre registrado' }}
          <span v-if="h.contratante_telefono" class="text-text3">· {{ h.contratante_telefono }}</span>
        </div>
        <span :data-testid="`etiqueta-${h.id}`"
              class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
              :class="claseEtiqueta(h)">{{ etiqueta(h) }}</span>
        <ul v-if="h.visitas.length" class="text-xs text-text3 space-y-0.5">
          <li v-for="(v, i) in h.visitas" :key="i">🏛️ {{ v.asesor_nombre }} · {{ cuando(v.fecha_hora) }}</li>
        </ul>
        <div v-if="h.puede_atender" class="pt-1">
          <BaseButton v-if="!h.cliente" :data-testid="`btn-atender-${h.id}`"
                      variant="primary" size="sm" @click="atendiendo = h">Atender contratante</BaseButton>
          <BaseButton v-else-if="h.cliente.es_mio" :data-testid="`btn-ficha-${h.id}`"
                      variant="primary" size="sm" @click="irAFicha(h.cliente.prosp_id, h.id)">Abrir ficha</BaseButton>
          <BaseButton v-else :data-testid="`btn-visita-${h.id}`"
                      variant="secondary" size="sm" @click="registrarVisita(h)">Registrar visita</BaseButton>
        </div>
      </article>
    </div>

    <AtenderContratanteModal :open="!!atendiendo" :homenaje="atendiendo"
                             @close="atendiendo = null"
                             @atendido="(data) => onAtendido(atendiendo, data)"
                             @cerrado="onCerrado" />
    <RegistrarGestion :open="!!visita"
                      :prospecto="visita ? visita.prospecto : null"
                      :homenaje-sala-id="visita ? visita.homenajeId : null"
                      :resumen-cliente="visita ? visita.resumen : null"
                      @close="visita = null"
                      @registrada="onVisitaRegistrada" />
  </div>
</template>
```

- [ ] **Step 4: Add the route** en `src/router/index.js`

Reemplaza:

```js
  { path: '/prenec/llamada/:id', name: 'prenec-llamada',   component: () => import('@/views/prenecesidad/EnLlamada.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },
```

por:

```js
  { path: '/prenec/llamada/:id', name: 'prenec-llamada',   component: () => import('@/views/prenecesidad/EnLlamada.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },
  { path: '/prenec/salas',       name: 'prenec-salas',     component: () => import('@/views/prenecesidad/SalasVelacion.vue'),
    meta: { requiereAuth: true, areaCodigo: 'PRENEC' } },
```

- [ ] **Step 5: Add the menu entry**

`src/components/layout/BottomNav.vue`: reemplaza

```js
    base.push({ to: { name: 'prenec-clientes' }, label: 'Clientes', icon: '👥' });
```

por

```js
    base.push({ to: { name: 'prenec-clientes' }, label: 'Clientes', icon: '👥' });
    base.push({ to: { name: 'prenec-salas' },    label: 'Salas',    icon: '🏛️' });
```

`src/components/layout/AppSidebar.vue`: reemplaza

```js
      { to: { name: 'prenec-clientes' }, label: 'Mis clientes',     icon: '👥' },
```

por

```js
      { to: { name: 'prenec-clientes' }, label: 'Mis clientes',     icon: '👥' },
      { to: { name: 'prenec-salas' },    label: 'Salas de velación', icon: '🏛️' },
```

`src/components/layout/AppHeader.vue`: reemplaza

```js
    grupos.push({ tipo: 'link', to: { name: 'prenec-clientes' }, label: 'Clientes' });
```

por

```js
    grupos.push({ tipo: 'link', to: { name: 'prenec-clientes' }, label: 'Clientes' });
    grupos.push({ tipo: 'link', to: { name: 'prenec-salas' },    label: 'Salas' });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/views/prenecesidad/__tests__/SalasVelacion.spec.js`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add src/views/prenecesidad/SalasVelacion.vue src/views/prenecesidad/__tests__/SalasVelacion.spec.js src/router/index.js src/components/layout/BottomNav.vue src/components/layout/AppSidebar.vue src/components/layout/AppHeader.vue
git commit -m "feat(salas): pantalla de salas de velación en Prenecesidad"
```

---

### Task 11: Ficha del cliente con `?homenaje=`

Directorio: **FRONT**.

**Files:**
- Modify: `src/views/prenecesidad/FichaCliente.vue`
- Test: `src/views/prenecesidad/__tests__/FichaCliente.sala.spec.js`

**Interfaces:**
- Consume: `salasApi.obtener(id)` (Task 7); la prop `homenajeSalaId` de `RegistrarGestion` (Task 8).

- [ ] **Step 1: Write the failing test** `src/views/prenecesidad/__tests__/FichaCliente.sala.spec.js`

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ruta, push, back } = vi.hoisted(() => ({
  ruta: { params: { id: '900' }, query: {} }, push: vi.fn(), back: vi.fn()
}));
vi.mock('vue-router', () => ({
  useRoute: () => ruta,
  useRouter: () => ({ push, back }),
  RouterLink: { template: '<a><slot /></a>' }
}));
vi.mock('@/api/salasApi', () => ({ salasApi: { obtener: vi.fn() } }));
vi.mock('@/api/personasApi', () => ({ personasApi: { prospectosActivos: vi.fn(async () => ({ data: [] })) } }));

import { salasApi } from '@/api/salasApi';
import FichaCliente from '@/views/prenecesidad/FichaCliente.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';

const PROSPECTO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1, prosp_persona_id: 500, prosp_prioridad: 3,
  persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' },
  estado: { estado_nombre: 'Nuevo', estado_color_hex: '#8A6A52' },
  asesor: { usr_nombre: 'Denis', usr_apellido: 'Moreno' }, productos: []
};
const HOMENAJE = {
  id: 56, estado: 'ABIERTO', sala_nombre: 'Sala 3', sede_nombre: 'Sede Norte',
  nombre_ser_querido: 'Luis Pérez', cliente: { prosp_id: 900, es_mio: true }
};

function factory() {
  return mount(FichaCliente, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo: PROSPECTO } } })],
      stubs: {
        teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true,
        ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true
      }
    }
  });
}

describe('FichaCliente con ?homenaje', () => {
  beforeEach(() => { vi.clearAllMocks(); ruta.query = {}; });

  it('muestra el aviso y pasa el homenaje al formulario cuando es el mismo cliente', async () => {
    ruta.query = { homenaje: '56' };
    salasApi.obtener.mockResolvedValue({ success: true, data: HOMENAJE });
    const w = factory();
    await flushPromises();
    expect(salasApi.obtener).toHaveBeenCalledWith(56);
    expect(w.find('[data-testid="aviso-visita-sala"]').text())
      .toContain('Visita en sala — Sala 3, Sede Norte · homenaje de Luis Pérez');
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBe(56);
  });

  it('ignora el homenaje de otro cliente', async () => {
    ruta.query = { homenaje: '56' };
    salasApi.obtener.mockResolvedValue({ success: true, data: { ...HOMENAJE, cliente: { prosp_id: 901, es_mio: false } } });
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(false);
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBeNull();
  });

  it('ignora un homenaje finalizado o con error', async () => {
    ruta.query = { homenaje: '56' };
    salasApi.obtener.mockResolvedValue({ success: true, data: { ...HOMENAJE, estado: 'FINALIZADO' } });
    let w = factory();
    await flushPromises();
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(false);

    salasApi.obtener.mockRejectedValue({ response: { status: 404 } });
    w = factory();
    await flushPromises();
    expect(w.find('[data-testid="aviso-visita-sala"]').exists()).toBe(false);
  });

  it('sin ?homenaje no consulta salas', async () => {
    const w = factory();
    await flushPromises();
    expect(salasApi.obtener).not.toHaveBeenCalled();
    expect(w.findComponent(RegistrarGestion).props('homenajeSalaId')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/views/prenecesidad/__tests__/FichaCliente.sala.spec.js`
Expected: FAIL. No existe `[data-testid="aviso-visita-sala"]` y `salasApi.obtener` no se llama.

- [ ] **Step 3: Implement** en `src/views/prenecesidad/FichaCliente.vue`

3a. Debajo de `import { personasApi } from '@/api/personasApi';` agrega:

```js
import { salasApi } from '@/api/salasApi';
```

3b. Debajo de `const showReasignar = ref(false);` agrega:

```js
// Visita en sala: solo si ?homenaje= apunta a un homenaje en curso de ESTE cliente.
const visitaSala = ref(null);

async function cargarVisitaSala() {
  visitaSala.value = null;
  const homenajeId = parseInt(route.query.homenaje);
  if (!homenajeId) return;
  try {
    const h = (await salasApi.obtener(homenajeId)).data;
    if (h && h.estado !== 'FINALIZADO' && h.cliente?.prosp_id === parseInt(route.params.id)) {
      visitaSala.value = h;
    }
  } catch {
    visitaSala.value = null; // cualquier error: la ficha funciona igual que siempre
  }
}
```

3c. En `cargar()`, reemplaza:

```js
  } catch (e) { notify(e); }
}
```

(el cierre de `cargar`, justo antes de `onMounted(cargar);`) por:

```js
  } catch (e) { notify(e); }
  await cargarVisitaSala();
}
```

3d. En el template, entre el cierre `</header>` y el comentario `<!-- Próxima gestión -->`, agrega:

```html
      <!-- Visita en sala de velación -->
      <section v-if="visitaSala" data-testid="aviso-visita-sala"
               class="sv-card p-4 mb-4 border-l-4 border-gold bg-gold/5 text-sm">
        🏛️ Visita en sala — {{ visitaSala.sala_nombre }}, {{ visitaSala.sede_nombre }} · homenaje de {{ visitaSala.nombre_ser_querido }}
      </section>
```

3e. Reemplaza:

```html
      <RegistrarGestion :open="showRegistrar" :prospecto="p" @close="showRegistrar = false" @registrada="cargar" />
```

por:

```html
      <RegistrarGestion :open="showRegistrar" :prospecto="p"
                        :homenaje-sala-id="visitaSala ? visitaSala.id : null"
                        @close="showRegistrar = false" @registrada="cargar" />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/views/prenecesidad/__tests__/FichaCliente.sala.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full frontend suite and build**

Run: `npx vitest run 2>&1 | tail -8`
Expected: todo en verde.

Run: `npm run build 2>&1 | tail -5`
Expected: build sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/views/prenecesidad/FichaCliente.vue src/views/prenecesidad/__tests__/FichaCliente.sala.spec.js
git commit -m "feat(salas): la ficha reconoce la visita en sala con ?homenaje"
```

---

### Task 12: Integración y despliegue

La ejecutan el controlador y el usuario; no la hace un subagente. Los pasos del servidor y de MySQL de producción **los hace el usuario**. Antes de cada push o despliegue hay que pedir su confirmación.

**Orden obligatorio.** La migración 023 va **antes** del backend nuevo. El modelo `SvGestion` incluye `gest_homenaje_sala_id` en cada `SELECT`, así que sin la columna fallarían todas las consultas de gestiones.

- [ ] **Step 1: Suites completas**

- BACK: `npx jest 2>&1 | tail -15`. Solo deben fallar las cinco suites preexistentes: `test/grupoIndivII.test.js`, `tests/invitacion.service.test.js`, `src/masajes/__tests__/adapters.test.js`, `src/masajes/__tests__/adapters.n8n.test.js` y `tests/afiliadoEmpresaAccess.test.js`.
- FRONT: `npx vitest run 2>&1 | tail -8` en verde y `npm run build` limpio.

- [ ] **Step 2: Integrar con `origin/main` y con la rama de permisos**

En BACK:

```bash
git fetch origin
git log --oneline HEAD..origin/main
git merge origin/main
```

- Si `fix/permisos-gestiones` ya está en `origin/main` y hay conflicto en `src/sv/services/gestiones.service.js`, conserva las dos cosas: la regla de `gest_asesor_id` de esa rama y la línea `gest_homenaje_sala_id: payload.gest_homenaje_sala_id || null,`.
- Si el número 023 quedó ocupado, renombra la migración al siguiente número libre y actualiza las referencias en los comentarios.
- Vuelve a correr `npx jest tests/salas*.test.js tests/homenajesSala.repo.test.js tests/contratante.utils.test.js tests/gestionesHomenaje.service.test.js`.

- [ ] **Step 3: Push del backend (con confirmación del usuario)**

```bash
git push origin HEAD:main
```

Si el push es rechazado porque `origin/main` avanzó, repite el Step 2.

- [ ] **Step 4 (usuario): Migración 023 en producción, antes del deploy**

En el servidor, dentro de `mantix-backend`:

```bash
git fetch origin
git show origin/main:src/sv/migrations/023_salas_velacion.sql | mysql -u root -p serfuweb
```

Verificación:

```sql
SELECT fuente_id, fuente_codigo, fuente_nombre FROM sv_cfg_fuentes_prospecto WHERE fuente_codigo = 'SALA_VELACION';
SHOW COLUMNS FROM sv_crm_gestiones LIKE 'gest_homenaje_sala_id';
SHOW CREATE TABLE sv_crm_salas_contratantes;
```

Idempotencia: correr la misma línea `git show … | mysql …` una segunda vez no debe dar error, y la primera consulta debe seguir devolviendo una sola fila.

- [ ] **Step 5 (usuario): Deploy del backend**

```bash
deploy-mantix
```

En los logs de pm2 no debe aparecer `Cannot find module` ni `Unknown column`.

- [ ] **Step 6: GenFlow (con confirmación del usuario)**

En el checkout de `crm-frontend`:

```bash
git merge --ff-only feat/salas-velacion
npm run build
ls -la /Volumes/AppServ/www/genflow/.htaccess
cp -a /Volumes/AppServ/www/genflow ~/respaldos/genflow-$(date +%Y%m%d-%H%M)
rsync -av --delete --exclude '.htaccess' dist/ /Volumes/AppServ/www/genflow/
ls -la /Volumes/AppServ/www/genflow/.htaccess
```

- Compara la cantidad de archivos de `dist/assets` local con la del servidor. Si el SMB perdió alguno, cópialo con `cp`.
- Pide confirmación antes de `git push origin main`.

- [ ] **Step 7 (usuario): Smoke**

1. Un asesor de Prenecesidad ve "Salas" en el menú y la lista de homenajes en curso.
2. "Atender contratante" sobre un homenaje sin atender lleva a su ficha con el aviso "🏛️ Visita en sala — …".
3. Registrar gestión desde esa ficha muestra el canal fijo, y el historial queda con 🏛️ y "Visita en sala".
4. Otro asesor ve "Cliente de <dueño> · <estado>", pulsa "Registrar visita", ve el resumen y registra. La tarjeta muestra las dos visitas.
5. Un supervisor ve la lista sin botones.
6. Logs: no hay `Unhandled Rejection`, y las líneas `SALA_ATENDER` y `SALA_VISITA` llevan solo identificadores.

- [ ] **Step 8: Reversión (solo si el smoke falla gravemente)**

1. GenFlow: restaura la carpeta respaldada en el Step 6 y pide recargar con Cmd/Ctrl+Shift+R.
2. Backend: `git revert` del merge de `feat/salas-velacion`, push y `deploy-mantix`.
3. La migración 023 puede quedarse. Es inofensiva para el código anterior: una fuente sin uso, una columna que puede estar vacía y una tabla nueva.

- [ ] **Step 9: Desvincular un homenaje vinculado al cliente equivocado (operación manual)**

Si "Atender contratante" vinculó un homenaje a un cliente que no corresponde, se desvincula a mano:

```sql
DELETE FROM sv_crm_salas_contratantes WHERE sc_homenaje_sala_id = <id>;
```

Las gestiones ya registradas en ese cliente quedan donde están, porque son inmutables. Después de desvincular, el próximo "Atender contratante" vuelve a vincular el homenaje.
