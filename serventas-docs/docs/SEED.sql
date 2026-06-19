-- ============================================================
-- SerVentas CRM — Datos Iniciales (SEED)
-- Ejecutar DESPUÉS del DDL completo en docs/DATABASE.md
-- ============================================================

-- ============================================================
-- 1. ÁREAS DE NEGOCIO
-- ============================================================
INSERT INTO sv_cfg_areas_negocio (area_codigo, area_nombre, area_descripcion, area_color_hex, area_icono, area_tipo_cliente) VALUES
('PRENEC',   'Prenecesidad',             'Venta individual de servicios funerarios por telemercadeo', '#C8902A', '🕊️', 'individual'),
('PREV-EMP', 'Previsión Empresariales',  'Convenios y planes colectivos con empresas (B2B)',          '#1A5C8A', '🏢',  'empresa'),
('PREV-PAP', 'Previsión PAP',            'Venta masiva puerta a puerta de planes exequiales',         '#2A6E47', '🚶', 'individual'),
('SVC',      'Servicio al Cliente',      'Gestión de casos, PQRS y seguimiento postventa',            '#5A3E9E', '🎧', 'contrato');

-- ============================================================
-- 2. PUNTOS DE ATENCIÓN
-- ============================================================
INSERT INTO sv_cfg_puntos_atencion (punto_codigo, punto_nombre, punto_direccion) VALUES
('GC',  'Gran Colombia',  'Av. Gran Colombia #5-35, Cúcuta'),
('LO',  'Los Olivos',     'Cll 2N #7E-22, Cúcuta'),
('SJ',  'San José',       'Cra 5 #12-10, Cúcuta'),
('TRC', 'Torcoroma',      'Cll 18 #9-45, Cúcuta');

-- ============================================================
-- 3. GRUPOS DE TRABAJO
-- ============================================================
INSERT INTO sv_cfg_grupos_trabajo (grupo_area_id, grupo_codigo, grupo_nombre, grupo_tipo_venta, grupo_meta_default) VALUES
(1, 'TELEMERCADEO',  'Telemercadeo',      'individual', 10),
(2, 'EMPRESARIALES', 'Empresariales B2B', 'b2b',        5),
(3, 'PAP',           'PAP — Campo',       'masivo',     20),
(4, 'SVC-AGENTES',   'Agentes SVC',       'postventa',  0);

-- ============================================================
-- 4. PRODUCTOS POR ÁREA
-- ============================================================

-- Prenecesidad
INSERT INTO sv_cfg_productos (prod_area_id, prod_codigo, prod_nombre, prod_categoria, prod_precio_base, prod_orden_display) VALUES
(1, 'PRE-OSR', 'Osario',        'Inhumación',  3500000, 1),
(1, 'PRE-EXH', 'Exhumación',    'Inhumación',  2800000, 2),
(1, 'PRE-CRM', 'Cremación',     'Cremación',   4200000, 3),
(1, 'PRE-CNZ', 'Cenizario',     'Cremación',   1800000, 4),
(1, 'PRE-CLM', 'Columbario',    'Inhumación',  5500000, 5),
(1, 'PRE-VLC', 'Velación',      'Servicio',    1200000, 6),
(1, 'PRE-PRR', 'Prórroga',      'Servicio',     800000, 7),
(1, 'PRE-INH', 'Inhumación',    'Inhumación',  2200000, 8);

-- Previsión Empresariales
INSERT INTO sv_cfg_productos (prod_area_id, prod_codigo, prod_nombre, prod_categoria, prod_precio_base, prod_requiere_empresa, prod_orden_display) VALUES
(2, 'EMP-PEC', 'Plan Exequial Colectivo',   'Colectivo',   35000, TRUE, 1),
(2, 'EMP-PGR', 'Plan Grupal Premium',       'Colectivo',   55000, TRUE, 2),
(2, 'EMP-SVG', 'Seguro de Vida Grupal',     'Seguro',      28000, TRUE, 3),
(2, 'EMP-COF', 'Cobertura Familiar',        'Colectivo',   45000, TRUE, 4),
(2, 'EMP-CNV', 'Convenio Corporativo Full', 'Convenio',    75000, TRUE, 5);

