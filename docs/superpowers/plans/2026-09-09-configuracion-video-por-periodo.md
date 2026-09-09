# Configuración de video por periodo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el entrenador elija, por quincena, una paleta de color (blobs de fondo + texto destacado) que aplica a todos los videos de resumen de ese periodo, y que los blobs se vean más chicos y definidos.

**Architecture:** Los presets de paleta son código (`PaletaVideo` / `PaletasVideo`); Firestore sólo guarda qué preset usa cada periodo, en `configVideo/{rangoInicio}`. La paleta viaja por parámetro desde `ResumenVideoGenerator` hasta `BlobsGeometria` y `ResumenFrameRenderer` — nunca como estado mutable de un `object`, porque dos generaciones de video pueden solaparse. Una pantalla nueva en el drawer lista quincenas calculadas del calendario y asigna preset a cada una.

**Tech Stack:** Kotlin, Jetpack Compose (Material 3), Firebase Firestore, Navigation Compose, JUnit 4.

**Spec:** `docs/superpowers/specs/2026-09-09-configuracion-video-por-periodo-design.md`

## Global Constraints

- Los colores de blob se guardan **con alfa incluida** (`0xB3……`, ~70%). El alfa es parte del color, no del renderer.
- La primera paleta de `PaletasVideo.disponibles` es `aqua_noche` y **reproduce exactamente los colores actuales**: magenta `0xB37B1575`, cian `0xB3157B7B`, púrpura `0xB34C157B`, destacado `0xFF00E6A8`. Un periodo sin configurar debe producir un video idéntico al de hoy.
- La paleta **nunca** se guarda como campo mutable de `ResumenFrameRenderer` (es un `object`) ni de `BlobsGeometria` (es un `object`). Siempre viaja por parámetro. Guardarla en `FondoBlobRenderer` sí es válido: es una clase, con una instancia por generación.
- `DONA_PALETA_PASTEL` y `COLOR_INSIGNIA_MEDALLA` en `ResumenFrameRenderer` **no se tocan**: quedan fuera del alcance del preset.
- El identificador de periodo es `rangoInicio`: la fecha ISO de inicio de quincena (`"2026-09-01"`), el mismo string que ya usan `MedallaOtorgada` y `LogroPersonalOtorgado`.
- Los tests unitarios corren con `./gradlew.bat :app:testDebugUnitTest`. La compilación se verifica con `./gradlew.bat :app:compileDebugKotlin`.
- Idioma del código: nombres, comentarios y textos de UI en español, como el resto del proyecto.
- No hay tests de repositorios de Firestore en este proyecto (no hay mocking de Firestore configurado). La lógica que deba testearse va en funciones puras fuera del repositorio.

---

### Task 1: Presets de paleta

Crea el modelo de paleta y la lista de presets. Es pura lógica de datos, sin Android, así que se testea directo.

**Files:**
- Create: `app/src/main/java/com/osfit/app/video/PaletaVideo.kt`
- Create: `app/src/test/java/com/osfit/app/video/PaletasVideoTest.kt`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces:
  - `data class PaletaVideo(val id: String, val nombre: String, val blobA: Int, val blobB: Int, val blobC: Int, val destacado: Int)`
  - `object PaletasVideo` con `val disponibles: List<PaletaVideo>`, `val porDefecto: PaletaVideo`, `fun porId(id: String?): PaletaVideo`

- [x] **Step 1: Write the failing test**

Crear `app/src/test/java/com/osfit/app/video/PaletasVideoTest.kt`:

```kotlin
package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PaletasVideoTest {

    /** Garantía de que la app sin configurar sigue generando el video de siempre: si alguien
     *  cambia estos colores, todos los periodos sin paleta asignada cambian de aspecto. */
    @Test
    fun `la paleta por defecto conserva los colores actuales del video`() {
        val defecto = PaletasVideo.porDefecto
        assertEquals("aqua_noche", defecto.id)
        assertEquals(0xB37B1575.toInt(), defecto.blobA)
        assertEquals(0xB3157B7B.toInt(), defecto.blobB)
        assertEquals(0xB34C157B.toInt(), defecto.blobC)
        assertEquals(0xFF00E6A8.toInt(), defecto.destacado)
    }

    @Test
    fun `la paleta por defecto es la primera de la lista`() {
        assertEquals(PaletasVideo.porDefecto, PaletasVideo.disponibles.first())
    }

    @Test
    fun `porId devuelve la paleta pedida`() {
        PaletasVideo.disponibles.forEach { paleta ->
            assertEquals(paleta, PaletasVideo.porId(paleta.id))
        }
    }

    /** Un periodo puede tener guardado el id de un preset que después se quitó del código, y
     *  un periodo nunca configurado no tiene id: ninguno de los dos casos debe romper. */
    @Test
    fun `porId cae en la paleta por defecto ante null, vacio o desconocido`() {
        assertEquals(PaletasVideo.porDefecto, PaletasVideo.porId(null))
        assertEquals(PaletasVideo.porDefecto, PaletasVideo.porId(""))
        assertEquals(PaletasVideo.porDefecto, PaletasVideo.porId("preset_que_ya_no_existe"))
    }

    @Test
    fun `los ids de los presets son unicos`() {
        val ids = PaletasVideo.disponibles.map { it.id }
        assertEquals(ids.size, ids.toSet().size)
    }

    @Test
    fun `hay al menos cinco presets y todos tienen nombre`() {
        assertTrue(PaletasVideo.disponibles.size >= 5)
        PaletasVideo.disponibles.forEach { assertTrue(it.nombre.isNotBlank()) }
    }

    /** Los tres blobs de una paleta tienen que distinguirse entre sí: si dos son iguales el
     *  fondo pierde profundidad. */
    @Test
    fun `cada paleta tiene tres matices de blob distintos`() {
        PaletasVideo.disponibles.forEach { paleta ->
            assertNotEquals(paleta.blobA, paleta.blobB)
            assertNotEquals(paleta.blobB, paleta.blobC)
            assertNotEquals(paleta.blobA, paleta.blobC)
        }
    }

    /** El destacado se pinta opaco sobre el fondo: es el dato que el cliente tiene que leer. */
    @Test
    fun `el color destacado de toda paleta es completamente opaco`() {
        PaletasVideo.disponibles.forEach { paleta ->
            assertEquals(0xFF, (paleta.destacado ushr 24) and 0xFF)
        }
    }

    /** Los blobs son fondo, no protagonistas: van semitransparentes. */
    @Test
    fun `los blobs de toda paleta son semitransparentes`() {
        PaletasVideo.disponibles.forEach { paleta ->
            listOf(paleta.blobA, paleta.blobB, paleta.blobC).forEach { color ->
                val alfa = (color ushr 24) and 0xFF
                assertTrue("alfa fuera de rango en ${paleta.id}: $alfa", alfa in 0x60..0xC0)
            }
        }
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `./gradlew.bat :app:testDebugUnitTest --tests "com.osfit.app.video.PaletasVideoTest"`

Expected: FAIL — no compila, `PaletasVideo` / `PaletaVideo` no existen (`Unresolved reference`).

- [x] **Step 3: Write minimal implementation**

Crear `app/src/main/java/com/osfit/app/video/PaletaVideo.kt`:

```kotlin
package com.osfit.app.video

