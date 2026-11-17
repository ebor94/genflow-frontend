# Login único contra el directorio activo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `POST /api/identidad/login` (puerta de GenFlow y del Portal) valide únicamente contra el directorio activo y retirar todas las claves locales de GenFlow.

**Architecture:** `identidad.service.login` resuelve la cuenta del AD (usuario de red o correo → `org_identidad.ad_usuario`), valida con `h360/services/ldap.service.validarCredenciales` y emite los mismos tokens de hoy. Un servicio `vinculoAd` crea/vincula identidades; lo usan el login (vinculación automática por `mail`), el script `vincular-ad.js` y el alta de usuarios en GenFlow. Se eliminan los endpoints de clave local del SSO y del módulo de ventas, y las pantallas de cambio de clave de GenFlow y del Portal.

**Tech Stack:** Express 4 + Sequelize 6 + MySQL 8 + ldapjs (vía `ldap.service`) + express-rate-limit 7 + Jest/supertest (backend `mantix-backend`); Vue 3 + Pinia + Vitest + @vue/test-utils (`crm-frontend`); Vue 3 + Pinia sin tests (`portal-frontend`).

**Spec:** `crm-frontend/docs/superpowers/specs/2026-11-17-login-unico-directorio-activo-design.md`

## Global Constraints

- Repos y rutas absolutas:
  - Backend: `/Users/bortega/Shared/Files From c.localized/apps/mantix/mantix-backend` (rama `main`)
  - GenFlow: `/Users/bortega/Shared/Files From c.localized/apps/mantix/crm-frontend` (rama `main`)
  - Portal: `/Users/bortega/Shared/Files From c.localized/apps/mantix/portal-frontend` (rama `main`, sin remoto)
- **No hacer `git push` en ninguna task salvo la Task 11.** Los commits quedan locales hasta el despliegue coordinado.
- **No modificar `mantix-backend/src/h360/services/ldap.service.js`.** Se importa tal cual.
- Tests del backend: **nunca** contra el AD real ni la base real; `sequelize.sync` está prohibido (la única base configurada es la de producción compartida). Todo con `jest.mock`.
- Nunca loguear la clave. `ad_usuario` en logs pasa por `usuarioParaLog` (`/^[a-z0-9._-]{1,64}$/i`, si no `'[formato no válido]'`).
- `ad_usuario` se guarda siempre en minúsculas, sin `DOMINIO\` ni `@dominio`.
- El body de `POST /api/identidad/login` acepta `usuario` y, por compatibilidad, `email` (`usuario ?? email`).
- Mensajes al usuario, textuales:
  - `'Usuario o contraseña incorrectos'`
  - `'Inicia sesión con tu usuario de red (el de Windows).'`
  - `'No hay conexión con el directorio activo, intenta en unos minutos.'`
  - `'Tu usuario de red no tiene acceso a GenFlow.'`
  - `'Usuario inactivo'`
  - `'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.'`
  - `'Usuario y contraseña son requeridos'`
- HTTP del login: `VALIDATION_ERROR` 422, `CREDENCIALES_INVALIDAS` 401, `NO_VINCULADO` 401, `SIN_ACCESO` 403, `USER_INACTIVE` 403, `AD_NO_DISPONIBLE` 503, límite 429.
- Límite de login: por usuario **5 fallos / 15 min** (independiente de la IP), por IP **100 fallos / 15 min**; solo cuentan respuestas 401.
- Buscador del directorio: mínimo **3** caracteres, máximo **20** resultados, caché en memoria de **10 minutos**.
- Copy de pantallas: etiqueta `Usuario de red o correo`, placeholder `psantafe`, `autocomplete="username"`, ayuda `Usa el mismo usuario y clave de Windows`; Mi perfil: `Usuario de red` + `La clave se cambia en Windows o con TI.`
- Attribution de commits: cada subagente firma con su propio modelo (`Co-Authored-By: Claude <Modelo> <noreply@anthropic.com>`).

## File Structure

**Backend (`mantix-backend`)**

| Archivo | Responsabilidad |
|---|---|
| `src/sv/migrations/022_identidad_ad.sql` (nuevo) | Columna `ad_usuario` + índice único; claves NULL-able |
| `src/identity/models/Identidad.js` | + `ad_usuario`; `password_hash` NULL-able |
| `src/sv/models/Usuario.js` | + `usr_id_identidad`; `usr_password_hash` NULL-able; sin scope `withPassword` (Task 7) |
| `src/identity/services/vinculoAd.service.js` (nuevo) | `normalizarAdUsuario`, `asegurarIdentidad`, `vincularAdUsuario`, `VinculoAdError` |
| `src/identity/services/identidad.service.js` | Login contra AD; sin `cambiarPassword` ni `must_reset` |
| `src/identity/controllers/auth.controller.js` | Mapeo de códigos; sin `cambiarPassword` |
| `src/identity/middleware/limitadoresLogin.js` (nuevo) | `crearLimitadoresLogin`, `claveUsuario` |
| `src/identity/routes/index.js` | Limitadores en `/login`; sin `/cambiar-password` |
| `src/identity/services/proponerVinculosAd.js` (nuevo) | Función pura de emparejamiento |
| `src/identity/scripts/vincular-ad.js` (nuevo) | Script simulación / `--aplicar` |
| `src/sv/services/directorioAd.service.js` (nuevo) | Búsqueda en el AD con caché |
| `src/sv/services/usuariosAd.service.js` (nuevo) | `resolverIdentidad`, `adUsuariosPorIdentidad`, `UsuarioAdError` |
| `src/sv/controllers/usuarios.controller.js` | Alta/edición con `ad_usuario`, `directorio`; sin `resetPassword` (Task 7) |
| `src/sv/validations/usuarios.validation.js` | `ad_usuario` en create/update; sin `usr_password` ni `resetPassword` |
| `src/sv/routes/usuarios.routes.js` | `GET /directorio`; sin `reset-password` (Task 7) |
| `src/sv/controllers/auth.controller.js` | Solo `me` (con `ad_usuario`) y `updatePreferencias` (Task 7) |
| `src/sv/routes/auth.routes.js` | Solo `/me` y `/me/preferencias` (Task 7) |
| `src/sv/middleware/svAuth.js` | Solo token de identidad (Task 7) |
| `src/sv/utils/{jwt,password,hashRefresh}.js`, `src/sv/validations/auth.validation.js` | Se eliminan (Task 7) |

**GenFlow (`crm-frontend`)**

| Archivo | Responsabilidad |
|---|---|
| `src/api/authApi.js`, `src/stores/useAuthStore.js` | Login con `{ usuario, password }`; sin `changePassword` |
| `src/views/auth/Login.vue` | Copy de usuario de red |
| `src/views/perfil/MiPerfil.vue` | Muestra usuario de red; sin cambio de clave |
| `src/modules/afiliacion/{views/LoginView.vue,stores/useAuthStore.js,api/authApi.js}` | Se eliminan (código muerto) |
| `src/api/usuariosApi.js` | + `directorio(q)`; sin `resetPassword` |
| `src/utils/nombres.js` (nuevo) | `separarNombre(displayName)` |
| `src/components/admin/BuscadorUsuarioRed.vue` (nuevo) | Buscador sobre el AD |
| `src/views/admin/GestionUsuarios.vue` | Usuario de red en alta/edición; sin reseteo de clave |

**Portal (`portal-frontend`)**: `src/api/identidadApi.js`, `src/stores/useIdentidadStore.js`, `src/views/Login.vue`, `src/router/index.js`; se elimina `src/views/ResetPassword.vue`.

---

### Task 1: Migración 022 + modelos

Repo: `mantix-backend`.

**Files:**
- Create: `src/sv/migrations/022_identidad_ad.sql`
- Modify: `src/identity/models/Identidad.js:5-10`
- Modify: `src/sv/models/Usuario.js:9-14`
- Test: `tests/identidadAd.models.test.js`

**Interfaces:**
- Produces: `OrgIdentidad.ad_usuario` (STRING 64, NULL), `OrgIdentidad.password_hash` NULL-able; `SvUsuario.usr_id_identidad` (INTEGER, NULL), `SvUsuario.usr_password_hash` NULL-able. Tasks 2-7 leen y escriben estos atributos.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/identidadAd.models.test.js`:

```js
const { DataTypes } = require('sequelize');

// Ejecuta la factory del modelo con un sequelize falso y devuelve los atributos,
// sin abrir conexión a la base.
function atributosDe(factory) {
  let attrs = null;
  const fakeSequelize = { define: (_nombre, a) => { attrs = a; return {}; } };
  factory(fakeSequelize, DataTypes);
  return attrs;
}

describe('modelos para login con AD', () => {
  test('OrgIdentidad tiene ad_usuario y password_hash NULL-able', () => {
    const a = atributosDe(require('../src/identity/models/Identidad'));
    expect(a.ad_usuario).toBeDefined();
    expect(a.ad_usuario.type.key).toBe('STRING');
    expect(a.ad_usuario.allowNull).not.toBe(false);
    expect(a.password_hash.allowNull).toBe(true);
  });

  test('SvUsuario tiene usr_id_identidad y usr_password_hash NULL-able', () => {
    const a = atributosDe(require('../src/sv/models/Usuario'));
    expect(a.usr_id_identidad).toBeDefined();
    expect(a.usr_id_identidad.type.key).toBe('INTEGER');
    expect(a.usr_password_hash.allowNull).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest tests/identidadAd.models.test.js`
Expected: FAIL — `expect(received).toBeDefined()` en `ad_usuario` y en `usr_id_identidad`.

- [ ] **Step 3: Crear la migración**

Crear `src/sv/migrations/022_identidad_ad.sql`:

```sql
-- =====================================================================
-- SerVentas CRM — Migración 022: login único contra el directorio activo
--
-- 1) org_identidad.ad_usuario + índice único (vínculo con sAMAccountName).
-- 2) org_identidad.password_hash y sv_org_usuarios.usr_password_hash pasan a
--    NULL: el código deja de usarlas. Los hashes existentes NO se borran
--    (red de reversión); se limpian en un paso posterior.
-- Idempotente.
-- =====================================================================

SET NAMES utf8mb4;

SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'org_identidad'
                  AND COLUMN_NAME  = 'ad_usuario');
SET @sql = IF(@existe = 0,
  'ALTER TABLE org_identidad ADD COLUMN ad_usuario VARCHAR(64) NULL AFTER email_norm',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @existe = (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'org_identidad'
                  AND INDEX_NAME   = 'uq_identidad_ad_usuario');
SET @sql = IF(@existe = 0,
  'ALTER TABLE org_identidad ADD UNIQUE INDEX uq_identidad_ad_usuario (ad_usuario)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

ALTER TABLE org_identidad   MODIFY password_hash     VARCHAR(255) NULL;
ALTER TABLE sv_org_usuarios MODIFY usr_password_hash VARCHAR(255) NULL;
```

- [ ] **Step 4: Actualizar el modelo de identidad**

En `src/identity/models/Identidad.js`, reemplazar:

```js
    email_norm:          { type: DataTypes.STRING(150), allowNull: false, unique: true },
```

por:

```js
    email_norm:          { type: DataTypes.STRING(150), allowNull: false, unique: true },
    ad_usuario:          { type: DataTypes.STRING(64) },
```

y reemplazar:

```js
    password_hash:       { type: DataTypes.STRING(255), allowNull: false },
```

por:

```js
    password_hash:       { type: DataTypes.STRING(255), allowNull: true },
```

- [ ] **Step 5: Actualizar el modelo de usuario de ventas**

En `src/sv/models/Usuario.js`, reemplazar:

```js
    usr_password_hash: { type: DataTypes.STRING(255), allowNull: false },
```

por:

```js
    usr_password_hash: { type: DataTypes.STRING(255), allowNull: true },
    usr_id_identidad:  { type: DataTypes.INTEGER },
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `npx jest tests/identidadAd.models.test.js`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/sv/migrations/022_identidad_ad.sql src/identity/models/Identidad.js src/sv/models/Usuario.js tests/identidadAd.models.test.js
git commit -m "feat(auth): migración 022 y modelos para login con directorio activo"
```

---

### Task 2: Servicio de vínculo con el AD

Repo: `mantix-backend`.

**Files:**
- Create: `src/identity/services/vinculoAd.service.js`
- Test: `tests/vinculoAd.service.test.js`

**Interfaces:**
- Consumes: `OrgIdentidad` de `src/identity/models` (Task 1: atributo `ad_usuario`).
- Produces:
  - `normalizarAdUsuario(raw: any): string` — minúsculas, sin `DOMINIO\` ni `@…`, `''` si vacío.
  - `asegurarIdentidad({ email, nombre, apellido, telefono }): Promise<OrgIdentidad>` — busca por `email_norm`; si no existe la crea con `password_hash: null`.
  - `vincularAdUsuario(identidad, adUsuarioRaw, { permitirCambio = false } = {}): Promise<OrgIdentidad>` — lanza `VinculoAdError` con `code` `'AD_USUARIO_INVALIDO'`, `'AD_USUARIO_TOMADO'` o `'CORREO_CON_OTRO_AD'`.
  - `class VinculoAdError extends Error { code }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/vinculoAd.service.test.js`:

```js
jest.mock('../src/identity/models', () => ({
  OrgIdentidad: { findOne: jest.fn(), create: jest.fn() }
}));

const { OrgIdentidad } = require('../src/identity/models');
const {
  normalizarAdUsuario, asegurarIdentidad, vincularAdUsuario, VinculoAdError
} = require('../src/identity/services/vinculoAd.service');

function identidad(campos) {
  const i = { id_identidad: 1, email_norm: 'p@x.co', ad_usuario: null, ...campos };
  i.update = jest.fn(async (patch) => Object.assign(i, patch));
  return i;
}

beforeEach(() => jest.clearAllMocks());

describe('normalizarAdUsuario', () => {
  test.each([
    ['PSantafe', 'psantafe'],
    ['  psantafe  ', 'psantafe'],
    ['OLIVOS\\PSANTAFE', 'psantafe'],
    ['psantafe@olivos.local', 'psantafe'],
    ['', ''],
    [null, '']
  ])('%p → %p', (entrada, esperado) => {
    expect(normalizarAdUsuario(entrada)).toBe(esperado);
  });
});

describe('asegurarIdentidad', () => {
  test('devuelve la identidad existente por correo normalizado', async () => {
    const existente = identidad({ email_norm: 'ana@x.co' });
    OrgIdentidad.findOne.mockResolvedValue(existente);
    const r = await asegurarIdentidad({ email: ' Ana@X.co ', nombre: 'Ana' });
    expect(OrgIdentidad.findOne).toHaveBeenCalledWith({ where: { email_norm: 'ana@x.co' } });
    expect(r).toBe(existente);
    expect(OrgIdentidad.create).not.toHaveBeenCalled();
  });

  test('crea la identidad sin clave si no existe', async () => {
    OrgIdentidad.findOne.mockResolvedValue(null);
    OrgIdentidad.create.mockImplementation(async (d) => identidad({ id_identidad: 9, ...d }));
    const r = await asegurarIdentidad({ email: 'beto@x.co', nombre: 'Beto', apellido: 'R', telefono: '300' });
    expect(OrgIdentidad.create).toHaveBeenCalledWith({
      email_norm: 'beto@x.co', nombre: 'Beto', apellido: 'R', telefono: '300',
      password_hash: null, activo: 1
    });
    expect(r.id_identidad).toBe(9);
  });
});

