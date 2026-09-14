# SP-4 · Popup obligatorio de inicio de jornada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear con un modal a todo usuario operativo hasta que inicie jornada de tracking GPS o declare ausencia con motivo escrito.

**Architecture:** Backend expone `GET /jornadas/hoy` (estado + `requiere_popup`), `POST/DELETE /jornadas/ausencia`. Frontend Pinia store `useJornadaObligatoriaStore` chequea en login y en `visibilitychange`. Modal fullscreen bloqueante en `App.vue`.

**Tech Stack:** Node.js + Express + Sequelize (MySQL 8) · Vue 3 + Pinia + Vite · Jest (backend) · Vitest + @vue/test-utils (frontend).

## Global Constraints

- Rutas backend bajo `/api/sv/tracking/*`, ya montadas con `svAuth` en `src/sv/routes/index.js`.
- Roles operativos = todo excepto `SUPER_ADMIN`, `GERENTE_GENERAL`, `DIRECTOR_COMERCIAL`. Los códigos vienen de `src/sv/config/constants.js` → `ROLES`.
- Fechas en zona `America/Bogota`. Backend usa `hoyISO()` de `src/sv/utils/fechas.js`.
- Migraciones idempotentes tipo `011_tracking_geo.sql` (SET NAMES + IF EXISTS guards).
- Frontend registra API bajo `src/api/trackingApi.js` (extender objeto existente).
- Store Pinia con Composition API + `export const useX = defineStore(...)` como en `useTrackingStore`.
- Persistencia: no localStorage para el estado de "hoy" — se re-chequea contra backend.
- Componentes UI con Tailwind (mismas clases que `NuevoEventoAgendaModal.vue`).
- Attribution `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` en cada commit.

---

## File Structure

**Backend (`mantix-backend/`):**
- Create: `src/sv/migrations/019_jornadas_ausencias.sql` — tabla `sv_org_jornadas_ausencias`
- Create: `src/sv/models/JornadaAusencia.js` — modelo Sequelize
- Modify: `src/sv/models/index.js` — registra `SvJornadaAusencia`
- Create: `src/sv/validations/jornadaObligatoria.validation.js` — schemas Joi
- Create: `src/sv/services/jornadaObligatoria.service.js` — lógica estado + ausencia
- Modify: `src/sv/controllers/tracking.controller.js` — 3 métodos nuevos
- Modify: `src/sv/routes/tracking.routes.js` — 3 rutas nuevas
- Create: `tests/jornadaObligatoria.service.test.js` — unit tests service
- Create: `tests/jornadaObligatoria.routes.test.js` — integration tests routes

**Frontend (`crm-frontend/`):**
- Modify: `src/api/trackingApi.js` — agregar 3 endpoints
- Create: `src/stores/useJornadaObligatoriaStore.js` — Pinia store
- Create: `src/components/tracking/ModalInicioJornadaObligatorio.vue`
- Modify: `src/App.vue` — montar modal + observar auth
- Create: `src/stores/__tests__/useJornadaObligatoriaStore.spec.js`
- Create: `src/components/tracking/__tests__/ModalInicioJornadaObligatorio.spec.js`

---

## Task 1: Migración + Modelo `SvJornadaAusencia`

**Files:**
- Create: `mantix-backend/src/sv/migrations/019_jornadas_ausencias.sql`
- Create: `mantix-backend/src/sv/models/JornadaAusencia.js`
- Modify: `mantix-backend/src/sv/models/index.js` (línea después de registro de `SvJornada`/`SvTrackingPunto`)

**Interfaces:**
- Produces: modelo Sequelize `SvJornadaAusencia` con campos `aus_id`, `aus_usr_id`, `aus_fecha`, `aus_tipo`, `aus_motivo`, `aus_created_at` y asociación `belongsTo(SvUsuario, {as:'usuario', foreignKey:'aus_usr_id'})`.

- [ ] **Step 1: Crear archivo de migración SQL**

Path: `mantix-backend/src/sv/migrations/019_jornadas_ausencias.sql`

```sql
-- =====================================================================
-- SerVentas CRM — Migración 019: Ausencias declaradas del popup obligatorio
--
-- Cuando un usuario operativo declara "no laboro hoy" desde el modal
-- bloqueante, se registra un row aquí. Sirve para que el popup no vuelva
-- a molestarlo en el resto del día.
-- =====================================================================

SET NAMES utf8mb4;
SET @OLD_FK_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS sv_org_jornadas_ausencias (
  aus_id         INT AUTO_INCREMENT PRIMARY KEY,
  aus_usr_id     INT           NOT NULL,
  aus_fecha      DATE          NOT NULL,
  aus_tipo       VARCHAR(30)   NOT NULL,   -- PERMISO | INCAPACIDAD | DIA_LIBRE | OTRO
  aus_motivo     TEXT          NOT NULL,
  aus_created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_aus_usr_fecha (aus_usr_id, aus_fecha),
  INDEX idx_aus_fecha (aus_fecha),
  CONSTRAINT fk_aus_usr FOREIGN KEY (aus_usr_id)
    REFERENCES sv_org_usuarios(usr_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'SerVentas: ausencias declaradas por el popup obligatorio de jornada';

SET FOREIGN_KEY_CHECKS = @OLD_FK_CHECKS;

-- Verificación
SELECT COUNT(*) AS registros_iniciales FROM sv_org_jornadas_ausencias;
```

- [ ] **Step 2: Crear modelo Sequelize**

Path: `mantix-backend/src/sv/models/JornadaAusencia.js`

```js
// sv/models/JornadaAusencia.js — sv_org_jornadas_ausencias (migración 019)
// Ausencias declaradas por el popup obligatorio de jornada.
module.exports = (sequelize, DataTypes) => {
  const JornadaAusencia = sequelize.define('SvJornadaAusencia', {
    aus_id:      { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    aus_usr_id:  { type: DataTypes.INTEGER, allowNull: false },
    aus_fecha:   { type: DataTypes.DATEONLY, allowNull: false },
    aus_tipo:    { type: DataTypes.STRING(30), allowNull: false },
    aus_motivo:  { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'sv_org_jornadas_ausencias',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'aus_created_at',
    updatedAt: false
  });

  JornadaAusencia.associate = (models) => {
    JornadaAusencia.belongsTo(models.SvUsuario, { as: 'usuario', foreignKey: 'aus_usr_id' });
  };
  return JornadaAusencia;
};
```

- [ ] **Step 3: Registrar el modelo en el index**

Editar `mantix-backend/src/sv/models/index.js`. Encontrar la línea:

```js
  SvTrackingPunto:     require('./TrackingPunto')(sequelize, Sequelize.DataTypes),
```

Insertar inmediatamente **después**:

```js
  SvJornadaAusencia:   require('./JornadaAusencia')(sequelize, Sequelize.DataTypes),
```

- [ ] **Step 4: Verificar que el modelo carga sin errores**

Run:
```bash
cd mantix-backend && node -e "const m = require('./src/sv/models'); console.log(typeof m.SvJornadaAusencia);"
```
Expected: `function` (el modelo Sequelize definido).

- [ ] **Step 5: Commit**

