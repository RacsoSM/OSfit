# Resumen de cliente en video animado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static-card recap video (1 bitmap per card, held N seconds) with a continuous Spotify-Wrapped-style animation: moving blurred color blobs, typewriter text at two speeds, and crossfade transitions between scenes.

**Architecture:** A pure-Kotlin `TimelineResumen` converts an ordered list of `EscenaResumen` into absolute-time tramos and resolves the 600ms crossfade math. `ResumenFrameRenderer` asks the timeline "what's active/entering at time t" and composes each frame: a continuous `FondoBlobRenderer` background (blurred via `BlurMaskFilter`, time-driven, never tied to any one scene) plus alpha-blended text. `ResumenVideoEncoder` is generalized from "one bitmap per card" to "call this function once per frame at 30fps."

**Tech Stack:** Kotlin, Android `Canvas`/`Paint`/`BlurMaskFilter`/`StaticLayout` (software rendering, no hardware canvas needed), `MediaCodec`/`MediaMuxer` (unchanged plumbing), JUnit4 for the pure-logic layer.

**Spec:** [docs/superpowers/specs/2026-08-27-resumen-cliente-video-animado-design.md](../specs/2026-08-27-resumen-cliente-video-animado-design.md) (supersedes the "Tarjetas"/"Video" sections of [2026-08-26-resumen-cliente-video-design.md](../specs/2026-08-26-resumen-cliente-video-design.md), which still governs the domain layer and sharing flow, unchanged).

## Global Constraints

- Video resolution stays 1080×1920 (no 4K).
- Frame rate: 30fps (`FPS = 30`), replacing the old 1fps "hold a static card" model.
- Crossfade window between consecutive scenes: exactly 600ms, taken from the tail of the outgoing scene's own duration budget (no extra time added to the total).
- Scene durations are fixed constants: Saludo 3000ms, Asistencia 6000ms, Tiempo 6000ms, DiaFavorito 4000ms, RachaMasLarga 4000ms.
- Blob blur uses `BlurMaskFilter` (`Paint().maskFilter`), never `RenderEffect`/`RenderNode` — the frame is always a plain software `Bitmap`/`Canvas`.
- `RachaMasLarga` only appears when `resumen.rango.tipo == TipoResumen.MENSUAL` and both `rachaMasLarga`/`rankingRacha` are non-null (same rule as the current `construirTarjetas`).
- Ranking/condition copy ("¡Vas primero...!" / "Estás en el lugar N... detrás de: ...") is reused verbatim from the current renderer — do not reword it.
- New files under `app/src/main/java/com/osfit/app/video/`; new tests under `app/src/test/java/com/osfit/app/video/` (package `com.osfit.app.video`, mirroring the existing `app/src/test/java/com/osfit/app/domain/` layout).
- Build/test commands run from the repo root via `./gradlew.bat` (Windows).

---

### Task 1: MaquinaEscribir (typewriter reveal, pure logic)

**Files:**
- Create: `app/src/main/java/com/osfit/app/video/MaquinaEscribir.kt`
- Test: `app/src/test/java/com/osfit/app/video/MaquinaEscribirTest.kt`

**Interfaces:**
- Produces: `object MaquinaEscribir { fun textoVisible(textoCompleto: String, elapsedMs: Long, duracionMs: Long): String }` — used by Task 5 (`ResumenFrameRenderer`) to crop each text block by elapsed time.

- [ ] **Step 1: Write the failing test**

```kotlin
package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Test

class MaquinaEscribirTest {

    @Test
    fun `elapsedMs menor o igual a cero no muestra nada`() {
        assertEquals("", MaquinaEscribir.textoVisible("Hola", elapsedMs = 0, duracionMs = 1000))
        assertEquals("", MaquinaEscribir.textoVisible("Hola", elapsedMs = -50, duracionMs = 1000))
    }

    @Test
    fun `elapsedMs mayor o igual a duracionMs muestra el texto completo`() {
        assertEquals("Hola", MaquinaEscribir.textoVisible("Hola", elapsedMs = 1000, duracionMs = 1000))
        assertEquals("Hola", MaquinaEscribir.textoVisible("Hola", elapsedMs = 5000, duracionMs = 1000))
    }

    @Test
    fun `a la mitad del tiempo muestra la mitad de los caracteres`() {
        assertEquals("Ho", MaquinaEscribir.textoVisible("Hola", elapsedMs = 500, duracionMs = 1000))
    }

    @Test
    fun `duracionMs cero o negativa muestra el texto completo de inmediato`() {
        assertEquals("Hola", MaquinaEscribir.textoVisible("Hola", elapsedMs = 10, duracionMs = 0))
        assertEquals("Hola", MaquinaEscribir.textoVisible("Hola", elapsedMs = 10, duracionMs = -5))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.video.MaquinaEscribirTest"`
Expected: FAIL to compile — `MaquinaEscribir` is unresolved.

- [ ] **Step 3: Write the implementation**

```kotlin
package com.osfit.app.video

object MaquinaEscribir {
    /** Recorta [textoCompleto] a la cantidad de caracteres que corresponde a [elapsedMs] de
     * [duracionMs] transcurridos, para el efecto de máquina de escribir. */
    fun textoVisible(textoCompleto: String, elapsedMs: Long, duracionMs: Long): String {
        if (duracionMs <= 0L) return textoCompleto
        if (elapsedMs <= 0L) return ""
        if (elapsedMs >= duracionMs) return textoCompleto
        val proporcion = elapsedMs.toDouble() / duracionMs.toDouble()
        val caracteres = (textoCompleto.length * proporcion).toInt().coerceIn(0, textoCompleto.length)
        return textoCompleto.substring(0, caracteres)
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.video.MaquinaEscribirTest"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/MaquinaEscribir.kt app/src/test/java/com/osfit/app/video/MaquinaEscribirTest.kt
git commit -m "feat: add MaquinaEscribir typewriter reveal helper"
```

---

### Task 2: BlobsGeometria (blob positions over time, pure logic)

**Files:**
- Create: `app/src/main/java/com/osfit/app/video/BlobsGeometria.kt`
- Test: `app/src/test/java/com/osfit/app/video/BlobsGeometriaTest.kt`

