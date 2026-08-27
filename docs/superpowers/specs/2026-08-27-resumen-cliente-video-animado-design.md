# Resumen de cliente en video: rediseño estilo Spotify Wrapped

## Contexto y objetivo

Este spec **reemplaza** las secciones "Tarjetas (renderizado)" y "Video" de
[2026-08-26-resumen-cliente-video-design.md](2026-08-26-resumen-cliente-video-design.md),
y ajusta parte de "UI". El resto de ese spec (capa de dominio
`ResumenClienteCalculator`, compartir por WhatsApp, no-objetivos) sigue vigente
sin cambios y no se repite aquí.

El video actual arma una secuencia de tarjetas **estáticas** (una imagen fija
sostenida varios segundos, 1 frame por segundo) con la paleta verde/rojo de la
app. El pedido es reemplazarlo por una animación continua estilo "Spotify
Wrapped": fondo negro con blobs de color (magenta, cian, púrpura eléctrico)
desenfocados en movimiento lento y constante durante todo el video, texto que
aparece con efecto máquina de escribir a dos velocidades (lenta para títulos,
rápida para condiciones/comparaciones), y transiciones fluidas entre pantallas
en vez de cortes duros.

## Decisiones de producto tomadas durante el diseño

- **Resolución**: se mantiene 1080×1920 (no 4K real). El video se genera en el
  celular del entrenador al compartir, sin servidor; 4K real cuadruplicaría el
  costo de codificación sin beneficio visible en un teléfono.
- **Blur de los blobs**: blur gaussiano real vía `BlurMaskFilter`
  (`Paint().maskFilter`), no `RenderEffect`. Cada frame se arma como un
  `Bitmap`/`Canvas` normal (software), y `RenderEffect` solo compone sobre un
  canvas de hardware (`Surface.lockHardwareCanvas()`) — hubiera obligado a
  redisañar todo el pipeline para dibujar directamente sobre el Surface del
  encoder. `BlurMaskFilter` da blur real sobre un canvas por software, existe
  desde API 1 (muy por debajo de `minSdk = 26`), y es la técnica estándar de
  Android para este efecto — una sola implementación, sin ramificar por
  versión de Android y sin riesgo técnico que validar primero.
- **Escenas incluidas**: Saludo, Asistencia, Tiempo, Día favorito y (solo en el
  resumen mensual) Racha más larga — las 5 escenas que existían como tarjetas
  hoy, más el saludo nuevo, todas rediseñadas con el mismo lenguaje visual.
- **Texto de condiciones/ranking**: se reutiliza el mensaje ya existente
  ("¡Vas primero...!" / "Estás en el lugar N... detrás de: ...") tal cual está
  en `ResumenClienteCalculator`/`RankingResultado`, solo con la animación de
  escritura rápida nueva.
- **Misma estructura para semanal y mensual**: un solo diseño de escenas que se
  adapta con "semana"/"mes" según `RangoResumen.tipo`, igual que hoy.

## Modelo de escenas y timeline

Nuevo archivo `app/src/main/java/com/osfit/app/video/EscenaResumen.kt`,
reemplaza `TarjetaResumen`:

```kotlin
sealed class EscenaResumen {
    data class Saludo(val nombreCliente: String) : EscenaResumen()
    data class Asistencia(
        val encabezadoRango: String,   // "Semana del 3 de marzo al 7 de marzo"
        val dias: Int,
        val unidad: String,            // "semana" | "mes"
        val ranking: RankingResultado
    ) : EscenaResumen()
    data class Tiempo(val minutos: Int, val ranking: RankingResultado) : EscenaResumen()
    data class DiaFavorito(val nombreDia: String?, val unidad: String, val diasAsistidos: Int) : EscenaResumen()
    data class RachaMasLarga(val dias: Int, val ranking: RankingResultado) : EscenaResumen()
}
```

`ResumenVideoGenerator.construirEscenas(resumen)` reemplaza a
`construirTarjetas`: mismo orden y misma condición para incluir
`RachaMasLarga` (solo `TipoResumen.MENSUAL`), con `Saludo` siempre primero.
`encabezadoRango` se calcula nuevo a partir de `rango.inicio`/`rango.fin`
("Semana del X de mes al X de mes"; para mensual se reusa el `rango.encabezado`
existente, "Mes de X").

### Presupuesto de tiempo por escena

Duración fija por tipo de escena (constantes, no configurables por ahora):

| Escena | Total | Desglose interno |
|---|---|---|
| Saludo | 3.0s | 2.0s escritura lenta "Hola, {nombre}" + 0.4s hold + **0.6s crossfade** |
| Asistencia | 6.0s | 0.4s encabezado de rango + 2.4s título grande escritura lenta + 0.6s hold + 0.8s condiciones escritura rápida + 1.8s hold (0.6s finales = **crossfade**) |
| Tiempo | 6.0s | mismo reparto que Asistencia (título = "{h}h {m}min") |
| DíaFavorito / RachaMasLarga | 4.0s | 2.2s escritura lenta + 1.8s hold (0.6s finales = **crossfade**, salvo si es la última escena del video) |

