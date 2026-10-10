# Avisos automáticos (notificaciones que salen solas)

## Contexto y objetivo

Ya existen las notificaciones de la web (spec `2026-10-08-notificaciones-web-pwa-design.md`):
tokens por teléfono en `clientes/{id}/dispositivos`, la llave del entrenador
`notificacionesWeb` por clienta y la función `enviarNotificacion`, que manda lo que la app
escribe en `notificaciones/`. Hasta ahora todo aviso lo escribía el entrenador a mano.

Este spec agrega **avisos que salen solos**, prendidos **clienta por clienta** desde el
apartado Web de la app.

**Decisiones tomadas (entrenador, 2026-10-10):**

- **Hora:** 9:00 am de Mazatlán, todos los días.
- **Racha perdida:** solo si la racha que perdió era de **3 días hábiles o más**. Recordatorio
  del entrenador: la ruleta es un evento especial que solo aparece cuando ya no le quedan
  vidas (revives) para revivirla; no sale cada vez que se pierde una racha.
- **Recordatorio de pago:** **2 días antes** y **el día** que vence su periodo.
- **Panel:** en el apartado Web de cada clienta, una tarjeta "Avisos automáticos" con un
  interruptor por tipo. La llave "Notificaciones" sigue mandando sobre todo.

## Cómo funciona

- `programarAvisos` (`functions/src/programarAvisos.ts`), programada con `onSchedule`
  `0 9 * * *` en `America/Mazatlan`. Lee las clientas con `notificacionesWeb == true` y, para
  cada tipo que tenga prendido, decide si hoy le toca.
- **No manda nada ella misma:** escribe el aviso en `notificaciones/` (destino `elegidas`,
  solo esa clienta, `automatico: <tipo>`) y `enviarNotificacion` lo envía como cualquier
  otro. Así hay un solo camino de envío (tandas, tokens muertos) y el aviso aparece en el
  historial de Avisos de la app, marcado "Automático".
- **Nunca dos veces:** el id es fijo por tipo, clienta y ocasión (`auto_<tipo>_<id>_<ocasión>`)
  y se crea con `create()`, que falla si ya existe.
- Lo puro (a quién, cuándo, qué texto) vive en `functions/src/avisosAutomaticos.ts`, con tests.

### Racha perdida

- Solo **de lunes a viernes**: la página no muestra el botón de revivir en fin de semana, así
  que un aviso de sábado diría "revívela" sin que haya cómo. La falta del viernes se avisa el
  lunes, que sigue dentro de la ventana de reparación (2 días hábiles).
- Le toca si el **día hábil anterior** no cuenta (ni asistencia ni justificada) y la racha que
  terminaba ahí era de 3 o más. Si ya la revivió antes de las 9, no se avisa.
- El texto depende de lo que le queda, con las mismas reglas que `revivirRacha`:
  - con vidas: "Se rompió tu racha de N días. Todavía te quedan V vidas: entra a tu página y
    revívela."
  - sin vidas y sin haber jugado la ruleta este mes: "… Ya no te quedan vidas, pero puedes
    jugar la ruleta en tu página para revivirla."
  - sin nada: "… Ya no te quedan vidas este mes. ¡Hoy puedes empezar una nueva!"

### Recordatorio de pago

- Con `fechaProximoPago` (fecha de Mazatlán): a 2 días, "Tu periodo vence en 2 días"; el día,
  "Tu periodo vence hoy". La ocasión lleva la fecha de pago: si se registra un pago y la fecha
  se mueve, el siguiente periodo vuelve a avisar.
- Es independiente de la tarjeta de pago de la página (`recordatorioPago`), que en la app pasa
  a llamarse "Tarjeta de pago en su inicio" para no confundirlos.

## Datos

- `clientes/{id}.avisosAutomaticos: { rachaPerdida?: bool, recordatorioPago?: bool }`.
  Ausente = apagado. La app escribe solo la llave que cambia (`avisosAutomaticos.<llave>`).
- `notificaciones/{id}.automatico`: la llave del tipo, o ausente si lo escribió el entrenador.
- Tipos: `AvisoAutomatico` (Kotlin) y `TipoAviso` (functions). Agregar uno es sumarlo a los
  dos y decidir su regla en `avisosAutomaticos.ts`.

## Fuera de alcance

Editar los textos, elegir la hora por clienta, avisos al entrenador.
