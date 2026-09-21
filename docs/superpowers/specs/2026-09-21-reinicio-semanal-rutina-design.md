# Reinicio semanal del ciclo de rutina

## Contexto y objetivo

La rutina "Mujeres básicos" tiene cinco días, y el primero y el último trabajan
lo mismo: el **día 5 es Pierna completa** y el **día 1 es Pierna (cuádriceps)**.
Mientras la clienta va los cinco días de la semana eso no molesta, porque el día
5 cae en viernes y el día 1 en lunes, con el fin de semana en medio.

El problema aparece en cuanto falta un día. El ciclo actual es rodante: no sabe
de semanas, solo avanza uno cada vez que alguien asiste. Si la clienta falta el
miércoles, la secuencia se corre y el día 5 termina cayendo un lunes y el día 1
un martes. **Pierna dos días seguidos.**

Este diseño hace que ese choque sea imposible por construcción en vez de
detectarlo y parcharlo: en las rutinas marcadas para ello, el ciclo se reinicia
cada lunes. El día que toca pasa a ser *la N-ésima asistencia de la semana*. Si
faltó un día, la semana termina en el día 4 y **el día 5 simplemente no se hace
esa semana**.

Está anotado en el backlog como entrada **"5. Rutina y semana incompleta"**,
detectada el 2026-09-14, en las palabras originales del entrenador:

> if a woman dont go the 5 days of a week in a row, the routine should change
> looking that they dont do legs two times in a row

## Qué modifica de lo ya decidido

Este spec cambia la regla de avance definida en
[2026-09-02-calendario-rutina-como-ley-design.md](2026-09-02-calendario-rutina-como-ley-design.md),
que estableció que el historial de asistencias es la fuente de verdad del día y
que el ciclo da la vuelta al llegar al final.

**Lo que se conserva, y es casi todo:** el historial sigue siendo la fuente de
verdad, el día sigue sin guardarse en el cliente, el ancla de "Asignar día"
sigue existiendo y sigue mandando solo mientras no haya asistencias posteriores,
y el trío denormalizado sigue siendo lo único que la web interpreta.

**Lo único que cambia**, y solo para las rutinas marcadas: el ancla efectiva
nunca puede ser anterior al domingo pasado, y el ciclo deja de dar la vuelta.

## Alcance

**Se agrega:**

- Un campo `reinicioSemanal: Boolean` en `Rutina`, con un switch en el editor.
- La regla de la semana en `RutinaProgressCalculator`, y su reflejo en `dia.ts`.
- Un estado explícito de **descanso** en el resultado del cálculo del día.
- El estado "Semana completa" en Tomar Asistencia.

**No se toca:**

- Las rutinas de 3 y 6 días. El entrenador confirmó que ninguna tiene el patrón
  de empezar y terminar con la misma parte del cuerpo, así que se quedan con el
  ciclo rodante que ya tienen. El campo nuevo nace en `false`.
- El cálculo de rachas, faltas, medallas y récords. Siguen leyendo `asistio` y
  `diaRutinaRealizado` con el mismo significado de siempre.
- Las reglas de Firestore y las Cloud Functions, salvo lo que se dice al final
  sobre `cambiarDia`, que resulta encajar sin modificarse.

## Modelo de datos

```kotlin
data class Rutina(
    val id: String = "",
    val nombre: String = "",
    val dias: List<DiaRutina> = emptyList(),
    val reinicioSemanal: Boolean = false
)
```

Un solo booleano, con default `false`. **No hay migración de datos:** Firestore
omite los campos que nunca se escribieron, así que toda rutina que ya existe
llega sin el campo y se lee como `false`, que es exactamente el comportamiento
de hoy. La marca se activa a mano, rutina por rutina.

### Por qué un campo y no una deducción

Se consideraron tres alternativas y se descartaron a propósito:

- **Aplicarlo a toda rutina de 5 días.** Coincide con la realidad de hoy —todas
  las de 5 días tienen el patrón— pero deja de valer el primer día que se cree
  una de 5 días que no lo tenga, y fallaría en silencio.
- **Un grupo muscular por día, comparando el primero con el último.** Es el
  modelo más rico y serviría para estadísticas, pero obliga a capturar el grupo
  de cada día de cada rutina existente para resolver un problema que un booleano
  resuelve entero.