Video semanal (4 escenas): ~19s. Video mensual (5 escenas): ~23s.

**Sin relleno extra**: los `inicioMs` de cada tramo son una suma acumulada
simple de las duraciones de la tabla (sin huecos) — la suma de duraciones por
escena ya es la duración total del video. El crossfade de 0.6s es un truco de
*rendering*, no de tiempo: en los últimos 600ms de cursor de una escena, la
escena **siguiente** ya se dibuja encimada (con alpha creciente) usando su
propio reloj de contenido, que arranca 600ms **antes** de su `inicioMs` de
cursor oficial — así su animación ya está en marcha cuando alcanza opacidad
completa exactamente en el `inicioMs` de cursor. La escena saliente, en ese
mismo instante, ya terminó su propio contenido (los últimos 600ms de su
`duracionMs` caen siempre después de que su escritura y su hold principal
terminaron) así que se ve congelada en su estado final mientras se desvanece.
Si en la prueba en dispositivo se siente apretado, se ajustan las constantes
de duración (quedan documentadas en un solo lugar).

Nuevo archivo `app/src/main/java/com/osfit/app/video/TimelineResumen.kt`:

```kotlin
data class TramoEscena(val escena: EscenaResumen, val inicioMs: Long, val duracionMs: Long) {
    val finMs: Long get() = inicioMs + duracionMs
}

class TimelineResumen(escenas: List<EscenaResumen>) {
    val tramos: List<TramoEscena>
    val duracionTotalMs: Long

    /** Tramo "dueño" de [tiempoGlobalMs] según el cursor (suma acumulada de duraciones). */
    fun tramoActivo(tiempoGlobalMs: Long): TramoEscena

    /** Próximo tramo si [tiempoGlobalMs] cae en los 600ms previos al cambio de escena
     * (su ventana de entrada anticipada); null fuera de esa ventana o si es la última escena. */
    fun tramoEntrante(tiempoGlobalMs: Long): TramoEscena?

    /** 0f al empezar la ventana de crossfade, 1f al terminarla. Llamar solo si
     * [tramoEntrante] no es null en ese instante. */
    fun alphaEntrante(tiempoGlobalMs: Long): Float

    /** Milisegundos transcurridos dentro del contenido propio de [tramo], acotados a
     * [0, tramo.duracionMs]. Si [tramo] es el entrante, ya cuenta su adelanto de 600ms. */
    fun elapsedEnTramo(tramo: TramoEscena, tiempoGlobalMs: Long): Long
}
```

Puramente aritmético sobre `Long`/`List`, sin Android — testeable en JVM igual
que `ResumenClienteCalculator`.

## Fondo de blobs

Nuevo archivo `app/src/main/java/com/osfit/app/video/BlobsGeometria.kt`: objeto
puro con 4 blobs fijos (magenta, cian, púrpura eléctrico, magenta variante),
cada uno con posición base, radio y fase/velocidad de oscilación. Una función
`posicionEn(blob, tiempoGlobalMs): PointF` mueve el centro con seno/coseno
lento (período ~8-15s, amplitud ~10-15% del canvas) — determinístico, sin
`Random`, testeable en JVM sin Android.

Un único renderer, sin ramificar por versión de Android:

```kotlin
object FondoBlobRenderer {
    fun dibujar(canvas: Canvas, ancho: Int, alto: Int, tiempoGlobalMs: Long)
}
```

Por cada blob de `BlobsGeometria`, dibuja un círculo sólido
(`canvas.drawCircle`) con un `Paint` que tiene
`maskFilter = BlurMaskFilter(radioBlurPx, BlurMaskFilter.Blur.NORMAL)` — blur
gaussiano real aplicado a la máscara de alpha de la forma, funciona en
cualquier canvas por software (como el `Canvas(bitmap)` que arma cada frame),
sin necesitar `Surface.lockHardwareCanvas()` ni ramificar por `Build.VERSION`.

El fondo se dibuja **una sola vez por frame**, con el tiempo global del video
(no el tiempo relativo de la escena) — así los blobs jamás se cortan ni
reinician entre escenas, dan la sensación de un solo video continuo.

## Texto: máquina de escribir y crossfade

Nuevo archivo `app/src/main/java/com/osfit/app/video/MaquinaEscribir.kt`:

```kotlin
object MaquinaEscribir {
    fun textoVisible(textoCompleto: String, elapsedMs: Long, duracionMs: Long): String
}
```