/**
 * Paleta de color de un video de resumen: los tres matices del fondo y el color del dato
 * destacado. Los presets son código, no datos — en Firestore sólo se guarda qué [id] usa
 * cada periodo (ver ConfigVideoRepository).
 *
 * Los colores de blob llevan su alfa incluida (~70%): la transparencia parcial es lo que los
 * mantiene como fondo y no como protagonistas, así que es propiedad del color, no del
 * renderer. El [destacado], en cambio, va opaco: es el dato que el cliente tiene que leer.
 *
 * Son tres matices y no cuatro aunque haya cuatro blobs en pantalla: el primero y el cuarto
 * comparten matiz (ver BlobsGeometria), y esa repetición es parte de la composición.
 */
data class PaletaVideo(
    val id: String,
    val nombre: String,
    val blobA: Int,
    val blobB: Int,
    val blobC: Int,
    val destacado: Int
)

object PaletasVideo {

    /** Los colores originales del video, antes de que las paletas existieran. Es la paleta que
     *  usa todo periodo sin configurar, así que la app sin tocar nada se ve igual que siempre. */
    private val AQUA_NOCHE = PaletaVideo(
        id = "aqua_noche",
        nombre = "Aqua noche",
        blobA = 0xB37B1575.toInt(),
        blobB = 0xB3157B7B.toInt(),
        blobC = 0xB34C157B.toInt(),
        destacado = 0xFF00E6A8.toInt()
    )

    private val ATARDECER = PaletaVideo(
        id = "atardecer",
        nombre = "Atardecer",
        blobA = 0xB3B35A15.toInt(),
        blobB = 0xB3B33A2E.toInt(),
        blobC = 0xB37B1F3A.toInt(),
        destacado = 0xFFFFC24D.toInt()
    )

    private val BOSQUE = PaletaVideo(
        id = "bosque",
        nombre = "Bosque",
        blobA = 0xB3156B3A.toInt(),
        blobB = 0xB3556B15.toInt(),
        blobC = 0xB3157B6B.toInt(),
        destacado = 0xFFB6E62E.toInt()
    )

    private val ULTRAVIOLETA = PaletaVideo(
        id = "ultravioleta",
        nombre = "Ultravioleta",
        blobA = 0xB32E1F8A.toInt(),
        blobB = 0xB35E15A0.toInt(),
        blobC = 0xB3A0157B.toInt(),
        destacado = 0xFF3DE0FF.toInt()
    )

    private val BRASA = PaletaVideo(
        id = "brasa",
        nombre = "Brasa",
        blobA = 0xB38A1F15.toInt(),
        blobB = 0xB3B36A15.toInt(),
        blobC = 0xB35A2A15.toInt(),
        destacado = 0xFFFFD93D.toInt()
    )

    val disponibles: List<PaletaVideo> = listOf(AQUA_NOCHE, ATARDECER, BOSQUE, ULTRAVIOLETA, BRASA)

    val porDefecto: PaletaVideo = AQUA_NOCHE

