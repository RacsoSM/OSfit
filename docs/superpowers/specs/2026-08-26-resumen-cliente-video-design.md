# Resumen semanal/mensual en video por cliente

## Contexto y objetivo

Cada viernes (resumen semanal) y al cierre de mes (resumen mensual), el entrenador
quiere poder generar, desde el perfil de un cliente, un video corto y compartible
por WhatsApp con un resumen personalizado de sus datos: cuántos días asistió,
cuánto tiempo pasó en el gym, en qué lugar quedó comparado con los demás clientes,
y su día de rutina favorito (más, en el mensual, su racha más larga). El video se
arma como una secuencia de tarjetas fijas (imágenes), cada una visible ~8 segundos,
con una canción de fondo.

El resumen semanal y el mensual son la **misma máquina** con distinto rango de
fechas y encabezado — ese es el requisito explícito de reutilización: toda la
lógica de cálculo, ranking, renderizado de tarjetas y codificación de video vive
en clases compartidas; lo único que cambia entre "semanal" y "mensual" es el
`RangoResumen` que se les pasa y si se agrega la 4ª tarjeta (racha más larga,
solo mensual).

## No-objetivos (v1)

- No hay generación automática en segundo plano (WorkManager) — la app no puede
  producir y enviar nada sin que el entrenador la abra y toque el botón.
- No se preselecciona el chat de WhatsApp del cliente al compartir un archivo
  (limitación de Android/WhatsApp: solo un `wa.me` de puro texto puede abrir un
  chat específico; compartir un archivo abre el selector de WhatsApp y el
  entrenador elige el chat).
- No hay edición del video ni de las tarjetas dentro de la app.
- La música de fondo es un único archivo fijo aportado por el entrenador
  (`res/raw/resumen_musica.mp3`), no una librería de canciones.

## Capa de dominio (reutilizable, testeable en JVM)

Nuevo archivo `app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt`.

### Tipos

```kotlin
enum class TipoResumen { SEMANAL, MENSUAL }

data class RangoResumen(
    val inicio: LocalDate,
    val fin: LocalDate,
    val tipo: TipoResumen,
    val encabezado: String   // "Semana 2 de agosto" | "Mes de agosto"
)

data class RankingResultado(
    val puesto: Int,               // 1-based, empates comparten puesto (estilo TopViewModel)
    val nombresPorEncima: List<String>  // nombres de quienes quedaron estrictamente arriba
)

data class ResumenClienteData(
    val cliente: Cliente,
    val rango: RangoResumen,
    val diasAsistidos: Int,
    val rankingAsistencia: RankingResultado,
    val minutosEnGym: Int,                 // suma de duracionMinutos en el rango
    val rankingTiempo: RankingResultado,
    val diaFavoritoNombre: String?,        // null si diasAsistidos == 0
    val rachaMasLarga: Int?,               // solo se llena para MENSUAL
    val rankingRacha: RankingResultado?    // solo se llena para MENSUAL
)
```

### Funciones puras

- `numeroSemanaDelMes(fecha: LocalDate): Int` — cuenta cuántos viernes han pasado
  en el mes hasta `fecha` inclusive (viernes 1 del mes = semana 1). Si `fecha` no
  es viernes, se usa igual como referencia del rango (ver "Rango semanal" abajo).
- `rangoSemanal(viernes: LocalDate): RangoResumen` — rango lunes→viernes de esa
  semana, encabezado `"Semana ${numeroSemanaDelMes(viernes)} de ${nombreMes}"`.
- `rangoMensual(mes: YearMonth): RangoResumen` — rango día 1→último día del mes,
  encabezado `"Mes de ${nombreMes}"`.
- `calcularRanking(valoresPorCliente: List<Pair<Cliente, Int>>, clienteId: String): RankingResultado` —
  agrupa por valor descendente igual que `construirPodio` en `TopViewModel.kt:25-32`
  (empates comparten puesto), y para el cliente pedido arma la lista de nombres
  estrictamente por encima de su puesto. Reutilizado tanto para asistencia como
  para tiempo en gym y (en mensual) para racha — es el "sistema de comparación"
  pedido, generalizado a cualquier métrica entera.