**Interfaces:**
- Produces: `data class Punto(val x: Float, val y: Float)`, `data class BlobSpec(...)`, `object BlobsGeometria { val blobs: List<BlobSpec>; fun posicionEn(blob: BlobSpec, tiempoGlobalMs: Long): Punto }` — used by Task 4 (`FondoBlobRenderer`).

- [ ] **Step 1: Write the failing test**

```kotlin
package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BlobsGeometriaTest {

    @Test
    fun `posicionEn es determinista para el mismo tiempo`() {
        val blob = BlobsGeometria.blobs.first()
        assertEquals(BlobsGeometria.posicionEn(blob, 12_345L), BlobsGeometria.posicionEn(blob, 12_345L))
    }

    @Test
    fun `posicionEn se mantiene dentro de la amplitud declarada del blob a lo largo de un periodo`() {
        val blob = BlobsGeometria.blobs.first()
        var t = 0L
        while (t < blob.periodoMs) {
            val p = BlobsGeometria.posicionEn(blob, t)
            assertTrue(p.x in (blob.centroBaseX - blob.amplitudX - 0.001f)..(blob.centroBaseX + blob.amplitudX + 0.001f))
            assertTrue(p.y in (blob.centroBaseY - blob.amplitudY - 0.001f)..(blob.centroBaseY + blob.amplitudY + 0.001f))
            t += 250L
        }
    }

    @Test
    fun `hay blobs magenta, cian y purpura`() {
        val colores = BlobsGeometria.blobs.map { it.colorArgb }.toSet()
        assertEquals(3, colores.size)
    }

    @Test
    fun `hay al menos 4 blobs`() {
        assertTrue(BlobsGeometria.blobs.size >= 4)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.video.BlobsGeometriaTest"`
Expected: FAIL to compile — `BlobsGeometria` is unresolved.

- [ ] **Step 3: Write the implementation**

```kotlin
package com.osfit.app.video

data class Punto(val x: Float, val y: Float)

/**
 * [centroBaseX]/[centroBaseY]/[amplitudX]/[amplitudY]/[radio] son fracciones del ancho/alto
 * del canvas (0f..1f), no píxeles, para que el mismo blob se vea igual sin importar la
 * resolución exacta del frame.
 */
data class BlobSpec(
    val colorArgb: Int,
    val radio: Float,
    val centroBaseX: Float,
    val centroBaseY: Float,
    val amplitudX: Float,
    val amplitudY: Float,
    val periodoMs: Long,
    val faseMs: Long
)

/** Geometría pura y determinística de los blobs de fondo: sin Random, sin Android. */
object BlobsGeometria {
    private const val MAGENTA = 0xFFE026D6.toInt()
    private const val CIAN = 0xFF26E0E0.toInt()
    private const val PURPURA = 0xFF8A26E0.toInt()

    val blobs: List<BlobSpec> = listOf(
        BlobSpec(colorArgb = MAGENTA, radio = 0.32f, centroBaseX = 0.28f, centroBaseY = 0.22f, amplitudX = 0.10f, amplitudY = 0.07f, periodoMs = 11_000L, faseMs = 0L),
        BlobSpec(colorArgb = CIAN, radio = 0.30f, centroBaseX = 0.74f, centroBaseY = 0.40f, amplitudX = 0.08f, amplitudY = 0.12f, periodoMs = 13_500L, faseMs = 2_500L),
        BlobSpec(colorArgb = PURPURA, radio = 0.34f, centroBaseX = 0.42f, centroBaseY = 0.72f, amplitudX = 0.12f, amplitudY = 0.09f, periodoMs = 9_500L, faseMs = 5_000L),
        BlobSpec(colorArgb = MAGENTA, radio = 0.24f, centroBaseX = 0.80f, centroBaseY = 0.85f, amplitudX = 0.09f, amplitudY = 0.10f, periodoMs = 15_000L, faseMs = 8_000L)
    )

    /** Centro del blob (fracción del canvas) en el instante [tiempoGlobalMs]. */
    fun posicionEn(blob: BlobSpec, tiempoGlobalMs: Long): Punto {
        val angulo = 2.0 * Math.PI * (tiempoGlobalMs + blob.faseMs) / blob.periodoMs
        val x = blob.centroBaseX + blob.amplitudX * kotlin.math.sin(angulo)
        val y = blob.centroBaseY + blob.amplitudY * kotlin.math.cos(angulo)
        return Punto(x.toFloat(), y.toFloat())
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.video.BlobsGeometriaTest"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/BlobsGeometria.kt app/src/test/java/com/osfit/app/video/BlobsGeometriaTest.kt
git commit -m "feat: add BlobsGeometria for deterministic blob motion"
```

---

### Task 3: EscenaResumen + TimelineResumen (scene model and crossfade timeline)

**Files:**
- Create: `app/src/main/java/com/osfit/app/video/EscenaResumen.kt`
- Create: `app/src/main/java/com/osfit/app/video/TimelineResumen.kt`
- Test: `app/src/test/java/com/osfit/app/video/TimelineResumenTest.kt`

**Interfaces:**
- Consumes: `com.osfit.app.domain.RankingResultado` (existing, `data class RankingResultado(val puesto: Int, val nombresPorEncima: List<String>)`).
- Produces:
  - `sealed class EscenaResumen` with variants `Saludo(nombreCliente: String)`, `Asistencia(encabezadoRango: String, dias: Int, unidad: String, ranking: RankingResultado)`, `Tiempo(minutos: Int, ranking: RankingResultado)`, `DiaFavorito(nombreDia: String?, unidad: String, diasAsistidos: Int)`, `RachaMasLarga(dias: Int, ranking: RankingResultado)` — consumed by Task 5 and Task 6.
  - `data class TramoEscena(val escena: EscenaResumen, val inicioMs: Long, val duracionMs: Long) { val finMs: Long }`.
  - `class TimelineResumen(escenas: List<EscenaResumen>)` with `tramos: List<TramoEscena>`, `duracionTotalMs: Long`, `tramoActivo(tiempoGlobalMs: Long): TramoEscena`, `tramoEntrante(tiempoGlobalMs: Long): TramoEscena?`, `alphaEntrante(tiempoGlobalMs: Long): Float`, `elapsedEnTramo(tramo: TramoEscena, tiempoGlobalMs: Long): Long` — consumed by Task 5 and Task 6.

