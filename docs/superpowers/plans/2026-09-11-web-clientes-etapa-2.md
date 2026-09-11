# Web para clientes — Etapa 2: las dos acciones

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el cliente pueda, desde su página, cambiar el día que le toca y avisar que no va a ir, y que el entrenador vea ambas cosas en su calendario.

**Architecture:** Las dos acciones escriben a través de Cloud Functions (`cambiarDia`, `revivirRacha`), nunca directo desde el navegador: el cupo de 3 revives al mes no se puede hacer cumplir con reglas de Firestore, así que se cuenta con el Admin SDK del lado del servidor. Los cálculos que alimentan la UI —cupo restante, cuál fue la falta que rompió la racha, qué motivos ofrecer— son lógica pura y viven duplicados en Kotlin (`domain/`) y TypeScript, siguiendo la convención de gemelos que el repo ya usa.

**Tech Stack:** Kotlin + Jetpack Compose (app), TypeScript + Vite (web), Cloud Functions v2 sobre Node 22, Firestore. Tests: JUnit4 en `domain/`, Vitest en `web/`.

**Spec:** [docs/superpowers/specs/2026-09-10-web-clientes-design.md](../specs/2026-09-10-web-clientes-design.md) — secciones "El cupo se cuenta, no se guarda", "`cambiarDia`", "`revivirRacha`", "Cuál es la falta que rompió la racha", "Motivos del cambio de día", "Faltar no pide explicaciones", y los puntos 4 y 5 de "Cambios en la app Android".

## Global Constraints

- **Zona horaria:** todo cálculo de "hoy" usa `America/Mazatlan`, nunca la del navegador ni la del dispositivo. Es GMT-7; **no** es `America/Mexico_City`.
- **UID del entrenador:** `G8lW4rIgXhZrswQXJ84pT1StFx82`, fijado literal en `firestore.rules`.
- **Cupo de revives:** 3 por mes natural. Se **cuenta**, no se guarda en un contador.
- **Las escrituras del cliente nunca van directo a Firestore.** Las reglas le dan al cliente solo lectura; las dos acciones pasan por función.
- **Región de las functions:** `us-west1`, la misma que `sesion`.
- **Node 22** en `functions/package.json` (`engines.node`).
- **Fechas:** strings ISO `AAAA-MM-DD`. Las comparaciones lexicográficas son válidas y el rango mensual se hace por prefijo.
- **Solo cuentan para el cupo las `justificadaPorCliente`.** El "soborno" que otorga el entrenador (`justificada` a secas) no gasta cupo.
- **Faltar no pide motivo.** Ni "Hoy no voy a poder ir" ni "Revivir mi racha" guardan explicación alguna.
- **Tests en español y en backticks** en Kotlin, siguiendo el repo.

## Sobre los gemelos Kotlin ↔ TypeScript

Tres cálculos van a existir por duplicado. Esto ya mordió una vez: el bug de la Etapa 1 (`bf5463c`) fue exactamente una divergencia entre `RutinaProgressCalculator.interpretar` y su gemelo `dia.ts`, donde Kotlin usaba `?:` y TypeScript `=== null`, que no cubre `undefined`.

**Regla para este plan:** cada archivo TS gemelo lleva en su cabecera un comentario `GEMELO: <objeto Kotlin>`, y su archivo de test declara **los mismos nombres de caso, uno a uno**, que el test de Kotlin. Cada tarea de portado incluye un paso explícito de comparar ambas listas de nombres.

Se consideró un fichero de casos compartido (JSON leído por ambos suites) para forzar la paridad mecánicamente. Se descarta: el repo no tiene precedente de recursos de test compartidos entre Gradle y Vitest, y montarlo cuesta más que el problema que resuelve en tres funciones cortas. Si aparece un cuarto gemelo, conviene reconsiderarlo.

## Estructura de archivos

**Kotlin — lógica pura (`app/src/main/java/com/osfit/app/domain/`):**
- `CupoRevivesCalculator.kt` *(nuevo)* — cuenta revives usados y disponibles en un mes.
- `FaltaQueRompioLaRacha.kt` *(nuevo)* — encuentra la fecha a revivir, o null si la racha está viva.
- `MotivosCambioDia.kt` *(nuevo)* — la lista de motivos, ya filtrada por las condiciones del día.
- `RachaCalculator.kt` *(modificar)* — `esDiaHabil` pasa de privada a pública; los tres de arriba la necesitan.

**Kotlin — modelo y datos:**
- `data/model/CambioDiaWeb.kt` *(nuevo)*
- `data/model/Asistencia.kt` *(modificar)* — campo `justificadaPorCliente`.
- `data/repository/CambioDiaWebRepository.kt` *(nuevo)* — observa `cambiosDia` por fecha.
- `data/AppContainer.kt` *(modificar)* — registra el repositorio nuevo.

**Kotlin — UI:**
- `ui/calendario/TomarAsistenciaViewModel.kt` y `TomarAsistenciaScreen.kt` *(modificar)* — indicadores.
- `ui/clientes/ClienteDetailViewModel.kt` y `ClienteDetailScreen.kt` *(modificar)* — cupo visible.

**Functions (`functions/src/`):**
- `comun.ts` *(nuevo)* — verificación del token del cliente, compartida por las dos funciones.
- `cambiarDia.ts` *(nuevo)*
- `revivirRacha.ts` *(nuevo)*
- `index.ts` *(modificar)* — exporta las dos nuevas.

**Web (`web/src/`):**
- `cupo.ts`, `falta.ts`, `motivos.ts` *(nuevos)* — los tres gemelos, con sus `.test.ts`.
- `racha.ts` *(modificar)* — exporta `esDiaHabil` y `restarUnDia`.
- `datos.ts` *(modificar)* — `justificadaPorCliente` en `Asistencia`, observación de `cambiosDia`.
- `acciones.ts` *(nuevo)* — las dos llamadas HTTP a las functions.
- `ui/tarjetaDia.ts` *(modificar)* — los dos botones y la línea de confirmación.
- `ui/tarjetasStats.ts` *(modificar)* — racha rota en rojo y "Revivir mi racha".
- `ui/modal.ts` *(nuevo)* — el diálogo de motivos y el de confirmación del revive.
- `main.ts` *(modificar)* — cablea los listeners nuevos en `pintar()`.

**Configuración:**
- `firestore.indexes.json` *(nuevo)* y `firebase.json` *(modificar)* — índice compuesto del cupo.
- `firestore.rules` *(modificar)* — lectura de `cambiosDia` para el cliente.

---

### Task 1: `justificadaPorCliente` y `esDiaHabil` pública

Los cimientos de todo lo demás: el campo que distingue el revive del cliente del soborno del entrenador, y el helper de días hábiles que los tres calculadores nuevos necesitan.

**Files:**
- Modify: `app/src/main/java/com/osfit/app/data/model/Asistencia.kt`
- Modify: `app/src/main/java/com/osfit/app/domain/RachaCalculator.kt:14-15`

**Interfaces:**
- Consumes: nada.
- Produces: `Asistencia.justificadaPorCliente: Boolean`; `RachaCalculator.esDiaHabil(fecha: LocalDate): Boolean`.

- [ ] **Step 1: Añadir el campo al modelo**

En `Asistencia.kt`, justo debajo de `justificada`:

```kotlin
    /** Falta justificada ("soborno"): no asistió, pero cuenta para la racha. */
    val justificada: Boolean = false,
    /**
     * La justificó el cliente desde su página, gastando uno de sus 3 revives del mes.
     * Solo estas cuentan para el cupo: el soborno que otorga el entrenador no se lo gasta.
     */
    val justificadaPorCliente: Boolean = false,
```

El valor por defecto `false` es lo que hace que los documentos viejos se lean sin migración.

- [ ] **Step 2: Hacer pública `esDiaHabil`**

En `RachaCalculator.kt`, quitar el `private`:

```kotlin
    /** Sábado y domingo ni suman ni rompen la racha. Público: lo usan los cálculos de la web. */
    fun esDiaHabil(fecha: LocalDate): Boolean =
        fecha.dayOfWeek != DayOfWeek.SATURDAY && fecha.dayOfWeek != DayOfWeek.SUNDAY
```

- [ ] **Step 3: Compilar y correr la suite entera**

Run: `./gradlew test --console=plain`
Expected: BUILD SUCCESSFUL, 197 tests, 0 failures. No debe cambiar ningún test: el campo es aditivo con default y `esDiaHabil` solo cambia de visibilidad.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/Asistencia.kt app/src/main/java/com/osfit/app/domain/RachaCalculator.kt
git commit -m "feat: add justificadaPorCliente and expose esDiaHabil

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `CupoRevivesCalculator`

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/CupoRevivesCalculator.kt`
- Test: `app/src/test/java/com/osfit/app/domain/CupoRevivesCalculatorTest.kt`

**Interfaces:**
- Consumes: `Asistencia.justificadaPorCliente` (Task 1).
- Produces: `CupoRevivesCalculator.CUPO_MENSUAL: Int`, `.usados(asistencias: List<Asistencia>, mes: String): Int`, `.disponibles(asistencias: List<Asistencia>, mes: String): Int`. `mes` es el prefijo ISO `"AAAA-MM"`.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/test/java/com/osfit/app/domain/CupoRevivesCalculatorTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import org.junit.Assert.assertEquals
import org.junit.Test

class CupoRevivesCalculatorTest {

    private fun revive(fecha: String) = Asistencia(
        clienteId = "c1", fecha = fecha, asistio = false,
        justificada = true, justificadaPorCliente = true
    )

    private fun soborno(fecha: String) = Asistencia(
        clienteId = "c1", fecha = fecha, asistio = false,
        justificada = true, justificadaPorCliente = false
    )

    @Test
    fun `cuenta las justificadas por el cliente del mes en curso`() {
        val asistencias = listOf(revive("2026-09-02"), revive("2026-09-09"))
        assertEquals(2, CupoRevivesCalculator.usados(asistencias, "2026-09"))
    }

    @Test
    fun `ignora las justificadas por el entrenador`() {
        val asistencias = listOf(revive("2026-09-02"), soborno("2026-09-03"), soborno("2026-09-04"))
        assertEquals(1, CupoRevivesCalculator.usados(asistencias, "2026-09"))
    }

    @Test
    fun `ignora las de otros meses`() {
        val asistencias = listOf(revive("2026-08-31"), revive("2026-09-01"), revive("2026-10-01"))
        assertEquals(1, CupoRevivesCalculator.usados(asistencias, "2026-09"))
    }

    @Test
    fun `con tres usados quedan cero disponibles`() {
        val asistencias = listOf(revive("2026-09-02"), revive("2026-09-03"), revive("2026-09-04"))
        assertEquals(0, CupoRevivesCalculator.disponibles(asistencias, "2026-09"))
    }

    @Test
    fun `sin revives quedan los tres disponibles`() {
        assertEquals(3, CupoRevivesCalculator.disponibles(emptyList(), "2026-09"))
    }

    @Test
    fun `nunca devuelve disponibles negativos`() {
        val asistencias = (1..5).map { revive("2026-09-0$it") }
        assertEquals(0, CupoRevivesCalculator.disponibles(asistencias, "2026-09"))
    }
}
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `./gradlew test --tests "*CupoRevivesCalculatorTest*" --console=plain`
Expected: FAIL — no compila, `CupoRevivesCalculator` no existe.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `app/src/main/java/com/osfit/app/domain/CupoRevivesCalculator.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia

/**
 * Cupo de revives del cliente: 3 por mes natural.
 *
 * GEMELO: `cupo.ts` en la web.
 *
 * El cupo se **cuenta**, no se guarda en un contador. Si el entrenador desmarca una
 * justificada desde su app, el cupo se le devuelve al cliente solo; un contador se
 * quedaría viejo y habría que acordarse de corregirlo en un lugar que nadie mira.
 *
 * Solo cuentan las `justificadaPorCliente`: el "soborno" que otorga el entrenador no
 * debe gastarle el cupo a nadie.
 */
object CupoRevivesCalculator {

    const val CUPO_MENSUAL = 3

    /** [mes] es el prefijo ISO del mes, `"AAAA-MM"`. */
    fun usados(asistencias: List<Asistencia>, mes: String): Int =
        asistencias.count { it.justificadaPorCliente && it.fecha.startsWith(mes) }

    fun disponibles(asistencias: List<Asistencia>, mes: String): Int =
        (CUPO_MENSUAL - usados(asistencias, mes)).coerceAtLeast(0)
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `./gradlew test --tests "*CupoRevivesCalculatorTest*" --console=plain`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/CupoRevivesCalculator.kt app/src/test/java/com/osfit/app/domain/CupoRevivesCalculatorTest.kt
git commit -m "feat: count the client's monthly revive allowance

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `FaltaQueRompioLaRacha`

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/FaltaQueRompioLaRacha.kt`
- Test: `app/src/test/java/com/osfit/app/domain/FaltaQueRompioLaRachaTest.kt`

**Interfaces:**
- Consumes: `RachaCalculator.esDiaHabil` y `RachaCalculator.fechasQueCuentan` (Task 1).
- Produces: `FaltaQueRompioLaRacha.buscar(asistencias: List<Asistencia>, hoy: String): String?` — devuelve la fecha ISO a revivir, o `null` si la racha no está rota.

**Por qué "la más reciente" y no "la primera":** revivir la falta más reciente es lo único que restaura racha. Con 7 y 8 asistidos, 9 y 10 faltados y hoy 11, revivir el 10 deja que cuenten 7, 8 y 10; con el día de gracia de hoy, la racha pasa a 1. Revivir el 9 en cambio deja el 10 roto y la racha sigue en 0.

**Decisión sobre "posterior a la última fecha que cuenta":** el spec no dice si esa última fecha incluye hoy. Se incluye. Si el cliente ya tiene hoy marcado como asistido, su racha está viva y la página no debe ofrecerle revivir nada — coherente con "con la racha viva ese botón no existe: la página no le recuerda al cliente que puede faltar".

**Límite conocido:** solo se consideran días con documento de asistencia. Un día hábil sin ningún registro (el entrenador no guardó asistencia ese día) rompe la racha pero no aparece como candidato, porque no hay nada que justificar. En la práctica la pantalla "Tomar asistencia" escribe documento para todos los clientes del día, así que el hueco es raro. No se resuelve en esta etapa.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/test/java/com/osfit/app/domain/FaltaQueRompioLaRachaTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Septiembre 2026: el 7 es lunes, el 11 viernes, el 12 y 13 fin de semana. */
class FaltaQueRompioLaRachaTest {

    private fun vino(fecha: String) = Asistencia(clienteId = "c1", fecha = fecha, asistio = true)
    private fun falto(fecha: String) = Asistencia(clienteId = "c1", fecha = fecha, asistio = false)
    private fun justificada(fecha: String) =
        Asistencia(clienteId = "c1", fecha = fecha, asistio = false, justificada = true)

    @Test
    fun `encuentra la falta mas reciente cuando la racha esta rota`() {
        val asistencias = listOf(vino("2026-09-07"), vino("2026-09-08"), falto("2026-09-09"), falto("2026-09-10"))
        assertEquals("2026-09-10", FaltaQueRompioLaRacha.buscar(asistencias, "2026-09-11"))
    }

    @Test
    fun `devuelve null con la racha viva`() {
        val asistencias = listOf(vino("2026-09-09"), vino("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.buscar(asistencias, "2026-09-11"))
    }

    @Test
    fun `devuelve null si volvio a venir despues de faltar`() {
        val asistencias = listOf(falto("2026-09-09"), vino("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.buscar(asistencias, "2026-09-11"))
    }

    @Test
    fun `ignora las faltas ya justificadas`() {
        val asistencias = listOf(vino("2026-09-08"), justificada("2026-09-09"), justificada("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.buscar(asistencias, "2026-09-11"))
    }

    @Test
    fun `ignora los fines de semana`() {
        // El 12 es sábado: faltar un sábado no rompe nada, así que no es candidato.
        val asistencias = listOf(vino("2026-09-10"), vino("2026-09-11"), falto("2026-09-12"))
        assertNull(FaltaQueRompioLaRacha.buscar(asistencias, "2026-09-14"))
    }

    @Test
    fun `ignora la falta de hoy`() {
        // Hoy todavía tiene día de gracia: no se ofrece revivir algo que aún puede cumplirse.
        val asistencias = listOf(vino("2026-09-10"), falto("2026-09-11"))
        assertNull(FaltaQueRompioLaRacha.buscar(asistencias, "2026-09-11"))
    }

    @Test
    fun `devuelve null si ya vino hoy`() {
        val asistencias = listOf(falto("2026-09-09"), falto("2026-09-10"), vino("2026-09-11"))
        assertNull(FaltaQueRompioLaRacha.buscar(asistencias, "2026-09-11"))
    }

    @Test
    fun `encuentra la falta sin ninguna asistencia previa`() {
        val asistencias = listOf(falto("2026-09-10"))
        assertEquals("2026-09-10", FaltaQueRompioLaRacha.buscar(asistencias, "2026-09-11"))
    }

    @Test
    fun `sin asistencias devuelve null`() {
        assertNull(FaltaQueRompioLaRacha.buscar(emptyList(), "2026-09-11"))
    }
}
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `./gradlew test --tests "*FaltaQueRompioLaRachaTest*" --console=plain`
Expected: FAIL — no compila, `FaltaQueRompioLaRacha` no existe.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `app/src/main/java/com/osfit/app/domain/FaltaQueRompioLaRacha.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import java.time.LocalDate

/**
 * Cuál es la falta que el cliente puede revivir, o null si su racha no está rota.
 *
 * GEMELO: `falta.ts` en la web.
 *
 * Es la falta hábil más reciente, estrictamente anterior a hoy, sin justificar, y posterior
 * a la última fecha que sí cuenta para la racha. Se busca la **más reciente** y no la
 * primera porque es la única que restaura racha: revivir un hueco que todavía tiene otro
 * hueco por delante no sirve de nada.
 */
object FaltaQueRompioLaRacha {

    fun buscar(asistencias: List<Asistencia>, hoy: String): String? {
        val hoyFecha = LocalDate.parse(hoy)

        val candidata = asistencias
            .filter { !it.asistio && !it.justificada }
            .map { LocalDate.parse(it.fecha) }
            .filter { it.isBefore(hoyFecha) && RachaCalculator.esDiaHabil(it) }
            .maxOrNull() ?: return null

        // Incluye hoy a propósito: si el cliente ya tiene hoy contando, su racha está viva
        // y la página no debe ofrecerle revivir nada.
        val ultimaQueCuenta = RachaCalculator.fechasQueCuentan(asistencias)
            .filter { !it.isAfter(hoyFecha) }
            .maxOrNull()

        if (ultimaQueCuenta != null && !candidata.isAfter(ultimaQueCuenta)) return null

        return candidata.toString()
    }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `./gradlew test --tests "*FaltaQueRompioLaRachaTest*" --console=plain`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/FaltaQueRompioLaRacha.kt app/src/test/java/com/osfit/app/domain/FaltaQueRompioLaRachaTest.kt
git commit -m "feat: find the absence that broke the client's streak

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `MotivosCambioDia`

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/MotivosCambioDia.kt`
- Test: `app/src/test/java/com/osfit/app/domain/MotivosCambioDiaTest.kt`

**Interfaces:**
- Consumes: `RachaCalculator.esDiaHabil` (Task 1).
- Produces: `data class MotivoCambioDia(val id: String, val texto: String, val permiteTextoLibre: Boolean)` y `MotivosCambioDia.disponibles(asistencias: List<Asistencia>, hoy: String): List<MotivoCambioDia>`. Los `id` son los que viajan a la función y se guardan en `CambioDiaWeb.motivo`: `"lunes"`, `"volviendo"`, `"adelantar"`, `"no_digo"`, `"fragil"`, `"otro"`.

Los dos primeros motivos son condicionales porque son afirmaciones sobre hechos: "hoy es lunes" ofrecido un miércoles es absurdo, y ofrecerlo igual enseña que las opciones no significan nada.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/test/java/com/osfit/app/domain/MotivosCambioDiaTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Septiembre 2026: el 7 y el 14 son lunes; el 11 viernes; el 12 y 13 fin de semana. */
class MotivosCambioDiaTest {

    private fun vino(fecha: String) = Asistencia(clienteId = "c1", fecha = fecha, asistio = true)

    private fun ids(asistencias: List<Asistencia>, hoy: String) =
        MotivosCambioDia.disponibles(asistencias, hoy).map { it.id }

    @Test
    fun `el lunes ofrece el motivo del lunes`() {
        assertTrue(ids(listOf(vino("2026-09-11")), "2026-09-14").contains("lunes"))
    }

    @Test
    fun `filtra el motivo del lunes cuando no es lunes`() {
        assertFalse(ids(listOf(vino("2026-09-10")), "2026-09-11").contains("lunes"))
    }

    @Test
    fun `filtra el de mas de dos dias cuando asistio ayer`() {
        assertFalse(ids(listOf(vino("2026-09-10")), "2026-09-11").contains("volviendo"))
    }

    @Test
    fun `ofrece el de mas de dos dias tras tres habiles sin venir`() {
        // Vino el lunes 7; hoy viernes 11. Sin venir: 8, 9 y 10 — tres hábiles.
        assertTrue(ids(listOf(vino("2026-09-07")), "2026-09-11").contains("volviendo"))
    }

    @Test
    fun `no ofrece el de mas de dos dias con exactamente dos habiles sin venir`() {
        // Vino el martes 8; hoy viernes 11. Sin venir: 9 y 10 — dos hábiles, no es "más de dos".
        assertFalse(ids(listOf(vino("2026-09-08")), "2026-09-11").contains("volviendo"))
    }

    @Test
    fun `no cuenta el fin de semana como dias sin venir`() {
        // Vino el viernes 11; hoy lunes 14. En medio solo sábado y domingo: cero hábiles.
        assertFalse(ids(listOf(vino("2026-09-11")), "2026-09-14").contains("volviendo"))
    }

    @Test
    fun `sin ninguna asistencia ofrece el de mas de dos dias`() {
        assertTrue(ids(emptyList(), "2026-09-11").contains("volviendo"))
    }

    @Test
    fun `los tres motivos incondicionales siempre estan`() {
        val obtenidos = ids(listOf(vino("2026-09-10")), "2026-09-11")
        assertTrue(obtenidos.containsAll(listOf("adelantar", "no_digo", "fragil", "otro")))
    }

    @Test
    fun `solo otro permite texto libre`() {
        val conTextoLibre = MotivosCambioDia.disponibles(emptyList(), "2026-09-11")
            .filter { it.permiteTextoLibre }
            .map { it.id }
        assertEquals(listOf("otro"), conTextoLibre)
    }
}
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `./gradlew test --tests "*MotivosCambioDiaTest*" --console=plain`
Expected: FAIL — no compila, `MotivosCambioDia` no existe.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `app/src/main/java/com/osfit/app/domain/MotivosCambioDia.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import java.time.DayOfWeek
import java.time.LocalDate

/** Una opción de la lista de motivos del cambio de día. */
data class MotivoCambioDia(
    val id: String,
    val texto: String,
    val permiteTextoLibre: Boolean = false
)

/**
 * Los motivos que se le ofrecen al cliente para cambiar su día, ya filtrados.
 *
 * GEMELO: `motivos.ts` en la web.
 *
 * Los dos condicionales son afirmaciones sobre hechos, y por eso se filtran: ofrecer
 * "hoy es lunes" un miércoles enseña que las opciones no significan nada.
 */
object MotivosCambioDia {