-- Previsión PAP
INSERT INTO sv_cfg_productos (prod_area_id, prod_codigo, prod_nombre, prod_categoria, prod_precio_base, prod_orden_display) VALUES
(3, 'PAP-BAS', 'Plan Básico Familiar',  'Individual', 18000, 1),
(3, 'PAP-PRE', 'Plan Premium',          'Individual', 32000, 2),
(3, 'PAP-DUO', 'Plan Dúo',             'Individual', 28000, 3),
(3, 'PAP-IND', 'Afiliación Individual', 'Individual', 15000, 4);

-- ============================================================
-- 5. ESTADOS DE GESTIÓN (PIPELINE) POR GRUPO
-- ============================================================

-- Telemercadeo (grupo_id=1)
INSERT INTO sv_cfg_estados_gestion (estado_grupo_id, estado_codigo, estado_nombre, estado_color_hex, estado_es_final, estado_es_ganado, estado_requiere_fecha, estado_orden) VALUES
(1, 'NUEVO',        'Nuevo',                '#8A6A52', FALSE, FALSE, FALSE, 1),
(1, 'CONTACTADO',   'Contactado',           '#C97B1A', FALSE, FALSE, TRUE,  2),
(1, 'INTERESADO',   'Interesado',           '#1A5C8A', FALSE, FALSE, TRUE,  3),
(1, 'EN_PROCESO',   'En proceso de cierre', '#5A3E9E', FALSE, FALSE, TRUE,  4),
(1, 'CERRADO',      'Contrato cerrado',     '#2A6E47', TRUE,  TRUE,  FALSE, 5),
(1, 'DESCARTADO',   'Descartado',           '#B83227', TRUE,  FALSE, FALSE, 6);

-- Empresariales (grupo_id=2)
INSERT INTO sv_cfg_estados_gestion (estado_grupo_id, estado_codigo, estado_nombre, estado_color_hex, estado_es_final, estado_es_ganado, estado_requiere_fecha, estado_orden) VALUES
(2, 'PROSP_EMP',    'Prospecto empresa',    '#8A6A52', FALSE, FALSE, FALSE, 1),
(2, 'CONTACTO_INI', 'Contacto inicial',     '#C97B1A', FALSE, FALSE, TRUE,  2),
(2, 'PRESENTACION', 'Presentación',         '#1A5C8A', FALSE, FALSE, TRUE,  3),
(2, 'COTIZACION',   'Cotización enviada',   '#3A2880', FALSE, FALSE, TRUE,  4),
(2, 'NEGOCIACION',  'Negociación',          '#5A3E9E', FALSE, FALSE, TRUE,  5),
(2, 'CONVENIO',     'Convenio firmado',     '#2A6E47', TRUE,  TRUE,  FALSE, 6),
(2, 'PERDIDO',      'Perdido',              '#B83227', TRUE,  FALSE, FALSE, 7);

-- PAP (grupo_id=3)
INSERT INTO sv_cfg_estados_gestion (estado_grupo_id, estado_codigo, estado_nombre, estado_color_hex, estado_es_final, estado_es_ganado, estado_requiere_fecha, estado_orden) VALUES
(3, 'VISITADO',     'Visitado',             '#8A6A52', FALSE, FALSE, FALSE, 1),
(3, 'INTERESADO',   'Interesado',           '#C97B1A', FALSE, FALSE, TRUE,  2),
(3, 'AFILIADO',     'Afiliado hoy',         '#2A6E47', TRUE,  TRUE,  FALSE, 3),
(3, 'VOLVER',       'Volver a visitar',     '#1A5C8A', FALSE, FALSE, TRUE,  4),
(3, 'NO_INTERES',   'No interesado',        '#B83227', TRUE,  FALSE, FALSE, 5);