- [ ] **Step 1: Create the scene model (no test needed — plain data classes, exercised transitively by the timeline tests below)**

```kotlin
package com.osfit.app.video

import com.osfit.app.domain.RankingResultado

sealed class EscenaResumen {
    data class Saludo(val nombreCliente: String) : EscenaResumen()
    data class Asistencia(
        val encabezadoRango: String,
        val dias: Int,
        val unidad: String,
        val ranking: RankingResultado
    ) : EscenaResumen()
    data class Tiempo(val minutos: Int, val ranking: RankingResultado) : EscenaResumen()
    data class DiaFavorito(val nombreDia: String?, val unidad: String, val diasAsistidos: Int) : EscenaResumen()
    data class RachaMasLarga(val dias: Int, val ranking: RankingResultado) : EscenaResumen()
}
```

- [ ] **Step 2: Write the failing test for the timeline**

```kotlin
package com.osfit.app.video

import com.osfit.app.domain.RankingResultado
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TimelineResumenTest {

    private val ranking = RankingResultado(puesto = 1, nombresPorEncima = emptyList())

    private fun timelineDeDosEscenas() = TimelineResumen(
        listOf(
            EscenaResumen.Saludo("Ana"),
            EscenaResumen.Asistencia("Semana 1", dias = 3, unidad = "semana", ranking = ranking)
        )
    )

    @Test
    fun `arma los tramos como suma acumulada de duraciones, sin huecos`() {
        val timeline = timelineDeDosEscenas()
        assertEquals(0L, timeline.tramos[0].inicioMs)
        assertEquals(3_000L, timeline.tramos[0].duracionMs)
        assertEquals(3_000L, timeline.tramos[1].inicioMs)
        assertEquals(6_000L, timeline.tramos[1].duracionMs)
        assertEquals(9_000L, timeline.duracionTotalMs)
    }

    @Test
    fun `tramoActivo se queda en la escena saliente hasta el limite de cursor`() {
        val timeline = timelineDeDosEscenas()
        assertEquals(timeline.tramos[0], timeline.tramoActivo(0))
        assertEquals(timeline.tramos[0], timeline.tramoActivo(2_999))
        assertEquals(timeline.tramos[1], timeline.tramoActivo(3_000))
        assertEquals(timeline.tramos[1], timeline.tramoActivo(8_999))
    }

    @Test
    fun `tramoEntrante solo es no-nulo en los 600ms previos al cambio de escena`() {
        val timeline = timelineDeDosEscenas()
        assertNull(timeline.tramoEntrante(2_399))
        assertEquals(timeline.tramos[1], timeline.tramoEntrante(2_400))
        assertEquals(timeline.tramos[1], timeline.tramoEntrante(2_999))
    }

    @Test
    fun `la ultima escena nunca tiene tramoEntrante`() {
        val timeline = timelineDeDosEscenas()
        assertNull(timeline.tramoEntrante(8_999))
    }

    @Test
    fun `alphaEntrante crece de 0 a casi 1 a lo largo de la ventana de crossfade`() {
        val timeline = timelineDeDosEscenas()
        assertEquals(0f, timeline.alphaEntrante(2_400), 0.001f)
        assertEquals(0.5f, timeline.alphaEntrante(2_700), 0.001f)
        assertEquals(599f / 600f, timeline.alphaEntrante(2_999), 0.001f)
    }

    @Test
    fun `elapsedEnTramo de la primera escena arranca en 0 sin adelanto`() {
        val timeline = timelineDeDosEscenas()
        val primero = timeline.tramos[0]
        assertEquals(0L, timeline.elapsedEnTramo(primero, 0))
        assertEquals(2_999L, timeline.elapsedEnTramo(primero, 2_999))
        assertEquals(3_000L, timeline.elapsedEnTramo(primero, 3_000))
    }

    @Test
    fun `elapsedEnTramo de la segunda escena arranca 600ms antes de su cursor y es continuo`() {
        val timeline = timelineDeDosEscenas()
        val segundo = timeline.tramos[1]
        assertEquals(0L, timeline.elapsedEnTramo(segundo, 2_400))
        assertEquals(600L, timeline.elapsedEnTramo(segundo, 3_000))
        assertEquals(6_000L, timeline.elapsedEnTramo(segundo, 9_000))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `no acepta una lista vacia de escenas`() {
        TimelineResumen(emptyList())
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.video.TimelineResumenTest"`
Expected: FAIL to compile — `TimelineResumen` is unresolved.

- [ ] **Step 4: Write the implementation**

