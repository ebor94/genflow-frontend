# SP-3 — OTP Google Chat para edición del dueño

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que el asesor titular de un evento lo edite pasando por un OTP de 6 dígitos que se envía al webhook de Google Chat donde lo lee un jefe. Los jefes (COORDINADOR_PREVISION, JEFE_PAP, SUPERVISOR, DIRECTOR_COMERCIAL, GERENTE_GENERAL, ADMIN_AREA, SUPER_ADMIN) siguen editando directo con PUT (sin OTP).

**Architecture:** Nueva tabla `sv_org_evento_otps` guarda hash sha256 del token, snapshot JSON del cambio propuesto y contadores de intentos/expiración. El endpoint `solicitar` genera OTP, guarda snapshot, envía mensaje al webhook (axios, timeout 5s) y devuelve `{otp_id, expires_at}`. El endpoint `confirmar` valida hash + no expirado + no consumido + intentos<3, aplica el snapshot vía `eventosAgenda.actualizar` con actor "jefe virtual" que salta el guard de asesor. Frontend: `EditarEventoModal` reusa validaciones del `NuevoEventoAgendaModal`; al guardar, si el actor es dueño-asesor, dispara flujo OTP con `OtpConfirmarModal` (6 inputs, contador 10min, botón Reenviar tras 30s).

**Tech Stack:** Sequelize (SvEventoOtp), Joi (validaciones), axios (webhook), sha256 (crypto), node-cron (cleanup), Vue 3 + Pinia (frontend), Tailwind, Vitest, Jest.

## Global Constraints

- Webhook URL vive **solo** en `process.env.GCHAT_WEBHOOK_EVENTOS`; nunca hardcodearlo, nunca loguearlo.
- Token en claro **nunca** persiste — solo `sha256(token)` en `otp_hash`.
- Expiración: `created_at + OTP_EXPIRACION_MIN` (default 10) minutos.
- Cap por (usr, evento): `OTP_MAX_ACTIVOS_POR_USR_EVENTO` (default 3) OTPs no consumidos y no expirados.
- Intentos: `OTP_MAX_INTENTOS` (default 3) — al 3er fallo el OTP queda invalidado.
- Contador reenviar: 30 segundos (frontend).
- Modal con `<Teleport to="body">`, no cierra con Escape ni click fuera durante la solicitud.
- Timezone `America/Bogota` para todo lo que se muestre al usuario.
- Attribution: cada subagente firma con su propio modelo (Sonnet / Haiku / Opus según se despache).
- No modificar el guard `esAsesor` de `eventos.actualizar` — el service `eventoOtp.confirmar` invoca `eventos.actualizar` pasando un `actor` "jefe virtual" (solución en Task 4).

---

### Task 1: Migración SQL 021 + Modelo SvEventoOtp

**Files:**
- Create: `mantix-backend/src/sv/migrations/021_evento_otps.sql`
- Create: `mantix-backend/src/sv/models/EventoOtp.js`
- Modify: `mantix-backend/src/sv/models/index.js` (agregar `SvEventoOtp`)

**Interfaces:**
- Produces: modelo `SvEventoOtp` con campos `otp_id`, `otp_evento_id`, `otp_usr_id`, `otp_hash`, `otp_expires_at`, `otp_consumed_at`, `otp_intentos`, `otp_payload_json`, `otp_created_at`. Asociaciones: `evento` → SvEventoAgenda, `usuario` → SvUsuario.

- [ ] **Step 1: Escribir SQL idempotente**

Crear `mantix-backend/src/sv/migrations/021_evento_otps.sql`:

```sql
-- =====================================================================
-- SerVentas CRM — Migración 021: OTP para edición de eventos (SP-3)
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS sv_org_evento_otps (
  otp_id           INT AUTO_INCREMENT PRIMARY KEY,
  otp_evento_id    INT NOT NULL,
  otp_usr_id       INT NOT NULL COMMENT 'quien pidió el token',
  otp_hash         CHAR(64) NOT NULL COMMENT 'sha256(token)',
  otp_expires_at   DATETIME NOT NULL,
  otp_consumed_at  DATETIME NULL,
  otp_intentos     TINYINT NOT NULL DEFAULT 0,
  otp_payload_json JSON NULL COMMENT 'snapshot del cambio propuesto',
  otp_created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_evento (otp_evento_id, otp_consumed_at),
  INDEX idx_otp_expires (otp_expires_at),
  CONSTRAINT fk_otp_evento FOREIGN KEY (otp_evento_id)
    REFERENCES sv_org_eventos_agenda(evento_id) ON DELETE CASCADE,
  CONSTRAINT fk_otp_usr FOREIGN KEY (otp_usr_id)
    REFERENCES sv_org_usuarios(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Crear modelo Sequelize**

Crear `mantix-backend/src/sv/models/EventoOtp.js`:

```js
// sv/models/EventoOtp.js — sv_org_evento_otps (migración 021, SP-3)
module.exports = (sequelize, DataTypes) => {
  const EventoOtp = sequelize.define('SvEventoOtp', {
    otp_id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    otp_evento_id:    { type: DataTypes.INTEGER, allowNull: false },
    otp_usr_id:       { type: DataTypes.INTEGER, allowNull: false },
    otp_hash:         { type: DataTypes.CHAR(64), allowNull: false },
    otp_expires_at:   { type: DataTypes.DATE, allowNull: false },
    otp_consumed_at:  { type: DataTypes.DATE },
    otp_intentos:     { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    otp_payload_json: { type: DataTypes.JSON }
  }, {
    tableName: 'sv_org_evento_otps',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'otp_created_at',
    updatedAt: false
  });

  EventoOtp.associate = (models) => {
    EventoOtp.belongsTo(models.SvEventoAgenda, { as: 'evento',  foreignKey: 'otp_evento_id' });
    EventoOtp.belongsTo(models.SvUsuario,      { as: 'usuario', foreignKey: 'otp_usr_id' });
  };
  return EventoOtp;
};
```

- [ ] **Step 3: Registrar modelo en index**

En `mantix-backend/src/sv/models/index.js`, añadir después de `SvEventoPoolRegistro`:

```js
  SvEventoOtp:         require('./EventoOtp')(sequelize, Sequelize.DataTypes),
```

- [ ] **Step 4: Correr migración local + verificar**

Ejecutar (usuario debe correr manualmente):

```bash
mysql -u root -p serfuweb < mantix-backend/src/sv/migrations/021_evento_otps.sql
```

Verificar con `SHOW COLUMNS FROM sv_org_evento_otps;` — debe listar los 9 campos.

- [ ] **Step 5: Commit**

```bash
git add mantix-backend/src/sv/migrations/021_evento_otps.sql \
        mantix-backend/src/sv/models/EventoOtp.js \
        mantix-backend/src/sv/models/index.js
git commit -m "feat(sp3): migración 021 + modelo SvEventoOtp"
```

---

### Task 2: Validaciones Joi eventoOtp

**Files:**
- Create: `mantix-backend/src/sv/validations/eventoOtp.validation.js`
- Create: `mantix-backend/tests/eventoOtp.validation.test.js`

**Interfaces:**
- Consumes: nada (Joi standalone).
- Produces: `solicitarOtp` (body: `{cambios: object required}`), `confirmarOtp` (body: `{otp_id: int required, otp: string regex /^\d{6}$/ required}`).

- [ ] **Step 1: Escribir test primero**

Crear `mantix-backend/tests/eventoOtp.validation.test.js`:

```js
const { solicitarOtp, confirmarOtp } = require('../src/sv/validations/eventoOtp.validation');

describe('validations/eventoOtp', () => {
  describe('solicitarOtp', () => {
    it('acepta cambios objeto no vacío', () => {
      const { error } = solicitarOtp.body.validate({ cambios: { titulo: 'Nuevo' } });
      expect(error).toBeUndefined();
    });
    it('rechaza cambios vacío', () => {
      const { error } = solicitarOtp.body.validate({ cambios: {} });
      expect(error).toBeDefined();
    });
    it('rechaza sin cambios', () => {
      const { error } = solicitarOtp.body.validate({});
      expect(error).toBeDefined();
    });
  });
  describe('confirmarOtp', () => {
    it('acepta otp de 6 dígitos', () => {
      const { error } = confirmarOtp.body.validate({ otp_id: 42, otp: '493712' });
      expect(error).toBeUndefined();
    });
    it('rechaza otp de 5 dígitos', () => {
      const { error } = confirmarOtp.body.validate({ otp_id: 42, otp: '49371' });
      expect(error).toBeDefined();
    });
    it('rechaza otp no numérico', () => {
      const { error } = confirmarOtp.body.validate({ otp_id: 42, otp: 'abc123' });
      expect(error).toBeDefined();
    });
    it('rechaza sin otp_id', () => {
      const { error } = confirmarOtp.body.validate({ otp: '493712' });
      expect(error).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Correr test — debe fallar**

```bash
cd mantix-backend && npx jest tests/eventoOtp.validation.test.js
```

Expected: FAIL (`Cannot find module '../src/sv/validations/eventoOtp.validation'`).

- [ ] **Step 3: Implementar validación mínima**

Crear `mantix-backend/src/sv/validations/eventoOtp.validation.js`:

```js
// sv/validations/eventoOtp.validation.js — SP-3
const Joi = require('joi');

const solicitarOtp = {
  body: Joi.object({
    cambios: Joi.object().min(1).required()
  })
};

const confirmarOtp = {
  body: Joi.object({
    otp_id: Joi.number().integer().positive().required(),
    otp:    Joi.string().pattern(/^\d{6}$/).required()
  })
};

module.exports = { solicitarOtp, confirmarOtp };
```

- [ ] **Step 4: Correr test — debe pasar**

```bash
cd mantix-backend && npx jest tests/eventoOtp.validation.test.js
```

Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add mantix-backend/src/sv/validations/eventoOtp.validation.js mantix-backend/tests/eventoOtp.validation.test.js
git commit -m "feat(sp3): validaciones Joi solicitar/confirmar OTP"
```

---

### Task 3: Service googleChat

**Files:**
- Create: `mantix-backend/src/sv/services/googleChat.service.js`
- Create: `mantix-backend/tests/googleChat.service.test.js`

**Interfaces:**
- Consumes: axios, `process.env.GCHAT_WEBHOOK_EVENTOS`.
- Produces: `enviarOtp({ evento, usuario, cambios, otp })` — retorna `Promise<{ ok: true, ms: number }>` en éxito o lanza `Error` con `code === 'GCHAT_FAIL'` en fallo/timeout.

- [ ] **Step 1: Escribir test primero**

Crear `mantix-backend/tests/googleChat.service.test.js`:

```js
jest.mock('axios');
const axios = require('axios');
const gchat = require('../src/sv/services/googleChat.service');

describe('services/googleChat', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...OLD_ENV, GCHAT_WEBHOOK_EVENTOS: 'https://chat.example.com/webhook' };
  });
  afterAll(() => { process.env = OLD_ENV; });

  it('envía payload con texto que incluye asesor + otp + cambios', async () => {
    axios.post.mockResolvedValueOnce({ status: 200 });
    const r = await gchat.enviarOtp({
      evento: { evento_id: 12, evento_titulo: 'Feria XYZ' },
      usuario: { usr_id: 5, usr_nombre: 'Pepe', usr_apellido: 'Santafé' },
      cambios: { titulo: 'Nuevo título' },
      otp: '493712'
    });
    expect(r.ok).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      'https://chat.example.com/webhook',
      expect.objectContaining({ text: expect.stringContaining('493712') }),
      expect.objectContaining({ timeout: 5000 })
    );
    const body = axios.post.mock.calls[0][1].text;
    expect(body).toContain('Pepe Santafé');
    expect(body).toContain('Feria XYZ');
  });

  it('lanza GCHAT_FAIL en timeout', async () => {
    axios.post.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    await expect(gchat.enviarOtp({
      evento: { evento_id: 1, evento_titulo: 't' },
      usuario: { usr_id: 1, usr_nombre: 'a', usr_apellido: 'b' },
      cambios: { x: 1 }, otp: '123456'
    })).rejects.toMatchObject({ code: 'GCHAT_FAIL' });
  });

  it('lanza GCHAT_FAIL si falta GCHAT_WEBHOOK_EVENTOS', async () => {
    delete process.env.GCHAT_WEBHOOK_EVENTOS;
    await expect(gchat.enviarOtp({
      evento: { evento_id: 1, evento_titulo: 't' },
      usuario: { usr_id: 1, usr_nombre: 'a', usr_apellido: 'b' },
      cambios: { x: 1 }, otp: '123456'
    })).rejects.toMatchObject({ code: 'GCHAT_FAIL' });
  });
});
```

- [ ] **Step 2: Correr test — debe fallar**

```bash
cd mantix-backend && npx jest tests/googleChat.service.test.js
```

Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar servicio**

Crear `mantix-backend/src/sv/services/googleChat.service.js`:

```js
/**
 * sv/services/googleChat.service.js — SP-3
 * Envía mensajes al webhook de Google Chat para notificar OTPs
 * de edición de eventos al canal donde están los jefes.
 * Nunca loguea la URL del webhook ni el OTP en claro fuera del log estructurado.
 */
const axios = require('axios');

function fmtCambios(cambios) {
  const keys = Object.keys(cambios || {});
  if (!keys.length) return '(sin detalles)';
  return keys.slice(0, 8).map(k => `• ${k}`).join('\n');
}

async function enviarOtp({ evento, usuario, cambios, otp }) {
  const url = process.env.GCHAT_WEBHOOK_EVENTOS;
  if (!url) {
    const err = new Error('GCHAT_WEBHOOK_EVENTOS no configurado');
    err.code = 'GCHAT_FAIL';
    throw err;
  }

  const nombre = `${usuario.usr_nombre || ''} ${usuario.usr_apellido || ''}`.trim() || `Usuario #${usuario.usr_id}`;
  const text =
    `*OTP edición de evento* — vence en 10 min\n` +
    `Asesor: *${nombre}* (#${usuario.usr_id})\n` +
    `Evento: *${evento.evento_titulo}* (#${evento.evento_id})\n` +
    `Cambios propuestos:\n${fmtCambios(cambios)}\n\n` +
    `Código: *${otp}*\n` +
    `Compártelo con el asesor SOLO si autorizas el cambio.`;

  const t0 = Date.now();
  try {
    await axios.post(url, { text }, { timeout: 5000 });
    const ms = Date.now() - t0;
    console.log(JSON.stringify({ tag: 'OTP_SENT', evento_id: evento.evento_id, usr_id: usuario.usr_id, canal: 'google_chat', tiempo_gchat_ms: ms }));
    return { ok: true, ms };
  } catch (e) {
    console.log(JSON.stringify({ tag: 'GCHAT_ERROR', tipo: e.code || 'unknown', detalle: e.message?.slice(0, 200) }));
    const err = new Error('No se pudo enviar el OTP a Google Chat');
    err.code = 'GCHAT_FAIL';
    throw err;
  }
}

module.exports = { enviarOtp };
```

- [ ] **Step 4: Correr test — debe pasar**

```bash
cd mantix-backend && npx jest tests/googleChat.service.test.js
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add mantix-backend/src/sv/services/googleChat.service.js mantix-backend/tests/googleChat.service.test.js
git commit -m "feat(sp3): service googleChat.enviarOtp con axios + timeout 5s"
```

---

### Task 4: Service eventoOtp

**Files:**
- Create: `mantix-backend/src/sv/services/eventoOtp.service.js`
- Modify: `mantix-backend/src/sv/services/eventosAgenda.service.js` (exportar helper `aplicarPatch(id, payload, ev)` reutilizable)
- Create: `mantix-backend/tests/eventoOtp.service.test.js`

**Interfaces:**
- Consumes: `SvEventoOtp`, `SvEventoAgenda`, `SvUsuario` (Task 1); `googleChat.enviarOtp` (Task 3); `eventosAgenda.actualizar` (existente).
- Produces:
  - `solicitar({ eventoId, cambios, actor }) → { otp_id, expires_at, canal: 'google_chat' }` — solo dueño-asesor.
  - `confirmar({ eventoId, otpId, otp, actor }) → evento actualizado` — invoca `eventos.actualizar` en modo "jefe virtual".
  - `cleanupVencidos()` — borra OTPs `expires_at < NOW() - 24h`.

- [ ] **Step 1: Escribir test primero**

Crear `mantix-backend/tests/eventoOtp.service.test.js`:

```js
jest.mock('../src/sv/services/googleChat.service', () => ({ enviarOtp: jest.fn() }));

const { sequelize, SvEventoAgenda, SvEventoAsistente, SvEventoOtp, SvUsuario, SvRol, SvArea, SvGrupo } = require('../src/sv/models');
const gchat = require('../src/sv/services/googleChat.service');
const eventoOtp = require('../src/sv/services/eventoOtp.service');

let asesor, evento;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const rolAsesor = await SvRol.create({ rol_codigo: 'ASESOR', rol_nombre: 'Asesor' });
  const area = await SvArea.create({ area_codigo: 'PREV', area_nombre: 'Previsión' });
  const grupo = await SvGrupo.create({ grupo_area_id: area.area_id, grupo_codigo: 'G1', grupo_nombre: 'G1' });
  asesor = await SvUsuario.create({
    usr_rol_id: rolAsesor.rol_id, usr_area_id: area.area_id, usr_grupo_id: grupo.grupo_id,
    usr_nombre: 'Pepe', usr_apellido: 'S', usr_email: 'p@x.co', usr_password: 'x', usr_activo: 1
  });
});

