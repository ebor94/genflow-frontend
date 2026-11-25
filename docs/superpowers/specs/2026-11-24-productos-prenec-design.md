# Productos de Prenecesidad 2026 — diseño

**Fecha:** 2026-11-24 · **Repositorios:** `mantix-backend` (módulo `sv`) y `crm-frontend` (GenFlow)
**Estado:** opción A y pantalla aprobadas por el usuario. Las preguntas de §8 están respondidas (2026-11-24).

## 1. Objetivo

Cuando el asesor de Prenecesidad registra un prospecto o una gestión, elige el interés del cliente entre las categorías, los tipos y los productos de la "Lista de precios 2026". Si el cliente apenas pregunta, elige el tipo; si ya se sabe qué se le va a vender, elige el producto con su precio. El precio ofrecido queda guardado y no cambia cuando cambie la lista.

## 2. Decisiones del usuario

| Tema | Decisión |
|---|---|
| Qué se elige | El tipo ("Osarios, por definir") o el producto exacto |
| Modelo | A: tipos y productos en `sv_cfg_productos` |
| Precio | Se conserva el ofrecido |
| Alcance | Solo Prenecesidad. Las otras áreas siguen con su pantalla |

## 3. Datos

**Migración 025** (estructura, idempotente, inofensiva para el código anterior, va antes del deploy):

- `sv_cfg_productos.prod_tipo VARCHAR(50) NULL`
- `sv_cfg_productos.prod_es_generico TINYINT(1) NOT NULL DEFAULT 0`
- `sv_crm_prospectos_productos.pp_precio_ofrecido DECIMAL(12,2) NULL`

**Migración 026** (datos, cuando la líder responda): los 78 productos y 17 filas "por definir". Hay una fila "por definir" por cada tipo con más de un producto, más Exhumación de cenizarios, que no tiene ninguno. Un tipo con un solo producto no la necesita: se elige el producto. `PRE-OSR`, `PRE-CNZ`, `PRE-CLM` y `PRE-PRR` pasan a ser la fila de su tipo, así los clientes que las tienen no pierden el interés. Los demás productos de PRENEC se desactivan; ninguno se borra. Correrla otra vez devuelve los precios a los de 2026: es de una sola vez.

Sin la 026, ningún producto tiene tipo y GenFlow muestra la selección de hoy. El código se puede desplegar antes que los datos.

## 4. Backend

- `pp_precio_ofrecido` lo pone el servidor con el `prod_precio_base` vigente al elegir el producto. Nunca viene del cliente. En una fila "por definir" (aunque tenga precio escrito), y en un producto sin precio o en 0, queda NULL.
- `actualizarProductos` deja de borrar y recrear todo: conserva las filas que siguen (con su precio y su fecha), cambia en ellas el principal y la nota, borra las que se quitaron e inserta las nuevas. Un producto que se quita y se vuelve a elegir toma el precio de ese día.
- Los intereses anteriores a este cambio quedan con precio NULL.
- Los repetidos y los sin `prod_id` se ignoran.
- `PUT /prospectos/:id/productos` valida el cuerpo: uno mal formado responde 422 y no borra nada.
- Los catálogos aceptan `prod_tipo` y `prod_es_generico`.

Aplica a todas las áreas, porque el servicio es común; solo se muestra en productos con tipo, es decir, en Prenecesidad. Así la ficha no enseña los precios viejos de los productos sin tipo ni cambia la de las otras áreas, que usan la misma pantalla.

## 5. GenFlow

**Selector (`SelectorProductos.vue`)**: buscador sin tildes y por palabras; categorías que se abren; dentro, los tipos con su fila "por definir" y los productos con precio. Arriba, lo elegido: estrella para el principal y botón para quitar; debajo de cada uno, su nota (sectores, "no incluye traspaso", "con autorización del jefe").

- El primero que se elige es el principal. Si se quita el principal, pasa a serlo el primero que quede.
- Al elegir un producto se quita el "por definir" de su mismo tipo y categoría.
- Un interés cuyo producto está inactivo se ve con su nombre y se puede quitar.

**Dónde:** al crear el prospecto (`NuevoProspecto`) y al registrar la gestión (`RegistrarGestion`, también en salas para el dueño), solo si el área tiene productos con tipo. Si no, la selección actual. En `RegistrarGestion` se corrige además que un producto inactivo se mostraba como "#3".

**Ficha:** cada interés con tipo muestra "por definir" o el precio ofrecido. Si el vigente cambió, "ofrecido (vigente otro)". Los intereses sin tipo o sin precio guardado muestran solo el nombre.

**Administración → Productos:** campos Tipo y "Es por definir". `CrudCatalogo` admite `default` por campo: hoy todo interruptor nace encendido, y un producto nuevo nacería "por definir".