- `diaFavoritoEnRango(asistencias: List<Asistencia>, dias: List<DiaRutina>): String?` —
  como `RachaCalculator.diaFavorito` pero con desempate **aleatorio** real (pide
  todos los índices que empatan en el conteo máximo y elige uno con `Random`),
  y devolviendo el nombre del día (no el índice), o `null` si no hay asistencias.
- `leyendaPorPuesto(puesto: Int): String` — puro:
  - `1` → "¡Felicidades, tú eres el mejor!"
  - `2, 3` → "¡Felicidades, estás en el podio, sigue así!"
  - `4, 5` → "¡Estás muy cerca del podio!"
  - resto → "Échale ganitas jefe"
- `calcularResumenCliente(cliente, todosLosActivos, asistenciasEnRango, rango): ResumenClienteData` —
  combina todo lo anterior. `asistenciasEnRango` ya viene filtrado por fecha desde
  el repositorio (mismo patrón que `observarAsistenciasPorRango` que ya existe).

Todas estas funciones son puras (`List`/`LocalDate`/`Int` de entrada, sin Firebase),
así que se testean igual que `RutinaProgressCalculatorTest`/`RachaCalculatorTest` ya
existentes, sin mocks.

### Reutilización semanal/mensual

`ClienteDetailViewModel` (o un nuevo `ResumenViewModel`) solo decide **qué rango**
construir (`rangoSemanal` vs `rangoMensual`) y si pide la 4ª tarjeta; el resto del
pipeline (cálculo → tarjetas → video) es idéntico para ambos.

## Tarjetas (renderizado)

Nuevo archivo `app/src/main/java/com/osfit/app/video/ResumenCardRenderer.kt`.

```kotlin
sealed class TarjetaResumen {
    data class Asistencia(val dias: Int, val ranking: RankingResultado, val encabezado: String, val nombreCliente: String) : TarjetaResumen()
    data class Tiempo(val minutos: Int, val ranking: RankingResultado) : TarjetaResumen()
    data class DiaFavorito(val nombreDia: String?) : TarjetaResumen()   // null -> mensaje motivacional
    data class RachaMasLarga(val dias: Int, val ranking: RankingResultado) : TarjetaResumen()  // solo mensual
}

object ResumenCardRenderer {
    fun renderizar(tarjeta: TarjetaResumen, ancho: Int = 1080, alto: Int = 1920): Bitmap
}
```

Dibuja con `android.graphics.Canvas`/`Paint` nativos (fondo con la paleta
verde/rojo ya usada en la app, título grande, dato grande, línea de comparación
chica, leyenda) — deliberadamente **sin Compose**: así puede correr en una
coroutine de fondo sin necesitar una vista adjunta a pantalla, y es la parte más
simple de verificar visualmente guardando el bitmap intermedio como PNG durante
las pruebas.

Textos exactos por tarjeta (según lo acordado):

- **Asistencia**: encabezado (`rango.encabezado`) + "Hola, {nombre}" + "Esta
  semana/mes asististe {dias} días" (grande) + "Estás en el {puesto} lugar de
  asistencias, solamente detrás de: {nombres}" (chico, o "¡vas primero!" si
  `nombresPorEncima` está vacío) + leyenda por puesto.
- **Tiempo**: "Estuviste en el poderoso Focus un total de {h}h {m}min" (grande) +
  "Estás en el {puesto} lugar de tiempo asistido, solamente detrás de: {nombres}"
  (chico, o "¡vas primero!" si `nombresPorEncima` está vacío) + leyenda por puesto.
- **Día favorito**: "Tu día favorito fue {nombreDia}", o si `nombreDia == null`:
  "Esta semana/mes no viniste, ¡te esperamos la próxima!".
- **Racha más larga** (solo mensual): "Tu racha más larga este mes fue de {dias}
  días seguidos" + mismo patrón de ranking/leyenda.

## Video

Nuevo archivo `app/src/main/java/com/osfit/app/video/ResumenVideoEncoder.kt`.

```kotlin
object ResumenVideoEncoder {
    suspend fun generar(
        tarjetas: List<Bitmap>,
        segundosPorTarjeta: Int = 8,
        musicaResId: Int?,           // R.raw.resumen_musica, o null para silencio
        context: Context,
        salida: File
    )
}
```

