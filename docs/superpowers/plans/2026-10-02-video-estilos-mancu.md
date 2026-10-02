# Estilos de video por quincena + estilo Mancu — Plan

**Spec:** `docs/superpowers/specs/2026-10-01-video-resumen-mancu-design.md` (leerla primero).
**Prototipo del dibujo:** `docs/superpowers/specs/assets/mancu-prototipo.html` (abrir en el navegador).

**Objetivo:** el trainer elige, por quincena, el estilo del video de resumen: `blobs` (el actual,
por defecto) o `mancu` (papel crema + mascota disco de 20 kg). Mismo contenido, mismas escenas,
mismas duraciones; cambia solo el dibujo.

**Cómo se valida:** el trainer revisa el video **en su celular** al final de cada etapa. Los tests
unitarios (solo JUnit, sin Robolectric) cubren la lógica pura; lo visual solo se juzga en el
teléfono. Por eso el plan está cortado en etapas que terminan con un video generable de punta a
punta, aunque Mancu todavía no tenga todas las escenas.

## Reglas para quien ejecute

- **El estilo `blobs` no se toca visualmente.** Criterio de aceptación de toda la etapa 0: un
  video quincenal sale idéntico al de antes, y `MedallaAnimacionTest`, `BlobsGeometriaTest`,
  `TimelineResumenTest` y `ResumenVideoGeneratorTest` pasan **sin modificarse**.
- **Renderers = clases con estado por instancia**, nunca `object` con estado mutable: dos
  generaciones de video pueden solaparse (basta salir de la pantalla y volver a entrar).
- **Sin `Paint`, `Path`, `Bitmap` ni `Typeface` nuevos por frame.** El encoder pinta en canvas de
  software (`Surface.lockCanvas`) a 30 fps sobre 1080×1920; todo lo caro se crea una vez en el
  constructor del renderer.
- **Los textos de cada escena no se duplican.** Se extraen a un objeto compartido (tarea 3) que
  usan ambos estilos, para que un cambio de redacción no deje a un estilo desactualizado.
- **Las duraciones de `TimelineResumen` no se cambian** (la ventana de crossfade de 600 ms
  tampoco). Si la coreografía de Mancu no cabe, se avisa al trainer antes de tocarlas.
- Un commit por tarea, mensaje en el estilo del repo (`feat:`, `refactor:`, `test:`, `docs:`).
  **No hacer push** salvo que el trainer lo pida.
- Si `graphify-out/` está desactualizado tras la etapa 0, sugerir `/graphify . --update`.

## Revisión en el celular (protocolo de cada checkpoint)

```bash
./gradlew testDebugUnitTest          # lógica pura; debe estar verde antes de instalar
./gradlew installDebug               # con el celular conectado por USB y depuración activa
```

`adb` no está en el PATH del shell; está en
`C:\Users\Usuario\AppData\Local\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe`
(`adb devices` para confirmar que ve el teléfono).

En la app: **Configuración de video → quincena actual → elegir el estilo** → abrir un cliente →
generar el **resumen quincenal** (el semanal y el mensual siguen siempre en `blobs`). El video se
comparte por el menú de compartir; abrirlo en la galería.

Cada checkpoint trae su lista "Qué mirar". El trainer responde qué cambiar y se itera antes de
seguir. Anotar también cuánto tardó en generarse: **el estilo Mancu no debe tardar más de ~1.5×
lo que tarda `blobs`** con el mismo cliente.

---

# Etapa 0 — Infraestructura de estilos (sin cambio visual)

### Tarea 1: `EstiloVideo` y su registro

**Crear** `app/src/main/java/com/osfit/app/video/EstiloVideo.kt`:

```kotlin
package com.osfit.app.video

import com.osfit.app.domain.TipoResumen

/** Un estilo de video es código, no datos: en Firestore solo se guarda su [id] por quincena. */
data class EstiloVideo(
    val id: String,
    val nombre: String,
    val descripcion: String,
    /** Si el estilo pinta con la Paleta del periodo. Mancu trae sus colores fijos. */
    val usaPaleta: Boolean
)

object EstilosVideo {
    val BLOBS = EstiloVideo("blobs", "Blobs", "Fondo oscuro con blobs de color", usaPaleta = true)
    val MANCU = EstiloVideo("mancu", "Mancu", "Papel crema y la mascota Mancu", usaPaleta = false)

    /** El primero es el estilo por defecto. */
    val disponibles: List<EstiloVideo> = listOf(BLOBS, MANCU)

    /** Id nulo o desconocido (estilo borrado del código) cae en [BLOBS]: nunca falla. */
    fun porId(id: String?): EstiloVideo = disponibles.firstOrNull { it.id == id } ?: BLOBS

    /** Solo el resumen quincenal admite estilo; semanal y mensual siguen en [BLOBS]. Importa
     *  porque el rangoInicio de un mensual (día 1) coincide con el de la 1ª quincena. */
    fun paraResumen(tipo: TipoResumen, configurado: EstiloVideo): EstiloVideo =
        if (tipo == TipoResumen.QUINCENAL) configurado else BLOBS
}
```

**Test** `app/src/test/java/com/osfit/app/video/EstilosVideoTest.kt`: `porId(null)`,
`porId("inexistente")` → `BLOBS`; `porId("mancu")` → `MANCU`; `disponibles.first() == BLOBS`;
`paraResumen(SEMANAL|MENSUAL, MANCU) == BLOBS`; `paraResumen(QUINCENAL, MANCU) == MANCU`;
`BLOBS.usaPaleta` verdadero y `MANCU.usaPaleta` falso.

Comprobar el nombre exacto de los valores de `TipoResumen` en `domain/` antes de escribir el test.

### Tarea 2: persistir el estilo sin pisar la paleta

Hoy `ConfigVideoRepository.guardar` hace `set(mapOf("paletaId" to ...))`, que **reemplaza el
documento entero**. Con dos campos hay que escribir cada uno con `SetOptions.merge()`.

**Modificar** `data/repository/ConfigVideoRepository.kt`:

```kotlin
/** Lo que hay guardado de un periodo; null en un campo = nunca se eligió. */
data class ConfigVideoGuardada(val paletaId: String?, val estiloId: String?)

/** Config lista para usar: ids ya resueltos con sus fallbacks. */
data class ConfigVideoResuelta(val paleta: Paleta, val estilo: EstiloVideo) {
    companion object {
        fun desde(guardada: ConfigVideoGuardada?) = ConfigVideoResuelta(
            paleta = Paletas.porIdVideo(guardada?.paletaId),
            estilo = EstilosVideo.porId(guardada?.estiloId)
        )
    }
}
```

- `observarTodas(): Flow<Map<String, ConfigVideoGuardada>>`: por cada documento,
  `ConfigVideoGuardada(doc.getString("paletaId"), doc.getString("estiloId"))`. **Ya no se filtran**
  los documentos sin `paletaId` (un periodo con solo estilo es válido).
- `suspend fun configDe(rangoInicio: String): ConfigVideoResuelta`: **una sola lectura** del
  documento; ante cualquier error o documento ausente, `ConfigVideoResuelta.desde(null)`.
  Reemplaza a `paletaDe`.
- `suspend fun guardarPaleta(rangoInicio, paletaId)` y `guardarEstilo(rangoInicio, estiloId)`:
  `configs.document(rangoInicio).set(mapOf("campo" to valor), SetOptions.merge()).await()`.
  Reemplazan a `guardar`.
- `ConfigVideoPeriodo.kt`: añadir `val estiloId: String = ""` y actualizar su KDoc.
- `firestore.rules` ya permite escribir cualquier campo en `configVideo/{doc}` al entrenador:
  **no hay que desplegar reglas**.

**Test** (`ConfigVideoResueltaTest.kt`, en `app/src/test/.../data/repository/`):
`desde(null)` → `aqua_noche` + `BLOBS`; `desde(ConfigVideoGuardada("atardecer", null))` →
atardecer + `BLOBS`; `desde(ConfigVideoGuardada(null, "mancu"))` → `aqua_noche` + `MANCU`;
ids desconocidos → defaults.

