# Revive extra por racha de 30

Decisión del entrenador, 2026-10-17.

## Qué es

Quien llega a una racha de **30 días** gana **un revive más al mes, para siempre**: pasa de 3
a 4 revives mensuales para justificar una falta sin perder la racha.

- **Permanente:** si la racha se rompe después, sigue teniendo 4.
- **No se acumula:** 4 es el tope. Rachas más largas no dan más revives.
- **Ruleta:** el castigo se resta del nuevo máximo. Quien tiene 4 y pierde la ruleta tiene 3
  el mes siguiente.
- **Quien ya llegó a 30 antes de que esto existiera** lo tiene desde el primer día.
- **Sin medalla.** Solo un aviso en Inicio, una vez: "⭐ Revive extra, para siempre".

## Cómo se calcula

No se guarda en ningún lado, igual que el cupo (`web/src/cupo.ts`): **tiene 4 si la racha
más larga de su historial es de 30 o más**. La racha más larga ya existía para el ranking y
sigue las reglas de la racha (el fin de semana suma si vino y no corta si no; las
justificadas cuentan). Que la racha más larga nunca baja es lo que lo hace permanente. Si el
entrenador corrige asistencias y la racha más larga queda debajo de 30, el máximo se corrige
solo, por la misma razón por la que desmarcar una justificada devuelve el cupo.

Los tres lados leen ya el historial completo del cliente, así que no hubo que migrar nada:

| Lado     | Dónde                                                                    |
|----------|--------------------------------------------------------------------------|
| Web      | `maximoPorMes` / `tieneReviveExtra` en `web/src/cupo.ts`; `rachaMasLarga` en `web/src/racha.ts` |
| Servidor | `maximoDeRevives` en `functions/src/jugarRuleta.ts` (lo usan `jugarRuleta`, `revivirRacha` y `programarAvisos`) |
| App      | `CupoRevivesCalculator.maximoPorMes` / `tieneReviveExtra`               |

`calcularDisponibles` del servidor recibe el máximo como parámetro obligatorio, para que
ningún llamador se quede con el 3 fijo.

## Lo que ve cada quien

- **Clienta (web):** el aviso en Inicio, debajo de su racha, hasta que toca "¡Genial!" (se
  recuerda en el navegador, como la invitación a los avisos). Al revivir, el diálogo dice
  "¿Usar uno de tus 4 revives ⭐?". Al perder la ruleta: "El próximo mes tendrás un revive
  menos" (antes decía "2 en vez de 3", que ya no siempre es cierto).
- **Entrenador (app):** en la ficha, "Revives: x de 4 disponibles este mes ⭐ (uno extra por
  su racha de 30)".

## Llama azul

Quien tiene el revive extra también tiene la **llama azul**: el 🔥 de su racha se ve azul en
Inicio, en el Ranking (las dos pestañas, aunque su racha actual ya se haya roto) y en su
ficha de la app del entrenador. Misma condición: racha más larga ≥ 30.

- **Web:** `ui/llama.ts` y `.llama-azul` (`filter: hue-rotate(190deg)`; no hay emoji de llama
  azul). En el ranking la decide el servidor (`llamaAzul` en cada fila de `obtenerRanking`),
  porque la página no puede leer las asistencias de los demás.
- **App:** `RachaBadge(azul = …)` rota el tono con la misma matriz que el `hue-rotate` de CSS,
  y pinta el número azul en vez del rojo.

## Despliegue

Primero las funciones y después la web: con la web nueva y el servidor viejo, la página le
ofrecería el cuarto revive y el servidor lo rechazaría con `sin_cupo`.
