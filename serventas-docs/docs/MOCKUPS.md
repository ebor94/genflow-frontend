# SerVentas CRM — Descripción de Pantallas (Referencia UI)

Los mockups visuales están en los archivos HTML adjuntos. Este archivo es la referencia textual para implementación.

---

## Paleta y tipografía (ver CLAUDE.md para valores hex)

- Fondo principal: `#F6F1E9` (cream)
- Sidebar/headers oscuros: `#2C1A0E` (brown-deep)
- Color de acción primario: `#C8902A` (gold) → degradado con `#9B4F20`
- Éxito: `#2A6E47` · Error: `#B83227` · Warning: `#C97B1A`
- Fuentes: `DM Serif Display` (headings) + `DM Sans` (body)
- Border radius base: `12px` · Cards: `14px` · Botones: `10px`
- Sombra cards: `0 2px 8px rgba(44,26,14,0.08)`

---

## PANTALLA: Login

**Ruta:** `/login`  
**Layout:** Centrado, una columna, fondo cream-dark

Elementos:
- Logo Serfunorte (imagen) + nombre "SerVentas CRM"
- Campo email + campo contraseña
- Botón "Ingresar" (gold, ancho completo)
- Mensaje de error si credenciales incorrectas
- No hay enlace de registro (solo admin crea usuarios)

Comportamiento:
- POST `/api/v1/auth/login`
- Si éxito → guardar tokens en `localStorage` (access + refresh) y user en Pinia store
- Redirigir a `/selector` si rol ≥ ADMIN o si usuario tiene múltiples áreas accesibles
- Redirigir directamente al panel del área si es ASESOR con área única

---

## PANTALLA: Selector de Área

**Ruta:** `/selector`  
**Visible para:** SUPER_ADMIN, ADMIN_AREA (si maneja más de un área)  
**Layout:** Mobile-first, tarjetas de área en grid 2x2

Elementos:
- Saludo + nombre del usuario
- KPIs consolidados del día (contratos, gestiones, áreas activas) — solo SUPER_ADMIN
- Grid de tarjetas por área (una por área que tiene acceso)
  - Cada tarjeta: icono, nombre área, subtítulo con tipo de venta, contador de prospectos/casos
  - Color de acento por área (gold, blue, green, purple)
- Acceso rápido: Parametrización, Dashboard Multi-área, Cargar Lista

Al hacer click en un área → guarda `area_activa` en Pinia store → redirige al panel de esa área.

Para ASESOR con una sola área → nunca ve esta pantalla, va directo.

---

## PANTALLA: Panel del Día — Prenecesidad (mobile-first)

**Ruta:** `/prenecesidad/panel`  
**Visible para:** ASESOR, SUPERVISOR (ve todo el grupo), ADMIN_AREA

Elementos del header (fondo brown-deep):
- Saludo + fecha de hoy
- 3 contadores: Vencidas (rojo) · Hoy · Contratos del mes
- Barra de progreso de meta mensual con porcentaje

Lista de gestiones del día (llamadas a `GET /prospectos/panel-dia`):
- Sección "🔴 Urgentes" — gestiones vencidas de días anteriores
- Sección "📋 Hoy" — ordenadas por hora de gestión
- Cada item: nombre cliente, teléfono, hora, estado actual con color, producto

Cada item al tocarlo → ir a Ficha Cliente.

Botón flotante `+` → Nuevo Cliente.

Bottom navigation (5 tabs):
`Panel` · `Agenda` · `Clientes` · `Métricas` · `Config`

---

## PANTALLA: Ficha Cliente — Prenecesidad (mobile)

**Ruta:** `/prenecesidad/cliente/:id`  
**Datos:** GET `/prospectos/:id`

Header (fondo brown-deep):
- Nombre completo (grande, DM Serif Display)
- Teléfono + área badge "Prenecesidad"
- Estado actual del pipeline con color

4 botones de acción rápida:
- 📞 Llamar (abre teléfono nativo)
- 💬 WhatsApp (abre wa.me/57{telefono})
- ✍️ Registrar gestión
- 📅 Agendar

Sección "Datos del cliente":
- Teléfono alterno, dirección, barrio, producto de interés
- Punto de atención, asesor asignado, fuente, próxima gestión

Sección "Historial" (últimas 10 gestiones):
- Cada item: fecha, canal (icono), resultado, comentario
- Borde izquierdo de color según resultado (verde=positivo, rojo=negativo)
- Inmutable: no hay botón de editar

---

## PANTALLA: Registrar Gestión (modal/bottom sheet)

**Trigger:** Botón "Registrar" en Ficha Cliente  
**API:** POST `/gestiones`

Campos:
1. Canal: tabs `Llamada · WhatsApp · Presencial · Correo`
2. Resultado: grid de opciones (del catálogo `sv_cfg_resultados_gestion` del grupo)
   - Ej: No contesta · Ocupado · No interesado · Interesado · Contrato
3. Cambiar estado: selector (del pipeline del grupo) — solo si el resultado lo implica
4. Comentario: textarea obligatorio
5. Próxima gestión: fecha + hora (visible solo si resultado requiere reagendar)

Botón: "Guardar gestión"  
Al guardar → actualizar el card del prospecto en el Panel del Día.

---

## PANTALLA: Nuevo Cliente — Prenecesidad (modal)

**API:** POST `/personas` → POST `/prospectos`

Paso 1 — Búsqueda anti-duplicados:
- Campo teléfono → al salir del campo llama `GET /personas/buscar?telefono=...`
- Si existe: alerta "Ya existe un cliente con ese número" + opción de ver ficha existente
- Si no existe: continuar con el formulario

