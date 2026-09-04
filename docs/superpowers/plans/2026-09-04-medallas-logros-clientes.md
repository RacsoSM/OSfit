# Medallas y logros por cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Award each client an automatic (trainer-adjustable) medal per quincena based on which stat they led, show it in a new closing video scene, and keep a per-client history in their profile.

**Architecture:** Two new rankings (Esfuerzo, Constancia) join the three that already exist inside `ResumenClienteData`; a pure domain function picks the winning category from those five; a Firestore-backed catalog (5 fixed automatic medals + trainer-created subjective ones) and a per-client award history back a new drawer screen, a confirm/adjust dialog inserted into the existing quincenal-generation flow, a new "Logros" profile card, and a new video scene rendered with the same hand-drawn Canvas style already used for the donut chart (no bundled image assets for the default medals — only trainer-uploaded custom images use `Bitmap`).

**Tech Stack:** Kotlin, Jetpack Compose (Material3), Firebase Firestore, Android `Canvas`/`MediaCodec` (existing video pipeline), JUnit4 for domain tests.

**Spec:** `docs/superpowers/specs/2026-09-04-medallas-logros-design.md`

## Global Constraints

- Only the **quincenal** resumen gets the medal flow and scene. Semanal and mensual are untouched.
- The 5 automatic categories (`ASISTENCIA`, `TIEMPO`, `RACHA`, `ESFUERZO`, `CONSTANCIA`) are never deletable from the catalog, only editable (name/image).
- Nothing enforces "one medal per category per quincena" across clients — the trainer can manually award the same medal to more than one client.
- A client who isn't in 1st place in any of the 5 categories gets no automatic suggestion (not "closest to 1st").
- Every new domain function gets a JVM unit test (`ResumenClienteCalculatorTest`, new `MedallaCalculatorTest`, `ResumenVideoGeneratorTest`). Firestore repositories, Compose screens, and `Canvas` rendering are **not** unit-tested in this codebase (no existing precedent for it) — verified on-device in the final task, same as every prior video-scene change this session.
- Follow existing repository conventions exactly: subcollections under `clientes/{id}/...` (like `PagoRepository`), plain classes (not interfaces) for repos other than `ClienteRepository` (like `RutinaRepository`), `ViewModel`s read `AppContainer` by default constructor param.

---

### Task 1: Domain — add Esfuerzo and Constancia rankings to `ResumenClienteData`

**Files:**
- Modify: `app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt`
- Test: `app/src/test/java/com/osfit/app/domain/ResumenClienteCalculatorTest.kt`

**Interfaces:**
- Produces: `ResumenClienteData.rankingEsfuerzo: RankingResultado?`, `ResumenClienteData.rankingConstancia: RankingResultado?` — consumed by Task 2 (`MedallaCalculator`) and Task 6 (`ResumenVideoGeneratorTest` fixtures).

- [ ] **Step 1: Write the failing tests**

Add to `ResumenClienteCalculatorTest.kt` (anywhere after the existing `calcularResumenCliente...` tests):

```kotlin
@Test
fun `calcularResumenCliente calcula rankingEsfuerzo comparando porcentaje entrenando`() {
    val cliente = Cliente(id = "a", nombre = "Ana", activo = true, segundosPorEjercicio = 40, minutosDescanso = 1.0)
    val otro = Cliente(id = "b", nombre = "Beto", activo = true, segundosPorEjercicio = 20, minutosDescanso = 1.0)
    val rango = RangoResumen(
        inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
        tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
    )
    val asistencias = listOf(
        Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, duracionMinutos = 60),
        Asistencia(clienteId = "b", fecha = "2024-03-18", asistio = true, duracionMinutos = 60)
    )
    val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente, otro), asistencias, rango)

    // Ana: ciclo 40+60=100s, fracción 0.4 -> 40%. Beto: ciclo 20+60=80s, fracción 0.25 -> 25%.
    assertEquals(1, resumen.rankingEsfuerzo?.puesto)
    assertEquals(emptyList<String>(), resumen.rankingEsfuerzo?.nombresPorEncima)
}

@Test
fun `calcularResumenCliente deja rankingEsfuerzo nulo sin segundosPorEjercicio configurado`() {
    val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
    val rango = RangoResumen(
        inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
        tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
    )
    val asistencias = listOf(Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, duracionMinutos = 60))
    val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente), asistencias, rango)

    assertEquals(null, resumen.rankingEsfuerzo)
}

@Test
fun `calcularResumenCliente calcula rankingConstancia por proporcion del dia mas repetido`() {
    val diasA = listOf(DiaRutina(nombreDia = "Pecho"), DiaRutina(nombreDia = "Espalda"))
    val cliente = Cliente(id = "a", nombre = "Ana", activo = true, rutinaAsignada = Rutina(dias = diasA))
    val otro = Cliente(id = "b", nombre = "Beto", activo = true, rutinaAsignada = Rutina(dias = diasA))
    val rango = RangoResumen(
        inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
        tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
    )
    // Ana: 3 asistencias, las 3 el mismo día -> 100% de constancia.
    // Beto: 4 asistencias, 2 en el mismo día -> 50% de constancia.
    val asistencias = listOf(
        Asistencia(clienteId = "a", fecha = "2024-03-18", asistio = true, diaRutinaRealizado = 0),
        Asistencia(clienteId = "a", fecha = "2024-03-19", asistio = true, diaRutinaRealizado = 0),
        Asistencia(clienteId = "a", fecha = "2024-03-20", asistio = true, diaRutinaRealizado = 0),
        Asistencia(clienteId = "b", fecha = "2024-03-18", asistio = true, diaRutinaRealizado = 0),
        Asistencia(clienteId = "b", fecha = "2024-03-19", asistio = true, diaRutinaRealizado = 0),
        Asistencia(clienteId = "b", fecha = "2024-03-20", asistio = true, diaRutinaRealizado = 1),
        Asistencia(clienteId = "b", fecha = "2024-03-21", asistio = true, diaRutinaRealizado = 1)
    )
    val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente, otro), asistencias, rango)

    assertEquals(1, resumen.rankingConstancia?.puesto)
    assertEquals(emptyList<String>(), resumen.rankingConstancia?.nombresPorEncima)
}

@Test
fun `calcularResumenCliente deja rankingConstancia nulo sin asistencias`() {
    val cliente = Cliente(id = "a", nombre = "Ana", activo = true)
    val rango = RangoResumen(
        inicio = LocalDate.of(2024, 3, 18), fin = LocalDate.of(2024, 3, 22),
        tipo = TipoResumen.SEMANAL, encabezado = "Semana 4 de marzo"
    )
    val resumen = ResumenClienteCalculator.calcularResumenCliente(cliente, listOf(cliente), emptyList(), rango)

    assertEquals(null, resumen.rankingConstancia)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :app:testDebugUnitTest --tests "com.osfit.app.domain.ResumenClienteCalculatorTest"`
Expected: FAIL — `rankingEsfuerzo`/`rankingConstancia` don't exist on `ResumenClienteData` yet (compile error).

- [ ] **Step 3: Add the two fields to `ResumenClienteData`**

In `ResumenClienteCalculator.kt`, change the data class:

```kotlin
data class ResumenClienteData(
    val cliente: Cliente,
    val rango: RangoResumen,
    val diasAsistidos: Int,
    val rankingAsistencia: RankingResultado,
    val minutosEnGym: Int,
    val rankingTiempo: RankingResultado,
    val diaFavoritoNombre: String?,
    val rachaMasLarga: Int?,
    val rankingRacha: RankingResultado?,
    val desgloseEsfuerzo: DesgloseEsfuerzo? = null,
    val tiempoPorDia: List<PuntoTiempoDiario> = emptyList(),
    val conteoDias: List<ConteoDiaRutina> = emptyList(),
    // Ranking cruzado contra clientesActivos por porcentaje entrenando (DesgloseEsfuerzo).
    // null si el propio cliente no tiene segundosPorEjercicio/minutosDescanso configurados.
    val rankingEsfuerzo: RankingResultado? = null,
    // Ranking cruzado contra clientesActivos por (máximo de conteoDias) / diasAsistidos: qué
    // tan seguido repite su día más frecuente, relativo a cuánto asistió en total. null si el
    // propio cliente no tiene asistencias en el rango.
    val rankingConstancia: RankingResultado? = null
)
```