describe('vincularAdUsuario', () => {
  test('vincula en minúsculas si la cuenta está libre', async () => {
    const i = identidad();
    OrgIdentidad.findOne.mockResolvedValue(null);
    await vincularAdUsuario(i, 'PSANTAFE');
    expect(OrgIdentidad.findOne).toHaveBeenCalledWith({ where: { ad_usuario: 'psantafe' } });
    expect(i.update).toHaveBeenCalledWith({ ad_usuario: 'psantafe' });
  });

  test('no hace nada si ya está vinculada a esa misma cuenta', async () => {
    const i = identidad({ ad_usuario: 'psantafe' });
    await vincularAdUsuario(i, 'psantafe');
    expect(OrgIdentidad.findOne).not.toHaveBeenCalled();
    expect(i.update).not.toHaveBeenCalled();
  });

  test('AD_USUARIO_TOMADO si otra identidad ya tiene la cuenta', async () => {
    const i = identidad({ id_identidad: 1 });
    OrgIdentidad.findOne.mockResolvedValue({ id_identidad: 2, email_norm: 'otra@x.co' });
    await expect(vincularAdUsuario(i, 'psantafe')).rejects.toMatchObject({
      code: 'AD_USUARIO_TOMADO',
      message: 'El usuario de red psantafe ya está vinculado a otra@x.co.'
    });
    expect(i.update).not.toHaveBeenCalled();
  });

  test('CORREO_CON_OTRO_AD si la identidad ya tiene otra cuenta y no se permite cambio', async () => {
    const i = identidad({ email_norm: 'p@x.co', ad_usuario: 'viejo' });
    OrgIdentidad.findOne.mockResolvedValue(null);
    await expect(vincularAdUsuario(i, 'nuevo')).rejects.toMatchObject({
      code: 'CORREO_CON_OTRO_AD',
      message: 'El correo p@x.co ya está vinculado al usuario de red viejo.'
    });
  });

  test('con permitirCambio reemplaza la cuenta vinculada', async () => {
    const i = identidad({ ad_usuario: 'viejo' });
    OrgIdentidad.findOne.mockResolvedValue(null);
    await vincularAdUsuario(i, 'nuevo', { permitirCambio: true });
    expect(i.update).toHaveBeenCalledWith({ ad_usuario: 'nuevo' });
  });

  test('AD_USUARIO_INVALIDO si llega vacío', async () => {
    await expect(vincularAdUsuario(identidad(), '  ')).rejects.toBeInstanceOf(VinculoAdError);
    await expect(vincularAdUsuario(identidad(), '  ')).rejects.toMatchObject({ code: 'AD_USUARIO_INVALIDO' });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest tests/vinculoAd.service.test.js`
Expected: FAIL — `Cannot find module '../src/identity/services/vinculoAd.service'`.

- [ ] **Step 3: Implementar el servicio**

Crear `src/identity/services/vinculoAd.service.js`:

```js
/**
 * identity/services/vinculoAd.service.js
 * Crea identidades y las vincula con su cuenta del directorio activo
 * (org_identidad.ad_usuario = sAMAccountName en minúsculas).
 * Lo usan el login (vinculación automática), el script vincular-ad.js y el
 * alta/edición de usuarios de GenFlow.
 */
const { OrgIdentidad } = require('../models');

class VinculoAdError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function normalizarAdUsuario(raw) {
  let u = String(raw ?? '').trim().toLowerCase();
  if (u.includes('\\')) u = u.split('\\').pop();
  if (u.includes('@')) u = u.split('@')[0];
  return u.trim();
}

async function asegurarIdentidad({ email, nombre, apellido, telefono }) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const existente = await OrgIdentidad.findOne({ where: { email_norm: emailNorm } });
  if (existente) return existente;
  return OrgIdentidad.create({
    email_norm:    emailNorm,
    nombre:        nombre || null,
    apellido:      apellido || null,
    telefono:      telefono || null,
    password_hash: null,
    activo:        1
  });
}

async function vincularAdUsuario(identidad, adUsuarioRaw, { permitirCambio = false } = {}) {
  const ad = normalizarAdUsuario(adUsuarioRaw);
  if (!ad) throw new VinculoAdError('AD_USUARIO_INVALIDO', 'El usuario de red es requerido.');
  if (identidad.ad_usuario === ad) return identidad;

  const otra = await OrgIdentidad.findOne({ where: { ad_usuario: ad } });
  if (otra && otra.id_identidad !== identidad.id_identidad) {
    throw new VinculoAdError('AD_USUARIO_TOMADO',
      `El usuario de red ${ad} ya está vinculado a ${otra.email_norm}.`);
  }
  if (identidad.ad_usuario && !permitirCambio) {
    throw new VinculoAdError('CORREO_CON_OTRO_AD',
      `El correo ${identidad.email_norm} ya está vinculado al usuario de red ${identidad.ad_usuario}.`);
  }
  await identidad.update({ ad_usuario: ad });
  return identidad;
}

module.exports = { normalizarAdUsuario, asegurarIdentidad, vincularAdUsuario, VinculoAdError };
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest tests/vinculoAd.service.test.js`
Expected: PASS (todos los tests).

- [ ] **Step 5: Commit**

```bash
git add src/identity/services/vinculoAd.service.js tests/vinculoAd.service.test.js
git commit -m "feat(auth): servicio de vínculo identidad ↔ cuenta del directorio activo"
```

---

### Task 3: Login de identidad contra el AD

Repo: `mantix-backend`.

**Files:**
- Modify: `src/identity/services/identidad.service.js` (reescritura completa)
- Test: `tests/identidadLoginAd.service.test.js`

**Interfaces:**
- Consumes: `ldap.validarCredenciales(sam, password) → { usuario, nombre, email, memberOf }`, errores con `codigo` `'CREDENCIALES_INVALIDAS'` | `'AD_NO_DISPONIBLE'`; `normalizarAdUsuario`, `vincularAdUsuario` (Task 2).
- Produces: `login({ usuario, password, ua, ip }) → { accessToken, refreshToken, identidad }` (sin `must_reset`); `IdentidadError.code` ∈ `VALIDATION_ERROR | CREDENCIALES_INVALIDAS | NO_VINCULADO | SIN_ACCESO | USER_INACTIVE | AD_NO_DISPONIBLE`. `publicIdentidad(i)` incluye `ad_usuario` y ya no incluye `must_reset`. Se elimina `cambiarPassword` (el controller lo deja de usar en la Task 4).

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/identidadLoginAd.service.test.js`:

```js
jest.mock('../src/identity/models', () => ({
  sequelize:     { query: jest.fn() },
  OrgIdentidad:  { findOne: jest.fn(), findByPk: jest.fn() },
  OrgSesion:     { create: jest.fn(), findOne: jest.fn(), destroy: jest.fn() },
  OrgAplicacion: { findAll: jest.fn() }
}));
jest.mock('../src/identity/config/jwt', () => ({
  signAccess:  jest.fn(() => 'access-token'),
  signRefresh: jest.fn(() => 'refresh-token'),
  verifyRefresh: jest.fn()
}));
jest.mock('../src/h360/services/ldap.service', () => ({ validarCredenciales: jest.fn() }));
jest.mock('../src/identity/services/vinculoAd.service', () => {
  const real = jest.requireActual('../src/identity/services/vinculoAd.service');
  return { ...real, vincularAdUsuario: jest.fn(async (i, ad) => Object.assign(i, { ad_usuario: ad })) };
});

const { OrgIdentidad, OrgSesion } = require('../src/identity/models');
const ldap = require('../src/h360/services/ldap.service');
const { vincularAdUsuario } = require('../src/identity/services/vinculoAd.service');
const identidadSvc = require('../src/identity/services/identidad.service');

function identidad(campos = {}) {
  const i = {
    id_identidad: 1, email_norm: 'psantafe@losolivos.co', ad_usuario: 'psantafe',
    nombre: 'Patricia', apellido: 'Santafé', telefono: null, activo: 1, ultimo_login: null,
    ...campos
  };
  i.update = jest.fn(async (p) => Object.assign(i, p));
  return i;
}

function errorAd(codigo, message) { const e = new Error(message); e.codigo = codigo; return e; }

// findOne responde según el where que recibe.
function responderFindOne(mapa) {
  OrgIdentidad.findOne.mockImplementation(async ({ where }) => {
    if (where.ad_usuario !== undefined && where.email_norm === undefined) return mapa.porAd?.[where.ad_usuario] ?? null;
    if (where.email_norm !== undefined && where.ad_usuario === null) return mapa.libresPorCorreo?.[where.email_norm] ?? null;
    if (where.email_norm !== undefined) return mapa.porCorreo?.[where.email_norm] ?? null;
    return null;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  OrgSesion.create.mockResolvedValue({});
});
afterEach(() => console.log.mockRestore());

const AD_OK = { usuario: 'PSANTAFE', nombre: 'Patricia Santafé', email: 'psantafe@losolivos.co', memberOf: [] };

describe('identidad.login contra el AD', () => {
  test('usuario de red: valida en el AD y emite tokens', async () => {
    const i = identidad();
    responderFindOne({ porAd: { psantafe: i } });
    ldap.validarCredenciales.mockResolvedValue(AD_OK);

    const r = await identidadSvc.login({ usuario: 'PSantafe', password: 'clave', ua: 'jest', ip: '1.1.1.1' });

    expect(ldap.validarCredenciales).toHaveBeenCalledWith('PSantafe', 'clave');
    expect(r.accessToken).toBe('access-token');
    expect(r.refreshToken).toBe('refresh-token');
    expect(r.identidad).toMatchObject({ id_identidad: 1, ad_usuario: 'psantafe' });
    expect(r).not.toHaveProperty('must_reset');
    expect(r.identidad).not.toHaveProperty('must_reset');
    expect(OrgSesion.create).toHaveBeenCalled();
    expect(i.update).toHaveBeenCalledWith(expect.objectContaining({ ultimo_login: expect.any(Date) }));
  });

  test('correo vinculado: usa el ad_usuario guardado para validar', async () => {
    const i = identidad();
    responderFindOne({ porCorreo: { 'psantafe@losolivos.co': i }, porAd: { psantafe: i } });
    ldap.validarCredenciales.mockResolvedValue(AD_OK);

    await identidadSvc.login({ usuario: 'PSantafe@LosOlivos.co', password: 'clave' });

    expect(ldap.validarCredenciales).toHaveBeenCalledWith('psantafe', 'clave');
  });

  test('correo sin vincular: NO_VINCULADO y no consulta el AD', async () => {
    responderFindOne({ porCorreo: { 'nuevo@losolivos.co': identidad({ ad_usuario: null, email_norm: 'nuevo@losolivos.co' }) } });
    await expect(identidadSvc.login({ usuario: 'nuevo@losolivos.co', password: 'x' }))
      .rejects.toMatchObject({ code: 'NO_VINCULADO', message: 'Inicia sesión con tu usuario de red (el de Windows).' });
    expect(ldap.validarCredenciales).not.toHaveBeenCalled();
  });

  test('correo inexistente: mensaje genérico', async () => {
    responderFindOne({});
    await expect(identidadSvc.login({ usuario: 'nadie@x.co', password: 'x' }))
      .rejects.toMatchObject({ code: 'CREDENCIALES_INVALIDAS', message: 'Usuario o contraseña incorrectos' });
  });

  test('vinculación automática cuando el mail del AD coincide con una identidad libre', async () => {
    const libre = identidad({ ad_usuario: null });
    responderFindOne({ libresPorCorreo: { 'psantafe@losolivos.co': libre } });
    ldap.validarCredenciales.mockResolvedValue(AD_OK);

    const r = await identidadSvc.login({ usuario: 'psantafe', password: 'clave' });

    expect(vincularAdUsuario).toHaveBeenCalledWith(libre, 'psantafe');
    expect(r.identidad.ad_usuario).toBe('psantafe');
    const tags = console.log.mock.calls.map(([l]) => JSON.parse(l).tag);
    expect(tags).toContain('AUTH_AD_VINCULADO_AUTO');
  });

  test('cuenta del AD válida sin identidad: SIN_ACCESO', async () => {
    responderFindOne({});
    ldap.validarCredenciales.mockResolvedValue({ ...AD_OK, email: 'otro@x.co' });
    await expect(identidadSvc.login({ usuario: 'psantafe', password: 'clave' }))
      .rejects.toMatchObject({ code: 'SIN_ACCESO', message: 'Tu usuario de red no tiene acceso a GenFlow.' });
  });

  test('identidad inactiva: USER_INACTIVE', async () => {
    responderFindOne({ porAd: { psantafe: identidad({ activo: 0 }) } });
    ldap.validarCredenciales.mockResolvedValue(AD_OK);
    await expect(identidadSvc.login({ usuario: 'psantafe', password: 'clave' }))
      .rejects.toMatchObject({ code: 'USER_INACTIVE' });
  });

  test('AD caído: AD_NO_DISPONIBLE', async () => {
    ldap.validarCredenciales.mockRejectedValue(errorAd('AD_NO_DISPONIBLE', 'No se pudo conectar al directorio activo: ECONNREFUSED'));
    await expect(identidadSvc.login({ usuario: 'psantafe', password: 'clave' }))
      .rejects.toMatchObject({ code: 'AD_NO_DISPONIBLE', message: 'No hay conexión con el directorio activo, intenta en unos minutos.' });
  });

  test('cuenta bloqueada: conserva el mensaje específico de ldap.service', async () => {
    ldap.validarCredenciales.mockRejectedValue(errorAd('CREDENCIALES_INVALIDAS', 'Tu cuenta está bloqueada en el directorio. Contacta a TI.'));
    await expect(identidadSvc.login({ usuario: 'psantafe', password: 'clave' }))
      .rejects.toMatchObject({ code: 'CREDENCIALES_INVALIDAS', message: 'Tu cuenta está bloqueada en el directorio. Contacta a TI.' });
  });

  test('usuario inexistente en el AD: mensaje genérico (no revela que no existe)', async () => {
    ldap.validarCredenciales.mockRejectedValue(errorAd('CREDENCIALES_INVALIDAS', 'Usuario no encontrado en el directorio'));
    await expect(identidadSvc.login({ usuario: 'fantasma', password: 'clave' }))
      .rejects.toMatchObject({ message: 'Usuario o contraseña incorrectos' });
  });

  test('vacíos: VALIDATION_ERROR', async () => {
    await expect(identidadSvc.login({ usuario: '  ', password: '' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: 'Usuario y contraseña son requeridos' });
  });

  test('nunca lee password_hash', async () => {
    const i = identidad();
    let leido = false;
    Object.defineProperty(i, 'password_hash', { get() { leido = true; return 'hash'; } });
    responderFindOne({ porAd: { psantafe: i } });
    ldap.validarCredenciales.mockResolvedValue(AD_OK);
    await identidadSvc.login({ usuario: 'psantafe', password: 'clave' });
    expect(leido).toBe(false);
  });

  test('ya no exporta cambiarPassword', () => {
    expect(identidadSvc.cambiarPassword).toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest tests/identidadLoginAd.service.test.js`
Expected: FAIL — el login actual llama a `bcrypt.compare` y no a `ldap.validarCredenciales` (p. ej. `Expected ... validarCredenciales ... called with "PSantafe"` / `Number of calls: 0`).

- [ ] **Step 3: Reescribir el servicio**

Reemplazar todo `src/identity/services/identidad.service.js` por:

```js
/**
 * identity/services/identidad.service.js
 * Lógica de SSO: login contra el directorio activo, refresh/logout de sesión
 * y aplicaciones disponibles para una identidad.
 */
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { QueryTypes } = require('sequelize');
const { sequelize, OrgIdentidad, OrgSesion, OrgAplicacion } = require('../models');
const jwtId = require('../config/jwt');
const ldap = require('../../h360/services/ldap.service');
const { normalizarAdUsuario, vincularAdUsuario } = require('./vinculoAd.service');

class IdentidadError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const MSG_CREDENCIALES = 'Usuario o contraseña incorrectos';
// ldap.service usa estos textos para clave errada y para cuenta inexistente; se
// unifican para no revelar qué cuentas existen. Sus demás mensajes (cuenta
// bloqueada, clave vencida…) están escritos para mostrarse tal cual.
const MENSAJES_AD_GENERICOS = new Set([MSG_CREDENCIALES, 'Usuario no encontrado en el directorio']);

function normalizarEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}
function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function usuarioParaLog(u) {
  return /^[a-z0-9._-]{1,64}$/i.test(u || '') ? u : '[formato no válido]';
}
function log(tag, campos) {
  console.log(JSON.stringify({ tag, ...campos }));
}

async function resolverSam(entrada) {
  if (!entrada.includes('@')) return entrada;
  const identidad = await OrgIdentidad.findOne({ where: { email_norm: normalizarEmail(entrada) } });
  if (!identidad) throw new IdentidadError('CREDENCIALES_INVALIDAS', MSG_CREDENCIALES);
  if (!identidad.ad_usuario) {
    throw new IdentidadError('NO_VINCULADO', 'Inicia sesión con tu usuario de red (el de Windows).');
  }
  return identidad.ad_usuario;
}

async function validarEnDirectorio(sam, password) {
  try {
    return await ldap.validarCredenciales(sam, password);
  } catch (e) {
    if (e.codigo === 'AD_NO_DISPONIBLE') {
      log('AUTH_AD_UNAVAILABLE', { detalle: String(e.message || '').slice(0, 200) });
      throw new IdentidadError('AD_NO_DISPONIBLE', 'No hay conexión con el directorio activo, intenta en unos minutos.');
    }
    log('AUTH_AD_FAIL', { ad_usuario: usuarioParaLog(normalizarAdUsuario(sam)), codigo: e.codigo || 'DESCONOCIDO' });
    const mensaje = e.codigo === 'CREDENCIALES_INVALIDAS' && e.message && !MENSAJES_AD_GENERICOS.has(e.message)
      ? e.message
      : MSG_CREDENCIALES;
    throw new IdentidadError('CREDENCIALES_INVALIDAS', mensaje);
  }
}

async function identidadDeCuentaAd(adUsuario, emailAd) {
  const vinculada = await OrgIdentidad.findOne({ where: { ad_usuario: adUsuario } });
  if (vinculada) return vinculada;
  if (!emailAd) return null;
  const libre = await OrgIdentidad.findOne({ where: { email_norm: normalizarEmail(emailAd), ad_usuario: null } });
  if (!libre) return null;
  await vincularAdUsuario(libre, adUsuario);
  log('AUTH_AD_VINCULADO_AUTO', { ad_usuario: usuarioParaLog(adUsuario), id_identidad: libre.id_identidad });
  return libre;
}

async function login({ usuario, password, ua, ip }) {
  const entrada = String(usuario || '').trim();
  if (!entrada || !password) throw new IdentidadError('VALIDATION_ERROR', 'Usuario y contraseña son requeridos');

  const t0 = Date.now();
  const sam = await resolverSam(entrada);
  const ad = await validarEnDirectorio(sam, password);
  const adUsuario = normalizarAdUsuario(ad.usuario);

  const identidad = await identidadDeCuentaAd(adUsuario, ad.email);
  if (!identidad) {
    log('AUTH_AD_SIN_ACCESO', { ad_usuario: usuarioParaLog(adUsuario) });
    throw new IdentidadError('SIN_ACCESO', 'Tu usuario de red no tiene acceso a GenFlow.');
  }
  if (!identidad.activo) throw new IdentidadError('USER_INACTIVE', 'Usuario inactivo');

  const accessToken  = jwtId.signAccess ({ id_identidad: identidad.id_identidad, email: identidad.email_norm });
  const refreshToken = jwtId.signRefresh({ id_identidad: identidad.id_identidad });

  // Persistir sesión con hash del refresh (nunca el token plano)
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14d
  await OrgSesion.create({
    sesion_id:           uuidv4(),
    sesion_identidad_id: identidad.id_identidad,
    sesion_refresh_hash: sha256(refreshToken),
    sesion_ua:           (ua || '').slice(0, 250),
    sesion_ip:           ip || null,
    sesion_expires_at:   expiresAt
  });

  await identidad.update({ ultimo_login: new Date() });
  log('AUTH_AD_OK', { ad_usuario: usuarioParaLog(adUsuario), id_identidad: identidad.id_identidad, ms: Date.now() - t0 });

  return { accessToken, refreshToken, identidad: publicIdentidad(identidad) };
}

async function refresh(refreshToken) {
  let payload;
  try { payload = jwtId.verifyRefresh(refreshToken); }
  catch (_) { throw new IdentidadError('REFRESH_INVALID', 'Refresh token inválido o expirado'); }

  const hash = sha256(refreshToken);
  const sesion = await OrgSesion.findOne({
    where: { sesion_identidad_id: payload.id_identidad, sesion_refresh_hash: hash }
  });
  if (!sesion) throw new IdentidadError('REFRESH_REVOKED', 'Refresh token revocado');
  if (sesion.sesion_expires_at && sesion.sesion_expires_at < new Date()) {
    await sesion.destroy();
    throw new IdentidadError('REFRESH_EXPIRED', 'Refresh token expirado');
  }

  const identidad = await OrgIdentidad.findByPk(payload.id_identidad);
  if (!identidad || !identidad.activo) throw new IdentidadError('USER_INACTIVE', 'Usuario inactivo');

  const accessToken = jwtId.signAccess({ id_identidad: identidad.id_identidad, email: identidad.email_norm });
  return { accessToken };
}

async function logout(refreshToken) {
  if (!refreshToken) return { ok: true };
  try {
    const hash = sha256(refreshToken);
    await OrgSesion.destroy({ where: { sesion_refresh_hash: hash } });
  } catch (_) { /* silencioso */ }
  return { ok: true };
}

async function me(idIdentidad) {
  const identidad = await OrgIdentidad.findByPk(idIdentidad);
  if (!identidad) throw new IdentidadError('NOT_FOUND', 'Identidad no encontrada');
  return publicIdentidad(identidad);
}

/**
 * Aplicaciones del ecosistema con flag `tiene_acceso` calculado para esta identidad.
 * Para cada app activa, ejecuta una query rápida contra su `app_tabla_users`
 * verificando que exista una fila enlazada vía `app_columna_fk` y activa.
 */
async function aplicacionesDisponibles(idIdentidad) {
  const apps = await OrgAplicacion.findAll({
    where: { app_activa: 1 },
    order: [['app_orden', 'ASC'], ['app_nombre', 'ASC']]
  });

  const resultado = [];
  for (const app of apps) {
    let tieneAcceso = false;
    if (!app.app_tabla_users || !app.app_columna_fk) {
      // app sin tabla local de usuarios → acceso libre a cualquier identidad logueada
      tieneAcceso = true;
    } else {
      const activoCol = app.app_columna_activo || 'activo';
      try {
        const sql = `SELECT 1 FROM \`${app.app_tabla_users}\`
                     WHERE \`${app.app_columna_fk}\` = :id
                       AND \`${activoCol}\` = 1
                     LIMIT 1`;
        const rows = await sequelize.query(sql, {
          replacements: { id: idIdentidad },
          type: QueryTypes.SELECT
        });
        tieneAcceso = rows.length > 0;
      } catch (e) {
        // Si la tabla/columna no existe (app aún no migrada al SSO), se reporta como sin acceso
        tieneAcceso = false;
      }
    }
    resultado.push({
      app_id:          app.app_id,
      app_codigo:      app.app_codigo,
      app_nombre:      app.app_nombre,
      app_descripcion: app.app_descripcion,
      app_url_base:    app.app_url_base,
      app_icon:        app.app_icon,
      app_color_hex:   app.app_color_hex,
      app_orden:       app.app_orden,
      tiene_acceso:    tieneAcceso
    });
  }
  return resultado;
}

function publicIdentidad(i) {
  return {
    id_identidad: i.id_identidad,
    email:        i.email_norm,
    ad_usuario:   i.ad_usuario || null,
    nombre:       i.nombre,
    apellido:     i.apellido,
    telefono:     i.telefono,
    activo:       !!i.activo,
    ultimo_login: i.ultimo_login
  };
}

