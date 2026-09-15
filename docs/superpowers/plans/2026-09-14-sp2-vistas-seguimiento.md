# SP-2 · Vistas de seguimiento agenda (semana + listado + multi-asesor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan task-by-task. Steps usan `- [ ]` para tracking.

**Goal:** Dar a Director / Coordinador / Supervisor una vista de seguimiento con 3 modos (Semana grid · Mes calendario · Listado tabla), selector multi-asesor y KPIs mínimos, para que puedan ver la agenda de todo su equipo o de un asesor específico y encontrar rápido los eventos creados y los links públicos activos.

**Architecture:** Backend agrega 2 endpoints (`/agenda/semana` + `/eventos-agenda/listado`) reutilizando `agenda.service` + `eventosAgenda.service`. Frontend crea un `AgendaSeguimientoView.vue` con 3 sub-vistas (`SemanaGrid` · `MesCalendario` (reutiliza el existente) · `EventoListadoTabla`) y un `SelectorAsesoresMulti` compartido. Nueva ruta `/agenda/seguimiento` visible sólo para roles supervisor+. **Gantt-timeline multi-asesor por hora se difiere a un SP-2b futuro** — la vista Semana ya cubre el caso "quién tiene qué esta semana" a nivel de día.

**Tech Stack:** Node.js + Express + Sequelize · Vue 3 + Pinia + Tailwind · Jest (backend) · Vitest (frontend).

**Fuera de scope:** Gantt-timeline por hora con filas × asesor (deferido); KPIs dashboard (deferido); OTP de edición (SP-3).

## Global Constraints

- Rutas backend nuevas bajo `/api/sv/agenda/*` y `/api/sv/eventos-agenda/*`, con `svAuth + svAreaGuard`.
- Rutas y componente accesibles SÓLO para `ROLES_SUPERVISORES` (SUPER_ADMIN, GERENTE_GENERAL, DIRECTOR_COMERCIAL, ADMIN_AREA, JEFE_PAP, SUPERVISOR, COORDINADOR_PREVISION).
- Un evento aparece si el asesor consultado es dueño (`evento_asesor_id`) O asistente activo (`sv_org_eventos_asistentes.eva_activo=1`). Ya implementado en `agenda.service.js` desde `e52e967` — reutilizar.
- Rango de fechas: eventos que cubren un día aparecen en ese día (soporte para `DIA_COMPLETO_MULTI`).
- Fechas en zona `America/Bogota`.
- Attribution: cada subagente firma con su propio modelo (política SDD).
- Vitest configurado (SP-4 Task 6); usar `stubs: { teleport: true }` si aplica.

---

## File Structure

**Backend:**
- Modify: `mantix-backend/src/sv/services/agenda.service.js` (agregar `listarSemana`)
- Modify: `mantix-backend/src/sv/services/eventosAgenda.service.js` (agregar `listado`)
- Modify: `mantix-backend/src/sv/controllers/agenda.controller.js` (2 handlers)
- Modify: `mantix-backend/src/sv/routes/agenda.routes.js` (2 rutas)
- Create: `mantix-backend/tests/agendaSemana.service.test.js`
- Create: `mantix-backend/tests/eventosListado.service.test.js`

**Frontend:**
- Modify: `crm-frontend/src/api/agendaApi.js` (2 nuevos endpoints)
- Create: `crm-frontend/src/views/comun/AgendaSeguimientoView.vue`
- Create: `crm-frontend/src/components/agenda/SelectorAsesoresMulti.vue`
- Create: `crm-frontend/src/components/agenda/SemanaGrid.vue`
- Create: `crm-frontend/src/components/agenda/EventoListadoTabla.vue`
- Modify: `crm-frontend/src/router/index.js`
- Modify: `crm-frontend/src/components/layout/AppSidebar.vue`

---

## Task 1: Backend service `agenda.listarSemana`

**Files:**
- Modify: `mantix-backend/src/sv/services/agenda.service.js` (agregar función)
- Create: `mantix-backend/tests/agendaSemana.service.test.js`

**Interfaces:**
- Produces: `listarSemana({ anio, semanaISO, asesoresIds, actor }) → Promise<{lunes: 'YYYY-MM-DD', domingo: 'YYYY-MM-DD', por_dia: {[fecha]: {eventos:[], gestiones:[]}}}>`.
- Aplica scope: si el actor es supervisor+, `asesoresIds` filtra a esos usuarios específicos (todos deben estar en `usuariosAccesibles`). Si `asesoresIds` es `[]` o `null`, incluye todo el scope del actor.

- [ ] **Step 1: Test primero**

Path: `mantix-backend/tests/agendaSemana.service.test.js`

```js
const mockEv    = { findAll: jest.fn() };
const mockAsis  = { findAll: jest.fn() };
const mockProsp = { findAll: jest.fn() };
const mockUsr   = { findAll: jest.fn(), findByPk: jest.fn() };
const mockEstado = {}, mockPersona = {}, mockEmpresa = {};

jest.mock('../src/sv/models', () => ({
  SvEventoAgenda: mockEv, SvEventoAsistente: mockAsis,
  SvProspecto: mockProsp, SvUsuario: mockUsr,
  SvEstado: mockEstado, SvPersona: mockPersona, SvEmpresa: mockEmpresa
}));
jest.mock('../src/sv/utils/acceso', () => ({
  grupoIdsAccesibles: jest.fn(() => [3, 4]),
  usuariosAccesibles: jest.fn()
}));

const svc = require('../src/sv/services/agenda.service');
const acceso = require('../src/sv/utils/acceso');

const jefe = { usr_id: 20, rol: { rol_codigo: 'COORDINADOR_PREVISION' } };

beforeEach(() => {
  jest.clearAllMocks();
  mockAsis.findAll.mockResolvedValue([]);
  mockUsr.findAll.mockResolvedValue([{ usr_id: 10 }, { usr_id: 11 }]);
  mockProsp.findAll.mockResolvedValue([]);
  mockEv.findAll.mockResolvedValue([]);
});

describe('listarSemana', () => {
  test('calcula lunes-domingo de una semana ISO', async () => {
    // Semana 38 de 2026: lunes 14/09 → domingo 20/09
    acceso.usuariosAccesibles.mockResolvedValue([10, 11]);
    const r = await svc.listarSemana({ anio: 2026, semanaISO: 38, asesoresIds: [], actor: jefe });
    expect(r.lunes).toBe('2026-09-14');
    expect(r.domingo).toBe('2026-09-20');
    expect(Object.keys(r.por_dia)).toHaveLength(7);
  });

  test('rechaza asesoresIds fuera del scope del actor', async () => {
    acceso.usuariosAccesibles.mockResolvedValue([10, 11]);
    await expect(svc.listarSemana({
      anio: 2026, semanaISO: 38, asesoresIds: [10, 999], actor: jefe
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('con asesoresIds vacío usa todo el scope del actor', async () => {
    acceso.usuariosAccesibles.mockResolvedValue([10, 11]);
    await svc.listarSemana({ anio: 2026, semanaISO: 38, asesoresIds: [], actor: jefe });
    // Espera que consulte eventos donde asesor_id in [10,11] o asistente activo
    expect(mockEv.findAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: RED**

Run:
```bash
cd mantix-backend && npx jest tests/agendaSemana.service.test.js --no-coverage
```
Expected: FAIL — `svc.listarSemana is not a function`.

- [ ] **Step 3: Implementar en agenda.service.js**

Al final del archivo (antes de `module.exports`), agregar:

```js
/**
 * Rango lunes-domingo de una semana ISO 8601.
 * ISO week: lunes es día 1; primera semana del año contiene el 4 de enero.
 */