    fun disponibles(asistencias: List<Asistencia>, hoy: String): List<MotivoCambioDia> {
        val fecha = LocalDate.parse(hoy)
        val motivos = mutableListOf<MotivoCambioDia>()

        if (fecha.dayOfWeek == DayOfWeek.MONDAY) {
            motivos += MotivoCambioDia("lunes", "Hoy es lunes y quiero iniciar con algo que me guste")
        }
        if (diasHabilesSinVenir(asistencias, fecha) > 2) {
            motivos += MotivoCambioDia(
                "volviendo",
                "Tengo más de dos días sin venir y quiero iniciar con lo que yo quiera"
            )
        }
        motivos += MotivoCambioDia("adelantar", "Quiero adelantar el día")
        motivos += MotivoCambioDia("no_digo", "La neta no te quiero decir, solo no quiero hacerlo")
        motivos += MotivoCambioDia("fragil", "Soy una perra frágil")
        motivos += MotivoCambioDia("otro", "Otro (describe el motivo)", permiteTextoLibre = true)
        return motivos
    }

    /**
     * Días hábiles estrictamente entre la última asistencia y hoy. Sin ninguna asistencia
     * devuelve un número grande: alguien que nunca ha venido cuenta como "más de dos días".
     */
    private fun diasHabilesSinVenir(asistencias: List<Asistencia>, hoy: LocalDate): Int {
        val ultima = asistencias.filter { it.asistio }
            .map { LocalDate.parse(it.fecha) }
            .filter { it.isBefore(hoy) }
            .maxOrNull() ?: return Int.MAX_VALUE

        var contador = 0
        var fecha = ultima.plusDays(1)
        while (fecha.isBefore(hoy)) {
            if (RachaCalculator.esDiaHabil(fecha)) contador++
            fecha = fecha.plusDays(1)
        }
        return contador
    }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `./gradlew test --tests "*MotivosCambioDiaTest*" --console=plain`
Expected: PASS, 9 tests.

- [ ] **Step 5: Correr la suite entera**

Run: `./gradlew test --console=plain`
Expected: BUILD SUCCESSFUL. Total acumulado: 197 + 6 + 9 + 9 = 221 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/MotivosCambioDia.kt app/src/test/java/com/osfit/app/domain/MotivosCambioDiaTest.kt
git commit -m "feat: offer the day-change reasons that make sense today

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `cupo.ts` — gemelo de `CupoRevivesCalculator`

**Files:**
- Create: `web/src/cupo.ts`, `web/src/cupo.test.ts`
- Modify: `web/src/datos.ts` (interfaz `Asistencia`)
- Modify: `web/src/racha.ts` (exportar helpers)

**Interfaces:**
- Consumes: nada del lado TS.
- Produces: `CUPO_MENSUAL: number`, `usados(asistencias, mes): number`, `disponibles(asistencias, mes): number`. Además `racha.ts` pasa a exportar `esDiaHabil(fecha: string): boolean` y `restarUnDia(fecha: string): string`, que las Tasks 6 y 7 usan.

- [ ] **Step 1: Añadir el campo y exportar los helpers**

En `web/src/datos.ts`, dentro de `interface Asistencia`:

```typescript
export interface Asistencia {
  fecha: string;
  asistio: boolean;
  justificada: boolean;
  /** La justificó el cliente gastando un revive. Solo estas cuentan para el cupo. */
  justificadaPorCliente: boolean;
  duracionMinutos: number | null;
}
```

En `web/src/racha.ts`, añadir `export` a las dos funciones que hoy son privadas:

```typescript
export function esDiaHabil(fecha: string): boolean {
export function restarUnDia(fecha: string): string {
```

- [ ] **Step 2: Escribir el test que falla**

Crear `web/src/cupo.test.ts`. Los nombres de caso son **los mismos** que `CupoRevivesCalculatorTest.kt`, traducidos uno a uno:

```typescript
import { describe, expect, it } from "vitest";
import { CUPO_MENSUAL, disponibles, usados } from "./cupo";
import type { Asistencia } from "./datos";

const revive = (fecha: string): Asistencia => ({
  fecha, asistio: false, justificada: true, justificadaPorCliente: true, duracionMinutos: null
});
const soborno = (fecha: string): Asistencia => ({
  fecha, asistio: false, justificada: true, justificadaPorCliente: false, duracionMinutos: null
});

describe("cupo de revives", () => {
  it("cuenta las justificadas por el cliente del mes en curso", () => {
    expect(usados([revive("2026-09-02"), revive("2026-09-09")], "2026-09")).toBe(2);
  });

  it("ignora las justificadas por el entrenador", () => {
    expect(usados([revive("2026-09-02"), soborno("2026-09-03"), soborno("2026-09-04")], "2026-09")).toBe(1);
  });

  it("ignora las de otros meses", () => {
    expect(usados([revive("2026-08-31"), revive("2026-09-01"), revive("2026-10-01")], "2026-09")).toBe(1);
  });

  it("con tres usados quedan cero disponibles", () => {
    const tres = [revive("2026-09-02"), revive("2026-09-03"), revive("2026-09-04")];
    expect(disponibles(tres, "2026-09")).toBe(0);
  });

  it("sin revives quedan los tres disponibles", () => {
    expect(disponibles([], "2026-09")).toBe(CUPO_MENSUAL);
  });

  it("nunca devuelve disponibles negativos", () => {
    const cinco = ["01", "02", "03", "04", "05"].map((d) => revive(`2026-09-${d}`));
    expect(disponibles(cinco, "2026-09")).toBe(0);
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `cd web && npx vitest run cupo`
Expected: FAIL — no resuelve `./cupo`.

- [ ] **Step 4: Escribir la implementación mínima**

Crear `web/src/cupo.ts`:

```typescript
import type { Asistencia } from "./datos";

/**
 * GEMELO: `CupoRevivesCalculator` en Kotlin. Si cambia allá, cambia acá — y los nombres
 * de los casos de `cupo.test.ts` tienen que seguir coincidiendo uno a uno con los de
 * `CupoRevivesCalculatorTest.kt`.
 */
export const CUPO_MENSUAL = 3;

/** `mes` es el prefijo ISO del mes, "AAAA-MM". */
export function usados(asistencias: Asistencia[], mes: string): number {
  return asistencias.filter((a) => a.justificadaPorCliente && a.fecha.startsWith(mes)).length;
}

export function disponibles(asistencias: Asistencia[], mes: string): number {
  return Math.max(0, CUPO_MENSUAL - usados(asistencias, mes));
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `cd web && npx vitest run cupo && npx tsc --noEmit`
Expected: PASS, 6 tests. `tsc` sin errores.

- [ ] **Step 6: Comparar las listas de casos**

Abrir `app/src/test/java/com/osfit/app/domain/CupoRevivesCalculatorTest.kt` y `web/src/cupo.test.ts` lado a lado. Confirmar que los 6 nombres coinciden uno a uno. Si falta alguno, añadirlo antes de commitear.

- [ ] **Step 7: Commit**

```bash
git add web/src/cupo.ts web/src/cupo.test.ts web/src/datos.ts web/src/racha.ts
git commit -m "feat: port the revive allowance to the client web

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `falta.ts` — gemelo de `FaltaQueRompioLaRacha`

**Files:**
- Create: `web/src/falta.ts`, `web/src/falta.test.ts`

**Interfaces:**
- Consumes: `esDiaHabil` de `racha.ts` (Task 5).
- Produces: `faltaQueRompioLaRacha(asistencias: Asistencia[], hoy: string): string | null`.

- [ ] **Step 1: Escribir el test que falla**

Crear `web/src/falta.test.ts`, con los mismos 9 nombres de caso que el test de Kotlin:

```typescript
import { describe, expect, it } from "vitest";
import { faltaQueRompioLaRacha } from "./falta";
import type { Asistencia } from "./datos";

const base = { justificadaPorCliente: false, duracionMinutos: null };
const vino = (fecha: string): Asistencia => ({ ...base, fecha, asistio: true, justificada: false });
const falto = (fecha: string): Asistencia => ({ ...base, fecha, asistio: false, justificada: false });
const justificada = (fecha: string): Asistencia => ({ ...base, fecha, asistio: false, justificada: true });

/** Septiembre 2026: el 7 es lunes, el 11 viernes, el 12 y 13 fin de semana. */
describe("falta que rompió la racha", () => {
  it("encuentra la falta mas reciente cuando la racha esta rota", () => {
    const a = [vino("2026-09-07"), vino("2026-09-08"), falto("2026-09-09"), falto("2026-09-10")];
    expect(faltaQueRompioLaRacha(a, "2026-09-11")).toBe("2026-09-10");
  });

  it("devuelve null con la racha viva", () => {
    expect(faltaQueRompioLaRacha([vino("2026-09-09"), vino("2026-09-10")], "2026-09-11")).toBeNull();
  });

  it("devuelve null si volvio a venir despues de faltar", () => {
    expect(faltaQueRompioLaRacha([falto("2026-09-09"), vino("2026-09-10")], "2026-09-11")).toBeNull();
  });

  it("ignora las faltas ya justificadas", () => {
    const a = [vino("2026-09-08"), justificada("2026-09-09"), justificada("2026-09-10")];
    expect(faltaQueRompioLaRacha(a, "2026-09-11")).toBeNull();
  });

  it("ignora los fines de semana", () => {
    const a = [vino("2026-09-10"), vino("2026-09-11"), falto("2026-09-12")];
    expect(faltaQueRompioLaRacha(a, "2026-09-14")).toBeNull();
  });

  it("ignora la falta de hoy", () => {
    expect(faltaQueRompioLaRacha([vino("2026-09-10"), falto("2026-09-11")], "2026-09-11")).toBeNull();
  });

  it("devuelve null si ya vino hoy", () => {
    const a = [falto("2026-09-09"), falto("2026-09-10"), vino("2026-09-11")];
    expect(faltaQueRompioLaRacha(a, "2026-09-11")).toBeNull();
  });

  it("encuentra la falta sin ninguna asistencia previa", () => {
    expect(faltaQueRompioLaRacha([falto("2026-09-10")], "2026-09-11")).toBe("2026-09-10");
  });

  it("sin asistencias devuelve null", () => {
    expect(faltaQueRompioLaRacha([], "2026-09-11")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd web && npx vitest run falta`
Expected: FAIL — no resuelve `./falta`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `web/src/falta.ts`:

```typescript
import type { Asistencia } from "./datos";
import { esDiaHabil } from "./racha";

/**
 * GEMELO: `FaltaQueRompioLaRacha` en Kotlin. Mismos casos, mismos nombres.
 *
 * La falta hábil más reciente, anterior a hoy, sin justificar, y posterior a la última
 * fecha que cuenta para la racha. La más reciente y no la primera: es la única que
 * restaura racha. La última fecha que cuenta incluye hoy — si el cliente ya vino hoy,
 * su racha está viva y la página no le ofrece revivir nada.
 *
 * Las fechas son ISO, así que se comparan como strings sin parsear.
 */
export function faltaQueRompioLaRacha(asistencias: Asistencia[], hoy: string): string | null {
  const candidatas = asistencias
    .filter((a) => !a.asistio && !a.justificada && a.fecha < hoy && esDiaHabil(a.fecha))
    .map((a) => a.fecha)
    .sort();
  const candidata = candidatas[candidatas.length - 1];
  if (candidata === undefined) return null;

  const cuentan = asistencias
    .filter((a) => (a.asistio || a.justificada) && a.fecha <= hoy)
    .map((a) => a.fecha)
    .sort();
  const ultimaQueCuenta = cuentan[cuentan.length - 1];

  if (ultimaQueCuenta !== undefined && candidata <= ultimaQueCuenta) return null;
  return candidata;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd web && npx vitest run falta && npx tsc --noEmit`
Expected: PASS, 9 tests.

- [ ] **Step 5: Comparar las listas de casos**

Los 9 nombres de `falta.test.ts` tienen que coincidir uno a uno con `FaltaQueRompioLaRachaTest.kt`.

- [ ] **Step 6: Commit**

```bash
git add web/src/falta.ts web/src/falta.test.ts
git commit -m "port: find the streak-breaking absence in the client web

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `motivos.ts` — gemelo de `MotivosCambioDia`

**Files:**
- Create: `web/src/motivos.ts`, `web/src/motivos.test.ts`

**Interfaces:**
- Consumes: `esDiaHabil` de `racha.ts` (Task 5).
- Produces: `interface MotivoCambioDia { id: string; texto: string; permiteTextoLibre: boolean }` y `motivosDisponibles(asistencias: Asistencia[], hoy: string): MotivoCambioDia[]`.

- [ ] **Step 1: Escribir el test que falla**

Crear `web/src/motivos.test.ts`, con los mismos 9 nombres que `MotivosCambioDiaTest.kt`:

```typescript
import { describe, expect, it } from "vitest";
import { motivosDisponibles } from "./motivos";
import type { Asistencia } from "./datos";

const vino = (fecha: string): Asistencia => ({
  fecha, asistio: true, justificada: false, justificadaPorCliente: false, duracionMinutos: null
});
const ids = (a: Asistencia[], hoy: string) => motivosDisponibles(a, hoy).map((m) => m.id);

/** Septiembre 2026: el 7 y el 14 son lunes; el 11 viernes; el 12 y 13 fin de semana. */
describe("motivos del cambio de día", () => {
  it("el lunes ofrece el motivo del lunes", () => {
    expect(ids([vino("2026-09-11")], "2026-09-14")).toContain("lunes");
  });

  it("filtra el motivo del lunes cuando no es lunes", () => {
    expect(ids([vino("2026-09-10")], "2026-09-11")).not.toContain("lunes");
  });

  it("filtra el de mas de dos dias cuando asistio ayer", () => {
    expect(ids([vino("2026-09-10")], "2026-09-11")).not.toContain("volviendo");
  });

  it("ofrece el de mas de dos dias tras tres habiles sin venir", () => {
    expect(ids([vino("2026-09-07")], "2026-09-11")).toContain("volviendo");
  });

  it("no ofrece el de mas de dos dias con exactamente dos habiles sin venir", () => {
    expect(ids([vino("2026-09-08")], "2026-09-11")).not.toContain("volviendo");
  });

  it("no cuenta el fin de semana como dias sin venir", () => {
    expect(ids([vino("2026-09-11")], "2026-09-14")).not.toContain("volviendo");
  });

  it("sin ninguna asistencia ofrece el de mas de dos dias", () => {
    expect(ids([], "2026-09-11")).toContain("volviendo");
  });

  it("los tres motivos incondicionales siempre estan", () => {
    const obtenidos = ids([vino("2026-09-10")], "2026-09-11");
    for (const id of ["adelantar", "no_digo", "fragil", "otro"]) {
      expect(obtenidos).toContain(id);
    }
  });

  it("solo otro permite texto libre", () => {
    const libres = motivosDisponibles([], "2026-09-11").filter((m) => m.permiteTextoLibre);
    expect(libres.map((m) => m.id)).toEqual(["otro"]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd web && npx vitest run motivos`
Expected: FAIL — no resuelve `./motivos`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `web/src/motivos.ts`:

```typescript
import type { Asistencia } from "./datos";
import { esDiaHabil, restarUnDia } from "./racha";

export interface MotivoCambioDia {
  id: string;
  texto: string;
  permiteTextoLibre: boolean;
}

/**
 * GEMELO: `MotivosCambioDia` en Kotlin. Mismos casos, mismos nombres.
 *
 * Los dos primeros son condicionales porque son afirmaciones sobre hechos: ofrecer
 * "hoy es lunes" un miércoles enseña que las opciones no significan nada.
 */
export function motivosDisponibles(asistencias: Asistencia[], hoy: string): MotivoCambioDia[] {
  const motivos: MotivoCambioDia[] = [];

  if (esLunes(hoy)) {
    motivos.push({
      id: "lunes",
      texto: "Hoy es lunes y quiero iniciar con algo que me guste",
      permiteTextoLibre: false
    });
  }
  if (diasHabilesSinVenir(asistencias, hoy) > 2) {
    motivos.push({
      id: "volviendo",
      texto: "Tengo más de dos días sin venir y quiero iniciar con lo que yo quiera",
      permiteTextoLibre: false
    });
  }
  motivos.push({ id: "adelantar", texto: "Quiero adelantar el día", permiteTextoLibre: false });
  motivos.push({
    id: "no_digo",
    texto: "La neta no te quiero decir, solo no quiero hacerlo",
    permiteTextoLibre: false
  });
  motivos.push({ id: "fragil", texto: "Soy una perra frágil", permiteTextoLibre: false });
  motivos.push({ id: "otro", texto: "Otro (describe el motivo)", permiteTextoLibre: true });
  return motivos;
}

function esLunes(fecha: string): boolean {
  return new Date(`${fecha}T12:00:00`).getUTCDay() === 1;
}

/**
 * Días hábiles estrictamente entre la última asistencia y hoy. Sin ninguna asistencia
 * devuelve Infinity: alguien que nunca ha venido cuenta como "más de dos días".
 */
function diasHabilesSinVenir(asistencias: Asistencia[], hoy: string): number {
  const vinieron = asistencias
    .filter((a) => a.asistio && a.fecha < hoy)
    .map((a) => a.fecha)
    .sort();
  const ultima = vinieron[vinieron.length - 1];
  if (ultima === undefined) return Infinity;

  let contador = 0;
  let fecha = restarUnDia(hoy);
  while (fecha > ultima) {
    if (esDiaHabil(fecha)) contador++;
    fecha = restarUnDia(fecha);
  }
  return contador;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS. Total acumulado en web: 17 + 6 + 9 + 9 = 41 tests.

- [ ] **Step 5: Comparar las listas de casos**

Los 9 nombres de `motivos.test.ts` contra `MotivosCambioDiaTest.kt`, uno a uno.

- [ ] **Step 6: Commit**

```bash
git add web/src/motivos.ts web/src/motivos.test.ts
git commit -m "port: offer the day-change reasons in the client web

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `CambioDiaWeb`, reglas e índice

Todo lo que las functions y la app necesitan antes de que exista ninguna escritura: el modelo, el repositorio que la app observará, la regla que deja al cliente leer sus propios cambios, y el índice compuesto que el conteo del cupo requiere.

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/CambioDiaWeb.kt`
- Create: `app/src/main/java/com/osfit/app/data/repository/CambioDiaWebRepository.kt`
- Create: `firestore.indexes.json`
- Modify: `app/src/main/java/com/osfit/app/data/AppContainer.kt`
- Modify: `firestore.rules`
- Modify: `firebase.json`

**Interfaces:**
- Consumes: nada.
- Produces: `CambioDiaWeb(clienteId, fecha, diaIndex, motivo, creado)`; `CambioDiaWebRepository.observarCambiosPorFecha(fecha: String): Flow<List<CambioDiaWeb>>`; `AppContainer.cambioDiaWebRepository`.

- [ ] **Step 1: Crear el modelo**

Crear `app/src/main/java/com/osfit/app/data/model/CambioDiaWeb.kt`:

```kotlin
package com.osfit.app.data.model

import com.google.firebase.Timestamp

/**
 * Un cambio de día que el cliente hizo desde su página. Alimenta el indicador del
 * entrenador en el calendario.
 *
 * Doc id: "<clienteId>_<fecha>" — un solo cambio vigente por cliente y día; si el cliente
 * cambia dos veces, la segunda pisa a la primera y el indicador muestra la última.
 */
data class CambioDiaWeb(
    val clienteId: String = "",
    val fecha: String = "",
    val diaIndex: Int = 0,
    val motivo: String = "",
    val creado: Timestamp = Timestamp.now()
)
```

- [ ] **Step 2: Crear el repositorio**

Crear `app/src/main/java/com/osfit/app/data/repository/CambioDiaWebRepository.kt`, siguiendo el patrón de los repositorios existentes (interfaz + implementación Firestore con `callbackFlow`). Abrir `AsistenciaRepository.kt` y copiar exactamente su forma de `observarAsistenciasPorFecha`, cambiando la colección a `cambiosDia` y el tipo a `CambioDiaWeb`.

```kotlin
package com.osfit.app.data.repository

import com.osfit.app.data.model.CambioDiaWeb
import kotlinx.coroutines.flow.Flow

interface CambioDiaWebRepository {
    /** Los cambios de día que los clientes hicieron para [fecha]. */
    fun observarCambiosPorFecha(fecha: String): Flow<List<CambioDiaWeb>>
}
```

La implementación va en `data/repository/FirestoreCambioDiaWebRepository.kt`, siguiendo el patrón de `FirestoreClienteRepository` (prefijo `Firestore`, constructor que recibe el `FirebaseFirestore`).

- [ ] **Step 3: Registrarlo en `AppContainer`**

En `AppContainer.kt`, junto a los demás repositorios:

```kotlin
    val cambioDiaWebRepository: CambioDiaWebRepository by lazy {
        FirestoreCambioDiaWebRepository(firestore)
    }
```

- [ ] **Step 4: Añadir la regla de lectura**

En `firestore.rules`, la colección `cambiosDia` ya tiene regla de la Etapa 1, pero solo permite leer por `clienteId` del claim. Confirmar que dice exactamente esto y dejarlo:

```
    match /cambiosDia/{doc} {
      allow read: if esEntrenador() ||
                     resource.data.clienteId == request.auth.token.clienteId;
      allow write: if esEntrenador();
    }
```

El cliente **no** escribe aquí: la función lo hace con el Admin SDK, que no pasa por reglas.

- [ ] **Step 5: Crear el índice compuesto**

Crear `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "asistencias",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "clienteId", "order": "ASCENDING" },
        { "fieldPath": "justificadaPorCliente", "order": "ASCENDING" },
        { "fieldPath": "fecha", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

En `firebase.json`, añadir la clave `indexes` dentro de `firestore`:

```json
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
```

- [ ] **Step 6: Desplegar reglas e índice**

Run: `firebase deploy --only firestore:rules,firestore:indexes --project osfit-cccfe`
Expected: "rules file firestore.rules compiled successfully" y el índice creado. El índice tarda unos minutos en quedar `READY`; se puede seguir trabajando mientras.

- [ ] **Step 7: Compilar y correr la suite**

Run: `./gradlew test --console=plain`
Expected: BUILD SUCCESSFUL, 221 tests, 0 failures.

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/CambioDiaWeb.kt app/src/main/java/com/osfit/app/data/repository/CambioDiaWebRepository.kt app/src/main/java/com/osfit/app/data/AppContainer.kt firestore.indexes.json firebase.json firestore.rules
git commit -m "feat: add the day-change record and its composite index

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: `cambiarDia`

**Files:**
- Create: `functions/src/comun.ts`, `functions/src/cambiarDia.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `Asistencia.justificadaPorCliente` (Task 1), `CambioDiaWeb` (Task 8).
- Produces: `comun.ts` exporta `clienteAutenticado(req): Promise<string>` (devuelve el `clienteId` del claim o lanza), `hoyEnMazatlan(): string`, y `MOTIVOS_VALIDOS: string[]`. Endpoint `POST /cambiarDia` con cuerpo `{ diaIndex: number, motivo: string }`.

**Autenticación:** el navegador manda su ID token de Firebase en `Authorization: Bearer <token>`. La función lo verifica con `verifyIdToken` y lee el claim `clienteId` que minteó `sesion`. No se confía en ningún `clienteId` que venga en el cuerpo: eso permitiría escribirle a otro cliente.

- [ ] **Step 1: Escribir el módulo común**

Crear `functions/src/comun.ts`:

```typescript
import { getAuth } from "firebase-admin/auth";
import type { Request } from "firebase-functions/v2/https";

/** Los ids de `MotivosCambioDia`. "otro" viaja con texto libre aparte. */
export const MOTIVOS_VALIDOS = ["lunes", "volviendo", "adelantar", "no_digo", "fragil", "otro"];

/** Zona del gimnasio (Culiacan). GMT-7. No es America/Mexico_City. */
export const ZONA = "America/Mazatlan";

export function hoyEnMazatlan(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

/**
 * El clienteId del claim que mintea `sesion`, verificado contra Firebase.
 *
 * Nunca se lee un clienteId del cuerpo de la peticion: eso dejaria que cualquier
 * cliente le escribiera a otro. El claim viaja dentro de un token firmado.
 */
export async function clienteAutenticado(req: Request): Promise<string> {
  const cabecera = req.get("Authorization") ?? "";
  if (!cabecera.startsWith("Bearer ")) throw new Error("sin_token");
  const decodificado = await getAuth().verifyIdToken(cabecera.slice("Bearer ".length));
  const clienteId = decodificado.clienteId;
  if (typeof clienteId !== "string" || !clienteId) throw new Error("sin_claim");
  return clienteId;
}
```

- [ ] **Step 2: Escribir la función**

Crear `functions/src/cambiarDia.ts`:

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MOTIVOS_VALIDOS, clienteAutenticado, hoyEnMazatlan } from "./comun";

/**
 * El cliente cambia el dia de rutina que le toca hoy.
 *
 * Hace exactamente lo que `AsignarDiaManual.ejecutar` en la app: escribe el ancla fechada
 * **el dia anterior** a hoy (porque RutinaProgressCalculator toma el historial
 * estrictamente despues del ancla, y si se fechara hoy el ciclo quedaria trabado), y
 * corrige `diaRutinaRealizado` si ya hay asistencia registrada hoy.
 *
 * No hay limite de uso. Si el cliente cambia dos veces el mismo dia, la segunda pisa a la
 * primera: el doc id es "<clienteId>_<fecha>".
 */
export const cambiarDia = onRequest(
  { region: "us-west1", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "metodo_no_permitido" });
      return;
    }

    let clienteId: string;
    try {
      clienteId = await clienteAutenticado(req);
    } catch {
      res.status(401).json({ error: "no_autenticado" });
      return;
    }

    const diaIndex = req.body?.diaIndex;
    const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
    if (typeof diaIndex !== "number" || !Number.isInteger(diaIndex) || diaIndex < 0) {
      res.status(400).json({ error: "dia_invalido" });
      return;
    }
    if (!motivo) {
      res.status(400).json({ error: "motivo_invalido" });
      return;
    }

    const db = getFirestore();
    const clienteRef = db.collection("clientes").doc(clienteId);
    const cliente = await clienteRef.get();
    if (!cliente.exists) {
      res.status(404).json({ error: "cliente_no_encontrado" });
      return;
    }

    // El cliente inactivo lee su pagina pero no actua sobre ella: su historial es suyo,
    // cambiar una rutina que no esta haciendo, no.
    if (cliente.get("activo") === false) {
      res.status(403).json({ error: "cliente_inactivo" });
      return;
    }

    const dias = cliente.get("rutinaAsignada.dias");
    if (!Array.isArray(dias) || dias.length === 0) {
      res.status(400).json({ error: "sin_rutina" });
      return;
    }
    if (diaIndex >= dias.length) {
      res.status(400).json({ error: "dia_invalido" });
      return;
    }

    // Un motivo de la lista, o texto libre si eligio "Otro". El texto libre se recorta:
    // el indicador del entrenador no es un campo de notas.
    const esDeLaLista = MOTIVOS_VALIDOS.includes(motivo);
    const motivoGuardado = esDeLaLista ? motivo : motivo.slice(0, 200);

    const hoy = hoyEnMazatlan();
    const ancla = new Date(`${hoy}T12:00:00Z`);
    ancla.setUTCDate(ancla.getUTCDate() - 1);
    const anclaISO = ancla.toISOString().slice(0, 10);

    await clienteRef.update({
      diaActualIndex: diaIndex,
      diaAnclaFecha: anclaISO,
      ultimoDia: diaIndex,
      ultimoDiaFecha: anclaISO,
      ultimoDiaEsAncla: true
    });

    // Si ya hay asistencia de hoy, Calendario-Rutina tiene que decir lo mismo que se
    // acaba de asignar; si no, el historial pisaria la correccion al instante.
    const asistenciaHoy = await db.collection("asistencias")
      .where("clienteId", "==", clienteId).where("fecha", "==", hoy).limit(1).get();
    const doc = asistenciaHoy.docs[0];
    if (doc && doc.get("asistio") === true) {
      await doc.ref.update({ diaRutinaRealizado: diaIndex });
    }

    await db.collection("cambiosDia").doc(`${clienteId}_${hoy}`).set({
      clienteId, fecha: hoy, diaIndex, motivo: motivoGuardado, creado: Timestamp.now()
    });

    res.json({ ok: true, diaIndex, fecha: hoy });
  }
);
```

**Sobre los nombres del ancla:** son `diaActualIndex` y `diaAnclaFecha`, verificados en [`FirestoreClienteRepository.kt:96-100`](../../../app/src/main/java/com/osfit/app/data/repository/FirestoreClienteRepository.kt#L96-L100). Ojo con el primero: es `diaActualIndex`, **no** `diaAnclaIndex` — escribir el nombre equivocado deja el ancla invisible para la app y el cambio de día no surte efecto.

- [ ] **Step 3: Exportar la función**

En `functions/src/index.ts`:

```typescript
export { sesion } from "./sesion";
export { cambiarDia } from "./cambiarDia";
```

- [ ] **Step 4: Compilar**

Run: `cd functions && npm run build`
Expected: sin errores; aparecen `lib/comun.js` y `lib/cambiarDia.js`.

- [ ] **Step 5: Desplegar**

Run: `firebase deploy --only functions:cambiarDia --project osfit-cccfe`
Expected: "Successful create operation" y una Function URL. **Anotar esa URL**: la Task 11 la necesita.

- [ ] **Step 6: Probar los rechazos con curl**

```bash
URL=<la URL de cambiarDia>
curl -s "$URL" -w "\n%{http_code}\n"                                      # 405
curl -s -X POST "$URL" -H "Content-Type: application/json" -d '{}' -w "\n%{http_code}\n"  # 401
```
Expected: `metodo_no_permitido` con 405, y `no_autenticado` con 401. El camino feliz se prueba en la Task 12, desde la página, que es donde hay un ID token de verdad.

- [ ] **Step 7: Commit**

```bash
git add functions/src/comun.ts functions/src/cambiarDia.ts functions/src/index.ts
git commit -m "feat: let the client change today's routine day from the web

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: `revivirRacha`

**Files:**
- Create: `functions/src/revivirRacha.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `comun.ts` (Task 9), el índice compuesto (Task 8).
- Produces: endpoint `POST /revivirRacha` con cuerpo `{ fecha: string }`.

No recibe motivo. Faltar no se justifica ante la página.

- [ ] **Step 1: Escribir la función**

Crear `functions/src/revivirRacha.ts`:

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { clienteAutenticado, hoyEnMazatlan } from "./comun";

const CUPO_MENSUAL = 3;

/**
 * El cliente gasta uno de sus 3 revives del mes para justificar una falta.
 *
 * El cupo se cuenta aca y no en el navegador porque una regla de Firestore no puede
 * contar documentos: es la razon por la que esta accion es una funcion y no una escritura
 * directa. El conteo usa el indice compuesto (clienteId, justificadaPorCliente, fecha).
 */
export const revivirRacha = onRequest(
  { region: "us-west1", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "metodo_no_permitido" });
      return;
    }

    let clienteId: string;
    try {
      clienteId = await clienteAutenticado(req);
    } catch {
      res.status(401).json({ error: "no_autenticado" });
      return;
    }

    const fecha = typeof req.body?.fecha === "string" ? req.body.fecha : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      res.status(400).json({ error: "fecha_invalida" });
      return;
    }

    const hoy = hoyEnMazatlan();
    const db = getFirestore();

    const cliente = await db.collection("clientes").doc(clienteId).get();
    if (!cliente.exists) {
      res.status(404).json({ error: "cliente_no_encontrado" });
      return;
    }
    if (cliente.get("activo") === false) {
      res.status(403).json({ error: "cliente_inactivo" });
      return;
    }

    const asistencias = await db.collection("asistencias")
      .where("clienteId", "==", clienteId).get();
    const docs = asistencias.docs;

    // Se acepta hoy (avisar por adelantado) o la falta que rompio la racha. Cualquier otra
    // fecha se rechaza: si no, el cliente podria justificar cualquier dia del historial.
    if (fecha !== hoy && fecha !== faltaQueRompio(docs, hoy)) {
      res.status(400).json({ error: "fecha_no_permitida" });
      return;
    }

    const usados = docs.filter(
      (d) => d.get("justificadaPorCliente") === true && String(d.get("fecha")).startsWith(hoy.slice(0, 7))
    ).length;
    if (usados >= CUPO_MENSUAL) {
      res.status(409).json({ error: "sin_cupo", usados, cupo: CUPO_MENSUAL });
      return;
    }

    const existente = docs.find((d) => d.get("fecha") === fecha);

    // No tiene sentido justificar un dia al que vino. Misma condicion que justificarFalta().
    if (existente && existente.get("asistio") === true) {
      res.status(400).json({ error: "ese_dia_si_vino" });
      return;
    }

    if (existente) {
      await existente.ref.update({ justificada: true, justificadaPorCliente: true });
    } else {
      // Avisar por adelantado: se crea la falta ya justificada. registrarAsistencia()
      // conserva `justificada` al remarcar una falta y la limpia sola si termina
      // asistiendo, asi que esto no necesita coordinacion con la app.
      await db.collection("asistencias").add({
        clienteId, fecha, asistio: false, justificada: true, justificadaPorCliente: true,
        diaRutinaRealizado: null, nota: "", horaLlegada: null, horaSalida: null,
        duracionMinutos: null
      });
    }

    res.json({ ok: true, fecha, restantes: CUPO_MENSUAL - usados - 1 });
  }
);

/** GEMELO de `FaltaQueRompioLaRacha`. Ver esa doc para por que es la mas reciente. */
function faltaQueRompio(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  hoy: string
): string | null {
  const esDiaHabil = (f: string): boolean => {
    const d = new Date(`${f}T12:00:00Z`).getUTCDay();
    return d !== 0 && d !== 6;
  };
  const candidatas = docs
    .filter((d) => d.get("asistio") !== true && d.get("justificada") !== true)
    .map((d) => String(d.get("fecha")))
    .filter((f) => f < hoy && esDiaHabil(f))
    .sort();
  const candidata = candidatas[candidatas.length - 1];
  if (candidata === undefined) return null;

  const cuentan = docs
    .filter((d) => d.get("asistio") === true || d.get("justificada") === true)
    .map((d) => String(d.get("fecha")))
    .filter((f) => f <= hoy)
    .sort();
  const ultima = cuentan[cuentan.length - 1];
  if (ultima !== undefined && candidata <= ultima) return null;
  return candidata;
}
```

**Nota sobre el tercer gemelo:** `faltaQueRompio` acá es una tercera copia de la misma lógica. Se acepta a propósito: la función no puede importar del bundle de la web ni del de Kotlin, y sacarla a un paquete compartido por tres líneas no se paga. Si cambia la regla, cambian los tres — `FaltaQueRompioLaRacha.kt`, `falta.ts` y este. Está anotado en las tres cabeceras.

- [ ] **Step 2: Exportar y compilar**

En `functions/src/index.ts` añadir `export { revivirRacha } from "./revivirRacha";`

Run: `cd functions && npm run build`
Expected: sin errores.

- [ ] **Step 3: Desplegar**

Run: `firebase deploy --only functions:revivirRacha --project osfit-cccfe`
Expected: "Successful create operation". **Anotar la URL.**

- [ ] **Step 4: Probar los rechazos**

```bash
URL=<la URL de revivirRacha>
curl -s "$URL" -w "\n%{http_code}\n"                                       # 405
curl -s -X POST "$URL" -H "Content-Type: application/json" -d '{}' -w "\n%{http_code}\n"   # 401
```
Expected: 405 y 401.

- [ ] **Step 5: Commit**

```bash
git add functions/src/revivirRacha.ts functions/src/index.ts
git commit -m "feat: let the client spend a revive to justify an absence

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: `acciones.ts` y el modal

La plomería de la web: las dos llamadas HTTP y el diálogo reutilizable. Sin UI todavía — esta tarea se verifica compilando y desde la consola del navegador.

**Files:**
- Create: `web/src/acciones.ts`, `web/src/ui/modal.ts`
- Modify: `web/src/firebase.ts` (exportar `auth`)
- Modify: `web/src/estilos.css`

**Interfaces:**
- Consumes: las URLs de las Tasks 9 y 10.
- Produces: `cambiarDia(diaIndex: number, motivo: string): Promise<void>`, `revivirRacha(fecha: string): Promise<void>` — ambas lanzan `Error` con el código del servidor como `message`. `abrirModal(opciones): Promise<string | null>` devuelve el id elegido, o `null` si se canceló.

- [ ] **Step 1: Exportar `auth` desde `firebase.ts`**

En `web/src/firebase.ts`, cambiar `const auth = getAuth(app);` por:

```typescript
export const auth = getAuth(app);
```

- [ ] **Step 2: Escribir `acciones.ts`**

Crear `web/src/acciones.ts`. Sustituir las dos constantes por las URLs anotadas en las Tasks 9 y 10:

```typescript
import { auth } from "./firebase";

const URL_CAMBIAR_DIA = "PEGAR_LA_URL_DE_CAMBIAR_DIA";
const URL_REVIVIR_RACHA = "PEGAR_LA_URL_DE_REVIVIR_RACHA";

/**
 * Las dos acciones del cliente pasan por Cloud Function, nunca por escritura directa: el
 * cupo de 3 revives al mes no se puede hacer cumplir con reglas de Firestore.
 *
 * El ID token va en la cabecera. El clienteId NO viaja en el cuerpo — lo saca el servidor
 * del claim firmado, para que nadie pueda escribirle a otro cliente.
 */
async function llamar(url: string, cuerpo: unknown): Promise<void> {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error("sin_sesion");
  const token = await usuario.getIdToken();

  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo)
  });

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    throw new Error(typeof datos.error === "string" ? datos.error : "error_desconocido");
  }
}

export function cambiarDia(diaIndex: number, motivo: string): Promise<void> {
  return llamar(URL_CAMBIAR_DIA, { diaIndex, motivo });
}

export function revivirRacha(fecha: string): Promise<void> {
  return llamar(URL_REVIVIR_RACHA, { fecha });
}
```

**Este es el archivo que rompió la Etapa 1.** Los marcadores `PEGAR_...` tienen que quedar sustituidos antes de commitear; si no, la web hace POST contra una ruta relativa, el rewrite de hosting devuelve `index.html` con 200, y el fallo se disfraza de otra cosa. El Step 6 lo verifica.

- [ ] **Step 3: Escribir el modal**

Crear `web/src/ui/modal.ts`:

```typescript
export interface OpcionModal {
  id: string;
  texto: string;
  permiteTextoLibre?: boolean;
}

export interface OpcionesModal {
  titulo: string;
  descripcion?: string;
  opciones: OpcionModal[];
  textoConfirmar: string;
}

/**
 * Diálogo modal. Resuelve con el id elegido, o con null si el cliente canceló.
 *
 * Si la opción elegida permite texto libre, resuelve con ese texto en vez del id: es lo
 * que la función guarda como motivo.
 */
export function abrirModal(op: OpcionesModal): Promise<string | null> {
  return new Promise((resolver) => {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    fondo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${op.titulo}">
        <p class="modal-titulo">${op.titulo}</p>
        ${op.descripcion ? `<p class="modal-descripcion">${op.descripcion}</p>` : ""}
        <div class="modal-opciones">
          ${op.opciones.map((o, i) => `
            <label class="modal-opcion">
              <input type="radio" name="opcion" value="${o.id}" ${i === 0 ? "checked" : ""}>
              <span>${o.texto}</span>
            </label>
            ${o.permiteTextoLibre ? `<input class="modal-libre" data-para="${o.id}" type="text" maxlength="200" placeholder="Cuéntame">` : ""}
          `).join("")}
        </div>
        <div class="modal-botones">
          <button type="button" class="boton-secundario" id="modal-cancelar">Cancelar</button>
          <button type="button" class="boton" id="modal-confirmar">${op.textoConfirmar}</button>
        </div>
      </div>`;

    const cerrar = (valor: string | null): void => {
      fondo.remove();
      document.removeEventListener("keydown", alPulsarTecla);
      resolver(valor);
    };
    const alPulsarTecla = (e: KeyboardEvent): void => {
      if (e.key === "Escape") cerrar(null);
    };

    fondo.querySelector("#modal-cancelar")!.addEventListener("click", () => cerrar(null));
    // Tocar fuera cancela: en un teléfono es el gesto natural para salir.
    fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(null); });
    document.addEventListener("keydown", alPulsarTecla);

    fondo.querySelector("#modal-confirmar")!.addEventListener("click", () => {
      const elegido = fondo.querySelector<HTMLInputElement>('input[name="opcion"]:checked');
      if (!elegido) return cerrar(null);
      const libre = fondo.querySelector<HTMLInputElement>(`.modal-libre[data-para="${elegido.value}"]`);
      if (libre) {
        const texto = libre.value.trim();
        // Sin texto no se confirma: guardar "otro" pelado no le dice nada al entrenador.
        if (!texto) { libre.focus(); return; }
        return cerrar(texto);
      }
      cerrar(elegido.value);
    });

    document.body.appendChild(fondo);
  });
}
```

- [ ] **Step 4: Añadir los estilos**

Al final de `web/src/estilos.css`, siguiendo las variables que el archivo ya define:

```css
.modal-fondo {
  position: fixed; inset: 0; background: rgba(0, 0, 0, .6);
  display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 10;
}
.modal {
  background: var(--superficie); border-radius: 14px; padding: 18px;
  width: 100%; max-width: 420px; max-height: 85vh; overflow-y: auto;
}
.modal-titulo { font-weight: 700; font-size: 17px; margin: 0 0 6px; }
.modal-descripcion { color: var(--texto-tenue); font-size: 14px; margin: 0 0 12px; }
.modal-opciones { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-opcion { display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.35; }
.modal-libre {
  margin: -2px 0 4px 26px; padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--superficie-alta); background: var(--fondo); color: inherit; font: inherit;
}
.modal-botones { display: flex; gap: 10px; justify-content: flex-end; }
.boton, .boton-secundario {
  padding: 11px 16px; border-radius: 999px; border: 0; font: inherit; font-weight: 600;
  cursor: pointer; min-height: 44px;
}
.boton { background: var(--primario); color: var(--sobre-primario); }
.boton-secundario { background: transparent; color: var(--texto-tenue); }
```

Las variables usadas están verificadas en [`estilos.css:1-13`](../../../web/src/estilos.css#L1-L13): `--fondo`, `--superficie`, `--superficie-alta`, `--texto-tenue`, `--primario`, `--sobre-primario`. El `min-height: 44px` no es decorativo: es el mínimo táctil, y esta página se usa de pie en el gimnasio.

- [ ] **Step 5: Compilar**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: sin errores de tipos; 41 tests siguen pasando.

- [ ] **Step 6: Verificar que no quedan marcadores**

Run: `grep -rn "PEGAR_" web/src/`
Expected: **sin resultados**. Si aparece alguno, sustituirlo antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add web/src/acciones.ts web/src/ui/modal.ts web/src/firebase.ts web/src/estilos.css
git commit -m "feat: add the action calls and the modal dialog

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Los dos botones de la tarjeta del día

**Files:**
- Modify: `web/src/ui/tarjetaDia.ts`
- Modify: `web/src/datos.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Consumes: `motivosDisponibles` (Task 7), `abrirModal` (Task 11), `cambiarDia` (Task 11).
- Produces: `observarCambioDeHoy(clienteId, hoy, alCambiar)` en `datos.ts`; `tarjetaDia(cliente, hoy, cambioDeHoy)` con un parámetro nuevo.

- [ ] **Step 1: Observar el cambio de hoy**

En `web/src/datos.ts`, añadir:

```typescript
export interface CambioDiaWeb {
  diaIndex: number;
  motivo: string;
  creado: { seconds: number } | null;
}

/** El cambio de día que el cliente hizo hoy, si lo hizo. Doc id: "<clienteId>_<fecha>". */
export function observarCambioDeHoy(
  clienteId: string,
  hoy: string,
  alCambiar: (c: CambioDiaWeb | null) => void
) {
  return onSnapshot(doc(db, "cambiosDia", `${clienteId}_${hoy}`), (snap) => {
    alCambiar(snap.exists() ? (snap.data() as CambioDiaWeb) : null);
  });
}
```

- [ ] **Step 2: Añadir los botones y la confirmación**

En `web/src/ui/tarjetaDia.ts`, cambiar la firma y el `return` final del camino normal:

```typescript
export function tarjetaDia(
  cliente: Cliente,
  hoy: string,
  cambioDeHoy: CambioDiaWeb | null
): string {
```

y el bloque final:

```typescript
  if (indice === null) return "";

  // Cliente inactivo: lee su página, pero no actúa sobre ella. Su historial es suyo;
  // cambiar una rutina que no está haciendo, no.
  const acciones = cliente.activo === false ? "" : `
    <div class="acciones">
      <button type="button" class="boton" id="cambiar-dia">Quiero cambiar el día que me toca</button>
      <button type="button" class="boton-secundario" id="no-puedo-ir">Hoy no voy a poder ir</button>
    </div>`;

  // Sin esta línea el cliente no sabe si el toque funcionó y vuelve a tocar.
  const confirmacion = cambioDeHoy ? `
    <p class="confirmacion">Cambiaste tu día hoy${horaDe(cambioDeHoy)} · ${escapar(cambioDeHoy.motivo)}</p>` : "";

  return `
    <div class="tarjeta hoy">
      <p class="tarjeta-titulo">Hoy te toca</p>
      <p class="hoy-dia">Día ${indice + 1}<br>${escapar(dias[indice]?.nombreDia ?? "")}</p>
      ${confirmacion}
      ${acciones}
    </div>`;
}

function horaDe(cambio: CambioDiaWeb): string {
  if (!cambio.creado) return "";
  const d = new Date(cambio.creado.seconds * 1000);
  return ` a las ${d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}`;
}
```

Añadir al principio del archivo `import type { CambioDiaWeb } from "../datos";`.

- [ ] **Step 3: Cablear el listener en `main.ts`**

`pintar()` reemplaza todo el `innerHTML`, así que los listeners se reenganchan en cada pintada. Dentro de `pintar()`, después de los de navegación del mes:

```typescript
    document.querySelector("#cambiar-dia")?.addEventListener("click", async () => {
      if (!cliente?.rutinaAsignada) return;
      const motivos = motivosDisponibles(asistencias, hoy);
      const motivo = await abrirModal({
        titulo: "¿Por qué quieres cambiar tu día?",
        opciones: motivos.map((m) => ({ id: m.id, texto: m.texto, permiteTextoLibre: m.permiteTextoLibre })),
        textoConfirmar: "Continuar"
      });
      if (!motivo) return;

      const dias = cliente.rutinaAsignada.dias;
      const elegido = await abrirModal({
        titulo: "¿Cuál quieres hacer hoy?",
        opciones: dias.map((d, i) => ({ id: String(i), texto: `Día ${i + 1} · ${d.nombreDia}` })),
        textoConfirmar: "Cambiar mi día"
      });
      if (elegido === null) return;

      try {
        await cambiarDiaEnServidor(Number(elegido), motivo);
      } catch (e) {
        alert(mensajeDeError((e as Error).message));
      }
    });
```

y en las declaraciones del módulo:

```typescript
import { cambiarDia as cambiarDiaEnServidor, revivirRacha as revivirRachaEnServidor } from "./acciones";
import { motivosDisponibles } from "./motivos";
import { abrirModal } from "./ui/modal";
import { observarCambioDeHoy } from "./datos";
import type { CambioDiaWeb } from "./datos";

/** Los códigos que devuelven las functions, en palabras que el cliente entienda. */
function mensajeDeError(codigo: string): string {
  switch (codigo) {
    case "sin_cupo": return "Ya usaste tus 3 revives de este mes.";
    case "cliente_inactivo": return "Tu cuenta está pausada. Habla con tu entrenador.";
    case "sin_rutina": return "Todavía no tienes rutina asignada.";
    case "ese_dia_si_vino": return "Ese día sí viniste, no hace falta revivirlo.";
    case "fecha_no_permitida": return "Solo puedes revivir hoy o la falta que rompió tu racha.";
    case "sin_sesion": return "Tu sesión expiró. Abre de nuevo tu link.";
    default: return "No pudimos guardarlo. Revisa tu conexión e inténtalo otra vez.";
  }
}
```

Declarar el estado nuevo junto a `cliente` y `asistencias`:

```typescript
  let cambioDeHoy: CambioDiaWeb | null = null;
```

pasarlo en la llamada: `${tarjetaDia(cliente, hoy, cambioDeHoy)}`, y suscribirse al final junto a las otras dos observaciones:

```typescript
  observarCambioDeHoy(clienteId, hoy, (c) => { cambioDeHoy = c; pintar(); });
```

- [ ] **Step 4: Añadir los estilos de las acciones**

Al final de `web/src/estilos.css`:

```css
.acciones { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.confirmacion {
  color: var(--texto-tenue); font-size: 13px; margin: 10px 0 0;
  border-top: 1px solid var(--superficie-alta); padding-top: 10px;
}
```

- [ ] **Step 5: Compilar y desplegar**

Run: `cd web && npx tsc --noEmit && npm run build && cd .. && firebase deploy --only hosting --project osfit-cccfe`
Expected: build limpio y "release complete".

- [ ] **Step 6: Probar el camino completo en el navegador**

Abrir la página de un cliente de prueba. Tocar "Quiero cambiar el día que me toca", elegir un motivo, elegir un día, confirmar.

Expected:
- La tarjeta pasa a mostrar el día elegido **sin recargar** (el `onSnapshot` del cliente lo trae).
- Debajo aparece la línea de confirmación con la hora y el motivo.
- En la app Android, la ficha de ese cliente muestra el mismo día.
- Elegir "Otro" sin escribir nada no deja confirmar.

- [ ] **Step 7: Commit**

```bash
git add web/src/ui/tarjetaDia.ts web/src/datos.ts web/src/main.ts web/src/estilos.css
git commit -m "feat: let the client change their day from the page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Racha rota, "Revivir mi racha" y "Hoy no voy a poder ir"

Las dos acciones que gastan revive. Van juntas porque comparten la confirmación y el mismo endpoint: la diferencia es solo qué fecha mandan.

**Files:**
- Modify: `web/src/ui/tarjetasStats.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/estilos.css`

**Interfaces:**
- Consumes: `faltaQueRompioLaRacha` (Task 6), `disponibles` (Task 5), `abrirModal` (Task 11), `revivirRacha` (Task 11).
- Produces: `tarjetasStats(asistencias, hoy, activo)` con un parámetro nuevo.

**Asimetría deliberada:** cambiar de día pide motivo; faltar no. Pedirle a alguien enfermo que elija de una lista por qué no puede ir convierte un aviso en un trámite. Lo único que se pregunta antes de faltar es la confirmación del revive, porque son 3 al mes y nadie debe descubrir que gastó uno por un toque accidental.

- [ ] **Step 1: Pintar la racha rota**

Reescribir `web/src/ui/tarjetasStats.ts`:

```typescript
import type { Asistencia } from "../datos";
import { disponibles } from "../cupo";
import { faltaQueRompioLaRacha } from "../falta";
import { promedioMinutos, rachaActual } from "../racha";

/** "2026-09-10" → "jueves 10 de septiembre" */
function enPalabras(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long"
  });
}

export function tarjetasStats(asistencias: Asistencia[], hoy: string, activo: boolean): string {
  const racha = rachaActual(asistencias, hoy);
  const promedio = promedioMinutos(asistencias);
  const rota = faltaQueRompioLaRacha(asistencias, hoy);
  const revives = disponibles(asistencias, hoy.slice(0, 7));

  // Con la racha viva este bloque no existe: la página no le recuerda al cliente que
  // puede faltar. Sin revives tampoco se ofrece el botón, pero sí se dice por qué.
  const bloqueRota = rota === null ? "" : `
    <p class="racha-rota">La rompiste el ${enPalabras(rota)}.</p>
    ${activo && revives > 0
      ? `<button type="button" class="boton" id="revivir" data-fecha="${rota}">
           Revivir mi racha · te quedan ${revives}
         </button>`
      : `<p class="sin-revives">Ya usaste tus 3 revives de este mes.</p>`}`;

  return `
    <div class="fila">
      <div class="tarjeta ${rota === null ? "" : "tarjeta-rota"}">
        <p class="tarjeta-titulo">Tu racha</p>
        <p class="numero">🔥 ${racha}</p>
        <p style="color: var(--texto-tenue); font-size: 12px; margin: 0">
          ${racha === 1 ? "día seguido sin faltar" : "días seguidos sin faltar"}
        </p>
        ${bloqueRota}
      </div>
      <div class="tarjeta">
        <p class="tarjeta-titulo">Promedio</p>
        <p class="numero">${promedio ?? "—"}</p>
        <p style="color: var(--texto-tenue); font-size: 12px; margin: 0">
          ${promedio === null ? "aún sin sesiones medidas" : "minutos por sesión"}
        </p>
      </div>
    </div>`;
}
```

- [ ] **Step 2: Cablear los dos botones**

En `main.ts`, pasar el nuevo argumento: `${tarjetasStats(asistencias, hoy, cliente.activo !== false)}`.

Añadir dentro de `pintar()`, y extraer la confirmación a una función porque los dos botones la comparten:

```typescript
    async function confirmarYRevivir(fecha: string): Promise<void> {
      const restantes = disponibles(asistencias, hoy.slice(0, 7));
      const elegido = await abrirModal({
        titulo: `¿Usar uno de tus ${CUPO_MENSUAL} revives?`,
        descripcion: `Te quedan ${restantes} este mes.`,
        opciones: [{ id: "si", texto: "Sí, usar uno" }],
        textoConfirmar: "Sí, usar uno"
      });
      if (elegido === null) return;
      try {
        await revivirRachaEnServidor(fecha);
        await abrirModal({
          titulo: "Esperamos que todo esté bien, te vemos mañana si Dios quiere!",
          opciones: [{ id: "ok", texto: "Gracias" }],
          textoConfirmar: "Cerrar"
        });
      } catch (e) {
        alert(mensajeDeError((e as Error).message));
      }
    }

