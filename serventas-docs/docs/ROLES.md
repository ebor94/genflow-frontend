# SerVentas CRM — Roles y Permisos

---

## Jerarquía de roles

```
Nivel 1: SUPER_ADMIN    → Acceso total. Configura todo. Ve todas las áreas.
Nivel 2: ADMIN_AREA     → Solo su área. Configura catálogos y usuarios de su área.
Nivel 3: SUPERVISOR     → Solo su grupo. Ve métricas del equipo. Asigna listas.
Nivel 4: ASESOR         → Solo sus prospectos. Registra gestiones.
Nivel 4: AGENTE_SVC     → Solo casos de Servicio al Cliente.
```

---

## Matriz de permisos por recurso

| Recurso | SUPER_ADMIN | ADMIN_AREA | SUPERVISOR | ASESOR | AGENTE_SVC |
|---|---|---|---|---|---|
| **Áreas de negocio** — leer | ✅ Todas | ✅ La suya | ✅ La suya | ✅ La suya | ✅ SVC |
| **Áreas de negocio** — crear/editar | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Grupos de trabajo** — leer | ✅ Todos | ✅ Su área | ✅ El suyo | ❌ | ❌ |
| **Grupos de trabajo** — crear/editar | ✅ | ✅ Su área | ❌ | ❌ | ❌ |
| **Productos / catálogo** — leer | ✅ Todos | ✅ Su área | ✅ Su grupo | ✅ Su área | ❌ |
| **Productos / catálogo** — crear/editar | ✅ | ✅ Su área | ❌ | ❌ | ❌ |
| **Estados de gestión** — leer | ✅ | ✅ Su área | ✅ Su grupo | ✅ Su área | ❌ |
| **Estados de gestión** — crear/editar | ✅ | ✅ Su área | ❌ | ❌ | ❌ |
| **Usuarios** — leer | ✅ Todos | ✅ Su área | ✅ Su grupo | ❌ | ❌ |
| **Usuarios** — crear/editar | ✅ | ✅ Su área | ❌ | ❌ | ❌ |
| **Metas** — crear/editar | ✅ | ✅ Su área | ✅ Su grupo | ❌ | ❌ |
| **Personas** — leer | ✅ | ✅ Su área | ✅ Su grupo | ✅ Sus prospectos | ✅ Sus casos |
| **Personas** — crear | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Personas** — editar | ✅ | ✅ Su área | ✅ Su grupo | ✅ Sus prospectos | ❌ |
| **Empresas** — CRUD | ✅ | ✅ PREV-EMP solo | ✅ PREV-EMP solo | ✅ Sus empresas | ❌ |
| **Prospectos** — leer | ✅ Todos | ✅ Su área | ✅ Su grupo | ✅ Solo los suyos | ❌ |
| **Prospectos** — crear | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Prospectos** — editar | ✅ | ✅ Su área | ✅ Su grupo | ✅ Solo los suyos | ❌ |
| **Prospectos** — reasignar | ✅ | ✅ Su área | ✅ Su grupo | ❌ | ❌ |
| **Gestiones** — crear | ✅ | ✅ | ✅ | ✅ Sus prospectos | ❌ |
| **Gestiones** — leer | ✅ | ✅ Su área | ✅ Su grupo | ✅ Sus prospectos | ❌ |
| **Gestiones** — editar/eliminar | ❌ NUNCA | ❌ NUNCA | ❌ NUNCA | ❌ NUNCA | ❌ NUNCA |
| **Contratos** — leer | ✅ Todos | ✅ Su área | ✅ Su grupo | ✅ Los suyos | ✅ Los del cliente |
| **Contratos** — crear | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Listas** — cargar | ✅ | ✅ Su área | ✅ Su grupo | ❌ | ❌ |
| **Listas** — asignar a asesor | ✅ | ✅ Su área | ✅ Su grupo | ❌ | ❌ |
| **Casos SVC** — leer | ✅ Todos | ✅ SVC área | ✅ SVC grupo | ❌ | ✅ Los asignados |
| **Casos SVC** — crear/editar | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Dashboard** — leer | ✅ Multi-área | ✅ Su área | ✅ Su grupo | ✅ Solo suyo | ✅ Solo SVC |
| **Auditoría** — leer | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Exportar reportes** | ✅ | ✅ Su área | ✅ Su grupo | ❌ | ❌ |
| **Config SAP** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Implementación en middleware

