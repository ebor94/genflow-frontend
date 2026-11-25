# Presupuesto contra realizado (Prenecesidad)

Aprobado por el usuario el 2026-11-25: se carga subiendo un Excel (plantilla de GenFlow), lo suben supervisor y administrador de área, semáforo con amarillo, tabla propia (opción A).

## Reglas
1. Presupuesto: valor entero en pesos (0 a 999.999.999.999) por asesor, área, año, mes y categoría del catálogo. Solo en áreas con catálogo por tipos (hoy, Prenecesidad).
2. Realizado: suma de `cantidad × precio` de las ventas no anuladas con `venta_fecha` en el mes (día de Colombia), por categoría del producto y asesor dueño. Corregir o anular una venta lo cambia solo. Lo vendido por fuera de GenFlow no cuenta.
3. Cumplimiento = realizado ÷ presupuesto, redondeado. Verde desde 100 %, amarillo de 80 a 99 %, rojo por debajo. Sin presupuesto (0): "—". Siempre con número e ícono, nunca solo color.
4. Cargar: descargar la plantilla del mes (asesores activos a su alcance, categorías y los valores ya cargados; si no hay, los del mes anterior), llenarla, subirla, revisar los cambios y confirmar. Con cualquier error no se guarda nada y se dice la fila y la columna.
5. Volver a subir reemplaza los valores de los asesores del archivo. Queda quién lo cambió y cuándo.
6. Ver: el asesor, lo suyo; supervisor y coordinador, sus grupos; administrador de área, director y gerente, sus áreas asignadas; super admin, todo. Cargar: supervisor y administrador de área dentro de ese alcance, y super admin.
7. En un mes salen los asesores activos del área y, además, quien tenga presupuesto o ventas ese mes aunque ya no esté activo.
8. Las categorías son las del catálogo activo, en su orden; si un mes tiene datos de una que ya no existe, también sale.

## Datos
Migración 028: `sv_org_presupuestos` (asesor, área, año, mes, categoría, valor, quién la creó y quién la cambió, fechas), única por asesor, área, año, mes y categoría. Solo crea la tabla.

## Backend (`/api/sv/presupuestos`)
- `GET /?area_id&anio&mes` → `{ area_id, anio, mes, puede_cargar, categorias, grupos, asesores, total, actualizado }`. `asesores[]`: `{ usr_id, nombre, grupo_id, activo, categorias: { <cat>: { presupuesto, realizado } }, presupuesto, realizado }`.
- `GET /plantilla?area_id&anio&mes` → xlsx.
- `POST /revisar` (multipart `archivo`, `area_id`, `anio`, `mes`) → `{ filas, cambios, errores }`, sin guardar.
- `POST /` (`area_id`, `anio`, `mes`, `filas: [{ usr_id, valores: { <cat>: entero } }]`) → guarda todo en una transacción.
- Archivo: hasta 2 MB, `.xlsx`, inspeccionado antes de abrirlo (`masajes/utils/zipSeguro`), fórmulas por su resultado guardado, 300 filas como máximo. La plantilla lleva una hoja oculta con área, año y mes: subir la de otro mes es un error.

## GenFlow
- Vista `/prenec/presupuesto` ("Presupuesto" en el menú de Prenecesidad): selector de mes; totales; una barra por asesor (llena = 100 %); al tocar un asesor, su tabla por categoría con total. Con varios grupos, pestañas. Botones "Plantilla del mes" y "Subir presupuesto" si `puede_cargar`. El asesor ve su tabla directamente.
- Mis métricas: tarjeta "Presupuesto del mes" (realizado, presupuesto y %) que abre la vista.
- Subir: elegir archivo → revisa → muestra errores o cambios (antes → después) → confirmar.

## Qué no cambia
Paneles y reportes actuales, `sv_org_metas` y la columna "Meta %" (oculta). Orden: 028, backend, GenFlow.