-- SVC (grupo_id=4)
INSERT INTO sv_cfg_estados_gestion (estado_grupo_id, estado_codigo, estado_nombre, estado_color_hex, estado_es_final, estado_es_ganado, estado_requiere_fecha, estado_orden) VALUES
(4, 'ABIERTO',      'Abierto',              '#1A5C8A', FALSE, FALSE, FALSE, 1),
(4, 'EN_GESTION',   'En gestión',           '#C97B1A', FALSE, FALSE, FALSE, 2),
(4, 'ESCALADO',     'Escalado',             '#5A3E9E', FALSE, FALSE, TRUE,  3),
(4, 'RESUELTO',     'Resuelto',             '#2A6E47', TRUE,  TRUE,  FALSE, 4),
(4, 'CERRADO',      'Cerrado',              '#8A6A52', TRUE,  FALSE, FALSE, 5);

-- ============================================================
-- 6. RESULTADOS DE GESTIÓN POR GRUPO
-- ============================================================

-- Telemercadeo
INSERT INTO sv_cfg_resultados_gestion (resultado_grupo_id, resultado_codigo, resultado_nombre, resultado_icono, resultado_es_positivo, resultado_requiere_fecha, resultado_orden) VALUES
(1, 'NO_CONTESTA',    'No contesta',               '📵', FALSE, TRUE,  1),
(1, 'OCUPADO',        'Ocupado / volver a llamar', '🔄', FALSE, TRUE,  2),
(1, 'NUM_EQUIVOCADO', 'Número equivocado',         '❌', FALSE, FALSE, 3),
(1, 'NO_INTERESADO',  'No interesado',             '🚫', FALSE, FALSE, 4),
(1, 'INTERESADO_INFO','Interesado — enviar info',  '📩', TRUE,  TRUE,  5),
(1, 'INTERESADO_VIS', 'Interesado — agendar visita','📅', TRUE, TRUE,  6),
(1, 'CONTRATO',       'Contrato firmado',          '✅', TRUE,  FALSE, 7);

-- Empresariales
INSERT INTO sv_cfg_resultados_gestion (resultado_grupo_id, resultado_codigo, resultado_nombre, resultado_icono, resultado_es_positivo, resultado_requiere_fecha, resultado_orden) VALUES
(2, 'NO_CONTESTA',    'No contesta',               '📵', FALSE, TRUE,  1),
(2, 'REUNION_AGEND',  'Reunión agendada',          '📅', TRUE,  TRUE,  2),
(2, 'COTIZ_ENVIADA',  'Cotización enviada',        '📄', TRUE,  TRUE,  3),
(2, 'EN_REVISION',    'En revisión interna',       '⏳', TRUE,  TRUE,  4),
(2, 'CONTRAOFERTA',   'Contraoferta recibida',     '🤝', TRUE,  TRUE,  5),
(2, 'CONVENIO_FIRMADO','Convenio firmado',         '✅', TRUE,  FALSE, 6),
(2, 'PERDIDO',        'Oportunidad perdida',       '❌', FALSE, FALSE, 7);

-- PAP
INSERT INTO sv_cfg_resultados_gestion (resultado_grupo_id, resultado_codigo, resultado_nombre, resultado_icono, resultado_es_positivo, resultado_requiere_fecha, resultado_orden) VALUES
(3, 'AFILIADO_HOY',   'Afiliado hoy',             '✅', TRUE,  FALSE, 1),
(3, 'INTERESADO',     'Interesado',               '💬', TRUE,  TRUE,  2),
(3, 'VOLVER',         'Volver después',           '🔁', FALSE, TRUE,  3),
(3, 'NO_INTERESADO',  'No interesado',            '🚫', FALSE, FALSE, 4),
(3, 'SIN_RESPUESTA',  'Sin respuesta / nadie en casa','🏠', FALSE, FALSE, 5);

-- SVC
INSERT INTO sv_cfg_resultados_gestion (resultado_grupo_id, resultado_codigo, resultado_nombre, resultado_icono, resultado_es_positivo, resultado_requiere_fecha, resultado_orden) VALUES
(4, 'GESTIONANDO',    'En gestión activa',        '⚙️', TRUE,  FALSE, 1),
(4, 'ESCALADO',       'Escalado a otra área',     '⬆️', FALSE, TRUE,  2),
(4, 'INFO_BRINDADA',  'Información brindada',     '💬', TRUE,  FALSE, 3),
(4, 'RESUELTO',       'Caso resuelto',            '✅', TRUE,  FALSE, 4),
(4, 'SIN_SOLUCION',   'Sin solución posible',     '❌', FALSE, FALSE, 5);