function rangoSemanaISO(anio, semana) {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 1..7 (dom=7)
  const lunesW1 = new Date(jan4);
  lunesW1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const lunes = new Date(lunesW1);
  lunes.setUTCDate(lunesW1.getUTCDate() + (semana - 1) * 7);
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { lunes: fmt(lunes), domingo: fmt(domingo) };
}

async function listarSemana({ anio, semanaISO, asesoresIds, actor }) {
  const { usuariosAccesibles } = require('../utils/acceso');
  const scope = await usuariosAccesibles(actor); // null = super_admin, [] fallback = self
  const idsPedidos = Array.isArray(asesoresIds) ? asesoresIds.map(n => parseInt(n)).filter(Boolean) : [];

  // Validar scope
  let idsFinal;
  if (idsPedidos.length === 0) {
    idsFinal = scope; // null o [ids]
  } else {
    if (scope !== null) {
      const fuera = idsPedidos.filter(id => !scope.includes(id));
      if (fuera.length) { const e = new Error(`Asesor(es) fuera de tu alcance: ${fuera.join(',')}`); e.code = 'FORBIDDEN'; throw e; }
    }
    idsFinal = idsPedidos;
  }

  const { lunes, domingo } = rangoSemanaISO(parseInt(anio), parseInt(semanaISO));

  // Reusa ventanaFecha del propio módulo (definida en el fix del bug agenda multi-asesor)
  const inicioTs = `${lunes} 00:00:00`;
  const finTs    = `${domingo} 23:59:59`;

  // Construir where (dueño OR asistente activo, dentro de idsFinal)
  let scopeOr = null;
  if (Array.isArray(idsFinal)) {
    const asisRows = await SvEventoAsistente.findAll({
      where: { eva_usr_id: { [Op.in]: idsFinal }, eva_activo: 1 },
      attributes: ['eva_evento_id']
    });
    const evIdsAsis = [...new Set(asisRows.map(a => a.eva_evento_id))];
    scopeOr = {
      [Op.or]: [
        { evento_asesor_id: { [Op.in]: idsFinal } },
        ...(evIdsAsis.length ? [{ evento_id: { [Op.in]: evIdsAsis } }] : [])
      ]
    };
  }

  const whereEv = scopeOr
    ? { [Op.and]: [ventanaFecha(inicioTs, finTs), scopeOr] }
    : ventanaFecha(inicioTs, finTs);

  const eventos = await SvEventoAgenda.findAll({
    where: whereEv,
    include: [
      { model: SvUsuario, as: 'asesor', attributes: ['usr_id','usr_nombre','usr_apellido'] },
      { model: SvUsuario, as: 'apoyo',  attributes: ['usr_id','usr_nombre','usr_apellido'], required: false },
      { model: SvEmpresa, as: 'empresa', attributes: ['empresa_id','empresa_razon_social'], required: false },
      { model: SvEventoAsistente, as: 'asistentes',
        where: { eva_activo: 1 }, required: false,
        include: [{ model: SvUsuario, as: 'usuario', attributes: ['usr_id','usr_nombre','usr_apellido'] }] }
    ],
    order: [['evento_fecha_hora', 'ASC']]
  });

  // Distribuir eventos por día que cubren
  const por_dia = {};
  const lunesDate = new Date(`${lunes}T00:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunesDate); d.setDate(lunesDate.getDate() + i);
    const k = d.toISOString().slice(0, 10);
    por_dia[k] = { eventos: [], gestiones: [] };
  }
  for (const ev of eventos) {
    const ini = new Date(ev.evento_fecha_hora);
    const fin = ev.evento_fecha_fin ? new Date(ev.evento_fecha_fin) : ini;
    const desde = ini < lunesDate ? lunesDate : ini;
    const hasta = fin > new Date(`${domingo}T23:59:59`) ? new Date(`${domingo}T23:59:59`) : fin;
    const cursor = new Date(desde); cursor.setHours(0,0,0,0);
    const stop = new Date(hasta); stop.setHours(0,0,0,0);
    while (cursor <= stop) {
      const k = cursor.toISOString().slice(0, 10);
      if (por_dia[k]) por_dia[k].eventos.push(ev.toJSON ? ev.toJSON() : ev);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Gestiones próximas por día (usa mismo whereProsp que listarDia pero rango completo)
  const whereProsp = {
    prosp_prox_gestion_fecha: { [Op.between]: [lunes, domingo] },
    prosp_activo: 1
  };
  if (Array.isArray(idsFinal)) whereProsp.prosp_asesor_id = { [Op.in]: idsFinal };
  const gestiones = await SvProspecto.findAll({
    where: whereProsp,
    attributes: ['prosp_id','prosp_asesor_id','prosp_prox_gestion_fecha','prosp_prox_gestion_hora','prosp_prioridad'],
    include: [
      { model: SvEstado,  as: 'estado',  attributes: ['estado_id','estado_codigo','estado_nombre','estado_color_hex'] },
      { model: SvPersona, as: 'persona', attributes: ['persona_id','persona_nombre','persona_apellido','persona_telefono_principal'] },
      { model: SvUsuario, as: 'asesor',  attributes: ['usr_id','usr_nombre','usr_apellido'] }
    ]
  });
  for (const g of gestiones) {
    const k = g.prosp_prox_gestion_fecha instanceof Date
      ? g.prosp_prox_gestion_fecha.toISOString().slice(0,10)
      : String(g.prosp_prox_gestion_fecha).slice(0,10);
    if (por_dia[k]) por_dia[k].gestiones.push(g.toJSON ? g.toJSON() : g);
  }

  return { lunes, domingo, por_dia };
}
```

Y agregar `listarSemana` al `module.exports`.

- [ ] **Step 4: GREEN**

Run:
```bash
cd mantix-backend && npx jest tests/agendaSemana.service.test.js --no-coverage
```
Expected: PASS 3/3.

- [ ] **Step 5: Commit**

```bash
cd mantix-backend && git add src/sv/services/agenda.service.js tests/agendaSemana.service.test.js && git commit -m "$(cat <<'EOF'
feat(agenda): endpoint listarSemana con scope multi-asesor

Nueva helper listarSemana({anio, semanaISO, asesoresIds, actor}):
- Calcula rango lunes-domingo ISO 8601
- Aplica ventanaFecha() para eventos que cubren el rango
- Scope: dueño OR asistente activo, restringido a usuariosAccesibles(actor)
- Distribuye eventos por día que cubren (DIA_COMPLETO_MULTI)
- Retorna { lunes, domingo, por_dia: {[fecha]: {eventos, gestiones}} }

Base de SP-2 (vista semana en frontend).
EOF
)"
```

Attribution: TU trailer.

---

## Task 2: Backend service `eventosAgenda.listado`

**Files:**
- Modify: `mantix-backend/src/sv/services/eventosAgenda.service.js`
- Create: `mantix-backend/tests/eventosListado.service.test.js`

**Interfaces:**
- Produces: `listado({ filtros, actor }) → Promise<Array>` — tabla plana de eventos accesibles al actor con filtros.
- Filtros: `desde`, `hasta` (YYYY-MM-DD), `asesor_id` opcional, `tipo` opcional, `link_publico` opcional (0/1), `q` (búsqueda por título).
- Cada fila incluye: evento_id, título, tipo, fecha_inicio, fecha_fin, modo_fechas, link_hash + publico, meta_leads, dueño, count_asistentes, pool_total, pool_pendientes.

- [ ] **Step 1: Test primero**

Path: `mantix-backend/tests/eventosListado.service.test.js`

```js
const mockEv    = { findAll: jest.fn() };
const mockPool  = { count: jest.fn() };
const mockUsr   = { findByPk: jest.fn() };
jest.mock('../src/sv/models', () => ({
  SvEventoAgenda: mockEv, SvEventoPoolRegistro: mockPool,
  SvEventoAsistente: {}, SvUsuario: mockUsr, SvEmpresa: {},
  SvProspecto: {}, SvGrupo: {}, SvArea: {}
}));
jest.mock('../src/sv/utils/acceso', () => ({
  usuariosAccesibles: jest.fn(),
  grupoIdsAccesibles: jest.fn()
}));

const svc = require('../src/sv/services/eventosAgenda.service');
const acceso = require('../src/sv/utils/acceso');

const jefe = { usr_id: 20, rol: { rol_codigo: 'COORDINADOR_PREVISION' } };

beforeEach(() => {
  jest.clearAllMocks();
  acceso.usuariosAccesibles.mockResolvedValue([10, 11, 12]);
  mockEv.findAll.mockResolvedValue([]);
  mockPool.count.mockResolvedValue(0);
});

describe('listado', () => {
  test('sin filtros retorna eventos del scope del actor', async () => {
    mockEv.findAll.mockResolvedValue([
      { toJSON: () => ({ evento_id: 500, evento_titulo: 'Feria', evento_asesor_id: 10 }) }
    ]);
    const r = await svc.listado({ filtros: {}, actor: jefe });
    expect(r).toHaveLength(1);
    expect(r[0].evento_id).toBe(500);
  });

  test('filtro q busca por título (LIKE)', async () => {
    await svc.listado({ filtros: { q: 'Feria' }, actor: jefe });
    const where = mockEv.findAll.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('Feria');
  });

  test('filtro tipo', async () => {
    await svc.listado({ filtros: { tipo: 'FERIA' }, actor: jefe });
    const where = mockEv.findAll.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('FERIA');
  });

  test('link_publico=1 solo eventos con registros_publicos_habilitado', async () => {
    await svc.listado({ filtros: { link_publico: '1' }, actor: jefe });
    const where = mockEv.findAll.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('evento_registros_publicos_habilitado');
  });

  test('cada fila incluye conteo del pool si el evento tiene link público', async () => {
    mockEv.findAll.mockResolvedValue([
      { toJSON: () => ({ evento_id: 500, evento_registros_publicos_habilitado: 1 }) }
    ]);
    mockPool.count
      .mockResolvedValueOnce(20)  // total
      .mockResolvedValueOnce(5);  // pendientes
    const r = await svc.listado({ filtros: {}, actor: jefe });
    expect(r[0].pool_total).toBe(20);
    expect(r[0].pool_pendientes).toBe(5);
  });
});
```

- [ ] **Step 2: RED** — `npx jest tests/eventosListado.service.test.js --no-coverage`.

- [ ] **Step 3: Implementar `listado` en `eventosAgenda.service.js`**

Al final del archivo, antes de `module.exports`, agregar:

```js
async function listado({ filtros = {}, actor }) {
  const scope = await usuariosAccesibles(actor);
  const whereAnd = [];

  // Scope: dueño OR asistente activo, dentro del scope del actor
  if (scope !== null) {
    const asisRows = await SvEventoAsistente.findAll({
      where: { eva_usr_id: { [Op.in]: scope }, eva_activo: 1 },
      attributes: ['eva_evento_id']
    });
    const evIdsAsis = [...new Set(asisRows.map(a => a.eva_evento_id))];
    whereAnd.push({
      [Op.or]: [
        { evento_asesor_id: { [Op.in]: scope } },
        ...(evIdsAsis.length ? [{ evento_id: { [Op.in]: evIdsAsis } }] : [])
      ]
    });
  }

  if (filtros.desde) whereAnd.push({ evento_fecha_hora: { [Op.gte]: `${filtros.desde} 00:00:00` } });
  if (filtros.hasta) whereAnd.push({ evento_fecha_hora: { [Op.lte]: `${filtros.hasta} 23:59:59` } });
  if (filtros.tipo)  whereAnd.push({ evento_tipo: String(filtros.tipo).toUpperCase() });
  if (filtros.asesor_id) whereAnd.push({ evento_asesor_id: parseInt(filtros.asesor_id) });
  if (filtros.link_publico === '1' || filtros.link_publico === 1 || filtros.link_publico === true) {
    whereAnd.push({ evento_registros_publicos_habilitado: 1 });
  }
  if (filtros.q) {
    whereAnd.push({ evento_titulo: { [Op.like]: `%${String(filtros.q).trim()}%` } });
  }

  const where = whereAnd.length ? { [Op.and]: whereAnd } : {};

  const eventos = await SvEventoAgenda.findAll({
    where,
    include: [
      { model: SvUsuario, as: 'asesor', attributes: ['usr_id','usr_nombre','usr_apellido'] },
      { model: SvEventoAsistente, as: 'asistentes',
        where: { eva_activo: 1 }, required: false,
        attributes: ['eva_id'] }
    ],
    order: [['evento_fecha_hora', 'DESC']],
    limit: 500
  });

  const rows = [];
  for (const ev of eventos) {
    const evJson = ev.toJSON ? ev.toJSON() : ev;
    let pool_total = 0, pool_pendientes = 0;
    if (evJson.evento_registros_publicos_habilitado) {
      const [t, p] = await Promise.all([
        SvEventoPoolRegistro.count({ where: { pool_evento_id: evJson.evento_id } }),
        SvEventoPoolRegistro.count({ where: { pool_evento_id: evJson.evento_id, pool_prosp_id: null } })
      ]);
      pool_total = t; pool_pendientes = p;
    }
    rows.push({
      evento_id:                            evJson.evento_id,
      evento_titulo:                        evJson.evento_titulo,
      evento_tipo:                          evJson.evento_tipo,
      evento_fecha_hora:                    evJson.evento_fecha_hora,
      evento_fecha_fin:                     evJson.evento_fecha_fin,
      evento_modo_fechas:                   evJson.evento_modo_fechas,
      evento_registros_publicos_habilitado: !!evJson.evento_registros_publicos_habilitado,
      evento_link_hash:                     evJson.evento_link_hash,
      evento_meta_leads:                    evJson.evento_meta_leads,
      dueño:                                evJson.asesor,
      count_asistentes:                     (evJson.asistentes || []).length,
      pool_total,
      pool_pendientes
    });
  }
  return rows;
}
```

Y agregar `listado` al `module.exports`.

- [ ] **Step 4: GREEN** — `npx jest tests/eventosListado.service.test.js --no-coverage`.

- [ ] **Step 5: Commit**

```bash
cd mantix-backend && git add src/sv/services/eventosAgenda.service.js tests/eventosListado.service.test.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): service listado (tabla plana filtrable)

Nuevo listado({filtros, actor}) para la vista de seguimiento tipo tabla:
- Filtros: desde/hasta (fecha), tipo, asesor_id, link_publico (0/1),
  q (LIKE en título)
- Scope: dueño OR asistente activo, restringido a usuariosAccesibles
- Retorna filas planas con conteo del pool si el evento tiene link
  público habilitado
- Limit 500 (paginación futura si escala)

Base de la vista SP-2 "Listado" (encontrar eventos + links públicos).
EOF
)"
```

Attribution: TU trailer.

---

## Task 3: Backend controller + rutas

**Files:**
- Modify: `mantix-backend/src/sv/controllers/agenda.controller.js`
- Modify: `mantix-backend/src/sv/routes/agenda.routes.js`

**Interfaces:**
- `GET /api/sv/agenda/semana?anio=&semana=&asesores_ids=` → `{lunes, domingo, por_dia}`
- `GET /api/sv/eventos-agenda/listado?desde=&hasta=&asesor_id=&tipo=&link_publico=&q=` → `[{...}]`
- Ambos requieren `authorize(...ROLES_SUPERVISORES)`.

- [ ] **Step 1: Agregar handlers al controller**

En `agenda.controller.js`, al final antes de `module.exports`:

```js
async function semanaSeguimiento(req, res) {
  try {
    const asesoresIds = req.query.asesores_ids
      ? String(req.query.asesores_ids).split(',').map(s => parseInt(s.trim())).filter(Boolean)
      : [];
    const r = await agenda.listarSemana({
      anio:       parseInt(req.query.anio),
      semanaISO:  parseInt(req.query.semana),
      asesoresIds,
      actor:      req.user
    });
    return ok(res, r);
  } catch (e) {
    if (e.code === 'FORBIDDEN') return fail(res, 403, ERROR_CODES.FORBIDDEN, e.message);
    throw e;
  }
}

async function listadoEventos(req, res) {
  const r = await eventos.listado({ filtros: req.query, actor: req.user });
  return ok(res, r);
}
```

Y agregar los 2 nombres al `module.exports`.

- [ ] **Step 2: Agregar rutas**

En `agenda.routes.js`, agregar:

```js
const { authorize } = require('../middleware/authorize');
const { ROLES_SUPERVISORES } = require('../config/constants');

router.get('/agenda/semana',              authorize(...ROLES_SUPERVISORES), c.semanaSeguimiento);
router.get('/eventos-agenda/listado',     authorize(...ROLES_SUPERVISORES), c.listadoEventos);
```

Verifica que `authorize` exista en `src/sv/middleware/`. Si no, buscar el patrón usado en otras rutas restringidas (`usuarios.routes.js` es referencia).

- [ ] **Step 3: Smoke con curl (delegado al deploy en Task 9). No hacer test de rutas Jest ahora — sólo verificar que arranca:**

Run:
```bash
cd mantix-backend && node -e "require('./src/sv/routes/agenda.routes'); console.log('OK')"
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
cd mantix-backend && git add src/sv/controllers/agenda.controller.js src/sv/routes/agenda.routes.js && git commit -m "$(cat <<'EOF'
feat(agenda): endpoints /agenda/semana + /eventos-agenda/listado

Ambos gated por authorize(...ROLES_SUPERVISORES).

- GET /agenda/semana?anio=&semana=&asesores_ids=CSV
- GET /eventos-agenda/listado?desde=&hasta=&asesor_id=&tipo=&link_publico=&q=

Handlers delegan a agenda.listarSemana y eventos.listado.
FORBIDDEN → 403; el resto de errores burbujea al middleware.
EOF
)"
```

Attribution: TU trailer.

---

## Task 4: Frontend API extensions

**Files:**
- Modify: `crm-frontend/src/api/agendaApi.js`

- [ ] **Step 1: Agregar 2 métodos**

Al objeto `agendaApi` agregar:
```js
semanaSeguimiento: ({ anio, semana, asesoresIds = [] }) =>
  api.get('/agenda/semana', { params: {
    anio, semana,
    asesores_ids: asesoresIds.length ? asesoresIds.join(',') : undefined
  }}).then(r => r.data),
```

Al objeto `eventosAgendaApi` agregar:
```js
listado: (filtros = {}) => api.get('/eventos-agenda/listado', { params: filtros }).then(r => r.data),
```

- [ ] **Step 2: Build**

```bash
cd crm-frontend && npm run build 2>&1 | tail -3
```
Expected: `✓`.

- [ ] **Step 3: Commit**

```bash
cd crm-frontend && git add src/api/agendaApi.js && git commit -m "$(cat <<'EOF'
feat(agenda): eventosAgendaApi.listado + agendaApi.semanaSeguimiento

Wrappers de los endpoints SP-2:
- agendaApi.semanaSeguimiento({anio, semana, asesoresIds})
- eventosAgendaApi.listado(filtros)
EOF
)"
```

Attribution: TU trailer.

---

## Task 5: Selector multi-asesor

**Files:**
- Create: `crm-frontend/src/components/agenda/SelectorAsesoresMulti.vue`

**Interfaces:**
- Props: `modelValue: number[]` (asesoresIds seleccionados).
- Emits: `update:modelValue`.
- Carga usuarios accesibles vía `usuariosApi.list({activo:1, limit:200})`.
- UI: dropdown con checkbox por usuario + "Todos" (marca todos) + búsqueda inline.

- [ ] **Step 1: Implementar (sin tests dedicados, se valida en smoke)**

Path: `crm-frontend/src/components/agenda/SelectorAsesoresMulti.vue`

```vue
<template>
  <div class="relative">
    <button type="button"
            class="w-full text-left px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-slate-400 flex items-center justify-between gap-2"
            @click="abierto = !abierto">
      <span class="text-slate-700 truncate">
        {{ etiqueta }}
      </span>
      <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 20 20" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 8l4 4 4-4"/>
      </svg>
    </button>

    <div v-if="abierto"
         class="absolute z-30 mt-1 w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col">
      <div class="p-2 border-b">
        <input v-model="filtro" type="text" placeholder="Buscar asesor..."
               class="w-full py-1.5 px-2 text-sm border border-gray-200 rounded" />
      </div>
      <div class="p-2 border-b bg-slate-50">
        <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" :checked="todosSel" @change="toggleTodos" />
          <span class="text-slate-700">Todos ({{ usuariosVisibles.length }})</span>
        </label>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <label v-for="u in usuariosVisibles" :key="u.usr_id"
               class="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer text-sm">
          <input type="checkbox" :checked="seleccionados.includes(u.usr_id)"
                 @change="toggle(u.usr_id)" />
          <span class="text-slate-700">{{ nombre(u) }}</span>
          <span v-if="u.rol?.rol_codigo" class="text-xs text-slate-400 ml-auto">{{ u.rol.rol_codigo }}</span>
        </label>
      </div>
      <div class="p-2 border-t bg-slate-50 text-right">
        <button type="button" class="text-xs text-slate-500 hover:text-slate-700 mr-2"
                @click="limpiar">Limpiar</button>
        <button type="button" class="text-xs px-3 py-1 bg-green-700 hover:bg-green-800 text-white rounded"
                @click="abierto = false">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usuariosApi } from '@/api/usuariosApi';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({ modelValue: { type: Array, default: () => [] } });
const emit  = defineEmits(['update:modelValue']);
const toast = useToastStore();

const usuarios = ref([]);
const abierto  = ref(false);
const filtro   = ref('');

const seleccionados = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const usuariosVisibles = computed(() => {
  const f = filtro.value.trim().toLowerCase();
  if (!f) return usuarios.value;
  return usuarios.value.filter(u => nombre(u).toLowerCase().includes(f));
});

const todosSel = computed(() =>
  usuariosVisibles.value.length > 0 &&
  usuariosVisibles.value.every(u => seleccionados.value.includes(u.usr_id))
);

const etiqueta = computed(() => {
  const n = seleccionados.value.length;
  if (n === 0)                        return 'Todos los asesores';
  if (n === 1) {
    const u = usuarios.value.find(x => x.usr_id === seleccionados.value[0]);
    return u ? nombre(u) : `1 asesor`;
  }
  return `${n} asesores seleccionados`;
});

function nombre(u) {
  const n = `${u.usr_nombre || ''} ${u.usr_apellido || ''}`.trim();
  if (n) return n;
  if (u.usr_email) return u.usr_email.split('@')[0];
  return `Usuario #${u.usr_id}`;
}

function toggle(id) {
  const arr = [...seleccionados.value];
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(id);
  seleccionados.value = arr;
}

function toggleTodos() {
  if (todosSel.value) {
    // Deseleccionar los visibles
    seleccionados.value = seleccionados.value.filter(id => !usuariosVisibles.value.find(u => u.usr_id === id));
  } else {
    const nuevos = usuariosVisibles.value.map(u => u.usr_id);
    seleccionados.value = [...new Set([...seleccionados.value, ...nuevos])];
  }
}

function limpiar() { seleccionados.value = []; }

onMounted(async () => {
  try {
    const r = await usuariosApi.list({ activo: 1, limit: 200 });
    usuarios.value = r.data || r;
  } catch (e) {
    toast.error('No se pudieron cargar los asesores');
  }
});
</script>
```

- [ ] **Step 2: Build + commit**

```bash
cd crm-frontend && npm run build 2>&1 | tail -3 && git add src/components/agenda/SelectorAsesoresMulti.vue && git commit -m "$(cat <<'EOF'
feat(agenda): SelectorAsesoresMulti (dropdown multi-check + búsqueda)

v-model: number[] con usr_ids seleccionados. [] = 'Todos'.
- Dropdown con checkbox por usuario
- Búsqueda inline
- Toggle 'Todos' basado en filtro actual
- Etiqueta compacta: "Todos" / "Juan Pérez" / "N asesores seleccionados"
EOF
)"
```

Attribution: TU trailer.

---

## Task 6: `EventoListadoTabla.vue`

**Files:**
- Create: `crm-frontend/src/components/agenda/EventoListadoTabla.vue`

**Interfaces:**
- Consumes: `eventosAgendaApi.listado(filtros)`.
- Filtros: `desde`, `hasta`, `q`, `tipo`, `link_publico`, `asesores_ids` (del selector).

- [ ] **Step 1: Implementar**

Path: `crm-frontend/src/components/agenda/EventoListadoTabla.vue`

```vue
<template>
  <div class="space-y-3">
    <!-- Filtros -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
      <div class="sm:col-span-2">
        <input v-model="filtros.q" type="text" placeholder="Buscar por título..."
               class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div>
        <select v-model="filtros.tipo" class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm">
          <option value="">-- Todos los tipos --</option>
          <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div>
        <select v-model="filtros.link_publico" class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm">
          <option value="">-- Con o sin link --</option>
          <option value="1">Solo con link público</option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div>
        <label class="text-xs text-slate-500">Desde</label>
        <input v-model="filtros.desde" type="date"
               class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div>
        <label class="text-xs text-slate-500">Hasta</label>
        <input v-model="filtros.hasta" type="date"
               class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
      </div>
    </div>

    <div class="flex gap-2">
      <button type="button" class="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg"
              @click="cargar">Buscar</button>
      <button type="button" class="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-slate-50"
              @click="limpiar">Limpiar</button>
      <span v-if="cargando" class="text-sm text-slate-500 self-center">Cargando…</span>
    </div>

    <!-- Tabla -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-slate-500 border-b bg-slate-50">
          <tr>
            <th class="text-left px-2 py-2">Título</th>
            <th class="text-left px-2 py-2">Tipo</th>
            <th class="text-left px-2 py-2">Fechas</th>
            <th class="text-left px-2 py-2">Dueño</th>
            <th class="text-right px-2 py-2">Asis.</th>
            <th class="text-left px-2 py-2">Link</th>
            <th class="text-right px-2 py-2">Pool</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!eventos.length && !cargando">
            <td colspan="8" class="text-center py-6 text-slate-400 text-xs">Sin eventos con estos filtros</td>
          </tr>
          <tr v-for="e in eventos" :key="e.evento_id" class="border-b border-gray-100 hover:bg-slate-50">
            <td class="px-2 py-2 font-medium text-slate-800">{{ e.evento_titulo }}</td>
            <td class="px-2 py-2 text-slate-600">{{ e.evento_tipo }}</td>
            <td class="px-2 py-2 text-slate-500 text-xs">{{ fecha(e.evento_fecha_hora) }}<span v-if="e.evento_fecha_fin"> → {{ fecha(e.evento_fecha_fin) }}</span></td>
            <td class="px-2 py-2 text-slate-600">{{ nombre(e.dueño) }}</td>
            <td class="px-2 py-2 text-right text-slate-500">{{ e.count_asistentes }}</td>
            <td class="px-2 py-2">
              <span v-if="e.evento_registros_publicos_habilitado" class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Público</span>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>
            <td class="px-2 py-2 text-right text-xs">
              <span v-if="e.evento_registros_publicos_habilitado">{{ e.pool_pendientes }}/{{ e.pool_total }}</span>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="px-2 py-2 text-right">
              <RouterLink :to="{ name: 'evento-detalle', params: { id: e.evento_id }}"
                          class="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-white text-slate-600">
                Abrir
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';