    document.querySelector("#revivir")?.addEventListener("click", (e) => {
      const fecha = (e.currentTarget as HTMLElement).dataset.fecha;
      if (fecha) void confirmarYRevivir(fecha);
    });

    // "Hoy no voy a poder ir" es el mismo revive, con la fecha de hoy: avisar por
    // adelantado crea la falta ya justificada.
    document.querySelector("#no-puedo-ir")?.addEventListener("click", () => {
      void confirmarYRevivir(hoy);
    });
```

Añadir a los imports: `import { CUPO_MENSUAL, disponibles } from "./cupo";`

- [ ] **Step 3: Añadir los estilos**

```css
.tarjeta-rota { border: 1px solid var(--rojo); }
.racha-rota { color: var(--rojo); font-size: 13px; margin: 10px 0 8px; }
.sin-revives { color: var(--texto-tenue); font-size: 12px; margin: 8px 0 0; }
```

`--rojo` es el mismo que el calendario usa para "faltaste" y `--ambar` el de "justificada", así que la racha rota y una falta se ven igual, que es lo correcto: son el mismo concepto.

- [ ] **Step 4: Compilar y desplegar**

Run: `cd web && npx tsc --noEmit && npx vitest run && npm run build && cd .. && firebase deploy --only hosting --project osfit-cccfe`
Expected: 41 tests pasando, build limpio, "release complete".

- [ ] **Step 5: Probar los dos caminos**

Con un cliente que tenga la racha rota:
- La tarjeta de racha sale con borde rojo y dice qué día la rompió.
- "Revivir mi racha · te quedan N" abre la confirmación; cancelar no escribe nada.
- Confirmar muestra "Esperamos que todo esté bien…", el día se pinta ámbar en el calendario **sin recargar**, y la racha sube.
- Repetir hasta agotar los 3: al cuarto intento el botón ya no aparece y en su lugar dice "Ya usaste tus 3 revives de este mes".

Con un cliente con la racha viva:
- **No** aparece el botón de revivir ni la línea roja.
- "Hoy no voy a poder ir" abre la misma confirmación y, al aceptar, pinta hoy en ámbar.

- [ ] **Step 6: Commit**

```bash
git add web/src/ui/tarjetasStats.ts web/src/main.ts web/src/estilos.css
git commit -m "feat: let the client revive their streak and report an absence

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Indicadores en el calendario de la app

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/calendario/TomarAsistenciaViewModel.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/calendario/TomarAsistenciaScreen.kt`

**Interfaces:**
- Consumes: `CambioDiaWebRepository.observarCambiosPorFecha` (Task 8), `Asistencia.justificadaPorCliente` (Task 1).
- Produces: nada que consuma otra tarea.

El indicador dice **que** el cliente avisó, nunca **por qué** faltó: el aviso de ausencia no lleva motivo, y el cambio de día sí. Ambas colecciones ya se observan en tiempo real; no hay plumbing nuevo.

- [ ] **Step 1: Exponer los cambios del día en el ViewModel**

En `TomarAsistenciaViewModel.kt`, junto a los flows que ya expone, añadir uno para los cambios de la fecha visible, con el mismo patrón (`stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())`):

```kotlin
    val cambiosDia: StateFlow<List<CambioDiaWeb>> =
        cambioDiaWebRepository.observarCambiosPorFecha(fecha)
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
```

y recibir el repositorio en el constructor, con default desde `AppContainer` como hacen los demás:

```kotlin
    private val cambioDiaWebRepository: CambioDiaWebRepository = AppContainer.cambioDiaWebRepository,