module.exports = {
  login, refresh, logout, me,
  aplicacionesDisponibles,
  normalizarEmail, sha256, publicIdentidad,
  IdentidadError
};
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest tests/identidadLoginAd.service.test.js`
Expected: PASS (13 tests).

- [ ] **Step 5: Verificar que nada más importa `cambiarPassword` del servicio**

Run: `grep -rn "cambiarPassword" src/identity`
Expected: solo `src/identity/controllers/auth.controller.js` y `src/identity/routes/index.js` (se limpian en la Task 4). Ninguna referencia fuera de `src/identity`.

- [ ] **Step 6: Commit**

```bash
git add src/identity/services/identidad.service.js tests/identidadLoginAd.service.test.js
git commit -m "feat(auth): identidad/login valida contra el directorio activo"
```

---

### Task 4: Controller, rutas y límite de intentos del login

Repo: `mantix-backend`.

**Files:**
- Modify: `src/identity/controllers/auth.controller.js` (reescritura completa)
- Create: `src/identity/middleware/limitadoresLogin.js`
- Modify: `src/identity/routes/index.js` (reescritura completa)
- Test: `tests/identidadLogin.routes.test.js`

**Interfaces:**
- Consumes: `identidad.login({ usuario, password, ua, ip })` y sus `code` (Task 3).
- Produces: `POST /api/identidad/login` con body `{ usuario | email, password }` → `{ success:true, data:{ accessToken, refreshToken, identidad } }` o `{ success:false, error:<code>, message }` con el HTTP de Global Constraints. `crearLimitadoresLogin() → { limitadorIp, limitadorUsuario }`, `claveUsuario(body) → string`. Se elimina `POST /api/identidad/cambiar-password`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/identidadLogin.routes.test.js`:

```js
const express = require('express');
const request = require('supertest');

jest.mock('../src/identity/services/identidad.service', () => ({
  login: jest.fn(), refresh: jest.fn(), logout: jest.fn(), publicIdentidad: jest.fn()
}));
jest.mock('../src/identity/controllers/aplicaciones.controller', () => ({
  listarParaIdentidad: jest.fn((req, res) => res.json({})),
  listarAdmin:         jest.fn((req, res) => res.json({})),
  crear:               jest.fn((req, res) => res.json({})),
  actualizar:          jest.fn((req, res) => res.json({})),
  eliminar:            jest.fn((req, res) => res.json({}))
}));
jest.mock('../src/identity/middleware/verifyIdentidad', () => ({
  verifyIdentidad: (req, res, next) => { req.identidad = { id_identidad: 1 }; next(); }
}));

const svc = require('../src/identity/services/identidad.service');
const { claveUsuario } = require('../src/identity/middleware/limitadoresLogin');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/identidad', require('../src/identity/routes'));
  return a;
}

function errorCon(code, message) { const e = new Error(message); e.code = code; return e; }

beforeEach(() => jest.clearAllMocks());

describe('POST /api/identidad/login', () => {
  test('200 con tokens', async () => {
    svc.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', identidad: { id_identidad: 1 } });
    const r = await request(app()).post('/api/identidad/login').send({ usuario: 'ok1', password: 'x' });
    expect(r.status).toBe(200);
    expect(r.body.data.accessToken).toBe('a');
    expect(svc.login).toHaveBeenCalledWith(expect.objectContaining({ usuario: 'ok1', password: 'x' }));
  });

  test('acepta email en el body por compatibilidad', async () => {
    svc.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', identidad: {} });
    await request(app()).post('/api/identidad/login').send({ email: 'p@x.co', password: 'x' });
    expect(svc.login).toHaveBeenCalledWith(expect.objectContaining({ usuario: 'p@x.co' }));
  });

  test.each([
    ['VALIDATION_ERROR', 422],
    ['CREDENCIALES_INVALIDAS', 401],
    ['NO_VINCULADO', 401],
    ['SIN_ACCESO', 403],
    ['USER_INACTIVE', 403],
    ['AD_NO_DISPONIBLE', 503]
  ])('%s → %i con el mensaje del servicio', async (code, status) => {
    svc.login.mockRejectedValue(errorCon(code, `mensaje ${code}`));
    const r = await request(app()).post('/api/identidad/login').send({ usuario: `map-${code}`, password: 'x' });
    expect(r.status).toBe(status);
    expect(r.body).toMatchObject({ success: false, error: code, message: `mensaje ${code}` });
  });

  test('al 6.º fallo del mismo usuario responde 429; otro usuario sigue entrando', async () => {
    svc.login.mockRejectedValue(errorCon('CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos'));
    const a = app();
    for (let i = 0; i < 5; i++) {
      const r = await request(a).post('/api/identidad/login').send({ usuario: 'ana', password: 'mal' });
      expect(r.status).toBe(401);
    }
    const sexto = await request(a).post('/api/identidad/login').send({ usuario: 'OLIVOS\\Ana', password: 'mal' });
    expect(sexto.status).toBe(429);
    expect(sexto.body.message).toBe('Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.');

    const otro = await request(a).post('/api/identidad/login').send({ usuario: 'beto', password: 'mal' });
    expect(otro.status).toBe(401);
  });

  test('los 503 no cuentan para el límite', async () => {
    svc.login.mockRejectedValue(errorCon('AD_NO_DISPONIBLE', 'sin AD'));
    const a = app();
    for (let i = 0; i < 7; i++) {
      const r = await request(a).post('/api/identidad/login').send({ usuario: 'carla', password: 'x' });
      expect(r.status).toBe(503);
    }
  });
});

describe('rutas retiradas', () => {
  test('POST /cambiar-password ya no existe', async () => {
    const r = await request(app()).post('/api/identidad/cambiar-password').send({ nueva: 'x' });
    expect(r.status).toBe(404);
  });
});

describe('claveUsuario', () => {
  test.each([
    [{ usuario: 'PSantafe' }, 'psantafe'],
    [{ usuario: 'OLIVOS\\psantafe' }, 'psantafe'],
    [{ email: 'PSantafe@LosOlivos.co' }, 'psantafe'],
    [{}, '']
  ])('%p → %p', (body, esperado) => {
    expect(claveUsuario(body)).toBe(esperado);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest tests/identidadLogin.routes.test.js`
Expected: FAIL — `Cannot find module '../src/identity/middleware/limitadoresLogin'`.

- [ ] **Step 3: Crear los limitadores**

Crear `src/identity/middleware/limitadoresLogin.js`:

```js
/**
 * identity/middleware/limitadoresLogin.js
 * Cada fallo en el login suma al umbral de bloqueo de la cuenta en el
 * directorio activo; sin este límite, cualquiera podría bloquearle Windows a
 * otra persona probando claves en GenFlow. Solo cuentan las respuestas 401.
 */
const rateLimit = require('express-rate-limit');

const VENTANA_MS = 15 * 60 * 1000;

function claveUsuario(body) {
  let u = String((body && (body.usuario ?? body.email)) || '').trim().toLowerCase();
  if (u.includes('\\')) u = u.split('\\').pop();
  if (u.includes('@')) u = u.split('@')[0];
  return u;
}

function demasiados(req, res) {
  return res.status(429).json({
    success: false,
    error:   'DEMASIADOS_INTENTOS',
    message: 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.'
  });
}

const opciones = {
  windowMs: VENTANA_MS,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: demasiados
};

function crearLimitadoresLogin() {
  return {
    limitadorUsuario: rateLimit({ ...opciones, limit: 5,   keyGenerator: (req) => `u:${claveUsuario(req.body)}` }),
    limitadorIp:      rateLimit({ ...opciones, limit: 100, keyGenerator: (req) => `ip:${req.ip}` })
  };
}

module.exports = { crearLimitadoresLogin, claveUsuario };
```

- [ ] **Step 4: Reescribir el controller**

Reemplazar todo `src/identity/controllers/auth.controller.js` por:

```js
/**
 * identity/controllers/auth.controller.js
 * Endpoints de autenticación SSO.
 */
const identidad = require('../services/identidad.service');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}
function fail(res, status, code, message) {
  return res.status(status).json({ success: false, error: code, message });
}

const HTTP_LOGIN = {
  VALIDATION_ERROR:       422,
  CREDENCIALES_INVALIDAS: 401,
  NO_VINCULADO:           401,
  SIN_ACCESO:             403,
  USER_INACTIVE:          403,
  AD_NO_DISPONIBLE:       503
};

async function login(req, res) {
  try {
    const body = req.body || {};
    const r = await identidad.login({
      usuario:  body.usuario ?? body.email,
      password: body.password,
      ua:       req.headers['user-agent'] || '',
      ip:       req.ip || req.connection?.remoteAddress
    });
    return ok(res, r);
  } catch (e) {
    const status = HTTP_LOGIN[e.code];
    if (status) return fail(res, status, e.code, e.message);
    throw e;
  }
}

async function refresh(req, res) {
  try {
    const r = await identidad.refresh(req.body.refreshToken);
    return ok(res, r);
  } catch (e) {
    if (['REFRESH_INVALID','REFRESH_REVOKED','REFRESH_EXPIRED','USER_INACTIVE'].includes(e.code)) {
      return fail(res, 401, e.code, e.message);
    }
    throw e;
  }
}

async function logout(req, res) {
  await identidad.logout(req.body.refreshToken);
  return res.status(204).send();
}

async function me(req, res) {
  return ok(res, identidad.publicIdentidad(req.identidad));
}

module.exports = { login, refresh, logout, me };
```

- [ ] **Step 5: Reescribir las rutas**

Reemplazar todo `src/identity/routes/index.js` por:

```js
/**
 * identity/routes/index.js
 * Montado en /api/identidad por src/routes/index.js
 */
const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const apps = require('../controllers/aplicaciones.controller');
const { verifyIdentidad } = require('../middleware/verifyIdentidad');
const { crearLimitadoresLogin } = require('../middleware/limitadoresLogin');

const { limitadorIp, limitadorUsuario } = crearLimitadoresLogin();

// Auth — públicas
router.post('/login',   limitadorIp, limitadorUsuario, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout',  auth.logout);

// Perfil identidad — requiere token de identidad
router.get ('/me',                verifyIdentidad, auth.me);

// Aplicaciones del ecosistema
router.get('/aplicaciones',       verifyIdentidad, apps.listarParaIdentidad);
router.get('/aplicaciones/admin', verifyIdentidad, apps.listarAdmin);
router.post  ('/aplicaciones',       verifyIdentidad, apps.crear);
router.put   ('/aplicaciones/:id',   verifyIdentidad, apps.actualizar);
router.delete('/aplicaciones/:id',   verifyIdentidad, apps.eliminar);

module.exports = router;
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npx jest tests/identidadLogin.routes.test.js tests/identidadLoginAd.service.test.js`
Expected: PASS (ambas suites).

- [ ] **Step 7: Verificar que las rutas cargan con los módulos reales**

Run: `node -e "require('./src/identity/routes'); console.log('OK')"`
Expected: `OK` (puede imprimir avisos de Sequelize; ningún `Error`).

- [ ] **Step 8: Commit**

```bash
git add src/identity/controllers/auth.controller.js src/identity/middleware/limitadoresLogin.js src/identity/routes/index.js tests/identidadLogin.routes.test.js
git commit -m "feat(auth): códigos HTTP del login con AD, límite de intentos y sin cambiar-password"
```

---

### Task 5: Script de vinculación masiva

Repo: `mantix-backend`.

**Files:**
- Create: `src/identity/services/proponerVinculosAd.js`
- Create: `src/identity/scripts/vincular-ad.js`
- Test: `tests/vincularAd.test.js`

**Interfaces:**
- Consumes: `asegurarIdentidad`, `vincularAdUsuario` (Task 2); `ldap.listarUsuariosDirectorio() → [{ usuario, nombre, cn, mail }]`; `SvUsuario.usr_id_identidad` (Task 1).
- Produces: `proponerVinculos(identidades: [{ id_identidad, email_norm }], directorio: [{ usuario, nombre, mail }], usados: Set<string> = new Set()) → { seguras: [{ id_identidad, email, usuario, nombreAd }], revisar: [{ id_identidad, email, candidatos: [{ usuario, nombre, mail }] }], sinCoincidencia: [{ id_identidad, email }] }`. Script: `node src/identity/scripts/vincular-ad.js [--aplicar]`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/vincularAd.test.js`:

```js
const { proponerVinculos } = require('../src/identity/services/proponerVinculosAd');

const DIR = [
  { usuario: 'PSANTAFE', nombre: 'PATRICIA SANTAFE', mail: 'PSantafe@LosOlivos.co' },
  { usuario: 'jcortina', nombre: 'JORGE CORTINA',    mail: '' },
  { usuario: 'dup1',     nombre: 'DUPLICADO UNO',    mail: 'compartido@x.co' },
  { usuario: 'dup2',     nombre: 'DUPLICADO DOS',    mail: 'compartido@x.co' },
  { usuario: 'tomado',   nombre: 'YA TOMADO',        mail: 'tomado@x.co' }
];

test('segura: un solo candidato cuyo mail coincide (sin distinguir mayúsculas)', () => {
  const r = proponerVinculos([{ id_identidad: 1, email_norm: 'psantafe@losolivos.co' }], DIR);
  expect(r.seguras).toEqual([
    { id_identidad: 1, email: 'psantafe@losolivos.co', usuario: 'psantafe', nombreAd: 'PATRICIA SANTAFE' }
  ]);
  expect(r.revisar).toEqual([]);
  expect(r.sinCoincidencia).toEqual([]);
});

test('revisar: solo coincide el prefijo del correo con el usuario', () => {
  const r = proponerVinculos([{ id_identidad: 2, email_norm: 'jcortina@serfunorte.com' }], DIR);
  expect(r.seguras).toEqual([]);
  expect(r.revisar).toEqual([
    { id_identidad: 2, email: 'jcortina@serfunorte.com',
      candidatos: [{ usuario: 'jcortina', nombre: 'JORGE CORTINA', mail: '' }] }
  ]);
});

test('revisar: varias cuentas comparten el mismo mail', () => {
  const r = proponerVinculos([{ id_identidad: 3, email_norm: 'compartido@x.co' }], DIR);
  expect(r.seguras).toEqual([]);
  expect(r.revisar[0].candidatos.map(c => c.usuario)).toEqual(['dup1', 'dup2']);
});

test('sin coincidencia', () => {
  const r = proponerVinculos([{ id_identidad: 4, email_norm: 'nadie@x.co' }], DIR);
  expect(r.sinCoincidencia).toEqual([{ id_identidad: 4, email: 'nadie@x.co' }]);
});

test('las cuentas ya vinculadas a otra identidad no se proponen', () => {
  const r = proponerVinculos([{ id_identidad: 5, email_norm: 'tomado@x.co' }], DIR, new Set(['tomado']));
  expect(r.seguras).toEqual([]);
  expect(r.sinCoincidencia).toEqual([{ id_identidad: 5, email: 'tomado@x.co' }]);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest tests/vincularAd.test.js`
Expected: FAIL — `Cannot find module '../src/identity/services/proponerVinculosAd'`.

- [ ] **Step 3: Implementar la función pura**

Crear `src/identity/services/proponerVinculosAd.js`:

```js
/**
 * identity/services/proponerVinculosAd.js
 * Empareja identidades sin ad_usuario con cuentas del directorio activo.
 * Solo es "segura" la coincidencia exacta y única del mail; el resto se revisa a mano.
 */
function normalizar(s) {
  return String(s || '').trim().toLowerCase();
}

function proponerVinculos(identidades, directorio, usados = new Set()) {
  const libres = directorio
    .map(d => ({ usuario: normalizar(d.usuario), nombre: d.nombre || '', mail: normalizar(d.mail) }))
    .filter(d => d.usuario && !usados.has(d.usuario));

  const seguras = [];
  const revisar = [];
  const sinCoincidencia = [];

  for (const i of identidades) {
    const email = normalizar(i.email_norm);
    const porMail = libres.filter(d => d.mail && d.mail === email);
    if (porMail.length === 1) {
      seguras.push({ id_identidad: i.id_identidad, email, usuario: porMail[0].usuario, nombreAd: porMail[0].nombre });
      continue;
    }
    const prefijo = email.split('@')[0];
    const candidatos = porMail.length > 1 ? porMail : libres.filter(d => d.usuario === prefijo);
    if (candidatos.length) {
      revisar.push({
        id_identidad: i.id_identidad,
        email,
        candidatos: candidatos.map(c => ({ usuario: c.usuario, nombre: c.nombre, mail: c.mail }))
      });
    } else {
      sinCoincidencia.push({ id_identidad: i.id_identidad, email });
    }
  }
  return { seguras, revisar, sinCoincidencia };
}

module.exports = { proponerVinculos };
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest tests/vincularAd.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Crear el script**

Crear `src/identity/scripts/vincular-ad.js`:

```js
/**
 * src/identity/scripts/vincular-ad.js
 *
 * Prepara el corte al login con directorio activo:
 *   1. Crea la identidad que les falta a los usuarios activos de GenFlow
 *      (sv_org_usuarios.usr_id_identidad NULL) y la enlaza.
 *   2. Empareja las identidades activas sin ad_usuario con las cuentas del AD:
 *      seguras (mail exacto y único) / revisar / sin coincidencia.
 *
 * Por defecto SOLO SIMULA. Con --aplicar escribe y vincula las seguras.
 *
 * Uso:
 *   node src/identity/scripts/vincular-ad.js
 *   node src/identity/scripts/vincular-ad.js --aplicar
 */
require('dotenv').config();
const { Op } = require('sequelize');
const ldap = require('../../h360/services/ldap.service');
const { sequelize, OrgIdentidad } = require('../models');
const { SvUsuario } = require('../../sv/models');
const { asegurarIdentidad, vincularAdUsuario } = require('../services/vinculoAd.service');
const { proponerVinculos } = require('../services/proponerVinculosAd');

const APLICAR = process.argv.includes('--aplicar');

async function crearIdentidadesFaltantes() {
  const sinIdentidad = await SvUsuario.findAll({
    where: { usr_activo: 1, usr_id_identidad: null },
    attributes: ['usr_id', 'usr_email', 'usr_nombre', 'usr_apellido', 'usr_telefono', 'usr_id_identidad']
  });
  console.log(`\n1) USUARIOS DE GENFLOW SIN IDENTIDAD (${sinIdentidad.length})${APLICAR ? '' : ' — se crearía su identidad con --aplicar'}:`);
  for (const u of sinIdentidad) {
    console.log(`  #${u.usr_id}  ${u.usr_email}`);
    if (!APLICAR || !u.usr_email) continue;
    const identidad = await asegurarIdentidad({
      email: u.usr_email, nombre: u.usr_nombre, apellido: u.usr_apellido, telefono: u.usr_telefono
    });
    await u.update({ usr_id_identidad: identidad.id_identidad });
  }
}

async function emparejar() {
  const identidades = await OrgIdentidad.findAll({
    where: { activo: 1, ad_usuario: null },
    attributes: ['id_identidad', 'email_norm'],
    raw: true
  });
  const usados = new Set((await OrgIdentidad.findAll({
    where: { ad_usuario: { [Op.ne]: null } },
    attributes: ['ad_usuario'],
    raw: true
  })).map(r => r.ad_usuario));

  const directorio = await ldap.listarUsuariosDirectorio();
  console.log(`\nDirectorio activo: ${directorio.length} cuentas. Identidades sin vincular: ${identidades.length}.`);

  const { seguras, revisar, sinCoincidencia } = proponerVinculos(identidades, directorio, usados);

  console.log(`\n2) COINCIDENCIAS SEGURAS (${seguras.length})${APLICAR ? '' : ' — se vincularían con --aplicar'}:`);
  for (const s of seguras) console.log(`  #${s.id_identidad}  ${s.email}  →  ${s.usuario}  (AD: ${s.nombreAd})`);

  console.log(`\n3) REVISAR A MANO (${revisar.length}):`);
  for (const r of revisar) {
    console.log(`  #${r.id_identidad}  ${r.email}  →  ${r.candidatos.map(c => `${c.usuario} (${c.nombre}${c.mail ? `, ${c.mail}` : ''})`).join(' | ')}`);
  }

  console.log(`\n4) SIN COINCIDENCIA EN EL AD (${sinCoincidencia.length}):`);
  for (const s of sinCoincidencia) console.log(`  #${s.id_identidad}  ${s.email}`);

  if (APLICAR) {
    for (const s of seguras) {
      const identidad = await OrgIdentidad.findByPk(s.id_identidad);
      await vincularAdUsuario(identidad, s.usuario);
    }
    console.log(`\nVinculadas: ${seguras.length}.`);
  }
}