    /** Tolera ids nulos, vacíos y desconocidos: un periodo puede no estar configurado, o tener
     *  guardado un preset que después se quitó del código. */
    fun porId(id: String?): PaletaVideo =
        disponibles.firstOrNull { it.id == id } ?: porDefecto
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `./gradlew.bat :app:testDebugUnitTest --tests "com.osfit.app.video.PaletasVideoTest"`

Expected: PASS, 9 tests.

- [x] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/PaletaVideo.kt app/src/test/java/com/osfit/app/video/PaletasVideoTest.kt
git commit -m "feat: add the video color palette presets"
```

---

### Task 2: Blobs con color inyectado, más chicos y más definidos

`BlobsGeometria.blobs` deja de ser una lista constante y pasa a ser función de la paleta. En el mismo paso se ajustan radios y blur. Van juntos porque ambos tocan los mismos dos archivos y su verificación visual es la misma.

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/BlobsGeometria.kt`
- Modify: `app/src/main/java/com/osfit/app/video/FondoBlobRenderer.kt`
- Test: `app/src/test/java/com/osfit/app/video/BlobsGeometriaTest.kt`

**Interfaces:**
- Consumes: `PaletaVideo`, `PaletasVideo.porDefecto` (Task 1).
- Produces:
  - `BlobsGeometria.blobs(paleta: PaletaVideo): List<BlobSpec>` — reemplaza a `BlobsGeometria.blobs`, que deja de existir.
  - `BlobsGeometria.posicionEn(blob, tiempoGlobalMs)` sigue igual.
  - `FondoBlobRenderer(paleta: PaletaVideo)` — el constructor pasa a tomar la paleta. `dibujar(canvas, ancho, alto, tiempoGlobalMs)` no cambia de firma.

- [x] **Step 1: Write the failing test**

Reemplazar el contenido completo de `app/src/test/java/com/osfit/app/video/BlobsGeometriaTest.kt`. Los dos primeros tests son los existentes adaptados a la firma nueva; el resto es cobertura nueva.

```kotlin
package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BlobsGeometriaTest {

    private val blobs = BlobsGeometria.blobs(PaletasVideo.porDefecto)

    @Test
    fun `posicionEn es determinista para el mismo tiempo`() {
        val blob = blobs.first()
        assertEquals(BlobsGeometria.posicionEn(blob, 12_345L), BlobsGeometria.posicionEn(blob, 12_345L))
    }

    @Test
    fun `posicionEn se mantiene dentro de la amplitud declarada del blob a lo largo de un periodo`() {
        val blob = blobs.first()
        var t = 0L
        while (t < blob.periodoMs) {
            val p = BlobsGeometria.posicionEn(blob, t)
            assertTrue(p.x in (blob.centroBaseX - blob.amplitudX - 0.001f)..(blob.centroBaseX + blob.amplitudX + 0.001f))
            assertTrue(p.y in (blob.centroBaseY - blob.amplitudY - 0.001f)..(blob.centroBaseY + blob.amplitudY + 0.001f))
            t += 250L
        }
    }

    @Test
    fun `hay al menos 4 blobs y tres matices distintos`() {
        assertTrue(blobs.size >= 4)
        assertEquals(3, blobs.map { it.colorArgb }.toSet().size)
    }

    /** El corazón del cambio: la geometría es una sola, los colores los pone la paleta. */
    @Test
    fun `los colores salen de la paleta recibida`() {
        val paleta = PaletasVideo.porId("atardecer")
        val colores = BlobsGeometria.blobs(paleta).map { it.colorArgb }.toSet()
        assertEquals(setOf(paleta.blobA, paleta.blobB, paleta.blobC), colores)
    }

    @Test
    fun `la geometria no depende de la paleta`() {
        PaletasVideo.disponibles.forEach { paleta ->
            val conPaleta = BlobsGeometria.blobs(paleta)
            assertEquals(blobs.size, conPaleta.size)
            conPaleta.forEachIndexed { i, blob ->
                val esperado = blobs[i]
                assertEquals(esperado.radio, blob.radio, 0f)
                assertEquals(esperado.centroBaseX, blob.centroBaseX, 0f)
                assertEquals(esperado.centroBaseY, blob.centroBaseY, 0f)
                assertEquals(esperado.amplitudX, blob.amplitudX, 0f)
                assertEquals(esperado.amplitudY, blob.amplitudY, 0f)
                assertEquals(esperado.periodoMs, blob.periodoMs)
                assertEquals(esperado.faseMs, blob.faseMs)
            }
        }
    }

    /** Los blobs se achicaron a propósito (antes 0.24..0.34): este test es lo que evita que
     *  alguien los devuelva al tamaño viejo sin darse cuenta. */
    @Test
    fun `los blobs son mas chicos que el diseno original`() {
        blobs.forEach { assertTrue("radio inesperado: ${it.radio}", it.radio <= 0.25f) }
    }

    /** Aun achicados siguen sin salirse del canvas al oscilar: centro ± amplitud ± radio. */
    @Test
    fun `ningun blob se aleja tanto del canvas como para desaparecer`() {
        blobs.forEach { blob ->
            assertTrue(blob.centroBaseX + blob.amplitudX - blob.radio < 1f)
            assertTrue(blob.centroBaseX - blob.amplitudX + blob.radio > 0f)
        }
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `./gradlew.bat :app:testDebugUnitTest --tests "com.osfit.app.video.BlobsGeometriaTest"`

Expected: FAIL — no compila: `blobs` sigue siendo `val`, no se puede invocar con un argumento.

- [x] **Step 3: Write minimal implementation**

En `app/src/main/java/com/osfit/app/video/BlobsGeometria.kt`, reemplazar el bloque de constantes de color y la `val blobs` (líneas 22–36, desde el comentario `// Tonos apagados…` hasta el cierre del `listOf`) por:

```kotlin
object BlobsGeometria {
    /**
     * Geometría fija de los cuatro blobs; los colores los pone [paleta]. El primero y el
     * cuarto comparten matiz a propósito: repetir un tono ata la composición.
     *
     * Los radios son deliberadamente chicos (~0.17..0.24 del ancho): junto con el blur más
     * corto de [FondoBlobRenderer], es lo que hace que el fondo se lea como formas y no como
     * una nube difusa.
     */
    fun blobs(paleta: PaletaVideo): List<BlobSpec> = listOf(
        BlobSpec(colorArgb = paleta.blobA, radio = 0.23f, centroBaseX = 0.28f, centroBaseY = 0.22f, amplitudX = 0.10f, amplitudY = 0.07f, periodoMs = 11_000L, faseMs = 0L),
        BlobSpec(colorArgb = paleta.blobB, radio = 0.21f, centroBaseX = 0.74f, centroBaseY = 0.40f, amplitudX = 0.08f, amplitudY = 0.12f, periodoMs = 13_500L, faseMs = 2_500L),
        BlobSpec(colorArgb = paleta.blobC, radio = 0.24f, centroBaseX = 0.42f, centroBaseY = 0.72f, amplitudX = 0.12f, amplitudY = 0.09f, periodoMs = 9_500L, faseMs = 5_000L),
        BlobSpec(colorArgb = paleta.blobA, radio = 0.17f, centroBaseX = 0.80f, centroBaseY = 0.85f, amplitudX = 0.09f, amplitudY = 0.10f, periodoMs = 15_000L, faseMs = 8_000L)
    )
```

El resto del `object` (`posicionEn` y el `data class BlobSpec` / `Punto` de arriba) queda intacto.

En `app/src/main/java/com/osfit/app/video/FondoBlobRenderer.kt`:

1. Cambiar la declaración de la clase para que tome la paleta:

```kotlin
class FondoBlobRenderer(private val paleta: PaletaVideo) {
```

2. Cambiar `RADIO_BLUR_PX` en el `companion object` de `80f` a `45f`, con el comentario que explica por qué:

```kotlin
        /** Blur corto a propósito: con radios chicos, desenfocar 80px devolvía los blobs a
         *  una nube sin forma. 45px deja el borde suave pero legible como figura. */
        const val RADIO_BLUR_PX = 45f
```

3. En `dibujar`, cambiar `BlobsGeometria.blobs.forEach` por `BlobsGeometria.blobs(paleta).forEach`.

- [x] **Step 4: Run test to verify it passes**

Run: `./gradlew.bat :app:testDebugUnitTest --tests "com.osfit.app.video.BlobsGeometriaTest"`

Expected: PASS, 7 tests.

Nota: `./gradlew.bat :app:compileDebugKotlin` todavía va a fallar en `ResumenVideoGenerator.kt` porque ahí se construye `FondoBlobRenderer()` sin argumento. Se arregla en la Task 5; no lo arregles acá con un valor por defecto en el constructor — la paleta debe venir siempre del periodo, y un default la haría fácil de olvidar.

- [x] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/BlobsGeometria.kt app/src/main/java/com/osfit/app/video/FondoBlobRenderer.kt app/src/test/java/com/osfit/app/video/BlobsGeometriaTest.kt
git commit -m "feat: take blob colors from a palette and make the blobs smaller and sharper"
```

---

### Task 3: El texto destacado sale de la paleta

`ResumenFrameRenderer` es un `object` y `DESTACADO` es una constante privada usada en ~12 sitios. La paleta entra por parámetro de `dibujarFrame` y baja a los helpers.

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt`

**Interfaces:**
- Consumes: `PaletaVideo` (Task 1), `FondoBlobRenderer(paleta)` (Task 2).
- Produces: `ResumenFrameRenderer.dibujarFrame(canvas, timeline, fondo, tiempoGlobalMs, paleta, ancho = ANCHO_DEFECTO, alto = ALTO_DEFECTO)` — `paleta: PaletaVideo` va después de `tiempoGlobalMs` y antes de los parámetros con valor por defecto.

- [x] **Step 1: Cambiar la firma de `dibujarFrame` y bajar la paleta**

No hay test unitario nuevo en esta tarea: `ResumenFrameRenderer` dibuja sobre un `android.graphics.Canvas` real, que no existe en tests JVM (es la razón por la que hoy no tiene test propio). La verificación es la compilación más el video real de la Task 7.

En `app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt`:

1. Borrar la constante `DESTACADO` (línea 48) y su comentario de las líneas 46-47. El color ahora vive en la paleta.

2. `dibujarFrame` (línea 172) toma la paleta y la baja a `dibujarEscena`:

```kotlin
    fun dibujarFrame(
        canvas: Canvas,
        timeline: TimelineResumen,
        fondo: FondoBlobRenderer,
        tiempoGlobalMs: Long,
        paleta: PaletaVideo,
        ancho: Int = ANCHO_DEFECTO,
        alto: Int = ALTO_DEFECTO
    ) {
```

y dentro, cada llamada a `dibujarEscena(canvas, ancho, ...)` pasa a `dibujarEscena(canvas, ancho, paleta, ...)` (son tres llamadas: dos en la rama con `entrante != null`, una en el `else`).

3. `dibujarEscena` (línea 194) recibe la paleta y la pasa a `bloquesPara` y a los tres helpers que la necesitan:

```kotlin
    private fun dibujarEscena(canvas: Canvas, ancho: Int, paleta: PaletaVideo, escena: EscenaResumen, elapsedMs: Long, alpha: Float) {
        bloquesPara(escena, paleta).forEach { bloque ->
```

y en el cuerpo:
- `dibujarGraficaTiempo(canvas, ancho, escena.tiempoPorDia, elapsedMs, alpha)` → `dibujarGraficaTiempo(canvas, ancho, paleta, escena.tiempoPorDia, elapsedMs, alpha)`
- `dibujarMedalla(canvas, ancho, escena, elapsedMs, alpha)` → `dibujarMedalla(canvas, ancho, paleta, escena, elapsedMs, alpha)`
- `dibujarLogrosPersonales(...)` → agregar `paleta` como tercer argumento, igual que los anteriores.
- `dibujarDonaDiasFavoritos(...)` **no cambia**: usa `DONA_PALETA_PASTEL`, que queda fuera del alcance del preset.

4. `bloquesPara` (línea 220) toma la paleta y cada `DESTACADO` de su cuerpo pasa a `paleta.destacado`:

```kotlin
    private fun bloquesPara(escena: EscenaResumen, paleta: PaletaVideo): List<BloqueTexto> = when (escena) {
```

Son ocho usos dentro de esta función (líneas ~227, 250, 252, 265, 292, 295, 296, 321 del archivo original). `VELOCIDAD_DESTACADO_MS_POR_CARACTER` (línea 51) **no** se toca: es una velocidad de animación, no un color, y su nombre sólo comparte la palabra.

5. `dibujarGraficaTiempo` (línea 447): agregar `paleta: PaletaVideo` como tercer parámetro (después de `ancho`) y cambiar los dos `color = DESTACADO` de su cuerpo (líneas ~511 y ~522) por `color = paleta.destacado`.

6. `dibujarMedalla` (línea 544): agregar `paleta: PaletaVideo` como tercer parámetro y cambiar el `color = DESTACADO` de su cuerpo (línea ~578) por `color = paleta.destacado`.

7. `dibujarLogrosPersonales` (línea 681): agregar `paleta: PaletaVideo` como tercer parámetro y cambiar el `color = DESTACADO` de su cuerpo (línea ~721) por `color = paleta.destacado`. El `colorInsignia = DONA_PALETA_PASTEL[...]` de la línea ~711 **no se toca**.

8. Actualizar los dos comentarios KDoc que mencionan `[DESTACADO]` (líneas ~440 y ~543) para que digan `el destacado de la paleta` en vez de referenciar la constante borrada — si no, el KDoc queda apuntando a un símbolo inexistente.

- [x] **Step 2: Verificar que ya no queda ningún uso de la constante**

Run: `grep -n "DESTACADO" app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt`

Expected: sólo dos líneas, ambas de `VELOCIDAD_DESTACADO_MS_POR_CARACTER` (su declaración y sus usos). Ninguna referencia a `DESTACADO` a secas.

- [x] **Step 3: Verificar que la dona quedó intacta**

Run: `grep -n "DONA_PALETA_PASTEL\|COLOR_INSIGNIA_MEDALLA" app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt`

Expected: los mismos usos que antes del cambio (declaraciones más los usos en `dibujarDonaDiasFavoritos`, `dibujarLogrosPersonales` y `dibujarMedalla`). Ninguno reemplazado por la paleta.

- [x] **Step 4: Commit**

`compileDebugKotlin` todavía falla en `ResumenVideoGenerator.kt` (no pasa `paleta` ni construye `FondoBlobRenderer` con argumento): se cierra en la Task 5. Commitear igual — el árbol queda coherente aunque no compile de punta a punta.

```bash
git add app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt
git commit -m "feat: take the highlight color from the video palette"
```

---

### Task 4: Persistencia de la paleta por periodo

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/ConfigVideoPeriodo.kt`
- Create: `app/src/main/java/com/osfit/app/data/repository/ConfigVideoRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/data/AppContainer.kt`

**Interfaces:**
- Consumes: `PaletaVideo`, `PaletasVideo.porId` (Task 1).
- Produces:
  - `data class ConfigVideoPeriodo(val rangoInicio: String = "", val paletaId: String = "")`
  - `class ConfigVideoRepository(db: FirebaseFirestore = FirebaseFirestore.getInstance())` con:
    - `fun observarTodas(): Flow<Map<String, String>>` — `rangoInicio` → `paletaId`
    - `suspend fun paletaDe(rangoInicio: String): PaletaVideo`
    - `suspend fun guardar(rangoInicio: String, paletaId: String)`
  - `AppContainer.configVideoRepository: ConfigVideoRepository`

- [x] **Step 1: Crear el modelo**

Sin test: es un data class de datos puros para Firestore, sin lógica. La lógica de fallback ya está testeada en `PaletasVideoTest` (Task 1), que es exactamente lo que el repositorio delega.

Crear `app/src/main/java/com/osfit/app/data/model/ConfigVideoPeriodo.kt`:

```kotlin
package com.osfit.app.data.model

/**
 * Configuración de video de un periodo. Se guarda en `configVideo/{rangoInicio}`, donde
 * [rangoInicio] es la fecha ISO de inicio de la quincena — el mismo identificador de periodo
 * que ya usan MedallaOtorgada y LogroPersonalOtorgado.
 *
 * Sólo se guarda el id del preset, no sus colores: los presets viven en el código
 * (ver PaletasVideo), así que ajustar un color se hace una vez y aplica a todos los periodos
 * que lo usan.
 */
data class ConfigVideoPeriodo(
    val rangoInicio: String = "",
    val paletaId: String = ""
)
```

- [x] **Step 2: Crear el repositorio**

Crear `app/src/main/java/com/osfit/app/data/repository/ConfigVideoRepository.kt`, siguiendo el patrón de `MedallaRepository` (callbackFlow + addSnapshotListener, `.await()` para lecturas puntuales):

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.video.PaletaVideo
import com.osfit.app.video.PaletasVideo
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class ConfigVideoRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val configs = db.collection("configVideo")

    /** rangoInicio -> paletaId, de todos los periodos configurados. Lo consume la pantalla de
     *  configuración, que muestra muchos periodos a la vez. */
    fun observarTodas(): Flow<Map<String, String>> = callbackFlow {
        val registro = configs.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val porPeriodo = snapshot?.documents.orEmpty().mapNotNull { doc ->
                doc.getString("paletaId")?.let { doc.id to it }
            }.toMap()
            trySend(porPeriodo)
        }
        awaitClose { registro.remove() }
    }

    /**
     * Lectura puntual para generar un video. Nunca falla: un periodo sin configurar —o con un
     * preset que ya no existe en el código— cae en la paleta por defecto, que son los colores
     * originales del video.
     */
    suspend fun paletaDe(rangoInicio: String): PaletaVideo {
        val id = runCatching {
            configs.document(rangoInicio).get().await().getString("paletaId")
        }.getOrNull()
        return PaletasVideo.porId(id)
    }

    /** Upsert por periodo: el id del documento es el rangoInicio, así que reasignar la paleta
     *  de una quincena pisa la anterior en vez de acumular documentos. */
    suspend fun guardar(rangoInicio: String, paletaId: String) {
        configs.document(rangoInicio).set(mapOf("paletaId" to paletaId)).await()
    }
}
```

- [x] **Step 3: Registrar el repositorio en AppContainer**

En `app/src/main/java/com/osfit/app/data/AppContainer.kt`, agregar el import `com.osfit.app.data.repository.ConfigVideoRepository` (en orden alfabético, va antes de `FirestoreAsistenciaRepository`) y la propiedad dentro del object:

```kotlin
    val configVideoRepository: ConfigVideoRepository by lazy { ConfigVideoRepository() }
```

- [x] **Step 4: Verificar que compila lo nuevo**

Run: `./gradlew.bat :app:compileDebugKotlin`

Expected: sigue fallando **sólo** en `ResumenVideoGenerator.kt` (arrastre de las tasks 2 y 3). Ningún error debe apuntar a `ConfigVideoRepository.kt`, `ConfigVideoPeriodo.kt` ni `AppContainer.kt`. Si aparece un error en esos tres archivos, arreglarlo antes de commitear.

- [x] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/ConfigVideoPeriodo.kt app/src/main/java/com/osfit/app/data/repository/ConfigVideoRepository.kt app/src/main/java/com/osfit/app/data/AppContainer.kt
git commit -m "feat: persist the video palette chosen for each period"
```

---

### Task 5: La generación de video usa la paleta del periodo

Cierra la cadena: acá el proyecto vuelve a compilar de punta a punta.

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt`

**Interfaces:**
- Consumes: `FondoBlobRenderer(paleta)` (Task 2), `dibujarFrame(..., paleta, ...)` (Task 3), `AppContainer.configVideoRepository.paletaDe(rangoInicio)` (Task 4).
- Produces: `ResumenVideoGenerator.generarYCompartir(...)` mantiene su firma pública actual — resuelve la paleta internamente, así que ningún llamador cambia.

- [x] **Step 1: Resolver la paleta y pasarla al renderer**

En `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt`:

1. Agregar el import `com.osfit.app.data.AppContainer`.

2. Dentro de `generarYCompartir`, reemplazar la línea que construye el fondo:

```kotlin
        val fondo = FondoBlobRenderer()
```

por:

```kotlin
        // Una sola lectura por video, no una por frame: la paleta es del periodo y no cambia
        // mientras se genera.
        val paleta = AppContainer.configVideoRepository.paletaDe(resumen.rango.inicio.toString())
        // Una instancia de fondo por generación: su bitmap y sus paints son estado mutable,
        // y dos generaciones solapadas se corromperían los frames si lo compartieran.
        val fondo = FondoBlobRenderer(paleta)
```

(el comentario existente sobre la instancia por generación se conserva tal cual, sólo se le antepone el nuevo).

3. En el lambda que se le pasa a `ResumenVideoEncoder.generar`, pasar la paleta:

```kotlin
        ) { canvas, tiempoMs ->
            ResumenFrameRenderer.dibujarFrame(canvas, timeline, fondo, tiempoMs, paleta)
        }
```

- [x] **Step 2: Verificar que compila todo**

Run: `./gradlew.bat :app:compileDebugKotlin`

Expected: BUILD SUCCESSFUL. Es el primer punto del plan en que el proyecto compila entero desde la Task 2.

- [x] **Step 3: Correr toda la suite de tests**

Run: `./gradlew.bat :app:testDebugUnitTest`

Expected: BUILD SUCCESSFUL, todos en verde — incluidos `ResumenVideoGeneratorTest` y `TimelineResumenTest`, que no deberían haberse visto afectados.

- [x] **Step 4: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt
git commit -m "feat: render each video with its period's palette"
```

---

### Task 6: Pantalla "Configuración de video"

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/PeriodosQuincenales.kt`
- Create: `app/src/test/java/com/osfit/app/domain/PeriodosQuincenalesTest.kt`
- Create: `app/src/main/java/com/osfit/app/ui/configvideo/ConfigVideoViewModel.kt`
- Create: `app/src/main/java/com/osfit/app/ui/configvideo/ConfigVideoScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/Screen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/OSfitApp.kt`

**Interfaces:**
- Consumes: `PaletaVideo`, `PaletasVideo.disponibles`, `PaletasVideo.porId` (Task 1); `AppContainer.configVideoRepository` con `observarTodas()` y `guardar()` (Task 4); `ResumenClienteCalculator.rangoQuincenal(fecha)` y `RangoResumen(inicio, fin, tipo, encabezado)` (ya existentes).
- Produces:
  - `object PeriodosQuincenales` con `fun ultimos(hoy: LocalDate, haciaAtras: Int = 12): List<RangoResumen>`
  - `Screen.ConfigVideo` (ruta `config_video`)
  - `data class PeriodoConPaleta(val rangoInicio: String, val encabezado: String, val paleta: PaletaVideo, val esActual: Boolean)`
  - `class ConfigVideoViewModel` con `val periodos: StateFlow<List<PeriodoConPaleta>>` y `fun asignar(rangoInicio: String, paletaId: String)`
  - `@Composable fun ConfigVideoScreen(viewModel: ConfigVideoViewModel = viewModel())`

- [x] **Step 1: Write the failing test for the period list**

La lista de quincenas es lógica pura de calendario, así que se testea sola. Crear `app/src/test/java/com/osfit/app/domain/PeriodosQuincenalesTest.kt`:

```kotlin
package com.osfit.app.domain

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PeriodosQuincenalesTest {

    @Test
    fun `la primera quincena de la lista es la siguiente a la actual`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 3)
        assertEquals(LocalDate.of(2026, 9, 16), periodos.first().inicio)
    }

    @Test
    fun `la segunda es la quincena actual`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 3)
        assertEquals(LocalDate.of(2026, 9, 1), periodos[1].inicio)
    }

    @Test
    fun `devuelve la siguiente mas las que se pidieron hacia atras`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 12)
        assertEquals(13, periodos.size)
    }

    @Test
    fun `las quincenas van de mas nueva a mas vieja, sin repetir`() {
        val inicios = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 12).map { it.inicio }
        assertEquals(inicios.sortedDescending(), inicios)
        assertEquals(inicios.size, inicios.toSet().size)
    }

    /** Cruzar el 1ro de enero hacia atrás tiene que caer en la 2da quincena de diciembre del
     *  año anterior, no en un mes 0. */
    @Test
    fun `cruza el cambio de ano hacia atras`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 1, 3), haciaAtras = 2)
        assertEquals(
            listOf(
                LocalDate.of(2026, 1, 16),
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2025, 12, 16)
            ),
            periodos.map { it.inicio }
        )
    }

    /** Partiendo de la 2da quincena, la siguiente es la 1ra del mes que viene. */
    @Test
    fun `cruza el cambio de mes hacia adelante`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 20), haciaAtras = 1)
        assertEquals(LocalDate.of(2026, 10, 1), periodos.first().inicio)
        assertEquals(LocalDate.of(2026, 9, 16), periodos[1].inicio)
    }

    @Test
    fun `cada periodo trae el encabezado que usa el resumen`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 1)
        assertEquals("2da quincena de septiembre", periodos.first().encabezado)
        assertEquals("1ra quincena de septiembre", periodos[1].encabezado)
    }

    @Test
    fun `todos los periodos son quincenales`() {
        PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 5).forEach {
            assertTrue(it.tipo == TipoResumen.QUINCENAL)
        }
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `./gradlew.bat :app:testDebugUnitTest --tests "com.osfit.app.domain.PeriodosQuincenalesTest"`

Expected: FAIL — `Unresolved reference: PeriodosQuincenales`.

- [x] **Step 3: Implement the period list**

Crear `app/src/main/java/com/osfit/app/domain/PeriodosQuincenales.kt`:

```kotlin
package com.osfit.app.domain

import java.time.LocalDate

/**
 * Las quincenas son deterministas (días 1-15 y 16-fin de mes), así que la lista de periodos se
 * calcula del calendario y no de la base: no hace falta consultar nada para saber qué
 * quincenas existen.
 *
 * Delega en [ResumenClienteCalculator.rangoQuincenal] para que los encabezados sean
 * exactamente los mismos que muestra el resumen.
 */
object PeriodosQuincenales {

