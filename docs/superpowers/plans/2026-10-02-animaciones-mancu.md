# Mancu con vida: viaje entre escenas, actuación y letras animadas — Plan

**Contexto:** `docs/superpowers/notes/2026-10-02-contexto-sesion-mancu.md` (leer primero).
**Pedido del trainer (2026-10-02):** "Mejorar las animaciones de Mancu: que no sea estático en las
ventanas, que se esté moviendo, como cambiando entre las ventanas, jugando con los efectos y las
letras." Aprobó **todas** las ideas y dio **libertad para cambiar los tiempos** del estilo Mancu.

## Ideas aprobadas

1. Mancu **viaja entre escenas**: sale corriendo por la derecha mientras crece la nube y entra
   corriendo por la izquierda cuando se destapa, dibujado **encima** de la nube.
2. **Cambio de pose a mitad de escena** (mira el dato, lo señala, celebra).
3. **Reacciones a los datos** (puesto 1 → salta y celebra; 0 días → se encoge triste).
4. **Letras con vida**: cada letra aparece con "pop" (rebote), el dato clave (tramo rojo) tiembla,
   las letras se aplastan cuando Mancu aterriza, y la despedida cae en cascada.
5. **Squash & stretch continuo** (respira estirándose) y **anticipación** antes de cada salto.
6. **Caminatas con pasos reales** (piernas alternando, no solo deslizar).

## Reglas (se mantienen)

- **Blobs no cambia nada**: ni aspecto ni tiempos. `TimelineResumenTest`, `MedallaAnimacionTest`,
  `BlobsGeometriaTest`, `ResumenVideoGeneratorTest` pasan **sin modificarse**.
- Textos de `TextosEscena` sin cambios. Mismas escenas, orden y datos.
- Sin objetos pesados por frame (`Paint`, `Path`, `RectF`, `Shader`, `Typeface`, `Bitmap`,
  `StaticLayout` sin cachear). Floats, `String`, `Pair` o un `PoseMancu.copy()` por frame están bien.
- Toda curva de animación nueva es **pura** (sin Android) en `MancuAnimacion` y con test.
- Un worker a la vez; commit local por tarea; **sin push**.

## Tiempos del estilo Mancu (nuevo: `RitmoVideo`)

`TimelineResumen` hoy fija 600 ms de transición y las duraciones. Se agrega un parámetro con
**valor por defecto idéntico a hoy**, así Blobs y sus tests no cambian:

```kotlin
/** Ritmo de un estilo: ventana de transición y tiempo extra por escena. */
data class RitmoVideo(val ventanaTransicionMs: Long = 600L, val extraMs: (EscenaResumen) -> Long = { 0L }) {
    companion object { val ESTANDAR = RitmoVideo() }
}
class TimelineResumen(escenas: List<EscenaResumen>, val ritmo: RitmoVideo = RitmoVideo.ESTANDAR)
```

- La duración de cada tramo = `duracionParaTipo(escena) + ritmo.extraMs(escena)`; toda referencia a
  `CROSSFADE_MS` usa `ritmo.ventanaTransicionMs`.
- `EstiloVideo` gana `val ritmo: RitmoVideo` (BLOBS = `ESTANDAR`, MANCU = `RitmosVideo.MANCU`).
- `ResumenVideoGenerator`: leer la config **antes** de armar el timeline y pasarle `estilo.ritmo`
  (hoy se arma en la línea ~80 y se lee la config en la ~83: invertir el orden).
- **Ritmo Mancu:** ventana **1000 ms**. Extras: Saludo +1000, Asistencia +1000, Tiempo +1000,
  DiaFavorito +1000, Racha +1000, Medalla +1000, Logros +1000, Despedida +1500.

### Reloj de escena de Mancu

Con la nube, la escena entrante solo se ve desde la mitad de la ventana. `RendererMancu` pasa a
las escenas un **reloj visible**: `t = elapsedEnTramo - (si no es el primer tramo) ventana/2`.
Así `t = 0` es el instante en que se destapa la escena (puede ser negativo bajo la nube; las
escenas no dibujan nada distinto con `t < 0`, solo se ven tapadas). La saliente queda congelada en
`t = duracion - ventana/2` durante la ventana. Contenido visible por escena = duración − 500 ms,
que con los extras es ≥ al de hoy. Todas las coreografías de abajo usan este `t`.
**Medalla:** sus constantes (`MEDALLA_INICIO_GRUPAL_MS`, `MENSAJE_MEDALLA_INICIO_MS`, …) se usan
sobre `t`; el extra de 1000 ms absorbe el corrimiento.

## Actor Mancu (capa encima de la nube)