```kotlin
package com.osfit.app.video

private const val CROSSFADE_MS = 600L

data class TramoEscena(val escena: EscenaResumen, val inicioMs: Long, val duracionMs: Long) {
    val finMs: Long get() = inicioMs + duracionMs
}

/**
 * Timeline global del video: convierte la lista ordenada de [EscenaResumen] en tramos con
 * tiempos absolutos, y resuelve el crossfade de 600ms entre escenas consecutivas.
 *
 * El crossfade no agrega tiempo: los últimos 600ms de cursor de una escena son, a la vez, los
 * primeros 600ms del reloj de contenido de la escena siguiente, que arranca 600ms antes de su
 * propio `inicioMs` de cursor. Así la escena entrante ya está animando cuando alcanza opacidad
 * completa exactamente en el borde de cursor, y la saliente ya terminó su contenido (elapsed
 * llega a su `duracionMs` tope justo 600ms antes de ese borde) así que se ve congelada mientras
 * se desvanece.
 */
class TimelineResumen(escenas: List<EscenaResumen>) {

    init {
        require(escenas.isNotEmpty()) { "El timeline necesita al menos una escena" }
    }

    val tramos: List<TramoEscena> = run {
        var cursor = 0L
        escenas.map { escena ->
            val duracion = duracionParaTipo(escena)
            TramoEscena(escena, cursor, duracion).also { cursor += duracion }
        }
    }

    val duracionTotalMs: Long = tramos.last().finMs

    private fun indiceActivo(tiempoGlobalMs: Long): Int =
        tramos.indexOfLast { tiempoGlobalMs >= it.inicioMs }.coerceAtLeast(0)

    fun tramoActivo(tiempoGlobalMs: Long): TramoEscena = tramos[indiceActivo(tiempoGlobalMs)]

    /** Próximo tramo si [tiempoGlobalMs] cae en los 600ms previos al cambio de escena; null
     * fuera de esa ventana o si el tramo activo es el último. */
    fun tramoEntrante(tiempoGlobalMs: Long): TramoEscena? {
        val indice = indiceActivo(tiempoGlobalMs)
        if (indice == tramos.lastIndex) return null
        val activo = tramos[indice]
        return if (tiempoGlobalMs >= activo.finMs - CROSSFADE_MS) tramos[indice + 1] else null
    }

    /** 0f al empezar la ventana de crossfade, creciendo a 1f al terminarla. Llamar solo si
     * [tramoEntrante] no es null en ese instante. */
    fun alphaEntrante(tiempoGlobalMs: Long): Float {
        val activo = tramoActivo(tiempoGlobalMs)
        val inicioVentana = activo.finMs - CROSSFADE_MS
        val transcurrido = (tiempoGlobalMs - inicioVentana).coerceIn(0L, CROSSFADE_MS)
        return transcurrido.toFloat() / CROSSFADE_MS.toFloat()
    }

    /** Milisegundos transcurridos dentro del contenido propio de [tramo], acotados a
     * [0, tramo.duracionMs]. Si [tramo] no es la primera escena, su reloj arranca 600ms antes
     * de su `inicioMs` de cursor (ver doc de la clase). */
    fun elapsedEnTramo(tramo: TramoEscena, tiempoGlobalMs: Long): Long {
        val esPrimero = tramo.inicioMs == 0L
        val inicioReloj = if (esPrimero) 0L else tramo.inicioMs - CROSSFADE_MS
        return (tiempoGlobalMs - inicioReloj).coerceIn(0L, tramo.duracionMs)
    }

    private fun duracionParaTipo(escena: EscenaResumen): Long = when (escena) {
        is EscenaResumen.Saludo -> 3_000L
        is EscenaResumen.Asistencia -> 6_000L
        is EscenaResumen.Tiempo -> 6_000L
        is EscenaResumen.DiaFavorito -> 4_000L
        is EscenaResumen.RachaMasLarga -> 4_000L
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.video.TimelineResumenTest"`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/EscenaResumen.kt app/src/main/java/com/osfit/app/video/TimelineResumen.kt app/src/test/java/com/osfit/app/video/TimelineResumenTest.kt
git commit -m "feat: add EscenaResumen model and TimelineResumen crossfade timeline"
```

---

### Task 4: FondoBlobRenderer (blurred blob background, Android-only)

**Files:**
- Create: `app/src/main/java/com/osfit/app/video/FondoBlobRenderer.kt`

**Interfaces:**
- Consumes: `BlobsGeometria.blobs`, `BlobsGeometria.posicionEn` (Task 2).
- Produces: `object FondoBlobRenderer { fun dibujar(canvas: Canvas, ancho: Int, alto: Int, tiempoGlobalMs: Long) }` — used by Task 5.

This file uses `android.graphics.*`, which is stubbed out ("Stub!" exceptions) in local JVM unit tests — there is no Robolectric in this project (confirmed: no `testOptions`/`robolectric` entries in `app/build.gradle.kts`). It is not unit tested; its deliverable is "compiles, and is visually confirmed on-device in Task 7."

- [ ] **Step 1: Write the implementation**

```kotlin
package com.osfit.app.video

import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint

/**
 * Dibuja los blobs de fondo en su posición para [tiempoGlobalMs], con blur real vía
 * BlurMaskFilter — funciona en un canvas por software normal (el que arma cada frame),
 * sin necesitar Surface.lockHardwareCanvas() ni ramificar por versión de Android.
 */
object FondoBlobRenderer {
    private const val RADIO_BLUR_PX = 80f

    fun dibujar(canvas: Canvas, ancho: Int, alto: Int, tiempoGlobalMs: Long) {
        BlobsGeometria.blobs.forEach { blob ->
            val centro = BlobsGeometria.posicionEn(blob, tiempoGlobalMs)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = blob.colorArgb
                maskFilter = BlurMaskFilter(RADIO_BLUR_PX, BlurMaskFilter.Blur.NORMAL)
            }
            canvas.drawCircle(centro.x * ancho, centro.y * alto, blob.radio * ancho, paint)
        }
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew.bat compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/FondoBlobRenderer.kt
git commit -m "feat: add FondoBlobRenderer with BlurMaskFilter blob background"
```

---

### Task 5: ResumenFrameRenderer (per-frame composition, Android-only)

**Files:**
- Create: `app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt`

**Interfaces:**
- Consumes: `TimelineResumen` (Task 3: `tramoActivo`, `tramoEntrante`, `alphaEntrante`, `elapsedEnTramo`), `EscenaResumen` variants (Task 3), `FondoBlobRenderer.dibujar` (Task 4), `MaquinaEscribir.textoVisible` (Task 1), `com.osfit.app.domain.RankingResultado` (existing).
- Produces: `object ResumenFrameRenderer { fun renderizarFrame(timeline: TimelineResumen, tiempoGlobalMs: Long, ancho: Int = 1080, alto: Int = 1920): Bitmap }` — used by Task 6.

Same testing note as Task 4: Android-only (`Bitmap`/`Canvas`/`StaticLayout`), no JVM unit test; verified on-device in Task 7.

- [ ] **Step 1: Write the implementation**

```kotlin
package com.osfit.app.video

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.osfit.app.domain.RankingResultado

private data class BloqueTexto(
    val texto: String,
    val inicioMs: Long,
    val duracionMs: Long,
    val y: Float,
    val tamano: Float,
    val color: Int,
    val estilo: Int
)

/**
 * Compone cada frame del video: fondo de blobs (tiempo global, continuo) + el texto de la
 * escena activa, o de la escena activa y la entrante mezcladas por alpha durante un crossfade.
 * Reemplaza a ResumenCardRenderer (una tarjeta estática por bitmap, sin animación).
 */
object ResumenFrameRenderer {

    private const val NEGRO = 0xFF000000.toInt()
    private const val VERDE = 0xFF048751.toInt()
    private const val ANCHO_DEFECTO = 1080
    private const val ALTO_DEFECTO = 1920

