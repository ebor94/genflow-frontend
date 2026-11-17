# Diseño — Login único contra el directorio activo (GenFlow)

Fecha: 2026-11-17
Estado: aprobado por secciones en brainstorming, pendiente de revisión del spec escrito.

## 1. Contexto y objetivo

Hoy conviven varios métodos de acceso en el ecosistema:

| App | Cómo valida hoy |
|---|---|
| GenFlow (`crm-frontend`) | `POST /api/identidad/login` — email + clave bcrypt en `org_identidad`. Queda además `POST /api/sv/auth/login` con clave bcrypt en `sv_org_usuarios`. |
| Portal Serfunorte (`portal-frontend`) | Mismo `POST /api/identidad/login`, con flujo `must_reset` → `cambiar-password`. |
| Mantix principal | `/api/auth/login` — AD con respaldo a clave local. |
| H360, Portería, Masajes | AD con `src/h360/services/ldap.service.js`. |
| R44, Tracking (PIN), formularios públicos | Métodos propios. |

**Objetivo:** que el SSO de identidad (`identidad/login`), que es la puerta de GenFlow y del Portal, valide **únicamente** contra el directorio activo, y retirar todas las claves locales de GenFlow. Todos los usuarios de GenFlow tienen cuenta en el AD.

**Hallazgo que este diseño corrige:** `sv/usuarios.controller.create` guarda una clave en `sv_org_usuarios` pero no crea `org_identidad` ni llena `usr_id_identidad`. Los usuarios creados después de correr `poblar-identidad.js` no pueden entrar por `identidad/login` (causa probable del 401 de psantafe).

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance | Primer sub-proyecto: GenFlow y lo que comparte su login (Portal). Las demás apps se migran después, cada una con su spec. |
| Dato de ingreso | Usuario de red (`sAMAccountName`) **o** correo. |
| Papel del AD | Solo autentica. El acceso a GenFlow lo da tener un `sv_org_usuarios` activo; rol, áreas, grupos y permisos de afiliaciones siguen en la base de datos. |
| Claves locales | Corte total. Sin cuenta de emergencia: si el AD cae, no hay acceso hasta que vuelva. |
| Mecanismo | Validación LDAP en `identidad.service` reutilizando `h360/services/ldap.service.js` (enfoque A). Se descartan federación OIDC/ADFS y delegar en el login de Mantix principal. |

## 3. Modelo de datos

Migración `mantix-backend/src/sv/migrations/022_identidad_ad.sql`, idempotente (guardas con `information_schema`):

- `org_identidad.ad_usuario VARCHAR(64) NULL` + índice `UNIQUE uq_identidad_ad_usuario (ad_usuario)`. Se guarda en minúsculas.
- `org_identidad.password_hash` pasa a `NULL`.
- `sv_org_usuarios.usr_password_hash` pasa a `NULL`.

Los hashes existentes **no se borran** en este sub-proyecto: el código deja de leerlos y escribirlos, y quedan solo como red de reversión. Se limpian en un paso posterior (fuera de alcance, §11).

Modelo Sequelize `identity/models/Identidad.js`: agregar `ad_usuario` y `password_hash.allowNull = true`. Modelo `sv/models/Usuario.js`: `usr_password_hash.allowNull = true`.

## 4. Flujo de login

`identidad.service.login({ usuario, email, password, ua, ip })`. El body acepta `usuario` y, por compatibilidad, `email` (el Portal y el frontend viejo envían `email`). Se usa `usuario ?? email`.

1. **Resolver la cuenta del AD (`sam`).**
   - Si la entrada contiene `@`: buscar `org_identidad` por `email_norm`.
     - Si existe y tiene `ad_usuario` → `sam = ad_usuario`.
     - Si existe sin `ad_usuario` → error `NO_VINCULADO` (401): *"Inicia sesión con tu usuario de red (el de Windows)."*
     - Si no existe → error `CREDENCIALES_INVALIDAS` (401) genérico.
   - Si no contiene `@`: `sam = entrada` (acepta `OLIVOS\usuario`; la normalización la hace `ldap.service`).
2. **Validar contra el AD:** `ldapService.validarCredenciales(sam, password)` → `{ usuario, nombre, email, memberOf }`.
3. **Encontrar la identidad** por `ad_usuario = lower(resultado.usuario)`.
   - **Vinculación automática:** si no hay, y `resultado.email` no está vacío y existe una identidad con `email_norm = lower(resultado.email)` y `ad_usuario IS NULL`, se le asigna `ad_usuario` en ese momento (log `AUTH_AD_VINCULADO_AUTO`).
   - Si tampoco → error `SIN_ACCESO` (403): *"Tu usuario de red no tiene acceso a GenFlow."*