beforeEach(async () => {
  await SvEventoOtp.destroy({ where: {}, truncate: true });
  await SvEventoAsistente.destroy({ where: {}, truncate: true });
  await SvEventoAgenda.destroy({ where: {}, truncate: true });
  gchat.enviarOtp.mockReset();
  gchat.enviarOtp.mockResolvedValue({ ok: true, ms: 42 });
  evento = await SvEventoAgenda.create({
    evento_asesor_id: asesor.usr_id, evento_creado_por: asesor.usr_id,
    evento_titulo: 'T', evento_tipo: 'REUNION', evento_modo_fechas: 'UNICO',
    evento_fecha_hora: new Date(), evento_completado: 0
  });
  await SvEventoAsistente.create({ eva_evento_id: evento.evento_id, eva_usr_id: asesor.usr_id, eva_activo: 1 });
});

const actorAsesor = () => ({
  usr_id: asesor.usr_id, rol: { rol_codigo: 'ASESOR' }, usr_area_id: asesor.usr_area_id, usr_grupo_id: asesor.usr_grupo_id
});

describe('services/eventoOtp', () => {
  it('solicitar: crea registro, envía a gchat y devuelve otp_id + expires_at', async () => {
    const r = await eventoOtp.solicitar({
      eventoId: evento.evento_id, cambios: { titulo: 'Nuevo' }, actor: actorAsesor()
    });
    expect(r.otp_id).toBeGreaterThan(0);
    expect(r.expires_at).toBeInstanceOf(Date);
    expect(r.canal).toBe('google_chat');
    expect(gchat.enviarOtp).toHaveBeenCalledTimes(1);
    const row = await SvEventoOtp.findByPk(r.otp_id);
    expect(row.otp_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.otp_intentos).toBe(0);
    expect(row.otp_payload_json).toMatchObject({ titulo: 'Nuevo' });
  });

  it('solicitar: rollback y GCHAT_FAIL si el webhook falla', async () => {
    gchat.enviarOtp.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'GCHAT_FAIL' }));
    await expect(eventoOtp.solicitar({
      eventoId: evento.evento_id, cambios: { titulo: 'X' }, actor: actorAsesor()
    })).rejects.toMatchObject({ code: 'GCHAT_FAIL' });
    expect(await SvEventoOtp.count()).toBe(0);
  });

  it('solicitar: 429 al 4to activo', async () => {
    for (let i = 0; i < 3; i++) {
      await eventoOtp.solicitar({ eventoId: evento.evento_id, cambios: { titulo: 'x'+i }, actor: actorAsesor() });
    }
    await expect(eventoOtp.solicitar({
      eventoId: evento.evento_id, cambios: { titulo: 'z' }, actor: actorAsesor()
    })).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  });

  it('solicitar: FORBIDDEN si actor no es dueño', async () => {
    const otro = { usr_id: 999, rol: { rol_codigo: 'ASESOR' } };
    await expect(eventoOtp.solicitar({
      eventoId: evento.evento_id, cambios: { titulo: 'x' }, actor: otro
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('confirmar: código correcto aplica cambios y marca consumed_at', async () => {
    let capturado;
    gchat.enviarOtp.mockImplementationOnce(async ({ otp }) => { capturado = otp; return { ok: true, ms: 1 }; });
    const { otp_id } = await eventoOtp.solicitar({
      eventoId: evento.evento_id, cambios: { titulo: 'Editado' }, actor: actorAsesor()
    });
    const r = await eventoOtp.confirmar({ eventoId: evento.evento_id, otpId: otp_id, otp: capturado, actor: actorAsesor() });
    expect(r.evento_titulo).toBe('Editado');
    const row = await SvEventoOtp.findByPk(otp_id);
    expect(row.otp_consumed_at).toBeInstanceOf(Date);
  });

  it('confirmar: código incorrecto incrementa intentos; al 3er fallo → 401 y OTP invalidado', async () => {
    const { otp_id } = await eventoOtp.solicitar({
      eventoId: evento.evento_id, cambios: { titulo: 'X' }, actor: actorAsesor()
    });
    for (let i = 0; i < 3; i++) {
      await expect(eventoOtp.confirmar({
        eventoId: evento.evento_id, otpId: otp_id, otp: '000000', actor: actorAsesor()
      })).rejects.toMatchObject({ code: 'OTP_INVALID' });
    }
    const row = await SvEventoOtp.findByPk(otp_id);
    expect(row.otp_intentos).toBe(3);
    expect(row.otp_consumed_at).toBeInstanceOf(Date); // invalidado marcando consumed
  });

  it('confirmar: OTP expirado → 410 GONE', async () => {
    const { otp_id } = await eventoOtp.solicitar({
      eventoId: evento.evento_id, cambios: { titulo: 'X' }, actor: actorAsesor()
    });
    await SvEventoOtp.update({ otp_expires_at: new Date(Date.now() - 60_000) }, { where: { otp_id } });
    await expect(eventoOtp.confirmar({
      eventoId: evento.evento_id, otpId: otp_id, otp: '123456', actor: actorAsesor()
    })).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });

  it('confirmar: OTP ya consumido → 409 CONFLICT', async () => {
    let capturado;
    gchat.enviarOtp.mockImplementationOnce(async ({ otp }) => { capturado = otp; return { ok: true }; });
    const { otp_id } = await eventoOtp.solicitar({
      eventoId: evento.evento_id, cambios: { titulo: 'A' }, actor: actorAsesor()
    });
    await eventoOtp.confirmar({ eventoId: evento.evento_id, otpId: otp_id, otp: capturado, actor: actorAsesor() });
    await expect(eventoOtp.confirmar({
      eventoId: evento.evento_id, otpId: otp_id, otp: capturado, actor: actorAsesor()
    })).rejects.toMatchObject({ code: 'OTP_CONSUMED' });
  });

  it('cleanupVencidos: borra sólo los > 24h después de expirar', async () => {
    const viejo = await SvEventoOtp.create({
      otp_evento_id: evento.evento_id, otp_usr_id: asesor.usr_id, otp_hash: 'a'.repeat(64),
      otp_expires_at: new Date(Date.now() - 25 * 3600 * 1000)
    });
    const reciente = await SvEventoOtp.create({
      otp_evento_id: evento.evento_id, otp_usr_id: asesor.usr_id, otp_hash: 'b'.repeat(64),
      otp_expires_at: new Date(Date.now() - 10 * 3600 * 1000)
    });
    const n = await eventoOtp.cleanupVencidos();
    expect(n).toBe(1);
    expect(await SvEventoOtp.findByPk(viejo.otp_id)).toBeNull();
    expect(await SvEventoOtp.findByPk(reciente.otp_id)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Correr test — debe fallar**

```bash
cd mantix-backend && npx jest tests/eventoOtp.service.test.js
```

Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar servicio**

Crear `mantix-backend/src/sv/services/eventoOtp.service.js`:

```js
/**
 * sv/services/eventoOtp.service.js — SP-3
 * Flujo OTP para que el dueño-asesor edite su evento pasando por Google Chat.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const { SvEventoOtp, SvEventoAgenda, SvUsuario } = require('../models');
const eventosAgenda = require('./eventosAgenda.service');
const gchat = require('./googleChat.service');
const { ROLES } = require('../config/constants');

const EXPIRACION_MIN     = parseInt(process.env.OTP_EXPIRACION_MIN || '10', 10);
const MAX_ACTIVOS        = parseInt(process.env.OTP_MAX_ACTIVOS_POR_USR_EVENTO || '3', 10);
const MAX_INTENTOS       = parseInt(process.env.OTP_MAX_INTENTOS || '3', 10);

function err(msg, code) { const e = new Error(msg); e.code = code; return e; }
function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
function esAsesor(actor) {
  const c = actor?.rol?.rol_codigo;
  return c === ROLES.ASESOR || c === ROLES.AGENTE_SVC;
}

async function solicitar({ eventoId, cambios, actor }) {
  if (!esAsesor(actor)) throw err('Solo el dueño-asesor solicita OTP; los jefes editan directo', 'FORBIDDEN');

  const ev = await SvEventoAgenda.findByPk(eventoId);
  if (!ev) throw err('Evento no encontrado', 'NOT_FOUND');
  if (ev.evento_asesor_id !== actor.usr_id) throw err('Solo el dueño del evento puede solicitar OTP', 'FORBIDDEN');

  const ahora = new Date();
  const activos = await SvEventoOtp.count({
    where: {
      otp_evento_id: eventoId,
      otp_usr_id:    actor.usr_id,
      otp_consumed_at: null,
      otp_expires_at: { [Op.gt]: ahora }
    }
  });
  if (activos >= MAX_ACTIVOS) throw err(`Máximo ${MAX_ACTIVOS} OTPs activos por evento`, 'RATE_LIMIT');

  const otpPlano = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const expires  = new Date(ahora.getTime() + EXPIRACION_MIN * 60_000);

  const row = await SvEventoOtp.create({
    otp_evento_id: eventoId,
    otp_usr_id:    actor.usr_id,
    otp_hash:      sha256(otpPlano),
    otp_expires_at: expires,
    otp_payload_json: cambios
  });

  const usuario = await SvUsuario.findByPk(actor.usr_id, {
    attributes: ['usr_id', 'usr_nombre', 'usr_apellido']
  });

  try {
    await gchat.enviarOtp({ evento: ev, usuario, cambios, otp: otpPlano });
  } catch (e) {
    await row.destroy(); // rollback
    throw e;
  }

  return { otp_id: row.otp_id, expires_at: expires, canal: 'google_chat' };
}

async function confirmar({ eventoId, otpId, otp, actor }) {
  if (!esAsesor(actor)) throw err('Solo el dueño-asesor confirma OTP', 'FORBIDDEN');

  const row = await SvEventoOtp.findByPk(otpId);
  if (!row || row.otp_evento_id !== eventoId || row.otp_usr_id !== actor.usr_id) {
    throw err('OTP no encontrado', 'NOT_FOUND');
  }
  if (row.otp_consumed_at) throw err('OTP ya consumido o invalidado', 'OTP_CONSUMED');
  if (row.otp_expires_at.getTime() < Date.now()) throw err('OTP expirado', 'OTP_EXPIRED');

  if (row.otp_hash !== sha256(String(otp))) {
    const nuevos = row.otp_intentos + 1;
    const patch = { otp_intentos: nuevos };
    if (nuevos >= MAX_INTENTOS) {
      patch.otp_consumed_at = new Date();
      console.log(JSON.stringify({ tag: 'OTP_FAILED_MAX', evento_id: eventoId, otp_id: otpId }));
    }
    await row.update(patch);
    throw err('Código inválido', 'OTP_INVALID');
  }

  // Aplicar el cambio usando el service normal, con actor efectivo = jefe virtual
  // (rol SUPER_ADMIN pasa el guard esAsesor sin ampliar permisos porque el snapshot
  //  ya fue validado en solicitar y el evento sigue siendo del mismo dueño).
  const jefeVirtual = { ...actor, rol: { rol_codigo: ROLES.SUPER_ADMIN } };
  const t0 = Date.now();
  const eventoAct = await eventosAgenda.actualizar(eventoId, row.otp_payload_json || {}, jefeVirtual);
  await row.update({ otp_consumed_at: new Date() });

  console.log(JSON.stringify({
    tag: 'OTP_CONFIRMED',
    evento_id: eventoId,
    otp_id: otpId,
    latencia_solicitud_confirmar_s: Math.round((Date.now() - row.otp_created_at.getTime()) / 1000)
  }));

  return eventoAct;
}

async function cleanupVencidos() {
  const limite = new Date(Date.now() - 24 * 3600 * 1000);
  const n = await SvEventoOtp.destroy({ where: { otp_expires_at: { [Op.lt]: limite } } });
  if (n) console.log(JSON.stringify({ tag: 'OTP_CLEANUP', borrados: n }));
  return n;
}

module.exports = { solicitar, confirmar, cleanupVencidos };
```

- [ ] **Step 4: Correr test — debe pasar**

```bash
cd mantix-backend && npx jest tests/eventoOtp.service.test.js
```

Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add mantix-backend/src/sv/services/eventoOtp.service.js mantix-backend/tests/eventoOtp.service.test.js
git commit -m "feat(sp3): service eventoOtp solicitar/confirmar/cleanup"
```

---

### Task 5: Controller + rutas OTP

**Files:**
- Modify: `mantix-backend/src/sv/controllers/agenda.controller.js` (agregar `solicitarOtpEvento`, `confirmarOtpEvento`)
- Modify: `mantix-backend/src/sv/routes/agenda.routes.js` (2 rutas nuevas)

**Interfaces:**
- Consumes: `eventoOtp.solicitar/confirmar` (Task 4), `validate` middleware, validaciones (Task 2).
- Produces: `POST /api/sv/eventos-agenda/:id/otp/solicitar` (200 con `{otp_id, expires_at, canal}`), `POST /api/sv/eventos-agenda/:id/otp/confirmar` (200 con evento actualizado).

- [ ] **Step 1: Agregar controllers**

Al final de la sección "SP-1a" en `mantix-backend/src/sv/controllers/agenda.controller.js`, antes del `module.exports`, insertar:

```js
// ─────────────────────────────────────────────────────────
// SP-3 · OTP para edición del dueño
// ─────────────────────────────────────────────────────────
const eventoOtp = require('../services/eventoOtp.service');

async function solicitarOtpEvento(req, res) {
  try {
    const r = await eventoOtp.solicitar({
      eventoId: parseInt(req.params.id),
      cambios:  req.body.cambios,
      actor:    req.user
    });
    return ok(res, r);
  } catch (e) {
    if (e.code === 'RATE_LIMIT')  return fail(res, 429, ERROR_CODES.RATE_LIMIT || 'RATE_LIMIT', e.message);
    if (e.code === 'GCHAT_FAIL')  return fail(res, 503, 'GCHAT_FAIL',  e.message);
    return manejarError(res, e);
  }
}

async function confirmarOtpEvento(req, res) {
  try {
    const r = await eventoOtp.confirmar({
      eventoId: parseInt(req.params.id),
      otpId:    parseInt(req.body.otp_id),
      otp:      String(req.body.otp),
      actor:    req.user
    });
    return ok(res, r);
  } catch (e) {
    if (e.code === 'OTP_EXPIRED')  return fail(res, 410, 'OTP_EXPIRED',  e.message);
    if (e.code === 'OTP_CONSUMED') return fail(res, 409, 'OTP_CONSUMED', e.message);
    if (e.code === 'OTP_INVALID')  return fail(res, 401, 'OTP_INVALID',  e.message);
    return manejarError(res, e);
  }
}
```

Agregar al `module.exports`:

```js
  solicitarOtpEvento, confirmarOtpEvento,
```

- [ ] **Step 2: Agregar rutas**

En `mantix-backend/src/sv/routes/agenda.routes.js`, tras las rutas de pool, agregar:

```js
const vOtp = require('../validations/eventoOtp.validation');

// SP-3 · OTP para edición del dueño
router.post('/eventos-agenda/:id/otp/solicitar', validate(vOtp.solicitarOtp), c.solicitarOtpEvento);
router.post('/eventos-agenda/:id/otp/confirmar', validate(vOtp.confirmarOtp), c.confirmarOtpEvento);
```

- [ ] **Step 3: Verificar arranque local**

```bash
cd mantix-backend && node -e "require('./src/sv/routes/agenda.routes')" && echo OK
```

Expected: `OK` sin errores de sintaxis.

- [ ] **Step 4: Commit**

```bash
git add mantix-backend/src/sv/controllers/agenda.controller.js mantix-backend/src/sv/routes/agenda.routes.js
git commit -m "feat(sp3): rutas POST /eventos-agenda/:id/otp/{solicitar,confirmar}"
```

---

### Task 6: Job otpCleanup

**Files:**
- Create: `mantix-backend/src/sv/jobs/otpCleanup.job.js`
- Modify: `mantix-backend/server.js` (arrancar el job)

**Interfaces:**
- Consumes: `eventoOtp.cleanupVencidos` (Task 4), `node-cron`.
- Produces: cron cada hora (`0 * * * *`) que borra OTPs con `expires_at < NOW() - 24h`.

- [ ] **Step 1: Implementar job**

Crear `mantix-backend/src/sv/jobs/otpCleanup.job.js`:

```js
/**
 * sv/jobs/otpCleanup.job.js — SP-3
 * Cada hora borra OTPs cuya expiración pasó hace más de 24h.
 */
const cron = require('node-cron');
const eventoOtp = require('../services/eventoOtp.service');

let task;

function start() {
  if (task) return;
  task = cron.schedule('0 * * * *', async () => {
    try {
      await eventoOtp.cleanupVencidos();
    } catch (e) {
      console.error('[otpCleanup] error:', e.message);
    }
  }, { timezone: 'America/Bogota' });
  console.log('[otpCleanup] cron iniciado (0 * * * *, America/Bogota)');
}

module.exports = { start };
```

- [ ] **Step 2: Arrancar en server.js**

En `mantix-backend/server.js`, tras la línea de `renovaciones.job`:

```js
    require('./src/sv/jobs/otpCleanup.job').start();
```

- [ ] **Step 3: Verificar carga**

```bash
cd mantix-backend && node -e "require('./src/sv/jobs/otpCleanup.job').start()"
```

Expected: imprime `[otpCleanup] cron iniciado ...`.

- [ ] **Step 4: Commit**

```bash
git add mantix-backend/src/sv/jobs/otpCleanup.job.js mantix-backend/server.js
git commit -m "feat(sp3): job otpCleanup cada hora + arranque"
```

---

### Task 7: Frontend agendaApi.otp

**Files:**
- Modify: `crm-frontend/src/api/agendaApi.js` (2 helpers)

**Interfaces:**
- Produces: `eventosAgendaApi.otpSolicitar(id, cambios) → { otp_id, expires_at, canal }` y `eventosAgendaApi.otpConfirmar(id, { otp_id, otp }) → evento`.

- [ ] **Step 1: Agregar helpers**

En `crm-frontend/src/api/agendaApi.js`, dentro del objeto `eventosAgendaApi`, después del `update`:

```js
  otpSolicitar:  (id, cambios)        => api.post(`/eventos-agenda/${id}/otp/solicitar`, { cambios }).then(r => r.data),
  otpConfirmar:  (id, otp_id, otp)    => api.post(`/eventos-agenda/${id}/otp/confirmar`, { otp_id, otp }).then(r => r.data),
```

- [ ] **Step 2: Verificar build**

```bash
cd crm-frontend && npm run build 2>&1 | tail -5
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add crm-frontend/src/api/agendaApi.js
git commit -m "feat(sp3): agendaApi.otpSolicitar + otpConfirmar"
```

---

### Task 8: OtpConfirmarModal + EditarEventoModal + integración

**Files:**
- Create: `crm-frontend/src/components/eventos/OtpConfirmarModal.vue`
- Create: `crm-frontend/src/components/eventos/EditarEventoModal.vue`
- Modify: `crm-frontend/src/views/comun/EventoDetalleView.vue` (botón Editar + wiring)
- Create: `crm-frontend/tests/components/OtpConfirmarModal.spec.js`

**Interfaces:**
- Consumes: `eventosAgendaApi.otpSolicitar/otpConfirmar` (Task 7), `useAuthStore` (para saber si el actor es dueño-asesor), `useToastStore`.
- Produces:
  - `OtpConfirmarModal.vue` props: `{ open, otpId, expiresAt, evento, cambios }`, emits: `close`, `confirmado(evento)`, `reenviar`.
  - `EditarEventoModal.vue` props: `{ open, evento }`, emits: `close`, `guardado(evento)` (para jefes: aplica PUT directo; para dueño-asesor: dispara OTP flow via slot chained to OtpConfirmarModal).

- [ ] **Step 1: Escribir test primero (modal OTP)**

Crear `crm-frontend/tests/components/OtpConfirmarModal.spec.js`:

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OtpConfirmarModal from '@/components/eventos/OtpConfirmarModal.vue';

vi.mock('@/api/agendaApi', () => ({
  eventosAgendaApi: {
    otpConfirmar: vi.fn(),
    otpSolicitar: vi.fn()
  }
}));
import { eventosAgendaApi } from '@/api/agendaApi';

function mkProps(over = {}) {
  return {
    open: true,
    otpId: 7,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    evento: { evento_id: 5, evento_titulo: 'T' },
    cambios: { titulo: 'Editado' },
    ...over
  };
}

describe('OtpConfirmarModal', () => {
  beforeEach(() => vi.resetAllMocks());

  it('renderiza 6 inputs numéricos', () => {
    const w = mount(OtpConfirmarModal, {
      props: mkProps(),
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })] }
    });
    expect(w.findAll('input[inputmode="numeric"]')).toHaveLength(6);
  });

  it('botón Confirmar deshabilitado hasta llenar 6 dígitos', async () => {
    const w = mount(OtpConfirmarModal, {
      props: mkProps(),
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })] }
    });
    const btn = w.find('[data-testid="btn-otp-confirmar"]');
    expect(btn.attributes('disabled')).toBeDefined();
    const inputs = w.findAll('input[inputmode="numeric"]');
    for (let i = 0; i < 6; i++) {
      await inputs[i].setValue(String(i));
    }
    expect(btn.attributes('disabled')).toBeUndefined();
  });

  it('confirmar llama a otpConfirmar con código concatenado y emite confirmado', async () => {
    eventosAgendaApi.otpConfirmar.mockResolvedValue({ evento_id: 5, evento_titulo: 'Editado' });
    const w = mount(OtpConfirmarModal, {
      props: mkProps(),
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })] }
    });
    const inputs = w.findAll('input[inputmode="numeric"]');
    const codigo = ['4','9','3','7','1','2'];
    for (let i = 0; i < 6; i++) await inputs[i].setValue(codigo[i]);
    await w.find('[data-testid="btn-otp-confirmar"]').trigger('click');
    await flushPromises();
    expect(eventosAgendaApi.otpConfirmar).toHaveBeenCalledWith(5, 7, '493712');
    expect(w.emitted('confirmado')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr test — debe fallar**

```bash
cd crm-frontend && npx vitest run tests/components/OtpConfirmarModal.spec.js
```

Expected: FAIL (componente no existe).

- [ ] **Step 3: Implementar OtpConfirmarModal.vue**

Crear `crm-frontend/src/components/eventos/OtpConfirmarModal.vue`:

```vue
<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
        <h2 class="text-lg font-bold text-text1 mb-1">Confirma con el OTP</h2>
        <p class="text-sm text-text3 mb-1">
          Se envió un código de 6 dígitos al chat de tu jefe. Pídeselo para confirmar los cambios.
        </p>
        <p class="text-xs" :class="expirado ? 'text-red-600' : 'text-text3'">
          Vence en <span class="font-mono">{{ mmss }}</span>
        </p>

        <div class="flex justify-center gap-2 my-4">
          <input v-for="(_, i) in 6" :key="i"
                 :ref="el => refs[i] = el"
                 v-model="digitos[i]"
                 inputmode="numeric" maxlength="1"
                 class="w-10 h-12 text-center text-xl border border-gray-300 rounded font-mono focus:border-primary focus:outline-none"
                 @input="onInput(i, $event)"
                 @keydown.delete="onDelete(i, $event)"
                 @paste="onPaste($event)" />
        </div>

        <div v-if="mensajeError" class="text-sm text-red-600 mb-2 text-center">{{ mensajeError }}</div>

        <div class="flex gap-2 justify-end">
          <button type="button" class="text-xs px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  @click="cerrar">
            Cancelar
          </button>
          <button type="button"
                  :disabled="segundosReenviar > 0 || solicitando"
                  class="text-xs px-3 py-2 border border-primary text-primary rounded disabled:opacity-50"
                  @click="reenviar">
            {{ segundosReenviar > 0 ? `Reenviar (${segundosReenviar}s)` : 'Reenviar' }}
          </button>
          <button type="button"
                  data-testid="btn-otp-confirmar"
                  :disabled="codigo.length !== 6 || confirmando || expirado"
                  class="text-xs px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white rounded"
                  @click="confirmar">
            {{ confirmando ? '…' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({
  open:      { type: Boolean, default: false },
  otpId:     { type: Number, required: true },
  expiresAt: { type: [String, Date], required: true },
  evento:    { type: Object, required: true },
  cambios:   { type: Object, required: true }
});
const emit = defineEmits(['close', 'confirmado', 'reenviado']);
const toast = useToastStore();

const digitos = reactive(['','','','','','']);
const refs = reactive([]);
const codigo = computed(() => digitos.join(''));
const confirmando = ref(false);
const solicitando = ref(false);
const mensajeError = ref('');
const segundosReenviar = ref(30);
const segundosRestantes = ref(0);
let timerReenv, timerExp;

const expirado = computed(() => segundosRestantes.value <= 0);
const mmss = computed(() => {
  const s = Math.max(0, segundosRestantes.value);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
});

function onInput(i, e) {
  digitos[i] = String(digitos[i] || '').replace(/\D/g, '').slice(0, 1);
  if (digitos[i] && i < 5) nextTick(() => refs[i+1]?.focus());
}
function onDelete(i, e) {
  if (!digitos[i] && i > 0) nextTick(() => refs[i-1]?.focus());
}
function onPaste(e) {
  const txt = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
  if (!txt) return;
  e.preventDefault();
  for (let i = 0; i < 6; i++) digitos[i] = txt[i] || '';
  nextTick(() => refs[Math.min(5, txt.length)]?.focus());
}

async function confirmar() {
  if (codigo.value.length !== 6 || confirmando.value) return;
  confirmando.value = true;
  mensajeError.value = '';
  try {
    const evento = await eventosAgendaApi.otpConfirmar(props.evento.evento_id, props.otpId, codigo.value);
    toast.success('Cambios aplicados');
    emit('confirmado', evento);
  } catch (e) {
    const st = e.response?.status;
    if (st === 401) mensajeError.value = 'Código incorrecto. Verifica con tu jefe.';
    else if (st === 410) mensajeError.value = 'El OTP expiró. Solicita uno nuevo.';
    else if (st === 409) mensajeError.value = 'El OTP ya fue consumido.';
    else mensajeError.value = e.response?.data?.error?.message || 'No se pudo confirmar';
    for (let i = 0; i < 6; i++) digitos[i] = '';
    nextTick(() => refs[0]?.focus());
  } finally {
    confirmando.value = false;
  }
}

async function reenviar() {
  if (segundosReenviar.value > 0 || solicitando.value) return;
  solicitando.value = true;
  try {
    const r = await eventosAgendaApi.otpSolicitar(props.evento.evento_id, props.cambios);
    emit('reenviado', r);
    toast.info('Nuevo código enviado a Google Chat');
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo reenviar');
  } finally {
    solicitando.value = false;
    iniciarReenv();
  }
}

function iniciarReenv() {
  segundosReenviar.value = 30;
  clearInterval(timerReenv);
  timerReenv = setInterval(() => {
    if (--segundosReenviar.value <= 0) clearInterval(timerReenv);
  }, 1000);
}

function iniciarExp() {
  const target = new Date(props.expiresAt).getTime();
  const tick = () => {
    segundosRestantes.value = Math.max(0, Math.round((target - Date.now()) / 1000));
    if (segundosRestantes.value <= 0) clearInterval(timerExp);
  };
  tick();
  clearInterval(timerExp);
  timerExp = setInterval(tick, 1000);
}

function cerrar() {
  clearInterval(timerReenv);
  clearInterval(timerExp);
  emit('close');
}

watch(() => props.open, (v) => {
  if (v) {
    for (let i = 0; i < 6; i++) digitos[i] = '';
    mensajeError.value = '';
    iniciarReenv();
    iniciarExp();
    nextTick(() => refs[0]?.focus());
  } else {
    clearInterval(timerReenv);
    clearInterval(timerExp);
  }
}, { immediate: true });

onBeforeUnmount(() => {
  clearInterval(timerReenv);
  clearInterval(timerExp);
});
</script>
```

- [ ] **Step 4: Correr test — debe pasar**

```bash
cd crm-frontend && npx vitest run tests/components/OtpConfirmarModal.spec.js
```

Expected: PASS (3/3).

- [ ] **Step 5: Implementar EditarEventoModal.vue**

Crear `crm-frontend/src/components/eventos/EditarEventoModal.vue`:

```vue
<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5">
        <h2 class="text-lg font-bold text-text1 mb-3">Editar evento</h2>

        <div class="space-y-3">
          <label class="block text-xs text-text3">
            Título
            <input v-model="form.titulo" type="text"
                   class="mt-1 w-full text-sm px-3 py-2 border border-gray-300 rounded" />
          </label>
          <label class="block text-xs text-text3">
            Descripción
            <textarea v-model="form.descripcion" rows="3"
                      class="mt-1 w-full text-sm px-3 py-2 border border-gray-300 rounded"></textarea>
          </label>
          <label class="block text-xs text-text3">
            Meta leads
            <input v-model.number="form.meta_leads" type="number" min="0"
                   class="mt-1 w-full text-sm px-3 py-2 border border-gray-300 rounded" />
          </label>
        </div>

        <p v-if="requiereOtp" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
          Como eres el dueño del evento, al guardar se te pedirá un OTP enviado a tu jefe por Google Chat.
        </p>

        <div class="flex gap-2 justify-end mt-4">
          <button type="button" class="text-xs px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  @click="cerrar">
            Cancelar
          </button>
          <button type="button"
                  :disabled="guardando"
                  class="text-xs px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white rounded"
                  @click="guardar">
            {{ guardando ? '…' : (requiereOtp ? 'Solicitar OTP' : 'Guardar') }}
          </button>
        </div>
      </div>
    </div>

    <OtpConfirmarModal v-if="otp.open"
                       :open="otp.open"
                       :otp-id="otp.id"
                       :expires-at="otp.expiresAt"
                       :evento="evento"
                       :cambios="cambiosPendientes"
                       @close="otp.open = false"
                       @confirmado="onOtpConfirmado" />
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import OtpConfirmarModal from './OtpConfirmarModal.vue';

const props = defineProps({
  open:   { type: Boolean, default: false },
  evento: { type: Object, required: true }
});
const emit = defineEmits(['close', 'guardado']);

const auth = useAuthStore();
const toast = useToastStore();

const ROLES_SUPERVISORES = new Set([
  'SUPER_ADMIN','GERENTE_GENERAL','DIRECTOR_COMERCIAL','ADMIN_AREA',
  'COORDINADOR_PREVISION','JEFE_PAP','SUPERVISOR'
]);
const rolCodigo = computed(() => auth.user?.rol?.rol_codigo);
const esSupervisor = computed(() => ROLES_SUPERVISORES.has(rolCodigo.value));
const esDueño = computed(() => auth.user?.usr_id === props.evento?.evento_asesor_id);
const requiereOtp = computed(() => !esSupervisor.value && esDueño.value);

const form = reactive({ titulo: '', descripcion: '', meta_leads: null });
const guardando = ref(false);
const cambiosPendientes = ref({});
const otp = reactive({ open: false, id: null, expiresAt: null });

watch(() => props.open, (v) => {
  if (v) {
    form.titulo      = props.evento.evento_titulo || '';
    form.descripcion = props.evento.evento_descripcion || '';
    form.meta_leads  = props.evento.evento_meta_leads || null;
  }
}, { immediate: true });

function diff() {
  const d = {};
  if (form.titulo !== props.evento.evento_titulo) d.titulo = form.titulo;
  if ((form.descripcion || null) !== (props.evento.evento_descripcion || null)) d.descripcion = form.descripcion || null;
  if ((form.meta_leads || null) !== (props.evento.evento_meta_leads || null)) d.meta_leads = form.meta_leads || null;
  return d;
}

async function guardar() {
  const cambios = diff();
  if (!Object.keys(cambios).length) {
    toast.info('No hay cambios');
    return;
  }
  guardando.value = true;
  try {
    if (requiereOtp.value) {
      const r = await eventosAgendaApi.otpSolicitar(props.evento.evento_id, cambios);
      cambiosPendientes.value = cambios;
      otp.id = r.otp_id;
      otp.expiresAt = r.expires_at;
      otp.open = true;
    } else {
      const ev = await eventosAgendaApi.update(props.evento.evento_id, cambios);
      toast.success('Evento actualizado');
      emit('guardado', ev);
      emit('close');
    }
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo guardar');
  } finally {
    guardando.value = false;
  }
}

function onOtpConfirmado(ev) {
  otp.open = false;
  emit('guardado', ev);
  emit('close');
}

function cerrar() {
  if (guardando.value) return;
  emit('close');
}
</script>
```

- [ ] **Step 6: Integrar en EventoDetalleView.vue**

En `crm-frontend/src/views/comun/EventoDetalleView.vue`:

Después de `import EventoLinkPublicoShare ...`, agregar:

```js
import EditarEventoModal from '@/components/eventos/EditarEventoModal.vue';
```

Después de `const tab = ref('asistentes');`, agregar:

```js
const editar = ref(false);
```

En el header, reemplazar el bloque de botones (`<div class="flex gap-1 flex-shrink-0">...</div>`) por:

```vue
          <div class="flex gap-1 flex-shrink-0">
            <button type="button"
                    class="text-xs px-3 py-1.5 bg-primary hover:opacity-90 text-white rounded"
                    @click="editar = true">
              Editar
            </button>
            <RouterLink :to="{ name: 'agenda' }" class="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
              Volver
            </RouterLink>
          </div>
```

Al final del template, antes de `</template>`, agregar:

```vue
    <EditarEventoModal v-if="evento" :open="editar" :evento="evento"
                       @close="editar = false" @guardado="cargar" />
```

- [ ] **Step 7: Build + verificar**

```bash
cd crm-frontend && npm run build 2>&1 | tail -5
```

Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add crm-frontend/src/components/eventos/OtpConfirmarModal.vue \
        crm-frontend/src/components/eventos/EditarEventoModal.vue \
        crm-frontend/src/views/comun/EventoDetalleView.vue \
        crm-frontend/tests/components/OtpConfirmarModal.spec.js
git commit -m "feat(sp3): OtpConfirmarModal + EditarEventoModal + botón Editar"
```

---

### Task 9: Deploy backend + rsync frontend + smoke

**Files:** ninguno (deploy/verificación).

- [ ] **Step 1: Configurar `GCHAT_WEBHOOK_EVENTOS` en `.env` de prod (el usuario)**

Pedir al usuario que agregue en `mantix-backend/.env` del servidor:

```
GCHAT_WEBHOOK_EVENTOS=https://chat.googleapis.com/v1/spaces/AAQAxxxxxx/messages?key=...&token=...
OTP_EXPIRACION_MIN=10
OTP_MAX_ACTIVOS_POR_USR_EVENTO=3
OTP_MAX_INTENTOS=3
```

- [ ] **Step 2: Correr migración 021 en prod**

```bash
mysql -u root -p serfuweb < mantix-backend/src/sv/migrations/021_evento_otps.sql
```

- [ ] **Step 3: Push + deploy backend**

```bash
git push origin main
deploy-mantix
```

- [ ] **Step 4: Rsync frontend**

```bash
cd crm-frontend
npm run build
rsync -av --delete dist/ /Volumes/AppServ/www/genflow/
```

Verificar que hay igual número de assets en local y en el server.

- [ ] **Step 5: Smoke test**

Con un usuario ASESOR dueño de un evento en producción:
1. Ir a `/agenda`, entrar al evento.
2. Click "Editar" → cambiar título → "Solicitar OTP".
3. Verificar que llega mensaje al espacio de Google Chat con el código de 6 dígitos.
4. Introducir el código en el modal → confirmar → toast "Cambios aplicados" → header muestra título nuevo.
5. Con usuario COORDINADOR: entrar al mismo evento → "Editar" → guardar sin OTP (PUT directo).

- [ ] **Step 6: Marcar task completo + ledger**

Sin commit adicional (deploy no cambia código); actualizar la lista de tareas.

---

## Self-review

- Spec coverage: §4.3 (tabla) → Task 1 ✅; §5.3 (endpoints) → Tasks 4-5 ✅; §6.3 (UI OTP) → Task 8 ✅; §8.3 (edge cases: gchat cae, expiración, 3 intentos) → Tasks 4/8 ✅; §9.1 (tests) → Tasks 2/3/4 ✅; §10 (logs OTP_SENT/CONFIRMED/EXPIRED/FAILED_MAX + GCHAT_ERROR) → Tasks 3/4 ✅; §10 cron cleanup → Task 6 ✅; §11 (env vars) → Task 9 ✅.
- Placeholders: ninguno; todo el código está inline.
- Type consistency: `otpSolicitar/otpConfirmar` (Task 7) casan con endpoints (Task 5) y con las claves que consume `OtpConfirmarModal` (Task 8). `cambios` viaja como objeto plano en toda la cadena.
- Alcance: SP-3 sin bleed a SP-1/SP-2/SP-4. No se toca el guard `esAsesor` de `eventos.actualizar` — el flujo OTP usa "jefe virtual" (comentado en Task 4).
