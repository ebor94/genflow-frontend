ten cuidado con los nombres de los archivos y endponit , diferencialos con un prefijo para no negerar conflicto

# SerVentas CRM — Contratos de API REST

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <access_token>` en todos los endpoints excepto `/auth/login`.  
Formato: JSON en request y response.  
Errores: `{ "error": "código_error", "message": "descripción legible" }`

---

## Convenciones

- Paginación: `?page=1&limit=20` en todos los listados.
- Filtros: parámetros query `?area_id=1&estado_id=3&asesor_id=12&desde=2026-02-01&hasta=2026-02-28`
- IDs siempre enteros.
- Fechas: ISO 8601 `2026-02-19` o `2026-02-19T15:30:00Z`.
- El middleware `areaGuard` verifica que el usuario tenga acceso al área del recurso solicitado.

---

## AUTH — `/api/v1/auth`

### POST `/auth/login`
```json
// Request
{ "email": "asesor@serfunorte.com", "password": "abc123" }

// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "usr_id": 5,
    "usr_nombre": "Carmen",
    "usr_apellido": "Contreras",
    "usr_email": "carmen@serfunorte.com",
    "usr_area_id": 1,
    "usr_grupo_id": 1,
    "rol": { "rol_codigo": "ASESOR", "rol_nivel": 4 },
    "area": { "area_codigo": "PRENEC", "area_nombre": "Prenecesidad", "area_color_hex": "#C8902A" },
    "punto": { "punto_nombre": "Gran Colombia" }
  }
}

// Response 401
{ "error": "INVALID_CREDENTIALS", "message": "Email o contraseña incorrectos" }
```

### POST `/auth/refresh`
```json
// Request
{ "refreshToken": "eyJ..." }
// Response 200
{ "accessToken": "eyJ..." }
```

### POST `/auth/logout`
```
// Invalida el refresh token en sv_org_sesiones
// Response 204 No Content
```

### GET `/auth/me`
```json
// Response 200 — retorna el usuario actual completo
{ "usr_id": 5, "usr_nombre": "Carmen", ... }
```

---

## CONFIGURACIÓN — `/api/v1/config`
> Solo accesible para roles SUPER_ADMIN y ADMIN_AREA.

### GET `/config/areas`
Retorna todas las áreas activas. El ASESOR solo ve la suya.
```json
[
  { "area_id": 1, "area_codigo": "PRENEC", "area_nombre": "Prenecesidad", "area_color_hex": "#C8902A", "area_tipo_cliente": "individual" },
  { "area_id": 2, "area_codigo": "PREV-EMP", "area_nombre": "Previsión Empresariales", "area_color_hex": "#1A5C8A", "area_tipo_cliente": "empresa" }
]
```

### GET `/config/grupos?area_id=1`
### GET `/config/productos?area_id=1`
### GET `/config/estados?grupo_id=1`
### GET `/config/resultados?grupo_id=1`
### GET `/config/fuentes?area_id=1`
### GET `/config/puntos`

Todos estos endpoints siguen el mismo patrón:
- `GET /` — listar (con filtros por query param)
- `POST /` — crear (solo ADMIN+)
- `PUT /:id` — actualizar (solo ADMIN+)
- `PATCH /:id/toggle` — activar/desactivar (solo ADMIN+)

**Endpoint especial de bootstrap:**
### GET `/config/bootstrap?area_id=1`
Retorna todo lo necesario para renderizar la app de una área en una sola llamada:
```json
{
  "area": { ... },
  "grupos": [ ... ],
  "productos": [ ... ],
  "estados": [ ... ],
  "resultados": [ ... ],
  "fuentes": [ ... ],
  "puntos": [ ... ]
}
```
> Llamar al iniciar la sesión y cachear en el store de Pinia. Reducir peticiones al mínimo.

---

## USUARIOS — `/api/v1/usuarios`
> CRUD completo solo para SUPER_ADMIN y ADMIN_AREA.

### GET `/usuarios?area_id=1&grupo_id=2&activo=true`
### GET `/usuarios/:id`
### POST `/usuarios`
```json
{
  "usr_nombre": "Denis",
  "usr_apellido": "Ramírez",
  "usr_email": "denis@serfunorte.com",
  "usr_password": "temporal123",
  "usr_area_id": 1,
  "usr_grupo_id": 1,
  "usr_rol_id": 4,
  "usr_punto_id": 1,
  "usr_telefono": "311 222 3344"
}
```
### PUT `/usuarios/:id`
### PATCH `/usuarios/:id/toggle` — activar/desactivar
### POST `/usuarios/:id/reset-password`

---

## CRM — PERSONAS — `/api/v1/personas`

### GET `/personas/buscar?telefono=311222333`
> Anti-duplicados. Llamar antes de crear un nuevo prospecto.
```json
// Response 200 — encontrado
{ "encontrado": true, "persona": { "persona_id": 42, "persona_nombre": "María", ... } }