(async () => {
  console.log(APLICAR ? '=== MODO APLICAR ===' : '=== SIMULACIÓN (no escribe nada) ===');
  try {
    await crearIdentidadesFaltantes();
    await emparejar();
    if (!APLICAR) console.log('\nNota: en simulación, las identidades del paso 1 aún no existen y no aparecen en el emparejamiento.');
    process.exitCode = 0;
  } catch (e) {
    console.error('\nERROR:', e.codigo || e.code || '', e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
```

- [ ] **Step 6: Verificar que el script parsea sin ejecutarlo**

Run: `node --check src/identity/scripts/vincular-ad.js && echo OK`
Expected: `OK`. (No ejecutar el script: se corre en el servidor en la Task 11.)

- [ ] **Step 7: Commit**

```bash
git add src/identity/services/proponerVinculosAd.js src/identity/scripts/vincular-ad.js tests/vincularAd.test.js
git commit -m "feat(auth): script de vinculación masiva identidad ↔ directorio activo"
```

---

### Task 6: Alta y edición de usuarios con usuario de red (backend)

Repo: `mantix-backend`.

**Files:**
- Create: `src/sv/services/directorioAd.service.js`
- Create: `src/sv/services/usuariosAd.service.js`
- Modify: `src/sv/controllers/usuarios.controller.js` (`list`, `getOne`, `create`, `update`, nuevo `directorio`)
- Modify: `src/sv/validations/usuarios.validation.js`
- Modify: `src/sv/routes/usuarios.routes.js`
- Modify: `src/sv/controllers/auth.controller.js` (`me`)
- Test: `tests/directorioAd.service.test.js`, `tests/usuariosAd.service.test.js`, `tests/usuariosAd.routes.test.js`

**Interfaces:**
- Consumes: `ldap.listarUsuariosDirectorio()`, `ldap.buscarUsuarioPorSam(sam) → { usuario, nombre, mail, telefono, rol } | null`; `normalizarAdUsuario`, `asegurarIdentidad`, `vincularAdUsuario`, `VinculoAdError` (Task 2); `OrgIdentidad` (Task 1).
- Produces:
  - `directorioAd.buscar(q) → Promise<[{ usuario, nombre, mail }]>`; errores con `code` `'VALIDATION_ERROR'` | `'AD_NO_DISPONIBLE'`.
  - `usuariosAd.resolverIdentidad({ adUsuario, email, nombre, apellido, telefono, idIdentidadActual = null, permitirCambio = false }) → Promise<number /* id_identidad */>`; errores `UsuarioAdError` con `code` `'AD_USUARIO_NO_EXISTE'`, o los `VinculoAdError` de la Task 2.
  - `usuariosAd.adUsuariosPorIdentidad(ids: number[]) → Promise<Map<number, string>>`.
  - `GET /api/sv/usuarios/directorio?q=` (roles admin); `POST /api/sv/usuarios` exige `ad_usuario`; `PUT /api/sv/usuarios/:id` acepta `ad_usuario`; `GET /usuarios`, `GET /usuarios/:id` y `GET /api/sv/auth/me` devuelven `ad_usuario`.

- [ ] **Step 1: Escribir el test del directorio**

Crear `tests/directorioAd.service.test.js`:

```js
jest.mock('../src/h360/services/ldap.service', () => ({ listarUsuariosDirectorio: jest.fn() }));

const DIRECTORIO = [
  { usuario: 'PSANTAFE', nombre: 'PATRICIA SANTAFÉ', cn: 'x', mail: 'psantafe@losolivos.co' },
  { usuario: 'comana',   nombre: 'CAMILO OMAÑA',     cn: 'x', mail: '' },
  ...Array.from({ length: 30 }, (_, i) => ({ usuario: `asesor${i}`, nombre: `ASESOR ${i}`, cn: 'x', mail: '' }))
];

let ldap;
let directorio;
beforeEach(() => {
  jest.resetModules();
  ldap = require('../src/h360/services/ldap.service');
  ldap.listarUsuariosDirectorio.mockResolvedValue(DIRECTORIO);
  directorio = require('../src/sv/services/directorioAd.service');
});
afterEach(() => jest.restoreAllMocks());

test('exige mínimo 3 caracteres', async () => {
  await expect(directorio.buscar('ps')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(ldap.listarUsuariosDirectorio).not.toHaveBeenCalled();
});

test('busca sin distinguir mayúsculas ni tildes y devuelve solo usuario, nombre, mail', async () => {
  expect(await directorio.buscar('santafe')).toEqual([
    { usuario: 'PSANTAFE', nombre: 'PATRICIA SANTAFÉ', mail: 'psantafe@losolivos.co' }
  ]);
  expect((await directorio.buscar('omana')).map(u => u.usuario)).toEqual(['comana']);
});

test('tope de 20 resultados', async () => {
  expect(await directorio.buscar('asesor')).toHaveLength(20);
});

test('caché de 10 minutos', async () => {
  const ahora = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  await directorio.buscar('santafe');
  ahora.mockReturnValue(1_000_000 + 9 * 60 * 1000);
  await directorio.buscar('omana');
  expect(ldap.listarUsuariosDirectorio).toHaveBeenCalledTimes(1);
  ahora.mockReturnValue(1_000_000 + 11 * 60 * 1000);
  await directorio.buscar('omana');
  expect(ldap.listarUsuariosDirectorio).toHaveBeenCalledTimes(2);
});

test('AD caído → AD_NO_DISPONIBLE', async () => {
  ldap.listarUsuariosDirectorio.mockRejectedValue(new Error('ECONNREFUSED'));
  await expect(directorio.buscar('santafe')).rejects.toMatchObject({
    code: 'AD_NO_DISPONIBLE',
    message: 'No hay conexión con el directorio activo, intenta en unos minutos.'
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest tests/directorioAd.service.test.js`
Expected: FAIL — `Cannot find module '../src/sv/services/directorioAd.service'`.

- [ ] **Step 3: Implementar el servicio del directorio**

Crear `src/sv/services/directorioAd.service.js`:

```js
/**
 * sv/services/directorioAd.service.js
 * Búsqueda de cuentas del directorio activo para el alta de usuarios.
 * listarUsuariosDirectorio() trae el dominio completo (paginado, hasta 60 s),
 * así que la lista se cachea en memoria 10 minutos y se filtra aquí.
 */
const ldap = require('../../h360/services/ldap.service');

const TTL_MS = 10 * 60 * 1000;
const MIN_CARACTERES = 3;
const MAX_RESULTADOS = 20;

let cache = null; // { cargadoEn, lista }

function error(code, message) { const e = new Error(message); e.code = code; return e; }
function plano(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

async function obtenerLista() {
  if (cache && Date.now() - cache.cargadoEn < TTL_MS) return cache.lista;
  let lista;
  try {
    lista = await ldap.listarUsuariosDirectorio();
  } catch (_) {
    throw error('AD_NO_DISPONIBLE', 'No hay conexión con el directorio activo, intenta en unos minutos.');
  }
  cache = { cargadoEn: Date.now(), lista };
  return lista;
}

async function buscar(q) {
  const termino = plano(String(q || '').trim());
  if (termino.length < MIN_CARACTERES) {
    throw error('VALIDATION_ERROR', `Escribe al menos ${MIN_CARACTERES} caracteres`);
  }
  const lista = await obtenerLista();
  return lista
    .filter(u => plano(`${u.usuario} ${u.nombre} ${u.mail}`).includes(termino))
    .slice(0, MAX_RESULTADOS)
    .map(u => ({ usuario: u.usuario, nombre: u.nombre, mail: u.mail }));
}

module.exports = { buscar };
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest tests/directorioAd.service.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Escribir el test de resolución de identidad**

Crear `tests/usuariosAd.service.test.js`:

```js
jest.mock('../src/identity/models', () => ({
  OrgIdentidad: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), findAll: jest.fn() }
}));
jest.mock('../src/h360/services/ldap.service', () => ({ buscarUsuarioPorSam: jest.fn() }));

const { OrgIdentidad } = require('../src/identity/models');
const ldap = require('../src/h360/services/ldap.service');
const usuariosAd = require('../src/sv/services/usuariosAd.service');

function identidad(campos) {
  const i = { id_identidad: 7, email_norm: 'ana@x.co', ad_usuario: null, ...campos };
  i.update = jest.fn(async (p) => Object.assign(i, p));
  return i;
}

beforeEach(() => {
  jest.clearAllMocks();
  ldap.buscarUsuarioPorSam.mockResolvedValue({ usuario: 'AGOMEZ', nombre: 'ANA GOMEZ', mail: 'ana@x.co' });
});

describe('resolverIdentidad', () => {
  test('AD_USUARIO_NO_EXISTE si la cuenta no está en el directorio', async () => {
    ldap.buscarUsuarioPorSam.mockResolvedValue(null);
    await expect(usuariosAd.resolverIdentidad({ adUsuario: 'fantasma', email: 'f@x.co' }))
      .rejects.toMatchObject({ code: 'AD_USUARIO_NO_EXISTE', message: 'No se encontró ese usuario de red en el directorio activo.' });
  });

  test('alta nueva: crea la identidad por correo y la vincula', async () => {
    const nueva = identidad({ id_identidad: 12, email_norm: 'ana@x.co' });
    OrgIdentidad.findOne
      .mockResolvedValueOnce(null)   // asegurarIdentidad: no existe por correo
      .mockResolvedValueOnce(null);  // vincularAdUsuario: cuenta libre
    OrgIdentidad.create.mockResolvedValue(nueva);

    const id = await usuariosAd.resolverIdentidad({ adUsuario: 'AGomez', email: 'Ana@X.co', nombre: 'Ana', apellido: 'G' });

    expect(ldap.buscarUsuarioPorSam).toHaveBeenCalledWith('agomez');
    expect(id).toBe(12);
    expect(nueva.update).toHaveBeenCalledWith({ ad_usuario: 'agomez' });
  });

  test('AD_USUARIO_TOMADO si la cuenta ya es de otra identidad', async () => {
    OrgIdentidad.findOne
      .mockResolvedValueOnce(identidad({ id_identidad: 7 }))
      .mockResolvedValueOnce({ id_identidad: 99, email_norm: 'otra@x.co' });
    await expect(usuariosAd.resolverIdentidad({ adUsuario: 'agomez', email: 'ana@x.co' }))
      .rejects.toMatchObject({ code: 'AD_USUARIO_TOMADO' });
  });

  test('alta: CORREO_CON_OTRO_AD si el correo ya está vinculado a otra cuenta', async () => {
    OrgIdentidad.findOne
      .mockResolvedValueOnce(identidad({ ad_usuario: 'otra.cuenta' }))
      .mockResolvedValueOnce(null);
    await expect(usuariosAd.resolverIdentidad({ adUsuario: 'agomez', email: 'ana@x.co' }))
      .rejects.toMatchObject({ code: 'CORREO_CON_OTRO_AD' });
  });

  test('edición: usa la identidad actual y permite cambiar la cuenta', async () => {
    const actual = identidad({ id_identidad: 7, ad_usuario: 'vieja' });
    OrgIdentidad.findByPk.mockResolvedValue(actual);
    OrgIdentidad.findOne.mockResolvedValue(null);
    const id = await usuariosAd.resolverIdentidad({
      adUsuario: 'agomez', email: 'ana@x.co', idIdentidadActual: 7, permitirCambio: true
    });
    expect(id).toBe(7);
    expect(actual.update).toHaveBeenCalledWith({ ad_usuario: 'agomez' });
  });
});

describe('adUsuariosPorIdentidad', () => {
  test('devuelve un Map id → ad_usuario y no consulta si no hay ids', async () => {
    expect((await usuariosAd.adUsuariosPorIdentidad([null, undefined])).size).toBe(0);
    expect(OrgIdentidad.findAll).not.toHaveBeenCalled();

    OrgIdentidad.findAll.mockResolvedValue([{ id_identidad: 1, ad_usuario: 'agomez' }, { id_identidad: 2, ad_usuario: null }]);
    const mapa = await usuariosAd.adUsuariosPorIdentidad([1, 2, 1]);
    expect(mapa.get(1)).toBe('agomez');
    expect(mapa.get(2)).toBeNull();
  });
});
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `npx jest tests/usuariosAd.service.test.js`
Expected: FAIL — `Cannot find module '../src/sv/services/usuariosAd.service'`.

- [ ] **Step 7: Implementar el servicio**

Crear `src/sv/services/usuariosAd.service.js`:

```js
/**
 * sv/services/usuariosAd.service.js
 * Vincula los usuarios de GenFlow con su identidad y su cuenta del directorio
 * activo (alta/edición desde Gestión de usuarios).
 */
const { Op } = require('sequelize');
const { OrgIdentidad } = require('../../identity/models');
const ldap = require('../../h360/services/ldap.service');
const {
  normalizarAdUsuario, asegurarIdentidad, vincularAdUsuario
} = require('../../identity/services/vinculoAd.service');

class UsuarioAdError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function resolverIdentidad({
  adUsuario, email, nombre, apellido, telefono, idIdentidadActual = null, permitirCambio = false
}) {
  const ad = normalizarAdUsuario(adUsuario);
  const enDirectorio = ad ? await ldap.buscarUsuarioPorSam(ad) : null;
  if (!enDirectorio) {
    throw new UsuarioAdError('AD_USUARIO_NO_EXISTE', 'No se encontró ese usuario de red en el directorio activo.');
  }
  let identidad = idIdentidadActual ? await OrgIdentidad.findByPk(idIdentidadActual) : null;
  if (!identidad) identidad = await asegurarIdentidad({ email, nombre, apellido, telefono });
  await vincularAdUsuario(identidad, ad, { permitirCambio });
  return identidad.id_identidad;
}

async function adUsuariosPorIdentidad(ids) {
  const unicos = [...new Set((ids || []).filter(Boolean))];
  if (!unicos.length) return new Map();
  const rows = await OrgIdentidad.findAll({
    where: { id_identidad: { [Op.in]: unicos } },
    attributes: ['id_identidad', 'ad_usuario'],
    raw: true
  });
  return new Map(rows.map(r => [r.id_identidad, r.ad_usuario]));
}

module.exports = { resolverIdentidad, adUsuariosPorIdentidad, UsuarioAdError };
```

- [ ] **Step 8: Correr el test y verificar que pasa**

Run: `npx jest tests/usuariosAd.service.test.js`
Expected: PASS (6 tests).

- [ ] **Step 9: Escribir el test de rutas**

Crear `tests/usuariosAd.routes.test.js`:

```js
const express = require('express');
const request = require('supertest');

jest.mock('../src/sv/models', () => ({
  SvUsuario: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  SvRol: {}, SvArea: {}, SvGrupo: {}, SvPunto: {}
}));
jest.mock('../src/sv/services/directorioAd.service', () => ({ buscar: jest.fn() }));
jest.mock('../src/sv/services/usuariosAd.service', () => ({
  resolverIdentidad: jest.fn(),
  adUsuariosPorIdentidad: jest.fn(async () => new Map([[77, 'agomez']]))
}));

const { SvUsuario } = require('../src/sv/models');
const directorio = require('../src/sv/services/directorioAd.service');
const usuariosAd = require('../src/sv/services/usuariosAd.service');

function errorCon(code, message) { const e = new Error(message); e.code = code; return e; }

function app() {
  const a = express();
  a.use(express.json());
  a.use((req, res, next) => { req.user = { usr_id: 1, usr_area_id: 1, rol: { rol_codigo: 'SUPER_ADMIN' } }; next(); });
  a.use('/api/sv/usuarios', require('../src/sv/routes/usuarios.routes'));
  return a;
}

const BASE = {
  usr_rol_id: 4, usr_email: 'Ana@X.co', usr_nombre: 'Ana', usr_apellido: 'Gomez', ad_usuario: 'agomez'
};

beforeEach(() => jest.clearAllMocks());

describe('GET /directorio', () => {
  test('200 con resultados', async () => {
    directorio.buscar.mockResolvedValue([{ usuario: 'agomez', nombre: 'ANA GOMEZ', mail: 'ana@x.co' }]);
    const r = await request(app()).get('/api/sv/usuarios/directorio?q=ana');
    expect(r.status).toBe(200);
    expect(directorio.buscar).toHaveBeenCalledWith('ana');
    expect(r.body.data[0].usuario).toBe('agomez');
  });
  test('422 si la búsqueda es muy corta', async () => {
    directorio.buscar.mockRejectedValue(errorCon('VALIDATION_ERROR', 'Escribe al menos 3 caracteres'));
    expect((await request(app()).get('/api/sv/usuarios/directorio?q=an')).status).toBe(422);
  });
  test('503 si el AD no responde', async () => {
    directorio.buscar.mockRejectedValue(errorCon('AD_NO_DISPONIBLE', 'No hay conexión con el directorio activo, intenta en unos minutos.'));
    const r = await request(app()).get('/api/sv/usuarios/directorio?q=ana');
    expect(r.status).toBe(503);
    expect(r.body.message).toBe('No hay conexión con el directorio activo, intenta en unos minutos.');
  });
});

describe('POST /', () => {
  test('422 sin ad_usuario', async () => {
    const { ad_usuario, ...sinAd } = BASE;
    const r = await request(app()).post('/api/sv/usuarios').send({ ...sinAd, usr_password: 'secreta' });
    expect(r.status).toBe(422);
    expect(SvUsuario.create).not.toHaveBeenCalled();
  });

  test('201: crea el usuario enlazado a la identidad y sin clave', async () => {
    usuariosAd.resolverIdentidad.mockResolvedValue(77);
    SvUsuario.create.mockResolvedValue({ usr_id: 5 });
    SvUsuario.findByPk.mockResolvedValue({ usr_id: 5 });
    const r = await request(app()).post('/api/sv/usuarios').send(BASE);
    expect(r.status).toBe(201);
    expect(usuariosAd.resolverIdentidad).toHaveBeenCalledWith(expect.objectContaining({
      adUsuario: 'agomez', email: 'ana@x.co', permitirCambio: false
    }));
    const datos = SvUsuario.create.mock.calls[0][0];
    expect(datos.usr_id_identidad).toBe(77);
    expect(datos).not.toHaveProperty('usr_password_hash');
    expect(datos).not.toHaveProperty('ad_usuario');
  });

  test.each([
    ['AD_USUARIO_NO_EXISTE', 422],
    ['AD_USUARIO_INVALIDO', 422],
    ['AD_USUARIO_TOMADO', 409],
    ['CORREO_CON_OTRO_AD', 409]
  ])('%s → %i', async (code, status) => {
    usuariosAd.resolverIdentidad.mockRejectedValue(errorCon(code, `mensaje ${code}`));
    const r = await request(app()).post('/api/sv/usuarios').send(BASE);
    expect(r.status).toBe(status);
    expect(r.body.message).toBe(`mensaje ${code}`);
  });
});

describe('PUT /:id', () => {
  test('con ad_usuario: permite cambiar y guarda usr_id_identidad', async () => {
    const u = { usr_id: 5, usr_area_id: 1, usr_email: 'ana@x.co', usr_nombre: 'Ana', usr_apellido: 'G', usr_id_identidad: 77, update: jest.fn() };
    SvUsuario.findByPk.mockResolvedValue(u);
    usuariosAd.resolverIdentidad.mockResolvedValue(77);
    const r = await request(app()).put('/api/sv/usuarios/5').send({ ad_usuario: 'agomez' });
    expect(r.status).toBe(200);
    expect(usuariosAd.resolverIdentidad).toHaveBeenCalledWith(expect.objectContaining({
      adUsuario: 'agomez', idIdentidadActual: 77, permitirCambio: true
    }));
    expect(u.update).toHaveBeenCalledWith(expect.objectContaining({ usr_id_identidad: 77 }));
  });
});

describe('GET /', () => {
  test('incluye ad_usuario', async () => {
    SvUsuario.findAll.mockResolvedValue([
      { usr_id: 5, usr_id_identidad: 77, toJSON() { return { usr_id: 5, usr_id_identidad: 77 }; } },
      { usr_id: 6, usr_id_identidad: null, toJSON() { return { usr_id: 6, usr_id_identidad: null }; } }
    ]);
    const r = await request(app()).get('/api/sv/usuarios');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual([
      { usr_id: 5, usr_id_identidad: 77, ad_usuario: 'agomez' },
      { usr_id: 6, usr_id_identidad: null, ad_usuario: null }
    ]);
  });
});
```

- [ ] **Step 10: Correr el test y verificar que falla**

Run: `npx jest tests/usuariosAd.routes.test.js`
Expected: FAIL — `GET /directorio` responde 403/404 y `POST /` sin `ad_usuario` exige `usr_password`.

- [ ] **Step 11: Actualizar la validación**

En `src/sv/validations/usuarios.validation.js`, reemplazar la línea del `create`:

```js
    usr_password: Joi.string().min(6).max(200).required(),
```

por:

```js
    ad_usuario:   Joi.string().trim().min(2).max(64).required(),
```

y en el `update`, reemplazar:

```js
    usr_activo:   Joi.number().valid(0, 1)
  }).min(1),
```

por:

```js
    usr_activo:   Joi.number().valid(0, 1),
    ad_usuario:   Joi.string().trim().min(2).max(64)
  }).min(1),
```

(El schema `resetPassword` se elimina en la Task 7.)

- [ ] **Step 12: Actualizar el controller de usuarios**

En `src/sv/controllers/usuarios.controller.js`:

a) Debajo de `const { usuariosAccesibles } = require('../utils/acceso');` agregar:

```js
const usuariosAd  = require('../services/usuariosAd.service');
const directorioAd = require('../services/directorioAd.service');

const HTTP_AD = {
  AD_USUARIO_NO_EXISTE: 422,
  AD_USUARIO_INVALIDO:  422,
  AD_USUARIO_TOMADO:    409,
  CORREO_CON_OTRO_AD:   409,
  AD_NO_DISPONIBLE:     503
};

function manejarErrorAd(res, e) {
  const status = HTTP_AD[e.code];
  if (!status) throw e;
  return fail(res, status, status === 422 ? ERROR_CODES.VALIDATION_ERROR : e.code, e.message);
}

async function conAdUsuario(rows) {
  const mapa = await usuariosAd.adUsuariosPorIdentidad(rows.map(r => r.usr_id_identidad));
  return rows.map(r => ({ ...r.toJSON(), ad_usuario: mapa.get(r.usr_id_identidad) ?? null }));
}
```

b) En `list`, reemplazar la última línea `return ok(res, usuarios);` por:

```js
  return ok(res, await conAdUsuario(usuarios));
```

c) En `getOne`, reemplazar la última línea `return ok(res, u);` por:

```js
  return ok(res, (await conAdUsuario([u]))[0]);
```

d) Reemplazar la función `create` completa por:

```js
async function create(req, res) {
  const { ad_usuario: adUsuario, ...data } = req.body;
  // ADMIN_AREA solo puede crear usuarios de su propia área
  if (req.user.rol?.rol_codigo === ROLES.ADMIN_AREA) {
    data.usr_area_id = req.user.usr_area_id;
  }
  data.usr_email = data.usr_email.toLowerCase().trim();

  try {
    data.usr_id_identidad = await usuariosAd.resolverIdentidad({
      adUsuario,
      email:          data.usr_email,
      nombre:         data.usr_nombre,
      apellido:       data.usr_apellido,
      telefono:       data.usr_telefono,
      permitirCambio: false
    });
  } catch (e) { return manejarErrorAd(res, e); }

  try {
    const u = await SvUsuario.create(data);
    return created(res, await SvUsuario.findByPk(u.usr_id, {
      include: [{ model: SvRol, as: 'rol' }]
    }));
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return fail(res, 409, ERROR_CODES.DUPLICATE_EMAIL, 'Email ya registrado');
    }
    throw e;
  }
}
```

e) Reemplazar la función `update` completa por:

```js
async function update(req, res) {
  const id = parseInt(req.params.id);
  const u  = await SvUsuario.findByPk(id);
  if (!u) return fail(res, 404, ERROR_CODES.NOT_FOUND, 'Usuario no encontrado');
  if (req.user.rol?.rol_codigo === ROLES.ADMIN_AREA && u.usr_area_id !== req.user.usr_area_id) {
    return fail(res, 403, ERROR_CODES.FORBIDDEN, 'Fuera de tu área');
  }
  const { ad_usuario: adUsuario, ...data } = req.body;
  if (data.usr_email) data.usr_email = data.usr_email.toLowerCase().trim();
  // ADMIN_AREA no puede mover usuarios fuera de su área
  if (req.user.rol?.rol_codigo === ROLES.ADMIN_AREA) {
    delete data.usr_area_id;
  }
  if (adUsuario !== undefined) {
    try {
      data.usr_id_identidad = await usuariosAd.resolverIdentidad({
        adUsuario,
        email:             data.usr_email    || u.usr_email,
        nombre:            data.usr_nombre   || u.usr_nombre,
        apellido:          data.usr_apellido || u.usr_apellido,
        telefono:          data.usr_telefono ?? u.usr_telefono,
        idIdentidadActual: u.usr_id_identidad || null,
        permitirCambio:    true
      });
    } catch (e) { return manejarErrorAd(res, e); }
  }
  await u.update(data);
  return ok(res, u);
}
```

f) Antes de `module.exports`, agregar:

```js
/**
 * GET /usuarios/directorio?q=
 * Busca cuentas del directorio activo para el alta (roles admin).
 */
async function directorio(req, res) {
  try {
    return ok(res, await directorioAd.buscar(req.query.q));
  } catch (e) {
    if (e.code === 'VALIDATION_ERROR') return fail(res, 422, ERROR_CODES.VALIDATION_ERROR, e.message);
    return manejarErrorAd(res, e);
  }
}
```

g) Reemplazar `module.exports` por:

```js
module.exports = { list, getOne, create, update, toggle, resetPassword, accesibles, directorio };
```

- [ ] **Step 13: Registrar la ruta**

En `src/sv/routes/usuarios.routes.js`, reemplazar:

```js
router.get   ('/accesibles', ctrl.accesibles);
```

por:

```js
router.get   ('/accesibles', ctrl.accesibles);
router.get   ('/directorio', admin, ctrl.directorio);
```

- [ ] **Step 14: `me` devuelve el usuario de red**

En `src/sv/controllers/auth.controller.js`, debajo de `const { enriquecerAccesoCruzado } = require('../utils/accesoCruzado');` agregar:

```js
const { adUsuariosPorIdentidad } = require('../services/usuariosAd.service');
```

y reemplazar la función `me` por:

```js
async function me(req, res) {
  const mapa = await adUsuariosPorIdentidad([req.user.usr_id_identidad]);
  return ok(res, { ...publicUser(req.user), ad_usuario: mapa.get(req.user.usr_id_identidad) ?? null });
}
```

- [ ] **Step 15: Correr los tests y verificar que pasan**

Run: `npx jest tests/usuariosAd.routes.test.js tests/usuariosAd.service.test.js tests/directorioAd.service.test.js`
Expected: PASS (las tres suites).

- [ ] **Step 16: Verificar carga real**

Run: `node -e "require('./src/sv/routes/usuarios.routes'); require('./src/sv/controllers/auth.controller'); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 17: Commit**

```bash
git add src/sv/services/directorioAd.service.js src/sv/services/usuariosAd.service.js src/sv/controllers/usuarios.controller.js src/sv/validations/usuarios.validation.js src/sv/routes/usuarios.routes.js src/sv/controllers/auth.controller.js tests/directorioAd.service.test.js tests/usuariosAd.service.test.js tests/usuariosAd.routes.test.js
git commit -m "feat(auth): alta y edición de usuarios de GenFlow con usuario de red del AD"
```

---

### Task 7: Retirar las claves locales del módulo de ventas

Repo: `mantix-backend`.

**Files:**
- Modify: `src/sv/controllers/auth.controller.js` (reescritura completa)
- Modify: `src/sv/routes/auth.routes.js` (reescritura completa)
- Modify: `src/sv/middleware/svAuth.js` (reescritura completa)
- Modify: `src/sv/controllers/usuarios.controller.js` (quitar `resetPassword` e import de `hash`)
- Modify: `src/sv/routes/usuarios.routes.js` (quitar `reset-password`)
- Modify: `src/sv/validations/usuarios.validation.js` (quitar `resetPassword`)
- Modify: `src/sv/models/Usuario.js` (quitar scope `withPassword`)
- Modify: `src/sv/config/constants.js` (quitar `JWT` y `BCRYPT_ROUNDS` si quedan sin uso)
- Delete: `src/sv/utils/jwt.js`, `src/sv/utils/password.js`, `src/sv/utils/hashRefresh.js`, `src/sv/validations/auth.validation.js`
- Test: `tests/svAuth.test.js`, `tests/svLegacyAuth.routes.test.js`

**Interfaces:**
- Consumes: `adUsuariosPorIdentidad` (Task 6).
- Produces: `/api/sv/auth` solo expone `GET /me` y `PATCH /me/preferencias`; `svAuth` solo acepta el JWT de identidad (`kind: 'identidad'`, secreto `IDENTIDAD_JWT_SECRET || JWT_SECRET`).

- [ ] **Step 1: Verificar que nadie más emite o consume el token viejo de ventas**

Run:
```bash
grep -rn "sv/utils/jwt\|utils/password\|utils/hashRefresh\|auth.validation" src --include='*.js' | grep -v "^src/sv/utils/"
grep -rln "sv/auth/login\|sv/auth/refresh" ../*/src ../wa 2>/dev/null | grep -v node_modules
```
Expected (primer comando): solo `src/sv/middleware/svAuth.js`, `src/sv/controllers/auth.controller.js`, `src/sv/controllers/usuarios.controller.js` y `src/sv/routes/auth.routes.js`. Expected (segundo): sin resultados.
Si aparece cualquier otro consumidor, **detenerse y reportar `BLOCKED`** con la lista: la spec indica conservar la rama vieja de `svAuth` y registrarlo como pendiente.

- [ ] **Step 2: Escribir los tests que fallan**

Crear `tests/svAuth.test.js`:

```js
// Secretos distintos y definidos antes de cargar svAuth (se leen al requerir el
// módulo): así el token viejo de ventas SÍ era válido con el código anterior.
process.env.IDENTIDAD_JWT_SECRET = 'secreto-identidad-test';
process.env.SV_JWT_SECRET        = 'secreto-sv-test';

jest.mock('../src/sv/models', () => ({
  SvUsuario: { findOne: jest.fn(), findByPk: jest.fn(async () => ({ usr_id: 5, usr_activo: 1 })) },
  SvRol: {}, SvArea: {}, SvGrupo: {}, SvPunto: {}
}));
jest.mock('../src/sv/utils/accesoCruzado', () => ({ enriquecerAccesoCruzado: jest.fn(async () => {}) }));

const jwt = require('jsonwebtoken');
const { SvUsuario } = require('../src/sv/models');
const { svAuth } = require('../src/sv/middleware/svAuth');

function correr(token) {
  const req = { header: () => (token ? `Bearer ${token}` : '') };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const next = jest.fn();
  return svAuth(req, res, next).then(() => ({ req, res, next }));
}

beforeEach(() => jest.clearAllMocks());

test('token de identidad válido: resuelve el usuario por usr_id_identidad', async () => {
  SvUsuario.findOne.mockResolvedValue({ usr_id: 5, usr_activo: 1 });
  const token = jwt.sign({ kind: 'identidad', id_identidad: 77 }, 'secreto-identidad-test');
  const { req, next } = await correr(token);
  expect(SvUsuario.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { usr_id_identidad: 77 } }));
  expect(next).toHaveBeenCalled();
  expect(req.user.usr_id).toBe(5);
});

test('token viejo de ventas ({ usr_id }) ya no se acepta', async () => {
  const token = jwt.sign({ usr_id: 5 }, 'secreto-sv-test');
  const { res, next } = await correr(token);
  expect(SvUsuario.findByPk).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(401);
});

test('sin token: 401', async () => {
  const { res } = await correr(null);
  expect(res.statusCode).toBe(401);
});
```

Crear `tests/svLegacyAuth.routes.test.js`:

```js
const express = require('express');
const request = require('supertest');

// findByPk devuelve un usuario para que, con el código anterior, reset-password
// respondiera 200 (y no un 404 por "usuario no encontrado" que enmascare la prueba).
jest.mock('../src/sv/models', () => ({
  SvUsuario: {
    findAll: jest.fn(), create: jest.fn(), update: jest.fn(),
    findByPk: jest.fn(async () => ({ usr_id: 5, usr_area_id: 1, update: jest.fn() }))
  },
  SvRol: {}, SvArea: {}, SvGrupo: {}, SvPunto: {}
}));
jest.mock('../src/sv/middleware/svAuth', () => ({
  svAuth: (req, res, next) => {
    req.user = { usr_id: 1, usr_id_identidad: 77, usr_area_id: 1, rol: { rol_codigo: 'SUPER_ADMIN' } };
    next();
  }
}));
jest.mock('../src/sv/services/usuariosAd.service', () => ({
  resolverIdentidad: jest.fn(),
  adUsuariosPorIdentidad: jest.fn(async () => new Map([[77, 'agomez']]))
}));
jest.mock('../src/sv/services/directorioAd.service', () => ({ buscar: jest.fn() }));

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/sv/auth', require('../src/sv/routes/auth.routes'));
  a.use('/api/sv/usuarios', (req, res, next) => { req.user = { usr_id: 1, rol: { rol_codigo: 'SUPER_ADMIN' } }; next(); },
    require('../src/sv/routes/usuarios.routes'));
  return a;
}

test.each([
  ['post', '/api/sv/auth/login'],
  ['post', '/api/sv/auth/refresh'],
  ['post', '/api/sv/auth/logout'],
  ['patch', '/api/sv/auth/me/password'],
  ['post', '/api/sv/usuarios/5/reset-password']
])('%s %s ya no existe', async (metodo, ruta) => {
  const r = await request(app())[metodo](ruta).send({ email: 'a@x.co', password: 'x', actual: 'x', nueva: 'yyyyyy' });
  expect(r.status).toBe(404);
});

test('GET /api/sv/auth/me sigue respondiendo con ad_usuario', async () => {
  const r = await request(app()).get('/api/sv/auth/me');
  expect(r.status).toBe(200);
  expect(r.body.data.ad_usuario).toBe('agomez');
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx jest tests/svAuth.test.js tests/svLegacyAuth.routes.test.js`
Expected: FAIL — el token `{ usr_id }` todavía se acepta (llama a `findByPk`) y las rutas viejas responden distinto de 404.

- [ ] **Step 4: Reescribir `svAuth`**

Reemplazar todo `src/sv/middleware/svAuth.js` por:

```js
/**
 * sv/middleware/svAuth.js
 * Verifica el access token del SSO de identidad — payload
 * { kind:'identidad', id_identidad }, secret IDENTIDAD_JWT_SECRET — y resuelve
 * el usuario de ventas vía la FK usr_id_identidad.
 */
const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');
const { ERROR_CODES } = require('../config/constants');
const { SvUsuario, SvRol, SvArea, SvGrupo, SvPunto } = require('../models');
const { enriquecerAccesoCruzado } = require('../utils/accesoCruzado');

const IDENTIDAD_JWT_SECRET = process.env.IDENTIDAD_JWT_SECRET || process.env.JWT_SECRET;

const INCLUDE_USUARIO = [
  { model: SvRol,   as: 'rol' },
  { model: SvArea,  as: 'area' },
  { model: SvGrupo, as: 'grupo' },
  { model: SvPunto, as: 'punto' },
  { model: SvGrupo, as: 'gruposExtra' },
  { model: SvArea,  as: 'areasExtra' }
];

async function resolverUsuarioSv(token) {
  try {
    const decoded = jwt.verify(token, IDENTIDAD_JWT_SECRET);
    if (decoded && decoded.kind === 'identidad' && decoded.id_identidad) {
      return SvUsuario.findOne({
        where: { usr_id_identidad: decoded.id_identidad },
        include: INCLUDE_USUARIO
      });
    }
  } catch (_) { /* token inválido o expirado */ }
  return null;
}

async function svAuth(req, res, next) {
  try {
    const header = req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return fail(res, 401, ERROR_CODES.UNAUTHORIZED, 'Token no provisto');
    }

    const usuario = await resolverUsuarioSv(token);

    if (!usuario || !usuario.usr_activo) {
      return fail(res, 401, ERROR_CODES.UNAUTHORIZED, 'Token inválido o usuario inactivo');
    }

    await enriquecerAccesoCruzado(usuario);

    req.user   = usuario;
    req.svUser = usuario;
    req.token  = token;
    return next();
  } catch (e) {
    return fail(res, 500, ERROR_CODES.INTERNAL_ERROR, 'Error de autenticación');
  }
}

module.exports = { svAuth };
```

- [ ] **Step 5: Reescribir el controller de auth de ventas**

Reemplazar todo `src/sv/controllers/auth.controller.js` por:

```js
/**
 * sv/controllers/auth.controller.js
 * Perfil del usuario de ventas (me + preferencias). El login es del SSO de
 * identidad contra el directorio activo (/api/identidad/login).
 */
const { SvUsuario } = require('../models');
const { ok } = require('../utils/response');
const { adUsuariosPorIdentidad } = require('../services/usuariosAd.service');

function publicUser(u) {
  return {
    usr_id:        u.usr_id,
    usr_email:     u.usr_email,
    usr_nombre:    u.usr_nombre,
    usr_apellido:  u.usr_apellido,
    usr_telefono:  u.usr_telefono,
    usr_area_id:   u.usr_area_id,
    usr_grupo_id:  u.usr_grupo_id,
    usr_punto_id:  u.usr_punto_id,
    usr_preferencias: u.usr_preferencias || null,
    // Fase 7: tracking GPS
    usr_consentimiento_geo_at: u.usr_consentimiento_geo_at || null,
    usr_horario_laboral:       u.usr_horario_laboral || null,
    rol:   u.rol   ? { rol_id: u.rol.rol_id, rol_codigo: u.rol.rol_codigo, rol_nombre: u.rol.rol_nombre, rol_nivel: u.rol.rol_nivel, rol_permisos: u.rol.rol_permisos } : null,
    area:  u.area  ? { area_id: u.area.area_id, area_codigo: u.area.area_codigo, area_nombre: u.area.area_nombre, area_color_hex: u.area.area_color_hex, area_icono: u.area.area_icono } : null,
    grupo: u.grupo ? { grupo_id: u.grupo.grupo_id, grupo_codigo: u.grupo.grupo_codigo, grupo_nombre: u.grupo.grupo_nombre } : null,
    punto: u.punto ? { punto_id: u.punto.punto_id, punto_codigo: u.punto.punto_codigo, punto_nombre: u.punto.punto_nombre } : null,
    // Grupos supervisados: combina grupo principal + grupos extra (multi-grupo)
    grupos_supervisados: gruposSupervisados(u),
    // Áreas accesibles: combina área principal + áreas extra (multi-área)
    areas_accesibles: areasAccesibles(u)
  };
}

/**
 * Combina el área principal (usr_area_id) con las áreas extra (belongsToMany).
 * Devuelve array deduplicado de { area_id, area_codigo, area_nombre, area_color_hex, area_icono }.
 */
function areasAccesibles(u) {
  const lista = [];
  const ids = new Set();
  if (u.area) {
    ids.add(u.area.area_id);
    lista.push({
      area_id:        u.area.area_id,
      area_codigo:    u.area.area_codigo,
      area_nombre:    u.area.area_nombre,
      area_color_hex: u.area.area_color_hex,
      area_icono:     u.area.area_icono,
      principal:      true
    });
  }
  for (const a of (u.areasExtra || [])) {
    if (ids.has(a.area_id)) continue;
    ids.add(a.area_id);
    lista.push({
      area_id:        a.area_id,
      area_codigo:    a.area_codigo,
      area_nombre:    a.area_nombre,
      area_color_hex: a.area_color_hex,
      area_icono:     a.area_icono,
      principal:      false
    });
  }
  return lista;
}

/**
 * Combina el grupo principal (usr_grupo_id) con los grupos extra (belongsToMany).
 * Devuelve array deduplicado de { grupo_id, grupo_codigo, grupo_nombre, grupo_area_id }.
 */
function gruposSupervisados(u) {
  const lista = [];
  const ids = new Set();
  if (u.grupo) {
    ids.add(u.grupo.grupo_id);
    lista.push({
      grupo_id:      u.grupo.grupo_id,
      grupo_codigo:  u.grupo.grupo_codigo,
      grupo_nombre:  u.grupo.grupo_nombre,
      grupo_area_id: u.grupo.grupo_area_id || u.usr_area_id
    });
  }
  for (const g of (u.gruposExtra || [])) {
    if (ids.has(g.grupo_id)) continue;
    ids.add(g.grupo_id);
    lista.push({
      grupo_id:      g.grupo_id,
      grupo_codigo:  g.grupo_codigo,
      grupo_nombre:  g.grupo_nombre,
      grupo_area_id: g.grupo_area_id
    });
  }
  return lista;
}

async function me(req, res) {
  const mapa = await adUsuariosPorIdentidad([req.user.usr_id_identidad]);
  return ok(res, { ...publicUser(req.user), ad_usuario: mapa.get(req.user.usr_id_identidad) ?? null });
}

async function updatePreferencias(req, res) {
  const prefs = req.body || {};
  await SvUsuario.update({ usr_preferencias: prefs }, { where: { usr_id: req.user.usr_id } });
  return ok(res, { usr_preferencias: prefs });
}

module.exports = { me, updatePreferencias };
```

- [ ] **Step 6: Reescribir las rutas de auth de ventas**

Reemplazar todo `src/sv/routes/auth.routes.js` por:

```js
/**
 * sv/routes/auth.routes.js
 * Perfil del usuario de ventas. El login lo hace el SSO (/api/identidad/login).
 */
const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { svAuth } = require('../middleware/svAuth');

router.get('/me',               svAuth, ctrl.me);
router.patch('/me/preferencias', svAuth, ctrl.updatePreferencias);

module.exports = router;
```

- [ ] **Step 7: Quitar el reseteo de clave de usuarios**

En `src/sv/controllers/usuarios.controller.js`:
- Eliminar la línea `const { hash } = require('../utils/password');`.
- Eliminar la función `resetPassword` completa (desde `async function resetPassword(req, res) {` hasta su `}` de cierre).
- Reemplazar `module.exports` por:

```js
module.exports = { list, getOne, create, update, toggle, accesibles, directorio };
```

- Actualizar el comentario de cabecera a ` * CRUD de usuarios SerVentas + toggle activo + búsqueda en el directorio activo.`

En `src/sv/routes/usuarios.routes.js`, eliminar la línea:

```js
router.post  ('/:id/reset-password', admin, validate(v.resetPassword), ctrl.resetPassword);
```

En `src/sv/validations/usuarios.validation.js`, eliminar el bloque:

```js
  resetPassword: Joi.object({
    nueva: Joi.string().min(6).max(200).required()
  })
```

y la coma que queda colgando tras el cierre de `update` (`}).min(1),` → `}).min(1)`).

- [ ] **Step 8: Quitar el scope `withPassword`**

En `src/sv/models/Usuario.js`, reemplazar:

```js
    defaultScope: {
      attributes: { exclude: ['usr_password_hash', 'usr_2fa_secret'] }
    },
    scopes: {
      withPassword: { attributes: { include: ['usr_password_hash'] } }
    }
```

por:

```js
    defaultScope: {
      attributes: { exclude: ['usr_password_hash', 'usr_2fa_secret'] }
    }
```

Run: `grep -rn "withPassword" src`
Expected: sin resultados.

- [ ] **Step 9: Borrar los utilitarios que quedaron sin uso**

```bash
git rm src/sv/utils/jwt.js src/sv/utils/password.js src/sv/utils/hashRefresh.js src/sv/validations/auth.validation.js
grep -rn "sv/utils/jwt\|utils/password\|utils/hashRefresh\|auth.validation" src --include='*.js'
grep -rn "JWT\b\|BCRYPT_ROUNDS" src/sv --include='*.js' | grep -v "IDENTIDAD_JWT\|config/constants.js"
```
Expected: los dos `grep` sin resultados. Si el segundo está vacío, en `src/sv/config/constants.js` eliminar el bloque `const JWT = { … };`, la línea `const BCRYPT_ROUNDS = …;` y las entradas `JWT` y `BCRYPT_ROUNDS` del `module.exports`. Si el segundo grep muestra usos, dejar `constants.js` como está.

- [ ] **Step 10: Buscar tests que dependan de lo borrado**

Run: `grep -rln "sv/controllers/auth.controller\|reset-password\|resetPassword\|utils/password\|changePassword\|withPassword" tests test src --include='*.test.js'`
Expected: solo `tests/svLegacyAuth.routes.test.js`. Si aparece otro test que prueba el login/refresh/cambio de clave locales, eliminarlo (prueba comportamiento retirado) y mencionarlo en el reporte.

- [ ] **Step 11: Correr los tests nuevos y toda la suite**

Run: `npx jest tests/svAuth.test.js tests/svLegacyAuth.routes.test.js`
Expected: PASS.

Run: `npx jest 2>&1 | tail -15`
Expected: sin suites nuevas en rojo. Fallan solo las preexistentes `test/grupoIndivII.test.js` y `tests/invitacion.service.test.js` (ya fallaban antes de este plan); cualquier otra falla se corrige.

- [ ] **Step 12: Verificar que el backend carga completo**

Run: `node -e "require('./src/routes'); console.log('OK')"`
Expected: `OK` (sin `Cannot find module`).

- [ ] **Step 13: Commit**

```bash
git add -A src/sv tests/svAuth.test.js tests/svLegacyAuth.routes.test.js
git status --short
git commit -m "feat(auth): retira login, refresh y claves locales del módulo de ventas"
```
(Antes de commitear, revisar que `git status --short` solo muestre archivos de `src/sv/` y los dos tests.)

---

### Task 8: Login y perfil de GenFlow

Repo: `crm-frontend`.

**Files:**
- Modify: `src/api/authApi.js`
- Modify: `src/stores/useAuthStore.js:134-145`
- Modify: `src/views/auth/Login.vue` (reescritura completa)
- Modify: `src/views/perfil/MiPerfil.vue`
- Delete: `src/modules/afiliacion/views/LoginView.vue`, `src/modules/afiliacion/stores/useAuthStore.js`, `src/modules/afiliacion/api/authApi.js`
- Test: `src/views/auth/__tests__/Login.spec.js`, `src/views/perfil/__tests__/MiPerfil.spec.js`, `src/stores/__tests__/useAuthStore.login.spec.js`

**Interfaces:**
- Consumes: `POST /api/identidad/login` con `{ usuario, password }` (Task 4); `GET /api/sv/auth/me` con `ad_usuario` (Task 6).
- Produces: `authApi.login({ usuario, password })`; `useAuthStore().login(usuario, password)`; `auth.usuario.ad_usuario` disponible para las vistas.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/stores/__tests__/useAuthStore.login.spec.js`:

```js
import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/authApi', () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({ data: { accessToken: 'a', refreshToken: 'r', identidad: {} } }),
    me:    vi.fn().mockResolvedValue({ data: { usr_id: 1, usr_area_id: 2, ad_usuario: 'psantafe' } })
  }
}));

import { authApi } from '@/api/authApi';
import { useAuthStore } from '@/stores/useAuthStore';

describe('useAuthStore.login', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.clearAllMocks(); });

  it('envía { usuario, password } al SSO', async () => {
    const auth = useAuthStore();
    await auth.login('psantafe', 'clave');
    expect(authApi.login).toHaveBeenCalledWith({ usuario: 'psantafe', password: 'clave' });
    expect(auth.usuario.ad_usuario).toBe('psantafe');
  });

  it('authApi ya no expone changePassword', () => {
    expect(authApi.changePassword).toBeUndefined();
  });
});
```

Crear `src/views/auth/__tests__/Login.spec.js`:

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

const push = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

import Login from '@/views/auth/Login.vue';
import { useAuthStore } from '@/stores/useAuthStore';

function factory() {
  return mount(Login, {
    global: {
      plugins: [createTestingPinia({
        createSpy: vi.fn,
        initialState: { svAuth: { usuario: { usr_nombre: 'Patricia' } } }
      })]
    }
  });
}

async function enviar(w, usuario, password) {
  const inputs = w.findAll('input');
  await inputs[0].setValue(usuario);
  await inputs[1].setValue(password);
  await w.find('form').trigger('submit');
  await flushPromises();
}

describe('Login.vue', () => {
  it('muestra el copy de usuario de red', () => {
    const w = factory();
    expect(w.text()).toContain('Usuario de red o correo');
    expect(w.text()).toContain('Usa el mismo usuario y clave de Windows');
    const input = w.findAll('input')[0];
    expect(input.attributes('placeholder')).toBe('psantafe');
    expect(input.attributes('type')).toBe('text');
    expect(input.attributes('autocomplete')).toBe('username');
  });

  it('llama a auth.login con el usuario recortado', async () => {
    const w = factory();
    await enviar(w, '  psantafe  ', 'clave');
    expect(useAuthStore().login).toHaveBeenCalledWith('psantafe', 'clave');
  });

  it('exige usuario y contraseña', async () => {
    const w = factory();
    await enviar(w, '', '');
    expect(w.text()).toContain('Usuario y contraseña son requeridos');
    expect(useAuthStore().login).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'Usuario o contraseña incorrectos'],
    [403, 'Tu usuario de red no tiene acceso a GenFlow.'],
    [429, 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.'],
    [503, 'No hay conexión con el directorio activo, intenta en unos minutos.']
  ])('muestra el mensaje del backend para %i', async (status, message) => {
    const w = factory();
    useAuthStore().login.mockRejectedValue({ response: { status, data: { message } } });
    await enviar(w, 'psantafe', 'clave');
    expect(w.text()).toContain(message);
  });
});
```

