# Resumen semanal/mensual en video por cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the trainer generate, from a client's profile, a shareable mp4 video (weekly or monthly) with a personalized stats recap compared against other clients, and share it via WhatsApp.

**Architecture:** A pure/testable domain layer (`ResumenClienteCalculator`) computes stats + rankings for any date range; a rendering layer (`ResumenCardRenderer`) draws each stat as a static card `Bitmap` using native `Canvas`; a video layer (`ResumenVideoEncoder`) encodes those bitmaps into an mp4 (H.264 + optional AAC audio track) via `MediaCodec`/`MediaMuxer`; a thin orchestrator (`ResumenVideoGenerator`) wires them together and hands the file to a `FileProvider`-backed WhatsApp share intent. Weekly and monthly differ only in which `RangoResumen` is passed in and whether a 4th card is appended — everything else is shared code.

**Tech Stack:** Kotlin, Jetpack Compose, `android.graphics` (Canvas/Bitmap), `android.media` (MediaCodec/MediaExtractor/MediaMuxer), Firestore (existing `ClienteRepository`/`AsistenciaRepository`), JUnit4 for the domain layer.

**Spec:** `docs/superpowers/specs/2026-08-26-resumen-cliente-video-design.md`

## Global Constraints

- Weekly and monthly share the same calculator/renderer/encoder classes — only the `RangoResumen` and card list differ (spec "Contexto y objetivo").
- No background/automatic generation (no WorkManager) — always a manual button tap (spec "No-objetivos").
- Background music file is read by name at runtime (`res/raw/resumen_musica`, via `Resources.getIdentifier`, not a compile-time `R.raw` reference) so the project keeps compiling whether or not the trainer has dropped the file in yet; if missing, the video is generated silently (spec "Video").
- Card size: 1080×1920 (9:16). Each card holds for exactly 8 seconds in the final video (spec confirmed answer).
- Ranking ties share the same puesto (place), consistent with `TopViewModel.construirPodio` (`app/src/main/java/com/osfit/app/ui/top/TopViewModel.kt:25-32`).
- Leyenda thresholds are fixed: 1 → "¡Felicidades, tú eres el mejor!"; 2-3 → "¡Felicidades, estás en el podio, sigue así!"; 4-5 → "¡Estás muy cerca del podio!"; else → "Échale ganitas jefe".
- The video/audio encoder cannot be verified with JVM unit tests (no hardware codec on the build machine) — those tasks are verified manually on-device via adb install, per this session's established practice of adb-verified builds.

---

### Task 1: Domain layer — date ranges (`ResumenClienteCalculator` part 1)

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt`
- Test: `app/src/test/java/com/osfit/app/domain/ResumenClienteCalculatorTest.kt`

**Interfaces:**
- Produces: `enum class TipoResumen { SEMANAL, MENSUAL }`; `data class RangoResumen(val inicio: LocalDate, val fin: LocalDate, val tipo: TipoResumen, val encabezado: String)`; `ResumenClienteCalculator.numeroSemanaDelMes(fecha: LocalDate): Int`; `ResumenClienteCalculator.rangoSemanal(fechaReferencia: LocalDate): RangoResumen`; `ResumenClienteCalculator.rangoMensual(mes: YearMonth): RangoResumen`.

- [ ] **Step 1: Write the failing tests**

Create `app/src/test/java/com/osfit/app/domain/ResumenClienteCalculatorTest.kt`:

```kotlin
package com.osfit.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class ResumenClienteCalculatorTest {

    @Test
    fun `numeroSemanaDelMes cuenta los viernes transcurridos en el mes`() {
        assertEquals(1, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 1)))
        assertEquals(2, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 8)))
        assertEquals(3, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 15)))
        assertEquals(5, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 29)))
    }

    @Test
    fun `numeroSemanaDelMes con una fecha que no es viernes cuenta los viernes ya pasados`() {
        // 20 de marzo 2024 es miércoles; ya pasaron los viernes 1, 8 y 15 (3 viernes)
        assertEquals(3, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 20)))
    }

    @Test
    fun `rangoSemanal arma el rango lunes-viernes de la semana de la fecha dada`() {
        // 20 de marzo 2024 es miércoles, su semana va del 18 (lunes) al 22 (viernes)
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        assertEquals(LocalDate.of(2024, 3, 18), rango.inicio)
        assertEquals(LocalDate.of(2024, 3, 22), rango.fin)
        assertEquals(TipoResumen.SEMANAL, rango.tipo)
        assertEquals("Semana 4 de marzo", rango.encabezado)
    }

    @Test
    fun `rangoMensual arma el rango del mes completo`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        assertEquals(LocalDate.of(2024, 3, 1), rango.inicio)
        assertEquals(LocalDate.of(2024, 3, 31), rango.fin)
        assertEquals(TipoResumen.MENSUAL, rango.tipo)
        assertEquals("Mes de marzo", rango.encabezado)
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail (won't even compile — the object doesn't exist yet)**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.domain.ResumenClienteCalculatorTest"`
Expected: FAIL (compilation error, `ResumenClienteCalculator` unresolved)

- [ ] **Step 3: Write the implementation**

Create `app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt`:

```kotlin
package com.osfit.app.domain

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

enum class TipoResumen { SEMANAL, MENSUAL }

data class RangoResumen(
    val inicio: LocalDate,
    val fin: LocalDate,
    val tipo: TipoResumen,
    val encabezado: String
)

/**
 * Calcula el resumen de estadísticas de un cliente (asistencia, tiempo en el gym,
 * día favorito, racha) comparado contra los demás clientes activos, para un rango
 * de fechas dado. La misma máquina sirve tanto para el resumen semanal como el
 * mensual: solo cambia el [RangoResumen] que se le pasa.
 */
object ResumenClienteCalculator {

    fun numeroSemanaDelMes(fecha: LocalDate): Int {
        var contador = 0
        var dia = fecha.withDayOfMonth(1)
        while (!dia.isAfter(fecha)) {
            if (dia.dayOfWeek == DayOfWeek.FRIDAY) contador++
            dia = dia.plusDays(1)
        }
        return contador.coerceAtLeast(1)
    }

    fun rangoSemanal(fechaReferencia: LocalDate): RangoResumen {
        val lunes = fechaReferencia.minusDays((fechaReferencia.dayOfWeek.value - DayOfWeek.MONDAY.value).toLong())
        val viernes = lunes.plusDays(4)
        val nombreMes = viernes.month.getDisplayName(TextStyle.FULL, Locale("es"))
        return RangoResumen(
            inicio = lunes,
            fin = viernes,
            tipo = TipoResumen.SEMANAL,
            encabezado = "Semana ${numeroSemanaDelMes(viernes)} de $nombreMes"
        )
    }

    fun rangoMensual(mes: YearMonth): RangoResumen {
        val nombreMes = mes.month.getDisplayName(TextStyle.FULL, Locale("es"))
        return RangoResumen(
            inicio = mes.atDay(1),
            fin = mes.atEndOfMonth(),
            tipo = TipoResumen.MENSUAL,
            encabezado = "Mes de $nombreMes"
        )
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.domain.ResumenClienteCalculatorTest"`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt app/src/test/java/com/osfit/app/domain/ResumenClienteCalculatorTest.kt
git commit -m "feat: add ResumenClienteCalculator date-range helpers (semana/mes)"
```

---

### Task 2: Domain layer — ranking, leyenda, día favorito, resumen completo

**Files:**
- Modify: `app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt` (append to the same object; add `RankingResultado` and `ResumenClienteData` alongside the existing `RangoResumen`)
- Modify: `app/src/test/java/com/osfit/app/domain/ResumenClienteCalculatorTest.kt` (append tests)

**Interfaces:**
- Consumes: `RangoResumen`, `TipoResumen` from Task 1. `RachaCalculator.calcularRachaMasLargaEnRango(fechasAsistencia: Set<LocalDate>, inicio: LocalDate, fin: LocalDate): Int` (`app/src/main/java/com/osfit/app/domain/RachaCalculator.kt:42`). `Cliente` (`id`, `nombre`, `rutinaAsignada`) and `Asistencia` (`clienteId`, `fecha`, `asistio`, `diaRutinaRealizado`, `duracionMinutos`) from `com.osfit.app.data.model`.
- Produces: `data class RankingResultado(val puesto: Int, val nombresPorEncima: List<String>)`; `data class ResumenClienteData(val cliente: Cliente, val rango: RangoResumen, val diasAsistidos: Int, val rankingAsistencia: RankingResultado, val minutosEnGym: Int, val rankingTiempo: RankingResultado, val diaFavoritoNombre: String?, val rachaMasLarga: Int?, val rankingRacha: RankingResultado?)`; `ResumenClienteCalculator.calcularRanking(valoresPorCliente: List<Pair<Cliente, Int>>, clienteId: String): RankingResultado`; `ResumenClienteCalculator.diaFavoritoEnRango(asistencias: List<Asistencia>, nombresDias: List<String>): String?`; `ResumenClienteCalculator.leyendaPorPuesto(puesto: Int): String`; `ResumenClienteCalculator.calcularResumenCliente(cliente: Cliente, clientesActivos: List<Cliente>, asistenciasEnRango: List<Asistencia>, rango: RangoResumen): ResumenClienteData`.

- [ ] **Step 1: Write the failing tests**

Append to `app/src/test/java/com/osfit/app/domain/ResumenClienteCalculatorTest.kt` (add these imports at the top alongside the existing ones: `com.osfit.app.data.model.Asistencia`, `com.osfit.app.data.model.Cliente`, `com.osfit.app.data.model.DiaRutina`, `com.osfit.app.data.model.Rutina`) and these test functions inside the existing class body:

```kotlin
    @Test
    fun `leyendaPorPuesto devuelve el mensaje correcto segun el puesto`() {
        assertEquals("¡Felicidades, tú eres el mejor!", ResumenClienteCalculator.leyendaPorPuesto(1))
        assertEquals("¡Felicidades, estás en el podio, sigue así!", ResumenClienteCalculator.leyendaPorPuesto(2))
        assertEquals("¡Felicidades, estás en el podio, sigue así!", ResumenClienteCalculator.leyendaPorPuesto(3))
        assertEquals("¡Estás muy cerca del podio!", ResumenClienteCalculator.leyendaPorPuesto(4))
        assertEquals("¡Estás muy cerca del podio!", ResumenClienteCalculator.leyendaPorPuesto(5))
        assertEquals("Échale ganitas jefe", ResumenClienteCalculator.leyendaPorPuesto(6))
    }

    @Test
    fun `calcularRanking sin empates ubica el puesto y los nombres por encima`() {
        val a = Cliente(id = "a", nombre = "Ana")
        val b = Cliente(id = "b", nombre = "Beto")
        val c = Cliente(id = "c", nombre = "Caro")
        val valores = listOf(a to 5, b to 3, c to 1)
        val resultado = ResumenClienteCalculator.calcularRanking(valores, "b")
        assertEquals(2, resultado.puesto)
        assertEquals(listOf("Ana"), resultado.nombresPorEncima)
    }

    @Test
    fun `calcularRanking en primer lugar no tiene nadie por encima`() {
        val a = Cliente(id = "a", nombre = "Ana")
        val b = Cliente(id = "b", nombre = "Beto")
        val resultado = ResumenClienteCalculator.calcularRanking(listOf(a to 5, b to 3), "a")
        assertEquals(1, resultado.puesto)
        assertEquals(emptyList<String>(), resultado.nombresPorEncima)
    }

    @Test
    fun `calcularRanking con empate comparten puesto`() {
        val a = Cliente(id = "a", nombre = "Ana")
        val b = Cliente(id = "b", nombre = "Beto")
        val c = Cliente(id = "c", nombre = "Caro")
        // Ana y Beto empatados en 5, Caro con 2: Caro queda en puesto 3, detrás de ambos
        val valores = listOf(a to 5, b to 5, c to 2)
        val resultado = ResumenClienteCalculator.calcularRanking(valores, "c")
        assertEquals(3, resultado.puesto)
        assertEquals(listOf("Ana", "Beto"), resultado.nombresPorEncima)

        val resultadoAna = ResumenClienteCalculator.calcularRanking(valores, "a")
        assertEquals(1, resultadoAna.puesto)
        assertEquals(emptyList<String>(), resultadoAna.nombresPorEncima)
    }

    @Test
    fun `diaFavoritoEnRango devuelve el dia con mas repeticiones`() {
        val dias = listOf("Pecho", "Espalda", "Pierna")
        val asistencias = listOf(
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 1)
        )
        assertEquals("Pecho", ResumenClienteCalculator.diaFavoritoEnRango(asistencias, dias))
    }

    @Test
    fun `diaFavoritoEnRango sin asistencias devuelve null`() {
        assertEquals(null, ResumenClienteCalculator.diaFavoritoEnRango(emptyList(), listOf("Pecho")))
    }

    @Test
    fun `diaFavoritoEnRango con empate elige uno de los empatados`() {
        val dias = listOf("Pecho", "Espalda")
        val asistencias = listOf(
            Asistencia(diaRutinaRealizado = 0),
            Asistencia(diaRutinaRealizado = 1)
        )
        val resultado = ResumenClienteCalculator.diaFavoritoEnRango(asistencias, dias)
        assertEquals(true, resultado == "Pecho" || resultado == "Espalda")
    }

    @Test
    fun `calcularResumenCliente arma el resumen semanal completo`() {
        val cliente = Cliente(
            id = "a", nombre = "Ana", activo = true,
            rutinaAsignada = Rutina(dias = listOf(DiaRutina(nombreDia = "Pecho"), DiaRutina(nombreDia = "Espalda")))
        )
        val otro = Cliente(id = "b", nombre = "Beto", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val asistencias = listOf(
            Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, diaRutinaRealizado = 0, duracionMinutos = 60),
            Asistencia(clienteId = "a", fecha = "2024-03-19", asistio = true, diaRutinaRealizado = 0, duracionMinutos = 45),
            Asistencia(clienteId = "b", fecha = "2024-03-18", asistio = true, diaRutinaRealizado = 1, duracionMinutos = 200)
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente, otro), asistencias, rango)

        assertEquals(2, resumen.diasAsistidos)
        assertEquals(105, resumen.minutosEnGym)
        assertEquals("Pecho", resumen.diaFavoritoNombre)
        assertEquals(1, resumen.rankingAsistencia.puesto)
        assertEquals(emptyList<String>(), resumen.rankingAsistencia.nombresPorEncima)
        assertEquals(2, resumen.rankingTiempo.puesto)
        assertEquals(listOf("Beto"), resumen.rankingTiempo.nombresPorEncima)
        assertEquals(null, resumen.rachaMasLarga)
        assertEquals(null, resumen.rankingRacha)
    }

    @Test
    fun `calcularResumenCliente mensual agrega racha mas larga y su ranking`() {
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
        val otro = Cliente(id = "b", nombre = "Beto", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 1), fin = LocalDate.of(2024, 3, 31),
            tipo = TipoResumen.MENSUAL, encabezado = "Mes de marzo"
        )
        val asistencias = listOf(
            Asistencia(clienteId = "a", fecha = "2024-03-04", asistio = true), // lunes
            Asistencia(clienteId = "a", fecha = "2024-03-05", asistio = true), // martes -> racha de 2
            Asistencia(clienteId = "b", fecha = "2024-03-04", asistio = true)
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente, otro), asistencias, rango)

        assertEquals(2, resumen.rachaMasLarga)
        assertEquals(1, resumen.rankingRacha?.puesto)
        assertEquals(emptyList<String>(), resumen.rankingRacha?.nombresPorEncima)
    }

    @Test
    fun `calcularResumenCliente sin asistencias devuelve diaFavorito nulo`() {
        val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
        val rango = RangoResumen(
            inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
            tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
        )
        val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente), emptyList(), rango)

        assertEquals(0, resumen.diasAsistidos)
        assertEquals(null, resumen.diaFavoritoNombre)
        assertEquals(1, resumen.rankingAsistencia.puesto)
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.domain.ResumenClienteCalculatorTest"`
Expected: FAIL (compilation error — `RankingResultado`, `calcularRanking`, etc. unresolved)