- **Una heurística sobre `nombreDia`.** Acierta "Pierna completa" contra "Pierna
  (cuádriceps)" y falla "Cuádriceps" contra "Femoral", que es el mismo choque.
  Adivinar una regla de negocio a partir de texto libre que el entrenador
  escribe a mano es frágil por definición.

El switch es explícito, no depende de cómo se escriban los nombres, y se puede
quitar tan fácil como se pone.

## La regla

Con `reinicioSemanal` activo, el día que toca es **la N-ésima asistencia de la
semana**, contando la semana de lunes a domingo.

Eso no exige reescribir `diaQueToca`. La función ya hace lo correcto —toma la
asistencia más reciente posterior al ancla y avanza uno— y el ancla ya es una
fecha **exclusiva**. Basta con correr el ancla:

```kotlin
private fun anclaEfectiva(ancla: Ancla, hoy: String, reinicioSemanal: Boolean): Ancla {
    if (!reinicioSemanal) return ancla
    val domingo = lunesDe(hoy).minusDays(1).toString()
    return if (ancla.fecha >= domingo) ancla else Ancla(dia = 0, fecha = domingo)
}
```

El ancla se fecha en el **domingo anterior** —no en el lunes— porque es
exclusiva: el historial manda estrictamente después de ella, y queremos que las
asistencias del lunes ya cuenten.

De ahí se sigue todo solo:

- **Es lunes.** No hay ninguna asistencia posterior al domingo, así que
  `diaQueToca` cae en su `?: return ancla.dia`, que ahora vale 0. **Día 1.**
- **Es jueves y faltó el miércoles.** La última asistencia es la del martes, con
  día 2. Avanza uno: **día 3.** El viernes será el día 4, y ahí termina.
- **Se asignó el día a mano el miércoles.** Ese ancla es posterior al domingo, y
  `>= domingo` la conserva. Manda el resto de la semana y el domingo siguiente
  la barre sola. Es la comparación la que implementa "vale hasta el domingo": no
  hace falta borrar nada ni programar nada.

### El ciclo deja de dar la vuelta

`siguienteDia` hoy vuelve a 0 al pasarse del último día. **Ahí es donde vive el
choque**, y con `reinicioSemanal` esa vuelta desaparece: si el día realizado era
el último, no hay día siguiente, hay descanso.

```kotlin
return when {
    ultima.fecha == hoy -> Dia(realizado)
    reinicioSemanal && realizado + 1 >= totalDias -> Descanso
    else -> Dia(siguienteDia(realizado, totalDias))
}
```

Entre el día 5 y el día 1 siempre queda el fin de semana, porque el día 1 solo
puede volver a aparecer cuando el ancla se corre al domingo.

### Un caso aceptado a sabiendas

Si una clienta falta el miércoles y **además viene el sábado**, esa asistencia
del sábado es su quinta de la semana y le tocaría el día 5. El lunes siguiente
sería el día 1: pierna el sábado y pierna el lunes, con un solo día de descanso
en medio en vez de dos.

No es el bug que este spec ataca —no son días consecutivos— y forzar el descanso
ahí le quitaría a la clienta el día que vino a recuperar. **Se deja como está.**
Queda escrito para que quien lo vea después sepa que es una decisión y no un
descuido.

## Representar el descanso

Este es el único punto donde el cambio deja de ser local, y conviene ser honesto
sobre por qué.

Hay que separar dos cosas que es fácil confundir: **lo que se guarda** y **lo que
se calcula**.

**Lo que se guarda no necesita nada nuevo.** El filtro del ciclo exige las dos
condiciones —`asistio && diaRutinaRealizado != null`— y las rachas se calculan
con `asistio` y las fechas, sin mirar el día (`RachaCalculator.rachaMasLarga`;
el único que lee el día es `diaFavorito`). Así que una asistencia con
`asistio = true` y `diaRutinaRealizado = null` ya es hoy un estado coherente y
distinto de una falta: **cuenta para la racha y no mueve el ciclo**, que es
exactamente lo que se quiere para "vino pero ya había completado la semana". No
hace falta ningún campo ni valor nuevo en Firestore.

**Lo que se calcula sí.** `diaQueToca` devuelve `Int` y no tiene forma de decir
"hoy no hay día", y quien lo llama necesita saberlo para pintar la pantalla.
Ese es el único motivo del tipo nuevo:

```kotlin
sealed interface DiaQueToca {
    data class Dia(val indice: Int) : DiaQueToca
    object Descanso : DiaQueToca    // semana completa; solo con reinicioSemanal
    object SinRutina : DiaQueToca
}
```