Crear `src/views/perfil/__tests__/MiPerfil.spec.js`:

```js
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/api/trackingApi', () => ({ trackingApi: { exportarMisDatos: vi.fn() } }));

import MiPerfil from '@/views/perfil/MiPerfil.vue';

function factory(usuario) {
  return mount(MiPerfil, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, initialState: { svAuth: { usuario } } })],
      stubs: { teleport: true }
    }
  });
}

describe('MiPerfil.vue', () => {
  it('muestra el usuario de red y no ofrece cambiar la contraseña', () => {
    const w = factory({ usr_nombre: 'Patricia', usr_apellido: 'S', usr_email: 'p@x.co', ad_usuario: 'psantafe' });
    const fila = w.find('[data-testid="fila-usuario-red"]');
    expect(fila.text()).toContain('Usuario de red');
    expect(fila.text()).toContain('psantafe');
    expect(fila.text()).toContain('La clave se cambia en Windows o con TI.');
    expect(w.text()).not.toContain('Cambiar contraseña');
    expect(w.find('input[type="password"]').exists()).toBe(false);
  });

  it('indica cuando el usuario no está vinculado', () => {
    const w = factory({ usr_nombre: 'Ana', usr_apellido: 'G', usr_email: 'a@x.co', ad_usuario: null });
    expect(w.find('[data-testid="fila-usuario-red"]').text()).toContain('sin vincular');
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/stores/__tests__/useAuthStore.login.spec.js src/views/auth/__tests__/Login.spec.js src/views/perfil/__tests__/MiPerfil.spec.js`
Expected: FAIL — `authApi.login` recibe `{ email, password }`, el login dice "Correo electrónico", y MiPerfil aún muestra "Cambiar contraseña".