**Buscar y actualizar** todos los usos de `paletaDe`, `guardar` y `observarTodas`
(`ResumenVideoGenerator`, `ConfigVideoViewModel`): `grep -rn "paletaDe\|configVideoRepository" app/src`.

### Tarea 3: textos compartidos entre estilos

El texto de cada escena hoy vive dentro de `ResumenFrameRenderer.bloquesPara` mezclado con
posiciones y colores del estilo oscuro. Extraer **solo la redacción** a un objeto puro.

**Crear** `video/TextosEscena.kt` (puro, sin Android) con las frases hoy escritas en
`ResumenFrameRenderer.kt` (`determinante`, `comparacion`, `mensajeDiaFavorito` y las frases de
Saludo, Asistencia, Tiempo, Racha, Medalla, Logros y Despedida: líneas ~288–411). Ejemplos de
firmas:

```kotlin
internal object TextosEscena {
    const val SALUDO_PREFIJO = "Hola, "
    const val DESPEDIDA = "Gracias por confiar en nosotros"
    fun determinante(unidad: String, mayuscula: Boolean = false): String
    fun asistenciaPrefijo(e: EscenaResumen.Asistencia): String   // "Esta quincena asististe "
    fun asistenciaDias(e: EscenaResumen.Asistencia): String      // "9 días"
    fun asistenciaSufijo(e: EscenaResumen.Asistencia): String    // " de 10 días hábiles"
    fun tiempoDuracion(minutos: Int): String                     // "2h 5min"
    fun comparacion(ranking: RankingResultado, fraseVasPrimero: String, etiquetaLugar: String): String
    fun mensajeDiaFavorito(t: EscenaResumen.DiaFavorito): String
    // + constantes: "Estuviste en el poderoso Focus un total de", "Tu racha más larga fue de",
    //   "¡Felicidades! Te ganaste:", "Y contra ti mismo, lograste:", títulos de sección, etc.
}
```

`ResumenFrameRenderer.bloquesPara` pasa a llamar a `TextosEscena` en lugar de tener las cadenas
inline. **Mismo texto, byte a byte.** Es el único cambio permitido en el renderer de blobs.

**Test** `TextosEscenaTest.kt`: una aserción por frase con su resultado exacto actual (incluye
"vas primero" vs "solamente detrás de: A, B", mes vs quincena en el determinante, y los tres
casos de `mensajeDiaFavorito`).

### Tarea 4: interfaz `RendererVideo` y el renderer de blobs envuelto

**Crear** `video/RendererVideo.kt`:

```kotlin
interface RendererVideo {
    /** Pinta el frame de [tiempoMs]. Una instancia por generación; no compartir entre videos. */
    fun dibujarFrame(canvas: Canvas, timeline: TimelineResumen, tiempoMs: Long)
}
```

**Crear** `video/RendererBlobs.kt`:

```kotlin
class RendererBlobs(private val paleta: Paleta) : RendererVideo {
    private val fondo = FondoBlobRenderer(paleta)   // un fondo por generación, como hoy
    override fun dibujarFrame(canvas: Canvas, timeline: TimelineResumen, tiempoMs: Long) {
        ResumenFrameRenderer.dibujarFrame(canvas, timeline, fondo, tiempoMs, paleta)
    }
}
```

`ResumenFrameRenderer` **no cambia** (sigue siendo `object`, sus funciones `internal` siguen
siendo llamadas por `MedallaAnimacionTest`).

**Crear** `video/FabricaRendererVideo.kt`:

```kotlin
internal object FabricaRendererVideo {
    fun crear(estilo: EstiloVideo, paleta: Paleta, context: Context): RendererVideo = when (estilo.id) {
        EstilosVideo.MANCU.id -> TODO("etapa 2") // hasta entonces, devolver RendererBlobs(paleta)
        else -> RendererBlobs(paleta)
    }
}
```

