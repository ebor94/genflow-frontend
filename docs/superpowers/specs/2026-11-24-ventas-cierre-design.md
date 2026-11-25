# Ventas al cerrar el contrato — diseño

**Fecha:** 2026-11-24 · **Repositorios:** `mantix-backend` (módulo `sv`) y `crm-frontend` (GenFlow) · **Estado:** secciones 1 a 3 aprobadas por el usuario

## 1. Objetivo

Cuando una gestión cierra el contrato, el asesor registra qué productos vendió, cuántos y a qué precio. Ese valor es lo "ejecutado" del asesor. La gráfica de presupuesto contra ejecutado se hará cuando el usuario entregue el archivo de metas.

Hoy "Valor vendido" siempre es $0: `snapshot.service` lo escribe fijo en cero.

## 2. Decisiones del usuario

| Tema | Decisión |
|---|---|
| Cómo se registra | Precio por producto, con cantidad; el total se calcula |
| Quién corrige | El supervisor, con motivo e historial; también puede anular |
| Metas | Se definen después, con el archivo; ahora solo lo ejecutado |
| "Contrato firmado" | El resultado pasa el estado a "Contrato cerrado" |
| Dónde se guarda | A: tablas de ventas propias |
| "Meta %" | Se oculta mientras no haya metas cargadas |

## 3. Reglas

1. Aplica en áreas con catálogo por tipos (hoy, Prenecesidad) y cuando el estado nuevo es "ganado". Las demás áreas no cambian.
2. La venta es obligatoria para cerrar: al menos un producto, cantidad de 1 a 999 y precio entero mayor que 0. Un "por definir" no se vende.
3. Los productos deben ser del área y estar activos. Al corregir se acepta uno ya vendido aunque lo hayan desactivado.
4. El servidor calcula el total y pone el precio ofrecido: el del interés del cliente o, si no lo tenía, el vigente. Nada de eso se recibe.
5. La gestión y la venta se guardan en una sola transacción.
6. Suma al asesor dueño del cliente, aunque la registre el supervisor. Sin dueño, a quien la registra.
7. La fecha es el día en Colombia en que se registró. Corregirla no la mueve.
8. Un cliente puede tener varias ventas; la pantalla avisa si ya tiene una activa.
9. En una visita en sala, quien atiende al cliente de otro asesor no puede cerrarle el contrato (403).
10. Corregir y anular: roles supervisores dentro de su alcance (`fueraDeAlcance`). Motivo de 3 a 250 caracteres. Anular no cambia el estado del cliente.
11. Cada corrección o anulación deja quién, cuándo, motivo, total anterior y nuevo, y los productos de antes y después. Nada se borra.
12. Si alguien más cambió la venta desde que se abrió la ventana, responde 409 y se recarga (`cambios_vistos`).
13. Un contrato es una venta activa del asesor dueño. Los cierres sin venta (otras áreas, o anteriores a la 027) se cuentan como siempre. Una venta anulada no cuenta.

## 4. Datos (migración 027, solo crea tablas)

- `sv_crm_ventas`: cliente, gestión (única), asesor, área, fecha, total, anulada, quién la registró.
- `sv_crm_ventas_items`: producto, cantidad, precio ofrecido y precio vendido.
- `sv_crm_ventas_cambios`: acción, motivo, totales y detalle JSON.

## 5. Backend

- `POST /gestiones` y `POST /salas/homenajes/:id/visitas` aceptan `venta: { items: [{ prod_id, cantidad, precio_unitario }] }`.
- `GET /prospectos/:id/ventas`: quien puede ver al cliente.
- `PUT /ventas/:id` (`items`, `motivo`, `cambios_vistos`) y `POST /ventas/:id/anular` (`motivo`, `cambios_vistos`).
- `reportes`: contratos y valor se calculan al momento con `ventas.metricasPorAsesor`; `reporteEquipo` agrega `snap_valor_vendido_cop` y `registra_ventas`. `snapshot` usa la misma regla.
- Cerrar sin venta responde 422 con un mensaje que pide recargar GenFlow (pantallas viejas).

## 6. GenFlow

- `CampoPesos` (separador de miles, cursor estable, no cambia con la rueda), `ProductosVendidos` (líneas, total, agregar) y `utils/ventas` (lógica pura).
- `RegistrarGestion`: al cerrar, la venta reemplaza a los intereses. Cambiar de estado y volver conserva lo escrito.
- `VentasCliente` y `CambiarVentaModal` en la ficha; los botones solo los ve quien puede corregir.
- Panel del supervisor: tarjeta y columna de valor vendido si el área registra ventas. `TablaAsesores` muestra "Meta %" solo con metas, y ya no compara contra 10 contratos fijos.
- "Hoy" en Mis métricas y en el panel usa el día local: con la fecha UTC, después de las 7 p. m. se consultaba el día siguiente.

## 7. Errores y casos de borde

| Caso | Qué pasa |
|---|---|
| Falta cantidad o precio | Aviso con el nombre del producto; no se envía |
| Producto desactivado mientras se cerraba | 422; pide recargar |
| No se pueden consultar las ventas previas | Se cierra igual, sin el aviso |
| Corrección sin cambios | 422 "No hay cambios para guardar" |
| Venta ya anulada | 409 |
| Error al corregir | La ventana sigue abierta con lo escrito |

## 8. Pruebas

Backend con jest y solo simulaciones; las sumas y la migración, en MySQL 8.0 y 8.4 desechables y sin red (027 dos veces, ventas activas y anuladas, cierre por el supervisor, cierre sin venta, tres días, dos ventas en la misma gestión). GenFlow con vitest. Cada regla se comprobó rompiendo el código a propósito al escribir el plan (2026-11-24), y la pantalla se vio en el navegador a 500 y 1366 de ancho.

## 9. Despliegue

Rama → migración 027 → `main` → `deploy-mantix` → GenFlow. La 027 **debe** ir antes del backend: los reportes y el snapshot de las 11:55 p. m. consultan las tablas nuevas. El backend va antes de GenFlow: el actual descarta la venta en silencio.

## 10. Fuera de alcance

Cargar metas y la gráfica de presupuesto contra ejecutado, reporte por producto, comisiones, SAP, y cambiar el estado del cliente al anular.