- [ ] **Step 3: Actualizar `authApi`**

Reemplazar todo `src/api/authApi.js` por:

```js
import axios from 'axios';
import api, { API_ROOT } from './axios';

export const authApi = {
  // Login unificado por SSO de identidad contra el directorio activo: el token
  // sirve para CRM (/api/sv) y afiliación (/api/afiliados, /api/recibos).
  // Body: { usuario, password } (usuario de red o correo).
  login    : (payload) => axios.post(`${API_ROOT}/identidad/login`, payload).then(r => r.data),
  refresh  : (refreshToken) => axios.post(`${API_ROOT}/identidad/refresh`, { refreshToken }).then(r => r.data),
  logout   : (refreshToken) => axios.post(`${API_ROOT}/identidad/logout`, { refreshToken }).then(r => r.data).catch(() => null),
  me       : () => api.get('/auth/me').then(r => r.data),
  updatePreferencias: (payload) => api.patch('/auth/me/preferencias', payload).then(r => r.data)
};
```

(La línea original importaba también `publicApi` de `./publicAxios`; si después del cambio queda sin usar, se omite como arriba. Verificar con `grep -n "publicApi" src/api/authApi.js` → sin resultados.)

- [ ] **Step 4: Actualizar el store**

En `src/stores/useAuthStore.js`, reemplazar:

```js
  async function login(email, password) {
    // Login por SSO de identidad → tokens válidos para CRM y afiliación.
    const res = await authApi.login({ email, password });
```

por:

```js
  async function login(usuario, password) {
    // Login por SSO de identidad (directorio activo) → tokens válidos para CRM y afiliación.
    const res = await authApi.login({ usuario, password });
```

- [ ] **Step 5: Reescribir `Login.vue`**

Reemplazar todo `src/views/auth/Login.vue` por:

```vue
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();
const auth   = useAuthStore();
const toast  = useToastStore();
const { extract } = useApiError();

const usuario  = ref('');
const password = ref('');
const loading  = ref(false);
const error    = ref('');

async function submit() {
  if (!usuario.value.trim() || !password.value) {
    error.value = 'Usuario y contraseña son requeridos';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await auth.login(usuario.value.trim(), password.value);
    toast.success(`Bienvenido/a ${auth.usuario.usr_nombre}`);
    router.push(auth.rutaInicio());
  } catch (e) {
    error.value = extract(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-brown-deep px-4">
    <div class="w-full max-w-md sv-card p-8">
      <div class="text-center mb-6">
        <h1 class="font-serif text-3xl text-gold">GenFlow</h1>
        <p class="text-sm text-text3 mt-1">CRM Serfunorte Los Olivos</p>
      </div>

      <form @submit.prevent="submit" class="space-y-4" novalidate>
        <div>
          <BaseInput
            v-model="usuario"
            label="Usuario de red o correo"
            type="text"
            placeholder="psantafe"
            required
            autocomplete="username"
          />
          <p class="mt-1 text-xs text-text3">Usa el mismo usuario y clave de Windows</p>
        </div>
        <BaseInput
          v-model="password"
          label="Contraseña"
          type="password"
          placeholder="••••••••"
          required
          autocomplete="current-password"
        />

        <div v-if="error" class="text-sm text-danger bg-danger/10 border border-danger/40 rounded-sv px-3 py-2">
          {{ error }}
        </div>

        <BaseButton type="submit" :loading="loading" variant="primary" class="w-full">
          Iniciar sesión
        </BaseButton>
      </form>

      <p class="text-xs text-text3 text-center mt-6">
        ¿Olvidaste tu contraseña? Contacta a TI.
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 6: Actualizar `MiPerfil.vue`**

En `src/views/perfil/MiPerfil.vue`:

a) Reemplazar el bloque de imports:

```js
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { authApi } from '@/api/authApi';
import { useRouter } from 'vue-router';

import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import AreaBadge from '@/components/common/AreaBadge.vue';
```

por:

```js
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import AreaBadge from '@/components/common/AreaBadge.vue';
```

(Las líneas de `trackingApi` y `dayjs` que siguen se conservan.)

b) Eliminar el bloque completo desde `// Modal cambiar contraseña` hasta el cierre de `async function cambiarPassword() { … }` (líneas 29-49 del archivo actual).

c) En el template, reemplazar la fila:

```html
      <div class="px-5 py-4 flex items-center gap-4">
        <span class="text-xl" aria-hidden="true">🔐</span>
        <div class="flex-1">
          <div class="font-semibold text-text1">Cambiar contraseña</div>
          <div class="text-xs text-text3">Recomendado cada 90 días.</div>
        </div>
        <BaseButton variant="secondary" size="sm" @click="showPwd = true">Cambiar</BaseButton>
      </div>
```

por:

```html
      <div class="px-5 py-4 flex items-center gap-4" data-testid="fila-usuario-red">
        <span class="text-xl" aria-hidden="true">🔐</span>
        <div class="flex-1">
          <div class="font-semibold text-text1">Usuario de red</div>
          <div class="text-xs text-text3">La clave se cambia en Windows o con TI.</div>
        </div>
        <span class="font-mono text-sm" :class="u.ad_usuario ? 'text-text2' : 'text-danger'">
          {{ u.ad_usuario || 'sin vincular' }}
        </span>
      </div>
```

d) Eliminar el bloque `<BaseModal :open="showPwd" title="Cambiar contraseña" …> … </BaseModal>` completo (líneas 164-174 del archivo actual).

- [ ] **Step 7: Borrar el login muerto de Afiliaciones**

Run:
```bash
grep -rn "afiliacion/views/LoginView\|@afi/views/LoginView\|@afi/stores/useAuthStore\|afiliacion/stores/useAuthStore\|@afi/api/authApi\|afiliacion/api/authApi" src | grep -v "^src/modules/afiliacion/views/LoginView.vue:" | grep -v "^src/modules/afiliacion/stores/useAuthStore.js:"
```
Expected: sin resultados. Si aparece algún importador, **no borrar** y reportar `DONE_WITH_CONCERNS` con la lista.

Si está vacío:
```bash
git rm src/modules/afiliacion/views/LoginView.vue src/modules/afiliacion/stores/useAuthStore.js src/modules/afiliacion/api/authApi.js
```

- [ ] **Step 8: Correr los tests y verificar que pasan**

Run: `npx vitest run src/stores/__tests__/useAuthStore.login.spec.js src/views/auth/__tests__/Login.spec.js src/views/perfil/__tests__/MiPerfil.spec.js`
Expected: PASS.

Run: `npx vitest run 2>&1 | tail -8`
Expected: todas las suites en verde.

- [ ] **Step 9: Build**

Run: `npm run build 2>&1 | tail -6`
Expected: termina con `dist/sw.js` generado, sin errores.

- [ ] **Step 10: Commit**