En la etapa 0, `MANCU` también devuelve `RendererBlobs(paleta)` (nada de `TODO()` que crashee:
un periodo con `mancu` guardado antes de tiempo no debe romper la generación).

### Tarea 5: el generador elige el renderer

**Modificar** `ResumenVideoGenerator.generarYCompartir` (líneas ~81–98):

```kotlin
val config = AppContainer.configVideoRepository.configDe(resumen.rango.inicio.toString())
val estilo = EstilosVideo.paraResumen(resumen.rango.tipo, config.estilo)
val renderer = FabricaRendererVideo.crear(estilo, config.paleta, context)
...
) { canvas, tiempoMs -> renderer.dibujarFrame(canvas, timeline, tiempoMs) }
```

Borrar el `val fondo = FondoBlobRenderer(paleta)` y la llamada directa. **Una lectura** de
Firestore por video, igual que hoy.

### Checkpoint 0 — ¿sigue todo igual?

`./gradlew testDebugUnitTest` verde **con los tests existentes sin tocar**. Instalar en el
celular y generar un resumen quincenal de un cliente: **debe verse idéntico al de antes**
(mismos blobs, mismos textos). Qué mirar: nada nuevo; solo que no se rompió. Commit de la etapa.

---

# Etapa 1 — Selector de estilo por quincena

### Tarea 6: ViewModel

**Modificar** `ui/configvideo/ConfigVideoViewModel.kt`:
- `PeriodoConPaleta` → `PeriodoConConfig(rangoInicio, encabezado, paleta, estilo, esActual)`.
- `periodos` se arma con `ConfigVideoResuelta.desde(mapa[rangoInicio])`.
- `asignarPaleta(rangoInicio, paletaId)` → `repositorio.guardarPaleta`; nuevo
  `asignarEstilo(rangoInicio, estiloId)` → `repositorio.guardarEstilo`.

### Tarea 7: pantalla

**Modificar** `ui/configvideo/ConfigVideoScreen.kt`:
- Cada renglón muestra `estilo.nombre`; si `estilo.usaPaleta`, también el nombre de la paleta y
  sus muestras (`MuestrasPaletaVideo`); si no, un texto "Colores propios del estilo".
- El diálogo se divide en dos secciones: **Estilo** (radio por cada `EstilosVideo.disponibles`,
  con su descripción) y, **solo si el estilo elegido `usaPaleta`**, **Paleta** (la lista actual).
  Elegir un radio guarda en el acto (como hoy); el diálogo ya no se cierra al elegir estilo para
  que se pueda elegir paleta después; "Cerrar" lo cierra.
- Cambiar el texto de ayuda: "El estilo y la paleta aplican a todos los videos quincenales de esa
  quincena. La música sigue siendo de cada cliente."
- La paleta guardada no se borra al pasar a Mancu: si vuelve a Blobs, reaparece.

### Checkpoint 1 — selector

Instalar, abrir Configuración de video: elegir `Mancu` en una quincena, cerrar y reabrir la app
(debe recordarlo), volver a `Blobs` (la paleta anterior sigue ahí). Generar un video con `Mancu`
seleccionado: todavía sale con blobs (la fábrica aún no tiene Mancu); no debe fallar. Commit.

---

# Etapa 2 — Mancu: fuentes, mascota, fondo y Saludo

### Tarea 8: fuentes

Descargar a `app/src/main/res/font/` (nombres en minúscula con guion bajo, requisito de Android):

```bash
BASE=https://raw.githubusercontent.com/google/fonts/main/ofl
curl -L $BASE/lilitaone/LilitaOne-Regular.ttf   -o app/src/main/res/font/lilita_one.ttf
curl -L $BASE/patrickhand/PatrickHand-Regular.ttf -o app/src/main/res/font/patrick_hand.ttf
mkdir -p docs/licencias && curl -L $BASE/lilitaone/OFL.txt -o docs/licencias/LilitaOne-OFL.txt \
  && curl -L $BASE/patrickhand/OFL.txt -o docs/licencias/PatrickHand-OFL.txt
```

