# Diseño — Agendas, eventos multi-asesor, OTP y jornada obligatoria

**Fecha:** 2026-09-14
**Autor:** Bryan Ortega (yubra94@gmail.com) con Claude
**Estado:** Draft para aprobación
**Ámbito:** `mantix-backend` (Express + Sequelize) + `crm-frontend` (Vue 3 + Pinia)

---

## 1. Contexto y motivación

El Director Comercial hace seguimiento a todo el equipo comercial (coordinadores y asesores). El Coordinador de Previsión hace seguimiento a los asesores de Previsión. La operación exige:

- Eventos multi-asesor en rango de fechas, con registro externo tipo landing pública.
- Vistas de seguimiento (día/semana/mes, uno o todos los asesores).
- Auditoría fuerte sobre cambios: cuando el propio dueño edita su evento debe pasar por un OTP enviado al chat del jefe.
- Cumplimiento estricto de tracking GPS: bloqueo duro al primer login del día hasta que el usuario inicie jornada o declare ausencia con motivo.

El módulo actual de agenda (`sv_org_eventos_agenda`) es 1 asesor + fecha única; no soporta N asesores ni rangos, ni registro público, ni métricas de gestión. La infraestructura de tracking GPS (`sv_org_jornadas`, `sv_org_tracking_puntos`) está sólida pero no obliga el inicio de jornada.

## 2. Decomposición y orden de implementación

Cuatro sub-proyectos independientes en su spec pero acoplados en modelo de datos.

| SP | Título | Depende de | Orden |
|---|---|---|---|
| SP-4 | Popup obligatorio de jornada | — | **1° (prioridad de negocio)** |
| SP-1 | Eventos multi-asesor + pool público | — | 2° |
| SP-2 | Vistas de seguimiento | SP-1 | 3° |
| SP-3 | OTP para edición del dueño | SP-1 | 4° |

Cada SP debe pasar por su propio ciclo `writing-plans` → implementación → tests → deploy antes del siguiente.

## 3. Requerimientos confirmados

1. **Eventos híbridos**: un evento maestro con asistentes N:N. Cada asistente tiene sus propias métricas.
2. **Rango de fechas flexible al crear**: modo `UNICO` (fecha única), `DIA_COMPLETO_MULTI` (rango de días), o `SLOTS` (lista de {fecha, hora_inicio, hora_fin}).
3. **Link público de registro** → los registros entran a un pool de prospectos sin asignar (aprovechando `prosp_asesor_id = NULL` que ya existe). El coordinador los distribuye desde el detalle del evento.
4. **Resultado de gestión**: solo métricas del evento (leads captados, prospectos creados, ventas cerradas por asistente).
5. **OTP para edición propia**: cuando el asesor titular edita su evento, se genera OTP de 6 dígitos, se envía al webhook de Google Chat donde lo lee el jefe (coordinador/director), el jefe se lo pasa al asesor, el asesor lo confirma en la UI.
6. **Visita con apoyo**: campo simple `evento_apoyo_usr_id` (cualquier usuario). El evento aparece también en la agenda de quien apoya, con marca visual.
7. **Vistas de seguimiento**: calendario tipo Google Calendar para 1 asesor; Gantt/timeline para varios. Toggle automático según selección.
8. **Popup obligatorio de jornada**: bloqueante duro al primer login del día para todos los operativos (excepto Director/Gerente/Super Admin). Debe iniciar jornada o marcar "no laboro hoy" con motivo escrito.

## 4. Modelo de datos

### 4.1 SP-4 · Ausencias declaradas