const toast = useToastStore();

const TIPOS = ['REUNION','VISITA','CAPACITACION','LLAMADA','FERIA','PERSONAL','OTRO','SEGUIMIENTO'];

const filtros = reactive({ q: '', tipo: '', link_publico: '', desde: '', hasta: '' });
const eventos = ref([]);
const cargando = ref(false);

function payloadLimpio() {
  const p = {};
  for (const k of ['q','tipo','link_publico','desde','hasta']) if (filtros[k]) p[k] = filtros[k];
  return p;
}

async function cargar() {
  cargando.value = true;
  try {
    const r = await eventosAgendaApi.listado(payloadLimpio());
    eventos.value = r.data || r || [];
  } catch (e) {
    toast.error('No se pudo cargar el listado');
  } finally {
    cargando.value = false;
  }
}

function limpiar() {
  for (const k of Object.keys(filtros)) filtros[k] = '';
  cargar();
}

function fecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });
}
function nombre(u) {
  if (!u) return '—';
  const n = `${u.usr_nombre || ''} ${u.usr_apellido || ''}`.trim();
  return n || `#${u.usr_id}`;
}

onMounted(cargar);
</script>
```

- [ ] **Step 2: Build + commit**

```bash
cd crm-frontend && npm run build 2>&1 | tail -3 && git add src/components/agenda/EventoListadoTabla.vue && git commit -m "$(cat <<'EOF'
feat(agenda): EventoListadoTabla (búsqueda + tabla plana de eventos)