(Las URLs ya se comprobaron: responden 200. Licencia OFL: se puede incluir en la app; guardar los
textos de licencia.) Cargarlas **una vez por generación**, no por frame:

```kotlin
internal class TipografiasMancu(context: Context) {
    val titulo: Typeface = ResourcesCompat.getFont(context, R.font.lilita_one) ?: Typeface.DEFAULT_BOLD
    val mano: Typeface = ResourcesCompat.getFont(context, R.font.patrick_hand) ?: Typeface.DEFAULT
}
```

### Tarea 9: animación pura de Mancu (testeable)

**Crear** `video/MancuAnimacion.kt` — funciones puras, sin Android:

- `reboteY(tMs: Long): Float` → -1..1 con periodo 1400 ms (respiración; amplitud real = 5 unidades).
- `factorParpadeo(tMs: Long): Float` → 1 casi siempre; en cada ciclo de 3600 ms, entre el 92% y el
  98% baja a 0.1 y vuelve (parpadeo triangular).
- `saltoEntrada(elapsedMs: Long): Float` → desplazamiento vertical 0..1 de una entrada con rebote
  (cae, rebota una vez, se asienta). Reusar `ResumenFrameRenderer.oscilacionAmortiguada` no es
  posible (es `private`); copiar la fórmula a esta clase o volverla `internal` sin cambiarla.
- `squash(elapsedMs: Long): Pair<Float, Float>` → escala (x, y) de aplastar y estirar, volumen
  conservado (x·y ≈ 1).

**Test** `MancuAnimacionTest.kt`: periodicidad de `reboteY`; `factorParpadeo` vale 1 fuera de la
ventana y < 0.2 en el centro de la ventana; `saltoEntrada(0)` ≠ `saltoEntrada(fin)` y termina
quieto en 0; `squash` conserva volumen en varios instantes.

### Tarea 10: dibujo de Mancu en Canvas

**Crear** `video/MancuDibujo.kt` — **clase** (guarda sus `Paint` y `Path` reutilizables). Porta la
función `clasico` + `cara` + `piernas` + `brazos` + `disco` del prototipo. Trabaja en el espacio de
**200×200** y se escala al destino con `canvas.translate/scale`. Geometría y colores: tabla de la
spec.

```kotlin
data class PoseMancu(
    val brazos: Brazos,        // HOLA, ORGULLO, ESFUERZO
    val ojos: Ojos,            // NORMAL, FELIZ, FUERZA, LADO (curioso)
    val boca: Boca,            // SONRISA, ABIERTA, DIENTES, O
    val salto: Boolean = false,
    val sudor: Boolean = false,
    val confeti: Boolean = false
)

class MancuDibujo {
    /** Dibuja a Mancu con su esquina superior izquierda en (x, y) y [tamano] px de lado. */
    fun dibujar(canvas: Canvas, x: Float, y: Float, tamano: Float, pose: PoseMancu, tMs: Long, alpha: Float = 1f)
}
```

Notas de implementación:
- Mangueras de brazos y piernas: `Path.moveTo + quadTo`, `Paint` de trazo con `StrokeCap.ROUND`,
  grosor 7 (unidades). Los puntos de cada pose están en el prototipo: `piernas(p)` y `brazos(p)`.
- Texto "20 KG": `canvas.drawTextOnPath("20 KG", arco, 0f, 0f, paint)` con un `Path` de arco
  (`addArc` en el rect de radio 50 centrado en (100, 88), barrido por la parte inferior de
  izquierda a derecha), centrado calculando el ancho del texto con `paint.measureText`. Tipografía
  `TipografiasMancu.titulo`, tamaño 15 unidades, interletraje 2.5 (`letterSpacing`).
- Parpadeo: escalar el `ry` de los ojos por `MancuAnimacion.factorParpadeo(tMs)`.
- Rebote: trasladar el cuerpo `reboteY(tMs) * 5` (la sombra del piso no se mueve).
- **Sin nariz ni agujero central** (decisión del trainer).
- `alpha`: usar `canvas.saveLayerAlpha(...)` al principio y `restore` al final cuando `alpha < 1`.
- **No crear objetos dentro de `dibujar`**: los `Paint` y `Path` son campos; `Path.reset()` antes
  de reutilizar.