```bash
cd mantix-backend && git add src/sv/migrations/019_jornadas_ausencias.sql src/sv/models/JornadaAusencia.js src/sv/models/index.js && git commit -m "$(cat <<'EOF'
feat(jornada-obligatoria): migración + modelo SvJornadaAusencia

Tabla sv_org_jornadas_ausencias para registrar cuando un usuario operativo
declara "no laboro hoy" desde el popup bloqueante del inicio de jornada.

Unique key (usr_id, fecha) para 1 solo registro por usuario/día.
Base de SP-4 (popup obligatorio de jornada).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Validaciones Joi

**Files:**
- Create: `mantix-backend/src/sv/validations/jornadaObligatoria.validation.js`
- Create: `mantix-backend/tests/jornadaObligatoria.validation.test.js`

**Interfaces:**
- Produces: schemas Joi `registrarAusencia` (body). Tipos válidos: `PERMISO`, `INCAPACIDAD`, `DIA_LIBRE`, `OTRO`. Motivo string entre 5 y 500 chars.

- [ ] **Step 1: Escribir el test primero**

Path: `mantix-backend/tests/jornadaObligatoria.validation.test.js`

```js
const v = require('../src/sv/validations/jornadaObligatoria.validation');

describe('registrarAusencia', () => {
  test('valida payload correcto', () => {
    const { error, value } = v.registrarAusencia.validate({
      tipo: 'PERMISO', motivo: 'Cita médica programada'
    });
    expect(error).toBeUndefined();
    expect(value.tipo).toBe('PERMISO');
  });

  test('rechaza tipo desconocido', () => {
    const { error } = v.registrarAusencia.validate({
      tipo: 'VACACIONES', motivo: 'blah blah'
    });
    expect(error).toBeDefined();
    expect(error.details[0].path).toEqual(['tipo']);
  });

  test('rechaza motivo con menos de 5 chars', () => {
    const { error } = v.registrarAusencia.validate({
      tipo: 'OTRO', motivo: 'hi'
    });
    expect(error).toBeDefined();
    expect(error.details[0].path).toEqual(['motivo']);
  });

  test('rechaza motivo mayor a 500 chars', () => {
    const { error } = v.registrarAusencia.validate({
      tipo: 'OTRO', motivo: 'x'.repeat(501)
    });
    expect(error).toBeDefined();
  });

  test('exige tipo y motivo obligatorios', () => {
    const { error } = v.registrarAusencia.validate({});
    expect(error).toBeDefined();
    expect(error.details.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla por módulo inexistente**

Run:
```bash
cd mantix-backend && npx jest tests/jornadaObligatoria.validation.test.js --no-coverage
```
Expected: FAIL — `Cannot find module '.../validations/jornadaObligatoria.validation'`.

- [ ] **Step 3: Crear el archivo de validación**

Path: `mantix-backend/src/sv/validations/jornadaObligatoria.validation.js`

```js
/**
 * sv/validations/jornadaObligatoria.validation.js
 * Schemas para el popup bloqueante de inicio de jornada (SP-4).
 */
const Joi = require('joi');

const TIPOS_AUSENCIA = ['PERMISO', 'INCAPACIDAD', 'DIA_LIBRE', 'OTRO'];

const registrarAusencia = Joi.object({
  tipo:   Joi.string().valid(...TIPOS_AUSENCIA).required(),
  motivo: Joi.string().trim().min(5).max(500).required()
});

module.exports = { registrarAusencia, TIPOS_AUSENCIA };
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run:
```bash
cd mantix-backend && npx jest tests/jornadaObligatoria.validation.test.js --no-coverage
```
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
cd mantix-backend && git add src/sv/validations/jornadaObligatoria.validation.js tests/jornadaObligatoria.validation.test.js && git commit -m "$(cat <<'EOF'
feat(jornada-obligatoria): validaciones Joi para ausencia declarada

Tipos válidos: PERMISO | INCAPACIDAD | DIA_LIBRE | OTRO.
Motivo obligatorio 5-500 chars.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Service `jornadaObligatoria.service.js`

**Files:**
- Create: `mantix-backend/src/sv/services/jornadaObligatoria.service.js`
- Create: `mantix-backend/tests/jornadaObligatoria.service.test.js`

**Interfaces:**
- Produces:
  - `esOperativo(usuario) → boolean` — true si el `rol_codigo` NO está en `['SUPER_ADMIN','GERENTE_GENERAL','DIRECTOR_COMERCIAL']`.
  - `estadoHoy(usuario) → Promise<{estado, jornada, ausencia, requiere_popup}>` con `estado` ∈ `'sin_iniciar' | 'activa' | 'finalizada' | 'ausente'`.
  - `registrarAusencia(usuarioId, {tipo, motivo}) → Promise<SvJornadaAusencia>`.
  - `eliminarAusenciaHoy(usuarioId) → Promise<number>` — filas borradas (0 o 1).

- [ ] **Step 1: Escribir el test primero**

Path: `mantix-backend/tests/jornadaObligatoria.service.test.js`

```js
const mockJornada  = { findOne: jest.fn() };
const mockAusencia = { findOne: jest.fn(), create: jest.fn(), destroy: jest.fn() };

jest.mock('../src/sv/models', () => ({
  SvJornada:         mockJornada,
  SvJornadaAusencia: mockAusencia
}));

jest.mock('../src/sv/utils/fechas', () => ({
  hoyISO: () => '2026-09-14'
}));

const svc = require('../src/sv/services/jornadaObligatoria.service');

const asesor    = { usr_id: 10, rol: { rol_codigo: 'ASESOR' } };
const coord     = { usr_id: 11, rol: { rol_codigo: 'COORDINADOR_PREVISION' } };
const director  = { usr_id: 12, rol: { rol_codigo: 'DIRECTOR_COMERCIAL' } };
const gerente   = { usr_id: 13, rol: { rol_codigo: 'GERENTE_GENERAL' } };
const superadm  = { usr_id: 14, rol: { rol_codigo: 'SUPER_ADMIN' } };

beforeEach(() => {
  mockJornada.findOne.mockReset().mockResolvedValue(null);
  mockAusencia.findOne.mockReset().mockResolvedValue(null);
  mockAusencia.create.mockReset();
  mockAusencia.destroy.mockReset();
});

describe('esOperativo', () => {
  test('asesor es operativo', () => expect(svc.esOperativo(asesor)).toBe(true));
  test('coordinador es operativo', () => expect(svc.esOperativo(coord)).toBe(true));
  test('director NO es operativo', () => expect(svc.esOperativo(director)).toBe(false));
  test('gerente NO es operativo', () => expect(svc.esOperativo(gerente)).toBe(false));
  test('super_admin NO es operativo', () => expect(svc.esOperativo(superadm)).toBe(false));
});

describe('estadoHoy', () => {
  test('asesor sin jornada ni ausencia → sin_iniciar + requiere_popup=true', async () => {
    const r = await svc.estadoHoy(asesor);
    expect(r.estado).toBe('sin_iniciar');
    expect(r.requiere_popup).toBe(true);
    expect(r.jornada).toBeNull();
    expect(r.ausencia).toBeNull();
  });

  test('asesor con jornada activa → activa + requiere_popup=false', async () => {
    mockJornada.findOne.mockResolvedValue({ jor_id: 'x', jor_estado: 'activa' });
    const r = await svc.estadoHoy(asesor);
    expect(r.estado).toBe('activa');
    expect(r.requiere_popup).toBe(false);
  });

  test('asesor con jornada finalizada → finalizada + requiere_popup=false', async () => {
    mockJornada.findOne.mockResolvedValue({ jor_id: 'x', jor_estado: 'finalizada' });
    const r = await svc.estadoHoy(asesor);
    expect(r.estado).toBe('finalizada');
    expect(r.requiere_popup).toBe(false);
  });

  test('asesor con ausencia declarada → ausente + requiere_popup=false', async () => {
    mockAusencia.findOne.mockResolvedValue({ aus_id: 1, aus_tipo: 'PERMISO' });
    const r = await svc.estadoHoy(asesor);
    expect(r.estado).toBe('ausente');
    expect(r.requiere_popup).toBe(false);
    expect(r.ausencia.aus_id).toBe(1);
  });

  test('director sin jornada → requiere_popup=false (no operativo)', async () => {
    const r = await svc.estadoHoy(director);
    expect(r.estado).toBe('sin_iniciar');
    expect(r.requiere_popup).toBe(false);
  });

  test('super_admin → requiere_popup=false', async () => {
    const r = await svc.estadoHoy(superadm);
    expect(r.requiere_popup).toBe(false);
  });
});

describe('registrarAusencia', () => {
  test('crea el registro y lo retorna', async () => {
    mockAusencia.create.mockResolvedValue({ aus_id: 42, aus_usr_id: 10 });
    const r = await svc.registrarAusencia(10, { tipo: 'PERMISO', motivo: 'Cita médica' });
    expect(mockAusencia.create).toHaveBeenCalledWith({
      aus_usr_id: 10,
      aus_fecha:  '2026-09-14',
      aus_tipo:   'PERMISO',
      aus_motivo: 'Cita médica'
    });
    expect(r.aus_id).toBe(42);
  });

  test('re-emite AUSENCIA_DUPLICADA si el unique key rechaza', async () => {
    const dupErr = new Error('dup');
    dupErr.name = 'SequelizeUniqueConstraintError';
    mockAusencia.create.mockRejectedValue(dupErr);
    await expect(
      svc.registrarAusencia(10, { tipo: 'OTRO', motivo: 'algo' })
    ).rejects.toMatchObject({ code: 'AUSENCIA_DUPLICADA' });
  });
});

describe('eliminarAusenciaHoy', () => {
  test('borra la ausencia del día y retorna el conteo', async () => {
    mockAusencia.destroy.mockResolvedValue(1);
    const r = await svc.eliminarAusenciaHoy(10);
    expect(mockAusencia.destroy).toHaveBeenCalledWith({
      where: { aus_usr_id: 10, aus_fecha: '2026-09-14' }
    });
    expect(r).toBe(1);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run:
```bash
cd mantix-backend && npx jest tests/jornadaObligatoria.service.test.js --no-coverage
```
Expected: FAIL — `Cannot find module '.../services/jornadaObligatoria.service'`.

- [ ] **Step 3: Implementar el service**

Path: `mantix-backend/src/sv/services/jornadaObligatoria.service.js`

```js
/**
 * sv/services/jornadaObligatoria.service.js
 * Lógica del popup bloqueante de inicio de jornada (SP-4).
 *
 * Reglas de negocio:
 *  - `requiere_popup = true` sólo si el usuario es operativo y hoy no tiene
 *    jornada abierta/cerrada ni ausencia declarada.
 *  - Roles NO operativos: SUPER_ADMIN, GERENTE_GENERAL, DIRECTOR_COMERCIAL.
 *  - Un usuario sólo puede tener 1 ausencia por día (unique key).
 */
const { SvJornada, SvJornadaAusencia } = require('../models');
const { hoyISO } = require('../utils/fechas');

const ROLES_NO_OPERATIVOS = new Set([
  'SUPER_ADMIN',
  'GERENTE_GENERAL',
  'DIRECTOR_COMERCIAL'
]);

function esOperativo(usuario) {
  const codigo = usuario?.rol?.rol_codigo;
  return !ROLES_NO_OPERATIVOS.has(codigo);
}

async function estadoHoy(usuario) {
  const fecha = hoyISO();
  const [jornada, ausencia] = await Promise.all([
    SvJornada.findOne({ where: { jor_usr_id: usuario.usr_id, jor_fecha: fecha } }),
    SvJornadaAusencia.findOne({ where: { aus_usr_id: usuario.usr_id, aus_fecha: fecha } })
  ]);

  let estado = 'sin_iniciar';
  if (ausencia)          estado = 'ausente';
  else if (jornada)      estado = jornada.jor_estado === 'activa' ? 'activa' : 'finalizada';

  const requiere_popup = esOperativo(usuario) && estado === 'sin_iniciar';

  return { estado, jornada, ausencia, requiere_popup };
}

async function registrarAusencia(usuarioId, { tipo, motivo }) {
  try {
    return await SvJornadaAusencia.create({
      aus_usr_id: usuarioId,
      aus_fecha:  hoyISO(),
      aus_tipo:   tipo,
      aus_motivo: motivo
    });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      const err = new Error('Ya declaraste ausencia hoy');
      err.code = 'AUSENCIA_DUPLICADA';
      throw err;
    }
    throw e;
  }
}

async function eliminarAusenciaHoy(usuarioId) {
  return SvJornadaAusencia.destroy({
    where: { aus_usr_id: usuarioId, aus_fecha: hoyISO() }
  });
}

module.exports = { esOperativo, estadoHoy, registrarAusencia, eliminarAusenciaHoy };
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run:
```bash
cd mantix-backend && npx jest tests/jornadaObligatoria.service.test.js --no-coverage
```
Expected: PASS (14/14).

- [ ] **Step 5: Commit**

```bash
cd mantix-backend && git add src/sv/services/jornadaObligatoria.service.js tests/jornadaObligatoria.service.test.js && git commit -m "$(cat <<'EOF'
feat(jornada-obligatoria): service con estadoHoy + registrarAusencia

- esOperativo: NO incluye SUPER_ADMIN, GERENTE_GENERAL, DIRECTOR_COMERCIAL
- estadoHoy: 'sin_iniciar' | 'activa' | 'finalizada' | 'ausente'
  con requiere_popup=true sólo si es operativo Y estado='sin_iniciar'
- registrarAusencia: reemite AUSENCIA_DUPLICADA si el unique rechaza
- eliminarAusenciaHoy: DELETE por (usuario, fecha_hoy)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Controller + Routes

**Files:**
- Modify: `mantix-backend/src/sv/controllers/tracking.controller.js` (agregar métodos al final del archivo, antes de `module.exports`)
- Modify: `mantix-backend/src/sv/routes/tracking.routes.js`
- Create: `mantix-backend/tests/jornadaObligatoria.routes.test.js`

**Interfaces:**
- Produces: 3 endpoints REST:
  - `GET  /api/sv/tracking/jornadas/hoy` → `{estado, jornada, ausencia, requiere_popup}`
  - `POST /api/sv/tracking/jornadas/ausencia` body `{tipo, motivo}` → 201 ausencia
  - `DELETE /api/sv/tracking/jornadas/ausencia/hoy` → 204 no content

- [ ] **Step 1: Escribir el test de integración**

Path: `mantix-backend/tests/jornadaObligatoria.routes.test.js`

```js
// Test de integración liviano: monta sólo el router de tracking con un
// middleware fake de auth. No usa DB — mockea el service completo.
const express = require('express');
const request = require('supertest');

jest.mock('../src/sv/services/jornadaObligatoria.service', () => ({
  esOperativo: jest.fn(),
  estadoHoy:  jest.fn(),
  registrarAusencia:   jest.fn(),
  eliminarAusenciaHoy: jest.fn()
}));

// Silenciar el service de tracking (que se importa junto en el controller)
jest.mock('../src/sv/services/tracking.service', () => ({}));

// Silenciar el modelo SvUsuario del controller (usado en puedeVerUsuario)
jest.mock('../src/sv/models', () => ({ SvUsuario: {} }));

const svcJornObl = require('../src/sv/services/jornadaObligatoria.service');
const trackingRoutes = require('../src/sv/routes/tracking.routes');

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use('/api/sv/tracking', trackingRoutes);
  return app;
}

const asesor  = { usr_id: 10, rol: { rol_codigo: 'ASESOR' } };

describe('GET /jornadas/hoy', () => {
  test('devuelve el estado del service', async () => {
    svcJornObl.estadoHoy.mockResolvedValue({
      estado: 'sin_iniciar', jornada: null, ausencia: null, requiere_popup: true
    });
    const r = await request(buildApp(asesor)).get('/api/sv/tracking/jornadas/hoy');
    expect(r.status).toBe(200);
    expect(r.body.data.requiere_popup).toBe(true);
    expect(svcJornObl.estadoHoy).toHaveBeenCalledWith(asesor);
  });
});

describe('POST /jornadas/ausencia', () => {
  test('crea ausencia con payload válido y responde 201', async () => {
    svcJornObl.registrarAusencia.mockResolvedValue({ aus_id: 7 });
    const r = await request(buildApp(asesor))
      .post('/api/sv/tracking/jornadas/ausencia')
      .send({ tipo: 'PERMISO', motivo: 'Cita médica' });
    expect(r.status).toBe(201);
    expect(r.body.data.aus_id).toBe(7);
  });

  test('422 con tipo inválido', async () => {
    const r = await request(buildApp(asesor))
      .post('/api/sv/tracking/jornadas/ausencia')
      .send({ tipo: 'BLAH', motivo: 'bla bla bla' });
    expect(r.status).toBe(422);
  });

  test('409 si el service reporta AUSENCIA_DUPLICADA', async () => {
    const dup = new Error('dup');
    dup.code = 'AUSENCIA_DUPLICADA';
    svcJornObl.registrarAusencia.mockRejectedValue(dup);
    const r = await request(buildApp(asesor))
      .post('/api/sv/tracking/jornadas/ausencia')
      .send({ tipo: 'OTRO', motivo: 'razón válida' });
    expect(r.status).toBe(409);
  });
});

describe('DELETE /jornadas/ausencia/hoy', () => {
  test('204 al borrar', async () => {
    svcJornObl.eliminarAusenciaHoy.mockResolvedValue(1);
    const r = await request(buildApp(asesor))
      .delete('/api/sv/tracking/jornadas/ausencia/hoy');
    expect(r.status).toBe(204);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run:
```bash
cd mantix-backend && npx jest tests/jornadaObligatoria.routes.test.js --no-coverage
```
Expected: FAIL — las rutas devuelven 404 porque aún no existen los handlers.

- [ ] **Step 3: Agregar los métodos al controller**

Editar `mantix-backend/src/sv/controllers/tracking.controller.js`. Buscar `module.exports = {` al final del archivo. **Antes** de esa línea, insertar:

```js
// ─────────────────────────────────────────────────────────
// SP-4 · Popup obligatorio de inicio de jornada
// ─────────────────────────────────────────────────────────
const jornadaObligatoria = require('../services/jornadaObligatoria.service');

async function estadoJornadaHoy(req, res) {
  const r = await jornadaObligatoria.estadoHoy(req.user);
  return ok(res, r);
}

async function registrarAusenciaHoy(req, res) {
  try {
    const a = await jornadaObligatoria.registrarAusencia(req.user.usr_id, req.body);
    return created(res, a);
  } catch (e) {
    if (e.code === 'AUSENCIA_DUPLICADA') {
      return fail(res, 409, ERROR_CODES.CONFLICT, e.message);
    }
    throw e;
  }
}

async function eliminarAusenciaHoy(req, res) {
  await jornadaObligatoria.eliminarAusenciaHoy(req.user.usr_id);
  return noContent(res);
}
```

Después, dentro del `module.exports = { ... }` que ya existe, agregar al final de la lista:

```js
  estadoJornadaHoy,
  registrarAusenciaHoy,
  eliminarAusenciaHoy
```

**Verificar** que `ERROR_CODES.CONFLICT` existe en `src/sv/config/constants.js`. Si no existe, agregarlo:

```bash
cd mantix-backend && grep "CONFLICT" src/sv/config/constants.js
```
Si no aparece, editar `src/sv/config/constants.js` y agregar `CONFLICT: 'CONFLICT',` dentro del objeto `ERROR_CODES`.

- [ ] **Step 4: Agregar las rutas**

Editar `mantix-backend/src/sv/routes/tracking.routes.js`. Después de la línea:

```js
router.get   ('/jornadas',                    validate(v.listarJornadas, 'query'),         ctrl.listarJornadas);
```

Insertar:

```js

// SP-4 · Popup obligatorio de inicio de jornada
const vJornObl = require('../validations/jornadaObligatoria.validation');
router.get   ('/jornadas/hoy',                                                             ctrl.estadoJornadaHoy);
router.post  ('/jornadas/ausencia',           validate(vJornObl.registrarAusencia),        ctrl.registrarAusenciaHoy);
router.delete('/jornadas/ausencia/hoy',                                                    ctrl.eliminarAusenciaHoy);
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run:
```bash
cd mantix-backend && npx jest tests/jornadaObligatoria.routes.test.js --no-coverage
```
Expected: PASS (5/5).

- [ ] **Step 6: Correr la suite completa para no romper nada**

Run:
```bash
cd mantix-backend && npx jest --no-coverage
```
Expected: todos los tests siguen pasando. Si alguno rompe por el cambio, revisar.

- [ ] **Step 7: Commit**

```bash
cd mantix-backend && git add src/sv/controllers/tracking.controller.js src/sv/routes/tracking.routes.js src/sv/config/constants.js tests/jornadaObligatoria.routes.test.js && git commit -m "$(cat <<'EOF'
feat(jornada-obligatoria): endpoints GET /hoy, POST/DELETE /ausencia

Rutas bajo /api/sv/tracking/jornadas:
- GET  /hoy            → estado + requiere_popup
- POST /ausencia       → declarar "no laboro hoy" (tipo + motivo)
- DELETE /ausencia/hoy → arrepentimiento

Añade ERROR_CODES.CONFLICT si faltaba.
Reutiliza validate + svAuth middleware existentes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend · Extender `trackingApi.js`

**Files:**
- Modify: `crm-frontend/src/api/trackingApi.js`

**Interfaces:**
- Produces: `trackingApi.estadoJornadaHoy()`, `trackingApi.registrarAusenciaHoy({tipo, motivo})`, `trackingApi.eliminarAusenciaHoy()`.

- [ ] **Step 1: Agregar los endpoints al objeto exportado**

Editar `crm-frontend/src/api/trackingApi.js`. Reemplazar el objeto `trackingApi` completo por:

```js
import api from './axios';

/**
 * Endpoints del módulo tracking GPS (Fase 7) bajo /api/sv/tracking.
 */
export const trackingApi = {
  // Jornadas propias
  iniciarJornada:   (payload = {}) => api.post('/tracking/jornadas', payload).then(r => r.data),
  finalizarJornada: (jornadaId, payload = {}) => api.patch(`/tracking/jornadas/${jornadaId}/finalizar`, payload).then(r => r.data),
  batchPuntos:      (jornadaId, puntos) => api.post(`/tracking/jornadas/${jornadaId}/puntos`, { puntos }).then(r => r.data),
  listarJornadas:   (params = {}) => api.get('/tracking/jornadas', { params }).then(r => r.data),

  // Recorridos
  recorrido:        (usrId, fecha) => api.get(`/tracking/recorrido/${usrId}`, { params: { fecha } }).then(r => r.data),
  liveEquipo:       (params = {}) => api.get('/tracking/equipo/live', { params }).then(r => r.data),

  // Habeas Data
  aceptarConsentimiento: () => api.post('/tracking/me/consentimiento').then(r => r.data),
  exportarMisDatos:      (desde, hasta) =>
    api.get('/tracking/me/exportar', { params: { desde, hasta }, responseType: 'blob' }).then(r => r.data),

  // SP-4 · Popup obligatorio
  estadoJornadaHoy:      () => api.get('/tracking/jornadas/hoy').then(r => r.data),
  registrarAusenciaHoy:  (payload) => api.post('/tracking/jornadas/ausencia', payload).then(r => r.data),
  eliminarAusenciaHoy:   () => api.delete('/tracking/jornadas/ausencia/hoy').then(r => r.data)
};
```

- [ ] **Step 2: Verificar sintaxis con el linter/build check**

Run:
```bash
cd crm-frontend && npx eslint src/api/trackingApi.js 2>&1 | head -20 || true
```
Expected: sin errores (o warnings que ya existían).

- [ ] **Step 3: Commit**

```bash
cd crm-frontend && git add src/api/trackingApi.js && git commit -m "$(cat <<'EOF'
feat(jornada-obligatoria): 3 endpoints en trackingApi

- estadoJornadaHoy()
- registrarAusenciaHoy({tipo, motivo})
- eliminarAusenciaHoy()

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Frontend · Store `useJornadaObligatoriaStore`

**Files:**
- Create: `crm-frontend/src/stores/useJornadaObligatoriaStore.js`
- Create: `crm-frontend/src/stores/__tests__/useJornadaObligatoriaStore.spec.js`

**Interfaces:**
- Produces store Pinia `useJornadaObligatoriaStore` con:
  - state: `estado` (`'sin_chequear'|'ok'|'bloqueado'|'ausente'`), `ultimoChequeoAt` (timestamp), `chequeando` (bool)
  - computed: `debeBloquear` (bool) — true si `estado === 'bloqueado'`
  - actions:
    - `chequear({force=false}) → Promise<void>` — llama al backend, cachea 60 s salvo `force=true`.
    - `marcarAusencia({tipo, motivo}) → Promise<void>` — llama endpoint, deja estado='ausente'.
    - `marcarJornadaIniciada() → void` — helper local para setear estado='ok' tras iniciar jornada.
    - `reset() → void` — vuelve a `'sin_chequear'`.

- [ ] **Step 1: Escribir el test primero**

Path: `crm-frontend/src/stores/__tests__/useJornadaObligatoriaStore.spec.js`

```js
import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/trackingApi', () => ({
  trackingApi: {
    estadoJornadaHoy:     vi.fn(),
    registrarAusenciaHoy: vi.fn(),
    eliminarAusenciaHoy:  vi.fn()
  }
}));

import { trackingApi } from '@/api/trackingApi';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';

describe('useJornadaObligatoriaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('estado inicial es sin_chequear', () => {
    const s = useJornadaObligatoriaStore();
    expect(s.estado).toBe('sin_chequear');
    expect(s.debeBloquear).toBe(false);
  });

  it('chequear con requiere_popup=true → bloqueado', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({
      data: { estado: 'sin_iniciar', requiere_popup: true, jornada: null, ausencia: null }
    });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('bloqueado');
    expect(s.debeBloquear).toBe(true);
  });

  it('chequear con requiere_popup=false → ok', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({
      data: { estado: 'activa', requiere_popup: false, jornada: { jor_id: 'x' }, ausencia: null }
    });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('ok');
  });

  it('chequear con estado=ausente → ausente', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({
      data: { estado: 'ausente', requiere_popup: false, ausencia: { aus_id: 1 } }
    });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    expect(s.estado).toBe('ausente');
  });

  it('cachea 60s salvo force=true', async () => {
    trackingApi.estadoJornadaHoy.mockResolvedValue({
      data: { estado: 'sin_iniciar', requiere_popup: true }
    });
    const s = useJornadaObligatoriaStore();
    await s.chequear();
    await s.chequear();
    expect(trackingApi.estadoJornadaHoy).toHaveBeenCalledTimes(1);
    await s.chequear({ force: true });
    expect(trackingApi.estadoJornadaHoy).toHaveBeenCalledTimes(2);
  });

  it('marcarAusencia deja estado=ausente', async () => {
    trackingApi.registrarAusenciaHoy.mockResolvedValue({ data: { aus_id: 9 } });
    const s = useJornadaObligatoriaStore();
    await s.marcarAusencia({ tipo: 'PERMISO', motivo: 'cita' });
    expect(s.estado).toBe('ausente');
    expect(trackingApi.registrarAusenciaHoy).toHaveBeenCalledWith({
      tipo: 'PERMISO', motivo: 'cita'
    });
  });

  it('marcarJornadaIniciada deja estado=ok', () => {
    const s = useJornadaObligatoriaStore();
    s.marcarJornadaIniciada();
    expect(s.estado).toBe('ok');
  });

  it('reset vuelve a sin_chequear', () => {
    const s = useJornadaObligatoriaStore();
    s.marcarJornadaIniciada();
    s.reset();
    expect(s.estado).toBe('sin_chequear');
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run:
```bash
cd crm-frontend && npx vitest run src/stores/__tests__/useJornadaObligatoriaStore.spec.js
```
Expected: FAIL — module `@/stores/useJornadaObligatoriaStore` no existe.

- [ ] **Step 3: Implementar el store**

Path: `crm-frontend/src/stores/useJornadaObligatoriaStore.js`

```js
/**
 * useJornadaObligatoriaStore — estado del popup bloqueante de inicio de jornada.
 * Consumido por App.vue y por el modal ModalInicioJornadaObligatorio.
 * No persiste en localStorage: siempre se re-chequea contra backend.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { trackingApi } from '@/api/trackingApi';

const CACHE_MS = 60_000;

export const useJornadaObligatoriaStore = defineStore('svJornadaObligatoria', () => {
  const estado          = ref('sin_chequear'); // 'sin_chequear' | 'ok' | 'bloqueado' | 'ausente'
  const ultimoChequeoAt = ref(0);
  const chequeando      = ref(false);

  const debeBloquear = computed(() => estado.value === 'bloqueado');

  async function chequear({ force = false } = {}) {
    if (!force && Date.now() - ultimoChequeoAt.value < CACHE_MS) return;
    if (chequeando.value) return;
    chequeando.value = true;
    try {
      const r = await trackingApi.estadoJornadaHoy();
      const data = r?.data || r; // tolera envolturas {ok:true,data:{}} o crudas
      if (data.estado === 'ausente')             estado.value = 'ausente';
      else if (data.requiere_popup)              estado.value = 'bloqueado';
      else                                       estado.value = 'ok';
      ultimoChequeoAt.value = Date.now();
    } finally {
      chequeando.value = false;
    }
  }

  async function marcarAusencia({ tipo, motivo }) {
    await trackingApi.registrarAusenciaHoy({ tipo, motivo });
    estado.value = 'ausente';
    ultimoChequeoAt.value = Date.now();
  }

  function marcarJornadaIniciada() {
    estado.value = 'ok';
    ultimoChequeoAt.value = Date.now();
  }

  function reset() {
    estado.value = 'sin_chequear';
    ultimoChequeoAt.value = 0;
    chequeando.value = false;
  }

  return {
    estado, ultimoChequeoAt, chequeando,
    debeBloquear,
    chequear, marcarAusencia, marcarJornadaIniciada, reset
  };
});
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run:
```bash
cd crm-frontend && npx vitest run src/stores/__tests__/useJornadaObligatoriaStore.spec.js
```
Expected: PASS (8/8).

Si vitest no está configurado, verificar con:
```bash
cd crm-frontend && cat package.json | grep -E 'vitest|test'
```
Si no existe `vitest`, instalar con: `npm install --save-dev vitest @vue/test-utils happy-dom` y agregar `"test": "vitest"` a scripts.

- [ ] **Step 5: Commit**

```bash
cd crm-frontend && git add src/stores/useJornadaObligatoriaStore.js src/stores/__tests__/useJornadaObligatoriaStore.spec.js && git commit -m "$(cat <<'EOF'
feat(jornada-obligatoria): store useJornadaObligatoriaStore

Estado 'sin_chequear' | 'ok' | 'bloqueado' | 'ausente'.
Chequeo cacheado 60s con opción force=true.
Métodos marcarAusencia y marcarJornadaIniciada actualizan estado local
tras acciones exitosas del usuario.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend · Componente `ModalInicioJornadaObligatorio.vue`

**Files:**
- Create: `crm-frontend/src/components/tracking/ModalInicioJornadaObligatorio.vue`
- Create: `crm-frontend/src/components/tracking/__tests__/ModalInicioJornadaObligatorio.spec.js`

**Interfaces:**
- Consumes:
  - `useJornadaObligatoriaStore` (marcarAusencia, marcarJornadaIniciada)
  - `useTrackingStore` (iniciar)
  - `useAuthStore` (nombreCompleto)
  - `useToastStore` (success/error)
- Produces: modal bloqueante fullscreen sin cerrar (no Escape, no click fuera). 2 tabs. Emite nada — actualiza store.

- [ ] **Step 1: Escribir el test primero**

Path: `crm-frontend/src/components/tracking/__tests__/ModalInicioJornadaObligatorio.spec.js`

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ModalInicioJornadaObligatorio from '@/components/tracking/ModalInicioJornadaObligatorio.vue';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';
import { useTrackingStore } from '@/stores/useTrackingStore';

function factory() {
  return mount(ModalInicioJornadaObligatorio, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })]
    },
    attachTo: document.body
  });
}

describe('ModalInicioJornadaObligatorio', () => {
  beforeEach(() => document.body.innerHTML = '');

  it('renderiza dos tabs', () => {
    const wrapper = factory();
    expect(wrapper.text()).toContain('Iniciar jornada');
    expect(wrapper.text()).toContain('No laboro hoy');
  });

  it('tab por defecto: iniciar jornada', () => {
    const wrapper = factory();
    expect(wrapper.find('[data-testid="tab-iniciar"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-ausencia"]').exists()).toBe(false);
  });

  it('cambia a tab de ausencia', async () => {
    const wrapper = factory();
    await wrapper.find('[data-testid="btn-tab-ausencia"]').trigger('click');
    expect(wrapper.find('[data-testid="tab-ausencia"]').exists()).toBe(true);
  });

  it('valida motivo mínimo 5 chars', async () => {
    const wrapper = factory();
    await wrapper.find('[data-testid="btn-tab-ausencia"]').trigger('click');
    await wrapper.find('[data-testid="input-motivo"]').setValue('abc');
    const btn = wrapper.find('[data-testid="btn-confirmar-ausencia"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('bloquea Escape: preventDefault + stopPropagation', () => {
    factory();
    const preventDefault  = vi.fn();
    const stopPropagation = vi.fn();
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    Object.defineProperty(ev, 'preventDefault',  { value: preventDefault });
    Object.defineProperty(ev, 'stopPropagation', { value: stopPropagation });
    document.dispatchEvent(ev);
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('bloquea overflow del body mientras está montado', () => {
    document.body.style.overflow = '';
    const wrapper = factory();
    expect(document.body.style.overflow).toBe('hidden');
    wrapper.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('al confirmar iniciar jornada, llama tracking.iniciar y marcarJornadaIniciada', async () => {
    const wrapper = factory();
    const tracking = useTrackingStore();
    const jornStore = useJornadaObligatoriaStore();
    tracking.iniciar = vi.fn().mockResolvedValue({ jor_id: 'x' });
    jornStore.marcarJornadaIniciada = vi.fn();

    await wrapper.find('[data-testid="btn-iniciar-jornada"]').trigger('click');
    await flushPromises();

    expect(tracking.iniciar).toHaveBeenCalled();
    expect(jornStore.marcarJornadaIniciada).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run:
```bash
cd crm-frontend && npx vitest run src/components/tracking/__tests__/ModalInicioJornadaObligatorio.spec.js
```
Expected: FAIL — el componente no existe.

- [ ] **Step 3: Crear el componente**

Path: `crm-frontend/src/components/tracking/ModalInicioJornadaObligatorio.vue`

```vue
<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jorObl-title"
    >
      <div class="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <header class="bg-gradient-to-br from-green-700 to-green-900 px-6 py-5 text-white">
          <h2 id="jorObl-title" class="text-lg font-bold leading-tight">
            {{ saludo }}, {{ auth.nombreCompleto }}
          </h2>
          <p class="text-green-100 text-sm mt-1">
            Antes de comenzar, indícanos cómo será tu día.
          </p>
          <p class="text-green-200 text-xs mt-1">{{ fechaHoy }}</p>
        </header>

        <div class="flex border-b border-gray-200 text-sm font-medium">
          <button
            type="button"
            data-testid="btn-tab-iniciar"
            class="flex-1 py-3"
            :class="tab === 'iniciar' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-gray-700'"
            @click="tab = 'iniciar'"
          >Iniciar jornada</button>
          <button
            type="button"
            data-testid="btn-tab-ausencia"
            class="flex-1 py-3"
            :class="tab === 'ausencia' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-gray-700'"
            @click="tab = 'ausencia'"
          >No laboro hoy</button>
        </div>

        <!-- Tab: Iniciar jornada -->
        <section
          v-if="tab === 'iniciar'"
          data-testid="tab-iniciar"
          class="px-6 py-6 space-y-4"
        >
          <p class="text-sm text-gray-600">
            Al iniciar, el sistema empezará a registrar tu ubicación durante la jornada.
            Este dato es obligatorio por política de la empresa.
          </p>
          <div v-if="permisoGpsFallido" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No pudimos leer tu GPS. Verifica que le diste permiso al navegador y vuelve a intentar.
          </div>
          <button
            type="button"
            data-testid="btn-iniciar-jornada"
            :disabled="cargando"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white font-semibold text-sm rounded-lg transition-colors"
            @click="iniciarJornada"
          >
            <span v-if="cargando" class="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span>
            {{ cargando ? 'Iniciando...' : 'Iniciar jornada ahora' }}
          </button>
        </section>

        <!-- Tab: No laboro hoy -->
        <section
          v-else
          data-testid="tab-ausencia"
          class="px-6 py-6 space-y-4"
        >
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
            <select
              v-model="ausencia.tipo"
              data-testid="select-tipo"
              class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm"
            >
              <option value="PERMISO">Permiso</option>
              <option value="INCAPACIDAD">Incapacidad</option>
              <option value="DIA_LIBRE">Día libre</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              v-model="ausencia.motivo"
              data-testid="input-motivo"
              rows="3"
              minlength="5"
              maxlength="500"
              placeholder="Explica brevemente (mínimo 5 caracteres)"
              class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm resize-none"
            ></textarea>
            <p class="text-xs text-gray-400 mt-1">{{ ausencia.motivo.length }} / 500</p>
          </div>
          <button
            type="button"
            data-testid="btn-confirmar-ausencia"
            :disabled="!ausenciaValida || cargando"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-sm rounded-lg transition-colors"
            @click="confirmarAusencia"
          >
            <span v-if="cargando" class="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span>
            {{ cargando ? 'Guardando...' : 'Confirmar ausencia' }}
          </button>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTrackingStore } from '@/stores/useTrackingStore';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';
import { useToastStore } from '@/stores/useToastStore';

const auth     = useAuthStore();
const tracking = useTrackingStore();
const jornObl  = useJornadaObligatoriaStore();
const toast    = useToastStore();

const tab      = ref('iniciar');
const cargando = ref(false);
const permisoGpsFallido = ref(false);
const ausencia = reactive({ tipo: 'PERMISO', motivo: '' });

const ausenciaValida = computed(() => ausencia.motivo.trim().length >= 5);

const fechaHoy = new Date().toLocaleDateString('es-CO', {
  timeZone: 'America/Bogota', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
});

const saludo = (() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
})();

async function iniciarJornada() {
  cargando.value = true;
  permisoGpsFallido.value = false;
  try {
    await tracking.iniciar();
    jornObl.marcarJornadaIniciada();
    toast.success('Jornada iniciada. Tracking activo.');
  } catch (e) {
    if (String(e?.message || '').toLowerCase().includes('geoloc')) {
      permisoGpsFallido.value = true;
    }
    toast.error('No se pudo iniciar la jornada. Verifica el permiso de ubicación.');
  } finally {
    cargando.value = false;
  }
}

async function confirmarAusencia() {
  if (!ausenciaValida.value) return;
  cargando.value = true;
  try {
    await jornObl.marcarAusencia({
      tipo:   ausencia.tipo,
      motivo: ausencia.motivo.trim()
    });
    toast.success('Ausencia registrada por hoy.');
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo registrar la ausencia.');
  } finally {
    cargando.value = false;
  }
}

// Bloquear Escape y navegación con Tab fuera del modal
function onKeyDown(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
}
onMounted(() => {
  document.addEventListener('keydown', onKeyDown, true);
  document.body.style.overflow = 'hidden';
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown, true);
  document.body.style.overflow = '';
});
</script>
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run:
```bash
cd crm-frontend && npx vitest run src/components/tracking/__tests__/ModalInicioJornadaObligatorio.spec.js
```
Expected: PASS (6/6).

Si vitest reclama un path alias `@/`, verificar en `vitest.config.js` (o extender `vite.config.js`) que `alias '@' → src` está definido. Ya existe en `vite.config.js`; para vitest puede que se necesite un `vitest.config.js`:

```js
// crm-frontend/vitest.config.js (crear si no existe)
import { defineConfig, mergeConfig } from 'vite';
import viteConfig from './vite.config.js';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true
  }
}));
```

- [ ] **Step 5: Commit**

```bash
cd crm-frontend && git add src/components/tracking/ModalInicioJornadaObligatorio.vue src/components/tracking/__tests__/ModalInicioJornadaObligatorio.spec.js vitest.config.js && git commit -m "$(cat <<'EOF'
feat(jornada-obligatoria): modal bloqueante ModalInicioJornadaObligatorio

Overlay opaco full-screen z-9999, sin cerrar con Escape ni click fuera.
Dos tabs: Iniciar jornada (arranca useTrackingStore) y No laboro hoy
(POST /jornadas/ausencia con tipo + motivo min 5).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Frontend · Integración en `App.vue`

**Files:**
- Modify: `crm-frontend/src/App.vue`

**Interfaces:**
- Consumes: `useAuthStore` (isAuthenticated), `useJornadaObligatoriaStore` (chequear, debeBloquear, reset).

- [ ] **Step 1: Leer el estado actual de App.vue**

Run:
```bash
cd crm-frontend && cat src/App.vue
```
Anotar la estructura del `<template>` para insertar el modal sin romperla.

- [ ] **Step 2: Editar App.vue**

Al final del `<template>` (después del `<router-view />` y de cualquier otro modal global), agregar:

```vue
<!-- SP-4: bloqueo obligatorio de inicio de jornada -->
<ModalInicioJornadaObligatorio v-if="jornObl.debeBloquear" />
```

En el `<script setup>`, agregar los imports y la lógica de watchers:

```js
import { watch, onMounted, onBeforeUnmount } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';
import ModalInicioJornadaObligatorio from '@/components/tracking/ModalInicioJornadaObligatorio.vue';

const auth    = useAuthStore();
const jornObl = useJornadaObligatoriaStore();

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && auth.isAuthenticated) {
    jornObl.chequear({ force: true });
  }
}

watch(() => auth.isAuthenticated, (v) => {
  if (v) jornObl.chequear();
  else   jornObl.reset();
}, { immediate: true });

onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange));
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibilityChange));
```

**Si el `<script setup>` de App.vue ya tiene imports/const de auth, reutilizarlos y sólo agregar los nuevos.**

- [ ] **Step 3: Verificar que el build sigue pasando**

Run:
```bash
cd crm-frontend && npm run build 2>&1 | tail -20
```
Expected: `✓ built in ...` sin errores.

- [ ] **Step 4: Smoke manual local (opcional pero recomendado)**

Levantar dev server y verificar:
1. Login como ASESOR → aparece modal, no se cierra con Escape.
2. Click "Iniciar jornada ahora" → pide permiso GPS → modal cierra al conceder.
3. Cerrar sesión → nuevo login → si NO hay ausencia registrada aparece modal (jornada finalizada NO reabre popup — el estado será 'finalizada' → `requiere_popup=false`).
4. Login como DIRECTOR_COMERCIAL → NO aparece modal.

```bash
cd crm-frontend && npm run dev
```

- [ ] **Step 5: Commit**

```bash
cd crm-frontend && git add src/App.vue && git commit -m "$(cat <<'EOF'
feat(jornada-obligatoria): montar modal bloqueante en App.vue

Chequeo automático al autenticarse y al volver a foreground (visibilitychange).
Reset del store al hacer logout.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Deploy + Checklist de humo

**Files:** ninguno (solo operaciones de despliegue).

**Interfaces:** sistema en producción con SP-4 activo.

- [ ] **Step 1: Confirmar que la migración está en la DB**

El usuario ya ejecutó las migraciones al iniciar el plan. Verificar la existencia de la tabla:

```bash
# En el server (via el mecanismo habitual de acceso a MySQL):
# mysql -u <user> -p <db> -e "DESCRIBE sv_org_jornadas_ausencias;"
```
Expected: descripción de la tabla con los 6 campos.

Si la tabla no existe, correr:
```bash
# En el server (o vía el script deploy-mantix si lo cubre):
mysql -u <user> -p <db> < src/sv/migrations/019_jornadas_ausencias.sql
```

- [ ] **Step 2: Deploy backend**

Correr el script habitual `deploy-mantix` en el server (git pull + pm2 restart).

Expected: pm2 sirve el nuevo bundle con los endpoints `/tracking/jornadas/hoy`, `/tracking/jornadas/ausencia`, `DELETE /tracking/jornadas/ausencia/hoy`.

Verificar con curl (reemplazar `<TOKEN>`):
```bash
curl -sS -H "Authorization: Bearer <TOKEN>" https://mantix-api.losolivoscucuta.com:8444/api/sv/tracking/jornadas/hoy | jq
```
Expected: JSON con `{ok:true, data:{estado, requiere_popup, ...}}`.

- [ ] **Step 3: Build frontend y deploy**

```bash
cd crm-frontend && npm run build && rsync -avz --delete dist/ /Volumes/AppServ/www/genflow/
```
Expected: build exitoso, rsync sin errores.

- [ ] **Step 4: Checklist de humo en producción**

Ejecutar login por rol y validar:

- [ ] Asesor (ej. `jparada@olivos.local`) → aparece modal → click "Iniciar jornada" → tracking activa.
- [ ] Coordinador Previsión → aparece modal → puede iniciar jornada o declarar ausencia.
- [ ] Director Comercial → NO aparece modal, puede navegar libre.
- [ ] Gerente General → NO aparece modal.
- [ ] Super Admin → NO aparece modal.
- [ ] Marcar "no laboro hoy" con motivo "prueba QA" → cierra modal → refrescar página → NO reaparece modal (ausencia respetada).
- [ ] `DELETE /tracking/jornadas/ausencia/hoy` con curl → modal vuelve a aparecer al recargar.
- [ ] Bloqueo real de Escape y click fuera (probar en Chrome + Firefox móvil).

- [ ] **Step 5: Commit del changelog (si existe archivo `CHANGELOG.md`)**

```bash
cd crm-frontend && git log --oneline -10
```
Documentar en el canal de despliegue habitual (o Google Chat) los commits que entraron y el resultado del smoke.

---

## Notas para el implementador

**Sobre `ERROR_CODES.CONFLICT`:** el archivo `constants.js` puede o no tenerlo. Si falta, agregarlo — no romper otras keys existentes; solo insertar una línea nueva dentro del objeto.

**Sobre vitest:** el repo puede o no tener vitest configurado. Si `npx vitest` no responde, el implementador debe crear `vitest.config.js` como se muestra en Task 7 Step 4 y agregar `"test": "vitest"` a `scripts` de `package.json` — NO cambiar la config existente de vite.

**Sobre `Teleport`:** el `<Teleport to="body">` es idempotente, el `document.body.style.overflow = 'hidden'` puede pisar estilos si otro modal lo usa. Confirmar en el smoke que no queda `overflow: hidden` pegado tras cerrar el modal.

**Sobre re-chequeo por día:** el `visibilitychange` fuerza chequeo. Si el usuario deja la app abierta cruzando medianoche, el próximo `visibilitychange` (típicamente en horas hábiles) detectará el cambio de día. No hay temporizador dedicado — YAGNI.

**Sobre orden de commits:** cada task ya se commitea al final. Si se decide juntarlas en un solo commit, mantener el orden Task 1 → 9 para no romper el árbol intermedio.

---

## Self-review

**1. Spec coverage** — Reviso el spec §3 req #8 y §4.1, §5.1, §6.1, §8.1 del spec base:

- ✅ Bloqueante duro (Task 7 — Escape bloqueado, body overflow hidden, sin `close` en el UI).
- ✅ Todos los operativos (Task 3 — `ROLES_NO_OPERATIVOS` con 3 exclusiones).
- ✅ Botón "no laboro hoy" con motivo escrito min 5 (Task 2, 7).
- ✅ Endpoint `/jornadas/hoy` (Task 4).
- ✅ Endpoint `/jornadas/ausencia` con tipo + motivo (Task 4).
- ✅ Migración `sv_org_jornadas_ausencias` (Task 1).
- ✅ Componente en `App.vue` + `visibilitychange` (Task 8).
- ✅ Ausencia respetada durante el día (unique key + estado='ausente').
- ⚠️ Festivo (spec §8.1) — NO implementado. Diferido a un futuro plan (mencionado en spec §13). Justificación: no existe una tabla `sv_org_fechas_especiales` (la existente `sv_crm_fechas_especiales` es por persona). Añadirlo requiere modelo adicional y no es bloqueante para el MVP.
- ⚠️ Chequeo de `usr_horario_laboral` (spec §13 pregunta abierta) — NO implementado. Mismo motivo: se decide en un plan siguiente si se necesita.

**2. Placeholder scan** — sin TBDs, TODOs ni "add appropriate handling". Cada step trae código o comando concreto.

**3. Type consistency:**
- Store: `estado` valores usados en Task 6 test y Task 6 impl y Task 7 modal → coinciden: `sin_chequear|ok|bloqueado|ausente`.
- API: `trackingApi.estadoJornadaHoy`, `registrarAusenciaHoy`, `eliminarAusenciaHoy` — mismo nombre en Task 5, 6, 7, 8.
- Backend: `estadoJornadaHoy`, `registrarAusenciaHoy`, `eliminarAusenciaHoy` — mismo nombre controlador y rutas.
- Service: `estadoHoy`, `registrarAusencia`, `eliminarAusenciaHoy` — controlador los llama exactamente así.

Sin inconsistencias.
