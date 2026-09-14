# SP-1a · Eventos multi-asesor + pool público — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar `sv_org_eventos_agenda` para soportar eventos con múltiples asesores asistentes, rango de fechas flexible (día completo o slots), apoyo opcional de un jefe, link público para captura de leads, y pool de registros no-asignados que se distribuyen manualmente al pipeline de prospectos.

**Architecture:** ALTER a la tabla maestra + 3 tablas nuevas (`asistentes`, `slots`, `pool_registros`). Service extendido con lógica multi-asesor. Endpoints REST autenticados bajo `/api/sv/eventos-agenda/*` + rutas públicas `/api/sv/public/eventos/*` (sin `svAuth`, con rate-limit). El pool crea `SvProspecto` con `prosp_asesor_id=NULL` (reusando el patrón "sin asignar" existente).

**Tech Stack:** Node.js + Express + Sequelize (MySQL 8) · Joi · `express-rate-limit` (ya instalado) · Jest.

**Fuera de scope de este plan:** UI Vue (queda para SP-1b). OTP para edición del dueño (queda para SP-3).

## Global Constraints

- Rutas backend autenticadas bajo `/api/sv/eventos-agenda/*`, ya monta `svAuth + svAreaGuard` en `src/sv/routes/index.js`.
- Rutas públicas bajo `/api/sv/public/eventos/*` — se montan **antes** de `svAuth` en `routes/index.js`.
- Roles jefes con permiso para CRUD/pool/métricas = `ROLES_SUPERVISORES` (7 roles) definido en `src/sv/config/constants.js`.
- Asesor (rol_codigo `ASESOR` o `AGENTE_SVC`) sólo puede crearse eventos para sí mismo y ver los eventos donde figura como asistente.
- Rate limit endpoint público: 10 req/min/IP (`express-rate-limit` v7.5.1 ya en `package.json`).
- Fechas en zona `America/Bogota`; usar `hoyBogotaISO()` de `src/sv/utils/fechas.js` cuando aplique (creado en SP-4).
- Migraciones idempotentes estilo `011_tracking_geo.sql` (SET NAMES + guards `IF NOT EXISTS`).
- Pool → Prospecto: crea `SvProspecto` con `prosp_asesor_id=NULL`, `prosp_fuente_id` = fuente `EVENTO_PUBLICO` del área del evento (la migración inserta esa fuente en cada área activa).
- Attribution `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` en cada commit — EXACTO, NO substituir por nombre del subagente.

---

## File Structure

Todos los paths bajo `mantix-backend/` salvo indicación contraria.

**Nuevo:**
- `src/sv/migrations/020_eventos_multi_asesor.sql`
- `src/sv/models/EventoAsistente.js`
- `src/sv/models/EventoSlot.js`
- `src/sv/models/EventoPoolRegistro.js`
- `src/sv/validations/eventosMulti.validation.js`
- `src/sv/services/eventoPool.service.js`
- `src/sv/services/publicEventos.service.js`
- `src/sv/controllers/publicEventos.controller.js`
- `src/sv/routes/publicEventos.routes.js`
- `tests/eventosMulti.service.test.js`
- `tests/eventoPool.service.test.js`
- `tests/eventosMulti.routes.test.js`
- `tests/publicEventos.routes.test.js`
- `tests/usuariosAccesibles.test.js`

**Modificado:**
- `src/sv/models/EventoAgenda.js` (nuevos campos + asociaciones)
- `src/sv/models/index.js` (registrar 3 modelos nuevos)
- `src/sv/utils/acceso.js` (nueva helper `usuariosAccesibles`)
- `src/sv/services/eventosAgenda.service.js` (extender `crear`, `actualizar`, `getOne`, agregar `resumen`, `actualizarMetricasAsistente`)
- `src/sv/controllers/agenda.controller.js` (nuevos handlers para pool/metricas/resumen)
- `src/sv/routes/agenda.routes.js` (nuevas rutas)
- `src/sv/routes/index.js` (montar `publicEventos.routes` antes de `svAuth`)

---

## Task 1: Migración + modelos + registro

**Files:**
- Create: `mantix-backend/src/sv/migrations/020_eventos_multi_asesor.sql`
- Create: `mantix-backend/src/sv/models/EventoAsistente.js`
- Create: `mantix-backend/src/sv/models/EventoSlot.js`
- Create: `mantix-backend/src/sv/models/EventoPoolRegistro.js`
- Modify: `mantix-backend/src/sv/models/EventoAgenda.js` (nuevos campos + asociaciones)
- Modify: `mantix-backend/src/sv/models/index.js` (registrar 3 nuevos)

**Interfaces:**
- Produces modelos `SvEventoAsistente`, `SvEventoSlot`, `SvEventoPoolRegistro` con las columnas del spec §4.2.
- `SvEventoAgenda` gana campos: `evento_fecha_fin`, `evento_modo_fechas`, `evento_apoyo_usr_id`, `evento_link_hash`, `evento_registros_publicos_habilitado`, `evento_meta_leads`, `evento_grupo_id`, `evento_area_id`.
- Asociaciones nuevas en `SvEventoAgenda`:
  - `hasMany(SvEventoAsistente, {as: 'asistentes', foreignKey: 'eva_evento_id'})`
  - `hasMany(SvEventoSlot,       {as: 'slots',       foreignKey: 'slot_evento_id'})`
  - `hasMany(SvEventoPoolRegistro, {as: 'poolRegistros', foreignKey: 'pool_evento_id'})`
  - `belongsTo(SvUsuario, {as: 'apoyo', foreignKey: 'evento_apoyo_usr_id'})`
  - `belongsTo(SvGrupo,   {as: 'grupo', foreignKey: 'evento_grupo_id'})`
  - `belongsTo(SvArea,    {as: 'area',  foreignKey: 'evento_area_id'})`

- [ ] **Step 1: Crear archivo de migración SQL**

Path: `mantix-backend/src/sv/migrations/020_eventos_multi_asesor.sql`

```sql
-- =====================================================================
-- SerVentas CRM — Migración 020: Eventos multi-asesor + pool público
--
-- Cambios:
-- 1) ALTER sv_org_eventos_agenda (rango fechas, apoyo, link público,
--    meta leads, grupo/area para scope).
-- 2) sv_org_eventos_asistentes  — N:N asesores por evento + métricas.
-- 3) sv_org_eventos_slots       — franjas horarias por día (modo SLOTS).
-- 4) sv_org_eventos_pool_registros — leads del form público antes de asignar.
-- 5) INSERT fuente 'EVENTO_PUBLICO' en cada área activa (para prospectos
--    creados desde el pool al ser asignados a un asesor).
-- =====================================================================

SET NAMES utf8mb4;
SET @OLD_FK_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------
-- 1) ALTER sv_org_eventos_agenda
-- ------------------------------------------------------------------
SET @col_existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'sv_org_eventos_agenda'
                      AND COLUMN_NAME  = 'evento_fecha_fin');
SET @sql = IF(@col_existe = 0,
  'ALTER TABLE sv_org_eventos_agenda
     ADD COLUMN evento_fecha_fin       DATETIME    NULL AFTER evento_fecha_hora,
     ADD COLUMN evento_modo_fechas     VARCHAR(20) NOT NULL DEFAULT ''UNICO''
       COMMENT ''UNICO | DIA_COMPLETO_MULTI | SLOTS'',
     ADD COLUMN evento_apoyo_usr_id    INT         NULL,
     ADD COLUMN evento_link_hash       CHAR(32)    NULL,
     ADD COLUMN evento_registros_publicos_habilitado TINYINT NOT NULL DEFAULT 0,
     ADD COLUMN evento_meta_leads      INT         NULL,
     ADD COLUMN evento_grupo_id        INT         NULL,
     ADD COLUMN evento_area_id         INT         NULL,
     ADD UNIQUE KEY uq_evento_link_hash (evento_link_hash),
     ADD INDEX idx_evento_apoyo (evento_apoyo_usr_id),
     ADD INDEX idx_evento_grupo_fecha (evento_grupo_id, evento_fecha_hora)',
  'SELECT ''evento_fecha_fin ya existe'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------------
-- 2) sv_org_eventos_asistentes
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sv_org_eventos_asistentes (
  eva_id                 INT AUTO_INCREMENT PRIMARY KEY,
  eva_evento_id          INT NOT NULL,
  eva_usr_id             INT NOT NULL,
  eva_estado             VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADO'
    COMMENT 'CONFIRMADO | ASISTIO | NO_ASISTIO | JUSTIFICADO',
  eva_leads_captados     INT NULL,
  eva_prospectos_creados INT NULL,
  eva_ventas_cerradas    INT NULL,
  eva_activo             TINYINT NOT NULL DEFAULT 1,
  eva_created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_eva_evento_usr (eva_evento_id, eva_usr_id),
  INDEX idx_eva_usr (eva_usr_id),
  CONSTRAINT fk_eva_evento FOREIGN KEY (eva_evento_id)
    REFERENCES sv_org_eventos_agenda(evento_id) ON DELETE CASCADE,
  CONSTRAINT fk_eva_usr FOREIGN KEY (eva_usr_id)
    REFERENCES sv_org_usuarios(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'SerVentas: asistentes N:N por evento con métricas de gestión';

-- ------------------------------------------------------------------
-- 3) sv_org_eventos_slots
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sv_org_eventos_slots (
  slot_id          INT AUTO_INCREMENT PRIMARY KEY,
  slot_evento_id   INT NOT NULL,
  slot_fecha       DATE NOT NULL,
  slot_hora_inicio TIME NOT NULL,
  slot_hora_fin    TIME NOT NULL,
  INDEX idx_slot_evento_fecha (slot_evento_id, slot_fecha),
  CONSTRAINT fk_slot_evento FOREIGN KEY (slot_evento_id)
    REFERENCES sv_org_eventos_agenda(evento_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'SerVentas: franjas horarias por día para eventos modo SLOTS';

-- ------------------------------------------------------------------
-- 4) sv_org_eventos_pool_registros
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sv_org_eventos_pool_registros (
  pool_id           INT AUTO_INCREMENT PRIMARY KEY,
  pool_evento_id    INT NOT NULL,
  pool_nombre       VARCHAR(180) NOT NULL,
  pool_telefono     VARCHAR(30)  NOT NULL,
  pool_correo       VARCHAR(180) NULL,
  pool_ip           VARCHAR(45)  NULL,
  pool_user_agent   VARCHAR(255) NULL,
  pool_prosp_id     INT NULL COMMENT 'FK a sv_crm_prospectos cuando se convierte',
  pool_asignado_a   INT NULL,
  pool_asignado_at  DATETIME NULL,
  pool_asignado_por INT NULL,
  pool_created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pool_evento_tel (pool_evento_id, pool_telefono),
  INDEX idx_pool_evento    (pool_evento_id),
  INDEX idx_pool_pendiente (pool_evento_id, pool_prosp_id),
  CONSTRAINT fk_pool_evento FOREIGN KEY (pool_evento_id)
    REFERENCES sv_org_eventos_agenda(evento_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'SerVentas: pool de registros del form público antes de asignar';

-- ------------------------------------------------------------------
-- 5) Fuente 'EVENTO_PUBLICO' por área activa (idempotente)
-- ------------------------------------------------------------------
INSERT IGNORE INTO sv_cfg_fuentes_prospecto (fuente_area_id, fuente_codigo, fuente_nombre, fuente_es_masiva, fuente_activa, fuente_orden)
SELECT area_id, 'EVENTO_PUBLICO', 'Evento (registro público)', 0, 1, 99
  FROM sv_cfg_areas_negocio
 WHERE area_activa = 1;

SET FOREIGN_KEY_CHECKS = @OLD_FK_CHECKS;

-- Verificación
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sv_org_eventos_agenda' AND COLUMN_NAME='evento_fecha_fin') AS altered,
  (SELECT COUNT(*) FROM sv_org_eventos_asistentes)     AS asistentes_count,
  (SELECT COUNT(*) FROM sv_org_eventos_slots)          AS slots_count,
  (SELECT COUNT(*) FROM sv_org_eventos_pool_registros) AS pool_count,
  (SELECT COUNT(*) FROM sv_cfg_fuentes_prospecto WHERE fuente_codigo='EVENTO_PUBLICO') AS fuentes_evento;
```

- [ ] **Step 2: Crear modelo `SvEventoAsistente`**

Path: `mantix-backend/src/sv/models/EventoAsistente.js`

```js
// sv/models/EventoAsistente.js — sv_org_eventos_asistentes (migración 020)
module.exports = (sequelize, DataTypes) => {
  const EventoAsistente = sequelize.define('SvEventoAsistente', {
    eva_id:                 { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    eva_evento_id:          { type: DataTypes.INTEGER, allowNull: false },
    eva_usr_id:             { type: DataTypes.INTEGER, allowNull: false },
    eva_estado:             { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'CONFIRMADO' },
    eva_leads_captados:     { type: DataTypes.INTEGER },
    eva_prospectos_creados: { type: DataTypes.INTEGER },
    eva_ventas_cerradas:    { type: DataTypes.INTEGER },
    eva_activo:             { type: DataTypes.TINYINT, defaultValue: 1 }
  }, {
    tableName: 'sv_org_eventos_asistentes',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'eva_created_at',
    updatedAt: false
  });

  EventoAsistente.associate = (models) => {
    EventoAsistente.belongsTo(models.SvEventoAgenda, { as: 'evento',  foreignKey: 'eva_evento_id' });
    EventoAsistente.belongsTo(models.SvUsuario,      { as: 'usuario', foreignKey: 'eva_usr_id' });
  };
  return EventoAsistente;
};
```

- [ ] **Step 3: Crear modelo `SvEventoSlot`**