-- ============================================================
-- 7. FUENTES DE PROSPECTO POR ÁREA
-- ============================================================

-- Prenecesidad
INSERT INTO sv_cfg_fuentes_prospecto (fuente_area_id, fuente_codigo, fuente_nombre, fuente_es_masiva, fuente_orden) VALUES
(1, 'LISTA_TELE',  'Lista Telemercadeo',  TRUE,  1),
(1, 'ENCUESTA',    'Encuesta',            FALSE, 2),
(1, 'PARQUE',      'Evento / Parque',     FALSE, 3),
(1, 'REFERIDO',    'Referido',            FALSE, 4),
(1, 'TITULO',      'Título de Propiedad', TRUE,  5),
(1, 'CAMPO',       'Campo / Visita',      FALSE, 6);

-- Empresariales
INSERT INTO sv_cfg_fuentes_prospecto (fuente_area_id, fuente_codigo, fuente_nombre, fuente_es_masiva, fuente_orden) VALUES
(2, 'DIR_DIAN',    'Directorio DIAN',          TRUE,  1),
(2, 'CAMARA_COM',  'Cámara de Comercio',       TRUE,  2),
(2, 'REF_CORP',    'Referido Corporativo',     FALSE, 3),
(2, 'EVENTO_EMP',  'Evento Empresarial',       FALSE, 4),
(2, 'COLD_CALL',   'Prospección directa',      FALSE, 5);

-- PAP
INSERT INTO sv_cfg_fuentes_prospecto (fuente_area_id, fuente_codigo, fuente_nombre, fuente_es_masiva, fuente_orden) VALUES
(3, 'ZONA_ASIG',   'Zona asignada',            TRUE,  1),
(3, 'REF_VECINO',  'Referido vecino',          FALSE, 2),
(3, 'FERIA_COM',   'Feria / Evento comunitario', FALSE, 3);

-- SVC
INSERT INTO sv_cfg_fuentes_prospecto (fuente_area_id, fuente_codigo, fuente_nombre, fuente_es_masiva, fuente_orden) VALUES
(4, 'CONTRATO_SAP','Búsqueda por contrato SAP', FALSE, 1),
(4, 'LLAMADA_ENT', 'Llamada entrante',          FALSE, 2),
(4, 'PQRS_WEB',    'PQRS Web',                 FALSE, 3),
(4, 'DERIVADO',    'Derivado de otra área',     FALSE, 4);

-- ============================================================
-- 8. ROLES
-- ============================================================
INSERT INTO sv_org_roles (rol_codigo, rol_nombre, rol_nivel, rol_permisos) VALUES
('SUPER_ADMIN', 'Super Administrador', 1, '{"areas": ["*"], "crm": ["read","write","delete"], "admin": ["read","write"], "reportes": ["read","export"], "auditoria": ["read"], "sap_config": ["read","write"]}'),
('ADMIN_AREA',  'Administrador de Área', 2, '{"crm": ["read","write"], "admin": ["read","write"], "reportes": ["read","export"]}'),
('SUPERVISOR',  'Supervisor de Grupo',   3, '{"crm": ["read","write"], "admin": ["read"], "reportes": ["read","export"]}'),
('ASESOR',      'Asesor Comercial',      4, '{"crm": ["read","write"], "reportes": ["read"]}'),
('AGENTE_SVC',  'Agente Servicio al Cliente', 4, '{"svc": ["read","write"], "reportes": ["read"]}');

-- ============================================================
-- 9. USUARIOS DE PRUEBA
-- Contraseña de todos: "serventas2026" (hash bcrypt rounds=12)
-- IMPORTANTE: Cambiar en producción. Generar hash real con bcrypt.
-- ============================================================
-- Hash de ejemplo (reemplazar con bcrypt real): $2b$12$placeholder_hash_here

