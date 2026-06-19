# SerVentas CRM — Flujos de Negocio y Fases de Desarrollo

---

## Flujos por Área

---

### Área 1: PRENECESIDAD — Telemercadeo

**Tipo:** Individual · Seguimiento por teléfono  
**Grupo:** Telemercadeo  
**Fuentes de prospectos:** Listas cargadas por supervisor (Excel → CSV), encuestas, parque, campo, referidos

#### Pipeline de estados
```
1. NUEVO          → Prospecto sin gestión previa
2. CONTACTADO     → Se logró hablar, sin interés definido
3. INTERESADO     → Solicitó información o cotización
4. EN_PROCESO     → Reunión pactada o en negociación activa
5. CERRADO        ✅ Estado final positivo — contrato firmado
6. DESCARTADO     ❌ Estado final negativo — no interesado definitivo
```

#### Resultados de gestión
```
- No contesta (requiere reagendar)
- Ocupado / volver a llamar (requiere reagendar)
- Número equivocado
- No interesado
- Interesado — enviar información (requiere reagendar)
- Interesado — agendar visita (requiere fecha)
- Contrato firmado ✅
```

#### Flujo del asesor (día a día)
1. Abre app → ve **Panel del Día** con lista de gestiones pendientes ordenadas por hora
2. Toca un cliente → **Ficha Cliente** (datos + historial + estado actual)
3. Llama desde el botón o WhatsApp
4. Al terminar → **Registrar Gestión**: elige resultado, escribe comentario, agenda próxima fecha
5. Sistema actualiza el estado del prospecto automáticamente

#### Reglas específicas
- Un asesor no puede ver prospectos de otro asesor (salvo supervisor+)
- Si el resultado es "No contesta" tres veces seguidas → se sugiere descarte
- Al cerrar contrato → crear registro en `sv_sales_contratos` → webhook SAP B1

---

### Área 2: PREVISIÓN — EMPRESARIALES (B2B)

**Tipo:** Empresa · Ciclo largo de venta (semanas a meses)  
**Grupo:** Empresariales  
**Fuentes:** Directorio DIAN, Cámara de Comercio, Referido corporativo, Cold outreach

#### Pipeline de estados
```
1. PROSPECTO_EMP      → Empresa identificada, sin contacto
2. CONTACTO_INICIAL   → Primer contacto realizado
3. PRESENTACION       → Reunión de presentación agendada/realizada
4. COTIZACION_ENV     → Propuesta económica enviada
5. NEGOCIACION        → En proceso de revisión/aprobación
6. CONVENIO_FIRMADO   ✅ Estado final positivo
7. PERDIDO            ❌ Estado final negativo
```

#### Diferencias clave vs Prenecesidad
- El prospecto es una **empresa**, no una persona
- Puede haber **múltiples contactos** en la misma empresa (RRHH, Gerente, etc.)
- El ciclo dura semanas o meses, con múltiples gestiones
- Los productos son colectivos (por número de empleados)
- El contrato puede incluir condiciones especiales de nómina
- Un convenio firmado puede generar múltiples afiliaciones individuales después