```

- [ ] **Step 2: Pintar el indicador**

En `TomarAsistenciaScreen.kt`, dentro de la tarjeta de cada cliente (la que hoy muestra el nombre y "Faltó"/"Asistió"), añadir debajo del nombre:

```kotlin
val cambio = cambiosDia.firstOrNull { it.clienteId == cliente.id }
val avisoAusencia = asistencia?.justificadaPorCliente == true

when {
    cambio != null -> Text(
        text = "Cambió su día: ${textoMotivo(cambio.motivo)}",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.primary
    )
    avisoAusencia -> Text(
        // Sin motivo a propósito: faltar no pide explicaciones.
        text = "Avisó que no viene",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.tertiary
    )
}
```

Y una función privada en el mismo archivo que traduzca los ids a texto, con el texto libre pasando tal cual:

```kotlin
/** Los ids vienen de MotivosCambioDia; cualquier otra cosa es el texto libre de "Otro". */
private fun textoMotivo(motivo: String): String = when (motivo) {
    "lunes" -> "es lunes y quiere empezar con algo que le guste"
    "volviendo" -> "lleva más de dos días sin venir"
    "adelantar" -> "quiere adelantar el día"
    "no_digo" -> "no quiso decir"
    "fragil" -> "es una perra frágil"
    "otro" -> "otro"
    else -> motivo
}
```

- [ ] **Step 3: Compilar y correr la suite**

Run: `./gradlew test --console=plain`
Expected: BUILD SUCCESSFUL, 221 tests, 0 failures.

- [ ] **Step 4: Verificar en el dispositivo**

Run: `./gradlew installDebug`

Con la página de un cliente abierta, cambiar su día desde la web y mirar la pantalla "Tomar asistencia" de la app **sin salir de ella**: tiene que aparecer "Cambió su día: …" solo. Después, desde la web, tocar "Hoy no voy a poder ir" con otro cliente: aparece "Avisó que no viene", sin motivo.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/calendario/
git commit -m "feat: show web day changes and absence notices in the calendar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: Cupo visible en la ficha del cliente

Para poder contrastar cuando un cliente diga que se le acabaron los revives.

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`

