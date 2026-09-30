# Quitar la escena "Esfuerzo" del video de resumen — Plan

**Objetivo:** el video de resumen ya no incluye la ventana "De tu tiempo asistido... Estuviste
entrenando Xh Xmin y descansando Xh Xmin... Lo cual representa un X%...". El resto del video
queda igual (mismo orden, mismos textos, mismas duraciones).

**Alcance:** la escena `EscenaResumen.Esfuerzo` la comparten los tres tipos de resumen
(semanal, quincenal, mensual) porque sale de `construirEscenas`. Se elimina para los tres.

**Fuera de alcance — NO tocar:**
- `ResumenClienteCalculator` (`DesgloseEsfuerzo`, `calcularDesgloseEsfuerzo`, `desgloseEsfuerzo`,
  `rankingEsfuerzo`) ni sus tests. Siguen vivos: `MedallaCalculator` usa `rankingEsfuerzo`
  para la medalla ESFUERZO.
- Cualquier otra escena del video.

## Cambios

1. `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt` (`construirEscenas`):
   borrar el bloque `val desglose = resumen.desgloseEsfuerzo; if (desglose != null) { escenas += EscenaResumen.Esfuerzo(...) }`.
   Quitar imports que queden sin uso.
2. `app/src/main/java/com/osfit/app/video/EscenaResumen.kt`: borrar `data class Esfuerzo` y el
   import de `DesgloseEsfuerzo` si queda sin uso.
3. `app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt`: borrar la rama
   `is EscenaResumen.Esfuerzo -> { ... }` del `when`. Si alguna constante o función auxiliar
   (p. ej. `formatoDuracion`, `VELOCIDAD_DESTACADO_MS_POR_CARACTER`) queda sin uso, borrarla;
   si otra escena la usa, dejarla.
4. `app/src/main/java/com/osfit/app/video/TimelineResumen.kt`: borrar la línea
   `is EscenaResumen.Esfuerzo -> 10_500L` y ajustar el comentario cercano (~línea 90) si
   menciona la escena de esfuerzo.
5. `app/src/test/java/com/osfit/app/video/ResumenVideoGeneratorTest.kt`:
   - Borrar los tests `el resumen semanal con desglose de esfuerzo agrega Esfuerzo justo despues de Tiempo`
     y `la escena Esfuerzo lleva minutosEnGym como minutosTotales y el mismo DesgloseEsfuerzo`.
   - Reescribir `el resumen sin desglose de esfuerzo no agrega la escena Esfuerzo` como
     `el resumen nunca incluye una escena de esfuerzo`: pasar un `DesgloseEsfuerzo` no nulo y
     verificar que la lista es Saludo, Asistencia, Tiempo, DiaFavorito, Despedida (5 escenas).
     (Sin la clase `Esfuerzo` no puede usarse `is EscenaResumen.Esfuerzo`; comprobar por orden y tamaño.)
   - Reescribir `el resumen mensual con desglose y racha produce el orden completo` para
     esperar 6 escenas: Saludo, Asistencia, Tiempo, DiaFavorito, RachaMasLarga, Despedida.
   - Revisar el resto del archivo: cualquier `assertEquals(N, escenas.size)` o índice que
     contara la escena de esfuerzo debe ajustarse.

## Verificación (Codex debe correr y pegar la salida)

```
./gradlew testDebugUnitTest
./gradlew assembleDebug
git grep -n "Esfuerzo" -- app/src/main/java/com/osfit/app/video   # no debe quedar ninguna referencia a EscenaResumen.Esfuerzo
```

Si `./gradlew` falla por configuración local (`local.properties`, `google-services.json`), no
inventes valores: reporta el error exacto.

## Reglas para el worker

- No hagas commit. Deja los cambios en el working tree para revisión.
- No toques archivos fuera de los listados. Si necesitas hacerlo, pregunta al coordinador.
- En `worker_done` lista los archivos modificados y el resultado real de cada comando.

## Prueba en el teléfono (la hace el coordinador, no el worker)

`adb devices` debe listar el teléfono como `device`; después `./gradlew installDebug`,
generar un resumen quincenal de un cliente con datos de esfuerzo y confirmar que la escena
ya no aparece y que las demás siguen en orden.
