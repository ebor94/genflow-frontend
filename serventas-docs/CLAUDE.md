# SerVentas CRM — Contexto Maestro para Claude Code

> Este archivo es el punto de entrada principal. Léelo completo antes de escribir cualquier línea de código.
> Los archivos de referencia adicionales están en este mismo directorio.

---

## ¿Qué es este proyecto?

**SerVentas CRM** es una plataforma web comercial para **Serfunorte Los Olivos**, empresa de servicios funerarios en Cúcuta, Colombia. Reemplaza un sistema de gestión basado en Excel (31 hojas separadas por día, sin colaboración, sin métricas en tiempo real, sin validación de duplicados).

La plataforma atiende **4 áreas de negocio** con procesos comerciales distintos:

| Área | Código | Tipo de venta | Grupo |
|---|---|---|---|
| Prenecesidad | PRENEC | Individual / telemercadeo | Telemercadeo |
| Previsión Empresariales | PREV-EMP | B2B / cuentas corporativas | Empresariales |
| Previsión PAP | PREV-PAP | Masivo puerta a puerta | PAP |
| Servicio al Cliente | SVC | Postventa / PQRS | Agentes |

---

## Stack tecnológico obligatorio

```
Backend:   Node.js (ya en uso en Serfunorte) utlizar /Users/bortega/Shared/Files From c.localized/apps/mantix/mantix-backend con prefijos de archivos para no generar conflictos
Frontend:  Vue.js 3 + Vite (ya en uso en Serfunorte)
Base datos: mysql base de datos existente serfuweb
Auth:      JWT (access token 15min + refresh token 7d)
CSS:       Tailwind CSS
Estado:    Pinia
HTTP:      Axios con interceptores para refresh token
Integración: SAP Business One vía webhook (al cerrar contrato), posterior aun no tenemos sap , pero ese es el objetivo
Deploy:    PM2 + Nginx (servidor propio Serfunorte)
```

**No usar:** TypeScript (equipo no familiarizado), MongoDB, GraphQL, Docker en producción inicial.

---

## Paleta de colores y diseño

La identidad visual es **cálida, profesional y sobria** — industria funeraria.

```css
--cream:       #F6F1E9   /* fondo principal */
--brown-deep:  #2C1A0E   /* sidebar, headers oscuros */
--brown-warm:  #9B4F20   /* acentos secundarios */
--gold:        #C8902A   /* color primario de acción */
--gold-bright: #E6AA3A   /* hover states */
--sage:        #6B8F6E   /* éxito, confirmaciones */
--danger:      #B83227   /* errores, alertas críticas */
--warning:     #C97B1A   /* alertas medias */
--text:        #1A0E06   /* texto principal */
--text2:       #4A2E1A   /* texto secundario */
--text3:       #8A6A52   /* labels, placeholders */

/* Por área (para badges y acentos) */
--area-prenec:   #C8902A
--area-emp:      #1A5C8A
--area-pap:      #2A6E47
--area-svc:      #5A3E9E
```

Fuentes: `DM Serif Display` (títulos/headers) + `DM Sans` (body/UI).

---

## Arquitectura multi-área — principio fundamental

> **Todo lo que cambia entre áreas vive en configuración (tablas `sv_cfg_*`), no en código.**

Esto significa:
- Los productos de cada área están en `sv_cfg_productos`
- Los estados del pipeline de cada grupo están en `sv_cfg_estados_gestion`
- Los resultados del formulario de gestión están en `sv_cfg_resultados_gestion`
- Las fuentes de prospecto por área están en `sv_cfg_fuentes_prospecto`

Agregar una nueva área = insertar filas en estas tablas. Cero código nuevo.

---

## Sistema de roles

```
SUPER_ADMIN   → Ve todo, configura todo, accede a todas las áreas
ADMIN_AREA    → Ve solo su área, configura catálogo y equipos
SUPERVISOR    → Ve solo su grupo de trabajo, asigna listas
ASESOR        → Ve solo sus propios prospectos/clientes
AGENTE_SVC    → Ve solo los casos de servicio al cliente
```