- [ ] **Step 3: Write the implementation**

Append to `app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt`. First add these imports at the top (alongside the existing `java.time.*` ones):

```kotlin
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import kotlin.random.Random
```

Then add these two data classes right after `RangoResumen`:

```kotlin
data class RankingResultado(
    val puesto: Int,
    val nombresPorEncima: List<String>
)

data class ResumenClienteData(
    val cliente: Cliente,
    val rango: RangoResumen,
    val diasAsistidos: Int,
    val rankingAsistencia: RankingResultado,
    val minutosEnGym: Int,
    val rankingTiempo: RankingResultado,
    val diaFavoritoNombre: String?,
    val rachaMasLarga: Int?,
    val rankingRacha: RankingResultado?
)
```

Then add these functions inside the `ResumenClienteCalculator` object, after `rangoMensual`:

```kotlin
    fun calcularRanking(valoresPorCliente: List<Pair<Cliente, Int>>, clienteId: String): RankingResultado {
        val grupos = valoresPorCliente
            .groupBy { it.second }
            .toSortedMap(compareByDescending { it })
        var puesto = 1
        val nombresPorEncima = mutableListOf<String>()
        var puestoDelCliente = 1
        for ((_, clientesDelGrupo) in grupos) {
            if (clientesDelGrupo.any { it.first.id == clienteId }) {
                puestoDelCliente = puesto
                break
            }
            nombresPorEncima += clientesDelGrupo.map { it.first.nombre }
            puesto += clientesDelGrupo.size
        }
        return RankingResultado(puesto = puestoDelCliente, nombresPorEncima = nombresPorEncima)
    }

    fun diaFavoritoEnRango(asistencias: List<Asistencia>, nombresDias: List<String>): String? {
        val conteo = asistencias.mapNotNull { it.diaRutinaRealizado }
            .groupingBy { it }
            .eachCount()
        if (conteo.isEmpty()) return null
        val maximo = conteo.values.max()
        val empatados = conteo.filterValues { it == maximo }.keys.toList()
        val indiceElegido = empatados[Random.nextInt(empatados.size)]
        return nombresDias.getOrNull(indiceElegido)
    }

    fun leyendaPorPuesto(puesto: Int): String = when {
        puesto == 1 -> "¡Felicidades, tú eres el mejor!"
        puesto in 2..3 -> "¡Felicidades, estás en el podio, sigue así!"
        puesto in 4..5 -> "¡Estás muy cerca del podio!"
        else -> "Échale ganitas jefe"
    }

    fun calcularResumenCliente(
        cliente: Cliente,
        clientesActivos: List<Cliente>,
        asistenciasEnRango: List<Asistencia>,
        rango: RangoResumen
    ): ResumenClienteData {
        val asistenciasPorCliente = asistenciasEnRango.filter { it.asistio }.groupBy { it.clienteId }

        val diasAsistidos = asistenciasPorCliente[cliente.id]?.size ?: 0
        val valoresAsistencia = clientesActivos.map { c -> c to (asistenciasPorCliente[c.id]?.size ?: 0) }
        val rankingAsistencia = calcularRanking(valoresAsistencia, cliente.id)

        val minutosEnGym = asistenciasPorCliente[cliente.id]?.sumOf { it.duracionMinutos ?: 0 } ?: 0
        val valoresTiempo = clientesActivos.map { c ->
            c to (asistenciasPorCliente[c.id]?.sumOf { a -> a.duracionMinutos ?: 0 } ?: 0)
        }
        val rankingTiempo = calcularRanking(valoresTiempo, cliente.id)

        val nombresDias = cliente.rutinaAsignada?.dias?.map { it.nombreDia } ?: emptyList()
        val diaFavoritoNombre = diaFavoritoEnRango(asistenciasPorCliente[cliente.id] ?: emptyList(), nombresDias)

        var rachaMasLarga: Int? = null
        var rankingRacha: RankingResultado? = null
        if (rango.tipo == TipoResumen.MENSUAL) {
            val fechasCliente = asistenciasPorCliente[cliente.id]?.map { LocalDate.parse(it.fecha) }?.toSet() ?: emptySet()
            rachaMasLarga = RachaCalculator.calcularRachaMasLargaEnRango(fechasCliente, rango.inicio, rango.fin)
            val valoresRacha = clientesActivos.map { c ->
                val fechas = asistenciasPorCliente[c.id]?.map { LocalDate.parse(it.fecha) }?.toSet() ?: emptySet()
                c to RachaCalculator.calcularRachaMasLargaEnRango(fechas, rango.inicio, rango.fin)
            }
            rankingRacha = calcularRanking(valoresRacha, cliente.id)
        }

        return ResumenClienteData(
            cliente = cliente,
            rango = rango,
            diasAsistidos = diasAsistidos,
            rankingAsistencia = rankingAsistencia,
            minutosEnGym = minutosEnGym,
            rankingTiempo = rankingTiempo,
            diaFavoritoNombre = diaFavoritoNombre,
            rachaMasLarga = rachaMasLarga,
            rankingRacha = rankingRacha
        )
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./gradlew.bat testDebugUnitTest --tests "com.osfit.app.domain.ResumenClienteCalculatorTest"`
Expected: PASS (all tests in the file — 4 from Task 1 + 10 new ones)

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt app/src/test/java/com/osfit/app/domain/ResumenClienteCalculatorTest.kt
git commit -m "feat: add ranking, leyenda, dia favorito and full resumen calculation"
```

---

### Task 3: Card rendering (`ResumenCardRenderer`)

**Files:**
- Create: `app/src/main/java/com/osfit/app/video/ResumenCardRenderer.kt`

**Interfaces:**
- Consumes: `RankingResultado`, `ResumenClienteCalculator.leyendaPorPuesto(Int): String` from Task 2.
- Produces: `sealed class TarjetaResumen` with subtypes `Asistencia(encabezado: String, nombreCliente: String, dias: Int, unidad: String, ranking: RankingResultado)`, `Tiempo(minutos: Int, ranking: RankingResultado)`, `DiaFavorito(nombreDia: String?, unidad: String)`, `RachaMasLarga(dias: Int, ranking: RankingResultado)`; `ResumenCardRenderer.renderizar(tarjeta: TarjetaResumen, ancho: Int = 1080, alto: Int = 1920): android.graphics.Bitmap`.

This task has no JVM unit test — `android.graphics.Canvas`/`Bitmap` need the Android runtime, and this project has no Robolectric setup. It's verified visually as part of Task 7's on-device check (the rendered PNG frames are what gets muxed into the final video).

- [ ] **Step 1: Write the implementation**

Create `app/src/main/java/com/osfit/app/video/ResumenCardRenderer.kt`:

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
import com.osfit.app.domain.ResumenClienteCalculator

sealed class TarjetaResumen {
    data class Asistencia(
        val encabezado: String,
        val nombreCliente: String,
        val dias: Int,
        val unidad: String,
        val ranking: RankingResultado
    ) : TarjetaResumen()

    data class Tiempo(val minutos: Int, val ranking: RankingResultado) : TarjetaResumen()

    data class DiaFavorito(val nombreDia: String?, val unidad: String) : TarjetaResumen()

    data class RachaMasLarga(val dias: Int, val ranking: RankingResultado) : TarjetaResumen()
}

object ResumenCardRenderer {

    private const val VERDE = 0xFF048751.toInt()
    private const val FONDO = 0xFF121212.toInt()

    fun renderizar(tarjeta: TarjetaResumen, ancho: Int = 1080, alto: Int = 1920): Bitmap {
        val bitmap = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(FONDO)

        when (tarjeta) {
            is TarjetaResumen.Asistencia -> dibujarAsistencia(canvas, ancho, tarjeta)
            is TarjetaResumen.Tiempo -> dibujarTiempo(canvas, ancho, tarjeta)
            is TarjetaResumen.DiaFavorito -> dibujarDiaFavorito(canvas, ancho, alto, tarjeta)
            is TarjetaResumen.RachaMasLarga -> dibujarRacha(canvas, ancho, tarjeta)
        }
        return bitmap
    }

    private fun dibujarAsistencia(canvas: Canvas, ancho: Int, t: TarjetaResumen.Asistencia) {
        var y = 160f
        y = dibujarTexto(canvas, t.encabezado, ancho, y, 48f, Color.WHITE, Typeface.NORMAL)
        y += 40f
        y = dibujarTexto(canvas, "Hola, ${t.nombreCliente}", ancho, y, 56f, Color.WHITE, Typeface.BOLD)
        y += 120f
        y = dibujarTexto(canvas, "Esta ${t.unidad} asististe ${t.dias} días", ancho, y, 80f, VERDE, Typeface.BOLD)
        y += 100f
        val comparacion = if (t.ranking.nombresPorEncima.isEmpty()) {
            "¡Vas primero en asistencias esta ${t.unidad}!"
        } else {
            "Estás en el lugar ${t.ranking.puesto} de asistencias, solamente detrás de: " +
                t.ranking.nombresPorEncima.joinToString(", ")
        }
        y = dibujarTexto(canvas, comparacion, ancho, y, 40f, Color.LTGRAY, Typeface.NORMAL)
        y += 80f
        dibujarTexto(canvas, ResumenClienteCalculator.leyendaPorPuesto(t.ranking.puesto), ancho, y, 52f, Color.WHITE, Typeface.BOLD_ITALIC)
    }

    private fun dibujarTiempo(canvas: Canvas, ancho: Int, t: TarjetaResumen.Tiempo) {
        val horas = t.minutos / 60
        val minutos = t.minutos % 60
        var y = 300f
        y = dibujarTexto(canvas, "Estuviste en el poderoso Focus un total de", ancho, y, 44f, Color.WHITE, Typeface.NORMAL)
        y += 30f
        y = dibujarTexto(canvas, "${horas}h ${minutos}min", ancho, y, 96f, VERDE, Typeface.BOLD)
        y += 120f
        val comparacion = if (t.ranking.nombresPorEncima.isEmpty()) {
            "¡Vas primero en tiempo asistido!"
        } else {
            "Estás en el lugar ${t.ranking.puesto} de tiempo asistido, solamente detrás de: " +
                t.ranking.nombresPorEncima.joinToString(", ")
        }
        y = dibujarTexto(canvas, comparacion, ancho, y, 40f, Color.LTGRAY, Typeface.NORMAL)
        y += 80f
        dibujarTexto(canvas, ResumenClienteCalculator.leyendaPorPuesto(t.ranking.puesto), ancho, y, 52f, Color.WHITE, Typeface.BOLD_ITALIC)
    }

    private fun dibujarDiaFavorito(canvas: Canvas, ancho: Int, alto: Int, t: TarjetaResumen.DiaFavorito) {
        val y = alto / 2f - 100f
        val texto = if (t.nombreDia != null) {
            "Tu día favorito fue ${t.nombreDia}"
        } else {
            "Esta ${t.unidad} no viniste, ¡te esperamos la próxima!"
        }
        dibujarTexto(canvas, texto, ancho, y, 64f, Color.WHITE, Typeface.BOLD)
    }

    private fun dibujarRacha(canvas: Canvas, ancho: Int, t: TarjetaResumen.RachaMasLarga) {
        var y = 300f
        y = dibujarTexto(canvas, "Tu racha más larga este mes fue de", ancho, y, 44f, Color.WHITE, Typeface.NORMAL)
        y += 30f
        y = dibujarTexto(canvas, "${t.dias} días seguidos", ancho, y, 88f, VERDE, Typeface.BOLD)
        y += 120f
        val comparacion = if (t.ranking.nombresPorEncima.isEmpty()) {
            "¡Vas primero en racha este mes!"
        } else {
            "Estás en el lugar ${t.ranking.puesto} de racha, solamente detrás de: " +
                t.ranking.nombresPorEncima.joinToString(", ")
        }
        y = dibujarTexto(canvas, comparacion, ancho, y, 40f, Color.LTGRAY, Typeface.NORMAL)
        y += 80f
        dibujarTexto(canvas, ResumenClienteCalculator.leyendaPorPuesto(t.ranking.puesto), ancho, y, 52f, Color.WHITE, Typeface.BOLD_ITALIC)
    }

    /** Dibuja texto centrado, ajustado al ancho disponible; devuelve el Y justo debajo del bloque. */
    private fun dibujarTexto(
        canvas: Canvas,
        texto: String,
        anchoCanvas: Int,
        y: Float,
        tamano: Float,
        color: Int,
        estilo: Int
    ): Float {
        val margen = 80
        val paint = TextPaint().apply {
            isAntiAlias = true
            this.color = color
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
        return y + layout.height
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew.bat compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenCardRenderer.kt
git commit -m "feat: render resumen stat cards as bitmaps"
```