## 6. Errores y casos de borde

| Caso | Qué pasa |
|---|---|
| El catálogo no tiene tipos | Selección actual |
| La búsqueda no encuentra nada | "Ningún producto coincide. Prueba con otra palabra." |
| Producto sin precio o en 0 (nivel 1A) | Se elige; no muestra valor |
| Dos filas "por definir" en un mismo tipo | La primera es la del tipo; las demás se listan como productos |
| Cuerpo mal formado al guardar intereses | 422, sin borrar nada |
| Dos principales | 422, como hoy |
| El cliente envía un precio | Se ignora |

## 7. Pruebas

Backend (jest, solo mocks): modelos y validaciones; precio al crear; conservar, cambiar, quitar y agregar intereses; precio enviado por el cliente ignorado; repetidos. GenFlow (vitest): agrupar, buscar y alternar; selector; integración en los dos formularios con y sin tipos; ficha; administración. Migraciones: 025 y 026 corridas dos veces en MySQL 8.0 y 8.4 desechables, con intereses previos (hecho el 2026-11-24: sin cambios en otras áreas; los intereses conservan su fila, y solo pierden el precio los que quedan "por definir" o retirados). Los 77 precios se compararon uno a uno con el PDF por script, sin diferencias.

## 8. Preguntas para la líder (respondidas el 2026-11-24)

| Pregunta | Respuesta | Cómo queda |
|---|---|---|
| 1. Inhumaciones y Exhumaciones cruzadas en su tabla | Lo que diga el PDF | Como estaba |
| 2. Precio de "Inhumación nivel 1A para lote triple" | En cero | `PRE-INL-03` con precio 0; no muestra valor |
| 3. "Exhumación osario mural / cenizario" | Lo que diga el PDF | El PDF trae una sola fila: queda en Osarios con ese nombre, y se encuentra buscando "cenizario" |
| 4. Cementerio Central | Mausoleos | Osario y boveditas en Mausoleos → Osarios, como estaba. "Exhumación fosa" sigue en Exhumaciones, como en el PDF |
| 5. Cremaciones de niños en Tradicional y Plus | Sí, cambia el cofre | Como estaba |
| 6. Tipos "Cuerpo momificado" y "Servicio + cremación" | Sí | Como estaba |
| 7. Restricción de sectores en "sencillo a triple" | Sí | Como estaba |

## 9. Despliegue

1. Push de la **rama** (no de `main`). 2. Migración 025 desde esa rama, y verificar las columnas. 3. Push a `main` y `deploy-mantix`. 4. GenFlow. 5. Migración 026. La 025 **debe** estar corrida antes de que el backend llegue a `main`: los modelos piden las columnas nuevas en cada consulta, y cualquier sesión que corra `deploy-mantix` publicaría ese código.

## 10. Fuera de alcance

- Sumar el valor de los intereses en métricas o reportes.
- Historial de listas de precios por año.
- Cotización o propuesta en PDF para Prenecesidad.

## Anexo: catálogo 2026

### Usos temporales

| Tipo | Código | Producto | Precio 2026 |
|---|---|---|---|
| Usos temporales | `PRE-UT` | *Usos temporales, por definir* | |
| Usos temporales | `PRE-UT-01` | Uso temporal de lote, sector Olivos, 5 años | $9.190.000 |
| Usos temporales | `PRE-UT-02` | Uso temporal de lote, sector Olivos, 10 años | $13.850.000 |
| Usos temporales | `PRE-UT-03` | Uso temporal de lote, sector San José, 5 años | $8.650.000 |
| Usos temporales | `PRE-UT-04` | Uso temporal de lote, sector San José, 10 años | $13.050.000 |
| Usos temporales | `PRE-UT-05` | Uso temporal de lote, sector Cristo Rey, 5 años | $7.890.000 |
| Usos temporales | `PRE-UT-06` | Uso temporal de lote, sector Cristo Rey, 10 años | $11.850.000 |
| Prórrogas | `PRE-PRR` | *Prórrogas, por definir* | |
| Prórrogas | `PRE-PRR-01` | Prórroga, sector Olivos, 1 año | $2.365.000 |
| Prórrogas | `PRE-PRR-02` | Prórroga, sector Olivos, 4 años | $7.865.000 |
| Prórrogas | `PRE-PRR-03` | Prórroga, sector Olivos, 10 años | $13.310.000 |
| Prórrogas | `PRE-PRR-04` | Prórroga, sector San José, 1 año | $2.255.000 |
| Prórrogas | `PRE-PRR-05` | Prórroga, sector San José, 4 años | $6.655.000 |
| Prórrogas | `PRE-PRR-06` | Prórroga, sector San José, 10 años | $12.100.000 |
| Prórrogas | `PRE-PRR-07` | Prórroga, sector Cristo Rey, 1 año | $2.145.000 |
| Prórrogas | `PRE-PRR-08` | Prórroga, sector Cristo Rey, 4 años | $5.445.000 |
| Prórrogas | `PRE-PRR-09` | Prórroga, sector Cristo Rey, 10 años | $10.890.000 |
| Prórrogas | `PRE-PRR-10` | Prórroga cuerpo momificado, sector Olivos, 1 año | $1.950.000 |
| Prórrogas | `PRE-PRR-11` | Prórroga cuerpo momificado, sector San José, 1 año | $1.850.000 |
| Prórrogas | `PRE-PRR-12` | Prórroga cuerpo momificado, sector Cristo Rey, 1 año | $1.250.000 |
| Prórrogas | `PRE-PRR-13` | Prórroga bóveda Cementerio Central, 1 año | $1.200.000 |