Path: `mantix-backend/src/sv/models/EventoSlot.js`

```js
// sv/models/EventoSlot.js — sv_org_eventos_slots (migración 020)
module.exports = (sequelize, DataTypes) => {
  const EventoSlot = sequelize.define('SvEventoSlot', {
    slot_id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    slot_evento_id:   { type: DataTypes.INTEGER, allowNull: false },
    slot_fecha:       { type: DataTypes.DATEONLY, allowNull: false },
    slot_hora_inicio: { type: DataTypes.TIME, allowNull: false },
    slot_hora_fin:    { type: DataTypes.TIME, allowNull: false }
  }, {
    tableName: 'sv_org_eventos_slots',
    freezeTableName: true,
    timestamps: false
  });

  EventoSlot.associate = (models) => {
    EventoSlot.belongsTo(models.SvEventoAgenda, { as: 'evento', foreignKey: 'slot_evento_id' });
  };
  return EventoSlot;
};
```

- [ ] **Step 4: Crear modelo `SvEventoPoolRegistro`**

Path: `mantix-backend/src/sv/models/EventoPoolRegistro.js`

```js
// sv/models/EventoPoolRegistro.js — sv_org_eventos_pool_registros (migración 020)
module.exports = (sequelize, DataTypes) => {
  const EventoPoolRegistro = sequelize.define('SvEventoPoolRegistro', {
    pool_id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    pool_evento_id:    { type: DataTypes.INTEGER, allowNull: false },
    pool_nombre:       { type: DataTypes.STRING(180), allowNull: false },
    pool_telefono:     { type: DataTypes.STRING(30),  allowNull: false },
    pool_correo:       { type: DataTypes.STRING(180) },
    pool_ip:           { type: DataTypes.STRING(45) },
    pool_user_agent:   { type: DataTypes.STRING(255) },
    pool_prosp_id:     { type: DataTypes.INTEGER },
    pool_asignado_a:   { type: DataTypes.INTEGER },
    pool_asignado_at:  { type: DataTypes.DATE },
    pool_asignado_por: { type: DataTypes.INTEGER }
  }, {
    tableName: 'sv_org_eventos_pool_registros',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'pool_created_at',
    updatedAt: false
  });

  EventoPoolRegistro.associate = (models) => {
    EventoPoolRegistro.belongsTo(models.SvEventoAgenda, { as: 'evento',    foreignKey: 'pool_evento_id' });
    EventoPoolRegistro.belongsTo(models.SvProspecto,    { as: 'prospecto', foreignKey: 'pool_prosp_id' });
    EventoPoolRegistro.belongsTo(models.SvUsuario,      { as: 'asignadoA', foreignKey: 'pool_asignado_a' });
    EventoPoolRegistro.belongsTo(models.SvUsuario,      { as: 'asignadoPor', foreignKey: 'pool_asignado_por' });
  };
  return EventoPoolRegistro;
};
```

- [ ] **Step 5: Ampliar `SvEventoAgenda` (nuevos campos + asociaciones)**

Editar `mantix-backend/src/sv/models/EventoAgenda.js`. Reemplazar el `define({...})` para agregar los nuevos campos (después de `evento_completado_at`), y ampliar el bloque `associate` con las nuevas asociaciones.

Contenido completo del archivo tras edición:

```js
// sv/models/EventoAgenda.js — sv_org_eventos_agenda (migración 018 + 020)
// Actividades de calendario del asesor: reuniones, visitas, llamadas, etc.
// Pueden vincularse opcionalmente a un prospecto o empresa.
// Migración 020 añade soporte multi-asesor + rango de fechas + pool público.
module.exports = (sequelize, DataTypes) => {
  const EventoAgenda = sequelize.define('SvEventoAgenda', {
    evento_id:            { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    evento_asesor_id:     { type: DataTypes.INTEGER, allowNull: false },
    evento_creado_por:    { type: DataTypes.INTEGER, allowNull: false },
    evento_titulo:        { type: DataTypes.STRING(180), allowNull: false },
    evento_descripcion:   { type: DataTypes.TEXT },
    evento_tipo:          { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'OTRO' },
    evento_fecha_hora:    { type: DataTypes.DATE, allowNull: false },
    evento_fecha_fin:     { type: DataTypes.DATE },
    evento_modo_fechas:   { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'UNICO' },
    evento_prosp_id:      { type: DataTypes.INTEGER },
    evento_empresa_id:    { type: DataTypes.INTEGER },
    evento_apoyo_usr_id:  { type: DataTypes.INTEGER },
    evento_link_hash:     { type: DataTypes.CHAR(32) },
    evento_registros_publicos_habilitado: { type: DataTypes.TINYINT, defaultValue: 0 },
    evento_meta_leads:    { type: DataTypes.INTEGER },
    evento_grupo_id:      { type: DataTypes.INTEGER },
    evento_area_id:       { type: DataTypes.INTEGER },
    evento_completado:    { type: DataTypes.TINYINT, defaultValue: 0 },
    evento_completado_at: { type: DataTypes.DATE }
  }, {
    tableName: 'sv_org_eventos_agenda',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'evento_created_at',
    updatedAt: 'evento_updated_at'
  });

  EventoAgenda.associate = (models) => {
    EventoAgenda.belongsTo(models.SvUsuario, { as: 'asesor',    foreignKey: 'evento_asesor_id' });
    EventoAgenda.belongsTo(models.SvUsuario, { as: 'creadoPor', foreignKey: 'evento_creado_por' });
    EventoAgenda.belongsTo(models.SvUsuario, { as: 'apoyo',     foreignKey: 'evento_apoyo_usr_id' });
    if (models.SvProspecto) {
      EventoAgenda.belongsTo(models.SvProspecto, { as: 'prospecto', foreignKey: 'evento_prosp_id' });
    }
    if (models.SvEmpresa) {
      EventoAgenda.belongsTo(models.SvEmpresa, { as: 'empresa', foreignKey: 'evento_empresa_id' });
    }
    if (models.SvGrupo) {
      EventoAgenda.belongsTo(models.SvGrupo, { as: 'grupo', foreignKey: 'evento_grupo_id' });
    }
    if (models.SvArea) {
      EventoAgenda.belongsTo(models.SvArea, { as: 'area', foreignKey: 'evento_area_id' });
    }
    if (models.SvEventoAsistente) {
      EventoAgenda.hasMany(models.SvEventoAsistente, { as: 'asistentes', foreignKey: 'eva_evento_id' });
    }
    if (models.SvEventoSlot) {
      EventoAgenda.hasMany(models.SvEventoSlot, { as: 'slots', foreignKey: 'slot_evento_id' });
    }
    if (models.SvEventoPoolRegistro) {
      EventoAgenda.hasMany(models.SvEventoPoolRegistro, { as: 'poolRegistros', foreignKey: 'pool_evento_id' });
    }
  };

  return EventoAgenda;
};
```

- [ ] **Step 6: Registrar los 3 modelos nuevos en `models/index.js`**

Editar `mantix-backend/src/sv/models/index.js`. Encontrar la línea:

```js
  SvEventoAgenda:      require('./EventoAgenda')(sequelize, Sequelize.DataTypes),
```

Insertar inmediatamente **después**:

```js
  SvEventoAsistente:   require('./EventoAsistente')(sequelize, Sequelize.DataTypes),
  SvEventoSlot:        require('./EventoSlot')(sequelize, Sequelize.DataTypes),
  SvEventoPoolRegistro: require('./EventoPoolRegistro')(sequelize, Sequelize.DataTypes),
```

- [ ] **Step 7: Verificar que los modelos cargan sin errores**

Run:
```bash
cd mantix-backend && node -e "const m = require('./src/sv/models'); console.log([typeof m.SvEventoAsistente, typeof m.SvEventoSlot, typeof m.SvEventoPoolRegistro, typeof m.SvEventoAgenda].join(','));"
```
Expected: `function,function,function,function`.

- [ ] **Step 8: Correr la migración contra la DB local (si aplica)**

Si el implementer tiene acceso a la DB de dev, correr la migración:
```bash
mysql -u <user> -p <db> < src/sv/migrations/020_eventos_multi_asesor.sql
```
Expected: el `SELECT` final devuelve `altered=1`, count 0 en las 3 tablas nuevas, y `fuentes_evento > 0`.

Si el implementer NO tiene acceso a la DB, marcar este step como "delegado al usuario en Task 10" y proseguir.

- [ ] **Step 9: Commit**

```bash
cd mantix-backend && git add src/sv/migrations/020_eventos_multi_asesor.sql src/sv/models/EventoAgenda.js src/sv/models/EventoAsistente.js src/sv/models/EventoSlot.js src/sv/models/EventoPoolRegistro.js src/sv/models/index.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): migración 020 + modelos asistentes/slots/pool

Extiende sv_org_eventos_agenda con rango de fechas, apoyo, link
público, meta_leads, grupo_id, area_id.

Nuevas tablas:
- sv_org_eventos_asistentes    (N:N asesores + métricas)
- sv_org_eventos_slots         (franjas horarias por día, modo SLOTS)
- sv_org_eventos_pool_registros (leads del form público antes de asignar)

Inserta fuente EVENTO_PUBLICO por área activa (para prospectos
creados desde el pool al ser asignados).

Base de SP-1a (backend eventos multi-asesor + pool público).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Helper `usuariosAccesibles(actor)`

**Files:**
- Modify: `mantix-backend/src/sv/utils/acceso.js`
- Create: `mantix-backend/tests/usuariosAccesibles.test.js`

**Interfaces:**
- Produces `usuariosAccesibles(actor) → number[]|null` — array de `usr_id` accesibles al actor, o `null` si es SUPER_ADMIN (acceso total).
- Lógica:
  - SUPER_ADMIN → `null` (sin filtro).
  - GERENTE_GENERAL / DIRECTOR_COMERCIAL / ADMIN_AREA → todos los `usr_id` cuyo `usr_area_id` esté en `areaIdsAccesibles(actor)` (multi-área via `usr_area_id` + `areasExtra`).
  - COORDINADOR_PREVISION / JEFE_PAP / SUPERVISOR → todos los `usr_id` cuyo `usr_grupo_id` esté en `grupoIdsAccesibles(actor)` (multi-grupo via `usr_grupo_id` + `gruposExtra`).
  - ASESOR / AGENTE_SVC → `[actor.usr_id]`.
  - Otros / rol desconocido → `[actor.usr_id]` (safe default).

- [ ] **Step 1: Escribir el test primero**

Path: `mantix-backend/tests/usuariosAccesibles.test.js`

```js
const mockUsuario = { findAll: jest.fn() };
jest.mock('../src/sv/models', () => ({ SvUsuario: mockUsuario }));

const { usuariosAccesibles } = require('../src/sv/utils/acceso');

const asesor      = { usr_id: 10, rol: { rol_codigo: 'ASESOR' } };
const agenteSvc   = { usr_id: 11, rol: { rol_codigo: 'AGENTE_SVC' } };
const superAdmin  = { usr_id: 12, rol: { rol_codigo: 'SUPER_ADMIN' } };
const superviso   = {
  usr_id: 20, rol: { rol_codigo: 'SUPERVISOR' },
  usr_grupo_id: 3, gruposExtra: [{ grupo_id: 4 }]
};
const coordinador = {
  usr_id: 21, rol: { rol_codigo: 'COORDINADOR_PREVISION' },
  usr_grupo_id: 5, gruposExtra: []
};
const director    = {
  usr_id: 30, rol: { rol_codigo: 'DIRECTOR_COMERCIAL' },
  usr_area_id: 2, areasExtra: [{ area_id: 3 }, { area_id: 4 }]
};

beforeEach(() => mockUsuario.findAll.mockReset().mockResolvedValue([]));