**Interfaces:**
- Consumes: `CupoRevivesCalculator` (Task 2).
- Produces: `ClienteDetailViewModel.revivesDisponibles: StateFlow<Int>`.

- [ ] **Step 1: Exponer el cupo**

En `ClienteDetailViewModel.kt`, junto a los demás flows. El ViewModel ya observa las asistencias del cliente; reutilizar ese flow en vez de abrir otro:

```kotlin
    /** Revives que le quedan al cliente este mes. Se cuentan, no se guardan. */
    val revivesDisponibles: StateFlow<Int> = asistencias
        .map { CupoRevivesCalculator.disponibles(it, SincronizadorDiaWeb.hoy().substring(0, 7)) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CupoRevivesCalculator.CUPO_MENSUAL)
```

Si el flow de asistencias del cliente tiene otro nombre en ese archivo, usar ese. Si no existe, añadirlo con `asistenciaRepository.observarAsistenciasPorCliente(clienteId)`.

- [ ] **Step 2: Mostrarlo en la tarjeta de acceso web**

En `ClienteDetailScreen.kt`, dentro de la tarjeta "Acceso web", debajo del link:

```kotlin
val revives by viewModel.revivesDisponibles.collectAsStateWithLifecycle()
Text(
    text = "Revives: $revives de ${CupoRevivesCalculator.CUPO_MENSUAL} disponibles este mes",
    style = MaterialTheme.typography.bodySmall,
    color = MaterialTheme.colorScheme.onSurfaceVariant
)
```

