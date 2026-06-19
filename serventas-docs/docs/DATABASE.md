# SerVentas CRM — Esquema de Base de Datos (DDL Completo)

Base de datos: mysql
Nombre BD: `serfuweb`  
Usuario app: `root` (solo SELECT/INSERT/UPDATE/DELETE, sin DROP/ALTER)  
Convención de prefijos: `sv_{modulo}_{entidad}`

---

## Orden de creación (respeta dependencias FK)

1. `sv_cfg_areas_negocio`
2. `sv_cfg_puntos_atencion`
3. `sv_cfg_grupos_trabajo`
4. `sv_cfg_productos`
5. `sv_cfg_estados_gestion`
6. `sv_cfg_resultados_gestion`
7. `sv_cfg_fuentes_prospecto`
8. `sv_org_roles`
9. `sv_org_usuarios`
10. `sv_org_metas`
11. `sv_org_sesiones`
12. `sv_crm_personas`
13. `sv_crm_empresas`
14. `sv_crm_listas`
15. `sv_crm_prospectos`
16. `sv_crm_prospectos_productos`
17. `sv_crm_gestiones`
18. `sv_sales_contratos`
19. `sv_sales_contrato_productos`
20. `sv_svc_casos`
21. `sv_svc_interacciones`
22. `sv_rpt_snapshot_diario`
23. `sv_rpt_auditoria`

---

## DDL Completo