- [ ] **Step 4: Compute both rankings in `calcularResumenCliente`**

Replace the body of `calcularResumenCliente` (keep the signature and the final `return` shape, just insert the two new blocks and thread the values into the return):

```kotlin
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

    val desgloseEsfuerzo = calcularDesgloseEsfuerzo(
        minutosEnGym = minutosEnGym,
        segundosPorEjercicio = cliente.segundosPorEjercicio,
        minutosDescanso = cliente.minutosDescanso
    )
    // Solo compara contra clientes que también tengan segundos/descanso configurados: el
    // porcentaje entrenando no es comparable si al otro cliente le falta ese dato.
    val valoresEsfuerzo = clientesActivos.mapNotNull { c ->
        val minutosC = asistenciasPorCliente[c.id]?.sumOf { it.duracionMinutos ?: 0 } ?: 0
        calcularDesgloseEsfuerzo(minutosC, c.segundosPorEjercicio, c.minutosDescanso)?.let { c to it.porcentajeEntrenando }
    }
    val rankingEsfuerzo = if (desgloseEsfuerzo != null) calcularRanking(valoresEsfuerzo, cliente.id) else null

    val nombresDias = cliente.rutinaAsignada?.dias?.map { it.nombreDia } ?: emptyList()
    val asistenciasDelCliente = asistenciasPorCliente[cliente.id] ?: emptyList()
    val conteoDias = conteoDiasEnRango(asistenciasDelCliente, nombresDias)
    val diaFavoritoNombre = diaFavoritoEnRango(asistenciasDelCliente, nombresDias)

    // Constancia: qué tan seguido repite su día más frecuente, relativo a cuánto asistió en
    // total (si no, quien asiste más siempre ganaría solo por acumular más repeticiones).
    // Escalado a entero (x1000) porque calcularRanking compara valores Int.
    val valoresConstancia = clientesActivos.mapNotNull { c ->
        val asistenciasC = asistenciasPorCliente[c.id] ?: emptyList()
        if (asistenciasC.isEmpty()) return@mapNotNull null
        val nombresDiasC = c.rutinaAsignada?.dias?.map { it.nombreDia } ?: emptyList()
        val maximoC = conteoDiasEnRango(asistenciasC, nombresDiasC).maxOfOrNull { it.veces } ?: 0
        c to (maximoC * 1000 / asistenciasC.size)
    }
    val rankingConstancia = if (diasAsistidos > 0) calcularRanking(valoresConstancia, cliente.id) else null

    var rachaMasLarga: Int? = null
    var rankingRacha: RankingResultado? = null
    if (rango.tipo == TipoResumen.MENSUAL || rango.tipo == TipoResumen.QUINCENAL) {
        val registrosPorCliente = asistenciasEnRango.groupBy { it.clienteId }
        val fechasCliente = RachaCalculator.fechasQueCuentan(registrosPorCliente[cliente.id].orEmpty())
        rachaMasLarga = RachaCalculator.calcularRachaMasLargaEnRango(fechasCliente, rango.inicio, rango.fin)
        val valoresRacha = clientesActivos.map { c ->
            val fechas = RachaCalculator.fechasQueCuentan(registrosPorCliente[c.id].orEmpty())
            c to RachaCalculator.calcularRachaMasLargaEnRango(fechas, rango.inicio, rango.fin)
        }
        rankingRacha = calcularRanking(valoresRacha, cliente.id)
    }

    val tiempoPorDia = tiempoPorDiaEnRango(
        asistenciasEnRango.filter { it.clienteId == cliente.id },
        rango
    )

    return ResumenClienteData(
        cliente = cliente,
        rango = rango,
        diasAsistidos = diasAsistidos,
        rankingAsistencia = rankingAsistencia,
        minutosEnGym = minutosEnGym,
        rankingTiempo = rankingTiempo,
        diaFavoritoNombre = diaFavoritoNombre,
        rachaMasLarga = rachaMasLarga,
        rankingRacha = rankingRacha,
        desgloseEsfuerzo = desgloseEsfuerzo,
        tiempoPorDia = tiempoPorDia,
        conteoDias = conteoDias,
        rankingEsfuerzo = rankingEsfuerzo,
        rankingConstancia = rankingConstancia
    )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./gradlew :app:testDebugUnitTest --tests "com.osfit.app.domain.ResumenClienteCalculatorTest"`
Expected: PASS, all tests including the 4 new ones.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/ResumenClienteCalculator.kt app/src/test/java/com/osfit/app/domain/ResumenClienteCalculatorTest.kt
git commit -m "feat: add rankingEsfuerzo and rankingConstancia to ResumenClienteData

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Domain — `CategoriaMedallaAutomatica` enum and `MedallaCalculator`

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/MedallaCatalogo.kt` (enum lives here — it's a persisted field type, same layering as other `data/model` types domain already imports)
- Create: `app/src/main/java/com/osfit/app/domain/MedallaCalculator.kt`
- Test: `app/src/test/java/com/osfit/app/domain/MedallaCalculatorTest.kt`

**Interfaces:**
- Consumes: `ResumenClienteData` (Task 1) — reads `rankingAsistencia`, `rankingTiempo`, `rankingRacha`, `rankingEsfuerzo`, `rankingConstancia`.
- Produces: `CategoriaMedallaAutomatica` enum, `MedallaCalculator.sugerirCategoria(resumen: ResumenClienteData): CategoriaMedallaAutomatica?` — consumed by Task 13 (`ResumenClienteViewModel.prepararConfirmacionMedalla`).

- [ ] **Step 1: Create the enum (and the `MedallaCatalogo` data class it will live alongside — declared fully in Task 3, stub it here so the enum compiles standalone)**

`app/src/main/java/com/osfit/app/data/model/MedallaCatalogo.kt`:

```kotlin
package com.osfit.app.data.model

enum class CategoriaMedallaAutomatica { ASISTENCIA, TIEMPO, RACHA, ESFUERZO, CONSTANCIA }