Son seis sitios de llamada en Kotlin y el compilador los encuentra todos, que es
precisamente lo que se quiere: ninguno puede ignorar el caso nuevo en silencio.

`iniciarTiempo` es el que hay que mirar con cuidado, porque su firma pide un
`Int` no nulo. Con `Descanso` el botón no tiene día que mandar: se deshabilita, y
la asistencia del sábado se registra por el camino normal de Tomar Asistencia,
que sí admite día nulo.

**La alternativa descartada** era dejar `diaQueToca` devolviendo el último día y
preguntar el descanso por separado, con un `semanaCompleta()` aparte. Se evita
porque serían dos llamadas que pueden desincronizarse, y este archivo está
construido justamente para que eso sea imposible —es el mismo motivo por el que
`denormalizar` vive dentro de él y no en una clase propia.

`SinRutina` también gana con esto: hoy Kotlin devuelve `0` cuando no hay rutina,
"para no romper a quien espera un índice", y la web devuelve `null` porque sí
necesita distinguirlo. Esa divergencia documentada en `dia.ts` desaparece.

## El gemelo de TypeScript

`interpretar` en [web/src/dia.ts](../../../web/src/dia.ts) es la referencia de
las tres líneas que corre la web, y sigue siéndolo. Toda la lógica difícil —el
ancla, el historial, los clientes anteriores al corte— se queda en Kotlin.

La web recibe el trío `{dia, fecha, esAncla}` más `reinicioSemanal`, que ya
viaja dentro de `rutinaAsignada`, y aplica:

```
si reinicioSemanal y lunesDe(valor.fecha) < lunesDe(fecha):  → día 0
si valor.fecha === fecha:                                     → acotado
si reinicioSemanal y acotado + 1 >= totalDias:                → Descanso
                                                              → acotado + 1
```

La comparación por lunes en vez de por fechas sueltas es lo que hace que el trío
siga bastando: no hace falta mandar nada más, porque "la asistencia es de la
semana pasada" se puede decidir con la fecha que ya está ahí.

**Zona horaria.** `esFinDeSemana` en `tarjetaDia.ts` construye la fecha con
`T12:00:00` y lee `getUTCDay()` para no depender de la zona del navegador.
`lunesDe` tiene que hacer exactamente lo mismo, o las dos funciones van a
discrepar en los bordes del día y la tarjeta dirá una cosa distinta según la
hora. El test tiene que fijar ese detalle.

**El contrato gemelo se mantiene.** Para toda fecha `d >= hoy`,
`interpretar(denormalizar(c, a, hoy), totalDias, d) == diaQueToca(c, a, d)`
sigue siendo cierto, ahora también sobre los tres estados. `DiaDenormalizadoTest`
es quien lo verifica y hay que extenderlo a las rutinas con reinicio.

### Por qué el riesgo en la web es menor de lo que parece

`Descanso` en la web está casi siempre tapado por algo que ya existe. La tarjeta
consulta `esFinDeSemana(hoy)` **antes** de mirar el día, y muestra "Hoy toca
descansar" sin llegar al cálculo.

Y en día hábil, `Descanso` es inalcanzable para una rutina de cinco días: haría
falta haber realizado el día 5 antes del viernes, es decir cinco asistencias en
cuatro días hábiles. **El estado nuevo solo se materializa de verdad en Tomar
Asistencia**, dentro de la app, un sábado. Se implementa igual en la web para
que el gemelo siga siendo un gemelo, pero no hay un camino nuevo que pueda
romperle la página a una clienta entre semana.

## Tomar Asistencia

Cuando el cálculo devuelve `Descanso`, la fila del cliente muestra **"Semana
completa"** en lugar de un día sugerido.

El entrenador **sí puede** marcarla presente: abre el selector de día que ya
existe en `TomarAsistenciaScreen` y escoge cuál hizo. Se guarda ese día.

Si la marca presente **sin** elegir día, se guarda `asistio = true` con
`diaRutinaRealizado = null`. Queda el registro de que vino, cuenta para su racha,
y no mueve el ciclo — el estado que ya existía y que aquí encaja solo.

Se descartaron las dos alternativas: **repetir el día 5 automáticamente**
registraría pierna dos veces —justo lo que esta feature evita—, y **deshabilitar
la fila** perdería el registro de que la persona fue, que es información real y
cuenta para su racha.