- **Video**: `MediaCodec` H.264 (`video/avc`) alimentado por un `Surface` de
  entrada; cada tarjeta se dibuja en el surface y se mantiene el número de
  frames necesario para cubrir sus 8 segundos (fps bajo, p. ej. 2fps, para
  minimizar trabajo ya que el contenido es estático dentro de cada tarjeta).
- **Audio**: si `musicaResId != null`, se decodifica el mp3 embebido
  (`MediaExtractor` + `MediaCodec` decoder) a PCM, se recorta/repite en loop
  hasta cubrir la duración total del video, y se re-codifica a AAC
  (`MediaCodec` encoder) — es el formato de audio que `MediaMuxer` soporta de
  forma confiable en un contenedor mp4.
- **Muxing**: `MediaMuxer` escribe ambas pistas al archivo de salida
  (`context.cacheDir/resumenes/<clienteId>_<rango>.mp4`).
- Archivo de música esperado: `app/src/main/res/raw/resumen_musica.mp3` — el
  entrenador coloca ahí su archivo con ese nombre exacto. Si el archivo no
  existe, `musicaResId` se pasa como `null` y el video sale sin audio (no debe
  romper la generación).

**Esta es la única pieza que no se puede verificar con tests unitarios en JVM**
(los codecs de hardware no están disponibles fuera de un dispositivo real). Se
verifica generando un video real en tu teléfono vía adb, igual que el resto de
builds de esta conversación, y confirmando a mano que reproduce y suena bien.

## Compartir

- Se agrega un `FileProvider` en `AndroidManifest.xml` + `res/xml/file_paths.xml`
  apuntando a `context.cacheDir` (siguiendo el patrón estándar de Android, no
  existe ninguno hoy en el proyecto).
- Nueva función en `util/WhatsAppUtil.kt` (o un `util/CompartirUtil.kt` nuevo):
  `compartirVideo(context, videoFile)` — arma un `Intent.ACTION_SEND` con
  `type = "video/mp4"`, `EXTRA_STREAM` apuntando al `Uri` del `FileProvider`,
  `setPackage("com.whatsapp")`, y `FLAG_GRANT_READ_URI_PERMISSION`. Como se
  explicó arriba, esto abre WhatsApp con el video listo para enviar pero **sin
  chat preseleccionado** — el entrenador elige el contacto ahí mismo.

## UI

En `ClienteDetailScreen.kt` (o su pestaña de Estadísticas), dos botones nuevos:
"Resumen semanal" y "Resumen mensual". Al tocar:
1. Muestra un indicador de progreso (la codificación toma unos segundos).
2. Corre el pipeline completo (`calcularResumenCliente` → tarjetas →
   `ResumenVideoEncoder.generar`) en `viewModelScope` con `Dispatchers.Default`
   (o `IO`) para no bloquear la UI.
3. Al terminar, dispara `compartirVideo(...)`.

No hay restricción de "solo se puede tocar el viernes": los botones están
siempre disponibles y usan la fecha actual para calcular el rango correspondiente
(la semana en curso o más reciente / el mes en curso), así el entrenador puede
generarlo el mismo viernes o después si se le pasó.

## Plan de pruebas

- **Unitarias (JVM, sin dispositivo)**: toda `ResumenClienteCalculator.kt` —
  numeración de semana del mes, construcción de rango semanal/mensual, ranking
  con y sin empates (incluyendo "vas primero" cuando `puesto == 1`), las 4
  leyendas por puesto, día favorito con desempate aleatorio (verificar que
  siempre devuelve uno de los empatados) y el caso `diasAsistidos == 0` →
  `diaFavoritoNombre == null`.
- **Manual en dispositivo (adb)**: instalar, generar un resumen semanal y uno
  mensual para un cliente con datos reales, confirmar que el mp4 generado abre y
  reproduce las tarjetas en orden con el audio, y que el botón de compartir abre
  WhatsApp con el archivo adjunto.

## Supuestos a confirmar durante la implementación

- El nombre y ubicación exactos del archivo de música (`res/raw/resumen_musica.mp3`)
  quedan fijos como se describe arriba; si el entrenador aún no lo ha colocado
  cuando se pruebe, el video se genera sin audio.
- "Detrás de" en las tarjetas de ranking lista **todos** los nombres
  estrictamente arriba, sin importar cuántos sean (si el club es grande esto
  podría ser una lista larga); no se acordó un tope, así que v1 no trunca.