Filtros: q (título), tipo, link_publico, desde/hasta.
Columnas: título · tipo · fechas · dueño · #asistentes · badge Público
· pool pendientes/total · botón 'Abrir' (RouterLink a evento-detalle).

Consume eventosAgendaApi.listado. Sin tests dedicados; smoke UI.
EOF
)"
```

Attribution: TU trailer.

---

## Task 7: `SemanaGrid.vue`

**Files:**
- Create: `crm-frontend/src/components/agenda/SemanaGrid.vue`

**Interfaces:**
- Props: `semanaData` (Object del backend `{lunes, domingo, por_dia}`).
- Muestra 7 columnas (lunes → domingo) con eventos como tarjetas.

- [ ] **Step 1: Implementar**

Path: `crm-frontend/src/components/agenda/SemanaGrid.vue`

```vue
<template>
  <div class="overflow-x-auto">
    <div class="min-w-[900px]">
      <div class="grid grid-cols-7 gap-2">
        <div v-for="(dia, key) in dias" :key="key"
             class="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col min-h-[240px]">
          <div class="px-3 py-2 border-b bg-slate-50 text-xs">
            <div class="font-semibold text-slate-700">{{ etiqueta(key) }}</div>
            <div class="text-slate-400">{{ formatFecha(key) }}</div>
          </div>
          <div class="p-2 space-y-1.5 flex-1 overflow-y-auto max-h-[400px]">
            <RouterLink v-for="ev in dia.eventos" :key="ev.evento_id"
                        :to="{ name: 'evento-detalle', params: { id: ev.evento_id }}"
                        class="block px-2 py-1.5 rounded border border-green-200 bg-green-50 hover:bg-green-100 text-xs">
              <div class="font-medium text-slate-800 truncate">{{ ev.evento_titulo }}</div>
              <div class="text-slate-500 text-[10px] uppercase mt-0.5">{{ ev.evento_tipo }}</div>
              <div class="text-slate-400 text-[10px]">{{ hora(ev.evento_fecha_hora) }}</div>
            </RouterLink>
            <div v-for="g in dia.gestiones" :key="'g-'+g.prosp_id"
                 class="block px-2 py-1.5 rounded border border-slate-200 bg-slate-50 text-xs">
              <div class="font-medium text-slate-700 truncate">
                {{ g.persona?.persona_nombre || '' }} {{ g.persona?.persona_apellido || '' }}
              </div>
              <div class="text-slate-400 text-[10px]">Gestión · {{ g.prosp_prox_gestion_hora?.slice(0,5) || '' }}</div>
            </div>
            <div v-if="!dia.eventos.length && !dia.gestiones.length"
                 class="text-xs text-slate-300 text-center py-6">—</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps({ semanaData: { type: Object, required: true } });

