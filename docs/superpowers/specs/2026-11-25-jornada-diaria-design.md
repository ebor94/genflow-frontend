# Jornada: una vez al día, y la ubicación sigue sola

Aprobado por el usuario el 2026-11-25 (opción A, "durante la jornada"; forma 1, manda el backend). Sin la autorización de datos personales: queda fuera, para decidir aparte.

## Problema
- El popup "Iniciar jornada" sale en cada recarga. GenFlow guarda la jornada en el navegador sin día ni usuario; si quedó una vieja, `tracking.iniciar()` no llama al backend y al recargar no hay jornada de hoy. El backend, además, devuelve una jornada activa de otro día en vez de crear la de hoy.
- Cerrar sesión termina la jornada; al volver a entrar solo algunos asesores siguen con ubicación.
- Un asesor que marca "No laboro hoy" queda con la ubicación encendida, porque el widget la arranca solo.
- Al volver de una pausa de más de 5 minutos GenFlow manda el punto con `source: 'post_resume'`, que el backend rechaza (422): el lote nunca sale y la ubicación deja de guardarse. Encontrado al escribir el plan.

## Reglas
1. El popup sale solo si hoy no hay jornada ni ausencia. Recargar o volver a la pestaña no lo muestra de nuevo.
2. Manda el backend (`GET /tracking/jornadas/hoy`): si la jornada de hoy está activa, GenFlow sigue con esa, en cualquier equipo. El navegador guarda una copia con usuario y día.
3. Cerrar sesión no termina la jornada: envía los puntos pendientes y detiene la captura. Al volver a entrar ese día, sigue.
4. "No laboro hoy": cierra la jornada activa de hoy si la hay, detiene la captura y el backend no deja iniciar otra ese día (409 `AUSENTE`). Se quita el arranque automático de los asesores: todos empiezan con el popup.
5. Al iniciar la de hoy, el backend cierra las jornadas activas de días anteriores.
6. El cierre automático (11 p. m., o el de la regla 5) guarda como fin las 6 p. m. del día de la jornada, o su inicio si empezó después.
7. Sin red al recargar: si la copia del navegador es de este usuario y de hoy, sigue y guarda los puntos hasta que vuelva la red; si no, sale el popup, como hoy.
8. Los puntos guardados en el navegador llevan el id de su jornada: nunca se envían en la de otra persona u otro día. El backend acepta puntos y cierres solo del dueño.
9. Un lote que el backend rechaza por inválido (422) se descarta; no puede bloquear los siguientes.

## Qué no cambia
Quién la usa (todos menos super admin, gerente y director), el horario (8 a 12 y 2 a 6), los filtros de precisión y distancia, y que el navegador se pausa con el celular bloqueado. Sin migración. Orden: primero el backend; la GenFlow anterior sigue funcionando con él.
