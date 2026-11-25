# PAP: "Interesado" pide fecha de seguimiento

Aprobado por el usuario el 2026-11-25 (opción A, del catálogo).

## Problema
En PAP, "Interesado" está marcado en el catálogo para pedir fecha (`resultado_requiere_fecha = 1`), pero ni "Nueva visita" ni "Registro rápido" la piden. Desde que la visita cumple la cita pendiente, el interesado queda sin recordatorio.

## Qué cambia
1. Un resultado de PAP pide próxima visita si es "Volver" (siempre) o si tiene marcado "requiere fecha" en Administración. Hoy: Interesado y Volver.
2. En "Nueva visita" y "Registro rápido" la fecha es obligatoria con esos resultados. Registro rápido sugiere mañana a las 9:00, como ya hace con "Volver".
3. `pap.registroRapido` guarda fecha y hora (cliente nuevo y existente, y en la gestión) con esos resultados; con los demás, nulas, como hoy.
4. En "Mis visitas" la etiqueta de la próxima visita dice "🔁 Volver" si el estado es `VOLVER` y "📅 Seguimiento" en los demás.
5. El atajo "Sin respuesta" del registro rápido registra de una vez; si Administración le marca "requiere fecha", muestra el campo y no guarda hasta tenerla.

## Qué no cambia
"Afiliado hoy", "No interesado" y "Sin respuesta"; `quitar_prox` (se manda cuando el resultado no pide fecha); las demás áreas. El backend no exige la fecha: la pantalla anterior sigue funcionando y guarda sin cita, como hoy. Sin migración. Orden: primero el backend; con GenFlow nueva y el backend anterior, el registro rápido pediría la fecha de Interesado y se perdería.
