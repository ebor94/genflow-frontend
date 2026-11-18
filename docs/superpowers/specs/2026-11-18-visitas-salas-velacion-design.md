# Visitas de Prenecesidad en salas de velación — diseño

**Fecha:** 2026-11-18
**Repositorios:** `mantix-backend` (módulo `sv`) y `crm-frontend` (GenFlow)
**Estado:** aprobado por el usuario en brainstorming; pendiente de plan

## 1. Objetivo

Los asesores de Prenecesidad visitan las salas de velación donde hay un homenaje en curso y hablan con el contratante. GenFlow debe mostrarles esos homenajes, convertir al contratante en cliente de Prenecesidad y registrar cada visita con el mismo proceso de telemercadeo: resultados, cambio de estado, próxima gestión y comentario. El canal de esas gestiones es "visita en sala".

## 2. Decisiones del usuario

| Tema | Decisión |
|---|---|
| Dónde ve el asesor los homenajes | En GenFlow, en una pantalla nueva de Prenecesidad. El asesor no necesita acceso a Homenajes360. |
| Reparto entre asesores | Cualquiera puede visitar. El cliente queda con quien lo creó primero; los demás solo agregan gestiones. |
| Fuente del cliente | Nueva: `SALA_VELACION`, "Sala de velación". |
| Enfoque | B: la ficha `prenec/cliente/:id` la abre solo el dueño. Quien visita el cliente de otro asesor registra la visita desde la pantalla de salas, con un resumen del cliente. |

## 3. Contexto actual

- Homenajes360 y GenFlow comparten la base de datos (`DB_NAME`). El módulo `sv` puede leer las tablas de Homenajes360: `homenajes_sala`, `asistencias`, `salas_velacion` y `sedes`.
- Un homenaje en sala está en curso mientras su `estado` no sea `FINALIZADO`, es decir, mientras sea `ABIERTO` o `SALIDA_REGISTRADA`. Es el mismo criterio de `/home360/salas-velacion/`.
- El contratante es la persona de contacto de la asistencia (`asistencias.nombre_contacto` y `asistencias.telefono_contacto`). Homenajes360 lo muestra así en `HomenajeSalaDetalleView`.
- Hoy `gest_canal` acepta `llamada`, `presencial` y `correo`. La columna es `VARCHAR(20)`, así que la restricción está solo en la validación Joi.
- Cada asesor solo ve sus propios clientes (`prospectos.controller.getOne` con `req.scope`). Este diseño mantiene esa regla.
- `POST /sv/gestiones` y `GET /sv/gestiones` no verifican el alcance. Eso se corrige en otra sesión (rama de `fix/permisos-gestiones`). Este diseño no usa esos endpoints para las visitas.

## 4. Datos — migración `023_salas_velacion.sql`

La migración es idempotente, como la 022: comprueba `information_schema` antes de cada `ALTER` y usa `INSERT IGNORE` para el catálogo.