Las escenas ya no llaman `ctx.mancu.dibujar` directamente. Llaman
`ctx.actor.colocar(x, y, tamano, pose, escalaX = 1f, escalaY = 1f, rotacion = 0f, alpha = 1f)`
(x, y = esquina superior izquierda como hoy; escalas y rotación con pivote en los pies:
`(x + tamano/2, y + tamano*0.96)`). `ActorMancu` es una clase con campos mutables (sin
asignaciones), uno por renderer; `RendererMancu` lo limpia antes de cada escena y lo dibuja
**después de la nube**, aplicando el viaje. Si una escena no coloca a Mancu, no se dibuja.

### Viaje entre escenas (pura en `MancuAnimacion`, `a` = alphaEntrante)

- **Salida** (`a < 0.5`, `s = a / 0.5`): `s < 0.3` anticipación: se agacha (escalaY 1→0.82,
  escalaX inversa) e inclina −8° (hacia atrás); `s ≥ 0.3` sprint: `x += ease-in²((s-0.3)/0.7) ·
  1.3 · ancho`, estirado en x (1.2), inclinado +12°, piernas corriendo (`fasePaso`), pose
  `ORGULLO/FELIZ/ABIERTA`. Líneas de velocidad (3–4 trazos de tinta detrás) durante el sprint.
- **Llegada** (`a ≥ 0.5`, `l = (a-0.5)/0.5`): entra desde `x − 1.3·ancho` con ease-out
  (`1 − (1−l)³`), inclinado +10° que se endereza, corriendo; en `l ≥ 0.85` frena con aplastamiento
  (escalaY 0.85→1). Pose de llegada = la que la escena coloque.
- Funciones puras: `viajeDesplazamiento(a): Float` (fracción del ancho; 0 en a=0, ≈+1.3 justo antes
  de 0.5, ≈−1.3 en 0.5, 0 en 1), `viajeInclinacion(a)`, `viajeEscalaY(a)` (x = 1/y),
  `viajeCorriendo(a): Boolean`. La primera escena no tiene llegada; la última no tiene salida
  (la Despedida ya sale caminando).

## Dibujo de Mancu: poses nuevas (`MancuDibujo`, `PoseMancu`)

- `Brazos.SENALA`: brazo derecho extendido apuntando (ángulo `pose.anguloSenala`, grados, 0 =
  derecha, −90 = arriba) con el guante al final; izquierdo en jarra/abajo.
- `Brazos.ABAJO`: ambos brazos colgando, caídos (tristeza).
- `Ojos.TRISTE` (párpados caídos, cejas en "/ \\" invertidas) y `Boca.TRISTE` (arco hacia abajo).
- `pose.ondeo: Float` (grados, 0 por defecto): rota el brazo derecho en HOLA alrededor del hombro
  (saludo que se mueve).
- `pose.fasePaso: Float` (−1 = quieto; 0..1 = ciclo de paso): piernas alternan (una adelante y
  levantada, otra atrás), zapatos rotados; el cuerpo sube 4 unidades a mitad de paso.
- **Respiración con squash & stretch:** dentro de `dibujar`, además del rebote, escalar el cuerpo
  (no la sombra) desde los pies con `MancuAnimacion.respiracionEscalaY(tMs)` (±3.5 %, sincronizada
  con `reboteY`: estira al subir) y x = 1/y.
- Funciones puras nuevas: `respiracionEscalaY(t)`, `ondeoBrazo(t)` (±20°, periodo 400 ms),
  `fasePaso(t, periodoMs)`, `alturaSalto(t)` y `escalaYSalto(t)` para un salto con anticipación:
  0–180 ms agache (altura 0, escalaY 1→0.78), 180–700 ms vuelo parabólico (altura 0→1→0, escalaY
  1.12), 700–900 ms aterrizaje (escalaY 0.82→1); fuera de [0, 900] altura 0 y escala 1.

## Letras con vida (`TextoMancu`)

`bloqueMaquina` y `maquinaEscribir` dibujan los títulos **letra por letra** (x de cada letra con
`measureText(texto, inicioLinea, i)`; sin asignaciones) con:

- **Pop:** cada letra, desde el instante en que la máquina de escribir la muestra, escala
  `popLetra(edadMs)` (0.3 → 1.25 → 1 en 260 ms) desde su base, y sube `−12 px → 0`.
- **Dato clave tiembla:** las letras del tramo rojo (`inicioRojo..finRojo`) rotan
  `temblorLetra(t, i)` (±4°, desfasado por índice) y oscilan ±3 px en y, siempre.
- **Golpe:** parámetro opcional `golpeMs` (t en que Mancu aterriza/empuja): todas las letras del
  bloque se aplastan con `squash(t − golpeMs)` desde su base.
- **Cascada:** parámetro `cascada = true`: cada letra cae desde −220 px con rebote
  (`caidaLetra(edadMs)`, 0 → asentada en 600 ms) en lugar del pop. Se usa en la Despedida.
- Los textos a mano (Patrick Hand, no títulos) solo reciben el pop suave (sin temblor).
- Funciones puras: `popLetra`, `subidaLetra`, `temblorLetra`, `caidaLetra` en `MancuAnimacion`.
- Costo: ≤ ~80 letras × 3 `drawText` por frame. Medir con el log `ResumenVideo`.