```sql
CREATE TABLE sv_org_jornadas_ausencias (
  aus_id         INT AUTO_INCREMENT PRIMARY KEY,
  aus_usr_id     INT NOT NULL,
  aus_fecha      DATE NOT NULL,
  aus_tipo       VARCHAR(30) NOT NULL,   -- PERMISO | INCAPACIDAD | DIA_LIBRE | OTRO
  aus_motivo     TEXT NOT NULL,           -- min 5 chars, obligatorio
  aus_created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_aus_usr_fecha (aus_usr_id, aus_fecha),
  INDEX idx_aus_fecha (aus_fecha),
  CONSTRAINT fk_aus_usr FOREIGN KEY (aus_usr_id) REFERENCES sv_org_usuarios(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.2 SP-1 · Eventos multi-asesor + pool

```sql
-- 4.2.1 Extensiones al evento maestro
ALTER TABLE sv_org_eventos_agenda
  ADD COLUMN evento_fecha_fin     DATETIME    NULL AFTER evento_fecha_hora,
  ADD COLUMN evento_modo_fechas   VARCHAR(20) NOT NULL DEFAULT 'UNICO'
    COMMENT 'UNICO | DIA_COMPLETO_MULTI | SLOTS',
  ADD COLUMN evento_apoyo_usr_id  INT         NULL,
  ADD COLUMN evento_link_hash     CHAR(32)    NULL UNIQUE
    COMMENT 'hash del link público de registro',
  ADD COLUMN evento_registros_publicos_habilitado TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN evento_meta_leads    INT         NULL,
  ADD COLUMN evento_grupo_id      INT         NULL,
  ADD COLUMN evento_area_id       INT         NULL,
  ADD INDEX idx_evento_apoyo      (evento_apoyo_usr_id),
  ADD INDEX idx_evento_grupo_fecha (evento_grupo_id, evento_fecha_hora);
-- evento_fecha_hora conserva el nombre por compatibilidad; en el modelo se expone
-- como alias `evento_fecha_inicio`.