### Mausoleos

| Tipo | Código | Producto | Precio 2026 |
|---|---|---|---|
| Lotes | `PRE-LOT` | *Lotes, por definir* | |
| Lotes | `PRE-LOT-01` | Lote sencillo (otros parques privados) | $13.950.000 |
| Lotes | `PRE-LOT-02` | Lote doble (otros parques privados) | $18.950.000 |
| Osarios | `PRE-OSR` | *Osarios, por definir* | |
| Osarios | `PRE-OSR-01` | Osario mural sector A2 (Memorial), sencillo | $10.150.000 |
| Osarios | `PRE-OSR-02` | Osario mural mármol sector A2, sencillo | $8.770.000 |
| Osarios | `PRE-OSR-03` | Osario mural mármol sector F1 (Monumento San Martín), sencillo | $6.380.000 |
| Osarios | `PRE-OSR-04` | Osario cerámica (Monumento SC y EV), sencillo | $5.780.000 |
| Osarios | `PRE-OSR-05` | Osario mural en cerámica, sencillo | $8.140.000 |
| Osarios | `PRE-OSR-06` | Osario mural Cementerio Central | $1.950.000 |
| Osarios | `PRE-OSR-07` | Boveditas Cementerio Central | $1.980.000 |
| Conversiones | `PRE-CNV` | *Conversiones, por definir* | |
| Conversiones | `PRE-CNV-01` | Conversión de lote sencillo a doble | $7.650.000 |
| Conversiones | `PRE-CNV-02` | Conversión de lote doble a triple | $9.750.000 |
| Conversiones | `PRE-CNV-03` | Conversión de lote sencillo a triple | $12.500.000 |
| Conversiones | `PRE-CNV-04` | Conversión de osario en tierra, de sencillo a doble | $1.760.000 |
| Conversiones | `PRE-CNV-05` | Conversión de cenizario en cerámica, de sencillo a doble | $1.760.000 |
| Columbarios | `PRE-CLM` | *Columbarios, por definir* | |
| Columbarios | `PRE-CLM-01` | Columbario | $4.785.000 |
| Columbarios | `PRE-CLM-02` | 1 columbario + inhumación | $5.315.000 |
| Columbarios | `PRE-CLM-03` | 4 columbarios + inhumación | $19.850.000 |
| Columbarios | `PRE-CLM-04` | 6 columbarios + inhumación | $29.405.000 |
| Columbarios | `PRE-CLM-05` | 8 columbarios + inhumación | $38.710.000 |
| Cenizarios | `PRE-CNZ` | *Cenizarios, por definir* | |
| Cenizarios | `PRE-CNZ-01` | Cenizario mural sector A2 Memorial, sencillo | $7.480.000 |
| Cenizarios | `PRE-CNZ-02` | Cenizario mármol sector O (Monumento Niña María), doble | $6.550.000 |
| Cenizarios | `PRE-CNZ-03` | Cenizario mármol sector F1 (Monumento San Martín), doble | $5.230.000 |
| Cenizarios | `PRE-CNZ-04` | Cenizario mural cerámica, doble | $6.540.000 |
| Cenizarios | `PRE-CNZ-05` | Cenizario mural cerámica, sencillo | $5.330.000 |

### Cremaciones