    fun renderizarFrame(
        timeline: TimelineResumen,
        tiempoGlobalMs: Long,
        ancho: Int = ANCHO_DEFECTO,
        alto: Int = ALTO_DEFECTO
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(NEGRO)
        FondoBlobRenderer.dibujar(canvas, ancho, alto, tiempoGlobalMs)

        val activo = timeline.tramoActivo(tiempoGlobalMs)
        val entrante = timeline.tramoEntrante(tiempoGlobalMs)
        if (entrante != null) {
            val alphaEntrante = timeline.alphaEntrante(tiempoGlobalMs)
            dibujarEscena(canvas, ancho, activo.escena, timeline.elapsedEnTramo(activo, tiempoGlobalMs), alpha = 1f - alphaEntrante)
            dibujarEscena(canvas, ancho, entrante.escena, timeline.elapsedEnTramo(entrante, tiempoGlobalMs), alpha = alphaEntrante)
        } else {
            dibujarEscena(canvas, ancho, activo.escena, timeline.elapsedEnTramo(activo, tiempoGlobalMs), alpha = 1f)
        }
        return bitmap
    }

    private fun dibujarEscena(canvas: Canvas, ancho: Int, escena: EscenaResumen, elapsedMs: Long, alpha: Float) {
        bloquesPara(escena).forEach { bloque ->
            val texto = MaquinaEscribir.textoVisible(bloque.texto, elapsedMs - bloque.inicioMs, bloque.duracionMs)
            if (texto.isNotEmpty()) {
                dibujarTexto(canvas, texto, ancho, bloque.y, bloque.tamano, bloque.color, bloque.estilo, alpha)
            }
        }
    }

    private fun bloquesPara(escena: EscenaResumen): List<BloqueTexto> = when (escena) {
        is EscenaResumen.Saludo -> listOf(
            BloqueTexto("Hola, ${escena.nombreCliente}", inicioMs = 0, duracionMs = 2_000, y = 880f, tamano = 76f, color = Color.WHITE, estilo = Typeface.BOLD)
        )
        is EscenaResumen.Asistencia -> listOf(
            BloqueTexto(escena.encabezadoRango, inicioMs = 0, duracionMs = 400, y = 160f, tamano = 44f, color = Color.LTGRAY, estilo = Typeface.NORMAL),
            BloqueTexto(
                "${determinante(escena.unidad, mayuscula = true)} ${escena.unidad} asististe ${escena.dias} días",
                inicioMs = 400, duracionMs = 2_400, y = 700f, tamano = 84f, color = VERDE, estilo = Typeface.BOLD
            ),
            BloqueTexto(
                comparacion(escena.ranking, "¡Vas primero en asistencias ${determinante(escena.unidad)} ${escena.unidad}!", "asistencias"),
                inicioMs = 3_400, duracionMs = 800, y = 1500f, tamano = 40f, color = Color.LTGRAY, estilo = Typeface.NORMAL
            )
        )
        is EscenaResumen.Tiempo -> {
            val horas = escena.minutos / 60
            val minutos = escena.minutos % 60
            listOf(
                BloqueTexto("Estuviste en el poderoso Focus un total de", inicioMs = 0, duracionMs = 400, y = 500f, tamano = 44f, color = Color.WHITE, estilo = Typeface.NORMAL),
                BloqueTexto("${horas}h ${minutos}min", inicioMs = 400, duracionMs = 2_400, y = 800f, tamano = 96f, color = VERDE, estilo = Typeface.BOLD),
                BloqueTexto(
                    comparacion(escena.ranking, "¡Vas primero en tiempo asistido!", "tiempo asistido"),
                    inicioMs = 3_400, duracionMs = 800, y = 1500f, tamano = 40f, color = Color.LTGRAY, estilo = Typeface.NORMAL
                )
            )
        }
        is EscenaResumen.DiaFavorito -> listOf(
            BloqueTexto(mensajeDiaFavorito(escena), inicioMs = 0, duracionMs = 2_200, y = 860f, tamano = 64f, color = Color.WHITE, estilo = Typeface.BOLD)
        )
        is EscenaResumen.RachaMasLarga -> listOf(
            BloqueTexto("Tu racha más larga fue de", inicioMs = 0, duracionMs = 300, y = 700f, tamano = 44f, color = Color.WHITE, estilo = Typeface.NORMAL),
            BloqueTexto("${escena.dias} días seguidos", inicioMs = 300, duracionMs = 1_900, y = 1000f, tamano = 88f, color = VERDE, estilo = Typeface.BOLD),
            BloqueTexto(
                comparacion(escena.ranking, "¡Vas primero en racha este mes!", "racha"),
                inicioMs = 2_600, duracionMs = 600, y = 1500f, tamano = 40f, color = Color.LTGRAY, estilo = Typeface.NORMAL
            )
        )
    }

    private fun determinante(unidad: String, mayuscula: Boolean = false): String {
        val base = if (unidad == "mes") "este" else "esta"
        return if (mayuscula) base.replaceFirstChar { it.uppercase() } else base
    }

    /**
     * [fraseVasPrimero] es el texto exacto ya usado en el renderer de tarjetas estáticas para
     * el caso "vas primero" de cada tipo de escena (Asistencia incluye "esta semana"/"este mes",
     * Tiempo no lleva sufijo, Racha lo tiene fijo en "este mes") — se preserva verbatim, no se
     * genera genéricamente a partir de [etiquetaLugar].
     */
    private fun comparacion(ranking: RankingResultado, fraseVasPrimero: String, etiquetaLugar: String): String =
        if (ranking.nombresPorEncima.isEmpty()) {
            fraseVasPrimero
        } else {
            "Estás en el lugar ${ranking.puesto} de $etiquetaLugar, solamente detrás de: " +
                ranking.nombresPorEncima.joinToString(", ")
        }

    private fun mensajeDiaFavorito(t: EscenaResumen.DiaFavorito): String = when {
        t.nombreDia != null -> "Tu día favorito fue ${t.nombreDia}"
        t.diasAsistidos == 0 ->
            "${determinante(t.unidad, mayuscula = true)} ${t.unidad} no viniste, ¡te esperamos la próxima!"
        else -> "¡Sigue registrando tu día de rutina para descubrir cuál es tu favorito!"
    }