#### Flujo del ejecutivo
1. Identifica empresa objetivo (directorio o referido)
2. Crea la **empresa** en el sistema (NIT, razón social, sector, #empleados)
3. Registra el **contacto principal** (nombre, cargo, teléfono)
4. Crea el **prospecto** vinculado a esa empresa
5. Avanza por el pipeline: presentación → cotización (carga propuesta en notas) → negociación
6. Al firmar: registra contrato + los productos incluidos
7. Webhook SAP para registrar el convenio

---

### Área 3: PREVISIÓN — PAP (Puerta a Puerta)

**Tipo:** Individual masivo · Trabajo de campo  
**Grupo:** PAP  
**Fuentes:** Sector/zona asignada, feria comunitaria, referido vecino

#### Pipeline de estados (simplificado)
```
1. VISITADO      → Casa tocada
2. INTERESADO    → Quiere más información o pensar
3. AFILIADO      ✅ Estado final positivo — plan activado hoy
4. VOLVER        → Requiere revisita (fecha)
5. NO_INTERESADO ❌ Estado final negativo
```

#### Diferencias clave
- Formulario **ultra-rápido**: nombre, teléfono, dirección, resultado → 4 campos → < 30 segundos
- Alta volumetría: un asesor puede registrar 50-100 visitas por día
- La geolocalización es opcional pero útil para mapas de zona
- El pipeline es **inmediato**: no hay estado intermedio de largo plazo
- Se trabaja por **zona asignada** (barrio, manzana)

#### Flujo del asesor PAP
1. Supervisor le asigna zona al inicio del día
2. Asesor toca puertas, registra cada visita en el formulario rápido
3. Si "Afiliado hoy" → se completa el plan y se crea el contrato desde campo
4. Si "Volver" → queda en agenda para próximo día con dirección guardada
5. Al final del día → resumen automático de visitas/afiliaciones

---

### Área 4: SERVICIO AL CLIENTE / POSTVENTA

**Tipo:** Gestión de casos  
**Grupo:** SVC Agentes  
**Fuentes:** Llamada entrante, PQRS web, derivado de otra área, búsqueda por contrato SAP

#### Pipeline de estados
```
1. ABIERTO       → Caso creado, sin atender
2. EN_GESTION    → Agente trabajando en el caso
3. ESCALADO      → Requiere intervención de otro área/nivel
4. RESUELTO      → Solución aplicada
5. CERRADO       → Confirmado por el cliente o por tiempo
```

#### Tipos de caso
```
- queja          → Inconformidad con el servicio
- reclamo        → Solicitud formal de compensación
- solicitud      → Petición de trámite o información
- felicitacion   → Reconocimiento positivo
- informacion    → Consulta general
```

#### Diferencias clave
- El agente **busca al cliente por número de contrato SAP** (no crea prospectos)
- El contrato viene de SAP B1, los datos se cruzan con `sv_sales_contratos.contrato_sap_id`
- Los casos tienen **fecha límite** (SLA) según prioridad
- Las interacciones internas (notas) no son visibles al cliente

---

## Fases de Desarrollo

### Fase 0 — Arquitectura Base *(ACTUAL)*
**Objetivo:** Tener el proyecto corriendo, la base de datos poblada, y el login funcionando.

- [ ] Crear repositorio y estructura de carpetas (ver `CLAUDE.md`)
- [ ] Configurar `package.json` backend (Express, pg, bcrypt, jsonwebtoken, node-cron, cors, helmet, multer)
- [ ] Configurar `package.json` frontend (Vue 3, Vite, Pinia, Vue Router, Axios, Tailwind)
- [ ] Ejecutar `docs/SEED.sql` — datos iniciales
- [ ] Implementar `POST /auth/login` y `GET /auth/me`
- [ ] Implementar JWT + refresh token + `sv_org_sesiones`
- [ ] Middleware `auth`, `authorize`, `areaGuard`
- [ ] CRUD completo de `sv_cfg_*` (áreas, grupos, productos, estados, resultados, fuentes)
- [ ] CRUD de `sv_org_usuarios`
- [ ] Frontend: Login → SelectorArea → AdminPanel (solo estructura)

**Entregable:** Login funcional, panel de admin navegable, seed con datos reales.

---

### Fase 1 — Módulo Prenecesidad
**Objetivo:** Un asesor de Prenecesidad puede hacer su trabajo completo en SerVentas.

- [ ] API: `/personas`, `/prospectos`, `/gestiones`, `/listas`
- [ ] API: `/reportes/dashboard?area_id=1`
- [ ] Frontend: PanelDia, ListaClientes, FichaCliente, RegistrarGestion, NuevoCliente
- [ ] Frontend: Agenda visual semanal
- [ ] Frontend: Métricas personales del asesor
- [ ] Frontend: Dashboard supervisor (lista de asesores con métricas del día)
- [ ] Cron snapshot diario

**Entregable:** Reemplazo funcional del Excel de Telemercadeo.

---

### Fase 2 — Módulo Previsión Empresariales
**Objetivo:** Un ejecutivo B2B puede gestionar su cartera de empresas.

- [ ] API: `/empresas` (CRUD con validación NIT)
- [ ] Frontend: PanelEmpresas, FichaEmpresa (con pipeline visual), NuevaEmpresa
- [ ] Frontend: Formulario de nuevo prospecto B2B (persona + empresa)
- [ ] Frontend: Vista Kanban del pipeline empresarial

**Entregable:** Módulo B2B operativo.

---

### Fase 3 — Módulo PAP
**Objetivo:** Un asesor de campo puede registrar visitas desde el celular en < 30 segundos.

- [ ] API: PAP usa los mismos endpoints de prospectos y gestiones con filtros de área
- [ ] Frontend: PanelPAP (contador de visitas del día)
- [ ] Frontend: RegistroRapido (formulario de 4 campos, optimizado para mobile)
- [ ] Frontend: Mapa de zona (opcional — Google Maps o Leaflet)

**Entregable:** App móvil-first para trabajo de campo.

---

### Fase 4 — Servicio al Cliente + SAP B1
**Objetivo:** Los agentes de postventa gestionan casos con trazabilidad completa.

- [ ] API: `/casos` y `/casos/:id/interacciones`
- [ ] API: `/contratos` con webhook SAP B1
- [ ] Frontend: PanelCasos, FichaCaso con historial de interacciones
- [ ] Integración SAP B1: webhook al crear contrato + job de reintento
- [ ] Frontend: búsqueda de contrato por número SAP

**Entregable:** Módulo SVC + integración SAP.

---

### Fase 5 — Dashboard Gerencial Multi-Área
**Objetivo:** Gerencia ve todo en tiempo real en un solo lugar.

- [ ] API: `/reportes/dashboard-multi`
- [ ] Frontend: DashboardMultiArea con filtros por área/grupo/período
- [ ] Frontend: Embudo consolidado, KPIs comparativos, tabla de asesores
- [ ] Exportación a Excel de reportes consolidados
- [ ] Optimización de queries y snapshot diario completo

**Entregable:** Dashboard gerencial listo para presentación ejecutiva.

---

## Datos de prueba disponibles

El archivo `docs/SEED.sql` contiene:
- 4 áreas de negocio configuradas
- 4 grupos de trabajo
- 8 productos de Prenecesidad
- 5 productos de Empresariales
- 4 productos de PAP
- Estados y resultados de gestión para cada grupo
- Fuentes de prospecto por área
- 4 sedes/puntos de atención
- 5 roles del sistema
- 10 usuarios de prueba (1 Super Admin, 2 asesores Prenecesidad, 2 ejecutivos Empresariales, 2 asesores PAP, 2 agentes SVC, 1 supervisor)
- 20 personas de prueba
- 3 empresas de prueba
- 30 prospectos de prueba (distribuidos en áreas)
- 50 gestiones de prueba