### `middleware/auth.js` — verificar JWT
```js
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token requerido' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Adjuntar usuario completo al request
    const { rows } = await pool.query(`
      SELECT u.*, r.rol_codigo, r.rol_nivel, r.rol_permisos,
             a.area_codigo, a.area_nombre, a.area_tipo_cliente,
             g.grupo_codigo, g.grupo_nombre, g.grupo_tipo_venta
      FROM sv_org_usuarios u
      JOIN sv_org_roles r ON r.rol_id = u.usr_rol_id
      LEFT JOIN sv_cfg_areas_negocio a ON a.area_id = u.usr_area_id
      LEFT JOIN sv_cfg_grupos_trabajo g ON g.grupo_id = u.usr_grupo_id
      WHERE u.usr_id = $1 AND u.usr_activo = true
    `, [payload.usr_id]);

    if (!rows.length) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuario inactivo' });
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token inválido o expirado' });
  }
}
```

### `middleware/authorize.js` — verificar nivel mínimo de rol
```js
// Uso: router.get('/usuarios', authorize('SUPERVISOR'), controller)
export function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.user.rol_codigo) &&
        req.user.rol_codigo !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sin permisos suficientes' });
    }
    next();
  };
}

// También por nivel numérico
export function authorizeLevel(nivelMinimo) {
  return (req, res, next) => {
    if (req.user.rol_nivel > nivelMinimo) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sin permisos suficientes' });
    }
    next();
  };
}
```

### `middleware/areaGuard.js` — filtrar por área del usuario
```js
// Inyecta filtro de área en el request para que los servicios lo usen
export function areaGuard(req, res, next) {
  const user = req.user;
  // Super Admin: sin restricción
  if (user.rol_codigo === 'SUPER_ADMIN') {
    req.areaFilter = null;
    req.grupoFilter = null;
    req.asesorFilter = null;
    return next();
  }
  // Admin Área: ve toda su área
  if (user.rol_codigo === 'ADMIN_AREA') {
    req.areaFilter = user.usr_area_id;
    req.grupoFilter = null;
    req.asesorFilter = null;
    return next();
  }
  // Supervisor: ve su grupo
  if (user.rol_codigo === 'SUPERVISOR') {
    req.areaFilter = user.usr_area_id;
    req.grupoFilter = user.usr_grupo_id;
    req.asesorFilter = null;
    return next();
  }
  // Asesor/Agente: solo sus propios registros
  req.areaFilter = user.usr_area_id;
  req.grupoFilter = user.usr_grupo_id;
  req.asesorFilter = user.usr_id;
  next();
}
```

### Uso del areaFilter en servicios
```js
// En prospectos.service.js
export async function getProspectos(filtros, areaFilter, grupoFilter, asesorFilter) {
  let query = `
    SELECT p.*, per.persona_nombre, per.persona_telefono_principal, e.estado_nombre
    FROM sv_crm_prospectos p
    JOIN sv_crm_personas per ON per.persona_id = p.prosp_persona_id
    JOIN sv_cfg_estados_gestion e ON e.estado_id = p.prosp_estado_id
    WHERE p.prosp_activo = true
  `;
  const params = [];
  let i = 1;

  if (areaFilter) { query += ` AND p.prosp_area_id = $${i++}`; params.push(areaFilter); }
  if (grupoFilter) { query += ` AND p.prosp_grupo_id = $${i++}`; params.push(grupoFilter); }
  if (asesorFilter) { query += ` AND p.prosp_asesor_id = $${i++}`; params.push(asesorFilter); }
  // ... más filtros opcionales
  return pool.query(query, params);
}
```

---

## Estructura del JWT payload
```json
{
  "usr_id": 5,
  "rol_codigo": "ASESOR",
  "rol_nivel": 4,
  "usr_area_id": 1,
  "usr_grupo_id": 1,
  "iat": 1708300800,
  "exp": 1708301700
}
```

---

## rol_permisos JSONB — estructura sugerida
```json
{
  "crm": ["read", "write"],
  "admin": [],
  "reportes": ["read"],
  "contratos": ["read", "write"],
  "exportar": [],
  "auditoria": [],
  "sap_config": []
}
```