### Tarea 11: fondo de papel con sol

**Crear** `video/FondoPapelRenderer.kt` — **clase** por generación:
- Color base `#F3E7C9`; viñeta suave hacia `#EADBB3` en los bordes (un `RadialGradient`
  precreado).
- Textura de papel: un `Bitmap` de **256×256** con ruido muy sutil generado una vez en el
  constructor y pintado con `BitmapShader` en `TileMode.REPEAT` (no un bitmap de 1080×1920).
- Sol: círculo `#F7D774` de ~90% del ancho, centrado detrás de Mancu, con una "respiración" lenta
  (±2% de radio con `sin`); opacidad 85%.
- `dibujar(canvas, ancho, alto, tMs)`.

### Tarea 12: `RendererMancu` y la escena de Saludo

**Crear** `video/RendererMancu.kt`:

```kotlin
class RendererMancu(context: Context) : RendererVideo {
    private val tipografias = TipografiasMancu(context)
    private val fondo = FondoPapelRenderer()
    private val mancu = MancuDibujo(tipografias)
    override fun dibujarFrame(canvas: Canvas, timeline: TimelineResumen, tiempoMs: Long) { ... }
}
```

- `dibujarFrame` replica la **lógica de tramos** de `ResumenFrameRenderer.dibujarFrame`
  (`tramoActivo`, `tramoEntrante`, `alphaEntrante`, `elapsedEnTramo`): fondo + escena activa y,
  durante la ventana de 600 ms, la entrante. En esta etapa el cambio entre escenas es un
  crossfade simple por alpha (la nube llega en la etapa 4).
- `dibujarEscena(canvas, escena, elapsedMs, alpha)` hace `when (escena)`:
  - `Saludo` → **implementada** (ver abajo).
  - **Todas las demás → escena provisional**: el nombre de la escena en Lilita One sobre el papel
    + Mancu en pose `NORMAL`/`SONRISA` con su rebote. Es lo que permite generar un video
    completo en cada checkpoint aunque falten escenas. Cada tarea posterior reemplaza una rama.
- **Saludo:** misma frase ("Hola, <nombre>") de `TextosEscena`, en Lilita One ~120 px, con el
  nombre en rojo `#D9412B` y contorno/sombra dura de tinta `#1B1512`; etiqueta pequeña arriba en
  Patrick Hand con el rango si está disponible (si `EscenaResumen.Saludo` no lo trae, omitirla; no
  cambiar el modelo); Mancu entra con `saltoEntrada` y `squash`, pose `HOLA` (saluda), parpadea y
  rebota. Máquina de escribir con `MaquinaEscribir.textoVisible` a la misma velocidad que hoy
  (`2_000 ms` para el saludo).

**Conectar** en `FabricaRendererVideo`: `EstilosVideo.MANCU.id -> RendererMancu(context)`.

**Tests puros posibles:** ninguno nuevo (todo lo visual); la lógica de tramos ya está cubierta por
`TimelineResumenTest`.

### Checkpoint 2 — primer video Mancu en el celular

Instalar, poner la quincena actual en `Mancu`, generar el quincenal. **Qué mirar:**
1. ¿Mancu se reconoce como el diseño aprobado? (proporciones, grises, cara, brazos, piernas)
2. ¿El Saludo se siente "dibujado a mano"? Tipografía, contorno, color del nombre, entrada.
3. ¿El papel y el sol se ven bien en pantalla del teléfono, o la textura se nota demasiado/poco?
4. ¿Las escenas provisionales no se rompen y el video completo termina y se comparte?
5. Tiempo de generación vs. `blobs`.

Es el checkpoint más importante: aquí se ajusta el **look** (tamaño de Mancu, grosor de línea,
colores, tipografía) antes de invertir en las otras siete escenas. Commit de la etapa.