Esa asistencia del sábado **no mueve el lunes**: el ancla se corre al domingo
siguiente, así que nada de la semana anterior sobrevive al reinicio.

## El editor de rutinas

`RutinaEditorViewModel` y su pantalla ganan un switch, *"Reiniciar el ciclo cada
lunes"*, con una línea de ayuda: *"El día 5 solo se hace si viene la semana
completa."*

Tiene sentido únicamente en rutinas cuyo primer y último día trabajan lo mismo,
cosa que la app no puede saber. Se muestra siempre y se explica; el entrenador
decide.

## Clientes anteriores al corte

`FECHA_CORTE` (2026-09-01) congela el día de los clientes que existían antes de
que el historial fuera la fuente de verdad. Ese ancla congelada es de una semana
muy anterior, así que en cuanto su rutina se marque con `reinicioSemanal` la
comparación `ancla.fecha >= domingo` da falso y el ancla se corre al domingo.
**Empiezan en el día 1 el lunes siguiente**, que es lo correcto y no necesita
ningún tratamiento especial.

## `cambiarDia` no se toca

La Cloud Function `cambiarDia` escribe el ancla fechada **ayer**, para que la
asistencia del mismo día ya cuente y el ciclo avance al día siguiente en vez de
quedarse trabado.

Eso encaja sin modificarse. Un cambio hecho el miércoles deja el ancla en
martes, que es posterior al domingo, y `>= domingo` la conserva. El caso extremo
es un cambio hecho el lunes: el ancla queda en domingo, y `domingo >= domingo` es
cierto, así que también se conserva. **No hace falta cambiar la función.**

## Pruebas

TDD, sobre el andamiaje que ya existe.

- **`AvanceDiaSecuenciaTest`** tiene hoy el test *"días seguidos recorren el
  ciclo y dan la vuelta"*. Hay que **partirlo en dos**: uno que siga afirmando la
  vuelta para `reinicioSemanal = false`, y otro que afirme el descanso para
  `true`. Dejarlo como está sería afirmar las dos cosas a la vez.
- **`EscenarioRutina`**, el DSL de los tests de dominio, gana la forma de
  declarar una rutina con reinicio semanal.
- **El caso que originó todo, como test:** rutina de 5 días con reinicio, falta
  el miércoles, y se verifica día por día que el viernes es el día 4, que el día
  5 no aparece en toda la semana, y que el lunes siguiente es el día 1.
- **El caso de la falta en lunes:** martes es día 1, no día 2. Es lo que
  distingue "N-ésima asistencia" de "día fijo por día de la semana".
- **El ancla a media semana:** asignar día 2 un miércoles manda hasta el
  viernes, y el lunes reinicia igual.
- **`DiaDenormalizadoTest`** extiende el contrato gemelo a los tres estados y a
  las rutinas con reinicio.
- **`web/src/dia.test.ts`** cubre el cruce de semana y el descanso, con la fecha
  fijada para que la zona horaria no decida el resultado.
- **Un test de sábado**, que no dependa del calendario real: la semana completa
  da `Descanso`, y la semana incompleta da el día 5 —el caso aceptado a
  sabiendas de más arriba.

## Archivos que se tocan

| Archivo | Qué cambia |
|---|---|
| `data/model/Rutina.kt` | El campo `reinicioSemanal` |
| `domain/RutinaProgressCalculator.kt` | `anclaEfectiva`, sin vuelta de ciclo, `DiaQueToca` |
| `domain/DiaQueToca.kt` | Nuevo: el tipo de resultado |
| `ui/calendario/TomarAsistenciaViewModel.kt` + `Screen.kt` | "Semana completa" |
| `ui/clientes/ClienteDetailViewModel.kt`, `ClientesListViewModel.kt` | El caso nuevo |
| `ui/sandbox/SandboxViewModel.kt` | El caso nuevo |
| `ui/rutinas/RutinaEditorViewModel.kt` + pantalla | El switch |
| `data/fake/FakeClienteRepository.kt` | Datos de prueba con reinicio |
| `web/src/dia.ts` | La regla de la semana y el descanso |
| `web/src/ui/tarjetaDia.ts` | El estado de descanso; `lunesDe` con la misma zona |
| `web/src/datos.ts` | `reinicioSemanal` en el tipo de `Rutina` |

`functions/` no se toca. `firestore.rules` no se toca.