data class MedallaCatalogo(
    val id: String = "",
    val nombre: String = "",
    // null = medalla subjetiva (creada y otorgada manualmente, sin fórmula de ranking).
    val categoria: CategoriaMedallaAutomatica? = null,
    // Nombre de archivo en filesDir/medallas/; null = usa la insignia por defecto de la
    // categoría (dibujada por el renderer, no hay imagen empaquetada) o el ícono genérico
    // si es subjetiva sin imagen propia.
    val imagenArchivo: String? = null
)
```

- [ ] **Step 2: Write the failing tests**

`app/src/test/java/com/osfit/app/domain/MedallaCalculatorTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.CategoriaMedallaAutomatica
import com.osfit.app.data.model.Cliente
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class MedallaCalculatorTest {

    private val rangoDummy = RangoResumen(
        inicio = LocalDate.of(2024, 3, 1), fin = LocalDate.of(2024, 3, 15),
        tipo = TipoResumen.QUINCENAL, encabezado = "1ra quincena de marzo"
    )
    private val primero = RankingResultado(puesto = 1, nombresPorEncima = emptyList())
    private val segundo = RankingResultado(puesto = 2, nombresPorEncima = listOf("Otro"))

    private fun resumen(
        rankingAsistencia: RankingResultado = segundo,
        rankingTiempo: RankingResultado = segundo,
        rankingRacha: RankingResultado? = segundo,
        rankingEsfuerzo: RankingResultado? = segundo,
        rankingConstancia: RankingResultado? = segundo
    ) = ResumenClienteData(
        cliente = Cliente(id = "a", nombre = "Ana"),
        rango = rangoDummy,
        diasAsistidos = 5,
        rankingAsistencia = rankingAsistencia,
        minutosEnGym = 200,
        rankingTiempo = rankingTiempo,
        diaFavoritoNombre = "Lunes",
        rachaMasLarga = 3,
        rankingRacha = rankingRacha,
        rankingEsfuerzo = rankingEsfuerzo,
        rankingConstancia = rankingConstancia
    )

    @Test
    fun `sugiere la unica categoria donde el cliente quedo en puesto 1`() {
        val resumen = resumen(rankingEsfuerzo = primero)
        assertEquals(CategoriaMedallaAutomatica.ESFUERZO, MedallaCalculator.sugerirCategoria(resumen))
    }

    @Test
    fun `sin puesto 1 en ninguna categoria no sugiere nada`() {
        assertEquals(null, MedallaCalculator.sugerirCategoria(resumen()))
    }

    @Test
    fun `con empate en varias categorias del mismo cliente usa el orden de prioridad`() {
        // Prioridad: Asistencia > Tiempo > Racha > Esfuerzo > Constancia
        val resumen = resumen(rankingRacha = primero, rankingConstancia = primero, rankingTiempo = primero)
        assertEquals(CategoriaMedallaAutomatica.TIEMPO, MedallaCalculator.sugerirCategoria(resumen))
    }

    @Test
    fun `un empate real en el numero ya deja a ambos clientes en puesto 1, sin logica extra aqui`() {
        // calcularRanking ya resuelve esto: dos clientes con el mismo valor comparten puesto 1,
        // cada uno con su propio RankingResultado(puesto = 1, ...) independiente.
        val cliente1 = resumen(rankingAsistencia = primero)
        val cliente2 = resumen(rankingAsistencia = primero)
        assertEquals(CategoriaMedallaAutomatica.ASISTENCIA, MedallaCalculator.sugerirCategoria(cliente1))
        assertEquals(CategoriaMedallaAutomatica.ASISTENCIA, MedallaCalculator.sugerirCategoria(cliente2))
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `./gradlew :app:testDebugUnitTest --tests "com.osfit.app.domain.MedallaCalculatorTest"`
Expected: FAIL — `MedallaCalculator` doesn't exist yet (compile error).

- [ ] **Step 4: Implement `MedallaCalculator`**

`app/src/main/java/com/osfit/app/domain/MedallaCalculator.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.CategoriaMedallaAutomatica
import com.osfit.app.data.model.CategoriaMedallaAutomatica.ASISTENCIA
import com.osfit.app.data.model.CategoriaMedallaAutomatica.CONSTANCIA
import com.osfit.app.data.model.CategoriaMedallaAutomatica.ESFUERZO
import com.osfit.app.data.model.CategoriaMedallaAutomatica.RACHA
import com.osfit.app.data.model.CategoriaMedallaAutomatica.TIEMPO

/**
 * Decide qué categoría de medalla automática sugerir para un cliente, a partir de los
 * rankings ya calculados en su propio [ResumenClienteData] (comparados contra los demás
 * clientes activos por [ResumenClienteCalculator.calcularResumenCliente]). Un empate real en
 * el número ya deja a más de un cliente en puesto 1 -eso lo resuelve `calcularRanking`-, así
 * que esta función solo decide, para ESTE cliente, cuál de sus categorías en puesto 1 mostrar
 * cuando ganó más de una.
 */
object MedallaCalculator {

    // Orden de prioridad fijo para desempatar entre categorías del MISMO cliente cuando quedó
    // en puesto 1 en más de una — nunca desempata entre personas.
    private val PRIORIDAD = listOf(ASISTENCIA, TIEMPO, RACHA, ESFUERZO, CONSTANCIA)

    fun sugerirCategoria(resumen: ResumenClienteData): CategoriaMedallaAutomatica? {
        val candidatas = buildSet {
            if (resumen.rankingAsistencia.puesto == 1) add(ASISTENCIA)
            if (resumen.rankingTiempo.puesto == 1) add(TIEMPO)
            if (resumen.rankingRacha?.puesto == 1) add(RACHA)
            if (resumen.rankingEsfuerzo?.puesto == 1) add(ESFUERZO)
            if (resumen.rankingConstancia?.puesto == 1) add(CONSTANCIA)
        }
        return PRIORIDAD.firstOrNull { it in candidatas }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./gradlew :app:testDebugUnitTest --tests "com.osfit.app.domain.MedallaCalculatorTest"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/MedallaCatalogo.kt app/src/main/java/com/osfit/app/domain/MedallaCalculator.kt app/src/test/java/com/osfit/app/domain/MedallaCalculatorTest.kt
git commit -m "feat: add MedallaCalculator to pick a client's standout category

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Data — `MedallaOtorgada` model, `MedallaRepository`, `AppContainer` wiring

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/MedallaOtorgada.kt`
- Create: `app/src/main/java/com/osfit/app/data/repository/MedallaRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/data/AppContainer.kt`

**Interfaces:**
- Consumes: `MedallaCatalogo`, `CategoriaMedallaAutomatica` (Task 2).
- Produces: `MedallaOtorgada` data class; `MedallaRepository` with `observarCatalogo()`, `asegurarCategoriasAutomaticas()`, `guardarMedalla(medalla)`, `eliminarMedalla(medalla)`, `observarOtorgadas(clienteId)`, `otorgarMedalla(clienteId, otorgada)` — consumed by Task 9 (`MedallasViewModel`), Task 10 (`ClienteDetailViewModel`), Task 13 (`ResumenClienteViewModel`). `AppContainer.medallaRepository` — consumed by all of those (default constructor param).

No unit test task: this is a thin Firestore wrapper, same as `RutinaRepository`/`PagoRepository`, which have no unit tests in this codebase either. Verify by compiling.

- [ ] **Step 1: Create `MedallaOtorgada`**

`app/src/main/java/com/osfit/app/data/model/MedallaOtorgada.kt`:

```kotlin
package com.osfit.app.data.model

data class MedallaOtorgada(
    // ISO date del inicio de la quincena; también el id del documento (upsert por período).
    val rangoInicio: String = "",
    val medallaId: String = "",
    // Copia del nombre al momento de otorgarla: si el catálogo se edita después, el
    // historial en "Logros" no cambia retroactivamente.
    val nombreMedalla: String = "",
    val encabezadoRango: String = "", // "2da quincena de agosto"
    val fueAjustadaManualmente: Boolean = false
)
```

- [ ] **Step 2: Create `MedallaRepository`**

`app/src/main/java/com/osfit/app/data/repository/MedallaRepository.kt`:

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.CategoriaMedallaAutomatica
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.model.MedallaOtorgada
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class MedallaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val catalogo = db.collection("medallas")
    private fun otorgadasCollection(clienteId: String) =
        db.collection("clientes").document(clienteId).collection("medallas")

    fun observarCatalogo(): Flow<List<MedallaCatalogo>> = callbackFlow {
        val registro = catalogo.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val medallas = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(MedallaCatalogo::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(medallas)
        }
        awaitClose { registro.remove() }
    }

    /** Siembra las 5 categorías automáticas con id fijo (su nombre en minúsculas) si todavía
     *  no existen. Idempotente: nunca pisa una que ya exista, para no perder un nombre o
     *  imagen que el trainer ya haya editado. */
    suspend fun asegurarCategoriasAutomaticas() {
        val existentes = catalogo.get().await().documents.map { it.id }.toSet()
        val faltantes = CategoriaMedallaAutomatica.entries.filter { it.name.lowercase() !in existentes }
        if (faltantes.isEmpty()) return
        val batch = db.batch()
        faltantes.forEach { cat ->
            val medalla = MedallaCatalogo(nombre = nombrePorDefecto(cat), categoria = cat)
            batch.set(catalogo.document(cat.name.lowercase()), medalla.copy(id = ""))
        }
        batch.commit().await()
    }

    private fun nombrePorDefecto(categoria: CategoriaMedallaAutomatica): String = when (categoria) {
        CategoriaMedallaAutomatica.ASISTENCIA -> "Rey de la asistencia"
        CategoriaMedallaAutomatica.TIEMPO -> "Rey del tiempo"
        CategoriaMedallaAutomatica.RACHA -> "Racha imparable"
        CategoriaMedallaAutomatica.ESFUERZO -> "Máquina de entrenar"
        CategoriaMedallaAutomatica.CONSTANCIA -> "El más constante"
    }

    /** [medalla.id] no puede estar vacío: las 5 automáticas usan su nombre de categoría en
     *  minúsculas, y una subjetiva nueva debe traer un id generado por quien llama (ver
     *  MedallasScreen, Task 9) — así la imagen se puede copiar a filesDir/medallas/<id> antes
     *  de guardar el documento, sin depender de un id que Firestore recién genere después. */
    suspend fun guardarMedalla(medalla: MedallaCatalogo) {
        require(medalla.id.isNotBlank()) { "MedallaCatalogo.id no puede estar vacío al guardar" }
        catalogo.document(medalla.id).set(medalla.copy(id = "")).await()
    }

    /** Lanza [IllegalArgumentException] si [medalla] es una de las 5 automáticas: no son
     *  borrables, solo editables (nombre/imagen). */
    suspend fun eliminarMedalla(medalla: MedallaCatalogo) {
        require(medalla.categoria == null) { "No se puede borrar una categoría automática" }
        catalogo.document(medalla.id).delete().await()
    }

    fun observarOtorgadas(clienteId: String): Flow<List<MedallaOtorgada>> = callbackFlow {
        val registro = otorgadasCollection(clienteId)
            .orderBy("rangoInicio", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val otorgadas = snapshot?.documents?.mapNotNull { doc -> doc.toObject(MedallaOtorgada::class.java) } ?: emptyList()
                trySend(otorgadas)
            }
        awaitClose { registro.remove() }
    }

    suspend fun otorgarMedalla(clienteId: String, otorgada: MedallaOtorgada) {
        otorgadasCollection(clienteId).document(otorgada.rangoInicio).set(otorgada).await()
    }
}
```

- [ ] **Step 3: Wire into `AppContainer`**

In `app/src/main/java/com/osfit/app/data/AppContainer.kt`, add the import and the property:

```kotlin
import com.osfit.app.data.repository.MedallaRepository
```

```kotlin
val medallaRepository: MedallaRepository by lazy { MedallaRepository() }
```

- [ ] **Step 4: Verify it compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/MedallaOtorgada.kt app/src/main/java/com/osfit/app/data/repository/MedallaRepository.kt app/src/main/java/com/osfit/app/data/AppContainer.kt
git commit -m "feat: add MedallaRepository (catalog + per-client award history)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `MedallaImagenUtil`

**Files:**
- Create: `app/src/main/java/com/osfit/app/util/MedallaImagenUtil.kt`

**Interfaces:**
- Consumes: `MedallaCatalogo` (Task 2).
- Produces: `MedallaImagenUtil.copiarImagen(context, uri, medallaId): String?`, `eliminarImagen(context, nombreArchivo)`, `cargarBitmapPropio(context, medalla): Bitmap?` — consumed by Task 9 (`MedallasScreen`) and Task 6 (`ResumenVideoGenerator`).

No unit test: mirrors `CancionUtil`, which also has none (needs a real `Context`/`ContentResolver`). Verify by compiling.

- [ ] **Step 1: Implement, mirroring `CancionUtil`'s pattern exactly**

`app/src/main/java/com/osfit/app/util/MedallaImagenUtil.kt`:

```kotlin
package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import com.osfit.app.data.model.MedallaCatalogo
import java.io.File

/**
 * Copia la imagen elegida por el trainer a almacenamiento interno de la app (mismo motivo que
 * [CancionUtil]: un content:// puede perder su permiso de lectura al reiniciar el proceso o si
 * el trainer borra el archivo de su galería).
 */
object MedallaImagenUtil {

    private const val CARPETA = "medallas"

    fun carpetaMedallas(context: Context): File =
        File(context.filesDir, CARPETA).apply { mkdirs() }

    fun archivoImagen(context: Context, nombreArchivo: String): File =
        File(carpetaMedallas(context), nombreArchivo)

    /** Copia el contenido de [uri] a `filesDir/medallas/<medallaId>.<ext>` y devuelve el
     *  nombre de archivo resultante, o null si no se pudo leer/copiar. */
    fun copiarImagen(context: Context, uri: Uri, medallaId: String): String? {
        val extension = extensionDe(context, uri) ?: "jpg"
        val destino = File(carpetaMedallas(context), "$medallaId.$extension")
        return runCatching {
            context.contentResolver.openInputStream(uri)?.use { entrada ->
                destino.outputStream().use { salida -> entrada.copyTo(salida) }
            } ?: return null
            destino.name
        }.getOrNull()
    }

    fun eliminarImagen(context: Context, nombreArchivo: String) {
        runCatching { archivoImagen(context, nombreArchivo).delete() }
    }

    /** Bitmap de la imagen propia de [medalla], o null si no tiene una (medalla automática
     *  sin imagen personalizada, o subjetiva sin imagen): en ese caso quien llama dibuja una
     *  insignia/ícono por defecto en su lugar (ver ResumenFrameRenderer, Task 7). */
    fun cargarBitmapPropio(context: Context, medalla: MedallaCatalogo): Bitmap? {
        val archivo = medalla.imagenArchivo ?: return null
        return runCatching { BitmapFactory.decodeFile(archivoImagen(context, archivo).absolutePath) }.getOrNull()
    }

    private fun extensionDe(context: Context, uri: Uri): String? {
        val tipoMime = context.contentResolver.getType(uri)
        val porMime = tipoMime?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
        if (porMime != null) return porMime

        val nombre = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val indice = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (indice >= 0 && cursor.moveToFirst()) cursor.getString(indice) else null
        }
        return nombre?.substringAfterLast('.', missingDelimiterValue = "")?.takeIf { it.isNotBlank() }
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/util/MedallaImagenUtil.kt
git commit -m "feat: add MedallaImagenUtil for custom medal images

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Video — `EscenaResumen.Medalla` and its timeline duration

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/EscenaResumen.kt`
- Modify: `app/src/main/java/com/osfit/app/video/TimelineResumen.kt`

**Interfaces:**
- Consumes: `CategoriaMedallaAutomatica` (Task 2).
- Produces: `EscenaResumen.Medalla(nombre: String, categoria: CategoriaMedallaAutomatica?, imagenPersonalizada: Bitmap?)` — consumed by Task 6 (`ResumenVideoGenerator`) and Task 7 (`ResumenFrameRenderer`).

- [ ] **Step 1: Add the scene variant**

In `EscenaResumen.kt`, add the import and the variant (order in the sealed class doesn't matter, add it after `RachaMasLarga`):

```kotlin
import android.graphics.Bitmap
import com.osfit.app.data.model.CategoriaMedallaAutomatica
```

```kotlin
data class Medalla(
    val nombre: String,
    // null = medalla subjetiva; usada para elegir el color/glifo de la insignia por defecto
    // cuando no hay imagenPersonalizada.
    val categoria: CategoriaMedallaAutomatica?,
    val imagenPersonalizada: Bitmap?
) : EscenaResumen()
```

- [ ] **Step 2: Add its duration**

In `TimelineResumen.kt`, add a case to `duracionParaTipo`'s `when`:

```kotlin
// 6.5s: el título ("¡Felicidades! Te ganaste:") tarda ~1.8s en escribirse, la imagen hace
// fade 600ms después, y el resto es tiempo para que se lea el nombre de la medalla.
is EscenaResumen.Medalla -> 6_500L
```

- [ ] **Step 3: Verify it compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/EscenaResumen.kt app/src/main/java/com/osfit/app/video/TimelineResumen.kt
git commit -m "feat: add EscenaResumen.Medalla and its timeline duration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Video — wire the Medalla scene into `ResumenVideoGenerator`

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt`
- Test: `app/src/test/java/com/osfit/app/video/ResumenVideoGeneratorTest.kt`

**Interfaces:**
- Consumes: `EscenaResumen.Medalla` (Task 5), `MedallaCatalogo` (Task 2), `MedallaImagenUtil.cargarBitmapPropio` (Task 4).
- Produces: `ResumenVideoGenerator.construirEscenas(resumen, medalla: EscenaResumen.Medalla? = null): List<EscenaResumen>`, `ResumenVideoGenerator.generarYCompartir(context, resumen, medallaOtorgada: MedallaCatalogo? = null, onProgreso)` — consumed by Task 13 (`ResumenClienteViewModel`).

- [ ] **Step 1: Write the failing tests**

Add to `ResumenVideoGeneratorTest.kt` (add the import `com.osfit.app.data.model.CategoriaMedallaAutomatica`):

```kotlin
@Test
fun `la escena Medalla se agrega justo antes de Despedida cuando se pasa una`() {
    val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
    val medalla = EscenaResumen.Medalla(nombre = "Rey de la asistencia", categoria = CategoriaMedallaAutomatica.ASISTENCIA, imagenPersonalizada = null)
    val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, racha = 5), medalla)

    assertEquals(7, escenas.size)
    assertSame(medalla, escenas[5])
    assertTrue(escenas[6] is EscenaResumen.Despedida)
}

@Test
fun `sin medalla no se agrega ninguna escena Medalla`() {
    val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
    val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango))

    assertTrue(escenas.none { it is EscenaResumen.Medalla })
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :app:testDebugUnitTest --tests "com.osfit.app.video.ResumenVideoGeneratorTest"`
Expected: FAIL — `construirEscenas` doesn't accept a second parameter yet (compile error).

- [ ] **Step 3: Add the `medalla` parameter to `construirEscenas`**

In `ResumenVideoGenerator.kt`, change the signature and insert before `Despedida`:

```kotlin
fun construirEscenas(resumen: ResumenClienteData, medalla: EscenaResumen.Medalla? = null): List<EscenaResumen> {
```

...(body unchanged until the end)...

```kotlin
        val racha = resumen.rachaMasLarga
        val rankingRacha = resumen.rankingRacha
        val incluyeRacha = resumen.rango.tipo == TipoResumen.MENSUAL || resumen.rango.tipo == TipoResumen.QUINCENAL
        if (incluyeRacha && racha != null && rankingRacha != null) {
            escenas += EscenaResumen.RachaMasLarga(dias = racha, ranking = rankingRacha)
        }
        if (medalla != null) escenas += medalla
        escenas += EscenaResumen.Despedida
        return escenas
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :app:testDebugUnitTest --tests "com.osfit.app.video.ResumenVideoGeneratorTest"`
Expected: PASS, all tests including the 2 new ones.

- [ ] **Step 5: Thread the confirmed medal through `generarYCompartir`**

In `ResumenVideoGenerator.kt`, add imports:

```kotlin
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.util.MedallaImagenUtil
```

Change `generarYCompartir`'s signature and body:

```kotlin
suspend fun generarYCompartir(
    context: Context,
    resumen: ResumenClienteData,
    medallaOtorgada: MedallaCatalogo? = null,
    onProgreso: (Float) -> Unit = {}
) {
    val ahora = System.currentTimeMillis()
    val carpeta = File(context.cacheDir, "resumenes")
    val salida = File(carpeta, "${resumen.cliente.id}_${resumen.rango.tipo}_$ahora.mp4")
    val medallaEscena = medallaOtorgada?.let {
        EscenaResumen.Medalla(
            nombre = it.nombre,
            categoria = it.categoria,
            imagenPersonalizada = MedallaImagenUtil.cargarBitmapPropio(context, it)
        )
    }
    val timeline = withContext(Dispatchers.Default) {
        borrarResumenesViejos(carpeta, ahora)
        TimelineResumen(construirEscenas(resumen, medallaEscena))
    }
    val fondo = FondoBlobRenderer()
    val cancionArchivo = resumen.cliente.cancionArchivo
    ResumenVideoEncoder.generar(
        duracionTotalMs = timeline.duracionTotalMs,
        fps = FPS,
        context = context,
        salida = salida,
        archivoMusica = cancionArchivo?.let { CancionUtil.archivoCancion(context, it) },
        inicioMusicaSegundos = resumen.cliente.cancionInicioSegundos ?: 0,
        onProgreso = onProgreso
    ) { canvas, tiempoMs ->
        ResumenFrameRenderer.dibujarFrame(canvas, timeline, fondo, tiempoMs)
    }
    CompartirUtil.compartirVideo(context, salida)
}
```

Note this changes `generarYCompartir`'s signature from `(context, resumen, onProgreso)` to `(context, resumen, medallaOtorgada, onProgreso)`. `ResumenClienteViewModel` is the only caller (Task 13 updates it in the same commit as it's introduced — until then this file alone still compiles standalone since `medallaOtorgada` defaults to `null` and `onProgreso` is a trailing lambda, so any positional-lambda caller like `ResumenVideoGenerator.generarYCompartir(contextoApp, resumen) { fraccion -> ... }` still compiles unchanged).

- [ ] **Step 6: Verify it compiles and tests still pass**

Run: `./gradlew :app:testDebugUnitTest --tests "com.osfit.app.video.ResumenVideoGeneratorTest"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt app/src/test/java/com/osfit/app/video/ResumenVideoGeneratorTest.kt
git commit -m "feat: wire the Medalla scene and image resolution into ResumenVideoGenerator

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Video — render the Medalla scene in `ResumenFrameRenderer`

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt`

**Interfaces:**
- Consumes: `EscenaResumen.Medalla` (Task 5).
- Produces: visible rendering of the scene — verified on-device in Task 15 (no unit test: `Canvas`/`Bitmap` rendering has no test precedent in this codebase).

- [ ] **Step 1: Add the import**

```kotlin
import com.osfit.app.data.model.CategoriaMedallaAutomatica
```

- [ ] **Step 2: Add the title text block for the scene**

In `bloquesPara`'s `when`, add a case (anywhere, e.g. right after the `DiaFavorito` case):

```kotlin
is EscenaResumen.Medalla -> listOf(
    BloqueTexto("¡Felicidades! Te ganaste:", inicioMs = 0, duracionMs = 1_800, y = 600f, tamano = 56f, color = Color.WHITE, estilo = Typeface.BOLD)
)
```

- [ ] **Step 3: Hook the image/insignia draw call into `dibujarEscena`**

Right after the existing `if (escena is EscenaResumen.DiaFavorito) { ... }` block:

```kotlin
if (escena is EscenaResumen.Medalla) {
    dibujarMedalla(canvas, ancho, escena, elapsedMs, alpha)
}
```

- [ ] **Step 4: Add the constants and the drawing functions**

Near the other scene-specific constants (e.g. right after `DONA_PALETA_PASTEL`):

```kotlin
private const val MEDALLA_INICIO_MS = 2_000L
private const val MEDALLA_FADE_MS = 600L
/** Mismos colores que [DONA_PALETA_PASTEL], mapeados por categoría (en vez de por índice de
 *  rebanada) para que la insignia por defecto se sienta parte del mismo lenguaje visual del
 *  video. Solo se usa cuando la medalla no tiene imagen propia. */
private val COLOR_INSIGNIA_MEDALLA = mapOf(
    CategoriaMedallaAutomatica.ASISTENCIA to 0xFFA8E6CF.toInt(),
    CategoriaMedallaAutomatica.TIEMPO to 0xFFAEC9F0.toInt(),
    CategoriaMedallaAutomatica.RACHA to 0xFFF6D186.toInt(),
    CategoriaMedallaAutomatica.ESFUERZO to 0xFFF3A6C1.toInt(),
    CategoriaMedallaAutomatica.CONSTANCIA to 0xFFCBB7EE.toInt()
)
```

Add the two functions near `dibujarDonaDiasFavoritos` (anywhere at the object's function level):

```kotlin
/** Imagen propia de la medalla si la hay (fade-in), o su insignia por defecto si no, con el
 *  nombre debajo en [DESTACADO]. */
private fun dibujarMedalla(canvas: Canvas, ancho: Int, escena: EscenaResumen.Medalla, elapsedMs: Long, alphaEscena: Float) {
    val progreso = ((elapsedMs - MEDALLA_INICIO_MS).coerceIn(0L, MEDALLA_FADE_MS)).toFloat() / MEDALLA_FADE_MS
    if (progreso <= 0f) return
    val alphaAplicado = (255 * progreso * alphaEscena).toInt().coerceIn(0, 255)

    val centroX = ancho / 2f
    val centroY = 1150f
    val radio = 220f
    val bitmap = escena.imagenPersonalizada
    if (bitmap != null) {
        val destino = RectF(centroX - radio, centroY - radio, centroX + radio, centroY + radio)
        val paintImagen = Paint().apply { isAntiAlias = true; alpha = alphaAplicado }
        canvas.drawBitmap(bitmap, null, destino, paintImagen)
    } else {
        dibujarInsigniaMedalla(canvas, centroX, centroY, radio, escena.categoria, alphaAplicado)
    }

    dibujarTextoCentradoMultilinea(
        canvas, listOf(escena.nombre), centroX, centroY + radio + 90f,
        tamano = 44f, color = DESTACADO, alphaAplicado = alphaAplicado
    )
}

/** Insignia por defecto cuando la medalla no tiene imagen propia: un círculo del color de su
 *  categoría con su inicial al centro; gris con una estrella si es subjetiva sin imagen. */
private fun dibujarInsigniaMedalla(
    canvas: Canvas, cx: Float, cy: Float, radio: Float,
    categoria: CategoriaMedallaAutomatica?, alphaAplicado: Int
) {
    val color = categoria?.let { COLOR_INSIGNIA_MEDALLA[it] } ?: 0xFFB0B0B0.toInt()
    val paintCirculo = Paint().apply { isAntiAlias = true; this.color = color; alpha = alphaAplicado; style = Paint.Style.FILL }
    canvas.drawCircle(cx, cy, radio, paintCirculo)
    val glifo = categoria?.name?.first()?.toString() ?: "★"
    val paintGlifo = Paint().apply {
        isAntiAlias = true; color = NEGRO; alpha = alphaAplicado; textSize = radio
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD); textAlign = Paint.Align.CENTER
    }
    canvas.drawText(glifo, cx, cy + radio * 0.35f, paintGlifo)
}
```

- [ ] **Step 5: Verify it compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt
git commit -m "feat: render the Medalla scene (custom image or default badge)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Navigation — `Screen.Medallas` and drawer entry

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/Screen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/OSfitApp.kt`

**Interfaces:**
- Produces: `Screen.Medallas` route — consumed by Task 9 (`MedallasScreen` wiring).
- Consumes (forward reference): `com.osfit.app.ui.medallas.MedallasScreen()` — created in Task 9. This task adds the nav wiring first so Task 9's screen has somewhere to be reached from; the project won't compile between this task and Task 9 (acceptable — Task 9 is the very next task and this pair should land together if using inline execution; subagent-driven execution should treat Tasks 8 and 9 as one review unit).

- [ ] **Step 1: Add the route**

In `Screen.kt`, add after `Sandbox`:

```kotlin
data object Medallas : Screen("medallas")
```

- [ ] **Step 2: Wire the composable in the nav host**

In `OSfitNavHost.kt`, add (e.g. right after the `Screen.Top.route` block):

```kotlin
composable(Screen.Medallas.route) {
    com.osfit.app.ui.medallas.MedallasScreen()
}
```

- [ ] **Step 3: Add the drawer entry**

In `OSfitApp.kt`, inside `drawerContent`, add a `NavigationDrawerItem` right after the "Top" one and before the `if (com.osfit.app.BuildConfig.DEBUG)` Sandbox block:

```kotlin
NavigationDrawerItem(
    label = { Text("Medallas") },
    selected = rutaActual == Screen.Medallas.route,
    onClick = {
        scope.launch { drawerState.close() }
        navController.navigate(Screen.Medallas.route)
    },
    modifier = Modifier.padding(12.dp)
)
```

- [ ] **Step 4: Commit (bundled with Task 9 — see Task 9 Step 6)**

Do not commit yet; this task only compiles once `MedallasScreen` exists (Task 9).

---

### Task 9: `MedallasViewModel` and `MedallasScreen`

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/medallas/MedallasViewModel.kt`
- Create: `app/src/main/java/com/osfit/app/ui/medallas/MedallasScreen.kt`

**Interfaces:**
- Consumes: `MedallaRepository` (Task 3, via `AppContainer.medallaRepository`), `MedallaImagenUtil` (Task 4), `Screen.Medallas` (Task 8).
- Produces: `MedallasScreen()` composable — completes Task 8's wiring.

- [ ] **Step 1: `MedallasViewModel`**

`app/src/main/java/com/osfit/app/ui/medallas/MedallasViewModel.kt`:

```kotlin
package com.osfit.app.ui.medallas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.repository.MedallaRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MedallasViewModel(
    private val medallaRepository: MedallaRepository = AppContainer.medallaRepository
) : ViewModel() {

    init {
        viewModelScope.launch { medallaRepository.asegurarCategoriasAutomaticas() }
    }

    val medallas: StateFlow<List<MedallaCatalogo>> = medallaRepository.observarCatalogo()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun guardar(medalla: MedallaCatalogo) {
        viewModelScope.launch { medallaRepository.guardarMedalla(medalla) }
    }

    fun eliminar(medalla: MedallaCatalogo) {
        viewModelScope.launch { medallaRepository.eliminarMedalla(medalla) }
    }
}
```

- [ ] **Step 2: `MedallasScreen`**

`app/src/main/java/com/osfit/app/ui/medallas/MedallasScreen.kt`:

```kotlin
package com.osfit.app.ui.medallas

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.util.MedallaImagenUtil
import java.util.UUID

@Composable
fun MedallasScreen(viewModel: MedallasViewModel = viewModel()) {
    val medallas by viewModel.medallas.collectAsState()
    var medallaEnEdicion by remember { mutableStateOf<MedallaCatalogo?>(null) }
    var mostrarNueva by remember { mutableStateOf(false) }
    var medallaAEliminar by remember { mutableStateOf<MedallaCatalogo?>(null) }

    // Automáticas primero en el orden fijo del enum, luego las subjetivas.
    val ordenadas = remember(medallas) {
        medallas.sortedWith(compareBy({ it.categoria == null }, { it.categoria?.ordinal ?: 0 }))
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { mostrarNueva = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Nueva medalla")
            }
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(ordenadas, key = { it.id }) { medalla ->
                MedallaItem(
                    medalla = medalla,
                    onClick = { medallaEnEdicion = medalla },
                    onEliminar = { medallaAEliminar = medalla }
                )
            }
        }
    }

    medallaEnEdicion?.let { medalla ->
        EditarMedallaDialog(
            medalla = medalla,
            onGuardar = { actualizada -> viewModel.guardar(actualizada); medallaEnEdicion = null },
            onCancelar = { medallaEnEdicion = null }
        )
    }
    if (mostrarNueva) {
        // Id generado acá (no en Firestore) para que la imagen se pueda copiar a
        // filesDir/medallas/<id> antes de guardar el documento; ver MedallaRepository.guardarMedalla.
        EditarMedallaDialog(
            medalla = MedallaCatalogo(id = UUID.randomUUID().toString()),
            onGuardar = { nueva -> viewModel.guardar(nueva); mostrarNueva = false },
            onCancelar = { mostrarNueva = false }
        )
    }
    medallaAEliminar?.let { medalla ->
        AlertDialog(
            onDismissRequest = { medallaAEliminar = null },
            title = { Text("¿Borrar \"${medalla.nombre}\"?") },
            text = { Text("Esta acción no se puede deshacer.") },
            confirmButton = {
                TextButton(onClick = { viewModel.eliminar(medalla); medallaAEliminar = null }) {
                    Text("Borrar", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { medallaAEliminar = null }) { Text("Cancelar") } }
        )
    }
}

@Composable
private fun MedallaItem(medalla: MedallaCatalogo, onClick: () -> Unit, onEliminar: () -> Unit) {
    val context = LocalContext.current
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            val bitmap = remember(medalla.imagenArchivo) { MedallaImagenUtil.cargarBitmapPropio(context, medalla) }
            if (bitmap != null) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = null,
                    modifier = Modifier.size(48.dp).clip(CircleShape)
                )
            } else {
                Icon(Icons.Filled.Star, contentDescription = null, modifier = Modifier.size(48.dp))
            }
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Text(medalla.nombre, style = MaterialTheme.typography.titleMedium)
                Text(
                    if (medalla.categoria != null) "Automática" else "Subjetiva",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            if (medalla.categoria == null) {
                IconButton(onClick = onEliminar) {
                    Icon(Icons.Filled.Delete, contentDescription = "Eliminar")
                }
            }
        }
    }
}

@Composable
private fun EditarMedallaDialog(
    medalla: MedallaCatalogo,
    onGuardar: (MedallaCatalogo) -> Unit,
    onCancelar: () -> Unit
) {
    val context = LocalContext.current
    var nombre by remember { mutableStateOf(medalla.nombre) }
    var imagenArchivo by remember { mutableStateOf(medalla.imagenArchivo) }

    val selectorImagen = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            val nuevoArchivo = MedallaImagenUtil.copiarImagen(context, uri, medalla.id)
            if (nuevoArchivo != null) imagenArchivo = nuevoArchivo
        }
    }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text(if (medalla.categoria == null && medalla.nombre.isBlank()) "Nueva medalla" else "Editar medalla") },
        text = {
            Column {
                OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre") })
                OutlinedButton(
                    onClick = { selectorImagen.launch(arrayOf("image/*")) },
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
                ) {
                    Text(if (imagenArchivo != null) "Cambiar imagen" else "Elegir imagen (opcional)")
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = nombre.isNotBlank(),
                onClick = { onGuardar(medalla.copy(nombre = nombre.trim(), imagenArchivo = imagenArchivo)) }
            ) { Text("Guardar") }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } }
    )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL — this also validates Task 8's wiring, since `MedallasScreen()` now exists.

- [ ] **Step 4: Commit (Tasks 8 and 9 together)**

```bash
git add app/src/main/java/com/osfit/app/ui/navigation/Screen.kt app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt app/src/main/java/com/osfit/app/ui/OSfitApp.kt app/src/main/java/com/osfit/app/ui/medallas/MedallasViewModel.kt app/src/main/java/com/osfit/app/ui/medallas/MedallasScreen.kt
git commit -m "feat: add Medallas catalog screen, reachable from the drawer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `ClienteDetailViewModel` exposes `medallasOtorgadas`

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt`

**Interfaces:**
- Consumes: `MedallaRepository` (Task 3).
- Produces: `ClienteDetailViewModel.medallasOtorgadas: StateFlow<List<MedallaOtorgada>>` — consumed by Task 11 ("Logros" card).

- [ ] **Step 1: Add the repository param and the exposed flow**

In `ClienteDetailViewModel.kt`, add imports:

```kotlin
import com.osfit.app.data.model.MedallaOtorgada
import com.osfit.app.data.repository.MedallaRepository
```

Add a constructor param (after `asistenciaRepository`):

```kotlin
class ClienteDetailViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val pagoRepository: PagoRepository = AppContainer.pagoRepository,
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository,
    private val medallaRepository: MedallaRepository = AppContainer.medallaRepository
) : ViewModel() {
```

Add the flow (anywhere among the other `StateFlow` properties, e.g. right after `pagos`):

```kotlin
val medallasOtorgadas: StateFlow<List<MedallaOtorgada>> = medallaRepository.observarOtorgadas(clienteId)
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt
git commit -m "feat: expose medallasOtorgadas from ClienteDetailViewModel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: "Logros" card in `ClienteDetailScreen`

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`

**Interfaces:**
- Consumes: `ClienteDetailViewModel.medallasOtorgadas` (Task 10).

- [ ] **Step 1: Add the `Icons.Filled.Star` import**

```kotlin
import androidx.compose.material.icons.filled.Star
```

- [ ] **Step 2: Add the card**

Insert a new `item { ... }` block right after the "Rutina asignada" card's `item { ... }` block (i.e. right before the `item { Row(... "Cambiar rutina"/"Asignar día" ...) }` block):

```kotlin
item {
    var expandidaLogros by remember { mutableStateOf(false) }
    val logros by viewModel.medallasOtorgadas.collectAsState()
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expandidaLogros = !expandidaLogros },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Logros", style = MaterialTheme.typography.titleSmall)
                Icon(
                    if (expandidaLogros) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    contentDescription = if (expandidaLogros) "Ocultar" else "Mostrar"
                )
            }
            if (expandidaLogros) {
                if (logros.isEmpty()) {
                    Text("Todavía no tiene medallas.", modifier = Modifier.padding(top = 8.dp))
                } else {
                    logros.forEach { logro ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Filled.Star, contentDescription = null)
                            Column(modifier = Modifier.padding(start = 8.dp)) {
                                Text(logro.nombreMedalla, style = MaterialTheme.typography.bodyMedium)
                                Text(logro.encabezadoRango, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt
git commit -m "feat: add Logros card to the client profile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: `ConfirmarMedallaDialog`

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/clientes/ConfirmarMedallaDialog.kt`

**Interfaces:**
- Consumes: `MedallaCatalogo` (Task 2).
- Produces: `ConfirmarMedallaDialog(sugerencia, catalogo, onConfirmar: (MedallaCatalogo?) -> Unit, onCancelar)` — consumed by Task 14 (`ClienteDetailScreen` wiring).

- [ ] **Step 1: Implement**

`app/src/main/java/com/osfit/app/ui/clientes/ConfirmarMedallaDialog.kt`:

```kotlin
package com.osfit.app.ui.clientes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.osfit.app.data.model.MedallaCatalogo

/**
 * "Sin medalla" se modela como `null` en la selección (no hay fila de catálogo para eso).
 * Preselecciona [sugerencia] si la hay, si no queda en "Sin medalla".
 */
@Composable
fun ConfirmarMedallaDialog(
    sugerencia: MedallaCatalogo?,
    catalogo: List<MedallaCatalogo>,
    onConfirmar: (MedallaCatalogo?) -> Unit,
    onCancelar: () -> Unit
) {
    var seleccionada by remember { mutableStateOf(sugerencia) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Medalla de la quincena") },
        text = {
            Column {
                Text(
                    if (sugerencia != null) "Sugerencia: ${sugerencia.nombre}" else "No hay una sugerencia automática esta quincena.",
                    modifier = Modifier.padding(bottom = 12.dp)
                )
                LazyColumn(modifier = Modifier.height(320.dp)) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { seleccionada = null }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(selected = seleccionada == null, onClick = { seleccionada = null })
                            Text("Sin medalla")
                        }
                    }
                    items(catalogo, key = { it.id }) { medalla ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { seleccionada = medalla }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(selected = seleccionada?.id == medalla.id, onClick = { seleccionada = medalla })
                            Text(medalla.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(seleccionada) }) { Text("Generar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/ConfirmarMedallaDialog.kt
git commit -m "feat: add ConfirmarMedallaDialog for the quincenal medal flow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: `ResumenClienteViewModel` — compute suggestion, confirm, and generate

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ResumenClienteViewModel.kt`

**Interfaces:**
- Consumes: `MedallaRepository` (Task 3), `MedallaCalculator.sugerirCategoria` (Task 2), `ResumenVideoGenerator.generarYCompartir(context, resumen, medallaOtorgada, onProgreso)` (Task 6).
- Produces: `ResumenClienteViewModel.PreparacionMedalla(resumen, sugerencia, catalogo)`, `prepararConfirmacionMedalla(fechaReferencia): PreparacionMedalla?`, `confirmarYGenerarQuincenal(context, preparacion, elegida: MedallaCatalogo?)` — consumed by Task 14 (`ClienteDetailScreen` wiring).

- [ ] **Step 1: Add imports and the repository param**

```kotlin
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.model.MedallaOtorgada
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.domain.MedallaCalculator
```

```kotlin
class ResumenClienteViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository,
    private val medallaRepository: MedallaRepository = AppContainer.medallaRepository
) : ViewModel() {
```

- [ ] **Step 2: Add `PreparacionMedalla` and `prepararConfirmacionMedalla`**

Add anywhere at class level (e.g. right after `calcularResumenMensual`):

```kotlin
data class PreparacionMedalla(
    val resumen: ResumenClienteData,
    val sugerencia: MedallaCatalogo?,
    val catalogo: List<MedallaCatalogo>
)

/** Calcula el resumen quincenal y, con él, la categoría automática sugerida (si hay), ya
 *  resuelta contra el catálogo actual — todo lo que necesita ConfirmarMedallaDialog en un
 *  solo viaje. Lee el catálogo directo del repositorio (no del StateFlow ya cacheado de
 *  MedallasViewModel, que esta pantalla no comparte) para no depender de que algo más lo
 *  haya suscrito antes. */
suspend fun prepararConfirmacionMedalla(fechaReferencia: LocalDate = LocalDate.now()): PreparacionMedalla? {
    val resumen = calcularResumenQuincenal(fechaReferencia) ?: return null
    val catalogoActual = medallaRepository.observarCatalogo().first()
    val categoriaSugerida = MedallaCalculator.sugerirCategoria(resumen)
    val sugerencia = categoriaSugerida?.let { cat -> catalogoActual.firstOrNull { it.categoria == cat } }
    return PreparacionMedalla(resumen, sugerencia, catalogoActual)
}
```

- [ ] **Step 3: Add `confirmarYGenerarQuincenal` and remove the now-unused `generarResumenQuincenal`**

Remove this method (it becomes dead code once Task 14 rewires the UI to the new flow):

```kotlin
fun generarResumenQuincenal(context: Context, fechaReferencia: LocalDate = LocalDate.now()) {
    generarYCompartir(context) { calcularResumenQuincenal(fechaReferencia) }
}
```

Add in its place:

```kotlin
/**
 * Duplica parte del try/catch/finally de [generarYCompartir] a propósito: ese helper genérico
 * recalcula el resumen desde una lambda y no conoce medallas, y este flujo ya trae el resumen
 * calculado (de [prepararConfirmacionMedalla]) más el efecto secundario de otorgar la medalla
 * antes de generar — meter eso en el helper genérico lo complicaría para las otras 2 llamadas
 * (semanal/mensual) que nunca lo necesitan.
 */
fun confirmarYGenerarQuincenal(context: Context, preparacion: PreparacionMedalla, elegida: MedallaCatalogo?) {
    if (_generando.value) return
    _generando.value = true
    _progreso.value = 0f
    val contextoApp = context.applicationContext
    viewModelScope.launch {
        try {
            if (elegida != null) {
                medallaRepository.otorgarMedalla(
                    preparacion.resumen.cliente.id,
                    MedallaOtorgada(
                        rangoInicio = preparacion.resumen.rango.inicio.toString(),
                        medallaId = elegida.id,
                        nombreMedalla = elegida.nombre,
                        encabezadoRango = preparacion.resumen.rango.encabezado,
                        fueAjustadaManualmente = elegida.id != preparacion.sugerencia?.id
                    )
                )
            }
            ResumenVideoGenerator.generarYCompartir(contextoApp, preparacion.resumen, elegida) { fraccion ->
                _progreso.value = fraccion
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            Log.w(TAG_RESUMEN, "Falló la generación del resumen en video", e)
            _mensaje.value = "No se pudo generar el video del resumen"
        } finally {
            _generando.value = false
            _progreso.value = 0f
        }
    }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: This will FAIL — `ClienteDetailScreen.kt` still calls the now-removed `generarResumenQuincenal`. That's expected; Task 14 fixes it. Confirm the *only* error is that missing reference (no other unrelated breakage) before moving on.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/ResumenClienteViewModel.kt
git commit -m "feat: add quincenal medal preparation/confirmation to ResumenClienteViewModel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Wire the confirm/adjust flow into `ClienteDetailScreen`

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`

**Interfaces:**
- Consumes: `ResumenClienteViewModel.prepararConfirmacionMedalla`, `confirmarYGenerarQuincenal`, `PreparacionMedalla` (Task 13); `ConfirmarMedallaDialog` (Task 12).

- [ ] **Step 1: Add the `rememberCoroutineScope` import and new state**

Add import:

```kotlin
import androidx.compose.runtime.rememberCoroutineScope
```

In `ClienteDetailScreen`, alongside the other `remember { mutableStateOf(...) }` declarations, add:

```kotlin
val scope = rememberCoroutineScope()
var cargandoMedalla by remember { mutableStateOf(false) }
var preparacionMedalla by remember { mutableStateOf<ResumenClienteViewModel.PreparacionMedalla?>(null) }
```

- [ ] **Step 2: Show "Calculando..." on the quincenal button while preparing**

Replace the quincenal `AccionCard`'s `texto`:

```kotlin
AccionCard(
    icono = Icons.Filled.Videocam,
    texto = when {
        generandoResumen -> "Generando... ${(progresoResumen * 100).toInt()}%"
        cargandoMedalla -> "Calculando..."
        else -> "Resumen quincenal"
    },
    modifier = Modifier.weight(1f),
    onClick = { tipoResumenParaFecha = TipoResumen.QUINCENAL }
)
```

- [ ] **Step 3: Branch the period-dialog confirm handler by tipo**

Replace the `tipoResumenParaFecha?.let { ... }` block's `onConfirmar`:

```kotlin
tipoResumenParaFecha?.let { tipo ->
    SeleccionarRangoResumenDialog(
        tipo = tipo,
        onConfirmar = { fecha ->
            tipoResumenParaFecha = null
            when (tipo) {
                TipoResumen.SEMANAL -> resumenViewModel.generarResumenSemanal(context, fecha)
                TipoResumen.QUINCENAL -> {
                    cargandoMedalla = true
                    scope.launch {
                        preparacionMedalla = resumenViewModel.prepararConfirmacionMedalla(fecha)
                        cargandoMedalla = false
                    }
                }
                TipoResumen.MENSUAL -> resumenViewModel.generarResumenMensual(context, YearMonth.from(fecha))
            }
        },
        onCancelar = { tipoResumenParaFecha = null }
    )
}
```

- [ ] **Step 4: Show `ConfirmarMedallaDialog` when a preparation is ready**

Add right after the block from Step 3:

```kotlin
preparacionMedalla?.let { prep ->
    ConfirmarMedallaDialog(
        sugerencia = prep.sugerencia,
        catalogo = prep.catalogo,
        onConfirmar = { elegida ->
            resumenViewModel.confirmarYGenerarQuincenal(context, prep, elegida)
            preparacionMedalla = null
        },
        onCancelar = { preparacionMedalla = null }
    )
}
```

- [ ] **Step 5: Verify the whole module compiles**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL — this resolves the dangling reference left by Task 13's removal of `generarResumenQuincenal`.

- [ ] **Step 6: Run the full unit test suite**

Run: `./gradlew :app:testDebugUnitTest`
Expected: BUILD SUCCESSFUL, all tests pass (the pre-existing suite plus every test added in Tasks 1, 2, and 6).

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt
git commit -m "feat: wire the medal confirm/adjust dialog into the quincenal flow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: On-device verification and final build

**Files:** none (verification only).

**Interfaces:** none — this task exercises everything built in Tasks 1-14 end to end.

- [ ] **Step 1: Full build**

Run: `./gradlew :app:testDebugUnitTest :app:assembleDebug`
Expected: BUILD SUCCESSFUL, all unit tests pass.

- [ ] **Step 2: Install on the connected device**

Run (adjust the adb path if different from earlier in this session):

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "app\build\outputs\apk\debug\app-debug.apk"
```

- [ ] **Step 3: Exercise the catalog screen**

Open the drawer -> "Medallas". Confirm the 5 automatic categories appear (seeded on first open). Create a subjective medal (e.g. "Más buena onda") with a custom image, confirm it appears in the list. Edit one of the 5 automatic medals' name, confirm it persists. Confirm the 5 automatic medals have no delete icon, and the subjective one does; delete it and confirm it disappears.

- [ ] **Step 4: Exercise the quincenal flow for a real client**

Open a client with attendance data in the current or a past quincena -> "Resumen quincenal" -> pick a period. Confirm `ConfirmarMedallaDialog` opens with a sugerencia (or "sin sugerencia" if the client didn't lead any category) and the full catalog listed. Change the selection to a different medal (including a subjective one), confirm. **Stop before the WhatsApp share sheet actually sends anything** — same caution as the rest of this session's video work: back out of the share sheet, or save/discard the video instead of sending it to a real client.

- [ ] **Step 5: Confirm the medal scene renders**

From the saved/previewed video (same technique as earlier in this session — WhatsApp's editor preview, or download without sending), confirm the new scene appears right before "Gracias por confiar en nosotros": the medal image or default badge, and its name in the aqua highlight color.

- [ ] **Step 6: Confirm "Logros" shows the award**

Back in the client's profile, expand "Logros" and confirm the just-awarded medal appears with the correct quincena label.

- [ ] **Step 7: Final commit if Step 3-6 required any fixes**

If verification surfaced bugs, fix them and commit normally (`fix: ...`). If everything worked as-is, there's nothing to commit here — Task 14's commit already covers the full feature.