    /**
     * La quincena siguiente a la de [hoy], la de [hoy], y [haciaAtras] anteriores — de más
     * nueva a más vieja. Incluye la siguiente para poder dejar la paleta lista antes de que
     * arranque el periodo.
     */
    fun ultimos(hoy: LocalDate, haciaAtras: Int = 12): List<RangoResumen> {
        val periodos = mutableListOf<RangoResumen>()
        var referencia = ResumenClienteCalculator.rangoQuincenal(hoy).fin.plusDays(1)
        repeat(haciaAtras + 1) {
            val rango = ResumenClienteCalculator.rangoQuincenal(referencia)
            periodos += rango
            referencia = rango.inicio.minusDays(1)
        }
        return periodos
    }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `./gradlew.bat :app:testDebugUnitTest --tests "com.osfit.app.domain.PeriodosQuincenalesTest"`

Expected: PASS, 8 tests.

- [x] **Step 5: Write the ViewModel**

Crear `app/src/main/java/com/osfit/app/ui/configvideo/ConfigVideoViewModel.kt`. Sigue el patrón de `LogrosPersonalesViewModel` (repositorio por defecto desde `AppContainer`, `stateIn` con `WhileSubscribed(5000)`):

```kotlin
package com.osfit.app.ui.configvideo

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.repository.ConfigVideoRepository
import com.osfit.app.domain.PeriodosQuincenales
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.video.PaletaVideo
import com.osfit.app.video.PaletasVideo
import java.time.LocalDate
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Un periodo de la lista, ya resuelto: el Composable no hace lookups. */
data class PeriodoConPaleta(
    val rangoInicio: String,
    val encabezado: String,
    val paleta: PaletaVideo,
    val esActual: Boolean
)

class ConfigVideoViewModel(
    private val repositorio: ConfigVideoRepository = AppContainer.configVideoRepository
) : ViewModel() {

    // Se fija una sola vez al crear el ViewModel: si se recalculara en cada emisión, la lista
    // podría cambiar de largo bajo los pies del usuario al cruzar la medianoche del día 16.
    private val hoy = LocalDate.now()
    private val periodoActual = ResumenClienteCalculator.rangoQuincenal(hoy).inicio.toString()

    val periodos: StateFlow<List<PeriodoConPaleta>> = repositorio.observarTodas()
        .map { paletasPorPeriodo -> construir(paletasPorPeriodo) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), construir(emptyMap()))

    fun asignar(rangoInicio: String, paletaId: String) {
        viewModelScope.launch { repositorio.guardar(rangoInicio, paletaId) }
    }

    private fun construir(paletasPorPeriodo: Map<String, String>): List<PeriodoConPaleta> =
        PeriodosQuincenales.ultimos(hoy).map { rango ->
            val rangoInicio = rango.inicio.toString()
            PeriodoConPaleta(
                rangoInicio = rangoInicio,
                encabezado = rango.encabezado,
                paleta = PaletasVideo.porId(paletasPorPeriodo[rangoInicio]),
                esActual = rangoInicio == periodoActual
            )
        }
}
```

- [x] **Step 6: Write the screen**

Crear `app/src/main/java/com/osfit/app/ui/configvideo/ConfigVideoScreen.kt`:

```kotlin
package com.osfit.app.ui.configvideo

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.video.PaletaVideo
import com.osfit.app.video.PaletasVideo

@Composable
fun ConfigVideoScreen(viewModel: ConfigVideoViewModel = viewModel()) {
    val periodos by viewModel.periodos.collectAsState()
    var periodoEnEdicion by remember { mutableStateOf<PeriodoConPaleta?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Text(
                "La paleta aplica a todos los videos de esa quincena. La música sigue siendo de cada cliente.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }
        items(periodos, key = { it.rangoInicio }) { periodo ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { periodoEnEdicion = periodo }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            if (periodo.esActual) "${periodo.encabezado} (actual)" else periodo.encabezado,
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(periodo.paleta.nombre, style = MaterialTheme.typography.bodySmall)
                    }
                    MuestrasPaleta(periodo.paleta)
                }
            }
        }
    }

    periodoEnEdicion?.let { periodo ->
        AlertDialog(
            onDismissRequest = { periodoEnEdicion = null },
            title = { Text(periodo.encabezado) },
            text = {
                Column {
                    PaletasVideo.disponibles.forEach { paleta ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    viewModel.asignar(periodo.rangoInicio, paleta.id)
                                    periodoEnEdicion = null
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = paleta.id == periodo.paleta.id,
                                onClick = {
                                    viewModel.asignar(periodo.rangoInicio, paleta.id)
                                    periodoEnEdicion = null
                                }
                            )
                            Text(paleta.nombre, modifier = Modifier.weight(1f))
                            MuestrasPaleta(paleta)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { periodoEnEdicion = null }) { Text("Cerrar") }
            }
        )
    }
}

/** Los tres blobs y el destacado, para poder comparar paletas de un vistazo. */
@Composable
private fun MuestrasPaleta(paleta: PaletaVideo) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        listOf(paleta.blobA, paleta.blobB, paleta.blobC, paleta.destacado).forEach { color ->
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(Color(color))
            )
        }
    }
}
```

- [x] **Step 7: Wire the route and the drawer entry**

En `app/src/main/java/com/osfit/app/ui/navigation/Screen.kt`, agregar dentro del `sealed class Screen`, después de `LogrosPersonalesCliente`:

```kotlin
    data object ConfigVideo : Screen("config_video")
```

En `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`, después del bloque `composable(Screen.LogrosPersonales.route) { ... }`:

```kotlin
        composable(Screen.ConfigVideo.route) {
            com.osfit.app.ui.configvideo.ConfigVideoScreen()
        }
```

En `app/src/main/java/com/osfit/app/ui/OSfitApp.kt`, dentro del `ModalDrawerSheet`, después del `NavigationDrawerItem` de "Logros personales" y antes del bloque `if (com.osfit.app.BuildConfig.DEBUG)`:

```kotlin
                        NavigationDrawerItem(
                            label = { Text("Configuración de video") },
                            selected = rutaActual == Screen.ConfigVideo.route,
                            onClick = {
                                scope.launch { drawerState.close() }
                                navController.navigate(Screen.ConfigVideo.route)
                            },
                            modifier = Modifier.padding(12.dp)
                        )
```

- [x] **Step 8: Verify build and full test suite**

Run: `./gradlew.bat :app:compileDebugKotlin :app:testDebugUnitTest`

Expected: BUILD SUCCESSFUL, todos los tests en verde.

- [x] **Step 9: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/PeriodosQuincenales.kt app/src/test/java/com/osfit/app/domain/PeriodosQuincenalesTest.kt app/src/main/java/com/osfit/app/ui/configvideo/ app/src/main/java/com/osfit/app/ui/navigation/Screen.kt app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt app/src/main/java/com/osfit/app/ui/OSfitApp.kt
git commit -m "feat: add the video settings screen for assigning a palette per period"
```

---

### Task 7: Verificación en dispositivo

El resto del plan verifica lógica. Los colores y el tamaño de los blobs sólo se validan viendo un video real — es como se ha validado el resto de esta feature.

**Files:** ninguno (salvo los ajustes de color que salgan de la revisión).

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: confirmación visual, o ajustes a los hex de `PaletasVideo` y a los radios/blur de la Task 2.

- [ ] **Step 1: Build and install**

```bash
./gradlew.bat :app:assembleDebug
"$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 2: Asignar una paleta al periodo de prueba**

En el dispositivo: abrir el drawer → "Configuración de video" → tocar la quincena actual → elegir "Atardecer".

Verificar: el renglón de la quincena actual muestra ahora "Atardecer" y sus cuatro muestras de color, y dice "(actual)".

- [ ] **Step 3: Generar un video del periodo configurado**

Abrir un cliente de prueba (Estela) → "Resumen quincenal" → elegir el periodo actual → confirmar medalla → confirmar logros → Generar. Abrir el preview de WhatsApp **sin enviarlo a nadie**.

Verificar:
- Los blobs se ven más chicos y con el borde más definido que antes, sin llegar a leerse como círculos duros.
- El fondo usa los tonos cálidos de Atardecer, no el magenta/cian/púrpura de siempre.
- Los datos destacados (número de asistencias, "Xh Ymin", días de racha, la línea de la gráfica de tiempo, el nombre de la medalla y de los logros) salen en el ámbar de Atardecer y **se leen bien sobre el fondo**.
- La dona de días favoritos conserva sus colores pastel de siempre.
- La música del cliente suena igual que antes.

- [ ] **Step 4: Generar un video de un periodo sin configurar**

Repetir con una quincena anterior a la que no se le asignó paleta.

Verificar: el video sale con los colores originales (magenta/cian/púrpura, destacado verde aqua). Es la comprobación de que nada cambió para lo no configurado.

- [ ] **Step 5: Ajustar si hace falta**

Si algún preset no contrasta bien, o los blobs quedaron demasiado chicos o demasiado duros, ajustar los hex en `PaletaVideo.kt` y/o los radios en `BlobsGeometria.kt` y `RADIO_BLUR_PX` en `FondoBlobRenderer.kt`, y repetir desde el Step 1.

Si se cambiaron radios, correr `./gradlew.bat :app:testDebugUnitTest --tests "com.osfit.app.video.BlobsGeometriaTest"` — el test `los blobs son mas chicos que el diseno original` fija el techo en `0.25f`.

- [ ] **Step 6: Commit de los ajustes**

Sólo si el Step 5 cambió algo:

```bash
git add -u
git commit -m "fix: tune the palette colors and blob sizing against a real video"
```

---

## Notas para quien ejecute

- **El proyecto no compila entre las tasks 2 y 5.** Es deliberado: el cambio de firma de `FondoBlobRenderer` y `dibujarFrame` no tiene arreglo local en `ResumenVideoGenerator` hasta que existe el repositorio de la Task 4. No lo "arregles" agregando un valor por defecto a la paleta — la paleta debe venir siempre del periodo, y un default la vuelve fácil de olvidar. Los tests unitarios de cada task sí corren en verde en su momento, porque tocan sólo código puro.
- Si al ejecutar encuentras que algún archivo no coincide con lo que este plan describe, **léelo del disco antes de editarlo**: este repo ha tenido sesiones trabajando en paralelo sobre los mismos archivos de video.
- El usuario hace commit y push a `main` sólo cuando lo pide explícitamente. Los commits de cada task son locales; **no hagas push**.