4. Si `identidad.activo = 0` → `USER_INACTIVE` (403, como hoy).
5. Emitir `accessToken` / `refreshToken`, crear `OrgSesion`, actualizar `ultimo_login` — **idéntico a hoy**. La respuesta deja de incluir `must_reset`.

Regla: en el camino sin `@` se consulta el AD **antes** de revelar si existe la identidad, para no permitir enumerar usuarios de GenFlow.

`refresh`, `logout`, `me`, `aplicaciones` no cambian. `/sv/auth/me` sigue resolviendo el usuario de ventas por `usr_id_identidad`.

### 4.1 Respuestas de error

| Código interno | HTTP | Mensaje al usuario |
|---|---|---|
| `CREDENCIALES_INVALIDAS` (clave/usuario) | 401 | *"Usuario o contraseña incorrectos"* |
| `CREDENCIALES_INVALIDAS` con mensaje específico de `ldap.service` (vencida, bloqueada, deshabilitada, horario, cambio obligatorio) | 401 | El mensaje público que ya trae `ldap.service` |
| `NO_VINCULADO` | 401 | *"Inicia sesión con tu usuario de red (el de Windows)."* |
| `AD_NO_DISPONIBLE` | 503 | *"No hay conexión con el directorio activo, intenta en unos minutos."* |
| `SIN_ACCESO` | 403 | *"Tu usuario de red no tiene acceso a GenFlow."* |
| `USER_INACTIVE` | 403 | *"Usuario inactivo"* (como hoy) |
| Límite de intentos | 429 | *"Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo."* |

### 4.2 Límite de intentos (protege la cuenta de Windows)

Cada fallo en GenFlow suma al umbral de bloqueo del AD. En `identity/routes/index.js`, `POST /login` lleva dos `express-rate-limit` con el patrón de `porteria/routes/auth.routes.js` (`skipSuccessfulRequests`, solo cuentan respuestas 401):