// Response 200 — no encontrado
{ "encontrado": false }
```

### GET `/personas/:id`
### POST `/personas`
```json
{
  "persona_nombre": "María Eugenia",
  "persona_apellido": "Torres Mora",
  "persona_telefono_principal": "311 222 3344",
  "persona_telefono_alterno": "307 111 2233",
  "persona_email": "maria@gmail.com",
  "persona_documento_tipo": "CC",
  "persona_documento_num": "60321456",
  "persona_direccion": "Cll 8 #3-45",
  "persona_barrio": "El Salado",
  "persona_ciudad": "Cúcuta"
}
// Response 201 — { "persona_id": 43, ... }
// Response 409 — duplicado por teléfono
{ "error": "DUPLICATE_PHONE", "message": "Ya existe un cliente con ese teléfono", "persona_id": 42 }
```

### PUT `/personas/:id`

---

## CRM — EMPRESAS — `/api/v1/empresas`
> Solo disponible para área PREV-EMP.

### GET `/empresas?page=1&limit=20&q=industrias`
### GET `/empresas/:id` — incluye contactos y prospectos activos
### POST `/empresas`
```json
{
  "empresa_nit": "900234567-1",
  "empresa_razon_social": "Industrias Cúcuta S.A.S.",
  "empresa_sector": "Manufactura",
  "empresa_num_empleados": 320,
  "empresa_telefono": "310 888 9900",
  "empresa_email_corporativo": "rrhh@industcuc.com",
  "empresa_direccion": "Zona Industrial",
  "empresa_ciudad": "Cúcuta"
}
// Response 409 si NIT ya existe
```
### PUT `/empresas/:id`

### GET `/empresas/buscar?nit=900234567`
> Anti-duplicados por NIT.

---

## CRM — PROSPECTOS — `/api/v1/prospectos`

### GET `/prospectos`
Filtros: `?asesor_id=5&estado_id=3&area_id=1&fecha_desde=2026-02-01&vencidas=true`
```json
{
  "total": 187,
  "page": 1,
  "data": [
    {
      "prosp_id": 101,
      "persona": { "persona_nombre": "María", "persona_apellido": "Torres", "persona_telefono_principal": "311..." },
      "estado": { "estado_nombre": "Interesado", "estado_color_hex": "#C97B1A" },
      "prosp_prox_gestion_fecha": "2026-02-19",
      "asesor": { "usr_nombre": "Carmen", "usr_apellido": "Contreras" }
    }
  ]
}
```

### GET `/prospectos/panel-dia?asesor_id=5`
> Para el Panel del Día. Retorna prospectos con gestión hoy, ordenados por hora.
```json
{
  "urgentes": [ ... ],    // vencidas de días anteriores
  "hoy": [ ... ],         // gestión programada para hoy
  "nuevos": [ ... ],      // sin gestión previa
  "completados_hoy": [ ... ]
}
```

### GET `/prospectos/:id`
Retorna prospecto completo con persona/empresa, historial de gestiones (últimas 20), productos de interés.

### POST `/prospectos`
```json
{
  "prosp_area_id": 1,
  "prosp_grupo_id": 1,
  "prosp_persona_id": 43,       // persona ya creada
  "prosp_asesor_id": 5,
  "prosp_estado_id": 1,         // estado inicial del pipeline
  "prosp_fuente_id": 2,
  "prosp_punto_id": 1,
  "prosp_nota_inicial": "Interesada en osario doble",
  "productos_ids": [3, 5]       // IDs de sv_cfg_productos
}
```

### PUT `/prospectos/:id`
Solo: asesor, estado, punto, nota, prioridad, prox_gestion_fecha/hora.

### PATCH `/prospectos/:id/reasignar`
```json
{ "nuevo_asesor_id": 8 }
```

---

## CRM — GESTIONES — `/api/v1/gestiones`

### POST `/gestiones`
> El endpoint más frecuente de toda la app. Llamado cada vez que un asesor registra un contacto.
```json
{
  "gest_prosp_id": 101,
  "gest_resultado_id": 3,
  "gest_estado_nuevo_id": 3,       // null si no cambia estado
  "gest_canal": "llamada",
  "gest_comentario": "Muy interesada, quiere osario doble. Enviamos cotización.",
  "gest_duracion_seg": 245,
  "gest_prox_fecha": "2026-02-22",
  "gest_prox_hora": "10:00"
}