```bash
git add src/api/authApi.js src/stores/useAuthStore.js src/views/auth/Login.vue src/views/perfil/MiPerfil.vue src/stores/__tests__/useAuthStore.login.spec.js src/views/auth/__tests__/Login.spec.js src/views/perfil/__tests__/MiPerfil.spec.js
git add -A src/modules/afiliacion
git status --short
git commit -m "feat(auth): login de GenFlow con usuario de red y perfil sin cambio de clave"
```

---

### Task 9: Gestión de usuarios con usuario de red (GenFlow)

Repo: `crm-frontend`.

**Files:**
- Modify: `src/api/usuariosApi.js`
- Create: `src/utils/nombres.js`
- Create: `src/components/admin/BuscadorUsuarioRed.vue`
- Modify: `src/views/admin/GestionUsuarios.vue` (reescritura completa)
- Test: `src/utils/__tests__/nombres.spec.js`, `src/components/admin/__tests__/BuscadorUsuarioRed.spec.js`, `src/views/admin/__tests__/GestionUsuarios.spec.js`

**Interfaces:**
- Consumes: `GET /api/sv/usuarios/directorio?q=` → `{ success, data: [{ usuario, nombre, mail }] }`; `POST/PUT /api/sv/usuarios` con `ad_usuario`; `GET /api/sv/usuarios` con `ad_usuario` (Task 6).
- Produces: `usuariosApi.directorio(q)`; `separarNombre(completo) → { nombre, apellido }`; componente `<BuscadorUsuarioRed v-model="…" :required="bool" @seleccionar="item => …" />`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/utils/__tests__/nombres.spec.js`:

```js
import { describe, it, expect } from 'vitest';
import { separarNombre } from '@/utils/nombres';

describe('separarNombre', () => {
  it.each([
    ['PATRICIA SANTAFE', { nombre: 'PATRICIA', apellido: 'SANTAFE' }],
    ['ANA MARIA GOMEZ', { nombre: 'ANA', apellido: 'MARIA GOMEZ' }],
    ['ANA MARIA GOMEZ PEREZ', { nombre: 'ANA MARIA', apellido: 'GOMEZ PEREZ' }],
    ['  CAMILO   OMAÑA  ', { nombre: 'CAMILO', apellido: 'OMAÑA' }],
    ['MONONOMBRE', { nombre: 'MONONOMBRE', apellido: '' }],
    ['', { nombre: '', apellido: '' }]
  ])('%p', (entrada, esperado) => {
    expect(separarNombre(entrada)).toEqual(esperado);
  });
});
```

Crear `src/components/admin/__tests__/BuscadorUsuarioRed.spec.js`:

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/usuariosApi', () => ({ usuariosApi: { directorio: vi.fn() } }));

import { usuariosApi } from '@/api/usuariosApi';
import BuscadorUsuarioRed from '@/components/admin/BuscadorUsuarioRed.vue';

function factory(props = {}) {
  return mount(BuscadorUsuarioRed, {
    props: { modelValue: '', ...props },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })] }
  });
}

async function escribir(w, texto) {
  await w.find('[data-testid="buscador-usuario-red"]').setValue(texto);
  vi.advanceTimersByTime(300);
  await flushPromises();
}

describe('BuscadorUsuarioRed', () => {
  // Solo se falsea setTimeout: flushPromises usa setImmediate y se colgaría si también se falsea.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); vi.clearAllMocks(); });
  afterEach(() => vi.useRealTimers());

  it('no consulta con menos de 3 caracteres', async () => {
    const w = factory();
    await escribir(w, 'pa');
    expect(usuariosApi.directorio).not.toHaveBeenCalled();
  });

  it('consulta tras 300 ms y lista los resultados', async () => {
    usuariosApi.directorio.mockResolvedValue({ data: [{ usuario: 'psantafe', nombre: 'PATRICIA SANTAFE', mail: 'p@x.co' }] });
    const w = factory();
    await escribir(w, 'santa');
    expect(usuariosApi.directorio).toHaveBeenCalledWith('santa');
    expect(w.find('[data-testid="resultados-usuario-red"]').text()).toContain('PATRICIA SANTAFE');
    expect(w.text()).toContain('psantafe');
  });

  it('al elegir emite el usuario y el item', async () => {
    const item = { usuario: 'psantafe', nombre: 'PATRICIA SANTAFE', mail: 'p@x.co' };
    usuariosApi.directorio.mockResolvedValue({ data: [item] });
    const w = factory();
    await escribir(w, 'santa');
    await w.find('[data-testid="resultados-usuario-red"] button').trigger('click');
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['psantafe']);
    expect(w.emitted('seleccionar')[0]).toEqual([item]);
    expect(w.find('[data-testid="resultados-usuario-red"]').exists()).toBe(false);
  });

  it('muestra el error del backend', async () => {
    usuariosApi.directorio.mockRejectedValue({ response: { data: { message: 'No hay conexión con el directorio activo, intenta en unos minutos.' } } });
    const w = factory();
    await escribir(w, 'santa');
    expect(w.text()).toContain('No hay conexión con el directorio activo, intenta en unos minutos.');
  });
});
```

Crear `src/views/admin/__tests__/GestionUsuarios.spec.js`:

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/api/usuariosApi', () => ({
  usuariosApi: {
    list: vi.fn().mockResolvedValue({ data: [
      { usr_id: 1, usr_nombre: 'Ana', usr_apellido: 'G', usr_email: 'a@x.co', usr_activo: 1, usr_rol_id: 4, ad_usuario: 'agomez', rol: { rol_codigo: 'ASESOR' } },
      { usr_id: 2, usr_nombre: 'Beto', usr_apellido: 'R', usr_email: 'b@x.co', usr_activo: 1, usr_rol_id: 4, ad_usuario: null, rol: { rol_codigo: 'ASESOR' } }
    ] }),
    create: vi.fn().mockResolvedValue({ data: {} }),
    update: vi.fn(), toggle: vi.fn(), directorio: vi.fn()
  }
}));
vi.mock('@/api/configApi', () => ({
  configApi: {
    areas:  { list: vi.fn().mockResolvedValue({ data: [] }) },
    grupos: { list: vi.fn().mockResolvedValue({ data: [] }) },
    puntos: { list: vi.fn().mockResolvedValue({ data: [] }) }
  }
}));

import { usuariosApi } from '@/api/usuariosApi';
import GestionUsuarios from '@/views/admin/GestionUsuarios.vue';
import BuscadorUsuarioRed from '@/components/admin/BuscadorUsuarioRed.vue';

async function factory() {
  const w = mount(GestionUsuarios, {
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } },
    attachTo: document.body
  });
  await flushPromises();
  return w;
}