---

# Etapa 3 — Resto de escenas de Mancu (un checkpoint por grupo)

Cada escena reemplaza su rama provisional en `RendererMancu.dibujarEscena`, **con los mismos
textos** (`TextosEscena`), los **mismos tiempos de aparición** que hoy (ver `bloquesPara` y las
constantes de `ResumenFrameRenderer`) y la misma duración de `TimelineResumen`. Tamaños y
posiciones iniciales son una propuesta; se afinan viendo el video.

### Tarea 13: Asistencia, Despedida
- **Asistencia:** etiqueta del rango (Patrick Hand, marrón `#5A4A40`), frase con "N días" como
  número destacado en Lilita One rojo con contorno y sombra dura; Mancu sostiene el número y lo
  aplasta (`squash`) al aparecer. Pose `ORGULLO` si `ranking.puesto == 1`, si no `HOLA`.
- **Despedida:** "Gracias por confiar en nosotros" con la velocidad de máquina de escribir del
  saludo (`2_000/13` ms por carácter); Mancu se despide (pose `HOLA`) y camina hacia fuera de
  cuadro al final.

### Tarea 14: Tiempo (gráfica de línea)
- Textos: "Estuviste en el poderoso Focus un total de" + `tiempoDuracion` + línea de ranking.
- La **gráfica** de `PuntoTiempoDiario` se redibuja en estilo papel: ejes y etiquetas en tinta,
  trazo rojo grueso con terminación redonda y puntos solo en días con asistencia, ejes Y con las
  referencias fijas 60 y 120 min (misma regla que hoy: `REFERENCIAS_EJE_MINUTOS`), etiquetas de
  fecha `dd/MM` verticales. Aparece a los 3 400 ms con fade de 600 ms, como hoy.
- Mancu en pose `LADO`/curioso a un costado, mirando la gráfica. Los promedios para días
  asistidos sin tiempo (commit `fc71c3e`) ya vienen en los datos; no recalcular.

### Tarea 15: Día favorito (dona) y Racha
- **Dona** de `ConteoDiaRutina`: rebanadas con colores del estilo (rojo, naranja, amarillo y
  grises cálidos; **no** la paleta pastel del video oscuro), contorno de tinta, etiquetas con
  flecha como hoy (`dibujarFlechaEtiqueta`: regla de partir nombres largos en 2 renglones,
  `DONA_LARGO_MAXIMO_UNA_LINEA = 12`). Aparece a los 2 400 ms con fade de 500 ms. Mancu señala la
  rebanada mayor con el brazo.
- **Racha:** textos "Tu racha más larga fue de" / "N días seguidos" / ranking. Mancu en pose
  `ESFUERZO` (sudor, sentadillas con `squash` periódico).

### Tarea 16: Medalla y Logros personales (imágenes propias)
- **Medalla:** conservar **exactamente la coreografía temporal**: título a 0 ms, "¡Felicidades!"
  a 500 ms, la insignia aterriza a `MEDALLA_INICIO_GRUPAL_MS` (3 300 ms) y el mensaje se escribe
  desde `MENSAJE_MEDALLA_INICIO_MS` (5 900 ms) durante 2 000 ms. Reusar las funciones `internal`
  de `ResumenFrameRenderer` (`escalaEntrada`, `opacidadEntrada`, `rotacionEntrada`,
  `ondaExpansiva`, `intensidadDestello`) para la animación de aterrizaje; no duplicar la lógica.
  Mancu "se pone la medalla" (la insignia aterriza sobre/junto a él) y celebra (`ORGULLO`,
  confeti). La imagen propia de la medalla (`imagenPersonalizada`) se dibuja igual de grande que
  hoy y legible sobre el papel; sin imagen, usar la insignia por categoría
  (`COLOR_INSIGNIA_MEDALLA`, función `dibujarInsignia`).
- **Sin medalla** (`nombre == null`): solo el mensaje de consuelo, con Mancu.
- **Logros personales (1–3 por escena):** título de sección, "Y contra ti mismo, lograste:",
  insignias en cascada con su nombre y mensaje (mensaje solo si hay un único logro), usando el
  mismo reparto de posiciones que hoy (`posicionesLogros`). Mancu acompaña.