- [ ] **Step 3: Compilar y correr la suite**

Run: `./gradlew test --console=plain`
Expected: BUILD SUCCESSFUL, 221 tests.

- [ ] **Step 4: Verificar en el dispositivo**

Run: `./gradlew installDebug`

Abrir la ficha de un cliente que haya gastado un revive: debe decir "Revives: 2 de 3 disponibles este mes". Desmarcar esa justificada desde la app y confirmar que el número **vuelve a 3 solo**, sin recargar nada — esa es la ventaja de contar en vez de guardar un contador.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/
git commit -m "feat: show the client's remaining revives to the trainer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: Verificación final en dispositivo

Nada de esto se prueba con tests automáticos: son las cosas que solo fallan contra Firebase real. La Etapa 1 enseñó que las suites verdes no significan que la página funcione — sus dos bugs pasaron los 211 tests.

**Files:** ninguno (verificación)

- [ ] **Step 1: Correr todas las suites**

```bash
./gradlew test --console=plain
cd web && npx vitest run && npx tsc --noEmit && cd ..
```
Expected: Kotlin 221 PASS, TypeScript 41 PASS, `tsc` sin errores.

- [ ] **Step 2: Verificar que no quedan marcadores de configuración**

```bash
grep -rn "PEGAR_" web/src/ functions/src/
```
Expected: **sin resultados**. Este es el fallo exacto que dejó la Etapa 1 inservible.