const dias = computed(() => props.semanaData?.por_dia || {});

const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function etiqueta(fechaKey) {
  const d = new Date(`${fechaKey}T12:00:00`);
  return DIAS_SEMANA[(d.getDay() + 6) % 7];
}
function formatFecha(fechaKey) {
  const d = new Date(`${fechaKey}T12:00:00`);
  return d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short' });
}
function hora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
}
</script>
```

- [ ] **Step 2: Build + commit**

```bash
cd crm-frontend && npm run build 2>&1 | tail -3 && git add src/components/agenda/SemanaGrid.vue && git commit -m "$(cat <<'EOF'
feat(agenda): SemanaGrid (7 columnas con eventos + gestiones por día)

Presenta la data de /agenda/semana en un grid horizontal (scroll en
móvil). Cada día muestra tarjetas verdes (eventos, RouterLink a
evento-detalle) y grises (gestiones próximas). Estado vacío por día.
EOF
)"
```

Attribution: TU trailer.

---

## Task 8: `AgendaSeguimientoView.vue` + ruta + sidebar

**Files:**
- Create: `crm-frontend/src/views/comun/AgendaSeguimientoView.vue`
- Modify: `crm-frontend/src/router/index.js`
- Modify: `crm-frontend/src/components/layout/AppSidebar.vue`

**Interfaces:**
- Ruta: `/agenda/seguimiento` con `meta: { requiereAuth: true, nivelMaximo: 3 }` (nivel 3 = COORDINADOR/JEFE_PAP/SUPERVISOR; ADMIN/DIRECTOR/GERENTE = 2; SUPER_ADMIN = 1; ASESOR = 4).
- 3 tabs: Semana | Mes (reutiliza `AgendaUnificada` calendar) | Listado.
- Header con selector multi-asesor + navegación de fecha.

- [ ] **Step 1: Crear el view**

Path: `crm-frontend/src/views/comun/AgendaSeguimientoView.vue`

```vue
<template>
  <div class="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Seguimiento de agenda</h1>
        <p class="text-sm text-slate-500">Vista del equipo: eventos, links públicos y gestiones.</p>
      </div>
    </header>

    <!-- Selector de asesores + navegador -->
    <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      <div class="flex-1 max-w-md">
        <SelectorAsesoresMulti v-model="asesoresIds" />
      </div>
      <div v-if="tab === 'semana'" class="flex items-center gap-2">
        <button class="px-2 py-1 border rounded text-sm" @click="cambiarSemana(-1)">‹</button>
        <span class="text-sm text-slate-700 min-w-[7rem] text-center">
          Semana {{ semanaISO }} · {{ anio }}
        </span>
        <button class="px-2 py-1 border rounded text-sm" @click="cambiarSemana(1)">›</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
      <nav class="flex border-b border-gray-200 text-sm font-medium">
        <button v-for="t in tabs" :key="t.key" type="button"
                :class="tab === t.key
                  ? 'text-green-700 border-b-2 border-green-700'
                  : 'text-slate-500 hover:text-slate-700'"
                class="flex-1 py-3" @click="tab = t.key">
          {{ t.label }}
        </button>
      </nav>

      <div class="p-4">
        <div v-if="tab === 'semana'">
          <div v-if="cargando" class="text-center py-8 text-slate-400 text-sm">Cargando…</div>
          <SemanaGrid v-else-if="semanaData" :semana-data="semanaData" />
        </div>
        <div v-else-if="tab === 'listado'">
          <EventoListadoTabla />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { agendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';
import SelectorAsesoresMulti from '@/components/agenda/SelectorAsesoresMulti.vue';
import SemanaGrid from '@/components/agenda/SemanaGrid.vue';
import EventoListadoTabla from '@/components/agenda/EventoListadoTabla.vue';

const toast = useToastStore();

const tabs = [
  { key: 'semana',  label: 'Semana' },
  { key: 'listado', label: 'Listado' }
];

const tab = ref('semana');
const asesoresIds = ref([]);
const anio = ref(new Date().getFullYear());
const semanaISO = ref(currentISOWeek());
const cargando = ref(false);
const semanaData = ref(null);

function currentISOWeek() {
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((target - firstThursday) / 86400000 - 3) / 7);
}