Pura (`String`/`Long` → `String`), reutilizada para escritura lenta y rápida —
solo cambia `duracionMs`. Cada escena define sus propios sub-tramos internos
(los de la tabla de arriba: encabezado, título, condiciones) para saber qué
bloque de texto animar y en qué ventana de tiempo relativo a su propio inicio.

`ResumenFrameRenderer` (reemplaza `ResumenCardRenderer`) compone cada frame:

1. Fondo negro + `FondoBlobRenderer.dibujar(canvas, ancho, alto, tiempoGlobalMs)`.
2. Si `timeline.tramoEntrante(tiempoGlobalMs) != null` (dentro de una ventana de
   crossfade): dibuja el texto del tramo activo (congelado en su estado final,
   vía `elapsedEnTramo` que ya lo acota a `duracionMs`) con
   `paint.alpha = (255 * (1 - alphaEntrante)).toInt()`, y el texto del tramo
   entrante (con su propio `elapsedEnTramo`, que ya arrancó 600ms antes) con
   `paint.alpha = (255 * alphaEntrante).toInt()`, ambos sobre el mismo fondo de
   blobs.
3. Si no hay crossfade activo: dibuja solo el texto del tramo activo a alpha
   completo, con `MaquinaEscribir` recortando cada bloque según su sub-tramo.

No se renderizan dos escenas completas y se mezclan a nivel de píxeles (caro);
solo el texto crossfadea, el fondo es una sola capa compartida.

## Encoder de video

`ResumenVideoEncoder.generar` cambia de firma: en vez de `tarjetas: List<Bitmap>`
+ `segundosPorTarjeta` (1fps, una tarjeta = un frame sostenido), pasa a recibir
`duracionTotalMs: Long`, `fps: Int = 30`, y una función
`renderizarFrame: (tiempoMs: Long) -> Bitmap`. El bucle interno recorre
`0 until totalFrames` (`totalFrames = duracionTotalMs * fps / 1000`), dibuja
cada bitmap en el `Surface` de entrada y drena igual que hoy; `pts` pasa de
`indice * segundosPorTarjeta * 1_000_000L` a `indice * 1_000_000L / fps` (frame
constante). `KEY_FRAME_RATE` pasa de `1` a `fps`. La lógica de audio
(transcodificación de música, muxing) no cambia.

Para un video semanal (~19s × 30fps ≈ 570 frames) el trabajo por frame es
barato (un fondo + 1-2 bloques de texto), pero hay ~7-10× más llamadas a
`drenar()` de MediaCodec que hoy (antes ~3-4 tarjetas). Se mide en dispositivo
durante la implementación; si resulta lento, bajar a 24fps es un cambio de una
constante sin tocar el resto del diseño.

## UI

Sin cambios respecto al spec anterior en cuanto al flujo (botones "Resumen
semanal"/"Resumen mensual", indicador de progreso, `compartirVideo` al
terminar). Cambia únicamente qué arma internamente
`ResumenVideoGenerator.generarYCompartir`: `construirEscenas` en vez de
`construirTarjetas`, y arma un `TimelineResumen` antes de llamar al encoder.

## Plan de pruebas

- **Unitarias (JVM, sin dispositivo)**:
  - `TimelineResumen`: `tramoActivo`/`tramoEntrante` en distintos puntos del
    timeline, incluida la última escena (sin `tramoEntrante` nunca), continuidad
    de `elapsedEnTramo` en el instante exacto del cambio de cursor, y
    `alphaEntrante` en los bordes de la ventana (0.0 y 1.0) y a la mitad.
  - `BlobsGeometria.posicionEn`: determinismo (mismo tiempo → misma posición),
    posición dentro de límites razonables del canvas.
  - `MaquinaEscribir.textoVisible`: `elapsedMs <= 0` → cadena vacía,
    `elapsedMs >= duracionMs` → texto completo, punto intermedio → longitud
    proporcional.
  - `construirEscenas`: mismo criterio que el `construirTarjetas` actual
    (racha solo en mensual, orden de escenas).
- **Manual en dispositivo (adb, al final)**: generar un resumen semanal y uno
  mensual para un cliente con datos reales; confirmar que los blobs se mueven
  de forma continua y borrosa sin cortes en los cambios de escena, que el texto
  crossfadea, que las duraciones se sienten bien, y que el archivo final
  reproduce con audio.

## Supuestos a confirmar durante la implementación

- Las constantes de tiempo de la tabla de arriba son el punto de partida; se
  ajustan si en la prueba real en dispositivo alguna transición se siente
  apretada o lenta.
- El radio de blur (`BlurMaskFilter`) y el tamaño/velocidad exactos de los
  blobs no están numéricamente fijados en este spec — quedan a criterio de
  implementación dentro del espíritu descrito (colores magenta/cian/púrpura
  eléctrico, movimiento lento y orgánico), ajustables a ojo durante la prueba
  en dispositivo.