```sql
-- ============================================================
-- MÓDULO CONFIGURACIÓN — sv_cfg_*
-- Todo lo que cambia entre áreas vive aquí, no en código.
-- ============================================================

CREATE TABLE sv_cfg_areas_negocio (
  area_id          SERIAL PRIMARY KEY,
  area_codigo      VARCHAR(20) NOT NULL UNIQUE,       -- 'PRENEC', 'PREV-EMP', 'PREV-PAP', 'SVC'
  area_nombre      VARCHAR(100) NOT NULL,
  area_descripcion TEXT,
  area_color_hex   CHAR(7),                           -- '#C8902A'
  area_icono       VARCHAR(50),                       -- emoji o nombre de icono
  area_tipo_cliente VARCHAR(20) DEFAULT 'individual', -- 'individual', 'empresa', 'contrato'
  area_activa      BOOLEAN NOT NULL DEFAULT TRUE,
  area_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  area_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sv_cfg_areas_negocio IS 'Unidades de negocio de Serfunorte. Parametrizable sin código.';

-- ============================================================

CREATE TABLE sv_cfg_puntos_atencion (
  punto_id       SERIAL PRIMARY KEY,
  punto_codigo   VARCHAR(20) NOT NULL UNIQUE,   -- 'GC', 'LO', 'SJ', 'TRC'
  punto_nombre   VARCHAR(100) NOT NULL,
  punto_direccion VARCHAR(200),
  punto_ciudad   VARCHAR(80) DEFAULT 'Cúcuta',
  punto_telefono VARCHAR(20),
  punto_activo   BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE sv_cfg_puntos_atencion IS 'Sedes: Gran Colombia, Los Olivos, San José, Torcoroma.';

-- ============================================================

CREATE TABLE sv_cfg_grupos_trabajo (
  grupo_id          SERIAL PRIMARY KEY,
  grupo_area_id     INT NOT NULL REFERENCES sv_cfg_areas_negocio(area_id),
  grupo_codigo      VARCHAR(30) NOT NULL UNIQUE, -- 'TELEMERCADEO', 'EMPRESARIALES', 'PAP', 'SVC-AGENTES'
  grupo_nombre      VARCHAR(100) NOT NULL,
  grupo_tipo_venta  VARCHAR(20) DEFAULT 'individual', -- 'individual', 'b2b', 'masivo', 'postventa'
  grupo_meta_default INT DEFAULT 0,              -- meta mensual por defecto para nuevos asesores
  grupo_activo      BOOLEAN NOT NULL DEFAULT TRUE,
  grupo_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================

CREATE TABLE sv_cfg_productos (
  prod_id               SERIAL PRIMARY KEY,
  prod_area_id          INT NOT NULL REFERENCES sv_cfg_areas_negocio(area_id),
  prod_codigo           VARCHAR(30) NOT NULL UNIQUE,
  prod_nombre           VARCHAR(120) NOT NULL,
  prod_descripcion      TEXT,
  prod_categoria        VARCHAR(50),
  prod_precio_base      NUMERIC(12,2),
  prod_requiere_empresa BOOLEAN NOT NULL DEFAULT FALSE, -- solo para productos B2B
  prod_activo           BOOLEAN NOT NULL DEFAULT TRUE,
  prod_orden_display    SMALLINT DEFAULT 0,
  prod_created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sv_cfg_productos IS
  'Catálogo de productos por área. Prenecesidad: Osario, Cremación, etc.
   Empresariales: Plan Exequial Colectivo, Seguro Vida Grupal, etc.
   PAP: Plan Básico, Plan Premium, Plan Dúo, etc.
   SVC: no aplica productos.';

-- ============================================================

CREATE TABLE sv_cfg_estados_gestion (
  estado_id            SERIAL PRIMARY KEY,
  estado_grupo_id      INT NOT NULL REFERENCES sv_cfg_grupos_trabajo(grupo_id),
  estado_codigo        VARCHAR(30) NOT NULL,
  estado_nombre        VARCHAR(80) NOT NULL,
  estado_color_hex     CHAR(7),
  estado_es_final      BOOLEAN NOT NULL DEFAULT FALSE,
  estado_es_ganado     BOOLEAN NOT NULL DEFAULT FALSE, -- contrato cerrado / afiliado
  estado_requiere_fecha BOOLEAN NOT NULL DEFAULT FALSE, -- obliga a agendar próxima gestión
  estado_orden         SMALLINT DEFAULT 0,
  estado_activo        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(estado_grupo_id, estado_codigo)
);

COMMENT ON TABLE sv_cfg_estados_gestion IS
  'Pipeline por grupo:
   TELEMERCADEO: Nuevo → Contactado → Interesado → En proceso cierre → Cerrado / Descartado
   EMPRESARIALES: Prospecto → Presentación → Cotización → Negociación → Convenio / Perdido
   PAP: Visitado → Interesado → Afiliado / Volver / No interesado
   SVC: Abierto → En gestión → Escalado → Resuelto / Cerrado';

-- ============================================================

CREATE TABLE sv_cfg_resultados_gestion (
  resultado_id            SERIAL PRIMARY KEY,
  resultado_grupo_id      INT NOT NULL REFERENCES sv_cfg_grupos_trabajo(grupo_id),
  resultado_codigo        VARCHAR(30) NOT NULL,
  resultado_nombre        VARCHAR(80) NOT NULL,
  resultado_icono         VARCHAR(10),              -- emoji
  resultado_es_positivo   BOOLEAN NOT NULL DEFAULT TRUE,
  resultado_requiere_fecha BOOLEAN NOT NULL DEFAULT FALSE, -- obliga a poner próxima fecha
  resultado_orden         SMALLINT DEFAULT 0,
  resultado_activo        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(resultado_grupo_id, resultado_codigo)
);

COMMENT ON TABLE sv_cfg_resultados_gestion IS
  'Opciones del dropdown "Resultado" en el formulario de gestión. Configurables por grupo.';

-- ============================================================

CREATE TABLE sv_cfg_fuentes_prospecto (
  fuente_id       SERIAL PRIMARY KEY,
  fuente_area_id  INT NOT NULL REFERENCES sv_cfg_areas_negocio(area_id),
  fuente_codigo   VARCHAR(30) NOT NULL,
  fuente_nombre   VARCHAR(80) NOT NULL,
  fuente_es_masiva BOOLEAN NOT NULL DEFAULT FALSE, -- si viene de una lista cargada
  fuente_activa   BOOLEAN NOT NULL DEFAULT TRUE,
  fuente_orden    SMALLINT DEFAULT 0,
  UNIQUE(fuente_area_id, fuente_codigo)
);

COMMENT ON TABLE sv_cfg_fuentes_prospecto IS
  'Prenecesidad: Telemercadeo, Encuesta, Parque, Referido, Título, Campo.
   Empresariales: Directorio DIAN, Referido Corporativo, Cámara de Comercio.
   PAP: Sector asignado, Referido vecino, Feria comunitaria.
   SVC: Contrato SAP, Llamada entrante, PQRS.';

-- ============================================================
-- MÓDULO ORGANIZACIÓN — sv_org_*
-- ============================================================

CREATE TABLE sv_org_roles (
  rol_id      SERIAL PRIMARY KEY,
  rol_codigo  VARCHAR(30) NOT NULL UNIQUE, -- 'SUPER_ADMIN', 'ADMIN_AREA', 'SUPERVISOR', 'ASESOR', 'AGENTE_SVC'
  rol_nombre  VARCHAR(80) NOT NULL,
  rol_nivel   SMALLINT NOT NULL,           -- 1=Super Admin, 2=Admin Área, 3=Supervisor, 4=Asesor/Agente
  rol_permisos JSONB NOT NULL DEFAULT '{}', -- { "crm": ["read","write"], "admin": ["read"], ... }
  rol_activo  BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE sv_org_roles IS
  'rol_permisos JSONB: { "areas": ["*"], "crm": ["read","write","delete"], "admin": ["read","write"] }
   Super Admin: acceso total.
   Admin Área: solo su área, puede configurar catálogos.
   Supervisor: solo su grupo, puede asignar listas y ver métricas de su equipo.
   Asesor: solo sus propios prospectos.
   Agente SVC: solo casos de servicio al cliente.';

-- ============================================================

CREATE TABLE sv_org_usuarios (
  usr_id           SERIAL PRIMARY KEY,
  usr_area_id      INT REFERENCES sv_cfg_areas_negocio(area_id),   -- NULL para Super Admin
  usr_grupo_id     INT REFERENCES sv_cfg_grupos_trabajo(grupo_id),  -- NULL para Admin+
  usr_rol_id       INT NOT NULL REFERENCES sv_org_roles(rol_id),
  usr_punto_id     INT REFERENCES sv_cfg_puntos_atencion(punto_id),
  usr_email        VARCHAR(150) NOT NULL UNIQUE,
  usr_nombre       VARCHAR(100) NOT NULL,
  usr_apellido     VARCHAR(100) NOT NULL,
  usr_telefono     VARCHAR(20),
  usr_password_hash VARCHAR(255) NOT NULL,
  usr_2fa_secret   VARCHAR(100),                -- para futura implementación 2FA
  usr_activo       BOOLEAN NOT NULL DEFAULT TRUE,
  usr_ultimo_login TIMESTAMPTZ,
  usr_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usr_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usr_area_grupo ON sv_org_usuarios(usr_area_id, usr_grupo_id);

-- ============================================================

CREATE TABLE sv_org_metas (
  meta_id          SERIAL PRIMARY KEY,
  meta_usuario_id  INT REFERENCES sv_org_usuarios(usr_id),  -- NULL si meta es grupal
  meta_grupo_id    INT REFERENCES sv_cfg_grupos_trabajo(grupo_id), -- NULL si meta es individual
  meta_anio        SMALLINT NOT NULL,
  meta_mes         SMALLINT NOT NULL CHECK (meta_mes BETWEEN 1 AND 12),
  meta_contratos   INT DEFAULT 0,
  meta_gestiones   INT DEFAULT 0,
  meta_valor_cop   NUMERIC(14,2) DEFAULT 0,
  meta_created_by  INT REFERENCES sv_org_usuarios(usr_id),
  meta_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_meta_scope CHECK (
    (meta_usuario_id IS NOT NULL AND meta_grupo_id IS NULL) OR
    (meta_usuario_id IS NULL AND meta_grupo_id IS NOT NULL)
  )
);

-- ============================================================

CREATE TABLE sv_org_sesiones (
  sesion_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_usuario_id  INT NOT NULL REFERENCES sv_org_usuarios(usr_id) ON DELETE CASCADE,
  sesion_token_hash  VARCHAR(255) NOT NULL,  -- hash del refresh token
  sesion_dispositivo VARCHAR(200),
  sesion_ip          INET,
  sesion_expires_at  TIMESTAMPTZ NOT NULL,
  sesion_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sesion_usuario ON sv_org_sesiones(sesion_usuario_id);

-- ============================================================
-- MÓDULO CRM — sv_crm_*
-- ============================================================

CREATE TABLE sv_crm_personas (
  persona_id                SERIAL PRIMARY KEY,
  persona_nombre            VARCHAR(100) NOT NULL,
  persona_apellido          VARCHAR(100),
  persona_telefono_principal VARCHAR(20) NOT NULL UNIQUE,  -- ÚNICO: base anti-duplicados
  persona_telefono_alterno  VARCHAR(20),
  persona_email             VARCHAR(150),
  persona_documento_tipo    VARCHAR(10),                   -- 'CC', 'CE', 'PAS'
  persona_documento_num     VARCHAR(20),
  persona_direccion         VARCHAR(250),
  persona_barrio            VARCHAR(100),
  persona_ciudad            VARCHAR(80) DEFAULT 'Cúcuta',
  persona_created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  persona_updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_persona_tel_hash ON sv_crm_personas USING HASH (persona_telefono_principal);

COMMENT ON TABLE sv_crm_personas IS
  'Tabla de personas naturales. Compartida entre todas las áreas.
   UNIQUE en telefono_principal: si ya existe, mostrar prospecto existente.
   No eliminar registros — marcar como inactivo vía prospectos.';

-- ============================================================

CREATE TABLE sv_crm_empresas (
  empresa_id              SERIAL PRIMARY KEY,
  empresa_nit             VARCHAR(20) NOT NULL UNIQUE,
  empresa_razon_social    VARCHAR(200) NOT NULL,
  empresa_sector          VARCHAR(80),
  empresa_num_empleados   INT,
  empresa_telefono        VARCHAR(20),
  empresa_email_corporativo VARCHAR(150),
  empresa_direccion       VARCHAR(250),
  empresa_ciudad          VARCHAR(80) DEFAULT 'Cúcuta',
  empresa_created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  empresa_updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sv_crm_empresas IS
  'Exclusivo para Previsión Empresariales (B2B).
   Una empresa puede tener múltiples contactos (sv_crm_personas) y múltiples prospectos.';

-- ============================================================

CREATE TABLE sv_crm_listas (
  lista_id             SERIAL PRIMARY KEY,
  lista_area_id        INT NOT NULL REFERENCES sv_cfg_areas_negocio(area_id),
  lista_fuente_id      INT REFERENCES sv_cfg_fuentes_prospecto(fuente_id),
  lista_cargada_por    INT NOT NULL REFERENCES sv_org_usuarios(usr_id),
  lista_nombre         VARCHAR(150) NOT NULL,
  lista_total_registros INT DEFAULT 0,
  lista_duplicados_omit INT DEFAULT 0,
  lista_fecha_carga    DATE NOT NULL DEFAULT CURRENT_DATE,
  lista_activa         BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================

CREATE TABLE sv_crm_prospectos (
  prosp_id                SERIAL PRIMARY KEY,
  prosp_area_id           INT NOT NULL REFERENCES sv_cfg_areas_negocio(area_id),
  prosp_grupo_id          INT NOT NULL REFERENCES sv_cfg_grupos_trabajo(grupo_id),
  prosp_persona_id        INT REFERENCES sv_crm_personas(persona_id),       -- NULL si es empresa
  prosp_empresa_id        INT REFERENCES sv_crm_empresas(empresa_id),       -- NULL si es persona
  prosp_contacto_empresa_id INT REFERENCES sv_crm_personas(persona_id),     -- contacto en empresa B2B
  prosp_asesor_id         INT NOT NULL REFERENCES sv_org_usuarios(usr_id),
  prosp_estado_id         INT NOT NULL REFERENCES sv_cfg_estados_gestion(estado_id),
  prosp_fuente_id         INT REFERENCES sv_cfg_fuentes_prospecto(fuente_id),
  prosp_punto_id          INT REFERENCES sv_cfg_puntos_atencion(punto_id),
  prosp_lista_id          INT REFERENCES sv_crm_listas(lista_id),
  prosp_prox_gestion_fecha DATE,
  prosp_prox_gestion_hora  TIME,
  prosp_prioridad         SMALLINT DEFAULT 3 CHECK (prosp_prioridad BETWEEN 1 AND 5),
  prosp_zona_pap          VARCHAR(100),  -- solo PAP: barrio/sector asignado
  prosp_nota_inicial      TEXT,
  prosp_activo            BOOLEAN NOT NULL DEFAULT TRUE,
  prosp_sap_contrato_id   VARCHAR(50),   -- referencia SAP si ya tiene contrato
  prosp_created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prosp_updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_prosp_scope CHECK (
    (prosp_persona_id IS NOT NULL AND prosp_empresa_id IS NULL) OR
    (prosp_empresa_id IS NOT NULL)
  )
);

CREATE INDEX idx_prosp_asesor_fecha ON sv_crm_prospectos(prosp_asesor_id, prosp_prox_gestion_fecha);
CREATE INDEX idx_prosp_area_estado  ON sv_crm_prospectos(prosp_area_id, prosp_estado_id, prosp_activo);
CREATE INDEX idx_prosp_empresa      ON sv_crm_prospectos(prosp_empresa_id) WHERE prosp_empresa_id IS NOT NULL;

COMMENT ON TABLE sv_crm_prospectos IS
  'Corazón del CRM. Cada fila es un ciclo de venta.
   Una persona puede ser prospecto en múltiples áreas simultáneamente (filas separadas).
   prosp_prox_gestion_fecha: fecha de la próxima llamada/visita. Alimenta el Panel del Día.';

-- ============================================================

CREATE TABLE sv_crm_prospectos_productos (
  pp_id        SERIAL PRIMARY KEY,
  pp_prosp_id  INT NOT NULL REFERENCES sv_crm_prospectos(prosp_id) ON DELETE CASCADE,
  pp_prod_id   INT NOT NULL REFERENCES sv_cfg_productos(prod_id),
  pp_es_principal BOOLEAN NOT NULL DEFAULT FALSE,
  pp_nota      VARCHAR(200),
  pp_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pp_prosp_id, pp_prod_id)
);

-- ============================================================

CREATE TABLE sv_crm_gestiones (
  gest_id              BIGSERIAL PRIMARY KEY,
  gest_prosp_id        INT NOT NULL REFERENCES sv_crm_prospectos(prosp_id),
  gest_asesor_id       INT NOT NULL REFERENCES sv_org_usuarios(usr_id),
  gest_resultado_id    INT REFERENCES sv_cfg_resultados_gestion(resultado_id),
  gest_estado_nuevo_id INT REFERENCES sv_cfg_estados_gestion(estado_id), -- estado al que cambió
  gest_canal           VARCHAR(20) DEFAULT 'llamada', -- 'llamada', 'whatsapp', 'presencial', 'correo'
  gest_comentario      TEXT,
  gest_fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gest_duracion_seg    INT,               -- duración de llamada en segundos
  gest_prox_fecha      DATE,
  gest_prox_hora       TIME,
  gest_recordatorio_env BOOLEAN DEFAULT FALSE,
  gest_ubicacion_lat   DECIMAL(10,8),    -- para PAP: geolocalización de la visita
  gest_ubicacion_lng   DECIMAL(11,8),
  gest_created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gest_prosp_fecha  ON sv_crm_gestiones(gest_prosp_id, gest_fecha_hora DESC);
CREATE INDEX idx_gest_asesor_fecha ON sv_crm_gestiones(gest_asesor_id, gest_fecha_hora DESC);

COMMENT ON TABLE sv_crm_gestiones IS
  'Registro cronológico INMUTABLE de cada contacto.
   Nunca se editan ni eliminan filas. Solo INSERT.
   Si un asesor cambia estado, se registra en gest_estado_nuevo_id y
   el sistema actualiza sv_crm_prospectos.prosp_estado_id automáticamente (trigger o lógica de servicio).';

-- ============================================================
-- MÓDULO VENTAS — sv_sales_*
-- ============================================================

CREATE TABLE sv_sales_contratos (
  contrato_id          SERIAL PRIMARY KEY,
  contrato_prosp_id    INT NOT NULL REFERENCES sv_crm_prospectos(prosp_id),
  contrato_asesor_id   INT NOT NULL REFERENCES sv_org_usuarios(usr_id),
  contrato_area_id     INT NOT NULL REFERENCES sv_cfg_areas_negocio(area_id),
  contrato_num         VARCHAR(30) NOT NULL UNIQUE,         -- número interno SerVentas
  contrato_sap_id      VARCHAR(50),                        -- ID en SAP Business One (nullable hasta sync)
  contrato_fecha_firma DATE NOT NULL DEFAULT CURRENT_DATE,
  contrato_valor_total NUMERIC(14,2),
  contrato_forma_pago  VARCHAR(30),                        -- 'contado', 'cuotas', 'nomina'
  contrato_estado      VARCHAR(20) DEFAULT 'vigente',      -- 'vigente', 'cancelado', 'en_mora'
  contrato_sap_sync_at TIMESTAMPTZ,                        -- NULL = pendiente de sync con SAP
  contrato_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contrato_sap ON sv_sales_contratos(contrato_sap_id) WHERE contrato_sap_id IS NOT NULL;

-- ============================================================

CREATE TABLE sv_sales_contrato_productos (
  cp_id              SERIAL PRIMARY KEY,
  cp_contrato_id     INT NOT NULL REFERENCES sv_sales_contratos(contrato_id) ON DELETE CASCADE,
  cp_prod_id         INT NOT NULL REFERENCES sv_cfg_productos(prod_id),
  cp_cantidad        SMALLINT NOT NULL DEFAULT 1,
  cp_precio_unitario NUMERIC(12,2) NOT NULL,
  cp_descuento_pct   DECIMAL(5,2) DEFAULT 0,
  cp_subtotal        NUMERIC(12,2) NOT NULL
);

-- ============================================================
-- MÓDULO SERVICIO AL CLIENTE — sv_svc_*
-- ============================================================

CREATE TABLE sv_svc_casos (
  caso_id            SERIAL PRIMARY KEY,
  caso_persona_id    INT REFERENCES sv_crm_personas(persona_id),
  caso_contrato_id   INT REFERENCES sv_sales_contratos(contrato_id),
  caso_agente_id     INT NOT NULL REFERENCES sv_org_usuarios(usr_id),
  caso_tipo          VARCHAR(20) NOT NULL,  -- 'queja', 'solicitud', 'felicitacion', 'reclamo', 'informacion'
  caso_canal_entrada VARCHAR(20) DEFAULT 'llamada',
  caso_descripcion   TEXT NOT NULL,
  caso_prioridad     SMALLINT DEFAULT 3 CHECK (caso_prioridad BETWEEN 1 AND 5),
  caso_estado        VARCHAR(20) DEFAULT 'abierto', -- 'abierto', 'en_gestion', 'escalado', 'resuelto', 'cerrado'
  caso_sap_ref       VARCHAR(50),          -- referencia SAP del contrato relacionado
  caso_fecha_limite  DATE,
  caso_created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  caso_resuelto_at   TIMESTAMPTZ
);

CREATE INDEX idx_caso_agente ON sv_svc_casos(caso_agente_id, caso_estado);

-- ============================================================

CREATE TABLE sv_svc_interacciones (
  inter_id        BIGSERIAL PRIMARY KEY,
  inter_caso_id   INT NOT NULL REFERENCES sv_svc_casos(caso_id),
  inter_agente_id INT NOT NULL REFERENCES sv_org_usuarios(usr_id),
  inter_tipo      VARCHAR(20) DEFAULT 'nota',  -- 'nota', 'llamada', 'correo', 'escalamiento'
  inter_contenido TEXT NOT NULL,
  inter_es_interno BOOLEAN DEFAULT FALSE,       -- nota interna (no visible al cliente)
  inter_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO REPORTES — sv_rpt_*
-- ============================================================

CREATE TABLE sv_rpt_snapshot_diario (
  snap_id                   BIGSERIAL PRIMARY KEY,
  snap_usuario_id           INT NOT NULL REFERENCES sv_org_usuarios(usr_id),
  snap_area_id              INT NOT NULL REFERENCES sv_cfg_areas_negocio(area_id),
  snap_grupo_id             INT NOT NULL REFERENCES sv_cfg_grupos_trabajo(grupo_id),
  snap_fecha                DATE NOT NULL DEFAULT CURRENT_DATE,
  snap_gestiones_realizadas INT DEFAULT 0,
  snap_interesados_nuevos   INT DEFAULT 0,
  snap_contratos_cerrados   INT DEFAULT 0,
  snap_vencidas_acumuladas  INT DEFAULT 0,  -- gestiones con fecha vencida sin realizar
  snap_valor_vendido_cop    NUMERIC(14,2) DEFAULT 0,
  snap_created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snap_usuario_id, snap_fecha)
);

CREATE INDEX idx_snap_usuario_fecha ON sv_rpt_snapshot_diario(snap_usuario_id, snap_fecha DESC);
CREATE INDEX idx_snap_area_fecha    ON sv_rpt_snapshot_diario(snap_area_id, snap_grupo_id, snap_fecha DESC);

COMMENT ON TABLE sv_rpt_snapshot_diario IS
  'Captura diaria de KPIs por asesor. Generada por cron job a las 23:55.
   Los dashboards leen de esta tabla. No se calcula en tiempo real.';

-- ============================================================

CREATE TABLE sv_rpt_auditoria (
  audit_id           BIGSERIAL PRIMARY KEY,
  audit_usuario_id   INT REFERENCES sv_org_usuarios(usr_id),
  audit_tabla        VARCHAR(80) NOT NULL,
  audit_accion       VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  audit_registro_id  BIGINT NOT NULL,
  audit_datos_antes  JSONB,
  audit_datos_despues JSONB,
  audit_ip           INET,
  audit_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tabla_reg ON sv_rpt_auditoria(audit_tabla, audit_registro_id);
CREATE INDEX idx_audit_usuario   ON sv_rpt_auditoria(audit_usuario_id, audit_created_at DESC);
```