describe('usuariosAccesibles', () => {
  test('SUPER_ADMIN → null (sin filtro)', async () => {
    const r = await usuariosAccesibles(superAdmin);
    expect(r).toBeNull();
  });

  test('ASESOR → [self]', async () => {
    const r = await usuariosAccesibles(asesor);
    expect(r).toEqual([10]);
  });

  test('AGENTE_SVC → [self]', async () => {
    const r = await usuariosAccesibles(agenteSvc);
    expect(r).toEqual([11]);
  });

  test('SUPERVISOR → usr_ids de todos los grupos accesibles', async () => {
    mockUsuario.findAll.mockResolvedValue([{ usr_id: 100 }, { usr_id: 101 }, { usr_id: 102 }]);
    const r = await usuariosAccesibles(superviso);
    expect(r).toEqual([100, 101, 102]);
    // Verificar que consultó por grupos [3,4]
    const call = mockUsuario.findAll.mock.calls[0][0];
    expect(call.where.usr_grupo_id).toEqual({ [require('sequelize').Op.in]: [3, 4] });
  });

  test('COORDINADOR_PREVISION → usr_ids de su grupo', async () => {
    mockUsuario.findAll.mockResolvedValue([{ usr_id: 200 }, { usr_id: 201 }]);
    const r = await usuariosAccesibles(coordinador);
    expect(r).toEqual([200, 201]);
    const call = mockUsuario.findAll.mock.calls[0][0];
    expect(call.where.usr_grupo_id).toEqual({ [require('sequelize').Op.in]: [5] });
  });

  test('DIRECTOR_COMERCIAL → usr_ids de todas las áreas accesibles', async () => {
    mockUsuario.findAll.mockResolvedValue([{ usr_id: 300 }, { usr_id: 301 }]);
    const r = await usuariosAccesibles(director);
    expect(r).toEqual([300, 301]);
    const call = mockUsuario.findAll.mock.calls[0][0];
    expect(call.where.usr_area_id).toEqual({ [require('sequelize').Op.in]: [2, 3, 4] });
  });

  test('rol desconocido → [self] (safe default)', async () => {
    const r = await usuariosAccesibles({ usr_id: 999, rol: { rol_codigo: 'NEW_ROLE' } });
    expect(r).toEqual([999]);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run:
```bash
cd mantix-backend && npx jest tests/usuariosAccesibles.test.js --no-coverage
```
Expected: FAIL — `usuariosAccesibles is not a function` o similar.

- [ ] **Step 3: Leer `src/sv/utils/acceso.js` actual**

Run:
```bash
cd mantix-backend && cat src/sv/utils/acceso.js
```

Anotar los exports actuales (`grupoIdsAccesibles`, `areaIdsAccesibles`, etc.) para no romperlos.

- [ ] **Step 4: Agregar la nueva helper**

Editar `mantix-backend/src/sv/utils/acceso.js`. Al final del archivo (antes del `module.exports = {...}` final), insertar:

```js
/**
 * Devuelve la lista de usr_id que el actor puede ver o gestionar.
 * Retorna null para SUPER_ADMIN (acceso total, no aplicar filtro).
 * Consulta la DB para expandir grupos/areas a usuarios concretos.
 */
async function usuariosAccesibles(actor) {
  const { Op } = require('sequelize');
  const { SvUsuario } = require('../models');
  const codigo = actor?.rol?.rol_codigo;

  if (codigo === 'SUPER_ADMIN') return null;
  if (codigo === 'ASESOR' || codigo === 'AGENTE_SVC') return [actor.usr_id];

  const rolesArea  = ['GERENTE_GENERAL', 'DIRECTOR_COMERCIAL', 'ADMIN_AREA'];
  const rolesGrupo = ['COORDINADOR_PREVISION', 'JEFE_PAP', 'SUPERVISOR'];

  if (rolesArea.includes(codigo)) {
    const areas = areaIdsAccesibles(actor); // ya devuelve number[] con principal + extras
    if (!areas?.length) return [actor.usr_id];
    const rows = await SvUsuario.findAll({
      where: { usr_area_id: { [Op.in]: areas }, usr_activo: 1 },
      attributes: ['usr_id']
    });
    return rows.map(r => r.usr_id);
  }

  if (rolesGrupo.includes(codigo)) {
    const grupos = grupoIdsAccesibles(actor);
    if (!grupos?.length) return [actor.usr_id];
    const rows = await SvUsuario.findAll({
      where: { usr_grupo_id: { [Op.in]: grupos }, usr_activo: 1 },
      attributes: ['usr_id']
    });
    return rows.map(r => r.usr_id);
  }

  // Rol desconocido: safe default
  return [actor.usr_id];
}
```

Y en el `module.exports = { ... }` al final del archivo, agregar `usuariosAccesibles` a la lista de exports.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run:
```bash
cd mantix-backend && npx jest tests/usuariosAccesibles.test.js --no-coverage
```
Expected: PASS 7/7.

- [ ] **Step 6: Commit**

```bash
cd mantix-backend && git add src/sv/utils/acceso.js tests/usuariosAccesibles.test.js && git commit -m "$(cat <<'EOF'
feat(acceso): helper usuariosAccesibles(actor) para scope multi-asesor

Devuelve los usr_id que el actor puede ver o gestionar según su rol:
- SUPER_ADMIN → null (sin filtro)
- ASESOR/AGENTE_SVC → [self]
- roles de área (GERENTE/DIRECTOR/ADMIN_AREA) → usuarios de todas
  las áreas accesibles (principal + areasExtra)
- roles de grupo (COORDINADOR/JEFE_PAP/SUPERVISOR) → usuarios de
  todos los grupos accesibles (principal + gruposExtra)

Se usa en SP-1a para filtrar dropdown de asistentes y validar scope
del actor al crear eventos multi-asesor.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Validaciones Joi para eventos multi-asesor + registro público + asignación

**Files:**
- Create: `mantix-backend/src/sv/validations/eventosMulti.validation.js`
- Create: `mantix-backend/tests/eventosMulti.validation.test.js`

**Interfaces:**
- Produces schemas: `crearEvento`, `actualizarEvento`, `registroPublico`, `asignarPool`, `actualizarMetricas`.

- [ ] **Step 1: Escribir el test primero**

Path: `mantix-backend/tests/eventosMulti.validation.test.js`

```js
const v = require('../src/sv/validations/eventosMulti.validation');

describe('crearEvento', () => {
  const base = {
    titulo: 'Feria del Norte',
    tipo: 'FERIA',
    modo_fechas: 'UNICO',
    fecha_inicio: '2026-10-20T08:00:00.000Z',
    asistentes_ids: [10, 11]
  };

  test('acepta modo UNICO sin fecha_fin ni slots', () => {
    const { error } = v.crearEvento.validate(base);
    expect(error).toBeUndefined();
  });

  test('acepta modo DIA_COMPLETO_MULTI con fecha_fin', () => {
    const { error } = v.crearEvento.validate({
      ...base, modo_fechas: 'DIA_COMPLETO_MULTI', fecha_fin: '2026-10-22T18:00:00.000Z'
    });
    expect(error).toBeUndefined();
  });

  test('rechaza DIA_COMPLETO_MULTI sin fecha_fin', () => {
    const { error } = v.crearEvento.validate({ ...base, modo_fechas: 'DIA_COMPLETO_MULTI' });
    expect(error).toBeDefined();
  });

  test('acepta modo SLOTS con array de slots', () => {
    const { error } = v.crearEvento.validate({
      ...base, modo_fechas: 'SLOTS',
      slots: [{ fecha: '2026-10-20', hora_inicio: '08:00', hora_fin: '12:00' }]
    });
    expect(error).toBeUndefined();
  });

  test('rechaza SLOTS sin slots o slots vacío', () => {
    const { error: e1 } = v.crearEvento.validate({ ...base, modo_fechas: 'SLOTS' });
    const { error: e2 } = v.crearEvento.validate({ ...base, modo_fechas: 'SLOTS', slots: [] });
    expect(e1).toBeDefined();
    expect(e2).toBeDefined();
  });

  test('rechaza título vacío', () => {
    const { error } = v.crearEvento.validate({ ...base, titulo: '' });
    expect(error).toBeDefined();
  });

  test('rechaza asistentes_ids vacío', () => {
    const { error } = v.crearEvento.validate({ ...base, asistentes_ids: [] });
    expect(error).toBeDefined();
  });

  test('rechaza tipo desconocido', () => {
    const { error } = v.crearEvento.validate({ ...base, tipo: 'BLAH' });
    expect(error).toBeDefined();
  });

  test('acepta apoyo_usr_id opcional', () => {
    const { error } = v.crearEvento.validate({ ...base, apoyo_usr_id: 27 });
    expect(error).toBeUndefined();
  });
});

describe('registroPublico', () => {
  test('acepta nombre + teléfono válidos', () => {
    const { error } = v.registroPublico.validate({
      nombre: 'Juan Pérez', telefono: '+57 300 123 4567'
    });
    expect(error).toBeUndefined();
  });

  test('acepta correo opcional', () => {
    const { error } = v.registroPublico.validate({
      nombre: 'Juan', telefono: '3001234567', correo: 'juan@example.com'
    });
    expect(error).toBeUndefined();
  });

  test('acepta correo .local (jparada@olivos.local)', () => {
    const { error } = v.registroPublico.validate({
      nombre: 'Juan', telefono: '3001234567', correo: 'juan@olivos.local'
    });
    expect(error).toBeUndefined();
  });

  test('rechaza teléfono con letras', () => {
    const { error } = v.registroPublico.validate({
      nombre: 'Juan', telefono: 'abc123'
    });
    expect(error).toBeDefined();
  });

  test('rechaza nombre menor a 2 chars', () => {
    const { error } = v.registroPublico.validate({ nombre: 'J', telefono: '3001234567' });
    expect(error).toBeDefined();
  });
});

describe('asignarPool', () => {
  test('acepta asesor_id positivo', () => {
    const { error } = v.asignarPool.validate({ asesor_id: 15 });
    expect(error).toBeUndefined();
  });

  test('rechaza asesor_id faltante', () => {
    const { error } = v.asignarPool.validate({});
    expect(error).toBeDefined();
  });
});

describe('actualizarMetricas', () => {
  test('acepta estado + números', () => {
    const { error } = v.actualizarMetricas.validate({
      estado: 'ASISTIO', leads_captados: 12, prospectos_creados: 3, ventas_cerradas: 1
    });
    expect(error).toBeUndefined();
  });

  test('acepta payload parcial (solo estado)', () => {
    const { error } = v.actualizarMetricas.validate({ estado: 'JUSTIFICADO' });
    expect(error).toBeUndefined();
  });

  test('rechaza estado desconocido', () => {
    const { error } = v.actualizarMetricas.validate({ estado: 'BLAH' });
    expect(error).toBeDefined();
  });

  test('rechaza números negativos', () => {
    const { error } = v.actualizarMetricas.validate({ leads_captados: -1 });
    expect(error).toBeDefined();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run:
```bash
cd mantix-backend && npx jest tests/eventosMulti.validation.test.js --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Crear el archivo de validación**

Path: `mantix-backend/src/sv/validations/eventosMulti.validation.js`

```js
/**
 * sv/validations/eventosMulti.validation.js
 * Schemas para el CRUD de eventos multi-asesor + pool público (SP-1a).
 */
const Joi = require('joi');

const TIPOS_EVENTO   = ['REUNION', 'VISITA', 'CAPACITACION', 'LLAMADA', 'FERIA', 'PERSONAL', 'OTRO', 'SEGUIMIENTO'];
const MODOS_FECHA    = ['UNICO', 'DIA_COMPLETO_MULTI', 'SLOTS'];
const ESTADOS_ASIS   = ['CONFIRMADO', 'ASISTIO', 'NO_ASISTIO', 'JUSTIFICADO'];

const slot = Joi.object({
  fecha:       Joi.date().iso().required(),
  hora_inicio: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
  hora_fin:    Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required()
});

const crearEvento = Joi.object({
  titulo:      Joi.string().trim().min(2).max(180).required(),
  descripcion: Joi.string().allow('', null).max(2000),
  tipo:        Joi.string().valid(...TIPOS_EVENTO).required(),
  modo_fechas: Joi.string().valid(...MODOS_FECHA).required(),
  fecha_inicio: Joi.date().iso().required(),
  fecha_fin:   Joi.when('modo_fechas', {
    is:  'UNICO',
    then: Joi.date().iso().greater(Joi.ref('fecha_inicio')).optional().allow(null),
    otherwise: Joi.date().iso().greater(Joi.ref('fecha_inicio')).required()
  }),
  slots: Joi.when('modo_fechas', {
    is:  'SLOTS',
    then: Joi.array().items(slot).min(1).required(),
    otherwise: Joi.forbidden()
  }),
  asistentes_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  apoyo_usr_id:   Joi.number().integer().positive().allow(null),
  empresa_id:     Joi.number().integer().positive().allow(null),
  prosp_id:       Joi.number().integer().positive().allow(null),
  registros_publicos_habilitado: Joi.boolean().default(false),
  meta_leads:     Joi.number().integer().min(0).allow(null)
}).prefs({ abortEarly: false });

const actualizarEvento = crearEvento.fork(
  ['titulo', 'tipo', 'modo_fechas', 'fecha_inicio', 'asistentes_ids'],
  (s) => s.optional()
);

const registroPublico = Joi.object({
  nombre:   Joi.string().trim().min(2).max(180).required(),
  telefono: Joi.string().trim().pattern(/^[+]?[\d\s\-()]{7,20}$/).required(),
  correo:   Joi.string().email({ tlds: { allow: false } }).allow('', null).max(180)
}).prefs({ abortEarly: false });

const asignarPool = Joi.object({
  asesor_id: Joi.number().integer().positive().required()
});

const actualizarMetricas = Joi.object({
  estado:             Joi.string().valid(...ESTADOS_ASIS),
  leads_captados:     Joi.number().integer().min(0).allow(null),
  prospectos_creados: Joi.number().integer().min(0).allow(null),
  ventas_cerradas:    Joi.number().integer().min(0).allow(null)
}).min(1).prefs({ abortEarly: false });

module.exports = {
  crearEvento, actualizarEvento, registroPublico, asignarPool, actualizarMetricas,
  TIPOS_EVENTO, MODOS_FECHA, ESTADOS_ASIS
};
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run:
```bash
cd mantix-backend && npx jest tests/eventosMulti.validation.test.js --no-coverage
```
Expected: PASS (20+/20+).

- [ ] **Step 5: Commit**

```bash
cd mantix-backend && git add src/sv/validations/eventosMulti.validation.js tests/eventosMulti.validation.test.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): validaciones Joi (crear/actualizar/pool/métricas)

Schemas para SP-1a:
- crearEvento: modo_fechas condicional (UNICO/DIA_COMPLETO_MULTI/SLOTS),
  fecha_fin requerida si multi-día, slots requeridos si SLOTS,
  asistentes_ids min 1.
- actualizarEvento: variante con campos opcionales (fork del crear).
- registroPublico: nombre 2-180, tel regex, correo opcional con tlds.allow=false
  (permite .local).
- asignarPool: asesor_id requerido.
- actualizarMetricas: al menos 1 campo, estados whitelist, números >= 0.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Service `eventosAgenda` — CRUD multi-asesor + slots + apoyo

**Files:**
- Modify: `mantix-backend/src/sv/services/eventosAgenda.service.js`
- Create: `mantix-backend/tests/eventosMulti.service.test.js`

**Interfaces:**
- Extiende:
  - `crear(payload, actor)`: acepta `asistentes_ids[]`, `apoyo_usr_id`, `modo_fechas`, `fecha_fin`, `slots[]`, `registros_publicos_habilitado`, `meta_leads`, `empresa_id`, `prosp_id`. Genera `evento_link_hash` (crypto.randomBytes 16 hex = 32 chars) si `registros_publicos_habilitado`. Crea filas en `sv_org_eventos_asistentes` y (si SLOTS) `sv_org_eventos_slots`. El `evento_asesor_id` queda igual al primer asistente (dueño creador).
  - `getOne(id, actor)`: include asistentes + slots + poolRegistros count + apoyo + grupo + area.
  - `actualizar(id, payload, actor)`: patch de campos maestros. Si `asistentes_ids` viene, reconcilia (soft-delete los que salen con `eva_activo=0`, agrega los nuevos con estado CONFIRMADO). Si `slots` viene, reemplaza (delete + insert). NO cambia el `link_hash` una vez creado.
- Nuevos exports:
  - `actualizarMetricasAsistente(evaId, payload, actor) → Promise<SvEventoAsistente>`
  - `resumen(eventoId, actor) → Promise<{total_registros, total_asignados, total_pendientes, por_asesor: [...]}>`

- [ ] **Step 1: Escribir el test primero**

Path: `mantix-backend/tests/eventosMulti.service.test.js`

```js
const mockEvento = { create: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), update: jest.fn() };
const mockAsis   = { create: jest.fn(), bulkCreate: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), destroy: jest.fn(), findByPk: jest.fn() };
const mockSlot   = { bulkCreate: jest.fn(), destroy: jest.fn(), findAll: jest.fn() };
const mockPool   = { count: jest.fn(), findAll: jest.fn() };
const mockUsr    = { findByPk: jest.fn(), findAll: jest.fn() };

jest.mock('../src/sv/models', () => ({
  SvEventoAgenda:       mockEvento,
  SvEventoAsistente:    mockAsis,
  SvEventoSlot:         mockSlot,
  SvEventoPoolRegistro: mockPool,
  SvUsuario:            mockUsr,
  SvProspecto:          {},
  SvEmpresa:            {},
  SvGrupo:              {},
  SvArea:               {}
}));

jest.mock('../src/sv/utils/acceso', () => ({
  usuariosAccesibles: jest.fn(),
  grupoIdsAccesibles: jest.fn(),
  areaIdsAccesibles:  jest.fn()
}));

const acceso = require('../src/sv/utils/acceso');
const svc    = require('../src/sv/services/eventosAgenda.service');

const jefe   = { usr_id: 20, rol: { rol_codigo: 'COORDINADOR_PREVISION' } };
const asesor = { usr_id: 10, rol: { rol_codigo: 'ASESOR' } };

beforeEach(() => {
  jest.clearAllMocks();
  acceso.usuariosAccesibles.mockResolvedValue(null); // por default, admin sin filtro
});

describe('crear (multi-asesor)', () => {
  test('jefe crea evento UNICO con 2 asistentes → crea evento + 2 filas asistentes', async () => {
    mockEvento.create.mockResolvedValue({ evento_id: 500 });
    acceso.usuariosAccesibles.mockResolvedValue([10, 11, 12]);
    await svc.crear({
      titulo: 'Feria', tipo: 'FERIA', modo_fechas: 'UNICO',
      fecha_inicio: '2026-10-20T08:00:00Z',
      asistentes_ids: [10, 11]
    }, jefe);
    expect(mockEvento.create).toHaveBeenCalledWith(expect.objectContaining({
      evento_titulo: 'Feria', evento_modo_fechas: 'UNICO'
    }));
    expect(mockAsis.bulkCreate).toHaveBeenCalledWith(
      [{ eva_evento_id: 500, eva_usr_id: 10 }, { eva_evento_id: 500, eva_usr_id: 11 }]
    );
    expect(mockSlot.bulkCreate).not.toHaveBeenCalled();
  });

  test('modo SLOTS también crea slots', async () => {
    mockEvento.create.mockResolvedValue({ evento_id: 501 });
    acceso.usuariosAccesibles.mockResolvedValue([10, 11]);
    await svc.crear({
      titulo: 'Feria', tipo: 'FERIA', modo_fechas: 'SLOTS',
      fecha_inicio: '2026-10-20T08:00:00Z', fecha_fin: '2026-10-22T18:00:00Z',
      slots: [
        { fecha: '2026-10-20', hora_inicio: '08:00', hora_fin: '12:00' },
        { fecha: '2026-10-21', hora_inicio: '14:00', hora_fin: '18:00' }
      ],
      asistentes_ids: [10]
    }, jefe);
    expect(mockSlot.bulkCreate).toHaveBeenCalled();
    expect(mockSlot.bulkCreate.mock.calls[0][0]).toHaveLength(2);
  });

  test('registros_publicos_habilitado → genera evento_link_hash 32 hex', async () => {
    mockEvento.create.mockResolvedValue({ evento_id: 502 });
    acceso.usuariosAccesibles.mockResolvedValue([10]);
    await svc.crear({
      titulo: 'X', tipo: 'FERIA', modo_fechas: 'UNICO',
      fecha_inicio: '2026-10-20T08:00:00Z',
      asistentes_ids: [10],
      registros_publicos_habilitado: true
    }, jefe);
    const payload = mockEvento.create.mock.calls[0][0];
    expect(payload.evento_registros_publicos_habilitado).toBe(1);
    expect(payload.evento_link_hash).toMatch(/^[a-f0-9]{32}$/);
  });

  test('asesor sólo puede agregarse a sí mismo (rechaza asistentes_ids con otros)', async () => {
    acceso.usuariosAccesibles.mockResolvedValue([10]);
    await expect(svc.crear({
      titulo: 'X', tipo: 'REUNION', modo_fechas: 'UNICO',
      fecha_inicio: '2026-10-20T08:00:00Z',
      asistentes_ids: [10, 11]
    }, asesor)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('jefe rechaza asistente fuera de scope', async () => {
    acceso.usuariosAccesibles.mockResolvedValue([10, 11]);
    await expect(svc.crear({
      titulo: 'X', tipo: 'REUNION', modo_fechas: 'UNICO',
      fecha_inicio: '2026-10-20T08:00:00Z',
      asistentes_ids: [10, 999]
    }, jefe)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('actualizarMetricasAsistente', () => {
  test('jefe actualiza métricas de un asistente en su scope', async () => {
    mockAsis.findByPk.mockResolvedValue({
      eva_id: 77, eva_evento_id: 500, eva_usr_id: 10,
      update: jest.fn().mockResolvedValue(true)
    });
    acceso.usuariosAccesibles.mockResolvedValue([10, 11]);
    const r = await svc.actualizarMetricasAsistente(77,
      { estado: 'ASISTIO', leads_captados: 5 }, jefe);
    expect(r.update).toHaveBeenCalledWith({
      eva_estado: 'ASISTIO', eva_leads_captados: 5
    });
  });

  test('asesor sólo puede actualizar sus propias métricas', async () => {
    mockAsis.findByPk.mockResolvedValue({
      eva_id: 77, eva_evento_id: 500, eva_usr_id: 999,
      update: jest.fn()
    });
    await expect(svc.actualizarMetricasAsistente(77, { estado: 'ASISTIO' }, asesor))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('asistente inexistente → NOT_FOUND', async () => {
    mockAsis.findByPk.mockResolvedValue(null);
    await expect(svc.actualizarMetricasAsistente(999, { estado: 'ASISTIO' }, jefe))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('resumen', () => {
  test('devuelve totales del pool + agregado por asistente', async () => {
    mockEvento.findByPk.mockResolvedValue({ evento_id: 500, evento_asesor_id: 10 });
    mockAsis.findAll.mockResolvedValue([
      { eva_usr_id: 10, eva_leads_captados: 8, eva_prospectos_creados: 3, eva_ventas_cerradas: 1,
        usuario: { usr_id: 10, usr_nombre: 'Juan', usr_apellido: 'P' } },
      { eva_usr_id: 11, eva_leads_captados: 4, eva_prospectos_creados: 1, eva_ventas_cerradas: 0,
        usuario: { usr_id: 11, usr_nombre: 'Ana', usr_apellido: 'G' } }
    ]);
    mockPool.count
      .mockResolvedValueOnce(20)   // total_registros
      .mockResolvedValueOnce(12);  // total_asignados
    acceso.usuariosAccesibles.mockResolvedValue([10, 11]);
    const r = await svc.resumen(500, jefe);
    expect(r.total_registros).toBe(20);
    expect(r.total_asignados).toBe(12);
    expect(r.total_pendientes).toBe(8);
    expect(r.por_asesor).toHaveLength(2);
    expect(r.por_asesor[0]).toMatchObject({ usr_id: 10, leads: 8, prospectos: 3, ventas: 1 });
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run:
```bash
cd mantix-backend && npx jest tests/eventosMulti.service.test.js --no-coverage
```
Expected: FAIL — nuevos exports no existen.

- [ ] **Step 3: Extender `eventosAgenda.service.js`**

Leer el archivo actual y agregar/reemplazar las funciones. Contenido completo del archivo tras edición:

```js
/**
 * sv/services/eventosAgenda.service.js
 * Migración 018 — CRUD de eventos personales de agenda.
 * Migración 020 (SP-1a) — soporte multi-asesor + slots + apoyo + pool público.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  SvEventoAgenda, SvEventoAsistente, SvEventoSlot, SvEventoPoolRegistro,
  SvUsuario, SvProspecto, SvEmpresa, SvGrupo, SvArea
} = require('../models');
const { usuariosAccesibles, grupoIdsAccesibles } = require('../utils/acceso');
const { ROLES } = require('../config/constants');

const TIPOS_VALIDOS = new Set(['REUNION','VISITA','CAPACITACION','LLAMADA','FERIA','PERSONAL','OTRO','SEGUIMIENTO']);
const MODOS_VALIDOS = new Set(['UNICO','DIA_COMPLETO_MULTI','SLOTS']);
const ESTADOS_ASIS  = new Set(['CONFIRMADO','ASISTIO','NO_ASISTIO','JUSTIFICADO']);

function esAsesor(actor) {
  const c = actor?.rol?.rol_codigo;
  return c === ROLES.ASESOR || c === ROLES.AGENTE_SVC;
}

function err(msg, code) { const e = new Error(msg); e.code = code; return e; }

async function validarAsistentesEnScope(actor, asistentesIds) {
  const scope = await usuariosAccesibles(actor);
  if (scope === null) return; // SUPER_ADMIN sin filtro
  const fuera = asistentesIds.filter(id => !scope.includes(id));
  if (fuera.length) throw err(`Asistente(s) fuera de tu alcance: ${fuera.join(',')}`, 'FORBIDDEN');
}

async function validarAccesoEvento(eventoId, actor) {
  const ev = await SvEventoAgenda.findByPk(eventoId);
  if (!ev) throw err('Evento no encontrado', 'NOT_FOUND');
  if (esAsesor(actor)) {
    // asesor puede ver evento donde figure como asistente activo o sea el dueño
    if (ev.evento_asesor_id === actor.usr_id) return ev;
    const asis = await SvEventoAsistente.findOne({
      where: { eva_evento_id: eventoId, eva_usr_id: actor.usr_id, eva_activo: 1 }
    });
    if (!asis) throw err('Evento fuera de tu alcance', 'FORBIDDEN');
    return ev;
  }
  const grupos = grupoIdsAccesibles(actor);
  if (grupos !== null) {
    const target = await SvUsuario.findByPk(ev.evento_asesor_id, { attributes: ['usr_grupo_id'] });
    if (!target || !grupos.includes(target.usr_grupo_id)) {
      throw err('Evento fuera de tu grupo', 'FORBIDDEN');
    }
  }
  return ev;
}

async function crear(payload, actor) {
  const titulo = String(payload.titulo || '').trim();
  if (!titulo) throw err('Título requerido', 'VALIDATION_ERROR');
  const tipo = String(payload.tipo || 'OTRO').toUpperCase();
  if (!TIPOS_VALIDOS.has(tipo)) throw err(`Tipo inválido: ${tipo}`, 'VALIDATION_ERROR');
  const modo = String(payload.modo_fechas || 'UNICO').toUpperCase();
  if (!MODOS_VALIDOS.has(modo)) throw err(`modo_fechas inválido: ${modo}`, 'VALIDATION_ERROR');
  if (!payload.fecha_inicio) throw err('fecha_inicio requerida', 'VALIDATION_ERROR');

  const asistentesIds = Array.from(new Set((payload.asistentes_ids || []).map(n => parseInt(n)).filter(Boolean)));
  if (!asistentesIds.length) throw err('asistentes_ids requerido', 'VALIDATION_ERROR');

  // Asesor solo puede agregarse a sí mismo
  if (esAsesor(actor)) {
    if (asistentesIds.length !== 1 || asistentesIds[0] !== actor.usr_id) {
      throw err('Como asesor sólo puedes crear eventos para ti mismo', 'FORBIDDEN');
    }
  } else {
    await validarAsistentesEnScope(actor, asistentesIds);
    if (payload.apoyo_usr_id) {
      await validarAsistentesEnScope(actor, [parseInt(payload.apoyo_usr_id)]);
    }
  }

  // Cargar area/grupo del primer asistente para poblar los campos de scope
  const primerAsis = await SvUsuario.findByPk(asistentesIds[0], { attributes: ['usr_area_id', 'usr_grupo_id'] });

  const linkHash = payload.registros_publicos_habilitado
    ? crypto.randomBytes(16).toString('hex')
    : null;

  const evento = await SvEventoAgenda.create({
    evento_asesor_id:   asistentesIds[0],   // dueño = primer asistente
    evento_creado_por:  actor.usr_id,
    evento_titulo:      titulo,
    evento_descripcion: payload.descripcion || null,
    evento_tipo:        tipo,
    evento_fecha_hora:  payload.fecha_inicio,
    evento_fecha_fin:   payload.fecha_fin || null,
    evento_modo_fechas: modo,
    evento_prosp_id:    payload.prosp_id ? parseInt(payload.prosp_id) : null,
    evento_empresa_id:  payload.empresa_id ? parseInt(payload.empresa_id) : null,
    evento_apoyo_usr_id: payload.apoyo_usr_id ? parseInt(payload.apoyo_usr_id) : null,
    evento_link_hash:   linkHash,
    evento_registros_publicos_habilitado: payload.registros_publicos_habilitado ? 1 : 0,
    evento_meta_leads:  payload.meta_leads ? parseInt(payload.meta_leads) : null,
    evento_grupo_id:    primerAsis?.usr_grupo_id || null,
    evento_area_id:     primerAsis?.usr_area_id || null,
    evento_completado:  0
  });

  await SvEventoAsistente.bulkCreate(
    asistentesIds.map(id => ({ eva_evento_id: evento.evento_id, eva_usr_id: id }))
  );

  if (modo === 'SLOTS' && Array.isArray(payload.slots) && payload.slots.length) {
    await SvEventoSlot.bulkCreate(
      payload.slots.map(s => ({
        slot_evento_id:   evento.evento_id,
        slot_fecha:       s.fecha,
        slot_hora_inicio: s.hora_inicio,
        slot_hora_fin:    s.hora_fin
      }))
    );
  }

  return evento;
}

async function actualizar(id, payload, actor) {
  const ev = await validarAccesoEvento(id, actor);
  // Sólo jefes pueden actualizar; el dueño usará OTP (SP-3)
  if (esAsesor(actor)) throw err('El asesor edita su evento vía OTP (SP-3)', 'FORBIDDEN');

  const patch = {};
  if (payload.titulo !== undefined)      patch.evento_titulo = String(payload.titulo).trim();
  if (payload.descripcion !== undefined) patch.evento_descripcion = payload.descripcion || null;
  if (payload.tipo !== undefined) {
    const t = String(payload.tipo).toUpperCase();
    if (!TIPOS_VALIDOS.has(t)) throw err(`Tipo inválido: ${t}`, 'VALIDATION_ERROR');
    patch.evento_tipo = t;
  }
  if (payload.modo_fechas !== undefined) {
    const m = String(payload.modo_fechas).toUpperCase();
    if (!MODOS_VALIDOS.has(m)) throw err(`modo_fechas inválido: ${m}`, 'VALIDATION_ERROR');
    patch.evento_modo_fechas = m;
  }
  if (payload.fecha_inicio !== undefined) patch.evento_fecha_hora = payload.fecha_inicio;
  if (payload.fecha_fin !== undefined)    patch.evento_fecha_fin = payload.fecha_fin || null;
  if (payload.apoyo_usr_id !== undefined) {
    if (payload.apoyo_usr_id) await validarAsistentesEnScope(actor, [parseInt(payload.apoyo_usr_id)]);
    patch.evento_apoyo_usr_id = payload.apoyo_usr_id ? parseInt(payload.apoyo_usr_id) : null;
  }
  if (payload.meta_leads !== undefined) patch.evento_meta_leads = payload.meta_leads ? parseInt(payload.meta_leads) : null;
  if (payload.registros_publicos_habilitado !== undefined) {
    patch.evento_registros_publicos_habilitado = payload.registros_publicos_habilitado ? 1 : 0;
    // Si se habilita por primera vez y no había hash, generarlo
    if (payload.registros_publicos_habilitado && !ev.evento_link_hash) {
      patch.evento_link_hash = crypto.randomBytes(16).toString('hex');
    }
  }

  await ev.update(patch);

  // Reconciliar asistentes si vinieron
  if (Array.isArray(payload.asistentes_ids)) {
    const nuevos = Array.from(new Set(payload.asistentes_ids.map(n => parseInt(n)).filter(Boolean)));
    if (!nuevos.length) throw err('asistentes_ids no puede quedar vacío', 'VALIDATION_ERROR');
    await validarAsistentesEnScope(actor, nuevos);
    const actuales = await SvEventoAsistente.findAll({
      where: { eva_evento_id: id, eva_activo: 1 }
    });
    const actualesIds = actuales.map(a => a.eva_usr_id);
    const salen = actualesIds.filter(x => !nuevos.includes(x));
    const entran = nuevos.filter(x => !actualesIds.includes(x));
    if (salen.length) {
      await SvEventoAsistente.update({ eva_activo: 0 },
        { where: { eva_evento_id: id, eva_usr_id: { [Op.in]: salen } } });
    }
    if (entran.length) {
      await SvEventoAsistente.bulkCreate(
        entran.map(uid => ({ eva_evento_id: id, eva_usr_id: uid })),
        { ignoreDuplicates: true }
      );
      // Reactivar los que estaban con eva_activo=0
      await SvEventoAsistente.update({ eva_activo: 1 },
        { where: { eva_evento_id: id, eva_usr_id: { [Op.in]: entran } } });
    }
  }

  // Reemplazar slots si vinieron
  if (Array.isArray(payload.slots)) {
    await SvEventoSlot.destroy({ where: { slot_evento_id: id } });
    if (payload.slots.length) {
      await SvEventoSlot.bulkCreate(payload.slots.map(s => ({
        slot_evento_id:   id,
        slot_fecha:       s.fecha,
        slot_hora_inicio: s.hora_inicio,
        slot_hora_fin:    s.hora_fin
      })));
    }
  }

  return ev;
}

async function marcarCompletado(id, completado, actor) {
  const ev = await validarAccesoEvento(id, actor);
  await ev.update({
    evento_completado:    completado ? 1 : 0,
    evento_completado_at: completado ? new Date() : null
  });
  if (completado && ev.evento_tipo === 'SEGUIMIENTO' && ev.evento_empresa_id) {
    try {
      const seg = require('./seguimientosEmpresa.service');
      await seg.programarSiguiente(ev);
    } catch (e) { /* log silencioso */ }
  }
  return ev;
}

async function eliminar(id, actor) {
  await validarAccesoEvento(id, actor);
  if (esAsesor(actor)) throw err('Sólo jefes pueden eliminar eventos', 'FORBIDDEN');
  await SvEventoAgenda.destroy({ where: { evento_id: id } });
  return true;
}

async function getOne(id, actor) {
  const ev = await validarAccesoEvento(id, actor);
  const [poolTotal, poolPendientes] = await Promise.all([
    SvEventoPoolRegistro.count({ where: { pool_evento_id: id } }),
    SvEventoPoolRegistro.count({ where: { pool_evento_id: id, pool_prosp_id: null } })
  ]);
  const full = await SvEventoAgenda.findByPk(ev.evento_id, {
    include: [
      { model: SvUsuario, as: 'asesor',    attributes: ['usr_id','usr_nombre','usr_apellido'] },
      { model: SvUsuario, as: 'creadoPor', attributes: ['usr_id','usr_nombre','usr_apellido'] },
      { model: SvUsuario, as: 'apoyo',     attributes: ['usr_id','usr_nombre','usr_apellido'], required: false },
      { model: SvEventoAsistente, as: 'asistentes', where: { eva_activo: 1 }, required: false,
        include: [{ model: SvUsuario, as: 'usuario', attributes: ['usr_id','usr_nombre','usr_apellido'] }] },
      { model: SvEventoSlot, as: 'slots', required: false },
      { model: SvProspecto,  as: 'prospecto', required: false },
      { model: SvEmpresa,    as: 'empresa',   required: false },
      { model: SvGrupo,      as: 'grupo',     required: false },
      { model: SvArea,       as: 'area',      required: false }
    ]
  });
  return { ...full.toJSON(), pool_total: poolTotal, pool_pendientes: poolPendientes };
}

async function actualizarMetricasAsistente(evaId, payload, actor) {
  const asis = await SvEventoAsistente.findByPk(evaId);
  if (!asis) throw err('Asistente no encontrado', 'NOT_FOUND');
  // Asesor sólo puede tocar sus propias métricas
  if (esAsesor(actor) && asis.eva_usr_id !== actor.usr_id) {
    throw err('Fuera de tu alcance', 'FORBIDDEN');
  }
  if (!esAsesor(actor)) {
    const scope = await usuariosAccesibles(actor);
    if (scope !== null && !scope.includes(asis.eva_usr_id)) {
      throw err('Asistente fuera de tu alcance', 'FORBIDDEN');
    }
  }
  const patch = {};
  if (payload.estado !== undefined) {
    if (!ESTADOS_ASIS.has(payload.estado)) throw err(`estado inválido: ${payload.estado}`, 'VALIDATION_ERROR');
    patch.eva_estado = payload.estado;
  }
  if (payload.leads_captados !== undefined)     patch.eva_leads_captados     = payload.leads_captados;
  if (payload.prospectos_creados !== undefined) patch.eva_prospectos_creados = payload.prospectos_creados;
  if (payload.ventas_cerradas !== undefined)    patch.eva_ventas_cerradas    = payload.ventas_cerradas;
  await asis.update(patch);
  return asis;
}

async function resumen(eventoId, actor) {
  await validarAccesoEvento(eventoId, actor);
  const [totalReg, asignados, asistentes] = await Promise.all([
    SvEventoPoolRegistro.count({ where: { pool_evento_id: eventoId } }),
    SvEventoPoolRegistro.count({ where: { pool_evento_id: eventoId, pool_prosp_id: { [Op.not]: null } } }),
    SvEventoAsistente.findAll({
      where: { eva_evento_id: eventoId, eva_activo: 1 },
      include: [{ model: SvUsuario, as: 'usuario', attributes: ['usr_id','usr_nombre','usr_apellido'] }]
    })
  ]);
  return {
    total_registros:  totalReg,
    total_asignados:  asignados,
    total_pendientes: totalReg - asignados,
    por_asesor: asistentes.map(a => ({
      usr_id:     a.eva_usr_id,
      nombre:     `${a.usuario?.usr_nombre || ''} ${a.usuario?.usr_apellido || ''}`.trim(),
      estado:     a.eva_estado,
      leads:      a.eva_leads_captados     || 0,
      prospectos: a.eva_prospectos_creados || 0,
      ventas:     a.eva_ventas_cerradas    || 0
    }))
  };
}

module.exports = {
  crear, actualizar, marcarCompletado, eliminar, getOne,
  actualizarMetricasAsistente, resumen,
  TIPOS_VALIDOS
};
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run:
```bash
cd mantix-backend && npx jest tests/eventosMulti.service.test.js --no-coverage
```
Expected: PASS. Iterar si algo falla — no cambiar los tests.

- [ ] **Step 5: Correr la suite completa (asegurar no romper tests previos)**

Run:
```bash
cd mantix-backend && npx jest --no-coverage 2>&1 | tail -15
```
Expected: mismo número de failures pre-existentes (2), sin nuevos regresos.

- [ ] **Step 6: Commit**

```bash
cd mantix-backend && git add src/sv/services/eventosAgenda.service.js tests/eventosMulti.service.test.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): service crear/actualizar/getOne/metricas/resumen

- crear: multi-asesor + slots + apoyo + link_hash (crypto 16 bytes hex).
  Scope: asesor solo puede agregarse a sí mismo; jefes solo asistentes
  dentro de usuariosAccesibles(actor).
- actualizar: reconcilia asistentes (soft-delete los que salen,
  bulkCreate + reactivar los que entran); reemplaza slots.
- getOne: include asistentes + slots + apoyo + grupo + area
  + pool_total/pool_pendientes.
- actualizarMetricasAsistente: asesor solo su propia fila; jefe
  requiere asistente en su scope.
- resumen: totales pool + agregado por asesor (leads/prospectos/ventas).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Service `eventoPool` — listar + asignar

**Files:**
- Create: `mantix-backend/src/sv/services/eventoPool.service.js`
- Create: `mantix-backend/tests/eventoPool.service.test.js`

**Interfaces:**
- Produces:
  - `listar(eventoId, {asignado}, actor) → Promise<SvEventoPoolRegistro[]>` — filtro opcional por `asignado=true|false`. Scope validado por `eventosAgenda.validarAccesoEvento`.
  - `asignar(eventoId, poolId, {asesor_id}, actor) → Promise<{pool, prospecto}>` — verifica que `asesor_id` es asistente activo del evento; crea `SvProspecto` con `prosp_asesor_id=asesor_id`, fuente EVENTO_PUBLICO del área del evento, y `SvPersona` desde el pool row; actualiza `pool_prosp_id`, `pool_asignado_a/at/por`.

- [ ] **Step 1: Escribir el test primero**

Path: `mantix-backend/tests/eventoPool.service.test.js`

```js
const mockPool     = { findAll: jest.fn(), findByPk: jest.fn(), update: jest.fn() };
const mockEvento   = { findByPk: jest.fn() };
const mockAsis     = { findOne: jest.fn() };
const mockPersona  = { create: jest.fn(), findOne: jest.fn() };
const mockProsp    = { create: jest.fn() };
const mockFuente   = { findOne: jest.fn() };
const mockEstado   = { findOne: jest.fn() };
const mockUsr      = { findByPk: jest.fn() };

jest.mock('../src/sv/models', () => ({
  SvEventoPoolRegistro: mockPool,
  SvEventoAgenda:       mockEvento,
  SvEventoAsistente:    mockAsis,
  SvPersona:            mockPersona,
  SvProspecto:          mockProsp,
  SvFuente:             mockFuente,
  SvEstado:             mockEstado,
  SvUsuario:            mockUsr
}));

jest.mock('../src/sv/services/eventosAgenda.service', () => ({
  validarAccesoEvento: undefined // no exportada; se skippea en este test
}));

const svc = require('../src/sv/services/eventoPool.service');

const jefe = { usr_id: 20, rol: { rol_codigo: 'COORDINADOR_PREVISION' } };

beforeEach(() => jest.clearAllMocks());

describe('listar', () => {
  test('sin filtro devuelve todos', async () => {
    mockEvento.findByPk.mockResolvedValue({ evento_id: 500 });
    mockPool.findAll.mockResolvedValue([{ pool_id: 1 }, { pool_id: 2 }]);
    const r = await svc.listar(500, {}, jefe);
    expect(r).toHaveLength(2);
    expect(mockPool.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { pool_evento_id: 500 }
    }));
  });

  test('asignado=false filtra pool_prosp_id IS NULL', async () => {
    mockEvento.findByPk.mockResolvedValue({ evento_id: 500 });
    mockPool.findAll.mockResolvedValue([]);
    await svc.listar(500, { asignado: false }, jefe);
    const w = mockPool.findAll.mock.calls[0][0].where;
    expect(w.pool_prosp_id).toBeNull();
  });
});

describe('asignar', () => {
  test('happy path: crea persona + prospecto + actualiza pool', async () => {
    mockEvento.findByPk.mockResolvedValue({
      evento_id: 500, evento_area_id: 4, evento_grupo_id: 3
    });
    mockPool.findByPk.mockResolvedValue({
      pool_id: 7, pool_evento_id: 500, pool_nombre: 'Ana', pool_telefono: '3001111', pool_correo: null,
      pool_prosp_id: null,
      update: jest.fn().mockResolvedValue(true)
    });
    mockAsis.findOne.mockResolvedValue({ eva_id: 1, eva_usr_id: 15, eva_activo: 1 });
    mockUsr.findByPk.mockResolvedValue({ usr_id: 15, usr_activo: 1 });
    mockFuente.findOne.mockResolvedValue({ fuente_id: 99 });
    mockEstado.findOne.mockResolvedValue({ estado_id: 1 });
    mockPersona.findOne.mockResolvedValue(null);
    mockPersona.create.mockResolvedValue({ persona_id: 700 });
    mockProsp.create.mockResolvedValue({ prosp_id: 900 });

    const r = await svc.asignar(500, 7, { asesor_id: 15 }, jefe);

    expect(mockPersona.create).toHaveBeenCalled();
    expect(mockProsp.create).toHaveBeenCalledWith(expect.objectContaining({
      prosp_asesor_id: 15, prosp_fuente_id: 99, prosp_area_id: 4, prosp_grupo_id: 3
    }));
    expect(r.pool.update).toHaveBeenCalledWith(expect.objectContaining({
      pool_prosp_id: 900, pool_asignado_a: 15, pool_asignado_por: 20
    }));
    expect(r.prospecto.prosp_id).toBe(900);
  });

  test('rechaza si el pool ya fue asignado', async () => {
    mockEvento.findByPk.mockResolvedValue({ evento_id: 500 });
    mockPool.findByPk.mockResolvedValue({ pool_id: 7, pool_prosp_id: 900 });
    await expect(svc.asignar(500, 7, { asesor_id: 15 }, jefe))
      .rejects.toMatchObject({ code: 'YA_ASIGNADO' });
  });

  test('rechaza si el asesor destino no es asistente activo', async () => {
    mockEvento.findByPk.mockResolvedValue({ evento_id: 500 });
    mockPool.findByPk.mockResolvedValue({ pool_id: 7, pool_prosp_id: null, pool_evento_id: 500 });
    mockAsis.findOne.mockResolvedValue(null); // no es asistente
    await expect(svc.asignar(500, 7, { asesor_id: 999 }, jefe))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run:
```bash
cd mantix-backend && npx jest tests/eventoPool.service.test.js --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Crear el service**

Path: `mantix-backend/src/sv/services/eventoPool.service.js`

```js
/**
 * sv/services/eventoPool.service.js
 * Pool de registros públicos de eventos → convertidos a prospectos al asignar.
 */
const {
  SvEventoPoolRegistro, SvEventoAgenda, SvEventoAsistente,
  SvPersona, SvProspecto, SvFuente, SvEstado, SvUsuario
} = require('../models');

function err(msg, code) { const e = new Error(msg); e.code = code; return e; }

async function listar(eventoId, filtros, _actor) {
  const evento = await SvEventoAgenda.findByPk(eventoId);
  if (!evento) throw err('Evento no encontrado', 'NOT_FOUND');
  const where = { pool_evento_id: parseInt(eventoId) };
  if (filtros.asignado === false || filtros.asignado === 'false' || filtros.asignado === 0 || filtros.asignado === '0') {
    where.pool_prosp_id = null;
  } else if (filtros.asignado === true || filtros.asignado === 'true' || filtros.asignado === 1 || filtros.asignado === '1') {
    const { Op } = require('sequelize');
    where.pool_prosp_id = { [Op.not]: null };
  }
  return SvEventoPoolRegistro.findAll({
    where,
    order: [['pool_created_at', 'ASC']],
    include: [{ model: SvUsuario, as: 'asignadoA', attributes: ['usr_id','usr_nombre','usr_apellido'], required: false }]
  });
}

async function asignar(eventoId, poolId, payload, actor) {
  const evento = await SvEventoAgenda.findByPk(eventoId);
  if (!evento) throw err('Evento no encontrado', 'NOT_FOUND');

  const pool = await SvEventoPoolRegistro.findByPk(poolId);
  if (!pool || pool.pool_evento_id !== evento.evento_id) throw err('Registro no encontrado', 'NOT_FOUND');
  if (pool.pool_prosp_id) throw err('Registro ya asignado', 'YA_ASIGNADO');

  const asesorId = parseInt(payload.asesor_id);
  if (!asesorId) throw err('asesor_id requerido', 'VALIDATION_ERROR');

  // El destino debe ser asistente activo del evento
  const asis = await SvEventoAsistente.findOne({
    where: { eva_evento_id: evento.evento_id, eva_usr_id: asesorId, eva_activo: 1 }
  });
  if (!asis) throw err('El asesor destino no es asistente activo de este evento', 'VALIDATION_ERROR');

  const destino = await SvUsuario.findByPk(asesorId);
  if (!destino || !destino.usr_activo) throw err('Asesor destino inválido o inactivo', 'VALIDATION_ERROR');

  // Fuente EVENTO_PUBLICO del área del evento (creada por la migración 020)
  const fuente = await SvFuente.findOne({
    where: { fuente_area_id: evento.evento_area_id, fuente_codigo: 'EVENTO_PUBLICO' }
  });

  // Estado inicial del prospecto: buscar el primer estado del área (rol_orden asc)
  const estado = await SvEstado.findOne({
    where: { estado_area_id: evento.evento_area_id },
    order: [['estado_orden', 'ASC']]
  });
  if (!estado) throw err('No hay estado inicial configurado para el área del evento', 'VALIDATION_ERROR');

  // Persona: reutilizar si ya existe por teléfono, si no crear
  let persona = await SvPersona.findOne({ where: { persona_telefono: pool.pool_telefono } });
  if (!persona) {
    const nombreParts = pool.pool_nombre.trim().split(/\s+/);
    const persona_nombre  = nombreParts[0] || pool.pool_nombre.trim();
    const persona_apellido = nombreParts.slice(1).join(' ') || null;
    persona = await SvPersona.create({
      persona_nombre,
      persona_apellido,
      persona_telefono: pool.pool_telefono,
      persona_correo:   pool.pool_correo || null
    });
  }

  const prospecto = await SvProspecto.create({
    prosp_area_id:   evento.evento_area_id,
    prosp_grupo_id:  evento.evento_grupo_id,
    prosp_persona_id: persona.persona_id,
    prosp_asesor_id: asesorId,
    prosp_estado_id: estado.estado_id,
    prosp_fuente_id: fuente?.fuente_id || null,
    prosp_activo:    1,
    prosp_nota_inicial: `Auto-creado desde pool del evento ${evento.evento_id}`
  });

  await pool.update({
    pool_prosp_id:     prospecto.prosp_id,
    pool_asignado_a:   asesorId,
    pool_asignado_at:  new Date(),
    pool_asignado_por: actor.usr_id
  });

  return { pool, prospecto };
}

module.exports = { listar, asignar };
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run:
```bash
cd mantix-backend && npx jest tests/eventoPool.service.test.js --no-coverage
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd mantix-backend && git add src/sv/services/eventoPool.service.js tests/eventoPool.service.test.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): service eventoPool listar/asignar → crea prospecto

Al asignar un registro del pool a un asesor asistente:
- valida que el asesor destino es asistente activo del evento
- reutiliza SvPersona por teléfono si ya existe, si no la crea
- crea SvProspecto con prosp_area/grupo/asesor_id, fuente EVENTO_PUBLICO
  y el primer estado configurado del área
- marca pool_prosp_id + pool_asignado_a/at/por para trazabilidad

Errores: NOT_FOUND (evento/pool), YA_ASIGNADO (idempotencia),
VALIDATION_ERROR (asesor no asistente / inactivo).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Controller + rutas autenticadas (CRUD eventos + pool + métricas + resumen)

**Files:**
- Modify: `mantix-backend/src/sv/controllers/agenda.controller.js`
- Modify: `mantix-backend/src/sv/routes/agenda.routes.js`
- Create: `mantix-backend/tests/eventosMulti.routes.test.js`

**Interfaces:**
- Nuevos endpoints (todos bajo `svAuth + svAreaGuard`):
  - `PUT   /api/sv/eventos-agenda/:id`
  - `GET   /api/sv/eventos-agenda/:id/pool` (?asignado=0|1)
  - `POST  /api/sv/eventos-agenda/:id/pool/:pool_id/asignar`
  - `PATCH /api/sv/eventos-agenda/asistentes/:eva_id/metricas`
  - `GET   /api/sv/eventos-agenda/:id/resumen`
- Modifica handler existente `crearEvento` en el controller para aceptar el payload extendido (la validación Joi la hace `validate`).

- [ ] **Step 1: Escribir tests de integración**

Path: `mantix-backend/tests/eventosMulti.routes.test.js`

```js
const express = require('express');
const request = require('supertest');

jest.mock('../src/sv/services/eventosAgenda.service', () => ({
  crear:                       jest.fn(),
  actualizar:                  jest.fn(),
  actualizarMetricasAsistente: jest.fn(),
  resumen:                     jest.fn(),
  eliminar:                    jest.fn(),
  getOne:                      jest.fn(),
  marcarCompletado:            jest.fn()
}));
jest.mock('../src/sv/services/eventoPool.service', () => ({
  listar: jest.fn(),
  asignar: jest.fn()
}));
jest.mock('../src/sv/services/agenda.service', () => ({}));
jest.mock('../src/sv/models', () => ({}));

const svEv   = require('../src/sv/services/eventosAgenda.service');
const svPool = require('../src/sv/services/eventoPool.service');
const routes = require('../src/sv/routes/agenda.routes');

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = user; req.scope = {}; next(); });
  app.use('/api/sv', routes);
  return app;
}

const jefe = { usr_id: 20, rol: { rol_codigo: 'COORDINADOR_PREVISION' } };

describe('PUT /eventos-agenda/:id', () => {
  test('200 con payload válido', async () => {
    svEv.actualizar.mockResolvedValue({ evento_id: 500 });
    const r = await request(buildApp(jefe))
      .put('/api/sv/eventos-agenda/500')
      .send({ titulo: 'Nuevo título' });
    expect(r.status).toBe(200);
    expect(svEv.actualizar).toHaveBeenCalledWith(500,
      expect.objectContaining({ titulo: 'Nuevo título' }), jefe);
  });
});

describe('GET /eventos-agenda/:id/pool', () => {
  test('200 devuelve lista', async () => {
    svPool.listar.mockResolvedValue([{ pool_id: 1 }, { pool_id: 2 }]);
    const r = await request(buildApp(jefe)).get('/api/sv/eventos-agenda/500/pool');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(2);
  });

  test('propaga ?asignado=0', async () => {
    svPool.listar.mockResolvedValue([]);
    await request(buildApp(jefe)).get('/api/sv/eventos-agenda/500/pool?asignado=0');
    expect(svPool.listar).toHaveBeenCalledWith(500, expect.objectContaining({ asignado: '0' }), jefe);
  });
});

describe('POST /eventos-agenda/:id/pool/:pool_id/asignar', () => {
  test('200 al asignar', async () => {
    svPool.asignar.mockResolvedValue({ pool: { pool_id: 7 }, prospecto: { prosp_id: 900 } });
    const r = await request(buildApp(jefe))
      .post('/api/sv/eventos-agenda/500/pool/7/asignar')
      .send({ asesor_id: 15 });
    expect(r.status).toBe(200);
    expect(r.body.data.prospecto.prosp_id).toBe(900);
  });

  test('422 con asesor_id faltante', async () => {
    const r = await request(buildApp(jefe))
      .post('/api/sv/eventos-agenda/500/pool/7/asignar').send({});
    expect(r.status).toBe(422);
  });

  test('409 si YA_ASIGNADO', async () => {
    svPool.asignar.mockRejectedValue(Object.assign(new Error('ya'), { code: 'YA_ASIGNADO' }));
    const r = await request(buildApp(jefe))
      .post('/api/sv/eventos-agenda/500/pool/7/asignar').send({ asesor_id: 15 });
    expect(r.status).toBe(409);
  });
});

describe('PATCH /eventos-agenda/asistentes/:eva_id/metricas', () => {
  test('200 con estado válido', async () => {
    svEv.actualizarMetricasAsistente.mockResolvedValue({ eva_id: 77 });
    const r = await request(buildApp(jefe))
      .patch('/api/sv/eventos-agenda/asistentes/77/metricas')
      .send({ estado: 'ASISTIO', leads_captados: 5 });
    expect(r.status).toBe(200);
  });

  test('422 con estado inválido', async () => {
    const r = await request(buildApp(jefe))
      .patch('/api/sv/eventos-agenda/asistentes/77/metricas')
      .send({ estado: 'BLAH' });
    expect(r.status).toBe(422);
  });
});

describe('GET /eventos-agenda/:id/resumen', () => {
  test('200 devuelve totales + por_asesor', async () => {
    svEv.resumen.mockResolvedValue({
      total_registros: 10, total_asignados: 6, total_pendientes: 4,
      por_asesor: [{ usr_id: 10, leads: 5 }]
    });
    const r = await request(buildApp(jefe)).get('/api/sv/eventos-agenda/500/resumen');
    expect(r.status).toBe(200);
    expect(r.body.data.total_pendientes).toBe(4);
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan (404s)**

Run:
```bash
cd mantix-backend && npx jest tests/eventosMulti.routes.test.js --no-coverage
```
Expected: FAIL — rutas no existen aún.

- [ ] **Step 3: Extender el controller**

Editar `mantix-backend/src/sv/controllers/agenda.controller.js`. Al final del archivo, antes del `module.exports`, agregar:

```js
// ─────────────────────────────────────────────────────────
// SP-1a · Multi-asesor + pool público
// ─────────────────────────────────────────────────────────
const eventoPool = require('../services/eventoPool.service');

async function actualizarEventoV2(req, res) {
  try {
    const r = await eventos.actualizar(parseInt(req.params.id), req.body, req.user);
    return ok(res, r);
  } catch (e) {
    if (e.code === 'NOT_FOUND')         return fail(res, 404, ERROR_CODES.NOT_FOUND, e.message);
    if (e.code === 'FORBIDDEN')         return fail(res, 403, ERROR_CODES.FORBIDDEN, e.message);
    if (e.code === 'VALIDATION_ERROR')  return fail(res, 422, ERROR_CODES.VALIDATION_ERROR, e.message);
    throw e;
  }
}

async function listarPool(req, res) {
  try {
    const r = await eventoPool.listar(parseInt(req.params.id), req.query, req.user);
    return ok(res, r);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 404, ERROR_CODES.NOT_FOUND, e.message);
    throw e;
  }
}

async function asignarPool(req, res) {
  try {
    const r = await eventoPool.asignar(
      parseInt(req.params.id), parseInt(req.params.pool_id),
      req.body, req.user
    );
    return ok(res, r);
  } catch (e) {
    if (e.code === 'NOT_FOUND')        return fail(res, 404, ERROR_CODES.NOT_FOUND, e.message);
    if (e.code === 'YA_ASIGNADO')      return fail(res, 409, ERROR_CODES.CONFLICT, e.message);
    if (e.code === 'VALIDATION_ERROR') return fail(res, 422, ERROR_CODES.VALIDATION_ERROR, e.message);
    if (e.code === 'FORBIDDEN')        return fail(res, 403, ERROR_CODES.FORBIDDEN, e.message);
    throw e;
  }
}

async function actualizarMetricas(req, res) {
  try {
    const r = await eventos.actualizarMetricasAsistente(
      parseInt(req.params.eva_id), req.body, req.user
    );
    return ok(res, r);
  } catch (e) {
    if (e.code === 'NOT_FOUND')        return fail(res, 404, ERROR_CODES.NOT_FOUND, e.message);
    if (e.code === 'FORBIDDEN')        return fail(res, 403, ERROR_CODES.FORBIDDEN, e.message);
    if (e.code === 'VALIDATION_ERROR') return fail(res, 422, ERROR_CODES.VALIDATION_ERROR, e.message);
    throw e;
  }
}

async function resumenEvento(req, res) {
  try {
    const r = await eventos.resumen(parseInt(req.params.id), req.user);
    return ok(res, r);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 404, ERROR_CODES.NOT_FOUND, e.message);
    if (e.code === 'FORBIDDEN') return fail(res, 403, ERROR_CODES.FORBIDDEN, e.message);
    throw e;
  }
}
```

Y en el `module.exports = {...}` al final del controller, agregar:

```js
  actualizarEventoV2, listarPool, asignarPool, actualizarMetricas, resumenEvento
```

**Nota**: reusa las variables `eventos`, `ok`, `fail`, `ERROR_CODES` que ya están importadas al top del archivo.

- [ ] **Step 4: Extender las rutas**

Editar `mantix-backend/src/sv/routes/agenda.routes.js`. Contenido completo tras edición:

```js
/**
 * sv/routes/agenda.routes.js (migración 018 + 020)
 * Montaje: /api/sv (svAuth aplicado en routes/index.js).
 */
const router = require('express').Router();
const c = require('../controllers/agenda.controller');
const { validate } = require('../middleware/validate');
const v = require('../validations/eventosMulti.validation');

// Agenda unificada
router.get('/agenda/dia',  c.listarDia);
router.get('/agenda/mes',  c.listarMes);

// CRUD eventos
router.get('/eventos-agenda/:id',                    c.obtenerEvento);
router.post('/eventos-agenda',                       c.crearEvento);
router.put('/eventos-agenda/:id',                    validate(v.actualizarEvento), c.actualizarEventoV2);
router.patch('/eventos-agenda/:id/completado',       c.marcarCompletadoEvento);
router.delete('/eventos-agenda/:id',                 c.eliminarEvento);

// SP-1a · Pool + métricas + resumen
router.get('/eventos-agenda/:id/pool',                                        c.listarPool);
router.post('/eventos-agenda/:id/pool/:pool_id/asignar',
            validate(v.asignarPool),                                          c.asignarPool);
router.patch('/eventos-agenda/asistentes/:eva_id/metricas',
             validate(v.actualizarMetricas),                                  c.actualizarMetricas);
router.get('/eventos-agenda/:id/resumen',                                     c.resumenEvento);

module.exports = router;
```

**Nota importante**: la ruta `PATCH /eventos-agenda/asistentes/:eva_id/metricas` NO usa `:id` del evento — el asistente ya conoce a qué evento pertenece por `eva_evento_id`. Esto simplifica la URL y evita colisiones con `/eventos-agenda/:id`.

- [ ] **Step 5: Cambiar POST /eventos-agenda para usar la validación Joi extendida**

En `agenda.routes.js` reemplazar la línea del POST por:

```js
router.post('/eventos-agenda', validate(v.crearEvento), c.crearEvento);
```

Verificar que el handler `c.crearEvento` (existente) llame a `eventos.crear(req.body, req.user)` — el nuevo `crear` en el service ya maneja el payload extendido.

Si el handler actual devuelve algo distinto o pasa un shape diferente, actualizarlo al mismo patrón que `actualizarEventoV2` (try/catch con mapeo de códigos).

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run:
```bash
cd mantix-backend && npx jest tests/eventosMulti.routes.test.js --no-coverage
```
Expected: PASS 8/8.

- [ ] **Step 7: Correr la suite completa**

Run:
```bash
cd mantix-backend && npx jest --no-coverage 2>&1 | tail -15
```
Expected: sin nuevas regresiones (mismo count de failures pre-existentes).

- [ ] **Step 8: Commit**

```bash
cd mantix-backend && git add src/sv/controllers/agenda.controller.js src/sv/routes/agenda.routes.js tests/eventosMulti.routes.test.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): endpoints CRUD extendido + pool + métricas + resumen

Nuevas rutas bajo /api/sv/eventos-agenda:
- PUT    /:id                                (validate actualizarEvento)
- GET    /:id/pool                           (?asignado=0|1)
- POST   /:id/pool/:pool_id/asignar          (validate asignarPool)
- PATCH  /asistentes/:eva_id/metricas        (validate actualizarMetricas)
- GET    /:id/resumen

POST /:id inicial ahora valida con crearEvento Joi (asistentes_ids min 1,
modo_fechas condicional, slots condicionales).

Mapea errors del service: NOT_FOUND→404, FORBIDDEN→403,
VALIDATION_ERROR→422, YA_ASIGNADO→409.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Rutas públicas — GET landing + POST registro con rate-limit

**Files:**
- Create: `mantix-backend/src/sv/services/publicEventos.service.js`
- Create: `mantix-backend/src/sv/controllers/publicEventos.controller.js`
- Create: `mantix-backend/src/sv/routes/publicEventos.routes.js`
- Modify: `mantix-backend/src/sv/routes/index.js` (montar antes de svAuth)
- Create: `mantix-backend/tests/publicEventos.routes.test.js`

**Interfaces:**
- `GET  /api/sv/public/eventos/:hash` → `{evento_id, titulo, descripcion, fecha_inicio, fecha_fin, empresa_nombre}` sin auth. 404 si hash no existe o `evento_registros_publicos_habilitado=0`, 410 si `fecha_fin < NOW()`.
- `POST /api/sv/public/eventos/:hash/registro` body `{nombre, telefono, correo}` → 201 `{ok:true}`. Rate-limit 10 req/min/IP. Idempotente por `(evento, telefono)`.

Service exports:
- `obtenerPorHash(hash) → Promise<Evento|null>`
- `registrar(hash, {nombre, telefono, correo}, meta) → Promise<{poolId, dedup:boolean}>`

- [ ] **Step 1: Escribir tests de integración**

Path: `mantix-backend/tests/publicEventos.routes.test.js`

```js
const express = require('express');
const request = require('supertest');

jest.mock('../src/sv/services/publicEventos.service', () => ({
  obtenerPorHash: jest.fn(),
  registrar:      jest.fn()
}));
const svc    = require('../src/sv/services/publicEventos.service');
const routes = require('../src/sv/routes/publicEventos.routes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sv/public', routes);
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe('GET /public/eventos/:hash', () => {
  test('200 con evento vigente', async () => {
    svc.obtenerPorHash.mockResolvedValue({
      evento_id: 500, titulo: 'Feria', fecha_inicio: new Date(),
      fecha_fin: new Date(Date.now() + 86400000), // mañana
      empresa_nombre: null
    });
    const r = await request(buildApp()).get('/api/sv/public/eventos/abc123');
    expect(r.status).toBe(200);
    expect(r.body.data.evento_id).toBe(500);
  });

  test('404 si hash no existe', async () => {
    svc.obtenerPorHash.mockResolvedValue(null);
    const r = await request(buildApp()).get('/api/sv/public/eventos/nada');
    expect(r.status).toBe(404);
  });

  test('410 si fecha_fin ya pasó', async () => {
    svc.obtenerPorHash.mockResolvedValue({
      evento_id: 500, titulo: 'Vieja',
      fecha_inicio: new Date(Date.now() - 3 * 86400000),
      fecha_fin:    new Date(Date.now() - 86400000) // ayer
    });
    const r = await request(buildApp()).get('/api/sv/public/eventos/abc123');
    expect(r.status).toBe(410);
  });
});

describe('POST /public/eventos/:hash/registro', () => {
  test('201 con payload válido', async () => {
    svc.registrar.mockResolvedValue({ poolId: 7, dedup: false });
    const r = await request(buildApp())
      .post('/api/sv/public/eventos/abc123/registro')
      .send({ nombre: 'Juan Pérez', telefono: '+57 300 123 4567' });
    expect(r.status).toBe(201);
    expect(r.body.data.ok).toBe(true);
  });

  test('200 con dedup (mismo teléfono ya registrado)', async () => {
    svc.registrar.mockResolvedValue({ poolId: 5, dedup: true });
    const r = await request(buildApp())
      .post('/api/sv/public/eventos/abc123/registro')
      .send({ nombre: 'Ana', telefono: '3001111' });
    expect(r.status).toBe(200);
    expect(r.body.data.ok).toBe(true);
    expect(r.body.data.dedup).toBe(true);
  });

  test('422 con teléfono inválido', async () => {
    const r = await request(buildApp())
      .post('/api/sv/public/eventos/abc123/registro')
      .send({ nombre: 'X', telefono: 'no-es-tel' });
    expect(r.status).toBe(422);
  });

  test('404 si hash no existe', async () => {
    svc.registrar.mockRejectedValue(Object.assign(new Error('nope'), { code: 'NOT_FOUND' }));
    const r = await request(buildApp())
      .post('/api/sv/public/eventos/nada/registro')
      .send({ nombre: 'Ana', telefono: '3001111' });
    expect(r.status).toBe(404);
  });

  test('410 si evento cerrado', async () => {
    svc.registrar.mockRejectedValue(Object.assign(new Error('cerrado'), { code: 'EVENTO_CERRADO' }));
    const r = await request(buildApp())
      .post('/api/sv/public/eventos/abc123/registro')
      .send({ nombre: 'Ana', telefono: '3001111' });
    expect(r.status).toBe(410);
  });
});
```

- [ ] **Step 2: Correr y confirmar RED**

Run:
```bash
cd mantix-backend && npx jest tests/publicEventos.routes.test.js --no-coverage
```
Expected: FAIL — módulo `publicEventos.routes` no existe.

- [ ] **Step 3: Crear el service**

Path: `mantix-backend/src/sv/services/publicEventos.service.js`

```js
/**
 * sv/services/publicEventos.service.js
 * Endpoints públicos (sin auth) del landing de eventos + registro al pool.
 */
const { SvEventoAgenda, SvEventoPoolRegistro, SvEmpresa } = require('../models');

function err(msg, code) { const e = new Error(msg); e.code = code; return e; }

async function obtenerPorHash(hash) {
  if (!hash || hash.length !== 32) return null;
  const ev = await SvEventoAgenda.findOne({
    where: { evento_link_hash: hash, evento_registros_publicos_habilitado: 1 },
    include: [{ model: SvEmpresa, as: 'empresa', attributes: ['empresa_id', 'empresa_razon_social'], required: false }]
  });
  return ev;
}

async function registrar(hash, payload, meta = {}) {
  const evento = await obtenerPorHash(hash);
  if (!evento) throw err('Evento no encontrado o registro cerrado', 'NOT_FOUND');
  if (evento.evento_fecha_fin && new Date(evento.evento_fecha_fin) < new Date()) {
    throw err('Evento ya cerrado', 'EVENTO_CERRADO');
  }
  // Idempotencia por (evento, telefono)
  const existente = await SvEventoPoolRegistro.findOne({
    where: { pool_evento_id: evento.evento_id, pool_telefono: payload.telefono }
  });
  if (existente) return { poolId: existente.pool_id, dedup: true };

  const row = await SvEventoPoolRegistro.create({
    pool_evento_id:  evento.evento_id,
    pool_nombre:     payload.nombre.trim(),
    pool_telefono:   payload.telefono.trim(),
    pool_correo:     payload.correo?.trim() || null,
    pool_ip:         (meta.ip || '').slice(0, 45),
    pool_user_agent: (meta.userAgent || '').slice(0, 255)
  });
  return { poolId: row.pool_id, dedup: false };
}

module.exports = { obtenerPorHash, registrar };
```

- [ ] **Step 4: Crear el controller**

Path: `mantix-backend/src/sv/controllers/publicEventos.controller.js`

```js
/**
 * sv/controllers/publicEventos.controller.js
 * Handlers de rutas públicas de eventos (sin svAuth).
 */
const svc = require('../services/publicEventos.service');
const { ok, created, fail } = require('../utils/response');
const { ERROR_CODES } = require('../config/constants');

async function landing(req, res) {
  const ev = await svc.obtenerPorHash(req.params.hash);
  if (!ev) return fail(res, 404, ERROR_CODES.NOT_FOUND, 'Evento no encontrado o registro cerrado');
  if (ev.evento_fecha_fin && new Date(ev.evento_fecha_fin) < new Date()) {
    return fail(res, 410, ERROR_CODES.CONFLICT, 'Evento ya cerrado');
  }
  return ok(res, {
    evento_id:      ev.evento_id,
    titulo:         ev.evento_titulo,
    descripcion:    ev.evento_descripcion,
    fecha_inicio:   ev.evento_fecha_hora,
    fecha_fin:      ev.evento_fecha_fin,
    empresa_nombre: ev.empresa?.empresa_razon_social || null
  });
}

async function registrar(req, res) {
  try {
    const r = await svc.registrar(req.params.hash, req.body, {
      ip:        req.ip,
      userAgent: req.headers['user-agent']
    });
    if (r.dedup) return ok(res, { ok: true, dedup: true, poolId: r.poolId });
    return created(res, { ok: true, dedup: false, poolId: r.poolId });
  } catch (e) {
    if (e.code === 'NOT_FOUND')       return fail(res, 404, ERROR_CODES.NOT_FOUND, e.message);
    if (e.code === 'EVENTO_CERRADO')  return fail(res, 410, ERROR_CODES.CONFLICT, e.message);
    throw e;
  }
}

module.exports = { landing, registrar };
```

- [ ] **Step 5: Crear las rutas públicas con rate-limit**

Path: `mantix-backend/src/sv/routes/publicEventos.routes.js`

```js
/**
 * sv/routes/publicEventos.routes.js — SIN svAuth.
 * Se monta bajo /api/sv/public en routes/index.js ANTES de svAuth.
 */
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validate');
const c = require('../controllers/publicEventos.controller');
const v = require('../validations/eventosMulti.validation');

const registroLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos, espera un minuto' } }
});

router.get('/eventos/:hash',                                              c.landing);
router.post('/eventos/:hash/registro',
            registroLimiter, validate(v.registroPublico),                 c.registrar);

module.exports = router;
```

- [ ] **Step 6: Montar en routes/index.js ANTES de svAuth**

Editar `mantix-backend/src/sv/routes/index.js`. Buscar la línea de `svAuth`:
```js
router.use('/auth',     require('./auth.routes'));
```
Insertar INMEDIATAMENTE ANTES de esa línea (o antes del primer `router.use` que use `svAuth`) — pero DESPUÉS de `router.get('/health', ...)`:

```js
// SP-1a · Endpoints públicos (sin svAuth) — landing + registro al pool
router.use('/public', require('./publicEventos.routes'));
```

Verificar que el orden final quede: health → public → auth → resto (todos con svAuth).

- [ ] **Step 7: Correr los tests**

Run:
```bash
cd mantix-backend && npx jest tests/publicEventos.routes.test.js --no-coverage
```
Expected: PASS 6/6.

- [ ] **Step 8: Suite completa**

Run:
```bash
cd mantix-backend && npx jest --no-coverage 2>&1 | tail -15
```
Expected: mismo count de failures pre-existentes.

- [ ] **Step 9: Commit**

```bash
cd mantix-backend && git add src/sv/services/publicEventos.service.js src/sv/controllers/publicEventos.controller.js src/sv/routes/publicEventos.routes.js src/sv/routes/index.js tests/publicEventos.routes.test.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): rutas públicas landing + registro con rate-limit

- GET  /api/sv/public/eventos/:hash → landing (200/404/410)
  Sólo devuelve el evento si evento_registros_publicos_habilitado=1
  y la fecha_fin no ha pasado.
- POST /api/sv/public/eventos/:hash/registro → 201 (nuevo) o 200 (dedup)
  Validación Joi (nombre/tel/correo opcional con .local permitido).
  Rate-limit 10 req/min/IP. Idempotente por (evento, telefono).
  Guarda ip y user-agent para trazabilidad.

Se monta en routes/index.js ANTES de svAuth para que quede accesible
sin token.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Push + deploy backend + smoke con curl

**Files:** ninguno (sólo operaciones remotas).

- [ ] **Step 1: Push a origin**

```bash
cd mantix-backend && git log --oneline origin/main..HEAD | head -10 && git push origin main
```
Expected: los 7 commits de SP-1a subieron.

- [ ] **Step 2: Ejecutar migración en la DB de producción (si no está)**

Delegado al usuario. Comando:
```bash
# En el server:
mysql -u <user> -p <db> < src/sv/migrations/020_eventos_multi_asesor.sql
```
Expected: la sentencia `SELECT` final devuelve `altered=1`, counts 0, `fuentes_evento > 0`.

- [ ] **Step 3: Deploy backend con `deploy-mantix`**

Delegado al usuario. `deploy-mantix` hace git pull + pm2 restart.

- [ ] **Step 4: Smoke con curl (una vez pm2 reinició)**

Ejecutar (necesitas un JWT válido para las autenticadas):

```bash
# 1) Crear evento con 2 asistentes + registros_publicos_habilitado=true
curl -sX POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  https://mantix-api.losolivoscucuta.com:8444/api/sv/eventos-agenda \
  -d '{"titulo":"Smoke SP-1a","tipo":"FERIA","modo_fechas":"UNICO","fecha_inicio":"2026-11-01T08:00:00Z","asistentes_ids":[<TU_USR_ID>],"registros_publicos_habilitado":true}' | jq

# Anotar el evento_id y evento_link_hash de la respuesta.

# 2) Landing público (sin token)
curl -sX GET https://mantix-api.losolivoscucuta.com:8444/api/sv/public/eventos/<HASH> | jq

# 3) Registro público (sin token)
curl -sX POST -H "Content-Type: application/json" \
  https://mantix-api.losolivoscucuta.com:8444/api/sv/public/eventos/<HASH>/registro \
  -d '{"nombre":"Test QA","telefono":"3009999999","correo":"qa@olivos.local"}' | jq

# 4) Repetir el registro (mismo tel) → debe devolver dedup=true, HTTP 200
curl -sX POST -H "Content-Type: application/json" \
  https://mantix-api.losolivoscucuta.com:8444/api/sv/public/eventos/<HASH>/registro \
  -d '{"nombre":"Test QA","telefono":"3009999999"}' | jq

# 5) Rate-limit: 15 requests seguidas debe cortar en la 11
for i in {1..15}; do
  curl -sX POST -H "Content-Type: application/json" \
    https://mantix-api.losolivoscucuta.com:8444/api/sv/public/eventos/<HASH>/registro \
    -d '{"nombre":"Rate '$i'","telefono":"300000'$i'"}' -o /dev/null -w "%{http_code} "
done
echo
# Esperado: 201 201 201 201 201 201 201 201 201 201 (o 200s) 429 429 ...

# 6) Ver el pool
curl -sX GET -H "Authorization: Bearer <TOKEN>" \
  "https://mantix-api.losolivoscucuta.com:8444/api/sv/eventos-agenda/<EVENTO_ID>/pool?asignado=0" | jq

# 7) Asignar un registro del pool al asesor asistente
curl -sX POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  https://mantix-api.losolivoscucuta.com:8444/api/sv/eventos-agenda/<EVENTO_ID>/pool/<POOL_ID>/asignar \
  -d '{"asesor_id":<TU_USR_ID>}' | jq
# Esperado: 200 con {pool: {...}, prospecto: {prosp_id: N}}

# 8) Volver a pedir el pool → el registro asignado ya no aparece con ?asignado=0
curl -sX GET -H "Authorization: Bearer <TOKEN>" \
  "https://mantix-api.losolivoscucuta.com:8444/api/sv/eventos-agenda/<EVENTO_ID>/pool?asignado=0" | jq

# 9) Resumen del evento
curl -sX GET -H "Authorization: Bearer <TOKEN>" \
  https://mantix-api.losolivoscucuta.com:8444/api/sv/eventos-agenda/<EVENTO_ID>/resumen | jq
# Esperado: total_registros = N, total_asignados >= 1, por_asesor[0] tiene tus métricas
```

- [ ] **Step 5: Limpieza (opcional)**

```bash
# En la DB, eliminar el evento de smoke (los pools y prospectos hijos caen por CASCADE — pero el prospecto creado NO se borra: es la política del spec, queda huérfano al evento)
DELETE FROM sv_org_eventos_agenda WHERE evento_titulo = 'Smoke SP-1a';
# Verificar y borrar manualmente el prospecto QA si aplica.
```

---

## Notas para el implementador

- **Migración 020 idempotente**: si la corres dos veces, no falla. El `INSERT IGNORE` en `sv_cfg_fuentes_prospecto` respeta el unique `(fuente_area_id, fuente_codigo)`.
- **`SvPersona` model shape**: si `persona_apellido` es NOT NULL en el modelo actual, ajusta el service para poner `''` en lugar de `null`. Verifica con `head src/sv/models/Persona.js`.
- **`SvEstado` primer estado**: el service asume que existe `estado_orden=1` para el área. Si en producción hay áreas sin estado configurado, el asignar responderá VALIDATION_ERROR — mejor así que crear un prospecto sin estado válido.
- **`crearEvento` handler existente**: el controller tiene un `crearEvento` desde SP anterior. Verifica si su lógica ya llama `eventos.crear(req.body, req.user)` — si sí, no toques. Si tiene lógica custom (ej. defaults del asesor solo), respétala y sólo agrega la validación Joi en la ruta.
- **Attribution**: cada commit debe llevar EXACTAMENTE `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` — no substituir por el nombre del subagent.
- **Pool → Prospecto**: el prospecto creado tiene `prosp_asesor_id=<asesor_id>` (asignado directo), no `NULL`. La opción de que quede en la cola "sin asignar" es un futuro refinamiento — spec §13 abierto.

---

## Self-review

**1. Spec coverage** — Reviso el spec §4.2, §5.2, §6.2, §8.2:

- ✅ ALTER `sv_org_eventos_agenda` con los 8 campos (Task 1).
- ✅ 3 tablas nuevas (Task 1).
- ✅ Helper `usuariosAccesibles` (Task 2).
- ✅ CRUD extendido con scope (Task 4).
- ✅ Pool listar + asignar → crea prospecto (Task 5).
- ✅ Métricas por asistente (Task 4 + Task 6).
- ✅ Resumen agregado (Task 4 + Task 6).
- ✅ Rutas públicas con rate-limit + dedup por teléfono (Task 7).
- ✅ Migración inserta fuente EVENTO_PUBLICO por área (Task 1).
- ⚠️ Vista de seguimiento (semana + timeline) → **NO** implementado aquí, va en SP-2 según decomposición del spec.
- ⚠️ OTP para edición del dueño → **NO** implementado, va en SP-3.
- ⚠️ Reasignación de pool tras primer asignado (spec §13 abierto): la lógica actual rechaza con `YA_ASIGNADO`. Si se necesita reasignar, se resuelve con un endpoint futuro `POST /pool/:id/reasignar` — no en scope de SP-1a.

**2. Placeholder scan** — no TBDs/TODOs. Cada step trae código o comando concreto. Las 4 preguntas al implementador en "Notas" son verificaciones puntuales, no huecos.

**3. Type consistency**:
- `usuariosAccesibles` retorna `number[] | null` — usado consistentemente en Tasks 4, 5.
- `crear`/`actualizar`/`getOne`/`actualizarMetricasAsistente`/`resumen` — mismos nombres en service (Task 4), controller (Task 6), routes (Task 6).
- `listar`/`asignar` en `eventoPool.service` — mismos nombres controller (Task 6).
- `obtenerPorHash`/`registrar` en `publicEventos.service` — mismos nombres controller (Task 7).
- Códigos de error: `NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, `YA_ASIGNADO`, `EVENTO_CERRADO` — todos mapeados en el controller a HTTP codes.
- Response envelope: `ok()` → 200, `created()` → 201, `fail(res, N, ...)` → status N.

Sin inconsistencias.