## Coreografía por escena (t = reloj visible)

| Escena | Coreografía |
|---|---|
| **Saludo** | Cae con `saltoEntrada` + `squash` (como hoy). 900–3000: saluda con `ondeo`. Al terminar de escribirse el nombre (~2000 + 300): salto con anticipación (`alturaSalto`, 160 px) en pose ORGULLO/FELIZ, golpe en las letras al aterrizar. Luego HOLA con ondeo. |
| **Asistencia** | 0–800: Mancu mira hacia arriba (LADO, boca O). Cuando aparece "N días": salto con anticipación bajo el número; al aterrizar, golpe en las letras (el número se aplasta). Reacción: puesto 1 → ORGULLO + confeti y repite saltito cada 1.6 s; `dias == 0` → se encoge (escala 0.85), ABAJO/TRISTE/TRISTE, sin salto; resto → HOLA con ondeo tras el salto. |
| **Tiempo** | La línea de la gráfica **se dibuja de izquierda a derecha** (no fade): desde 3400, 1200 ms, recortando el `Path` con `PathMeasure.getSegment` (PathMeasure y Path destino como campos) y los puntos apareciendo cuando la línea los alcanza. Mancu pequeño a la izquierda: LADO mientras se escribe; cuando la línea termina, SENALA apuntando al punto máximo (ángulo calculado), boca SONRISA; saltito al final de la frase de ranking. |
| **Día favorito** | Las rebanadas **se dibujan en barrido** una tras otra (3400 total de 2400 a 3600), etiquetas aparecen con su rebanada. La rebanada mayor "salta" hacia afuera (desplazada 18 px en su bisectriz con rebote) al terminar el barrido. Mancu: LADO mientras crece la dona; luego SENALA hacia la rebanada mayor (reemplaza la flecha suelta actual) y salto con anticipación. |
| **Racha** | Sentadillas reales: ciclo de 1200 ms con anticipación; cuenta visual (cada sentadilla al fondo hace temblar más el número). Al aparecer "N días seguidos": golpe en las letras. Al final (t ≥ duración − 2000): salto de celebración ORGULLO con sudor. Si es puesto 1, confeti. |
| **Medalla** | Antes de que aterrice la insignia: LADO mirando hacia arriba, boca O. 180 ms antes de `MEDALLA_INICIO_GRUPAL_MS`: anticipación; aterriza la medalla y Mancu salta ORGULLO + confeti; golpe en el título. Durante el mensaje: HOLA con ondeo. Sin medalla: HOLA, mira el mensaje y asiente (rebote). |
| **Logros** | Por cada insignia que entra (`CascadaLogrosMancu.inicio`), Mancu hace un salto pequeño con anticipación y SENALA hacia esa insignia (ángulo hacia su centro); al final, ORGULLO. |
| **Despedida** | Texto en **cascada**. 0–2500: HOLA con ondeo grande. Luego da media vuelta (escalaX → −1 en 250 ms, con anticipación) y **camina con pasos reales** hacia fuera por la derecha (fasePaso, 550 ms por paso), saludando con el brazo una última vez antes de salir. |

## Tareas (un worker cada una, en orden)

1. **Ritmo + reloj visible + actor + viaje.** `RitmoVideo`, timeline, `EstiloVideo.ritmo`,
   generador, `ActorMancu`, `RendererMancu` (reloj visible, actor encima de la nube, viaje con
   líneas de velocidad), funciones puras del viaje y sus tests; migrar todas las escenas a
   `ctx.actor.colocar` sin cambiar su coreografía (salvo el reloj visible). Tests nuevos:
   `RitmoVideoTest` (default idéntico a hoy, extras y ventana Mancu, `elapsedEnTramo` con 1000).
2. **Dibujo:** poses nuevas, ondeo, fasePaso, respiración squash, funciones de salto con
   anticipación; tests puros.
3. **Letras con vida** en `TextoMancu` + funciones puras + tests.
4. **Coreografía** de Saludo, Asistencia, Racha, Despedida.
5. **Coreografía** de Tiempo, Día favorito, Medalla, Logros.

Tras cada tarea el coordinador verifica (`./gradlew testDebugUnitTest assembleDebug --offline
--rerun-tasks -q`, `git diff` de lo que no se debe tocar, grep de asignaciones por frame) y hace
commit. Al final: `installDebug` y revisión del trainer en el celular, más el tiempo de
generación (`ResumenVideo` en logcat).

## Qué mirar en el celular

1. ¿Mancu cruza la nube corriendo y se lee como "el mismo personaje que viaja"?
2. ¿Los cambios de pose a mitad de escena se ven naturales y a tiempo con los textos?
3. ¿Las letras animadas se leen bien (no marean)? ¿El temblor del dato es demasiado?
4. ¿La caminata de la despedida parece caminar?
5. Duración total y tiempo de generación vs. antes.