async function cargarSemana() {
  cargando.value = true;
  try {
    const r = await agendaApi.semanaSeguimiento({ anio: anio.value, semana: semanaISO.value, asesoresIds: asesoresIds.value });
    semanaData.value = r.data || r;
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo cargar la semana');
    semanaData.value = null;
  } finally {
    cargando.value = false;
  }
}

function cambiarSemana(delta) {
  semanaISO.value += delta;
  if (semanaISO.value < 1) { anio.value -= 1; semanaISO.value = 52; }
  else if (semanaISO.value > 52) { anio.value += 1; semanaISO.value = 1; }
  cargarSemana();
}

watch([tab, asesoresIds], () => {
  if (tab.value === 'semana') cargarSemana();
});
onMounted(cargarSemana);
</script>
```

- [ ] **Step 2: Agregar ruta**

En `crm-frontend/src/router/index.js`, en la sección "Agenda transversal", agregar:

```js
  { path: '/agenda/seguimiento', name: 'agenda-seguimiento',
    component: () => import('@/views/comun/AgendaSeguimientoView.vue'),
    meta: { requiereAuth: true, nivelMaximo: 3 } },
```

- [ ] **Step 3: Agregar entrada al sidebar (visible solo para supervisor+)**

En `src/components/layout/AppSidebar.vue`, buscar la entrada de "Agenda" existente y agregar cerca:

```html
<RouterLink v-if="auth.rolNivel <= 3"
            :to="{ name: 'agenda-seguimiento' }"
            class="[misma clase que las demás entradas del sidebar]">
  Seguimiento