- Reusar `EncajeInsignia`/`InsigniaImagenUtil` ya existentes para encajar las imágenes.

### Checkpoint 3 (tras tareas 13–16, o uno por tarea si el trainer prefiere)
Generar videos con: un cliente con medalla y logros, uno **sin** medalla, uno con 2–3 logros, uno
sin asistencia. **Qué mirar:** textos idénticos a los de blobs; nada se corta ni se sale de
pantalla con nombres largos; las imágenes propias de medalla y logros se leen bien sobre el papel;
la gráfica y la dona son legibles; los tiempos de cada escena se sienten igual. Commit por tarea.

---

# Etapa 4 — Transición de nube entre escenas

### Tarea 17
Reemplazar el crossfade simple de `RendererMancu` por una **nube de caricatura** que tapa la
pantalla en la primera mitad de la ventana de 600 ms y la destapa en la segunda; el cambio de
escena ocurre cuando está tapada.

- **Lógica pura** (testeable) en `MancuAnimacion.kt`: `fun progresoNube(alphaEntrante: Float):
  Float` (0→1→0, máximo cuando `alphaEntrante == 0.5`) y `fun escenaVisibleEsEntrante(alphaEntrante:
  Float): Boolean = alphaEntrante >= 0.5f`. Test de ambas en `MancuAnimacionTest`.
- Dibujo: 8–12 círculos de contorno de tinta y relleno crema/blanco que crecen desde posiciones
  fijas (arreglo precalculado) hasta cubrir 1080×1920; puede asomar una ráfaga amarilla/roja en el
  centro en el punto de máxima cobertura. Sin partículas ni objetos nuevos por frame.
- La ventana de 600 ms y las duraciones de `TimelineResumen` **no cambian**.

### Checkpoint 4
Video completo con transiciones. **Qué mirar:** ¿la nube se siente fluida o brusca a 30 fps?,
¿tapa del todo antes del cambio?, ¿distrae del contenido? Último ajuste de ritmo y de look.

---

# Etapa 5 — Cierre

### Tarea 18
- `./gradlew testDebugUnitTest` completo en verde.
- Revisar que el estilo `blobs` sigue idéntico (generar uno y compararlo con un video previo).
- Probar: periodo sin configurar (→ blobs), documento viejo con solo `paletaId` (→ blobs, misma
  paleta), documento con `estiloId` desconocido (→ blobs), resumen **mensual y semanal** con la
  quincena en Mancu (→ siguen en blobs), y el flujo de **publicar en la web** (usa el mismo mp4).
- Actualizar `AGENTS.md`/`README.md` solo si mencionan el video; sugerir
  `/graphify . --update`.

---

## Riesgos y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| El dibujo de Mancu en Canvas no se parece al prototipo | Checkpoint 2 es solo de look; se ajusta antes de hacer más escenas. El prototipo HTML es la referencia. |
| Generación lenta por textura y trazos | Textura en tile 256×256, `Paint`/`Path` reutilizados, medir en cada checkpoint (≤ ~1.5× blobs). |
| Texto de medalla/logros ilegible sobre papel | Se verifica en checkpoint 3 con imágenes reales de medalla y logros. |
| Pisar paleta al guardar estilo | `SetOptions.merge()` + test de `ConfigVideoResuelta` (tarea 2). |
| Mensual/semanal heredando un estilo por coincidencia de fecha | `EstilosVideo.paraResumen` solo permite estilo en quincenal (tarea 1). |
| Romper blobs al extraer textos | Único cambio en el renderer oscuro; `TextosEscenaTest` fija las frases y los tests existentes deben seguir verdes. |

## Fuera de alcance

Cambiar datos/orden/duraciones de las escenas; música (`CancionUtil`); estilo por cliente;
estilos adicionales; paleta de la clienta en Mancu; modificar el aspecto de `blobs`.