---

## Notas de implementación

### Anti-duplicados
Al crear una persona, primero buscar por `persona_telefono_principal`:
```sql
SELECT persona_id, persona_nombre, persona_apellido
FROM sv_crm_personas
WHERE persona_telefono_principal = $1;
```
Si existe, no crear. Devolver `409 Conflict` con los datos del existente.

### Actualización de estado al registrar gestión
Al insertar en `sv_crm_gestiones` con `gest_estado_nuevo_id NOT NULL`:
```sql
UPDATE sv_crm_prospectos
SET prosp_estado_id = $1,
    prosp_prox_gestion_fecha = $2,
    prosp_prox_gestion_hora  = $3,
    prosp_updated_at = NOW()
WHERE prosp_id = $4;
```

### Cron snapshot diario (node-cron)
```js
// Corre a las 23:55 todos los días
// Para cada usuario activo del día:
INSERT INTO sv_rpt_snapshot_diario (
  snap_usuario_id, snap_area_id, snap_grupo_id, snap_fecha,
  snap_gestiones_realizadas, snap_interesados_nuevos,
  snap_contratos_cerrados, snap_vencidas_acumuladas, snap_valor_vendido_cop
)
SELECT
  g.gest_asesor_id,
  u.usr_area_id,
  u.usr_grupo_id,
  CURRENT_DATE,
  COUNT(g.gest_id) AS gestiones,
  COUNT(CASE WHEN g.gest_estado_nuevo_id IN (SELECT estado_id FROM sv_cfg_estados_gestion WHERE estado_nombre ILIKE '%interesado%') THEN 1 END),
  COUNT(c.contrato_id),
  -- vencidas: prospectos con fecha pasada sin gestión hoy
  0, -- calcular por separado
  COALESCE(SUM(c.contrato_valor_total), 0)
FROM sv_crm_gestiones g
JOIN sv_org_usuarios u ON u.usr_id = g.gest_asesor_id
LEFT JOIN sv_sales_contratos c ON c.contrato_asesor_id = g.gest_asesor_id
  AND c.contrato_fecha_firma = CURRENT_DATE
WHERE DATE(g.gest_fecha_hora) = CURRENT_DATE
GROUP BY g.gest_asesor_id, u.usr_area_id, u.usr_grupo_id
ON CONFLICT (snap_usuario_id, snap_fecha) DO UPDATE
SET snap_gestiones_realizadas = EXCLUDED.snap_gestiones_realizadas,
    snap_contratos_cerrados   = EXCLUDED.snap_contratos_cerrados,
    snap_valor_vendido_cop    = EXCLUDED.snap_valor_vendido_cop;
```