El rol se almacena en `sv_org_roles.rol_permisos` como JSONB.
El middleware de auth debe verificar `rol_nivel` para autorización jerárquica.

---

## Estructura de directorios objetivo

```
serventas/
├── CLAUDE.md                    ← este archivo
├── docs/
│   ├── DATABASE.md              ← esquema completo con DDL
│   ├── API.md                   ← contratos de endpoints
│   ├── ROLES.md                 ← permisos detallados
│   └── FLOWS.md                 ← flujos por área
├── backend/ revisar /Users/bortega/Shared/Files From c.localized/apps/mantix/mantix-backend
└── frontend/
    ├── src/
    │   ├── assets/
    │   │   └── styles/
    │   │       ├── main.css       ← variables CSS globales
    │   │       └── components.css
    │   ├── components/
    │   │   ├── common/
    │   │   │   ├── AreaBadge.vue
    │   │   │   ├── StatusPill.vue
    │   │   │   ├── ProgresoMeta.vue
    │   │   │   ├── HistorialItem.vue
    │   │   │   └── EmptyState.vue
    │   │   ├── layout/
    │   │   │   ├── AppSidebar.vue
    │   │   │   ├── AppHeader.vue
    │   │   │   ├── MobileNav.vue
    │   │   │   └── AreaSelector.vue
    │   │   ├── crm/
    │   │   │   ├── FichaProspecto.vue
    │   │   │   ├── FichaEmpresa.vue
    │   │   │   ├── RegistrarGestion.vue
    │   │   │   ├── PipelineVisual.vue
    │   │   │   └── NuevoProspecto.vue
    │   │   └── dashboard/
    │   │       ├── KpiCard.vue
    │   │       ├── BarraProgreso.vue
    │   │       ├── TablaAsesores.vue
    │   │       └── EmbudoFunnel.vue
    │   ├── stores/
    │   │   ├── auth.js            ← usuario, token, área activa
    │   │   ├── config.js          ← catálogos cacheados
    │   │   ├── prospectos.js
    │   │   └── notificaciones.js
    │   ├── views/
    │   │   ├── auth/
    │   │   │   └── Login.vue
    │   │   ├── selector/
    │   │   │   └── SelectorArea.vue
    │   │   ├── prenecesidad/
    │   │   │   ├── PanelDia.vue
    │   │   │   ├── ListaClientes.vue
    │   │   │   ├── FichaCliente.vue
    │   │   │   └── NuevoCliente.vue
    │   │   ├── empresariales/
    │   │   │   ├── PanelEmpresas.vue
    │   │   │   ├── FichaEmpresa.vue
    │   │   │   └── NuevaEmpresa.vue
    │   │   ├── pap/
    │   │   │   ├── PanelPAP.vue
    │   │   │   └── RegistroRapido.vue
    │   │   ├── svc/
    │   │   │   ├── PanelCasos.vue
    │   │   │   └── FichaCaso.vue
    │   │   ├── admin/
    │   │   │   ├── AdminPanel.vue
    │   │   │   ├── GestionAreas.vue
    │   │   │   ├── GestionProductos.vue
    │   │   │   ├── GestionPipeline.vue
    │   │   │   └── GestionUsuarios.vue
    │   │   └── gerencia/
    │   │       └── DashboardMultiArea.vue
    │   ├── router/
    │   │   └── index.js
    │   └── main.js
    ├── package.json
    └── vite.config.js
```

---

## Convención de prefijos de base de datos

Todas las tablas siguen el patrón `sv_{modulo}_{entidad}`:

| Prefijo | Módulo |
|---|---|
| `sv_cfg_` | Configuración / catálogos parametrizables |
| `sv_org_` | Organización / usuarios / roles |
| `sv_crm_` | CRM / prospectos / gestiones |
| `sv_sales_` | Ventas / contratos |
| `sv_svc_` | Servicio al cliente / casos |
| `sv_rpt_` | Reportes / métricas / auditoría |

Ver `docs/DATABASE.md` para el DDL completo.

---

## Reglas de negocio críticas

1. **Anti-duplicados**: Al crear un prospecto se valida `sv_crm_personas.persona_telefono_principal` (UNIQUE). Si existe, mostrar el prospecto existente con opción de reasignar o fusionar.

2. **Aislamiento de datos por área**: Un asesor de PAP jamás puede ver prospectos de Prenecesidad. El `areaGuard` middleware verifica que `req.user.usr_area_id` coincida con el área del recurso solicitado. Supervisores ven su grupo. Admins ven su área. Super Admin ve todo.

3. **Historial inmutable**: Las gestiones (`sv_crm_gestiones`) nunca se editan ni eliminan. Solo se agregan. Si un asesor cometió un error, registra una nueva gestión corrigiendo.

4. **Pipeline siempre hacia adelante en PAP**: En PAP el resultado es inmediato (Afiliado / Volver / No interesado). No hay pipeline multi-paso como en Prenecesidad o Empresariales.



5. **Snapshot diario**: Un cron job (node-cron) corre a las 23:55 y agrega filas a `sv_rpt_snapshot_diario` con los KPIs del día por usuario. El dashboard gerencial lee de esta tabla, no calcula en tiempo real.

6. **Formularios dinámicos**: Los campos del formulario de nuevo prospecto / nueva gestión se renderizan según el `area_id` y `grupo_id` del usuario logueado. No hay lógica if/else en el frontend para esto — los catálogos se cargan desde la API al montar la app.

---

## Fase actual de desarrollo

> **Fase 0 — En curso**: Arquitectura base, autenticación, panel de administración y parametrización.

Las fases están documentadas en `docs/FLOWS.md`.

Orden de implementación dentro de Fase 0:
1. Setup proyecto (Express + Vue + PG)
2. DDL mysql completo (`docs/DATABASE.md`)
3. Seed de datos iniciales (áreas, grupos, roles, productos, estados)
4. Auth (login, JWT, refresh token, logout)
5. Middleware de roles y área guard
6. CRUD de tablas `sv_cfg_*` (para el panel de admin)
7. CRUD de `sv_org_usuarios`
8. Endpoints base de CRM (prospectos, gestiones) — solo estructura
9. Frontend: Login → Selector de Área → Panel Admin

---

## Variables de entorno requeridas

Ver `.env.example` en la raíz del backend. Mínimas:

```env
PORT=3000
NODE_ENV=development

# mysql
DB_HOST=192.9.17.30
DB_PORT=3306
DB_NAME=serfuweb
DB_USER=root
DB_PASSWORD=Olivos*963.

# JWT
JWT_SECRET=Olivos*963.
JWT_REFRESH_SECRET=Olivos*963.
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d



# CORS
CORS_ORIGIN=http://localhost:5173
```

---

## Archivos de referencia en este directorio

| Archivo | Contenido |
|---|---|
| `CLAUDE.md` | Este archivo — contexto maestro |
| `docs/DATABASE.md` | DDL completo PostgreSQL con comentarios |
| `docs/API.md` | Contratos de todos los endpoints REST |
| `docs/ROLES.md` | Matriz de permisos por rol y recurso |
| `docs/FLOWS.md` | Flujos de negocio por área y fases de desarrollo |
| `docs/SEED.sql` | Datos iniciales para poblar la base de datos |
| `docs/MOCKUPS.md` | Descripción textual de cada pantalla (referencia de UI) |

---

*Proyecto: SerVentas CRM · Cliente: Serfunorte Los Olivos · Stack: Node.js + Vue.js 3 + PostgreSQL*