- Por usuario: **5 fallos / 15 min**, clave = entrada normalizada (minúsculas, sin dominio `@…` ni `DOMINIO\`), independiente de la IP.
- Por IP: **100 fallos / 15 min**.

## 5. Vinculación de usuarios existentes

Script `mantix-backend/src/identity/scripts/vincular-ad.js`, patrón de `masajes/scripts/vincularPorAd.js`. Por defecto **simula**; con `--aplicar` escribe.

1. **Crear identidades faltantes:** para cada `sv_org_usuarios` activo con `usr_id_identidad IS NULL` y `usr_email` no vacío → buscar `org_identidad` por `email_norm`; si no existe, crearla (`email_norm`, nombre, apellido, teléfono, `password_hash = NULL`); llenar `usr_id_identidad`.
2. **Emparejar** cada `org_identidad` activa con `ad_usuario IS NULL` contra `ldapService.listarUsuariosDirectorio()` (`{ usuario, nombre, mail }`):
   - **Seguras:** el `mail` del AD coincide exactamente (case-insensitive) con `email_norm`, y es un solo candidato. Se aplican con `--aplicar`.
   - **Revisar:** solo coincide el prefijo del correo con el `usuario` del AD, o hay más de un candidato. No se aplican; se listan.
   - **Sin coincidencia:** se listan.
3. Reporte final con los tres grupos y conteos. Los casos de "revisar" y "sin coincidencia" se resuelven desde Gestión de usuarios (§6) o con SQL manual.

La lógica de emparejamiento va en una función pura `proponerVinculos(identidades, directorio)` (testeable), separada de la E/S del script.

Alcance: todas las identidades activas (incluye usuarios de Afiliaciones, que entran por el mismo login).

## 6. Alta y edición de usuarios en GenFlow

### 6.1 Backend

- `GET /api/sv/usuarios/directorio?q=` — gate `admin` (`SUPER_ADMIN`, `GERENTE_GENERAL`, `ADMIN_AREA`, los mismos que crean usuarios).
  - `q` mínimo 3 caracteres (422 si no); busca en `usuario`, `nombre` y `mail` sin distinguir mayúsculas ni tildes; máximo 20 resultados `{ usuario, nombre, mail }`.
  - Fuente: `ldapService.listarUsuariosDirectorio()` con caché en memoria de 10 minutos (módulo `sv/services/directorioAd.service.js`). No se modifica `ldap.service`.
  - AD caído → 503.
- `POST /api/sv/usuarios` (crear): el campo `usr_password` se elimina del schema Joi y se reemplaza por `ad_usuario` **requerido**.
  1. `ldapService.buscarUsuarioPorSam(ad_usuario)`; si `null` → 422 *"El usuario de red no existe en el directorio"*.
  2. Si otra identidad ya tiene ese `ad_usuario` → 409 indicando el correo de esa identidad.
  3. Buscar identidad por `email_norm = usr_email`; si existe, asignarle `ad_usuario`; si no, crearla con `ad_usuario` y `password_hash = NULL`.
  4. Crear `sv_org_usuarios` con `usr_id_identidad` y sin clave.
- `PUT /api/sv/usuarios/:id` (editar): acepta `ad_usuario` opcional con las mismas validaciones (existencia en AD, 409 si está tomado). Si el usuario no tiene identidad, se crea como en el alta.
- `GET /api/sv/usuarios`, `GET /api/sv/usuarios/:id` y `GET /api/sv/auth/me`: incluyen `ad_usuario` (vía la identidad) para mostrarlo.

### 6.2 Frontend (`crm-frontend/src/views/admin/GestionUsuarios.vue`)

- El campo *Contraseña* se reemplaza por **Usuario de red**: buscador con debounce sobre `usuariosApi.directorio(q)`, que muestra *nombre · usuario · correo*. Al elegir, rellena nombre, apellido y correo si están vacíos.
- En edición se muestra el usuario de red actual y se puede cambiar.
- Se quita el botón de resetear clave.

## 7. Lo que se retira

### 7.1 Backend

| Endpoint / código | Acción |
|---|---|
| `POST /api/identidad/cambiar-password` y `identidad.service.cambiarPassword` | Eliminar |
| Lectura de `password_hash` y campo `must_reset` en la respuesta de `identidad.login` | Eliminar |
| `POST /api/sv/auth/login`, `POST /api/sv/auth/refresh`, `POST /api/sv/auth/logout` y su controller | Eliminar |
| `PATCH /api/sv/auth/me/password` | Eliminar |
| `POST /api/sv/usuarios/:id/reset-password` y `resetPassword` | Eliminar |
| `svAuth`: rama que acepta el JWT emitido por `sv/auth/login` | Eliminar. El plan verifica primero que ningún otro sistema (n8n, scripts, otras apps) emita o consuma ese token; si aparece un consumidor, la rama se conserva y se registra como pendiente en §11, sin bloquear el resto. |

### 7.2 Frontend GenFlow (`crm-frontend`)

- `views/auth/Login.vue`: etiqueta *"Usuario de red o correo"*, placeholder `psantafe`, `autocomplete="username"`, ayuda *"Usa el mismo usuario y clave de Windows"*. Muestra el mensaje del backend según §4.1.
- `stores/useAuthStore.js` y `api/authApi.js`: `login` envía `{ usuario, password }`; se elimina `changePassword`.
- `views/perfil/MiPerfil.vue`: se quita *Cambiar contraseña*; se muestra *Usuario de red: …* (solo lectura) con la nota *"La clave se cambia en Windows o con TI."* Requiere que `/sv/auth/me` incluya `ad_usuario`.
- `api/usuariosApi.js`: se elimina `resetPassword`, se agrega `directorio(q)`.
- `src/modules/afiliacion/views/LoginView.vue` y `src/modules/afiliacion/api/authApi.js`: se eliminan si el plan confirma que no tienen ruta ni importadores.

### 7.3 Portal Serfunorte (`portal-frontend`)

Comparte `identidad/login`, así que pasa al AD con el corte. Cambios mínimos:

- `views/Login.vue`: misma etiqueta, placeholder y ayuda que GenFlow; envía `{ usuario, password }`; se quita la rama `if (r.must_reset)`.
- `views/ResetPassword.vue`, su ruta y `identidadApi.cambiarPassword`: se eliminan.

Mientras el Portal no se redespliegue, sigue funcionando: envía `{ email, password }` y el backend lo acepta (§4).

### 7.4 No se toca

Mantix principal, H360, Portería, Masajes, R44, Tracking (PIN), formularios públicos (Veolia, corregir afiliación, consulta por documento, registro a eventos), `ldap.service.js`.

## 8. Observabilidad

Logs estructurados `console.log(JSON.stringify({ tag, ... }))`, nunca con la clave. `ad_usuario` se sanitiza con la regla de `ldap.service` (`/^[a-z0-9._-]{1,64}$/i`, si no `[formato no válido]`).

| Tag | Campos |
|---|---|
| `AUTH_AD_OK` | ad_usuario, id_identidad, ms |
| `AUTH_AD_FAIL` | ad_usuario, codigo |
| `AUTH_AD_UNAVAILABLE` | detalle (máx. 200 caracteres) |
| `AUTH_AD_SIN_ACCESO` | ad_usuario |
| `AUTH_AD_VINCULADO_AUTO` | ad_usuario, id_identidad |

## 9. Pruebas

### 9.1 Backend (Jest)

Con `ldap.service` y los modelos simulados mediante `jest.mock`, como los tests de servicio actuales. **Nunca** contra el AD real ni la base compartida (`sequelize.sync` está prohibido: la base de pruebas es la de producción compartida).

| Suite | Casos |
|---|---|
| `tests/identidadLoginAd.service.test.js` | login por usuario de red; por correo vinculado; correo sin vincular → `NO_VINCULADO`; correo inexistente → genérico; vinculación automática por `mail`; cuenta AD sin identidad → `SIN_ACCESO`; identidad inactiva; `AD_NO_DISPONIBLE`; mensaje específico de cuenta bloqueada; nunca se lee `password_hash`; acepta `email` en el body. |
| `tests/identidadLogin.routes.test.js` | mapeo código → HTTP; límite de 5 fallos por usuario → 429. |
| `tests/vincularAd.test.js` | `proponerVinculos`: seguras, revisar (prefijo, varios candidatos), sin coincidencia. |
| `tests/usuariosAd.service.test.js` | alta: usuario inexistente en AD (422), `ad_usuario` tomado (409), identidad existente por correo, identidad nueva; edición cambiando `ad_usuario`. |
| `tests/directorioAd.service.test.js` | mínimo 3 caracteres; filtro sin tildes ni mayúsculas; tope 20; caché de 10 min (una sola llamada al AD dentro de la ventana). |

### 9.2 Frontend (Vitest)

- `Login.vue`: envía `{ usuario, password }`; muestra el mensaje de 401, 403, 429 y 503.
- `GestionUsuarios.vue`: el buscador llama a `directorio` desde 3 caracteres y al elegir rellena los campos vacíos; ya no hay campo de clave.
- `MiPerfil.vue`: muestra el usuario de red y no tiene cambio de clave.

## 10. Despliegue y reversión

Orden obligatorio por el corte total:

1. **Migración 022** en producción.
2. **`git pull` en el servidor sin reiniciar pm2.** `node src/identity/scripts/vincular-ad.js` (simulación) → revisar reporte → `--aplicar`. Vincular los casos "revisar" con SQL. **Condición para seguir:** las cuentas de los administradores (`SUPER_ADMIN`, `ADMIN_AREA`) quedan vinculadas. La simulación sirve además como prueba de conexión al AD.
3. **`deploy-mantix`** (reinicio de pm2): aquí ocurre el corte.
4. **Build + rsync** de `crm-frontend`; build + despliegue de `portal-frontend`. El orden entre ambos no importa (el backend acepta `usuario` y `email`).
5. **Smoke:** login con usuario de red, con correo vinculado, con clave errada, con cuenta AD sin acceso a GenFlow; alta de un usuario desde Gestión de usuarios; Portal → selector de apps.

**Configuración:** `LDAP_URL`, `LDAP_BIND_USER`, `LDAP_BIND_PASS`, `LDAP_BASE_DN` ya existen en el `.env` de producción (H360 y Portería corren en el mismo proceso). No hay variables nuevas.

**Reversión:** revertir los commits del backend y reiniciar pm2; el login con clave local vuelve a funcionar porque los hashes no se borraron. La columna `ad_usuario` no estorba. Revertir el frontend si se quiere recuperar la pantalla de cambio de clave.

## 11. Fuera de alcance

- Borrar los hashes y las columnas de clave (`password_hash`, `usr_password_hash`) — paso posterior, cuando el login con AD lleve unas semanas estable.
- Migrar Mantix principal, H360, Portería, Masajes y demás apps al SSO de identidad — un spec por app.
- Mover `ldap.service.js` fuera de `h360/` a un módulo compartido.
- MFA / federación OIDC con ADFS o Entra ID.
- Exigir un grupo del AD para entrar a GenFlow o derivar roles desde grupos del AD.
