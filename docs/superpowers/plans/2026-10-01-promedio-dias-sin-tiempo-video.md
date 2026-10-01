# Promedio para los días asistidos sin tiempo en la gráfica del video

**Problema:** si el entrenador olvida tomar el tiempo de un día con asistencia
(`asistio = true`, `duracionMinutos` nulo o 0), la gráfica de tiempo del video de
resumen muestra ese día en 0 minutos. Debe mostrar el promedio de los demás días
asistidos que sí tienen tiempo.

**Dónde:** `ResumenClienteCalculator.tiempoPorDiaEnRango`
(`app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt`). La gráfica
solo consume su resultado (`ResumenVideoGenerator` -> `EscenaResumen.tiempoPorDia`
-> `ResumenFrameRenderer.dibujarGraficaTiempo`), así que el cambio es solo ahí.

## Reglas

1. Un día con al menos una asistencia `asistio = true` cuya suma de minutos es 0
   (todas con `duracionMinutos` nulo o 0) es un "día sin tiempo".
2. Su valor en la gráfica es el promedio de los días asistidos con minutos > 0
   del mismo rango, redondeado con `roundToInt()`.
3. Los días sin asistencia siguen en 0.
4. Si ningún día asistido tiene tiempo, no hay de dónde promediar: todo queda en 0.
5. El total `minutosEnGym` del resumen NO cambia (es dato real, no estimado).
   Tampoco cambian el desglose entrenando/descansando ni la medalla ESFUERZO.
6. Si el promedio redondeado da 0 (p. ej. promedio 0.4), usar el redondeo tal cual;
   no inventar un mínimo.

## Tareas

1. En `ResumenClienteCalculatorTest` agregar tests que fallen primero:
   - día asistido sin tiempo recibe el promedio de los otros (ej. 60 y 30 -> 45).
   - `duracionMinutos = null` y `duracionMinutos = 0` ambos cuentan como sin tiempo.
   - día sin asistencia sigue en 0 aunque haya promedio.
   - asistencia con `asistio = false` no cuenta ni para promedio ni como día asistido.
   - ningún día con tiempo -> todos en 0.
   - varias asistencias el mismo día: se suman; si la suma es > 0 no se promedia.
2. Cambiar `tiempoPorDiaEnRango` para cumplir las reglas y actualizar su KDoc.
3. Correr `./gradlew.bat :app:testDebugUnitTest` completo.

## Aceptación

- Los tests nuevos pasan y los existentes siguen pasando.
- `git diff` solo toca `ResumenClienteCalculator.kt`, su test y este plan.
- La verificación visual en el dispositivo la hace el entrenador.