Formulario:
- Nombre + Apellido (obligatorios)
- Teléfono principal (ya validado) + teléfono alterno
- Dirección + Barrio
- Documento (tipo + número, opcionales)
- Producto(s) de interés (chips multi-selección del catálogo)
- Fuente de prospecto (selector)
- Punto de atención (selector)
- Nota inicial (textarea)

Botón: "Registrar Cliente"

---

## PANTALLA: Ficha Empresa — Empresariales (mobile)

**Ruta:** `/empresariales/empresa/:id`  
**API:** GET `/empresas/:id`

Header (fondo azul `#1A5C8A`):
- Icono empresa + razón social (grande)
- NIT + número de empleados + sector
- Estado actual del pipeline B2B

4 acciones: Llamar · WhatsApp · Registrar · Propuesta

Pipeline visual (scrollable horizontal):
- Círculos de estado (verde=completado, naranja=actual, gris=pendiente)
- Etiquetas: Prospecto → Presentación → Cotización → Negociación → Convenio

Sección "Datos de la empresa":
- NIT, sector, #empleados, teléfono, email corporativo, dirección
- Contacto principal: nombre, cargo, teléfono

Historial (igual que Prenecesidad, inmutable)

---

## PANTALLA: Nueva Empresa — Empresariales

**API:** GET `/empresas/buscar?nit=...` (anti-duplicados) → POST `/empresas` → POST `/prospectos`

Secciones:
1. Datos empresa: Razón Social, NIT, sector (chips), #empleados
2. Contacto principal: Nombre, Cargo, Teléfono, Correo corporativo
3. Interés comercial: Productos de interés (chips del catálogo PREV-EMP)
4. Nota inicial

Validación NIT al salir del campo.

---

## PANTALLA: Panel PAP + Registro Rápido (mobile)

**Panel** (ruta `/pap/panel`):
- Header verde con: zona asignada, nombre asesor
- 3 contadores: Visitados · Interesados · Afiliados
- Barra progreso meta semanal
- Botón grande "⚡ Registrar Visita Rápida"
- Lista "Últimas visitas" (scroll) con resultado y estado

**Registro Rápido** (modal full-screen):
- Nombre (texto)
- Teléfono (tel input)
- Dirección visitada (texto)
- Resultado: 4 opciones grandes con icono (grid 2x2)
  - ✅ Afiliado hoy · 💬 Interesado · 🔁 Volver · 🚫 No interesado
- Plan de interés: chips (solo si Interesado o Afiliado)
- Botón: "⚡ Guardar y Siguiente Casa"
- Botón secundario: "Sin respuesta (nadie en casa)"

Todo en < 5 taps, optimizado para velocidad.

---

## PANTALLA: Panel de Casos SVC (mobile)

**Ruta:** `/svc/casos`

Header morado con: nombre agente, contadores (Abiertos · Vencidos · Resueltos hoy)

Filtros: tabs horizontales (Todos · Urgentes · PQRS · Solicitudes)

Lista de casos:
- Borde izquierdo de color según prioridad (rojo=urgente, naranja=media, azul=normal)
- Badge tipo caso (Queja / Solicitud / Información)
- Número de caso + referencia SAP
- Nombre del cliente + descripción corta
- Fecha límite (resaltada si vencida)

Botón: "+ Nuevo Caso"

---

## PANTALLA: Admin / Parametrización (desktop)

**Ruta:** `/admin`  
**Sidebar:** Navegación entre módulos de configuración

Vista principal "Áreas de Negocio":
- Grid 2x2 de tarjetas de área
- Cada tarjeta: icono, nombre, código, stats (grupos/productos/estados), botones Editar / Catálogo / Pipeline
- Botón: "+ Nueva Área"

Vista "Pipeline editable" (inline en la misma pantalla):
- Visualización horizontal de estados encadenados
- Cada estado es un badge editeable
- Botón: "+ Agregar Estado"
- Drag & drop para reordenar (opcional, implementar después)

---

## PANTALLA: Dashboard Multi-Área Gerencial (desktop)

**Ruta:** `/gerencia`  
**Sidebar:** igual que Admin pero con filtros de fecha y área

KPIs en fila (4 tarjetas):
- Contratos/Convenios totales (con variación vs mes anterior)
- Gestiones totales del día
- Casos abiertos SVC (con vencidos resaltados)
- Valor vendido COP

Sección "Rendimiento por área":
- Barra horizontal por área (color del área) con valor actual vs meta
- Gestiones del día por área

Embudo consolidado:
- Barras proporcionales: Prospectos activos → Interesados → En proceso → Cerrados

Tabla comparativa de asesores:
- Nombre · Área (badge) · Gestiones · Interesados · Contratos · % Meta

---

## Notas de implementación frontend

1. **Mobile first**: Todas las vistas de asesor se diseñan primero para mobile (375px) y luego se adaptan a desktop.
2. **Datos del catálogo en Pinia**: Al login, llamar `/config/bootstrap?area_id={id}` y guardar en el store. No llamar en cada pantalla.
3. **Navegación bottom**: Solo en pantallas de asesor (mobile). En desktop usar sidebar.
4. **Loading states**: Usar skeleton loaders en cards y listas, no spinners genéricos.
5. **Optimismo UI**: Al registrar una gestión, actualizar el UI localmente antes de que responda la API. Revertir si hay error.
6. **PWA**: Configurar Vite PWA plugin para que la app sea instalable en Android (asesores de campo).