// Response 201
{
  "gest_id": 1042,
  "prospecto_actualizado": {
    "prosp_id": 101,
    "prosp_estado_id": 3,
    "prosp_prox_gestion_fecha": "2026-02-22"
  }
}
```

### GET `/gestiones?prosp_id=101&page=1&limit=20`
> Historial del prospecto.

### GET `/gestiones/resumen-dia?asesor_id=5&fecha=2026-02-19`
```json
{
  "total_gestiones": 18,
  "positivas": 7,
  "negativos": 4,
  "reagendadas": 7,
  "contratos": 1
}
```

---

## CRM — LISTAS — `/api/v1/listas`

### GET `/listas?area_id=1`
### POST `/listas/cargar`
> Subida de archivo CSV/Excel con prospectos masivos.
```
Content-Type: multipart/form-data
Campos: archivo (file), area_id, grupo_id, fuente_id, nombre_lista
```
Response: `{ "lista_id": 12, "total": 450, "duplicados_omitidos": 23, "nuevos": 427 }`

### GET `/listas/:id/prospectos` — prospectos de esa lista

---

## VENTAS — CONTRATOS — `/api/v1/contratos`

### POST `/contratos`
```json
{
  "contrato_prosp_id": 101,
  "contrato_num": "SV-2026-001",
  "contrato_fecha_firma": "2026-02-19",
  "contrato_valor_total": 4500000,
  "contrato_forma_pago": "cuotas",
  "productos": [
    { "prod_id": 3, "cantidad": 1, "precio_unitario": 4500000, "descuento_pct": 0 }
  ]
}
// POST dispara webhook SAP B1 de forma asíncrona
```

### GET `/contratos/:id`
### GET `/contratos?area_id=1&asesor_id=5&desde=2026-02-01`

### POST `/contratos/:id/sync-sap` — reintentar sync SAP manualmente

---

## SERVICIO AL CLIENTE — `/api/v1/casos`

### GET `/casos?estado=abierto&prioridad=1&agente_id=8`
### GET `/casos/:id` — caso completo con interacciones
### POST `/casos`
```json
{
  "caso_persona_id": 42,
  "caso_contrato_id": 7,
  "caso_tipo": "queja",
  "caso_canal_entrada": "llamada",
  "caso_descripcion": "Inconformidad con horario de entrega de restos.",
  "caso_prioridad": 1,
  "caso_fecha_limite": "2026-02-21",
  "caso_sap_ref": "CNT-2024-1890"
}
```

### POST `/casos/:id/interacciones`
```json
{
  "inter_tipo": "nota",
  "inter_contenido": "Se escaló a supervisor de operaciones.",
  "inter_es_interno": true
}
```

### PATCH `/casos/:id/estado`
```json
{ "caso_estado": "resuelto" }
```

---

## REPORTES — `/api/v1/reportes`

### GET `/reportes/dashboard?area_id=1&fecha=2026-02-19`
> Lee de sv_rpt_snapshot_diario. NO calcula en tiempo real.
```json
{
  "resumen_hoy": {
    "gestiones": 124, "interesados": 42, "contratos": 3, "valor_cop": 14500000
  },
  "meta_mes": { "contratos_meta": 30, "contratos_logrados": 18, "pct": 60 },
  "top_asesores": [ ... ],
  "gestiones_por_resultado": { "interesado": 42, "no_contesta": 38, "ocupado": 28, ... }
}
```

### GET `/reportes/dashboard-multi?fecha=2026-02-19`
> Solo SUPER_ADMIN y ADMIN_AREA. Consolida todas las áreas.
```json
{
  "por_area": [
    { "area": { "area_nombre": "Prenecesidad", ... }, "contratos": 18, "gestiones": 124, "valor_cop": 81000000 },
    { "area": { "area_nombre": "Empresariales", ... }, "contratos": 3, "gestiones": 32, "valor_cop": 0 }
  ],
  "embudo_consolidado": {
    "prospectos_activos": 1470, "interesados": 274, "en_proceso": 68, "cerrados_mes": 31
  }
}
```

### GET `/reportes/asesor/:id?mes=2&anio=2026`
> Vista de métricas personales del asesor.

### GET `/reportes/exportar?area_id=1&desde=2026-02-01&hasta=2026-02-28&formato=excel`
> Genera y devuelve archivo Excel de gestiones.

---

## Códigos de error estándar

| Código | HTTP | Descripción |
|---|---|---|
| `UNAUTHORIZED` | 401 | Token inválido o expirado |
| `FORBIDDEN` | 403 | Sin permisos para el recurso |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `DUPLICATE_PHONE` | 409 | Teléfono ya registrado en sv_crm_personas |
| `DUPLICATE_NIT` | 409 | NIT ya registrado en sv_crm_empresas |
| `VALIDATION_ERROR` | 422 | Campos inválidos (incluye detalles en `fields`) |
| `SAP_SYNC_FAILED` | 200 | Contrato guardado pero SAP falló (no es error crítico) |
| `INTERNAL_ERROR` | 500 | Error interno |