---

### Task 4: Video encoder (`ResumenVideoEncoder`)

**Files:**
- Create: `app/src/main/java/com/osfit/app/video/ResumenVideoEncoder.kt`

**Interfaces:**
- Consumes: nothing from earlier tasks (works on plain `Bitmap`s).
- Produces: `ResumenVideoEncoder.generar(tarjetas: List<Bitmap>, segundosPorTarjeta: Int, context: Context, salida: File)` (suspend); `ResumenVideoEncoder.obtenerResIdMusica(context: Context): Int?`.

No JVM unit test — `MediaCodec` needs a real hardware codec, unavailable on the build machine. Verified on-device in Task 7 by generating a real video and playing it back.

- [ ] **Step 1: Write the implementation**

Create `app/src/main/java/com/osfit/app/video/ResumenVideoEncoder.kt`:

```kotlin
package com.osfit.app.video

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private data class MuestraCodificada(val datos: ByteArray, val info: MediaCodec.BufferInfo)
private data class PistaCodificada(val formato: MediaFormat, val muestras: List<MuestraCodificada>)
private data class Pcm(val datos: ShortArray, val sampleRate: Int, val canales: Int)

/**
 * Codifica una lista de tarjetas (bitmaps fijos) como un video mp4: cada tarjeta se
 * mantiene [segundosPorTarjeta] segundos, con una pista de audio opcional (música de
 * fondo transcodificada a AAC) si `res/raw/resumen_musica.*` existe.
 */
object ResumenVideoEncoder {

    private const val ANCHO = 1080
    private const val ALTO = 1920
    private const val BIT_RATE_VIDEO = 4_000_000
    private const val BIT_RATE_AUDIO = 128_000

    suspend fun generar(
        tarjetas: List<Bitmap>,
        segundosPorTarjeta: Int,
        context: Context,
        salida: File
    ) = withContext(Dispatchers.Default) {
        require(tarjetas.isNotEmpty()) { "Debe haber al menos una tarjeta" }
        val duracionTotalUs = tarjetas.size.toLong() * segundosPorTarjeta * 1_000_000L

        val pistaVideo = codificarVideo(tarjetas, segundosPorTarjeta)
        val resIdMusica = obtenerResIdMusica(context)
        val pistaAudio = resIdMusica?.let { codificarAudioDesdeRecurso(context, it, duracionTotalUs) }

        salida.parentFile?.mkdirs()
        val muxer = MediaMuxer(salida.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        val indiceVideo = muxer.addTrack(pistaVideo.formato)
        val indiceAudio = pistaAudio?.let { muxer.addTrack(it.formato) }
        muxer.start()
        pistaVideo.muestras.forEach { muxer.writeSampleData(indiceVideo, ByteBuffer.wrap(it.datos), it.info) }
        if (pistaAudio != null && indiceAudio != null) {
            pistaAudio.muestras.forEach { muxer.writeSampleData(indiceAudio, ByteBuffer.wrap(it.datos), it.info) }
        }
        muxer.stop()
        muxer.release()
    }

    /** Busca `res/raw/resumen_musica.*` por nombre en vez de una referencia R.raw en
     * tiempo de compilación, para que el proyecto compile con o sin el archivo puesto. */
    fun obtenerResIdMusica(context: Context): Int? {
        val id = context.resources.getIdentifier("resumen_musica", "raw", context.packageName)
        return if (id != 0) id else null
    }

    private fun codificarVideo(tarjetas: List<Bitmap>, segundosPorTarjeta: Int): PistaCodificada {
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, ANCHO, ALTO).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE_VIDEO)
            setInteger(MediaFormat.KEY_FRAME_RATE, 1)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }
        val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val surface = encoder.createInputSurface()
        encoder.start()

        val duracionFrameUs = segundosPorTarjeta * 1_000_000L
        var salidaFormato: MediaFormat? = null
        val muestras = mutableListOf<MuestraCodificada>()
        val bufferInfo = MediaCodec.BufferInfo()
        var indiceMuestra = 0

        fun drenar(finalDeFlujo: Boolean) {
            if (finalDeFlujo) encoder.signalEndOfInputStream()
            while (true) {
                val indiceSalida = encoder.dequeueOutputBuffer(bufferInfo, 10_000)
                when {
                    indiceSalida == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!finalDeFlujo) return
                    indiceSalida == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> salidaFormato = encoder.outputFormat
                    indiceSalida >= 0 -> {
                        val buffer = encoder.getOutputBuffer(indiceSalida)!!
                        if (bufferInfo.size > 0) {
                            buffer.position(bufferInfo.offset)
                            buffer.limit(bufferInfo.offset + bufferInfo.size)
                            val datos = ByteArray(bufferInfo.size)
                            buffer.get(datos)
                            val pts = indiceMuestra * duracionFrameUs
                            indiceMuestra++
                            muestras.add(
                                MuestraCodificada(datos, MediaCodec.BufferInfo().apply { set(0, datos.size, pts, bufferInfo.flags) })
                            )
                        }
                        encoder.releaseOutputBuffer(indiceSalida, false)
                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
                    }
                }
            }
        }

        tarjetas.forEach { bitmap ->
            val canvas = surface.lockCanvas(null)
            canvas.drawBitmap(bitmap, 0f, 0f, null)
            surface.unlockCanvasAndPost(canvas)
            drenar(finalDeFlujo = false)
        }
        drenar(finalDeFlujo = true)

        encoder.stop()
        encoder.release()
        surface.release()

        return PistaCodificada(salidaFormato ?: format, muestras)
    }

    private fun codificarAudioDesdeRecurso(context: Context, resId: Int, duracionObjetivoUs: Long): PistaCodificada {
        val pcm = decodificarAPcm(context, resId)
        val pcmLoop = repetirHastaDuracion(pcm, duracionObjetivoUs)
        return codificarPcmAAac(pcmLoop)
    }

    private fun decodificarAPcm(context: Context, resId: Int): Pcm {
        val afd = context.resources.openRawResourceFd(resId)
        val extractor = MediaExtractor()
        extractor.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
        afd.close()

        var trackIndex = -1
        var format: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
            val f = extractor.getTrackFormat(i)
            if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                trackIndex = i
                format = f
                break
            }
        }
        requireNotNull(format) { "El archivo de música no tiene pista de audio" }
        extractor.selectTrack(trackIndex)

        val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        val canales = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        val mime = format.getString(MediaFormat.KEY_MIME)!!

        val decoder = MediaCodec.createDecoderByType(mime)
        decoder.configure(format, null, null, 0)
        decoder.start()

        val salida = mutableListOf<Short>()
        val bufferInfo = MediaCodec.BufferInfo()
        var entradaTerminada = false
        var salidaTerminada = false

        while (!salidaTerminada) {
            if (!entradaTerminada) {
                val indiceEntrada = decoder.dequeueInputBuffer(10_000)
                if (indiceEntrada >= 0) {
                    val buffer = decoder.getInputBuffer(indiceEntrada)!!
                    val tam = extractor.readSampleData(buffer, 0)
                    if (tam < 0) {
                        decoder.queueInputBuffer(indiceEntrada, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        entradaTerminada = true
                    } else {
                        decoder.queueInputBuffer(indiceEntrada, 0, tam, extractor.sampleTime, 0)
                        extractor.advance()
                    }
                }
            }
            val indiceSalida = decoder.dequeueOutputBuffer(bufferInfo, 10_000)
            if (indiceSalida >= 0) {
                if (bufferInfo.size > 0) {
                    val buffer = decoder.getOutputBuffer(indiceSalida)!!
                    buffer.position(bufferInfo.offset)
                    buffer.limit(bufferInfo.offset + bufferInfo.size)
                    val shortBuffer = buffer.asShortBuffer()
                    val temp = ShortArray(shortBuffer.remaining())
                    shortBuffer.get(temp)
                    salida.addAll(temp.toList())
                }
                decoder.releaseOutputBuffer(indiceSalida, false)
                if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) salidaTerminada = true
            }
        }
        decoder.stop()
        decoder.release()
        extractor.release()

        return Pcm(salida.toShortArray(), sampleRate, canales)
    }

    private fun repetirHastaDuracion(pcm: Pcm, duracionObjetivoUs: Long): Pcm {
        if (pcm.datos.isEmpty()) return pcm
        val muestrasPorSegundo = pcm.sampleRate * pcm.canales
        val muestrasObjetivo = (duracionObjetivoUs / 1_000_000.0 * muestrasPorSegundo).toInt()
        val resultado = ShortArray(muestrasObjetivo)
        var i = 0
        while (i < muestrasObjetivo) {
            val copiar = minOf(muestrasObjetivo - i, pcm.datos.size)
            System.arraycopy(pcm.datos, 0, resultado, i, copiar)
            i += copiar
        }
        return Pcm(resultado, pcm.sampleRate, pcm.canales)
    }

    private fun codificarPcmAAac(pcm: Pcm): PistaCodificada {
        val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, pcm.sampleRate, pcm.canales).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE_AUDIO)
        }
        val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
        encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        encoder.start()

        val bufferInfo = MediaCodec.BufferInfo()
        var salidaFormato: MediaFormat? = null
        val muestras = mutableListOf<MuestraCodificada>()

        val bytesPcm = ByteArray(pcm.datos.size * 2)
        ByteBuffer.wrap(bytesPcm).asShortBuffer().put(pcm.datos)

        val bytesPorMuestra = pcm.canales * 2
        val muestrasPorFrame = 1024
        val bytesPorFrame = muestrasPorFrame * bytesPorMuestra
        var offset = 0
        var pts = 0L
        val frameDurationUs = 1_000_000L * muestrasPorFrame / pcm.sampleRate
        var entradaTerminada = false

        fun drenar() {
            while (true) {
                val indiceSalida = encoder.dequeueOutputBuffer(bufferInfo, 10_000)
                when {
                    indiceSalida == MediaCodec.INFO_TRY_AGAIN_LATER -> return
                    indiceSalida == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> salidaFormato = encoder.outputFormat
                    indiceSalida >= 0 -> {
                        val buffer = encoder.getOutputBuffer(indiceSalida)!!
                        if (bufferInfo.size > 0) {
                            buffer.position(bufferInfo.offset)
                            buffer.limit(bufferInfo.offset + bufferInfo.size)
                            val datos = ByteArray(bufferInfo.size)
                            buffer.get(datos)
                            muestras.add(
                                MuestraCodificada(datos, MediaCodec.BufferInfo().apply {
                                    set(0, datos.size, bufferInfo.presentationTimeUs, bufferInfo.flags)
                                })
                            )
                        }
                        encoder.releaseOutputBuffer(indiceSalida, false)
                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
                    }
                }
            }
        }

        while (!entradaTerminada) {
            val indiceEntrada = encoder.dequeueInputBuffer(10_000)
            if (indiceEntrada >= 0) {
                val buffer = encoder.getInputBuffer(indiceEntrada)!!
                buffer.clear()
                val restante = bytesPcm.size - offset
                if (restante <= 0) {
                    encoder.queueInputBuffer(indiceEntrada, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                    entradaTerminada = true
                } else {
                    val tam = minOf(bytesPorFrame, restante)
                    buffer.put(bytesPcm, offset, tam)
                    encoder.queueInputBuffer(indiceEntrada, 0, tam, pts, 0)
                    offset += tam
                    pts += frameDurationUs
                }
            }
            drenar()
        }
        drenar()

        encoder.stop()
        encoder.release()

        return PistaCodificada(salidaFormato ?: format, muestras)
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew.bat compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenVideoEncoder.kt
git commit -m "feat: encode resumen cards + background music into an mp4"
```