-- 4.2.2 Asistentes (N:N)
CREATE TABLE sv_org_eventos_asistentes (
  eva_id            INT AUTO_INCREMENT PRIMARY KEY,
  eva_evento_id     INT NOT NULL,
  eva_usr_id        INT NOT NULL,
  eva_estado        VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADO'
    COMMENT 'CONFIRMADO | ASISTIO | NO_ASISTIO | JUSTIFICADO',
  eva_leads_captados     INT NULL,
  eva_prospectos_creados INT NULL,
  eva_ventas_cerradas    INT NULL,
  eva_activo         TINYINT NOT NULL DEFAULT 1,
  eva_created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_eva_evento_usr (eva_evento_id, eva_usr_id),
  INDEX idx_eva_usr (eva_usr_id),
  CONSTRAINT fk_eva_evento FOREIGN KEY (eva_evento_id)
    REFERENCES sv_org_eventos_agenda(evento_id) ON DELETE CASCADE,
  CONSTRAINT fk_eva_usr FOREIGN KEY (eva_usr_id)
    REFERENCES sv_org_usuarios(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4.2.3 Slots por día
CREATE TABLE sv_org_eventos_slots (
  slot_id          INT AUTO_INCREMENT PRIMARY KEY,
  slot_evento_id   INT NOT NULL,
  slot_fecha       DATE NOT NULL,
  slot_hora_inicio TIME NOT NULL,
  slot_hora_fin    TIME NOT NULL,
  INDEX idx_slot_evento_fecha (slot_evento_id, slot_fecha),
  CONSTRAINT fk_slot_evento FOREIGN KEY (slot_evento_id)
    REFERENCES sv_org_eventos_agenda(evento_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4.2.4 Pool de registros públicos
CREATE TABLE sv_org_eventos_pool_registros (
  pool_id           INT AUTO_INCREMENT PRIMARY KEY,
  pool_evento_id    INT NOT NULL,
  pool_nombre       VARCHAR(180) NOT NULL,
  pool_telefono     VARCHAR(30)  NOT NULL,
  pool_correo       VARCHAR(180) NULL,
  pool_ip           VARCHAR(45)  NULL,
  pool_user_agent   VARCHAR(255) NULL,
  pool_prosp_id     INT NULL COMMENT 'FK a sv_crm_prospectos cuando se convierte',
  pool_asignado_a   INT NULL COMMENT 'usr_id del asesor asignado',
  pool_asignado_at  DATETIME NULL,
  pool_asignado_por INT NULL,
  pool_created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pool_evento_tel (pool_evento_id, pool_telefono),
  INDEX idx_pool_evento     (pool_evento_id),
  INDEX idx_pool_pendiente  (pool_evento_id, pool_prosp_id),
  CONSTRAINT fk_pool_evento FOREIGN KEY (pool_evento_id)
    REFERENCES sv_org_eventos_agenda(evento_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.3 SP-3 · OTPs para edición

```sql
CREATE TABLE sv_org_evento_otps (
  otp_id           INT AUTO_INCREMENT PRIMARY KEY,
  otp_evento_id    INT NOT NULL,
  otp_usr_id       INT NOT NULL COMMENT 'quien pidió el token',
  otp_hash         CHAR(64) NOT NULL COMMENT 'sha256(token)',
  otp_expires_at   DATETIME NOT NULL,
  otp_consumed_at  DATETIME NULL,
  otp_intentos     TINYINT NOT NULL DEFAULT 0,
  otp_payload_json JSON NULL COMMENT 'snapshot del cambio propuesto',
  otp_created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_evento (otp_evento_id, otp_consumed_at),
  CONSTRAINT fk_otp_evento FOREIGN KEY (otp_evento_id)
    REFERENCES sv_org_eventos_agenda(evento_id) ON DELETE CASCADE,
  CONSTRAINT fk_otp_usr FOREIGN KEY (otp_usr_id)
    REFERENCES sv_org_usuarios(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- Token en claro nunca persiste, solo su sha256.
- Expiración: `created_at + 10 min`.
- Cap de OTPs activos por (usuario, evento): 3.

### 4.4 SP-2 · Sin cambios de esquema

Solo endpoints y vistas nuevas que consultan las tablas anteriores.

## 5. Endpoints backend

### 5.1 SP-4 · Jornada

```
GET  /api/sv/jornadas/hoy
  → { estado: 'sin_iniciar'|'activa'|'finalizada'|'ausente',
      jornada: {...}|null, ausencia: {...}|null,
      requiere_popup: bool }
  Regla: requiere_popup=true si (rol operativo) Y (estado='sin_iniciar')
         Y (fecha no es festivo).

POST /api/sv/jornadas/ausencia
  body: { tipo, motivo }
  → 201 { aus_id }
  Insert con unique key (usr_id, fecha_hoy).
```

Los endpoints `POST /jornadas/iniciar` y `POST /jornadas/:id/finalizar` ya existen.

### 5.2 SP-1 · Eventos

```
POST   /api/sv/eventos-agenda
       body: {
         titulo, descripcion, tipo,
         modo_fechas: 'UNICO'|'DIA_COMPLETO_MULTI'|'SLOTS',
         fecha_inicio, fecha_fin,
         slots: [{fecha,hora_inicio,hora_fin}, ...],
         asistentes_ids: [3,5,12],
         apoyo_usr_id: 27|null,
         empresa_id, prosp_id,
         registros_publicos_habilitado: bool,
         meta_leads: int
       }
PUT    /api/sv/eventos-agenda/:id                (solo ROLES_SUPERVISORES)
GET    /api/sv/eventos-agenda/:id                (incluye asistentes, slots, pool count)
DELETE /api/sv/eventos-agenda/:id                (solo ROLES_SUPERVISORES)

GET    /api/sv/eventos-agenda/:id/pool           (?asignado=0|1)
POST   /api/sv/eventos-agenda/:id/pool/:pool_id/asignar
       body: { asesor_id }
       Efecto: crea SvProspecto con fuente=EVENTO_LINK,
               actualiza pool_prosp_id/pool_asignado_*.

PATCH  /api/sv/eventos-agenda/:id/asistentes/:eva_id/metricas
       body: { estado, leads_captados, prospectos_creados, ventas_cerradas }

GET    /api/sv/eventos-agenda/:id/resumen
       → { total_registros, total_asignados, total_pendientes,
           por_asesor: [{usr, leads, prospectos, ventas}] }
```

**Rutas públicas (sin `svAuth`):**

```
GET  /api/sv/public/eventos/:hash
     → { evento_id, titulo, fecha_inicio, fecha_fin, empresa_nombre }
POST /api/sv/public/eventos/:hash/registro
     body: { nombre, telefono, correo }
     → 201 { ok:true }  (idempotente por evento+telefono)
     Rate limit: 10/min por IP.
```

Se registra en `routes/index.js` **antes** de aplicar `svAuth` para el sub-path `/public/*`.

### 5.3 SP-3 · OTP

```
POST /api/sv/eventos-agenda/:id/otp/solicitar
     body: { cambios: {...diff...} }
     Requisito: actor === evento_asesor_id (dueño). No aplica a jefes:
                los jefes editan directo con PUT (sin OTP).
     Efecto: genera OTP 6 dígitos, envía al webhook Google Chat.
     Fire-and-forget con timeout 5s.
     → 200 { otp_id, expires_at, canal: 'google_chat' }

POST /api/sv/eventos-agenda/:id/otp/confirmar
     body: { otp_id, otp: '493712' }
     → 200 evento actualizado
     Errores: 410 GONE (expiró), 409 CONFLICT (consumido),
              401 (código inválido; 3 intentos → invalida OTP).
```

**Servicio `services/googleChat.service.js`:**

```js
const WEBHOOK_URL = process.env.GCHAT_WEBHOOK_EVENTOS;
async function enviarOtp({ evento, usuario, cambios, otp }) { ... }
```
`.env` — nunca hardcodear el webhook.

### 5.4 SP-2 · Vistas seguimiento

```
GET /api/sv/agenda/semana?anio=&semana=&asesores_ids=
GET /api/sv/agenda/timeline?fecha=&asesores_ids=
GET /api/sv/agenda/kpis?desde=&hasta=&asesores_ids=
```

Los `/agenda/dia` y `/agenda/mes` existentes se extienden con `asesores_ids=` opcional.

### 5.5 Reglas de scope

Nuevo helper en `utils/acceso.js`:

```js
function usuariosAccesibles(actor) {
  // SUPER_ADMIN | GERENTE | DIRECTOR → usr_id[] de sus áreas
  // COORDINADOR | JEFE_PAP | SUPERVISOR → usr_id[] de sus grupos
  // ASESOR | AGENTE_SVC → [actor.usr_id]
}
```

| Endpoint | Regla |
|---|---|
| `POST /eventos-agenda` | Asistentes deben estar en `usuariosAccesibles(actor)`. Asesor solo puede agregarse a sí mismo. |
| `PUT /eventos-agenda/:id` | Solo `ROLES_SUPERVISORES`. Dueño usa OTP. |
| `POST /otp/solicitar` | Solo el dueño del evento (`evento_asesor_id`). |
| `POST /pool/:pool_id/asignar` | Solo jefes; asesor destino debe estar en `asistentes` del evento. |
| `GET /jornadas/hoy` | Cualquier autenticado (self). |
| `POST /jornadas/ausencia` | Cualquier operativo (self). |
| `GET /public/eventos/:hash` | Sin auth. Rate-limit por IP. |
| `GET /agenda/timeline?asesores_ids=` | Filtra silenciosamente los ids fuera de scope; agrega warning. |

## 6. Componentes frontend

### 6.1 SP-4 · Popup obligatorio

**Nuevos archivos:**
- `src/components/tracking/ModalInicioJornadaObligatorio.vue`
- `src/stores/useJornadaObligatoriaStore.js`
- `src/composables/useChequeoJornada.js`

**Flujo:**

```
useAuthStore.login() → fetchMe() → useChequeoJornada.check()
    → GET /jornadas/hoy
    → si requiere_popup: setEstado('bloqueado')
    → App.vue observa store → monta modal
```

**Modal:** overlay opaco full-screen `z-index: 9999`, sin cerrar con Escape ni click fuera. Dos tabs:

- **Iniciar jornada**: botón grande → `useTrackingStore.iniciar()` → cierra
- **No laboro hoy**: select tipo + textarea motivo (min 5) → `POST /jornadas/ausencia` → cierra

Se re-chequea al cambiar `visibilityState=visible` (por si cambió de día).

### 6.2 SP-1 · Eventos multi-asesor

**Nuevos/modificados:**

- `src/components/crm/NuevoEventoAgendaModal.vue` (rediseño)
- `src/components/crm/EventoPoolPanel.vue`
- `src/components/crm/EventoMetricasPanel.vue`
- `src/components/crm/EventoLinkPublicoShare.vue`
- `src/views/comun/EventoDetalleView.vue`
- `src/views/public/RegistroPublicoEvento.vue` (ruta pública `/registro-evento/:hash`)
- `src/api/eventosApi.js` (extracción de `agendaApi.js`)

**`NuevoEventoAgendaModal.vue`:**
1. Título, tipo, descripción
2. Modo fechas (`UNICO` / `DIA_COMPLETO_MULTI` / `SLOTS`)
3. Asistentes — multiselect filtrado a `usuariosAccesibles`
4. Apoyo — select opcional de cualquier usuario en scope
5. Registro público — toggle
6. Meta de leads (opcional)

**`EventoDetalleView.vue`:** 3 tabs — Asistentes (métricas editables) · Pool (asignación) · Resumen (KPIs).

**Router — ruta pública con bypass del guard:**

```js
{ path: '/registro-evento/:hash', name: 'registro-evento-publico',
  component: () => import('@/views/public/RegistroPublicoEvento.vue'),
  meta: { public: true } }
```

El guard global respeta `meta.public`.

### 6.3 SP-3 · UI del OTP

`src/components/crm/OtpConfirmarModal.vue`:

Flujo — Asesor click "Editar" → composable detecta `esDueño && !esJefe` → al Guardar hace `POST /otp/solicitar` con diff → abre modal con input de 6 dígitos, contador 10 min, botón "Reenviar" habilitado tras 30s → confirma → toast → cierra.

### 6.4 SP-2 · Vistas seguimiento

- `src/views/comun/AgendaSeguimientoView.vue` (contenedor + tabs día/semana/mes)
- `src/components/agenda/CalendarioAsesor.vue` (1 asesor tipo Google Calendar)
- `src/components/agenda/TimelineMultiAsesor.vue` (Gantt filas × asesor)
- `src/components/agenda/SelectorAsesores.vue`

Toggle:

```js
const modoVista = computed(() =>
  asesoresSeleccionados.value.length === 1
    && asesoresSeleccionados.value[0] !== 'todos'
    ? 'calendario' : 'timeline'
);
```

Ruta protegida `roles: [...ROLES_SUPERVISORES]`. Entrada en sidebar solo para supervisores.

### 6.5 Reglas UX transversales

- Modales con `<Teleport to="body">`.
- Colores por asesor deterministas (hash de `usr_id`).
- Fechas siempre `America/Bogota`.
- Modal jornada con **overlay opaco**, no semi-transparente.

## 7. Validaciones (Joi)

Ver detalles inline en sección 5 de los mensajes de diseño; se incluyen en el spec como referencia:

- **Crear evento**: validaciones condicionales por `modo_fechas` (rango o slots requeridos según caso).
- **Registro público**: `nombre` (2-180), `telefono` (regex `^[+]?[\d\s\-()]{7,20}$`), `correo` opcional con `tlds: { allow: false }` (permite `.local`).
- **Ausencia**: `tipo` (enum), `motivo` (min 5, max 500).
- **OTP confirmar**: `otp_id` int, `otp` regex `^\d{6}$`.

Rate limit: `express-rate-limit` 10 req/min por IP en `/public/eventos/*/registro`.

## 8. Edge cases

### 8.1 SP-4

- Usuario cierra sesión con jornada activa → logout ya finaliza. Al re-login puede iniciar jornada nueva.
- Marcar ausencia y arrepentirse → `DELETE /jornadas/ausencia/hoy`.
- Cambio de día en sesión abierta → re-chequeo por `visibilitychange` reactiva el popup.
- Sin permiso GPS → jornada se inicia sin coords, warning visible; los puntos empiezan cuando conceda permiso.
- Sin `usr_consentimiento_geo_at` → primero flujo de consentimiento habeas data (ya existe), luego el modal.
- Rol Director/Gerente/SuperAdmin → `requiere_popup=false` siempre.
- Domingo/festivo (`sv_org_fechas_especiales`) → `requiere_popup=false`.

### 8.2 SP-1

- Slots con horarios solapados → permitido (parallelo intencional), warning visual.
- Remover asistente con métricas > 0 → soft delete (`eva_activo=0`) preservando histórico.
- Evento eliminado con pool ya convertido → prospectos sobreviven (huérfanos al evento).
- Link público de evento finalizado (`fecha_fin < NOW()`) → 410 GONE.
- Registro público duplicado (mismo teléfono) → 200 idempotente.
- Asesor asistente sin scope → puede ver, no puede editar.

### 8.3 SP-3

- Google Chat webhook cae → 503 y rollback del OTP; frontend muestra "no se pudo enviar".
- 5 solicitudes seguidas → 429 al 4to (rate limit 3 activos por usuario+evento).
- OTP expirado → 410; frontend ofrece nuevo código.
- 3 intentos fallidos → invalidado, exige solicitar nuevo.

### 8.4 SP-2

- `asesores_ids` con id fuera de scope → filtro silencioso + warning en payload.
- Vista mes con muchos eventos → `LIMIT 500` backend, virtualización frontend en celdas con >10.

## 9. Testing

### 9.1 Backend

| Suite | Cobertura |
|---|---|
| `tests/services/jornadaObligatoria.test.js` | `/jornadas/hoy` por rol × situación (sin jornada, activa, ausencia, festivo). |
| `tests/services/eventosAgenda.test.js` | Crear con cada modo_fechas; scope multi-asesor; asignación pool crea prospecto. |
| `tests/services/eventoOtp.test.js` | Solicitar/confirmar; expiración; 3 fallos; rate-limit; rollback si webhook falla. |
| `tests/services/googleChat.test.js` | Mock webhook; formato mensaje, timeout, retry. |
| `tests/routes/publicEventos.test.js` | Rate-limit; hash inválido → 404; evento cerrado → 410; dedup por teléfono. |
| `tests/utils/acceso.test.js` | `usuariosAccesibles(actor)` por rol × estructura de grupos. |

### 9.2 Frontend

| Test | Cobertura |
|---|---|
| `stores/useJornadaObligatoriaStore.spec.js` | Cache 60s; transiciones; re-chequeo al cambiar de día. |
| `components/ModalInicioJornadaObligatorio.spec.js` | No cierra con Escape ni click fuera; ambos tabs; motivo min 5. |
| `components/OtpConfirmarModal.spec.js` | Auto-tab entre celdas; contador; reenviar deshabilitado 30s. |
| `views/RegistroPublicoEvento.spec.js` | Form válido; teléfono inválido bloquea; confirmación. |
| E2E (opcional) | Happy path completo login → jornada → evento → link público → asignación → prospecto. |

### 9.3 Humo post-deploy

Checklist:
- Login asesor → modal aparece → iniciar jornada → GPS pide permiso → punto se registra.
- Login coordinador → sin modal → puede ver `/agenda/seguimiento`.
- Crear evento con 3 asesores → cada uno lo ve en su día.
- Habilitar link público → registrar desde móvil externo → aparece en pool → asignar → aparece como prospecto.
- Asesor edita su evento → OTP a Google Chat → confirma → cambio aplicado.
- Marcar "no laboro hoy" → cierra → al día siguiente vuelve.

## 10. Observabilidad

**Logs estructurados** (`console.log(JSON.stringify({tag,...}))`):

| Evento | Tag | Campos |
|---|---|---|
| Popup mostrado | `JORNADA_POPUP_SHOWN` | usr_id, rol, fecha |
| Jornada iniciada por popup | `JORNADA_STARTED_FROM_POPUP` | usr_id, jor_id, latencia_login_a_inicio_min |
| Ausencia declarada | `JORNADA_AUSENCIA` | usr_id, tipo, motivo[:30], fecha |
| OTP enviado | `OTP_SENT` | evento_id, usr_id, canal, tiempo_gchat_ms |
| OTP confirmado | `OTP_CONFIRMED` | evento_id, otp_id, latencia_solicitud_confirmar_s |
| OTP expirado | `OTP_EXPIRED` | evento_id, otp_id |
| OTP fallido 3× | `OTP_FAILED_MAX` | evento_id, otp_id |
| Google Chat error | `GCHAT_ERROR` | tipo, detalle |
| Registro público | `EVENT_PUBLIC_REGISTRATION` | evento_id, ip_hash, dedup:bool |
| Pool asignado | `EVENT_POOL_ASSIGNED` | evento_id, pool_id, asesor_id, jefe_id, prosp_id |

**KPIs (SP-2 dashboard):**
- Cumplimiento de jornada (% días laborales con jornada iniciada).
- Eventos completados vs planificados.
- Leads del pool vs meta.
- Conversión pool → prospecto → venta.

**Cron jobs nuevos** en `sv/jobs/`:
- `jobs/otpCleanup.job.js` — cada hora borra OTPs `expires_at < NOW() - 24h`.
- Validar en `jobs/jornadaAutoCierre.job.js` si conviene agregar alerta cuando un operativo no inicia jornada al mediodía (decisión en implementación).

## 11. Configuración

Nuevas variables `.env` del backend:

```
GCHAT_WEBHOOK_EVENTOS=https://chat.googleapis.com/v1/spaces/AAQAwLUP2X8/messages?key=...&token=...
OTP_EXPIRACION_MIN=10
OTP_MAX_ACTIVOS_POR_USR_EVENTO=3
OTP_MAX_INTENTOS=3
PUBLIC_EVENTOS_RATE_LIMIT_MAX=10
PUBLIC_EVENTOS_RATE_LIMIT_WINDOW_SEC=60
```

## 12. Consideraciones fuera de scope

- Multi-webhook por grupo (cada equipo con su canal) — futuro.
- Push notifications móviles al popup de jornada — futuro (por ahora es visual + PWA).
- Distribución automática de leads (round-robin) — Requerimiento explícito fue distribución manual desde pool.
- Métricas cualitativas del asesor (notas del jefe, rating 1-5) — descartadas por el usuario en clarificaciones.
- Evidencias/adjuntos en el evento — descartadas.

## 13. Preguntas abiertas

- ¿Reasignación de pool tras primer asignado? (Ej.: coordinador asigna a A, después quiere pasarlo a B). Propuesta: sí, se permite mientras el prospecto siga sin gestión. Se decide en el plan de SP-1.
- ¿El popup respeta también el `usr_horario_laboral` (JSON en `sv_org_usuarios`)? Es decir, si el asesor tiene horario "L-V 8-6" y hoy es sábado, no molestar. Propuesta: sí. Se decide en el plan de SP-4.