-- Super Admin
INSERT INTO sv_org_usuarios (usr_rol_id, usr_email, usr_nombre, usr_apellido, usr_password_hash, usr_telefono) VALUES
(1, 'admin@serfunorte.com', 'Super', 'Admin', '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '300 000 0001');

-- Admin Prenecesidad
INSERT INTO sv_org_usuarios (usr_area_id, usr_grupo_id, usr_rol_id, usr_punto_id, usr_email, usr_nombre, usr_apellido, usr_password_hash, usr_telefono) VALUES
(1, 1, 2, 1, 'admin.prenec@serfunorte.com', 'Admin', 'Prenecesidad', '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '300 000 0002');

-- Supervisor Telemercadeo
INSERT INTO sv_org_usuarios (usr_area_id, usr_grupo_id, usr_rol_id, usr_punto_id, usr_email, usr_nombre, usr_apellido, usr_password_hash, usr_telefono) VALUES
(1, 1, 3, 1, 'supervisor.tele@serfunorte.com', 'Patricia', 'Vargas', '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '301 111 0001');

-- Asesoras Prenecesidad / Telemercadeo
INSERT INTO sv_org_usuarios (usr_area_id, usr_grupo_id, usr_rol_id, usr_punto_id, usr_email, usr_nombre, usr_apellido, usr_password_hash, usr_telefono) VALUES
(1, 1, 4, 1, 'carmen.contreras@serfunorte.com', 'Carmen',  'Contreras', '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '311 222 3344'),
(1, 1, 4, 1, 'denis.ramirez@serfunorte.com',    'Denis',   'Ramírez',   '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '311 222 3345'),
(1, 1, 4, 2, 'angelica.mora@serfunorte.com',    'Angélica','Mora',       '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '311 222 3346');

-- Ejecutivo Empresariales
INSERT INTO sv_org_usuarios (usr_area_id, usr_grupo_id, usr_rol_id, usr_punto_id, usr_email, usr_nombre, usr_apellido, usr_password_hash, usr_telefono) VALUES
(2, 2, 4, 1, 'carlos.mendoza@serfunorte.com', 'Carlos', 'Mendoza', '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '312 333 4455'),
(2, 2, 4, 1, 'jose.martinez@serfunorte.com',  'José',   'Martínez', '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '312 333 4456');

-- Asesor PAP
INSERT INTO sv_org_usuarios (usr_area_id, usr_grupo_id, usr_rol_id, usr_punto_id, usr_email, usr_nombre, usr_apellido, usr_password_hash, usr_telefono) VALUES
(3, 3, 4, 3, 'luis.perez@serfunorte.com',    'Luis',   'Pérez',    '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '313 444 5566'),
(3, 3, 4, 3, 'diana.silva@serfunorte.com',   'Diana',  'Silva',    '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '313 444 5567');

-- Agente SVC
INSERT INTO sv_org_usuarios (usr_area_id, usr_grupo_id, usr_rol_id, usr_punto_id, usr_email, usr_nombre, usr_apellido, usr_password_hash, usr_telefono) VALUES
(4, 4, 5, 1, 'andrea.suarez@serfunorte.com', 'Andrea', 'Suárez', '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH', '314 555 6677');

-- ============================================================
-- 10. PERSONAS DE PRUEBA (Prenecesidad)
-- ============================================================
INSERT INTO sv_crm_personas (persona_nombre, persona_apellido, persona_telefono_principal, persona_telefono_alterno, persona_direccion, persona_barrio) VALUES
('María Eugenia',  'Torres Mora',    '311 555 0001', NULL,           'Cll 8 #3-45',    'El Salado'),
('Roberto Carlos', 'Díaz Leal',      '311 555 0002', '311 555 0020', 'Cra 7 #10-22',   'La Libertad'),
('Luz Marina',     'Peña García',    '311 555 0003', NULL,           'Cll 12 #5-10',   'Atalaya'),
('Hernando',       'Suárez Blanco',  '311 555 0004', NULL,           'Cra 9 #8-33',    'Caobos'),
('Gloria Inés',    'Ramírez Cruz',   '311 555 0005', NULL,           'Cll 15 #4-20',   'Quinta Bosch'),
('Fernando',       'Cardona López',  '311 555 0006', '311 555 0060', 'Cra 3 #6-11',    'La Playa'),
('Olga Patricia',  'Vega Martínez',  '311 555 0007', NULL,           'Cll 5 #2-44',    'El Llano'),
('Julio César',    'Mora Rincón',    '311 555 0008', NULL,           'Cra 12 #3-18',   'Chapinero'),
('Sandra Milena',  'Jaimes Torres',  '311 555 0009', NULL,           'Cll 9 #7-29',    'La Merced'),
('Beatriz Elena',  'Cáceres Ortega', '311 555 0010', NULL,           'Cra 6 #11-05',   'Callejón'),
-- Personas para Empresariales (contactos)
('Germán',         'Ortiz Jiménez',  '310 888 9900', '310 888 9901', 'Zona Industrial',       'Zona Industrial'),
('Sandra',         'Betancourt',     '310 777 8800', NULL,           'Av. Libertadores 12-5', 'Centro'),
('Rodrigo',        'Pabón García',   '310 666 7700', NULL,           'Diagonal 8 #3-20',      'La Pampa'),
-- Personas para PAP
('María',          'Ramírez',        '310 100 2001', NULL,           'Cll 12 #8-45',   'La Libertad'),
('Juan Carlos',    'Blanco',         '310 100 2002', NULL,           'Cll 12 #8-52',   'La Libertad'),
('Rosa Elena',     'Díaz',           '310 100 2003', NULL,           'Cra 8 #12-10',   'La Libertad'),
('Ernesto',        'Vargas',         '310 100 2004', NULL,           'Cll 13 #7-22',   'La Libertad'),
('Claudia',        'Rojas',          '310 100 2005', NULL,           'Cra 9 #13-44',   'La Libertad');

-- ============================================================
-- 11. EMPRESAS DE PRUEBA
-- ============================================================
INSERT INTO sv_crm_empresas (empresa_nit, empresa_razon_social, empresa_sector, empresa_num_empleados, empresa_telefono, empresa_email_corporativo, empresa_direccion) VALUES
('900234567-1', 'Industrias Cúcuta S.A.S.',       'Manufactura',  320, '310 888 9900', 'rrhh@industcuc.com',    'Zona Industrial, Cúcuta'),
('800123456-2', 'Clínica del Norte Ltda.',         'Salud',        180, '310 777 8800', 'admin@clinicadelnorte.com', 'Av. Libertadores 12-5, Cúcuta'),
('901111222-3', 'Almacenes Textiles del Norte',    'Comercio',      95, '310 666 7700', 'gerencia@textilesnorte.com', 'Centro Comercial Ventura, Cúcuta');

-- ============================================================
-- 12. PROSPECTOS DE PRUEBA (Prenecesidad)
-- Estado ID: 1=Nuevo,2=Contactado,3=Interesado,4=En proceso,5=Cerrado,6=Descartado
-- Fuente ID: 1=Lista Tele, 2=Encuesta, 3=Parque, 4=Referido
-- Asesor IDs: Carmen=4, Denis=5, Angélica=6
-- Punto ID: 1=Gran Colombia, 2=Los Olivos
-- ============================================================
INSERT INTO sv_crm_prospectos (prosp_area_id, prosp_grupo_id, prosp_persona_id, prosp_asesor_id, prosp_estado_id, prosp_fuente_id, prosp_punto_id, prosp_prox_gestion_fecha, prosp_prox_gestion_hora, prosp_nota_inicial, prosp_prioridad) VALUES
(1, 1, 1,  4, 3, 1, 1, CURRENT_DATE,       '10:00', 'Interesada en osario doble, cotizó en otra funeraria', 2),
(1, 1, 2,  4, 2, 1, 1, CURRENT_DATE,       '11:30', 'Contactado, pedir que llame después', 3),
(1, 1, 3,  4, 1, 1, 1, CURRENT_DATE,       '09:00', 'Lista nueva febrero', 3),
(1, 1, 4,  5, 4, 2, 1, CURRENT_DATE,       '14:00', 'Encuesta parque, muy interesado, reunión agendada', 1),
(1, 1, 5,  5, 3, 1, 1, CURRENT_DATE + 1,   '10:00', 'Interesada, quiere hablar con el esposo', 2),
(1, 1, 6,  5, 2, 4, 1, CURRENT_DATE,       '16:00', 'Referido de clienta García, ocupado mañana', 3),
(1, 1, 7,  6, 1, 1, 2, CURRENT_DATE,       '09:30', 'Lista nueva', 4),
(1, 1, 8,  6, 3, 1, 2, CURRENT_DATE + 2,   '11:00', 'Interesado en cremación', 2),
(1, 1, 9,  4, 5, 1, 1, NULL,               NULL,    'Cerrado — firmó osario + velación', 1),
(1, 1, 10, 5, 6, 1, 1, NULL,               NULL,    'No interesado, tiene contrato en Jardines', 5);

-- Prospectos Empresariales (asesor_id=7=Carlos, empresa IDs=1,2,3)
-- Estado IDs Empresariales: 1=Prospecto,2=Contacto ini,3=Presentación,4=Cotización,5=Negociación,6=Convenio,7=Perdido
INSERT INTO sv_crm_prospectos (prosp_area_id, prosp_grupo_id, prosp_empresa_id, prosp_contacto_empresa_id, prosp_asesor_id, prosp_estado_id, prosp_fuente_id, prosp_punto_id, prosp_prox_gestion_fecha, prosp_nota_inicial) VALUES
(2, 2, 1, 11, 7, 5, 8, 1, CURRENT_DATE, 'Reunión hoy 3pm, en negociación por precio por empleado'),
(2, 2, 2, 12, 7, 3, 8, 1, CURRENT_DATE + 3, 'Presentación realizada, enviando cotización esta semana'),
(2, 2, 3, 13, 8, 6, 8, 1, NULL, 'Convenio firmado! 95 empleados, Plan Exequial Colectivo');

-- ============================================================
-- 13. PRODUCTOS POR PROSPECTO
-- ============================================================
INSERT INTO sv_crm_prospectos_productos (pp_prosp_id, pp_prod_id, pp_es_principal) VALUES
(1, 1, TRUE),   -- María Torres → Osario
(1, 6, FALSE),  -- María Torres → Velación
(4, 3, TRUE),   -- Hernando Suárez → Cremación
(5, 1, TRUE),   -- Gloria Ramírez → Osario
(8, 3, TRUE),   -- Julio Mora → Cremación
(9, 1, TRUE),   -- Sandra Jaimes (cerrado) → Osario
(9, 6, FALSE),  -- Sandra Jaimes → Velación
(11, 9, TRUE),  -- Empresa 1 → Plan Exequial Colectivo
(12, 9, TRUE),  -- Empresa 2 → Plan Exequial Colectivo
(13, 9, TRUE);  -- Empresa 3 → Plan Exequial Colectivo (convenio)

-- ============================================================
-- 14. GESTIONES DE PRUEBA
-- ============================================================
-- Resultado IDs Telemercadeo: 1=No contesta,2=Ocupado,3=Num equivocado,4=No interesado,5=Interesado info,6=Interesado visita,7=Contrato
INSERT INTO sv_crm_gestiones (gest_prosp_id, gest_asesor_id, gest_resultado_id, gest_estado_nuevo_id, gest_canal, gest_comentario, gest_fecha_hora, gest_prox_fecha, gest_prox_hora) VALUES
-- Prospecto 1 (María Torres) — 3 gestiones
(1, 4, 1, NULL,  'llamada',  'No contesta. Intentar en 2 horas.',               NOW() - INTERVAL '5 days', (CURRENT_DATE - 4), '10:00'),
(1, 4, 2, NULL,  'llamada',  'Ocupado, pide llamar mañana.',                    NOW() - INTERVAL '4 days', (CURRENT_DATE - 3), '11:00'),
(1, 4, 5, 3,     'llamada',  'Muy interesada en osario doble, cotizó en Jardines. Enviando información por WhatsApp.', NOW() - INTERVAL '2 days', CURRENT_DATE, '10:00'),
-- Prospecto 2 (Roberto Díaz) — 1 gestión
(2, 4, 2, 2,     'llamada',  'Contactado, dice que llame después de las 5pm.', NOW() - INTERVAL '1 day', CURRENT_DATE, '11:30'),
-- Prospecto 4 (Hernando Suárez) — 2 gestiones
(4, 5, 6, 3,     'llamada',  'Muy interesado desde la encuesta del parque. Agendó visita para hablar más tranquilo.', NOW() - INTERVAL '3 days', (CURRENT_DATE - 1), '14:00'),
(4, 5, 5, 4,     'presencial','Visita excelente. Le expliqué plan de cremación. Quiere firmar esta semana.', NOW() - INTERVAL '1 day', CURRENT_DATE, '14:00'),
-- Prospecto 9 (Sandra Jaimes — CERRADO)
(9, 4, 7, 5,     'presencial','Firmó contrato de osario doble + velación. Pago contado.', NOW() - INTERVAL '1 day', NULL, NULL),
-- Prospecto Empresa 1 (Industrias Cúcuta)
(10, 7, 5, 3,    'llamada',  'Presentación agendada con Germán Ortiz, RRHH.', NOW() - INTERVAL '10 days', (CURRENT_DATE - 7), '09:00'),
(10, 7, 4, 4,    'presencial','Presentación excelente. Solicitaron cotización para 320 empleados.', NOW() - INTERVAL '7 days', (CURRENT_DATE - 3), '14:00'),
(10, 7, 3, 5,    'llamada',  'Cotización enviada $18.5M. Están analizando con la junta.', NOW() - INTERVAL '3 days', CURRENT_DATE, '15:00');

-- ============================================================
-- 15. CONTRATO DE PRUEBA (para el prospecto cerrado)
-- ============================================================
INSERT INTO sv_sales_contratos (contrato_prosp_id, contrato_asesor_id, contrato_area_id, contrato_num, contrato_fecha_firma, contrato_valor_total, contrato_forma_pago, contrato_estado) VALUES
(9, 4, 1, 'SV-2026-001', CURRENT_DATE - 1, 5700000, 'contado', 'vigente');

INSERT INTO sv_sales_contrato_productos (cp_contrato_id, cp_prod_id, cp_cantidad, cp_precio_unitario, cp_descuento_pct, cp_subtotal) VALUES
(1, 1, 1, 4500000, 0, 4500000),
(1, 6, 1, 1200000, 0, 1200000);

-- ============================================================
-- 16. META DE PRUEBA (Febrero 2026)
-- ============================================================
INSERT INTO sv_org_metas (meta_usuario_id, meta_anio, meta_mes, meta_contratos, meta_gestiones, meta_valor_cop, meta_created_by) VALUES
(4, 2026, 2, 10, 200, 45000000, 3),  -- Carmen
(5, 2026, 2, 10, 200, 45000000, 3),  -- Denis
(6, 2026, 2, 10, 200, 45000000, 3),  -- Angélica
(7, 2026, 2,  5,  80,  0,       2),  -- Carlos (Empresariales, meta en convenios)
(8, 2026, 2,  5,  80,  0,       2),  -- José
(9, 2026, 2, 20, 400,  0,       2),  -- Luis (PAP, meta en afiliaciones)
(10,2026, 2, 20, 400,  0,       2);  -- Diana

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT 'Areas'      AS tabla, COUNT(*) AS registros FROM sv_cfg_areas_negocio
UNION ALL SELECT 'Grupos',     COUNT(*) FROM sv_cfg_grupos_trabajo
UNION ALL SELECT 'Productos',  COUNT(*) FROM sv_cfg_productos
UNION ALL SELECT 'Estados',    COUNT(*) FROM sv_cfg_estados_gestion
UNION ALL SELECT 'Resultados', COUNT(*) FROM sv_cfg_resultados_gestion
UNION ALL SELECT 'Fuentes',    COUNT(*) FROM sv_cfg_fuentes_prospecto
UNION ALL SELECT 'Roles',      COUNT(*) FROM sv_org_roles
UNION ALL SELECT 'Usuarios',   COUNT(*) FROM sv_org_usuarios
UNION ALL SELECT 'Personas',   COUNT(*) FROM sv_crm_personas
UNION ALL SELECT 'Empresas',   COUNT(*) FROM sv_crm_empresas
UNION ALL SELECT 'Prospectos', COUNT(*) FROM sv_crm_prospectos
UNION ALL SELECT 'Gestiones',  COUNT(*) FROM sv_crm_gestiones
UNION ALL SELECT 'Contratos',  COUNT(*) FROM sv_sales_contratos;