    private fun dibujarTexto(
        canvas: Canvas, texto: String, anchoCanvas: Int, y: Float,
        tamano: Float, color: Int, estilo: Int, alpha: Float
    ) {
        val margen = 80
        val paint = TextPaint().apply {
            isAntiAlias = true
            this.color = color
            this.alpha = (255 * alpha).toInt().coerceIn(0, 255)
            textSize = tamano
            typeface = Typeface.create(Typeface.DEFAULT, estilo)
        }
        val anchoDisponible = anchoCanvas - margen * 2
        val layout = StaticLayout.Builder
            .obtain(texto, 0, texto.length, paint, anchoDisponible)
            .setAlignment(Layout.Alignment.ALIGN_CENTER)
            .build()
        canvas.save()
        canvas.translate(margen.toFloat(), y)
        layout.draw(canvas)
        canvas.restore()
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew.bat compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt
git commit -m "feat: add ResumenFrameRenderer, replaces static-card rendering"
```

---

### Task 6: Rewire the encoder and generator to the new frame-callback pipeline

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/ResumenVideoEncoder.kt` (the `generar` function, currently lines 60-99, and the `codificarVideo` function, currently lines 112-211 — edit `generar` first, then locate `codificarVideo` by name since the first edit shifts line numbers)
- Modify: `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt` (full file rewrite)
- Delete: `app/src/main/java/com/osfit/app/video/ResumenCardRenderer.kt` (superseded by `EscenaResumen.kt` + `ResumenFrameRenderer.kt`; after this task nothing references `TarjetaResumen`/`ResumenCardRenderer` anymore)
- Test: `app/src/test/java/com/osfit/app/video/ResumenVideoGeneratorTest.kt`

**Interfaces:**
- Consumes: `TimelineResumen` (Task 3), `EscenaResumen` (Task 3), `ResumenFrameRenderer.renderizarFrame` (Task 5), `ResumenClienteCalculator`/`ResumenClienteData`/`RangoResumen`/`TipoResumen` (existing, unchanged).
- Produces: `ResumenVideoEncoder.generar(duracionTotalMs: Long, fps: Int, context: Context, salida: File, renderizarFrame: (tiempoMs: Long) -> Bitmap): Unit` (suspend), `ResumenVideoGenerator.construirEscenas(resumen: ResumenClienteData): List<EscenaResumen>`. `ResumenClienteViewModel` (existing) is unaffected — it only calls `ResumenVideoGenerator.generarYCompartir(context, resumen)`, whose signature does not change.

This task changes two files that must land together (the generator calls the encoder's new signature) plus deletes the now-dead old renderer, so it is one task with one commit.

- [ ] **Step 1: Write the failing test for the new `construirEscenas`**

```kotlin
package com.osfit.app.video

import com.osfit.app.data.model.Cliente
import com.osfit.app.domain.RangoResumen
import com.osfit.app.domain.RankingResultado
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.domain.ResumenClienteData
import java.time.LocalDate
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ResumenVideoGeneratorTest {

    private val ranking = RankingResultado(puesto = 1, nombresPorEncima = emptyList())

    private fun resumen(rango: RangoResumen, racha: Int? = null): ResumenClienteData = ResumenClienteData(
        cliente = Cliente(id = "c1", nombre = "Ana"),
        rango = rango,
        diasAsistidos = 3,
        rankingAsistencia = ranking,
        minutosEnGym = 125,
        rankingTiempo = ranking,
        diaFavoritoNombre = "Lunes",
        rachaMasLarga = racha,
        rankingRacha = if (racha != null) ranking else null
    )

    @Test
    fun `el resumen semanal arma Saludo, Asistencia, Tiempo y DiaFavorito, sin RachaMasLarga`() {
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango))

        assertEquals(4, escenas.size)
        assertTrue(escenas[0] is EscenaResumen.Saludo)
        assertTrue(escenas[1] is EscenaResumen.Asistencia)
        assertTrue(escenas[2] is EscenaResumen.Tiempo)
        assertTrue(escenas[3] is EscenaResumen.DiaFavorito)
    }

    @Test
    fun `el resumen mensual agrega RachaMasLarga al final cuando hay racha`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, racha = 5))

        assertEquals(5, escenas.size)
        assertTrue(escenas[4] is EscenaResumen.RachaMasLarga)
        assertEquals(5, (escenas[4] as EscenaResumen.RachaMasLarga).dias)
    }

    @Test
    fun `el resumen mensual sin racha no agrega la quinta escena`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, racha = null))

        assertEquals(4, escenas.size)
    }

    @Test
    fun `el encabezado de rango semanal usa el formato del al`() {
        // 20 de marzo 2024 es miércoles, su semana va del lunes 18 al viernes 22
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango))
        val asistencia = escenas[1] as EscenaResumen.Asistencia

        assertEquals("Semana del 18 de marzo al 22 de marzo", asistencia.encabezadoRango)
    }

    @Test
    fun `el encabezado de rango mensual reusa el encabezado de RangoResumen`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango))
        val asistencia = escenas[1] as EscenaResumen.Asistencia

        assertEquals("Mes de marzo", asistencia.encabezadoRango)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.video.ResumenVideoGeneratorTest"`
Expected: FAIL to compile — `construirEscenas` does not exist yet (current code has `construirTarjetas`).

- [ ] **Step 3: Rewrite `ResumenVideoEncoder.generar` to take a frame callback**

Replace lines 60-99 of `app/src/main/java/com/osfit/app/video/ResumenVideoEncoder.kt` (the whole `generar` function) with:

```kotlin
    suspend fun generar(
        duracionTotalMs: Long,
        fps: Int,
        context: Context,
        salida: File,
        renderizarFrame: (tiempoMs: Long) -> Bitmap
    ) = withContext(Dispatchers.Default) {
        require(duracionTotalMs > 0) { "duracionTotalMs debe ser positivo" }
        require(fps > 0) { "fps debe ser positivo" }

        val pistaVideo = codificarVideo(duracionTotalMs, fps, renderizarFrame)

        // El audio es opcional: si el recurso no existe o falla la transcodificación,
        // se genera el video sin música en vez de abortar todo.
        val pistaAudio = obtenerResIdMusica(context)?.let { resId ->
            runCatching { codificarAudioDesdeRecurso(context, resId, duracionTotalMs * 1_000L) }
                .onFailure { Log.w(TAG, "No se pudo transcodificar la música de fondo", it) }
                .getOrNull()
        }?.takeIf { it.muestras.isNotEmpty() }

        salida.parentFile?.mkdirs()
        val muxer = MediaMuxer(salida.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        try {
            // Ambas pistas se agregan ANTES del único start(); writeSampleData sólo después.
            val indiceVideo = muxer.addTrack(pistaVideo.formato)
            val indiceAudio = pistaAudio?.let { muxer.addTrack(it.formato) }
            muxer.start()
            pistaVideo.muestras.forEach {
                muxer.writeSampleData(indiceVideo, ByteBuffer.wrap(it.datos), it.info)
            }
            if (pistaAudio != null && indiceAudio != null) {
                pistaAudio.muestras.forEach {
                    muxer.writeSampleData(indiceAudio, ByteBuffer.wrap(it.datos), it.info)
                }
            }
            muxer.stop()
        } finally {
            muxer.release()
        }
    }
```

- [ ] **Step 4: Rewrite `codificarVideo` to loop over frames instead of held cards**

Note: Step 3's edit shifts line numbers, so locate this function by name rather than
by line number. Replace the whole `private fun codificarVideo(...)` function (the one
that currently takes `tarjetas: List<Bitmap>, segundosPorTarjeta: Int` and ends right
before the `// ---------------------------------------------------------------- audio`
comment) with:

```kotlin
    private fun codificarVideo(duracionTotalMs: Long, fps: Int, renderizarFrame: (Long) -> Bitmap): PistaCodificada {
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, ANCHO, ALTO).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE_VIDEO)
            setInteger(MediaFormat.KEY_FRAME_RATE, fps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
        }
        // La construcción/configure/start también van dentro del try: un MediaCodec que
        // se fuga bloquea el codificador de hardware para todo el dispositivo hasta que
        // muere el proceso.
        var encoder: MediaCodec? = null
        var surface: Surface? = null

        val totalFrames = ((duracionTotalMs * fps) / 1000L).toInt().coerceAtLeast(1)
        val duracionFrameUs = 1_000_000L / fps
        var salidaFormato: MediaFormat? = null
        val muestras = mutableListOf<MuestraCodificada>()
        val bufferInfo = MediaCodec.BufferInfo()
        // Cuenta sólo muestras reales escritas (los buffers de codec-config y el EOS
        // vacío no cuentan), de modo que pts = indiceMuestra * duracionFrameUs.
        var indiceMuestra = 0

        fun drenar(enc: MediaCodec, finalDeFlujo: Boolean) {
            if (finalDeFlujo) enc.signalEndOfInputStream()
            while (true) {
                val indiceSalida = enc.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
                when {
                    indiceSalida == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!finalDeFlujo) return
                    indiceSalida == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        salidaFormato = enc.outputFormat
                    }
                    indiceSalida >= 0 -> {
                        val esCodecConfig =
                            bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
                        // El csd (SPS/PPS) viaja en el MediaFormat de salida; MediaMuxer
                        // no debe recibirlo como muestra ni debe consumir un índice de pts.
                        if (bufferInfo.size > 0 && !esCodecConfig) {
                            val buffer = enc.getOutputBuffer(indiceSalida)!!
                            buffer.position(bufferInfo.offset)
                            buffer.limit(bufferInfo.offset + bufferInfo.size)
                            val datos = ByteArray(bufferInfo.size)
                            buffer.get(datos)
                            val pts = indiceMuestra * duracionFrameUs
                            indiceMuestra++
                            val flagsMuxer = bufferInfo.flags and
                                (MediaCodec.BUFFER_FLAG_CODEC_CONFIG or
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM).inv()
                            muestras.add(
                                MuestraCodificada(
                                    datos,
                                    MediaCodec.BufferInfo().apply {
                                        set(0, datos.size, pts, flagsMuxer)
                                    }
                                )
                            )
                        }
                        enc.releaseOutputBuffer(indiceSalida, false)
                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
                    }
                }
            }
        }

        try {
            val enc = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
            encoder = enc
            enc.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            val sfc = enc.createInputSurface()
            surface = sfc
            enc.start()

            for (indiceFrame in 0 until totalFrames) {
                val tiempoMs = indiceFrame * 1000L / fps
                val bitmap = renderizarFrame(tiempoMs)
                val canvas = sfc.lockCanvas(null)
                try {
                    canvas.drawBitmap(bitmap, 0f, 0f, null)
                } finally {
                    sfc.unlockCanvasAndPost(canvas)
                }
                drenar(enc, finalDeFlujo = false)
            }
            drenar(enc, finalDeFlujo = true)
        } finally {
            encoder?.let {
                runCatching { it.stop() }
                it.release()
            }
            surface?.release()
        }

        val formatoFinal = checkNotNull(salidaFormato) {
            "El codificador de video nunca entregó su MediaFormat de salida (falta el csd)"
        }
        // Post-condición fuerte: como los frames se postean a la Surface uno tras otro sin
        // pacing en tiempo real, algunos codificadores pueden fusionar o descartar frames.
        // Si eso pasa, el mp4 resultante sería válido y reproducible pero le faltarían
        // frames; mejor fallar aquí que compartirle al cliente un video incompleto.
        check(muestras.size == totalFrames) {
            "El codificador de video emitió ${muestras.size} de $totalFrames frames"
        }
        return PistaCodificada(formatoFinal, muestras)
    }
```

- [ ] **Step 5: Rewrite `ResumenVideoGenerator.kt` to build scenes and a timeline instead of cards**

Replace the full content of `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt` with:

```kotlin
package com.osfit.app.video

import android.content.Context
import com.osfit.app.domain.ResumenClienteData
import com.osfit.app.domain.TipoResumen
import com.osfit.app.util.CompartirUtil
import java.io.File
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object ResumenVideoGenerator {

    private const val FPS = 30
    private const val VIDA_UTIL_MS = 60 * 60 * 1000L
    private val FORMATO_DIA_MES = DateTimeFormatter.ofPattern("d 'de' MMMM", Locale("es"))

    suspend fun generarYCompartir(context: Context, resumen: ResumenClienteData) {
        // El timestamp evita que dos generaciones que lleguen a solaparse (por ejemplo una
        // huérfana que siga corriendo) escriban el mismo archivo con dos MediaMuxer a la vez.
        val ahora = System.currentTimeMillis()
        val carpeta = File(context.cacheDir, "resumenes")
        val salida = File(carpeta, "${resumen.cliente.id}_${resumen.rango.tipo}_$ahora.mp4")
        val timeline = withContext(Dispatchers.Default) {
            borrarResumenesViejos(carpeta, ahora)
            TimelineResumen(construirEscenas(resumen))
        }
        ResumenVideoEncoder.generar(
            duracionTotalMs = timeline.duracionTotalMs,
            fps = FPS,
            context = context,
            salida = salida
        ) { tiempoMs -> ResumenFrameRenderer.renderizarFrame(timeline, tiempoMs) }
        CompartirUtil.compartirVideo(context, salida)
    }

    /**
     * Como el nombre del archivo ahora lleva timestamp, ya no se sobrescribe solo: se borran
     * los videos viejos para que el caché no crezca sin límite. Se respeta la última hora
     * para no borrarle el archivo a un share sheet todavía abierto.
     */
    private fun borrarResumenesViejos(carpeta: File, ahora: Long) {
        val limite = ahora - VIDA_UTIL_MS
        runCatching {
            carpeta.listFiles()?.forEach { archivo ->
                if (archivo.isFile && archivo.lastModified() < limite) archivo.delete()
            }
        }
    }

    fun construirEscenas(resumen: ResumenClienteData): List<EscenaResumen> {
        val unidad = if (resumen.rango.tipo == TipoResumen.SEMANAL) "semana" else "mes"
        val encabezadoRango = if (resumen.rango.tipo == TipoResumen.SEMANAL) {
            "Semana del ${resumen.rango.inicio.format(FORMATO_DIA_MES)} al ${resumen.rango.fin.format(FORMATO_DIA_MES)}"
        } else {
            resumen.rango.encabezado
        }
        val escenas = mutableListOf<EscenaResumen>(
            EscenaResumen.Saludo(nombreCliente = resumen.cliente.nombre),
            EscenaResumen.Asistencia(
                encabezadoRango = encabezadoRango,
                dias = resumen.diasAsistidos,
                unidad = unidad,
                ranking = resumen.rankingAsistencia
            ),
            EscenaResumen.Tiempo(
                minutos = resumen.minutosEnGym,
                ranking = resumen.rankingTiempo
            ),
            EscenaResumen.DiaFavorito(
                nombreDia = resumen.diaFavoritoNombre,
                unidad = unidad,
                diasAsistidos = resumen.diasAsistidos
            )
        )
        val racha = resumen.rachaMasLarga
        val rankingRacha = resumen.rankingRacha
        if (resumen.rango.tipo == TipoResumen.MENSUAL && racha != null && rankingRacha != null) {
            escenas += EscenaResumen.RachaMasLarga(dias = racha, ranking = rankingRacha)
        }
        return escenas
    }
}
```

- [ ] **Step 6: Delete the superseded static-card renderer**

```bash
git rm app/src/main/java/com/osfit/app/video/ResumenCardRenderer.kt
```

- [ ] **Step 7: Run the new test to verify it passes**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.video.ResumenVideoGeneratorTest"`
Expected: PASS (5 tests)

- [ ] **Step 8: Run the full unit test suite to confirm nothing else broke**

Run: `./gradlew.bat testDebugUnitTest`
Expected: BUILD SUCCESSFUL, all tests pass (existing `ResumenClienteCalculatorTest`, `RutinaProgressCalculatorTest`, `RachaCalculatorTest`, etc. plus the new video tests).

- [ ] **Step 9: Verify the whole app still compiles**

Run: `./gradlew.bat assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 10: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenVideoEncoder.kt app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt app/src/test/java/com/osfit/app/video/ResumenVideoGeneratorTest.kt
git commit -m "feat: rewire recap video to the animated frame-callback pipeline"
```

---

### Task 7: Manual on-device verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm a device is connected**

Run: `"/c/Users/SISTEMAS-03/AppData/Local/Android/Sdk/platform-tools/adb.exe" devices`
Expected: at least one device listed as `device`.

- [ ] **Step 2: Build and install the debug APK**

Run: `./gradlew.bat assembleDebug --console=plain`
Then: `"/c/Users/SISTEMAS-03/AppData/Local/Android/Sdk/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk`
Expected: `BUILD SUCCESSFUL` and `Success`.

- [ ] **Step 3: Generate a weekly recap video for a real client with attendance data**

In the app: open a client with attendance recorded this week → Estadísticas/Detalle → "Resumen semanal" → wait for it to finish → confirm the WhatsApp share sheet opens.

Confirm, watching the generated video:
- The background blobs (magenta/cian/púrpura) drift continuously and are visibly blurred, never jumping or resetting at a scene change.
- Screen 1 shows "Hola, {nombre}" typed out over ~2 seconds.
- Screen 2 shows the week range header, then "Esta semana asististe N días" typed out big, then the ranking comparison line typed fast, then crossfades into screen 3.
- Screen 3 shows "Estuviste en el poderoso Focus un total de" / "{h}h {m}min" / the ranking comparison line, same pacing pattern.
- Screen 4 (día favorito) plays and the video ends there for the weekly video (no racha scene).
- No screen looks abruptly cut — every transition is a fade, not a hard cut.

- [ ] **Step 4: Generate a monthly recap video for the same client**

In the app: same client → "Resumen mensual".

Confirm: same as above, plus a 5th scene (racha más larga) appears at the end with the same visual language.

- [ ] **Step 5: If any duration feels rushed or too slow**

Adjust the relevant constant — `duracionParaTipo` in `TimelineResumen.kt` for whole-scene timing, or the `inicioMs`/`duracionMs` values in `bloquesPara` in `ResumenFrameRenderer.kt` for a specific block's sub-timing — rebuild (`./gradlew.bat assembleDebug`), reinstall, and re-check. Commit any adjustment separately with a message describing what felt off (e.g. `fix: slow down Asistencia title typewriter, felt rushed on-device`).

- [ ] **Step 6: Confirm the video still has audio (if `res/raw/resumen_musica.*` exists) and existing behaviors are unaffected**

Confirm the video plays with background music (or silently if no music resource is present — this must not crash), and that the "Resumen semanal"/"Resumen mensual" buttons still show a progress indicator while generating and re-enable afterward, matching the existing `ResumenClienteViewModel` behavior (unchanged by this plan).