---

### Task 5: FileProvider + WhatsApp video share (`CompartirUtil`)

**Files:**
- Create: `app/src/main/res/xml/file_paths.xml`
- Modify: `app/src/main/AndroidManifest.xml`
- Create: `app/src/main/java/com/osfit/app/util/CompartirUtil.kt`
- Modify: `app/build.gradle.kts`

**Interfaces:**
- Produces: `CompartirUtil.compartirVideo(context: Context, video: File)`.

- [ ] **Step 1: Add the FileProvider path config**

Create `app/src/main/res/xml/file_paths.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="resumenes" path="resumenes/" />
</paths>
```

- [ ] **Step 2: Register the FileProvider in the manifest**

In `app/src/main/AndroidManifest.xml`, add the `<provider>` block inside `<application>`, after the closing `</activity>` tag:

```xml
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="com.osfit.app.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
```

- [ ] **Step 3: Ensure `androidx.core` (FileProvider) is on the classpath**

In `app/build.gradle.kts`, add this line inside the `dependencies { ... }` block, next to the other `androidx` implementations:

```kotlin
    implementation("androidx.core:core-ktx:1.13.1")
```

- [ ] **Step 4: Write `CompartirUtil`**

Create `app/src/main/java/com/osfit/app/util/CompartirUtil.kt`:

```kotlin
package com.osfit.app.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File

object CompartirUtil {

    private const val AUTORIDAD_FILE_PROVIDER = "com.osfit.app.fileprovider"

    /** Comparte un video mp4 apuntando a WhatsApp; si no está instalado, cae al selector genérico. */
    fun compartirVideo(context: Context, video: File) {
        val uri = FileProvider.getUriForFile(context, AUTORIDAD_FILE_PROVIDER, video)
        val intentBase = Intent(Intent.ACTION_SEND).apply {
            type = "video/mp4"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            context.startActivity(Intent(intentBase).setPackage("com.whatsapp"))
        } catch (e: ActivityNotFoundException) {
            context.startActivity(Intent.createChooser(intentBase, "Compartir resumen"))
        }
    }
}
```

- [ ] **Step 5: Verify it compiles**

Run: `./gradlew.bat compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add app/src/main/res/xml/file_paths.xml app/src/main/AndroidManifest.xml app/build.gradle.kts app/src/main/java/com/osfit/app/util/CompartirUtil.kt
git commit -m "feat: add FileProvider and WhatsApp video sharing"
```

---

### Task 6: `ResumenClienteViewModel`

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/clientes/ResumenClienteViewModel.kt`

**Interfaces:**
- Consumes: `ResumenClienteCalculator.rangoSemanal/rangoMensual/calcularResumenCliente` (Tasks 1-2); `ClienteRepository.observarCliente(clienteId): Flow<Cliente?>` and `.observarClientes(): Flow<List<Cliente>>` (`app/src/main/java/com/osfit/app/data/repository/ClienteRepository.kt:17,31`); `AsistenciaRepository.observarAsistenciasPorRango(fechaInicio, fechaFin): Flow<List<Asistencia>>` (`app/src/main/java/com/osfit/app/data/repository/AsistenciaRepository.kt:35`); `AppContainer.clienteRepository` / `.asistenciaRepository`.
- Produces: `class ResumenClienteViewModel(clienteId: String)` with `suspend fun calcularResumenSemanal(fechaReferencia: LocalDate = LocalDate.now()): ResumenClienteData?` and `suspend fun calcularResumenMensual(mes: YearMonth = YearMonth.now()): ResumenClienteData?`.

No unit test — this class only wires Firestore-backed repositories together (matches the project's existing convention: no ViewModel in this codebase has a JVM test, since they all touch `FirebaseFirestore.getInstance()`). Verified on-device in Task 7.

- [ ] **Step 1: Write the implementation**

Create `app/src/main/java/com/osfit/app/ui/clientes/ResumenClienteViewModel.kt`:

```kotlin
package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import com.osfit.app.data.AppContainer
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.domain.RangoResumen
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.domain.ResumenClienteData
import java.time.LocalDate
import java.time.YearMonth
import kotlinx.coroutines.flow.first

class ResumenClienteViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository
) : ViewModel() {

    suspend fun calcularResumenSemanal(fechaReferencia: LocalDate = LocalDate.now()): ResumenClienteData? =
        calcularResumen(ResumenClienteCalculator.rangoSemanal(fechaReferencia))

    suspend fun calcularResumenMensual(mes: YearMonth = YearMonth.now()): ResumenClienteData? =
        calcularResumen(ResumenClienteCalculator.rangoMensual(mes))

    private suspend fun calcularResumen(rango: RangoResumen): ResumenClienteData? {
        val cliente = clienteRepository.observarCliente(clienteId).first() ?: return null
        val clientesActivos = clienteRepository.observarClientes().first().filter { it.activo }
        // El cliente del resumen debe entrar en su propia comparación aunque esté inactivo.
        val clientesParaRanking = if (clientesActivos.any { it.id == cliente.id }) {
            clientesActivos
        } else {
            clientesActivos + cliente
        }
        val asistencias = asistenciaRepository.observarAsistenciasPorRango(
            rango.inicio.toString(),
            rango.fin.toString()
        ).first()
        return ResumenClienteCalculator.calcularResumenCliente(cliente, clientesParaRanking, asistencias, rango)
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew.bat compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/ResumenClienteViewModel.kt
git commit -m "feat: add ResumenClienteViewModel to compute weekly/monthly recaps"
```

---

### Task 7: Orchestration + UI wiring (final integration)

**Files:**
- Create: `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`

**Interfaces:**
- Consumes: `TarjetaResumen` + `ResumenCardRenderer.renderizar` (Task 3); `ResumenVideoEncoder.generar` (Task 4); `CompartirUtil.compartirVideo` (Task 5); `ResumenClienteViewModel` (Task 6); `ResumenClienteData`, `TipoResumen` (Task 1-2).
- Produces: `ResumenVideoGenerator.generarYCompartir(context: Context, resumen: ResumenClienteData)` (suspend); `ResumenVideoGenerator.construirTarjetas(resumen: ResumenClienteData): List<TarjetaResumen>`; two new buttons in `ClienteDetailScreen`.

This is the end-to-end integration task — verified manually on-device (no unit test covers UI+Firestore+MediaCodec together).

- [ ] **Step 1: Write the orchestrator**

Create `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt`:

```kotlin
package com.osfit.app.video

import android.content.Context
import com.osfit.app.domain.ResumenClienteData
import com.osfit.app.domain.TipoResumen
import com.osfit.app.util.CompartirUtil
import java.io.File

object ResumenVideoGenerator {

    private const val SEGUNDOS_POR_TARJETA = 8

    suspend fun generarYCompartir(context: Context, resumen: ResumenClienteData) {
        val tarjetas = construirTarjetas(resumen).map { ResumenCardRenderer.renderizar(it) }
        val salida = File(context.cacheDir, "resumenes/${resumen.cliente.id}_${resumen.rango.tipo}.mp4")
        ResumenVideoEncoder.generar(
            tarjetas = tarjetas,
            segundosPorTarjeta = SEGUNDOS_POR_TARJETA,
            context = context,
            salida = salida
        )
        CompartirUtil.compartirVideo(context, salida)
    }

    fun construirTarjetas(resumen: ResumenClienteData): List<TarjetaResumen> {
        val unidad = if (resumen.rango.tipo == TipoResumen.SEMANAL) "semana" else "mes"
        val tarjetas = mutableListOf<TarjetaResumen>(
            TarjetaResumen.Asistencia(
                encabezado = resumen.rango.encabezado,
                nombreCliente = resumen.cliente.nombre,
                dias = resumen.diasAsistidos,
                unidad = unidad,
                ranking = resumen.rankingAsistencia
            ),
            TarjetaResumen.Tiempo(
                minutos = resumen.minutosEnGym,
                ranking = resumen.rankingTiempo
            ),
            TarjetaResumen.DiaFavorito(
                nombreDia = resumen.diaFavoritoNombre,
                unidad = unidad
            )
        )
        val racha = resumen.rachaMasLarga
        val rankingRacha = resumen.rankingRacha
        if (resumen.rango.tipo == TipoResumen.MENSUAL && racha != null && rankingRacha != null) {
            tarjetas += TarjetaResumen.RachaMasLarga(dias = racha, ranking = rankingRacha)
        }
        return tarjetas
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew.bat compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Wire the buttons into `ClienteDetailScreen`**

In `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`:

Add these imports alongside the existing ones (after `import com.osfit.app.data.model.Rutina`):

```kotlin
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.runtime.rememberCoroutineScope
import com.osfit.app.video.ResumenVideoGenerator
import kotlinx.coroutines.launch
```

Inside `fun ClienteDetailScreen(...)`, right after the existing `val rachaActual by viewModel.rachaActual.collectAsState()` line, add:

```kotlin
    val resumenViewModel: ResumenClienteViewModel = viewModel(
        factory = viewModelFactory { initializer { ResumenClienteViewModel(clienteId) } }
    )
    var generandoResumen by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
```

Immediately after the `item { ... }` block that ends with the "Estadísticas" / "Confirmar Asistencia" row (the block containing `onVerEstadisticas(clienteId)`), add a new `item { ... }` block with the two recap buttons:

```kotlin
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.Videocam,
                        texto = if (generandoResumen) "Generando..." else "Resumen semanal",
                        modifier = Modifier.weight(1f),
                        onClick = {
                            if (!generandoResumen) {
                                generandoResumen = true
                                scope.launch {
                                    val resumen = resumenViewModel.calcularResumenSemanal()
                                    if (resumen != null) {
                                        ResumenVideoGenerator.generarYCompartir(context, resumen)
                                    }
                                    generandoResumen = false
                                }
                            }
                        }
                    )
                    AccionCard(
                        icono = Icons.Filled.Videocam,
                        texto = if (generandoResumen) "Generando..." else "Resumen mensual",
                        modifier = Modifier.weight(1f),
                        onClick = {
                            if (!generandoResumen) {
                                generandoResumen = true
                                scope.launch {
                                    val resumen = resumenViewModel.calcularResumenMensual()
                                    if (resumen != null) {
                                        ResumenVideoGenerator.generarYCompartir(context, resumen)
                                    }
                                    generandoResumen = false
                                }
                            }
                        }
                    )
                }
            }
```

(`context` is already available in this function — it's assigned a few lines above via `val context = LocalContext.current`.)

- [ ] **Step 4: Verify it compiles**

Run: `./gradlew.bat compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Run the full unit test suite (regression check)**

Run: `./gradlew.bat testDebugUnitTest`
Expected: PASS, all tests (existing + the new `ResumenClienteCalculatorTest`)

- [ ] **Step 6: Install on a connected device and verify manually**

Run: `./gradlew.bat installDebug` (device must be visible in `adb devices` first)

On the phone:
1. Open a client with at least one attendance record that has a `duracionMinutos` value (use the "Iniciar tiempo"/"Detener" cronómetro from the Asistencia screen if needed to create one).
2. Go to that client's profile, tap "Resumen semanal". Confirm a short progress state shows, then WhatsApp opens with a video attached.
3. Play the generated video from WhatsApp's preview (or share it to yourself first): confirm it shows the cards in order, each one readable, with audio if `res/raw/resumen_musica.*` was placed (silent otherwise), and that the ranking/leyenda text on screen matches what you'd expect from that client's data relative to the others.
4. Repeat for "Resumen mensual" and confirm the 4th card (racha más larga) appears.

If any of this fails, do not commit — fix the encoder/renderer and re-run this step.

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt
git commit -m "feat: wire weekly/monthly recap video generation and sharing into client profile"
```