- [ ] **Step 3: Verificar que el cliente sigue sin poder escribir directo**

Con la página abierta como cliente, en la consola del navegador:

```javascript
const { getFirestore, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js");
const db = getFirestore();
try { await setDoc(doc(db, "cambiosDia", "inventado"), { x: 1 }); console.log("❌ PERMITIDO"); }
catch (e) { console.log("✅ denegado", e.code); }
```

Repetir con `asistencias/inventado` y con `clientes/<propio-id>`. Los tres tienen que dar `permission-denied`: **todas** las escrituras del cliente pasan por función. Si alguna pasa, las reglas están mal y no se puede seguir.

- [ ] **Step 4: Verificar el cupo contra el servidor, no contra la UI**

La UI esconde el botón al llegar a 3, pero el que manda es el servidor. Con los 3 revives ya gastados, desde la consola:

```javascript
const t = await firebase.auth().currentUser.getIdToken();
const r = await fetch("<URL de revivirRacha>", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
  body: JSON.stringify({ fecha: "<una falta vieja>" })
});
console.log(r.status, await r.json());
```
Expected: **409 `sin_cupo`**. Y con una fecha arbitraria del pasado que no sea la falta que rompió la racha: **400 `fecha_no_permitida`**.

- [ ] **Step 5: Verificar el cambio de día de punta a punta**

Para tres clientes distintos — uno a mitad de ciclo, uno en el último día del ciclo, y uno con "Asignar día" aplicado hoy — cambiar el día desde la web y confirmar que:
1. La tarjeta de la web muestra el día nuevo sin recargar.
2. La ficha de la app muestra **el mismo** día.
3. Mañana el ciclo avanza al siguiente (verificable cambiando la fecha del dispositivo, o anotándolo para el día siguiente).

El punto 3 es el que justifica que el ancla se feche el día anterior. Si el ciclo se queda trabado en el día elegido, el ancla se escribió con la fecha de hoy.

- [ ] **Step 6: Verificar el cliente inactivo**

Marcar un cliente de prueba como inactivo. Su página debe leerse completa, pero **sin** los botones de acción. Y aunque se llame a la función directamente con curl y un token válido, debe responder **403 `cliente_inactivo`**.

- [ ] **Step 7: Verificar los indicadores del entrenador**

Con la pantalla "Tomar asistencia" abierta en la app, hacer desde la web un cambio de día con un cliente y un aviso de ausencia con otro. Ambos indicadores deben aparecer **sin salir de la pantalla**. El de ausencia no debe mostrar motivo alguno.

- [ ] **Step 8: Actualizar el README**

En `README.md`, dentro de la sección "Web para clientes", añadir después del primer párrafo:

```markdown
Desde su página el cliente puede cambiar el día que le toca (con un motivo, que el
entrenador ve en su calendario) y avisar que no va a ir. Avisar gasta uno de sus **3
revives al mes**, que se cuentan consultando las asistencias `justificadaPorCliente`
del mes en curso — no hay contador que mantener. Las dos acciones pasan por Cloud
Function (`cambiarDia`, `revivirRacha`): el cliente nunca escribe directo a Firestore.
```

- [ ] **Step 9: Commit final**

```bash
git add README.md
git commit -m "docs: document the client web actions in the README

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Qué queda para la Etapa 3

Subida de insignias a Storage, `imagenUrl` en los dos catálogos, botón de publicar video, retención de los 6 más recientes, y las secciones de medallas, logros y videos en la página.

El spec dice que va al final a propósito: es la etapa con más trabajo de infraestructura (Storage, migración de las insignias que ya existen) y la única cuyo valor es enteramente estético. **Si algo se corta por tiempo, se corta acá.**

## Riesgos conocidos de esta etapa

**Tres copias de `FaltaQueRompioLaRacha`.** Kotlin, la web y la función `revivirRacha`. La función no puede importar de ninguno de los otros dos. Si cambia la regla de qué falta es revivible, hay que cambiar los tres — está anotado en las tres cabeceras, pero nada lo fuerza mecánicamente.

**El índice compuesto tarda.** `firebase deploy --only firestore:indexes` devuelve antes de que el índice esté `READY`. Si `revivirRacha` devuelve 500 justo después de desplegar, revisar el estado del índice en la consola antes de buscar el bug en otro lado.

**Días sin documento de asistencia.** Un día hábil en el que el entrenador no guardó asistencia rompe la racha pero no aparece como candidato a revivir, porque no hay documento que justificar. En la práctica la pantalla "Tomar asistencia" escribe documento para todos los clientes del día, así que el hueco es raro. No se resuelve en esta etapa.

**El revive por adelantado depende de `registrarAsistencia()`.** Cuando el cliente avisa de hoy, la función crea la falta ya justificada. Que eso siga funcionando depende de que `registrarAsistencia()` conserve `justificada` al remarcar una falta y la limpie si el cliente termina asistiendo. Ese comportamiento existe hoy; si alguien lo cambia, el revive por adelantado se pierde en silencio.