1. **Fuente nueva.** Fila en `sv_cfg_fuentes_prospecto` con `fuente_area_id` del área `PRENEC` (buscada por código), `fuente_codigo = 'SALA_VELACION'`, `fuente_nombre = 'Sala de velación'`, `fuente_es_masiva = 0` y `fuente_orden = 7`.
2. **Columna nueva en `sv_crm_gestiones`.** `gest_homenaje_sala_id INT NULL`, con el índice `idx_gest_homenaje (gest_homenaje_sala_id)`. No lleva clave foránea hacia `homenajes_sala`, para no acoplar los dos módulos.
3. **Tabla nueva `sv_crm_salas_contratantes`.** Dice qué cliente de Prenecesidad es el contratante de cada homenaje:

   | Columna | Tipo | Nota |
   |---|---|---|
   | `sc_id` | INT AUTO_INCREMENT PK | |
   | `sc_homenaje_sala_id` | INT NOT NULL | `UNIQUE uq_sc_homenaje`; sin clave foránea |
   | `sc_prosp_id` | INT NOT NULL | clave foránea a `sv_crm_prospectos(prosp_id)` |
   | `sc_usr_id` | INT NOT NULL | clave foránea a `sv_org_usuarios(usr_id)`; quien hizo la vinculación |
   | `sc_created_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |

Modelos Sequelize: `SvGestion` incorpora `gest_homenaje_sala_id` y se crea `SvSalaContratante`. El canal `visita_sala` no requiere cambio en la base.

## 5. Backend (`mantix-backend/src/sv`)

### 5.1 Lectura de Homenajes360

Un repositorio de solo lectura, `services/homenajesSala.repo.js`, consulta con SQL directo las tablas de Homenajes360. Devuelve, por homenaje en curso:

- `id`, `estado` y `created_at` del homenaje
- `sala_nombre` y `sede_nombre`
- `nombre_ser_querido`, `contrato` y `asistencia_codigo`
- `contratante_nombre` y `contratante_telefono`

El módulo `sv` nunca escribe en esas tablas.

### 5.2 Endpoints

Se montan como `router.use('/salas', svAuth, svAreaGuard, require('./salas.routes'))`. Todos los handlers capturan sus errores y llaman a `next(e)`.

| Método y ruta | Quién puede | Qué hace |
|---|---|---|
| `GET /sv/salas/homenajes` | Usuarios con acceso al área PRENEC | Lista los homenajes en curso, del más reciente al más antiguo. |
| `GET /sv/salas/homenajes/:id` | Igual | Devuelve un homenaje con la misma forma que la lista. 404 si no existe. |
| `POST /sv/salas/homenajes/:id/atender` | Solo `ASESOR` con acceso a PRENEC | Vincula al contratante con un cliente de Prenecesidad, o devuelve el vínculo que ya existe. |
| `POST /sv/salas/homenajes/:id/visitas` | Solo `ASESOR` con acceso a PRENEC | Registra una gestión de visita en sala sobre el cliente vinculado. |

"Acceso al área PRENEC" se calcula con `areaIdsAccesibles(req.user)`, que devuelve `null` para SUPER_ADMIN, o con la lista de áreas que incluya la de PRENEC. Los catálogos (área PRENEC, grupo `TELEMERCADEO`, fuente `SALA_VELACION` y estado inicial) se buscan por código, nunca por un número fijo.

**Forma de cada homenaje en la respuesta:**

```json
{
  "id": 123,
  "estado": "ABIERTO",
  "registrado_at": "2026-11-18T09:15:00",
  "sala_nombre": "Sala 3",
  "sede_nombre": "Sede Norte",
  "nombre_ser_querido": "…",
  "contrato": "…",
  "contratante_nombre": "…",
  "contratante_telefono": "…",
  "cliente": null,
  "visitas": [],
  "puede_atender": true
}
```

- `cliente` es `null` si el homenaje no tiene vínculo. Si lo tiene, es `{ prosp_id, es_mio, duenio_nombre, estado_nombre }`.
- `visitas` es la lista de gestiones con `gest_homenaje_sala_id` igual al homenaje. Cada una trae `asesor_nombre` y `fecha_hora`, ordenadas de la más reciente a la más antigua.
- `puede_atender` es `true` solo para un `ASESOR` con acceso a PRENEC.

### 5.3 Atender (`POST …/atender`)

Cuerpo opcional: `{ nombre, telefono }`. Solo se usa cuando la asistencia no trae un nombre o un teléfono válido.

1. El homenaje debe existir (si no, 404) y estar en curso (si no, 409 `HOMENAJE_CERRADO`).
2. Si ya hay una fila en `sv_crm_salas_contratantes` para el homenaje, se devuelve ese vínculo (paso 7) sin crear nada. El endpoint es idempotente: la pantalla lo llama también para abrir la ventana de visita.
3. **Teléfono.** Se toma `asistencias.telefono_contacto` y se parte por `/`, `,`, `;`, `|` o ` - `. Cada parte se normaliza con `sv/utils/telefono`, y gana la primera que `esValido` acepte. Si ninguna sirve, se usa `telefono` del cuerpo. Si tampoco es válido, responde 422 `TELEFONO_REQUERIDO`.
4. **Nombre.** Se toma `asistencias.nombre_contacto` y, si viene vacío, `nombre` del cuerpo. Si los dos faltan, responde 422 `NOMBRE_REQUERIDO`. El nombre completo va a `persona_nombre` con mayúscula inicial en cada palabra; `persona_apellido` queda vacío.
5. En una transacción:
   1. **Persona.** Se busca por teléfono normalizado. Si existe, se reutiliza sin cambiar sus datos; si no, se crea. Si `personas.service` lanza `DUPLICATE_PHONE` por una creación simultánea, se reutiliza la persona que trae el error.
   2. **Prospecto.** Si la persona tiene un prospecto activo de PRENEC (`prosp_activo = 1`), de cualquier asesor, se usa el más reciente. Si no, se crea uno con:
      - el asesor que atiende
      - área PRENEC y grupo `TELEMERCADEO`
      - fuente `SALA_VELACION`
      - el primer estado activo del grupo por `estado_orden`
   3. **Vínculo.** Se inserta la fila en `sv_crm_salas_contratantes`.
6. Si el `INSERT` del vínculo choca con `uq_sc_homenaje` (otro asesor atendió al mismo tiempo), se revierte la transacción y se devuelve el vínculo que ganó. Un prospecto creado en la transacción revertida no queda en la base.
7. **Respuesta:** `{ prosp_id, es_mio, creado, resumen }`. `creado` indica si esta llamada creó el prospecto. `resumen` es:

   ```json
   {
     "duenio_nombre": "…",
     "estado_nombre": "…",
     "prox_gestion_fecha": "2026-11-20",
     "ultima_gestion": { "fecha_hora": "…", "canal": "llamada", "resultado_nombre": "…" }
   }
   ```

   `ultima_gestion` puede ser `null`. El resumen no incluye comentarios de gestiones.

### 5.4 Visitas (`POST …/visitas`)

Cuerpo, validado con Joi plano como lo espera `sv/middleware/validate`:

| Campo | Regla |
|---|---|
| `gest_resultado_id` | Entero, obligatorio. Debe ser un resultado activo del grupo `TELEMERCADEO`. |
| `gest_estado_nuevo_id` | Entero o null. Si viene, debe ser un estado activo del grupo `TELEMERCADEO`. |
| `gest_comentario` | Texto o null. |
| `gest_prox_fecha` | Fecha ISO o null. Obligatoria si el resultado tiene `resultado_requiere_fecha = 1`. |
| `gest_prox_hora` | `HH:MM` o `HH:MM:SS`, null o vacía. |

No se aceptan `gest_prosp_id`, `gest_asesor_id` ni `gest_canal`.

1. El homenaje debe existir (si no, 404), estar en curso (si no, 409 `HOMENAJE_CERRADO`) y tener vínculo (si no, 409 `SIN_ATENDER`).
2. El prospecto vinculado debe estar activo (si no, 409 `CLIENTE_INACTIVO`).
3. Si el resultado o el estado no son del grupo, responde 422 `RESULTADO_INVALIDO` o `ESTADO_INVALIDO`. Si falta la fecha obligatoria, 422 `PROX_FECHA_REQUERIDA`.
4. La gestión se crea con `gestiones.service.crear`, para conservar las reglas de siempre (actualizar el estado y la próxima gestión del prospecto y ajustar la fecha en estados finales). Se le pasa:
   - `gest_prosp_id`: el del vínculo
   - `gest_canal`: `'visita_sala'`
   - `gest_homenaje_sala_id`: el homenaje
   - el asesor: siempre `req.user.usr_id`

   `gestiones.service.crear` se amplía para guardar `gest_homenaje_sala_id`. Ese archivo también lo toca la rama de `fix/permisos-gestiones`, así que se revisa al integrar.
5. **Respuesta:** 201 con la gestión creada.

### 5.5 Registro en el log

Se anotan líneas `SALA_ATENDER` y `SALA_VISITA` con `homenaje_sala_id`, `prosp_id`, `usr_id` y, en `SALA_ATENDER`, si se creó el prospecto. Nunca se escribe el nombre ni el teléfono del contratante.

## 6. GenFlow (`crm-frontend/src`)

### 6.1 Navegación

- Ruta nueva `/prenec/salas`, `name: 'prenec-salas'`, vista `views/prenecesidad/SalasVelacion.vue`, con la misma `meta` de área que las demás rutas de Prenecesidad.
- Entrada "Salas" con el ícono 🏛️ en el menú de Prenecesidad: `BottomNav.vue`, `AppSidebar.vue` y `AppHeader.vue`.

### 6.2 API

`api/salasApi.js` con `listar()`, `obtener(id)`, `atender(id, { nombre, telefono })` y `registrarVisita(id, payload)`.

### 6.3 Pantalla "Salas de velación"

Se diseña primero para celular. Muestra una tarjeta por homenaje en curso, en el orden que devuelve la API.

Cada tarjeta tiene:
- La sala y la sede, el ser querido, el contrato y hace cuánto se registró el homenaje.
- El contratante y su teléfono.
- Una etiqueta con la situación del contratante:
  - "Sin atender"
  - "Tu cliente · <estado>"
  - "Cliente de <dueño> · <estado>"
- Las visitas registradas: "<asesor> · <hoy|fecha> <hora>".
- Si `puede_atender` es `true`, un botón según el caso:

| Situación | Botón | Acción |
|---|---|---|
| `cliente === null` | Atender contratante | Abre `AtenderContratanteModal`. |
| `cliente.es_mio` | Abrir ficha | Navega a `prenec-ficha` con `query.homenaje = id`. |
| Cliente de otro asesor | Registrar visita | Llama a `atender` para obtener el `resumen` y abre `RegistrarGestion` en modo sala con ese resumen. |

La lista se carga al entrar y tiene un botón "Recargar". Sin homenajes en curso muestra "No hay homenajes en curso en las salas".

### 6.4 `AtenderContratanteModal`

- Muestra el nombre y el teléfono del contratante que trae la asistencia.
- Muestra los campos para escribir el nombre y el teléfono cuando la tarjeta no los trae, o cuando `atender` responde 422 `NOMBRE_REQUERIDO` o `TELEFONO_REQUERIDO`. Los dos son obligatorios. La validez del teléfono la decide el backend.
- Al confirmar llama a `salasApi.atender`:
  - Con `es_mio`, navega a la ficha con `?homenaje=id`.
  - Si no es suyo, abre `RegistrarGestion` en modo sala con el `resumen`.
- Si responde 409 `HOMENAJE_CERRADO`, muestra el aviso y recarga la lista.

### 6.5 `RegistrarGestion` en modo sala

Props nuevas, opcionales: `homenajeSalaId` y `resumenCliente`.

Con `homenajeSalaId`:
- El canal queda fijo en "🏛️ Visita en sala" y no se muestra el selector.
- Se ocultan los campos exclusivos de la llamada, como la duración.
- Al guardar se llama a `salasApi.registrarVisita(homenajeSalaId, payload)` en vez de `gestiones.registrar`.

Con `resumenCliente` (el cliente es de otro asesor):
- Arriba se muestra el resumen: dueño, estado, próxima gestión y última gestión (fecha, canal y resultado).
- Se oculta la edición de productos de interés.

Sin `homenajeSalaId`, el componente funciona igual que hoy. El selector de canal normal sigue ofreciendo solo llamada, presencial y correo.

### 6.6 Ficha con `?homenaje=<id>`

`FichaCliente.vue` lee `route.query.homenaje`:
- Si viene, llama a `salasApi.obtener(id)`.
- Si el homenaje está en curso y su `cliente.prosp_id` es el prospecto de la ficha, muestra el aviso "Visita en sala — <sala>, <sede> · homenaje de <ser querido>". El botón "Registrar gestión" de la ficha abre entonces el formulario en modo sala (`homenajeSalaId`, sin `resumenCliente`). El formulario no se abre solo.
- En cualquier otro caso ignora el parámetro y la ficha funciona igual que hoy.

### 6.7 Historial

`HistorialItem.vue` y `HistorialClienteCompleto.vue` muestran 🏛️ y el texto "Visita en sala" para `gest_canal === 'visita_sala'`.

## 7. Errores y casos de borde

| Caso | Respuesta | Comportamiento en GenFlow |
|---|---|---|
| Homenaje finalizado al momento de actuar | 409 `HOMENAJE_CERRADO` | Aviso y recarga de la lista. |
| Teléfono de la asistencia vacío o inválido, sin teléfono en el cuerpo | 422 `TELEFONO_REQUERIDO` | La ventana pide el teléfono. |
| Sin nombre de contacto ni nombre en el cuerpo | 422 `NOMBRE_REQUERIDO` | La ventana pide el nombre. |
| Dos asesores atienden al mismo tiempo | Gana el primer vínculo; el segundo lo recibe | El segundo pasa a modo visita. |
| Visita sobre un homenaje sin atender | 409 `SIN_ATENDER` | Recarga la lista. |
| Cliente vinculado inactivo | 409 `CLIENTE_INACTIVO` | Aviso: "El cliente está inactivo; pide al supervisor reactivarlo". |
| Resultado o estado de otro grupo | 422 | Mensaje del backend. |
| Usuario que no es `ASESOR` intenta atender o visitar | 403 | La pantalla no muestra los botones. |
| Usuario sin acceso a PRENEC | 403 en los cuatro endpoints | La ruta no aparece en su menú. |
| Homenaje inexistente | 404 | Aviso y recarga. |

## 8. Métricas

- Cada visita cuenta para quien la registra (`gest_asesor_id`).
- La cartera y el cliente siguen siendo del dueño (`prosp_asesor_id`).
- Un visitante puede cambiar el estado o la próxima gestión del cliente de otro asesor; el cambio queda en el historial con su nombre.

## 9. Pruebas

**Backend.** Jest solo con `jest.mock`, nunca `sequelize.sync`, porque la única base es la de producción compartida.

- `homenajesSala.repo`: arma la consulta de los homenajes en curso (estados distintos de `FINALIZADO`).
- Servicio de salas:
  - lista con `cliente` y `visitas` bien armados y con `puede_atender` según el rol
  - `atender` con vínculo existente
  - teléfono de la asistencia con varios números
  - teléfono escrito a mano
  - 422 por teléfono o nombre faltante
  - cliente de PRENEC de otro asesor
  - cliente nuevo con su fuente, grupo y estado inicial
  - choque con `uq_sc_homenaje`
  - persona creada al mismo tiempo (`DUPLICATE_PHONE`)
- Visitas:
  - homenaje cerrado
  - homenaje sin atender
  - cliente inactivo
  - resultado o estado de otro grupo
  - fecha obligatoria
  - gestión creada con `visita_sala`, el homenaje y `req.user.usr_id`
- Rutas:
  - asesor de PRENEC permitido
  - supervisor con 403 en los `POST` y con acceso de lectura
  - usuario de otra área con 403
  - error del servicio que termina en `next(e)`
- Migración 023: revisión manual de la idempotencia (dos ejecuciones seguidas sin error).

**GenFlow.** Vitest.

- `SalasVelacion`:
  - botón correcto en cada uno de los tres casos
  - sin botones cuando `puede_atender` es `false`
  - estado vacío
- `AtenderContratanteModal`:
  - pide el teléfono cuando la tarjeta no lo trae y cuando `atender` responde 422
  - navega a la ficha cuando el cliente es suyo
  - abre la visita cuando es de otro
- `RegistrarGestion` en modo sala:
  - canal fijo
  - envío a `salasApi.registrarVisita`
  - productos ocultos con `resumenCliente`
  - comportamiento normal sin props
- `FichaCliente`:
  - aviso y modo sala con `?homenaje` válido
  - ignora el parámetro si el prospecto no coincide
- `HistorialItem`: ícono y texto de `visita_sala`.

## 10. Despliegue

1. Verificar que el número 023 siga libre en `origin/main` de `mantix-backend` antes de crear la migración. El 2026-11-18 lo estaba.
2. Ejecutar la migración 023 en producción. Es inofensiva para el código actual: agrega una fuente, una columna que puede quedar vacía y una tabla.
3. Desplegar el backend (`deploy-mantix`).
4. Publicar GenFlow (`npm run build` y `rsync` a `/Volumes/AppServ/www/genflow/`). Hay que cuidar el `.htaccess` del servidor y verificar la paridad de `dist/assets`.
5. Smoke:
   - un asesor de prueba atiende un homenaje en curso
   - registra una visita
   - otro asesor registra una segunda visita y ve el resumen
   - el historial del cliente muestra 🏛️

## 11. Fuera de alcance

- Cambios en Homenajes360: no se escribe en sus tablas ni se toca su pantalla.
- Avisar al dueño cuando otro asesor visita a su cliente.
- Actualización de la lista en tiempo real.
- Asignación de homenajes a asesores por el supervisor.
- Reportes específicos de salas. La fuente `SALA_VELACION` ya permite filtrar en los reportes que existen.
- El hueco de permisos de `/sv/gestiones`, que va en la sesión de `fix/permisos-gestiones`.