describe('GestionUsuarios.vue', () => {
  it('muestra el usuario de red y marca los no vinculados', async () => {
    const w = await factory();
    expect(w.text()).toContain('agomez');
    expect(w.text()).toContain('sin vincular');
    expect(w.text()).not.toContain('🔑');
  });

  it('el alta pide usuario de red y no contraseña', async () => {
    const w = await factory();
    await w.findAll('button').find(b => b.text().includes('Nuevo Usuario')).trigger('click');
    expect(w.findComponent(BuscadorUsuarioRed).exists()).toBe(true);
    expect(w.find('input[type="password"]').exists()).toBe(false);
  });

  it('al elegir una cuenta del AD rellena nombre, apellido y correo vacíos, y la envía al crear', async () => {
    const w = await factory();
    await w.findAll('button').find(b => b.text().includes('Nuevo Usuario')).trigger('click');
    const buscador = w.findComponent(BuscadorUsuarioRed);
    buscador.vm.$emit('update:modelValue', 'psantafe');
    buscador.vm.$emit('seleccionar', { usuario: 'psantafe', nombre: 'PATRICIA SANTAFE', mail: 'PSantafe@X.co' });
    await flushPromises();

    await w.findAll('button').find(b => b.text() === 'Crear').trigger('click');
    await flushPromises();

    expect(usuariosApi.create).toHaveBeenCalledWith(expect.objectContaining({
      ad_usuario: 'psantafe', usr_nombre: 'PATRICIA', usr_apellido: 'SANTAFE', usr_email: 'psantafe@x.co'
    }));
    expect(usuariosApi.create.mock.calls[0][0]).not.toHaveProperty('usr_password');
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/utils/__tests__/nombres.spec.js src/components/admin/__tests__/BuscadorUsuarioRed.spec.js src/views/admin/__tests__/GestionUsuarios.spec.js`
Expected: FAIL — no existen `@/utils/nombres` ni `BuscadorUsuarioRed.vue`.

- [ ] **Step 3: Actualizar `usuariosApi`**

Reemplazar todo `src/api/usuariosApi.js` por:

```js
import api from './axios';

export const usuariosApi = {
  list  : (params = {}) => api.get('/usuarios', { params }).then(r => r.data),
  accesibles: () => api.get('/usuarios/accesibles').then(r => r.data),
  directorio: (q) => api.get('/usuarios/directorio', { params: { q } }).then(r => r.data),
  get   : (id) => api.get(`/usuarios/${id}`).then(r => r.data),
  create: (data) => api.post('/usuarios', data).then(r => r.data),
  update: (id, data) => api.put(`/usuarios/${id}`, data).then(r => r.data),
  toggle: (id) => api.patch(`/usuarios/${id}/toggle`).then(r => r.data)
};
```

- [ ] **Step 4: Crear `separarNombre`**

Crear `src/utils/nombres.js`:

```js
/**
 * Separa el displayName del directorio activo en nombre y apellido.
 * Con 4 o más palabras asume dos nombres; si no, solo la primera es nombre.
 */
export function separarNombre(completo) {
  const partes = String(completo || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombre: partes[0] || '', apellido: '' };
  const cuantos = partes.length >= 4 ? 2 : 1;
  return { nombre: partes.slice(0, cuantos).join(' '), apellido: partes.slice(cuantos).join(' ') };
}
```

- [ ] **Step 5: Crear el buscador**

Crear `src/components/admin/BuscadorUsuarioRed.vue`:

```vue
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { usuariosApi } from '@/api/usuariosApi';
import { useApiError } from '@/composables/useApiError';

const props = defineProps({
  modelValue: { type: String, default: '' },
  required:   { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'seleccionar']);
const { extract } = useApiError();

const MIN_CARACTERES = 3;
const ESPERA_MS = 300;

const texto = ref(props.modelValue || '');
const resultados = ref([]);
const cargando = ref(false);
const error = ref('');
let temporizador = null;

watch(() => props.modelValue, (v) => { if ((v || '') !== texto.value) texto.value = v || ''; });

function buscar() {
  clearTimeout(temporizador);
  error.value = '';
  const q = texto.value.trim();
  if (q.length < MIN_CARACTERES) { resultados.value = []; return; }
  temporizador = setTimeout(async () => {
    cargando.value = true;
    try {
      const r = await usuariosApi.directorio(q);
      resultados.value = r.data || [];
    } catch (e) {
      error.value = extract(e);
      resultados.value = [];
    } finally {
      cargando.value = false;
    }
  }, ESPERA_MS);
}

function onInput(e) {
  texto.value = e.target.value;
  emit('update:modelValue', texto.value.trim());
  buscar();
}

function elegir(item) {
  clearTimeout(temporizador);
  texto.value = item.usuario;
  resultados.value = [];
  emit('update:modelValue', item.usuario);
  emit('seleccionar', item);
}

onBeforeUnmount(() => clearTimeout(temporizador));
</script>

<template>
  <div class="relative">
    <label class="sv-label">
      Usuario de red
      <span v-if="required" class="text-danger ml-0.5">*</span>
    </label>
    <input
      :value="texto"
      type="text"
      class="sv-input"
      placeholder="Busca por nombre, usuario o correo"
      autocomplete="off"
      data-testid="buscador-usuario-red"
      @input="onInput"
    />
    <p v-if="cargando" class="mt-1 text-xs text-text3">Buscando en el directorio…</p>
    <p v-else-if="error" class="mt-1 text-xs text-danger">{{ error }}</p>
    <ul
      v-if="resultados.length"
      class="absolute z-10 mt-1 w-full max-h-60 overflow-auto sv-card divide-y divide-text3/10"
      data-testid="resultados-usuario-red"
    >
      <li v-for="r in resultados" :key="r.usuario">
        <button type="button" class="w-full text-left px-3 py-2 hover:bg-cream" @click="elegir(r)">
          <div class="text-sm font-semibold text-text1">{{ r.nombre || r.usuario }}</div>
          <div class="text-xs text-text3">{{ r.usuario }}<span v-if="r.mail"> · {{ r.mail }}</span></div>
        </button>
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 6: Reescribir `GestionUsuarios.vue`**

Reemplazar todo `src/views/admin/GestionUsuarios.vue` por:

```vue
<script setup>
import { ref, onMounted, computed } from 'vue';
import { usuariosApi } from '@/api/usuariosApi';
import { configApi } from '@/api/configApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { separarNombre } from '@/utils/nombres';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import AreaBadge from '@/components/common/AreaBadge.vue';
import BuscadorUsuarioRed from '@/components/admin/BuscadorUsuarioRed.vue';

const toast = useToastStore();
const { notify } = useApiError();

const usuarios = ref([]);
const areas = ref([]);
const grupos = ref([]);
const roles = ref([]);
const puntos = ref([]);
const loading = ref(true);
const q = ref('');

const showModal = ref(false);
const editing = ref(null);
const form = ref({});
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    const [u, a, g, p] = await Promise.all([
      usuariosApi.list(q.value ? { q: q.value } : {}),
      configApi.areas.list(),
      configApi.grupos.list(),
      configApi.puntos.list()
    ]);
    usuarios.value = u.data;
    areas.value = a.data;
    grupos.value = g.data;
    puntos.value = p.data;
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(async () => {
  // TODO: reemplazar este hardcode por GET /api/sv/usuarios/roles cuando exista
  // el endpoint dedicado. Los rol_id corresponden al estado actual de sv_org_roles
  // en producción — si se reordenan, romperán el form.
  roles.value = [
    { rol_id: 1,  rol_codigo: 'SUPER_ADMIN',           rol_nombre: 'Super Administrador',          rol_nivel: 1 },
    { rol_id: 11, rol_codigo: 'GERENTE_GENERAL',       rol_nombre: 'Gerente General',              rol_nivel: 2 },
    { rol_id: 51, rol_codigo: 'DIRECTOR_COMERCIAL',    rol_nombre: 'Director Comercial',           rol_nivel: 2 },
    { rol_id: 2,  rol_codigo: 'ADMIN_AREA',            rol_nombre: 'Administrador de Área',        rol_nivel: 2 },
    { rol_id: 49, rol_codigo: 'JEFE_PAP',              rol_nombre: 'Jefe PAP',                     rol_nivel: 2 },
    { rol_id: 3,  rol_codigo: 'SUPERVISOR',            rol_nombre: 'Supervisor de Grupo',          rol_nivel: 3 },
    { rol_id: 52, rol_codigo: 'COORDINADOR_PREVISION', rol_nombre: 'Coordinador de Previsión',     rol_nivel: 3 },
    { rol_id: 4,  rol_codigo: 'ASESOR',                rol_nombre: 'Asesor Comercial',             rol_nivel: 4 },
    { rol_id: 5,  rol_codigo: 'AGENTE_SVC',            rol_nombre: 'Agente Servicio al Cliente',   rol_nivel: 4 }
  ];
  await load();
});

const opcArea  = computed(() => [{ value: '', label: '—' }, ...areas.value.map(a => ({ value: a.area_id, label: `${a.area_codigo} — ${a.area_nombre}` }))]);
const opcGrupo = computed(() => [{ value: '', label: '—' }, ...grupos.value.map(g => ({ value: g.grupo_id, label: g.grupo_codigo }))]);
const opcRol   = computed(() => roles.value.map(r => ({ value: r.rol_id, label: `${r.rol_codigo} — ${r.rol_nombre}` })));
const opcPunto = computed(() => [{ value: '', label: '—' }, ...puntos.value.map(p => ({ value: p.punto_id, label: p.punto_codigo }))]);

function abrirNuevo() {
  editing.value = null;
  form.value = { usr_area_id: '', usr_grupo_id: '', usr_rol_id: 4, usr_punto_id: '', usr_email: '', usr_nombre: '', usr_apellido: '', usr_telefono: '', ad_usuario: '', usr_activo: 1 };
  showModal.value = true;
}

function abrirEdicion(u) {
  editing.value = u;
  form.value = {
    usr_area_id: u.usr_area_id || '',
    usr_grupo_id: u.usr_grupo_id || '',
    usr_rol_id: u.usr_rol_id,
    usr_punto_id: u.usr_punto_id || '',
    usr_email: u.usr_email,
    usr_nombre: u.usr_nombre,
    usr_apellido: u.usr_apellido,
    usr_telefono: u.usr_telefono || '',
    ad_usuario: u.ad_usuario || '',
    usr_activo: u.usr_activo
  };
  showModal.value = true;
}

function onElegirCuentaAd(item) {
  if (!form.value.usr_nombre && !form.value.usr_apellido) {
    const { nombre, apellido } = separarNombre(item.nombre);
    form.value.usr_nombre = nombre;
    form.value.usr_apellido = apellido;
  }
  if (!form.value.usr_email && item.mail) form.value.usr_email = item.mail.toLowerCase();
}

async function guardar() {
  if (!editing.value && !form.value.ad_usuario) {
    toast.warning('Elige el usuario de red de la persona.');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...form.value };
    for (const k of ['usr_area_id','usr_grupo_id','usr_punto_id']) {
      if (payload[k] === '' || payload[k] === undefined) payload[k] = null;
      else if (payload[k] != null) payload[k] = parseInt(payload[k]);
    }
    payload.usr_rol_id = parseInt(payload.usr_rol_id);
    if (editing.value) {
      if (!payload.ad_usuario || payload.ad_usuario === (editing.value.ad_usuario || '')) delete payload.ad_usuario;
      await usuariosApi.update(editing.value.usr_id, payload);
      toast.success('Usuario actualizado.');
    } else {
      await usuariosApi.create(payload);
      toast.success('Usuario creado.');
    }
    showModal.value = false;
    await load();
  } catch (e) { notify(e); }
  finally { saving.value = false; }
}

async function toggle(u) {
  try { await usuariosApi.toggle(u.usr_id); await load(); } catch (e) { notify(e); }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
    <header class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="font-serif text-3xl text-brown-deep">Usuarios</h1>
      <BaseButton variant="primary" @click="abrirNuevo">+ Nuevo Usuario</BaseButton>
    </header>

    <div class="sv-card p-4 mb-4 flex flex-wrap items-end gap-3">
      <div class="flex-1 min-w-[200px]">
        <BaseInput v-model="q" label="Buscar (nombre, email)" placeholder="Carmen, supervisor.tele..." @keyup.enter="load" />
      </div>
      <BaseButton variant="secondary" @click="load">Buscar</BaseButton>
    </div>

    <div class="sv-card overflow-x-auto">
      <div v-if="loading" class="px-5 py-12 text-text3 text-center">Cargando...</div>
      <EmptyState v-else-if="!usuarios.length" titulo="Sin usuarios" />
      <table v-else class="w-full text-sm">
        <thead class="bg-cream text-text2">
          <tr>
            <th class="text-left px-4 py-3">#</th>
            <th class="text-left px-4 py-3">Nombre</th>
            <th class="text-left px-4 py-3">Email</th>
            <th class="text-left px-4 py-3">Usuario de red</th>
            <th class="text-left px-4 py-3">Rol</th>
            <th class="text-left px-4 py-3">Área</th>
            <th class="text-left px-4 py-3">Grupo</th>
            <th class="text-left px-4 py-3">Punto</th>
            <th class="text-right px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-text3/10">
          <tr v-for="u in usuarios" :key="u.usr_id" :class="{ 'opacity-50': !u.usr_activo }">
            <td class="px-4 py-3 text-text3">{{ u.usr_id }}</td>
            <td class="px-4 py-3 font-semibold text-text1">{{ u.usr_nombre }} {{ u.usr_apellido }}</td>
            <td class="px-4 py-3 text-text2">{{ u.usr_email }}</td>
            <td class="px-4 py-3 font-mono" :class="u.ad_usuario ? 'text-text2' : 'text-danger'">{{ u.ad_usuario || 'sin vincular' }}</td>
            <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-gold/10 text-gold">{{ u.rol?.rol_codigo }}</span></td>
            <td class="px-4 py-3">
              <AreaBadge v-if="u.area" :codigo="u.area.area_codigo" :nombre="u.area.area_codigo" :color-hex="u.area.area_color_hex" size="sm" />
              <span v-else class="text-text3">—</span>
            </td>
            <td class="px-4 py-3 text-text2">{{ u.grupo?.grupo_codigo || '—' }}</td>
            <td class="px-4 py-3 text-text2">{{ u.punto?.punto_codigo || '—' }}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap space-x-2">
              <BaseButton size="sm" variant="ghost" @click="abrirEdicion(u)">Editar</BaseButton>
              <BaseButton size="sm" :variant="u.usr_activo ? 'secondary' : 'success'" @click="toggle(u)">
                {{ u.usr_activo ? 'Desactivar' : 'Activar' }}
              </BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal crear/editar -->
    <BaseModal :open="showModal" :title="editing ? 'Editar usuario' : 'Nuevo usuario'" max-width="max-w-2xl" @close="showModal = false">
      <form @submit.prevent="guardar" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <BuscadorUsuarioRed v-model="form.ad_usuario" :required="!editing" @seleccionar="onElegirCuentaAd" />
        </div>
        <BaseInput  v-model="form.usr_nombre"   label="Nombres"  required />
        <BaseInput  v-model="form.usr_apellido" label="Apellidos" required />
        <BaseInput  v-model="form.usr_email"    label="Email" type="email" required class="sm:col-span-2" />
        <BaseInput  v-model="form.usr_telefono" label="Teléfono" />
        <BaseSelect v-model="form.usr_rol_id"   label="Rol" :options="opcRol" required />
        <BaseSelect v-model="form.usr_area_id"  label="Área"   :options="opcArea" />
        <BaseSelect v-model="form.usr_grupo_id" label="Grupo"  :options="opcGrupo" />
        <BaseSelect v-model="form.usr_punto_id" label="Punto"  :options="opcPunto" />
        <label class="flex items-center gap-3 cursor-pointer sm:col-span-2">
          <input type="checkbox" :checked="!!form.usr_activo" @change="form.usr_activo = $event.target.checked ? 1 : 0" class="w-4 h-4 rounded border-text3/40 text-gold focus:ring-gold" />
          <span class="text-sm text-text2 font-semibold">Activo</span>
        </label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="showModal = false">Cancelar</BaseButton>
        <BaseButton variant="primary" :loading="saving" @click="guardar">{{ editing ? 'Guardar' : 'Crear' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `npx vitest run src/utils/__tests__/nombres.spec.js src/components/admin/__tests__/BuscadorUsuarioRed.spec.js src/views/admin/__tests__/GestionUsuarios.spec.js`
Expected: PASS.

Run: `npx vitest run 2>&1 | tail -8`
Expected: todas las suites en verde.

- [ ] **Step 8: Build y verificación de restos**

Run: `npm run build 2>&1 | tail -6 && grep -rn "resetPassword\|changePassword\|usr_password" src`
Expected: build sin errores; el `grep` sin resultados.

- [ ] **Step 9: Commit**

```bash
git add src/api/usuariosApi.js src/utils/nombres.js src/components/admin/BuscadorUsuarioRed.vue src/views/admin/GestionUsuarios.vue src/utils/__tests__/nombres.spec.js src/components/admin/__tests__/BuscadorUsuarioRed.spec.js src/views/admin/__tests__/GestionUsuarios.spec.js
git commit -m "feat(auth): gestión de usuarios con usuario de red del directorio activo"
```

---

### Task 10: Portal Serfunorte

Repo: `portal-frontend` (sin tests; se verifica con build y `grep`).

**Files:**
- Modify: `src/api/identidadApi.js`
- Modify: `src/stores/useIdentidadStore.js`
- Modify: `src/views/Login.vue` (reescritura completa)
- Modify: `src/router/index.js` (reescritura completa)
- Delete: `src/views/ResetPassword.vue`

**Interfaces:**
- Consumes: `POST /api/identidad/login` con `{ usuario, password }` (Task 4).
- Produces: `identidadApi.login(usuario, password)`; `useIdentidadStore().login(usuario, password)`; sin `mustReset`, `passwordCambiado` ni ruta `reset-password`.

- [ ] **Step 1: Verificar quién usa lo que se va a retirar**

Run: `grep -rn "reset-password\|ResetPassword\|cambiarPassword\|passwordCambiado\|mustReset\|must_reset" src`
Expected: solo `src/api/identidadApi.js`, `src/stores/useIdentidadStore.js`, `src/views/Login.vue`, `src/views/ResetPassword.vue` y `src/router/index.js`. Si aparece otro archivo (p. ej. un enlace en `SelectorApps.vue`), incluirlo en los cambios quitando ese enlace.

- [ ] **Step 2: Actualizar `identidadApi`**

En `src/api/identidadApi.js`, reemplazar:

```js
  login:           (email, password) => api.post('/login', { email, password }).then(r => r.data),
```

por:

```js
  login:           (usuario, password) => api.post('/login', { usuario, password }).then(r => r.data),
```

y eliminar la línea:

```js
  cambiarPassword: (actual, nueva)   => api.post('/cambiar-password', { actual, nueva }).then(r => r.data),
```

- [ ] **Step 3: Actualizar el store**

En `src/stores/useIdentidadStore.js`:
- Eliminar la línea `const mustReset = computed(() => !!identidad.value?.must_reset);`.
- Reemplazar la función `login` por:

```js
  async function login(usuario, password) {
    const r = await identidadApi.login(usuario, password);
    const payload = r?.data || r;
    accessToken.value  = payload.accessToken;
    refreshToken.value = payload.refreshToken;
    identidad.value    = payload.identidad;
    persist();
    return payload;
  }
```

- Eliminar la función `passwordCambiado` completa.
- Reemplazar el `return` final por:

```js
  return {
    accessToken, refreshToken, identidad,
    isAuthenticated, nombreCompleto, iniciales,
    login, logout, refrescarMe
  };
```

- [ ] **Step 4: Reescribir `Login.vue`**

Reemplazar todo `src/views/Login.vue` por:

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useIdentidadStore } from '@/stores/useIdentidadStore';

const router = useRouter();
const route  = useRoute();
const auth   = useIdentidadStore();

const usuario  = ref('');
const password = ref('');
const errMsg   = ref('');
const loading  = ref(false);

const nextApp = ref(route.query.next || '');

onMounted(() => {
  if (auth.isAuthenticated) {
    router.replace({ name: 'selector', query: route.query });
  }
});

async function enviar() {
  errMsg.value = '';
  loading.value = true;
  try {
    await auth.login(usuario.value.trim(), password.value);
    router.push({ name: 'selector', query: route.query });
  } catch (e) {
    errMsg.value = e.response?.data?.message || 'Error al iniciar sesión';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-4">
    <div class="w-full max-w-md">
      <div class="sv-card p-8">
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500/15 text-primary-700 text-3xl mb-3">
            🌿
          </div>
          <h1 class="text-3xl font-bold text-primary-700">Portal Serfunorte</h1>
          <p class="text-sm text-text3 mt-1">Los Olivos · Cúcuta</p>
          <p v-if="nextApp" class="text-xs text-text2 mt-3">
            Acceso a <strong class="capitalize">{{ nextApp }}</strong>
          </p>
        </div>

        <form @submit.prevent="enviar" class="space-y-4">
          <div>
            <label class="sv-label">Usuario de red o correo</label>
            <input v-model="usuario" type="text" required autofocus
                   class="sv-input"
                   autocomplete="username"
                   placeholder="psantafe" />
            <p class="mt-1 text-xs text-text3">Usa el mismo usuario y clave de Windows</p>
          </div>
          <div>
            <label class="sv-label">Contraseña</label>
            <input v-model="password" type="password" required
                   autocomplete="current-password"
                   class="sv-input" />
          </div>

          <div v-if="errMsg" class="rounded-sv bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
            {{ errMsg }}
          </div>

          <button type="submit"
                  :disabled="loading || !usuario.trim() || !password"
                  class="sv-btn-primary w-full py-3 text-base">
            {{ loading ? 'Ingresando...' : 'Iniciar sesión' }}
          </button>
        </form>

        <div class="text-center mt-5 text-xs text-text3">
          ¿Olvidaste tu contraseña? Contacta a TI.
        </div>
      </div>

      <p class="text-center text-cream/70 text-xs mt-4">
        Una sola sesión · Acceso a todas las aplicaciones autorizadas
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Reescribir el router y borrar la pantalla de reset**

Reemplazar todo `src/router/index.js` por:

```js
import { createRouter, createWebHistory } from 'vue-router';
import { useIdentidadStore } from '@/stores/useIdentidadStore';

const routes = [
  { path: '/', redirect: { name: 'selector' } },
  { path: '/login',          name: 'login',          component: () => import('@/views/Login.vue'),
    meta: { publica: true } },
  { path: '/selector',       name: 'selector',       component: () => import('@/views/SelectorApps.vue'),
    meta: { requiereAuth: true } },
  // Catch-all → login
  { path: '/:pathMatch(.*)*', redirect: { name: 'login' } }
];

const router = createRouter({
  history: createWebHistory('/portal/'),
  routes
});

router.beforeEach((to) => {
  const auth = useIdentidadStore();
  if (to.meta.publica) {
    if (to.name === 'login' && auth.isAuthenticated) {
      return { name: 'selector', query: to.query };
    }
    return true;
  }
  if (to.meta.requiereAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { ...to.query, next: to.query.next || '' } };
  }
  return true;
});

export default router;
```

Run: `git rm src/views/ResetPassword.vue`

- [ ] **Step 6: Verificar restos y build**

Run: `grep -rn "reset-password\|ResetPassword\|cambiarPassword\|passwordCambiado\|mustReset\|must_reset\|type=\"email\"" src`
Expected: sin resultados.

Run: `npm run build 2>&1 | tail -5`
Expected: build sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/api/identidadApi.js src/stores/useIdentidadStore.js src/views/Login.vue src/router/index.js
git status --short
git commit -m "feat(auth): portal entra con usuario de red; sin cambio de clave local"
```

---

### Task 11: Despliegue coordinado y smoke

Esta task la ejecuta el controlador junto con el usuario: varios pasos corren en el servidor o en MySQL de producción y **los hace el usuario**. No es para un subagente.

**Hecho que condiciona el orden:** el backend termina el proceso ante cualquier promesa rechazada sin manejar (`server.js`: `unhandledRejection → process.exit(1)`) y pm2 lo reinicia con el código que haya en disco. El código viejo hace `bcrypt.compare(clave, NULL)`, que lanza error. No existe un estado intermedio seguro con el código nuevo en disco, el viejo corriendo y identidades sin clave ya escritas: `--aplicar` y el reinicio van seguidos.

**Files:** ninguno.

- [ ] **Step 1: Suites completas antes de publicar**

Backend: `npx jest 2>&1 | tail -15` → solo fallan las cinco suites preexistentes (`test/grupoIndivII.test.js`, `tests/invitacion.service.test.js`, `src/masajes/__tests__/adapters.test.js`, `src/masajes/__tests__/adapters.n8n.test.js`, `tests/afiliadoEmpresaAccess.test.js`).
GenFlow: `npx vitest run 2>&1 | tail -8` → todo verde; `npm run build` limpio.
Portal: `npm run build` limpio.

- [ ] **Step 2 (usuario): Verificaciones previas**

1. pm2: `pm2 describe <app>` → número de instancias y que **no** esté en modo *watch* (con *watch*, el `git pull` del Step 5 reiniciaría solo).
2. Política de bloqueo del dominio: `net accounts /domain` → umbral y ventana de observación. Debe superar lo que permiten juntos GenFlow/Portal (5 fallos por entrada cada 15 min, por instancia de pm2), Portería (10) y H360 en la misma ventana. Si es más estricta, detenerse y replantear el límite antes del corte.
3. Respaldos para poder revertir copiando:
   ```bash
   cp -a /Volumes/AppServ/www/genflow /Volumes/AppServ/www/genflow.bak-2026-11-17
   ```
   y la carpeta publicada del Portal (preguntar al usuario la ruta; base `/portal/`). Revisar si esa carpeta tiene un `.htaccess` que un `rsync --delete` borraría.

- [ ] **Step 3: Push de backend y GenFlow (pedir confirmación al usuario antes)**

```bash
git -C "/Users/bortega/Shared/Files From c.localized/apps/mantix/mantix-backend" push origin main
git -C "/Users/bortega/Shared/Files From c.localized/apps/mantix/crm-frontend" push origin main
```

El Portal no tiene remoto: se publica copiando su `dist/` en el Step 9.

- [ ] **Step 4 (usuario): Migración 022 en producción**

```bash
mysql -u root -p serfuweb < src/sv/migrations/022_identidad_ad.sql
```

Verificación:

```sql
SHOW COLUMNS FROM org_identidad LIKE 'ad_usuario';
SHOW INDEX FROM org_identidad WHERE Key_name = 'uq_identidad_ad_usuario';
```

La migración es inofensiva para el código viejo: solo agrega una columna y permite NULL en las claves, sin escribir ninguna.

- [ ] **Step 5 (usuario): `git pull` sin reiniciar y simulación**

En el servidor, dentro de `mantix-backend`:

```bash
git pull origin main
node src/identity/scripts/vincular-ad.js
```

La simulación no escribe nada, así que es segura con el código viejo corriendo; además prueba la conexión al AD. Si falla con `AD_NO_DISPONIBLE` o un error de bind, detenerse: el corte no puede hacerse sin AD.

Revisar el reporte con el usuario. Contar en "sin coincidencia" las identidades que no tienen usuario de ventas (gente que solo usa el Portal o Afiliaciones): perderán el Portal hasta vincularlas.

- [ ] **Step 6 (usuario): Vincular por SQL lo que no puede esperar al corte**

Solo `UPDATE` de `ad_usuario`; no afecta al código viejo:

```sql
UPDATE org_identidad
   SET ad_usuario = LOWER('<usuario_de_red>')
 WHERE email_norm = '<correo>' AND ad_usuario IS NULL;
```

Obligatorio antes del Step 7:
1. Las cuentas de los administradores.
2. **Todos** los casos "revisar" con **varios candidatos**: la vinculación automática del login no aplica la regla de candidato único y vincularía al primero que entre.

Comprobación de administradores (ninguna fila con `ad_usuario` NULL):

```sql
SELECT u.usr_email, r.rol_codigo, i.ad_usuario
  FROM sv_org_usuarios u
  JOIN sv_org_roles r       ON r.rol_id = u.usr_rol_id
  LEFT JOIN org_identidad i ON i.id_identidad = u.usr_id_identidad
 WHERE u.usr_activo = 1
   AND r.rol_codigo IN ('SUPER_ADMIN', 'GERENTE_GENERAL', 'ADMIN_AREA');
```

Si un administrador no tiene identidad (`usr_id_identidad` NULL), el `--aplicar` del Step 7 se la crea a partir de su correo y la vincula si su `mail` del AD coincide. Si no coincide, vincularla en el Step 8.

- [ ] **Step 7 (usuario): Aplicar e, inmediatamente, el corte**

En una sola línea, sin pausa:

```bash
node src/identity/scripts/vincular-ad.js --aplicar && deploy-mantix
```

Confirmar en los logs de pm2 que el proceso arrancó sin `Cannot find module`.

- [ ] **Step 8 (usuario): SQL de los casos restantes**

Con el `UPDATE` del Step 6: los "revisar" de un solo candidato, los "sin coincidencia" que se identifiquen y los administradores sin vincular.

- [ ] **Step 9: Frontends, en seguida del corte**

GenFlow:

```bash
cd "/Users/bortega/Shared/Files From c.localized/apps/mantix/crm-frontend"
npm run build
rsync -av --delete dist/ /Volumes/AppServ/www/genflow/
```

Verificar paridad de `dist/assets` local vs servidor (recuento de archivos); si el SMB perdió archivos, copiarlos con `cp`.

Portal: copiar `portal-frontend/dist/` a su ruta de publicación (la confirmada en el Step 2), cuidando el `.htaccess` si existe. Hacerlo pronto: el Portal viejo tiene un campo `type="email"` que bloquea los usuarios de red.

- [ ] **Step 10 (usuario): Smoke**

1. GenFlow: entrar con usuario de red → entra.
2. GenFlow: entrar con el correo de una cuenta vinculada → entra.
3. Clave errada → *"Usuario o contraseña incorrectos"*.
4. Cuenta del AD sin usuario en GenFlow → *"Tu usuario de red no tiene acceso a GenFlow."*
5. Mi perfil muestra el usuario de red y no ofrece cambiar la clave (en una sesión previa al corte, cerrar sesión y volver a entrar).
6. Gestión de usuarios: buscar una cuenta del AD, crear un usuario, cerrar sesión y entrar con él.
7. Portal: entrar con usuario de red → selector de apps.
8. Logs: sin `Unhandled Rejection`; revisar respuestas 429 inesperadas (oficinas detrás de una misma IP).

- [ ] **Step 11: Reversión (solo si el smoke falla gravemente)**

En este orden:

1. SQL, antes de arrancar el código viejo:
   ```sql
   UPDATE org_identidad   SET password_hash     = '!' WHERE password_hash     IS NULL;
   UPDATE sv_org_usuarios SET usr_password_hash = '!' WHERE usr_password_hash IS NULL;
   ```
   `'!'` nunca coincide con una clave y bcrypt no falla con él; con NULL el código viejo tumba el proceso en cada intento.
2. En el servidor: `git revert` de los commits del backend de este plan y `deploy-mantix`.
3. Restaurar GenFlow y el Portal desde los respaldos del Step 2 (los builds nuevos envían `usuario` y el backend viejo exige `email`). El service worker de GenFlow puede servir la versión en caché: pedir recargar con Cmd/Ctrl+Shift+R.
4. Conservar `SV_JWT_SECRET` y `SV_JWT_REFRESH_SECRET` en el `.env` hasta cerrar la ventana de reversión.

Los usuarios creados después del corte quedan sin clave usable tras revertir; habría que asignársela a mano.

---

## Self-review

- **Cobertura del spec:** §3 datos → Task 1; §4 flujo y §4.1 errores → Tasks 3-4; §4.2 límite → Task 4; §5 script → Task 5; §6 alta/edición y directorio → Tasks 6 y 9; §7.1 retiro backend → Tasks 3, 4 y 7; §7.2 GenFlow → Tasks 8-9; §7.3 Portal → Task 10; §8 logs → Task 3; §9 pruebas → todas; §10 despliegue y reversión → Task 11.
- **Nombres consistentes:** `normalizarAdUsuario`, `asegurarIdentidad`, `vincularAdUsuario`, `VinculoAdError` (Task 2) se usan con la misma firma en las Tasks 3, 5 y 6; `resolverIdentidad` y `adUsuariosPorIdentidad` (Task 6) se usan en la Task 7; `usuariosApi.directorio` (Task 9) coincide con `GET /usuarios/directorio` (Task 6); `authApi.login({ usuario, password })` (Task 8) coincide con el controller (Task 4).
- **Pendientes conocidos:** fallan dos suites del backend que ya fallaban antes (`test/grupoIndivII.test.js`, `tests/invitacion.service.test.js`); no son de este plan.