| Tipo | Código | Producto | Precio 2026 |
|---|---|---|---|
| Tradicional | `PRE-CRT` | *Cremación tradicional, por definir* | |
| Tradicional | `PRE-CRT-01` | Cremación tradicional, cofre clásico | $2.180.000 |
| Tradicional | `PRE-CRT-02` | Cremación niños hasta 12 meses tradicional, cofre clásico | $1.020.000 |
| Plus | `PRE-CRP` | *Cremación plus, por definir* | |
| Plus | `PRE-CRP-01` | Cremación tradicional plus, cofre presidencial | $2.475.000 |
| Plus | `PRE-CRP-02` | Cremación niños hasta 12 meses tradicional plus, cofre presidencial | $1.380.000 |
| Restos | `PRE-CRR` | *Cremación de restos, por definir* | |
| Restos | `PRE-CRR-01` | Cremación de restos tradicional, cofre clásico | $1.200.000 |
| Restos | `PRE-CRR-02` | Cremación de restos tradicional plus, cofre presidencial | $1.695.000 |
| Cuerpo momificado | `PRE-CMM-01` | Cremación de cuerpo momificado, cofre clásico | $715.000 |

### Servicios exequiales

| Tipo | Código | Producto | Precio 2026 |
|---|---|---|---|
| Jericó | `PRE-SJE-01` | Servicio exequial Jericó | $10.950.000 |
| San Gabriel | `PRE-SSG` | *Servicio San Gabriel, por definir* | |
| San Gabriel | `PRE-SSG-01` | Servicio exequial San Gabriel Gold (para cremación) | $9.160.000 |
| San Gabriel | `PRE-SSG-02` | Servicio exequial San Gabriel (para cremación) | $6.650.000 |
| Edén | `PRE-SED-01` | Servicio exequial Edén | $8.900.000 |
| Olivos | `PRE-SOL-01` | Servicio exequial Olivos | $7.150.000 |
| San José | `PRE-SSJ-01` | Servicio exequial San José (San Martín, San José y Santísima Trinidad) | $6.765.000 |
| Sinaí | `PRE-SSI-01` | Servicio exequial Sinaí Olivos | $5.950.000 |
| Servicio + cremación | `PRE-SCR-01` | Servicio exequial + cremación | $7.950.000 |

### Inhumaciones

| Tipo | Código | Producto | Precio 2026 |
|---|---|---|---|
| Lotes | `PRE-INL` | *Inhumación de lotes, por definir* | |
| Lotes | `PRE-INL-01` | Inhumación 1 parte, lote | $4.650.000 |
| Lotes | `PRE-INL-02` | Inhumación 2 parte, lote | $3.950.000 |
| Lotes | `PRE-INL-03` | Inhumación nivel 1A para lote triple | $0 (sin precio en la lista) |
| Osarios | `PRE-INO` | *Inhumación de osarios, por definir* | |
| Osarios | `PRE-INO-01` | Inhumación osario tierra, 1 parte | $1.550.000 |
| Osarios | `PRE-INO-02` | Inhumación osario tierra, 2 parte | $1.200.000 |
| Osarios | `PRE-INO-03` | Inhumación osario mural cerámica, sencilla | $876.000 |
| Osarios | `PRE-INO-04` | Inhumación simultánea osario mural cerámica, doble | $980.000 |
| Osarios | `PRE-INO-05` | Inhumación osario mármol | $876.000 |
| Osarios | `PRE-INO-06` | Inhumación simultánea osario mármol, doble | $980.000 |
| Cenizarios | `PRE-INC` | *Inhumación de cenizarios, por definir* | |
| Cenizarios | `PRE-INC-01` | Inhumación cenizario cerámica | $876.000 |
| Cenizarios | `PRE-INC-02` | Inhumación cenizario mármol | $876.000 |
| Cenizarios | `PRE-INC-03` | Inhumación simultánea cenizario mármol, doble | $980.000 |
| Columbarios | `PRE-INB-01` | Inhumación columbario | $876.000 |

### Exhumaciones

| Tipo | Código | Producto | Precio 2026 |
|---|---|---|---|
| Lotes | `PRE-EXL` | *Exhumación de lotes, por definir* | |
| Lotes | `PRE-EXL-01` | Exhumación 1 parte completa tradicional | $3.950.000 |
| Lotes | `PRE-EXL-02` | Exhumación 2 parte completa tradicional | $3.270.000 |
| Lotes | `PRE-EXL-03` | Exhumación fosa | $230.000 |
| Osarios | `PRE-EXO` | *Exhumación de osarios, por definir* | |
| Osarios | `PRE-EXO-01` | Exhumación osario mural / cenizario completa tradicional | $650.000 |
| Osarios | `PRE-EXO-02` | Exhumación osario tierra, 1 parte completa tradicional | $870.000 |
| Osarios | `PRE-EXO-03` | Exhumación osario tierra, 2 parte completa tradicional | $750.000 |
| Cenizarios | `PRE-EXC` | *Exhumación de cenizarios, por definir* | |
| Columbarios | `PRE-EXB-01` | Exhumación columbario | $350.000 |