</RouterLink>
```

Ajusta la clase Tailwind al patrón que ya use el sidebar (leer el archivo primero para no romper el layout).

- [ ] **Step 4: Build**

```bash
cd crm-frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
cd crm-frontend && git add src/views/comun/AgendaSeguimientoView.vue src/router/index.js src/components/layout/AppSidebar.vue && git commit -m "$(cat <<'EOF'
feat(agenda): AgendaSeguimientoView con tabs Semana + Listado

Ruta /agenda/seguimiento visible sólo para nivel<=3 (supervisor+).
- Header con SelectorAsesoresMulti + navegador de semana
- Tab Semana: llama /agenda/semana y renderiza SemanaGrid
- Tab Listado: EventoListadoTabla (filtros propios)
- Entry en sidebar (v-if auth.rolNivel <= 3)

Tab 'Mes' se difiere: el AgendaUnificada actual ya provee la vista mes.
EOF
)"
```

Attribution: TU trailer.

---

## Task 9: Deploy + smoke UI

- [ ] **Step 1: Push ambos repos**

```bash
cd mantix-backend && git push origin main
cd ../crm-frontend && git push origin main
```

- [ ] **Step 2: Deploy backend**

```bash
# En el server
deploy-mantix
```

- [ ] **Step 3: Build frontend + rsync**

```bash
cd crm-frontend && npm run build && rsync -avz --delete "$(pwd)/dist/" /Volumes/AppServ/www/genflow/
```

- [ ] **Step 4: Verificar assets con curl**

```bash
curl -sSI https://losolivoscucuta.com/genflow/index.html | head -3
```

- [ ] **Step 5: Smoke UI (Coordinador o Director)**

- [ ] Login como Coordinador → sidebar muestra "Seguimiento"
- [ ] Click → carga vista con tab Semana activo → renderiza 7 columnas
- [ ] Navegar semanas con ‹ ›
- [ ] Cambiar a tab Listado → tabla vacía inicial → click Buscar → aparecen los eventos del scope
- [ ] Filtrar por "Solo con link público" → sólo eventos con badge Público
- [ ] Filtrar por rango de fechas y tipo
- [ ] Selector multi-asesor: elegir 2 asesores específicos → Semana se recarga sólo con sus eventos
- [ ] Click "Abrir" en una fila → navega a `/eventos/:id` (EventoDetalleView de SP-1b)
- [ ] Login como ASESOR normal → NO aparece "Seguimiento" en sidebar (nivel 4)
- [ ] Login como Director → aparece "Seguimiento", puede ver todos los asesores de sus áreas

---

## Notas para el implementador

- El `ventanaFecha()` helper se agregó a `agenda.service.js` en el commit `e52e967`. Reusar sin duplicar.
- `authorize()` middleware ya existe en `src/sv/middleware/authorize.js` (o similar) — verifica con `grep -r "authorize" src/sv/middleware/`.
- Sidebar: cuidado con el layout existente. Leer `AppSidebar.vue` completo antes de agregar la entry; matchear las clases/estructura del patrón usado por las otras entries.
- `auth.rolNivel` está expuesto en `useAuthStore` (usado en muchos lugares del codebase). Nivel 1=SUPER_ADMIN, 2=GERENTE/DIRECTOR/ADMIN_AREA, 3=SUPERVISOR/COORDINADOR/JEFE_PAP, 4=ASESOR/AGENTE_SVC.

---

## Self-review

**1. Spec coverage** — Reviso spec §5.4, §6.4 y user asks:

- ✅ Vista semana con eventos por día (Task 1, 7, 8).
- ✅ Listado tabla con filtros + búsqueda + link_publico (Task 2, 6).
- ✅ Selector multi-asesor (Task 5, 8).
- ✅ Endpoints con scope + role guard (Task 3).
- ✅ Ruta y sidebar solo para supervisor+ (Task 8).
- ✅ "Dónde ver los links públicos" → tab Listado con filtro (Task 6).
- ✅ "Dónde ver el listado de eventos creados" → tab Listado (Task 6).
- ⚠️ Gantt-timeline por hora × asesor: **NO** implementado; deferido a SP-2b. La vista Semana da visibilidad diaria multi-asesor, que cubre el 80% del caso.
- ⚠️ KPIs dashboard: deferido a SP-2c.

**2. Placeholder scan** — sin TBDs. Los "reutilizar patrón" son referencias concretas al codebase.

**3. Type consistency:**
- `agenda.listarSemana` en Task 1 usa `{anio, semanaISO, asesoresIds, actor}`; controller Task 3 y API Task 4 respetan `anio, semana, asesoresIds`.
- `eventos.listado({filtros, actor})` — mismos nombres en Task 2, 3, 4, 6.
- `SelectorAsesoresMulti` v-model tipo `number[]` — usado consistentemente en Task 5, 8.
- Response envelope `r.data || r` para tolerar ambos casos.

Sin inconsistencias.
