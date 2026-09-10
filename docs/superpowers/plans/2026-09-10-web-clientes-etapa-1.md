# Web para clientes — Etapa 1: acceso y lectura

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada cliente pueda abrir un link personal y ver, en solo lectura, el día de rutina que le toca hoy, su racha, su promedio de minutos por sesión y su calendario de asistencias.

**Architecture:** La app Android denormaliza en el documento del cliente el día que le toca (calculado por `RutinaProgressCalculator`, que sigue siendo la única implementación real). Un sitio estático en Firebase Hosting lee Firestore directo, con permisos acotados por un custom claim `clienteId`, e interpreta ese dato denormalizado en tres líneas. Una sola Cloud Function (`sesion`) canjea el token del link por un custom token de Firebase. El cliente no escribe nada en esta etapa.

**Tech Stack:** Kotlin + Jetpack Compose (app existente), Firebase Auth + Firestore + Hosting, Cloud Functions v2 sobre Node 20 + TypeScript, sitio en Vite + TypeScript sin framework, Vitest para los tests de TS, JUnit4 para los de Kotlin.

**Spec:** `docs/superpowers/specs/2026-09-10-web-clientes-design.md`

## Global Constraints

- **Idioma:** código, nombres de variables, comentarios y nombres de test **en español**. Mensajes de commit **en inglés**. Ver `GEMINI.md`.
- **Comentarios:** solo explican el *porqué* de decisiones no obvias, nunca repiten lo que el código ya dice.
- **Firestore:** todo `data class` necesita valor por defecto en **todos** los campos (constructor sin argumentos). El `id` no se guarda dentro del documento: se escribe con `.copy(id = "")` y se rellena al leer desde `doc.id`.
- **Repositorios:** clases planas, no interfaces. La única interfaz es `ClienteRepository`, por razones históricas — al agregarle un método hay que implementarlo en `FirestoreClienteRepository` **y** en `FakeClienteRepository`.
- **ViewModels:** reciben repositorios por constructor con `AppContainer.xxx` como valor por defecto.
- **Tests Kotlin:** JUnit4, nombres en backticks y en español describiendo el comportamiento. Solo para `domain/` y `video/`.
- **Zona horaria:** todo cálculo de "hoy" usa `America/Mazatlan`. Nunca la zona del navegador.
- **UID del entrenador:** `G8lW4rIgXhZrswQXJ84pT1StFx82`.
- **Proyecto Firebase:** `osfit-cccfe`. Bucket de Storage: `osfit-cccfe.firebasestorage.app` (región `us-west1`).
- **Commits:** uno por tarea, en inglés, con prefijo `feat:` / `fix:` / `refactor:` / `docs:`, terminando con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **No hacer `push`** salvo que el entrenador lo pida.

---

## Estructura de archivos

**Kotlin (app existente):**

| Archivo | Responsabilidad |
|---|---|
| `domain/RutinaProgressCalculator.kt` (modificar) | Se le agrega `denormalizar()`, que reusa el mismo `anclaDe()` privado que `diaQueToca()`. Viven juntos a propósito: es lo que hace imposible que se separen. |
| `data/model/DiaDenormalizado.kt` (crear) | El trío que la web interpreta. |
| `data/model/Cliente.kt` (modificar) | Tres campos nuevos + `tieneAccesoWeb`. |
| `data/model/AccesoWeb.kt` (crear) | Token de acceso del cliente. |
| `data/repository/AccesoWebRepository.kt` (crear) | Crear, observar y revocar accesos. |
| `data/SincronizadorDiaWeb.kt` (crear) | Único lugar que refresca la denormalización. Todos los caminos de escritura lo llaman. |
| `util/WhatsAppUtil.kt` (modificar) | Mensaje del link de acceso. |
| `ui/clientes/ClienteDetailScreen.kt` (modificar) | Botones de compartir/copiar/revocar acceso. |

**Web (proyecto nuevo, carpeta `web/`):**

| Archivo | Responsabilidad |
|---|---|
| `web/src/dia.ts` | Las 3 líneas que interpretan el trío. La única lógica de negocio del sitio. |
| `web/src/fecha.ts` | `hoyEnMazatlan()`. Nadie más llama a `new Date()` para saber qué día es. |
| `web/src/firebase.ts` | Inicialización del SDK y canje de sesión. |
| `web/src/datos.ts` | Suscripciones a Firestore (cliente + asistencias). |
| `web/src/ui/*.ts` | Un archivo por sección de la página. |
| `web/src/main.ts` | Arranque y composición. |

**Functions (proyecto nuevo, carpeta `functions/`):**

| Archivo | Responsabilidad |
|---|---|
| `functions/src/sesion.ts` | Canjea token por custom token. |
| `functions/src/index.ts` | Exporta las funciones. |

---

### Task 1: `denormalizar()` en `RutinaProgressCalculator`

Es la tarea más importante del plan. El contrato que define acá es lo que la web va a interpretar durante toda la vida del proyecto.

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/DiaDenormalizado.kt`
- Modify: `app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt`
- Test: `app/src/test/java/com/osfit/app/domain/DiaDenormalizadoTest.kt`

**Interfaces:**
- Consumes: `Cliente`, `Asistencia`, y los privados `anclaDe()` / `siguienteDia()` que ya existen en el calculador.
- Produces:
  - `data class DiaDenormalizado(val dia: Int?, val fecha: String?, val esAncla: Boolean)`
  - `RutinaProgressCalculator.denormalizar(cliente: Cliente, asistenciasDelCliente: List<Asistencia>, hoy: String): DiaDenormalizado`
  - `RutinaProgressCalculator.interpretar(valor: DiaDenormalizado, totalDias: Int, fecha: String): Int`

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/test/java/com/osfit/app/domain/DiaDenormalizadoTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.domain.EscenarioRutina.Companion.ANA
import com.osfit.app.domain.EscenarioRutina.Companion.BETO
import com.osfit.app.domain.EscenarioRutina.Companion.CARLA
import com.osfit.app.domain.EscenarioRutina.Companion.DIA1
import com.osfit.app.domain.EscenarioRutina.Companion.DIA2
import com.osfit.app.domain.EscenarioRutina.Companion.DIA3
import com.osfit.app.domain.EscenarioRutina.Companion.DIEGO
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * La web no recalcula el día: interpreta el trío que la app denormaliza. Este test es la
 * red de seguridad de ese mecanismo — verifica que interpretar el trío da **exactamente**
 * lo mismo que `diaQueToca`, que es la única implementación real.
 *
 * Si alguien cambia el calculador y no la denormalización, estos tests fallan.
 */
class DiaDenormalizadoTest {

    /** Denormaliza en [hoy] e interpreta en [cuando]; debe coincidir con diaQueToca(cuando). */
    private fun assertEquivale(e: EscenarioRutina, id: String, hoy: String, cuando: String) = runBlocking {
        val cliente = e.cliente(id)
        val asistencias = e.asistenciasDe(id)
        val totalDias = cliente.rutinaAsignada?.dias?.size ?: 0

        val valor = RutinaProgressCalculator.denormalizar(cliente, asistencias, hoy)
        val interpretado = RutinaProgressCalculator.interpretar(valor, totalDias, cuando)

        assertEquals(
            "denormalizado en $hoy e interpretado en $cuando",
            RutinaProgressCalculator.diaQueToca(cliente, asistencias, cuando),
            interpretado
        )
    }

    @Test
    fun `sin asistencias equivale al dia del ancla`() {
        val e = EscenarioRutina()
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA1)
    }

    @Test
    fun `sin asistencias sigue equivaliendo dias despues`() {
        val e = EscenarioRutina()
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA3)
    }

    @Test
    fun `con asistencia de hoy equivale al dia que esta haciendo`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA1)
    }

    @Test
    fun `con asistencia de ayer equivale al dia siguiente`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `el trio no caduca al pasar los dias sin escrituras`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        // Denormalizado una sola vez en DIA1, interpretado tres días después: la web
        // funciona sin que nadie refresque nada mientras no haya movimientos.
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA3)
    }

    @Test
    fun `equivale en la vuelta al dia 1 del ciclo`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(BETO, DIA1, asistio = true) // Beto está en el último día de su ciclo
        assertEquivale(e, BETO, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `las faltas no avanzan el ciclo tampoco al denormalizar`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = false)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `equivale para un cliente anterior al corte`() {
        val e = EscenarioRutina()
        assertEquivale(e, CARLA, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `sin rutina asignada equivale a cero`() {
        val e = EscenarioRutina()
        assertEquivale(e, DIEGO, hoy = DIA1, cuando = DIA1)
    }

    @Test
    fun `tras asignar dia manualmente equivale al dia asignado`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ANA, dia = 3, fecha = DIA1)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA1)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `sin rutina el dia denormalizado es nulo`() = runBlocking {
        val e = EscenarioRutina()
        val valor = RutinaProgressCalculator.denormalizar(e.cliente(DIEGO), e.asistenciasDe(DIEGO), DIA1)
        assertEquals(null, valor.dia)
    }
}
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `./gradlew test --tests "com.osfit.app.domain.DiaDenormalizadoTest"`
Expected: FAIL — `Unresolved reference: denormalizar`

- [ ] **Step 3: Crear el modelo**

Crear `app/src/main/java/com/osfit/app/data/model/DiaDenormalizado.kt`:

```kotlin
package com.osfit.app.data.model

/**
 * Resultado de `RutinaProgressCalculator.denormalizar`, guardado en el documento del cliente
 * para que la web no tenga que recalcular el día.
 *
 * No es un documento de Firestore: se guarda desarmado en tres campos de `Cliente`, porque
 * un objeto anidado obligaría a la web a manejar el caso "el mapa existe pero está vacío".
 *
 * @param dia día del ciclo; null si el cliente no tiene rutina asignada.
 * @param fecha fecha ISO a la que corresponde [dia]; null si [dia] es null.
 * @param esAncla true si [dia] viene de una asignación manual y no de una asistencia. Cambia
 *   cómo se interpreta: un ancla vale tal cual mientras no haya asistencias posteriores, una
 *   asistencia vieja significa que le toca el día siguiente.
 */
data class DiaDenormalizado(
    val dia: Int? = null,
    val fecha: String? = null,
    val esAncla: Boolean = false
)
```

- [ ] **Step 4: Implementar `denormalizar` e `interpretar`**

En `app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt`, agregar el import:

```kotlin
import com.osfit.app.data.model.DiaDenormalizado
```

y agregar estas dos funciones dentro del `object`, **justo debajo de `diaQueToca`**:

```kotlin
    /**
     * Comprime el estado del cliente en el trío que la web interpreta, para que no tenga que
     * reimplementar [diaQueToca] en TypeScript. Vive en este archivo, y no en una clase
     * aparte, para que comparta [anclaDe] con el cálculo real: es lo que hace estructuralmente
     * imposible que las dos versiones se separen.
     *
     * Contrato, verificado en `DiaDenormalizadoTest`: para toda fecha `d >= hoy`,
     * `interpretar(denormalizar(c, a, hoy), totalDias, d) == diaQueToca(c, a, d)`, mientras no
     * haya asistencias posteriores a [hoy] ni escrituras nuevas.
     *
     * Las asistencias posteriores a [hoy] se ignoran igual que en [diaQueToca]. Si el
     * entrenador registra una fecha futura, el trío no la refleja hasta la siguiente
     * escritura — la web muestra un día viejo, nunca uno inventado.
     */
    fun denormalizar(
        cliente: Cliente,
        asistenciasDelCliente: List<Asistencia>,
        hoy: String
    ): DiaDenormalizado {
        val totalDias = cliente.rutinaAsignada?.dias?.size ?: 0
        if (totalDias <= 0) return DiaDenormalizado()

        val ancla = anclaDe(cliente)

        val ultima = asistenciasDelCliente
            .filter { it.clienteId == cliente.id || cliente.id.isEmpty() }
            .filter { it.asistio && it.diaRutinaRealizado != null }
            .filter { it.fecha > ancla.fecha && it.fecha <= hoy }
            .maxByOrNull { it.fecha }
            ?: return DiaDenormalizado(
                dia = ancla.dia.coerceIn(0, totalDias - 1),
                fecha = ancla.fecha,
                esAncla = true
            )

        return DiaDenormalizado(
            dia = ultima.diaRutinaRealizado!!.coerceIn(0, totalDias - 1),
            fecha = ultima.fecha,
            esAncla = false
        )
    }

    /**
     * Interpreta el trío de [denormalizar]. Es la referencia de las tres líneas que corre la
     * web: si cambia acá, hay que cambiar `web/src/dia.ts`.
     */
    fun interpretar(valor: DiaDenormalizado, totalDias: Int, fecha: String): Int {
        val dia = valor.dia ?: return 0
        if (totalDias <= 0) return 0
        val acotado = dia.coerceIn(0, totalDias - 1)
        if (valor.esAncla) return acotado
        return if (valor.fecha == fecha) acotado else siguienteDia(acotado, totalDias)
    }
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `./gradlew test --tests "com.osfit.app.domain.DiaDenormalizadoTest"`
Expected: PASS — 11 tests

- [ ] **Step 6: Correr toda la suite para verificar que no se rompió nada**

Run: `./gradlew test`
Expected: PASS — 189 tests (178 previos + 11 nuevos)

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/DiaDenormalizado.kt \
        app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt \
        app/src/test/java/com/osfit/app/domain/DiaDenormalizadoTest.kt
git commit -m "feat: derive a denormalized routine day for the client web

The web cannot run Kotlin, so it needs the routine day precomputed. denormalizar()
lives inside RutinaProgressCalculator and shares its private anchor logic, which is
what keeps it from drifting away from diaQueToca. Tests assert the two agree.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Campos nuevos en `Cliente` y su escritura

**Files:**
- Modify: `app/src/main/java/com/osfit/app/data/model/Cliente.kt`
- Modify: `app/src/main/java/com/osfit/app/data/repository/ClienteRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/data/repository/FirestoreClienteRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/data/fake/FakeClienteRepository.kt`

**Interfaces:**
- Consumes: `DiaDenormalizado` de la Task 1.
- Produces: `ClienteRepository.actualizarDiaDenormalizado(clienteId: String, valor: DiaDenormalizado)` y `ClienteRepository.actualizarTieneAccesoWeb(clienteId: String, tiene: Boolean)`. Los campos `Cliente.ultimoDia`, `.ultimoDiaFecha`, `.ultimoDiaEsAncla`, `.tieneAccesoWeb`.

- [ ] **Step 1: Agregar los campos al modelo**

En `app/src/main/java/com/osfit/app/data/model/Cliente.kt`, agregar al final del constructor, **después** de `cancionInicioSegundos`:

```kotlin
    // Resultado denormalizado de RutinaProgressCalculator.denormalizar(), solo para que la
    // web no reimplemente el cálculo. La app **no** lee estos campos: sigue llamando al
    // calculador. Así un valor viejo degrada la web pero no puede corromper nada.
    val ultimoDia: Int? = null,
    val ultimoDiaFecha: String? = null,
    val ultimoDiaEsAncla: Boolean = false,
    // Comodidad de UI: si está desincronizado, la ficha ofrece "Compartir" en vez de
    // "Copiar link". La verdad sobre el acceso vive en la colección accesosWeb.
    val tieneAccesoWeb: Boolean = false
```

- [ ] **Step 2: Agregar los métodos a la interfaz**

En `app/src/main/java/com/osfit/app/data/repository/ClienteRepository.kt`, agregar el import `com.osfit.app.data.model.DiaDenormalizado` y estos métodos antes de `eliminarCliente`:

```kotlin
    /** Refresca el día denormalizado que consume la web. Lo llama SincronizadorDiaWeb. */
    suspend fun actualizarDiaDenormalizado(clienteId: String, valor: DiaDenormalizado)
    suspend fun actualizarTieneAccesoWeb(clienteId: String, tiene: Boolean)
```

- [ ] **Step 3: Implementar en Firestore**

En `app/src/main/java/com/osfit/app/data/repository/FirestoreClienteRepository.kt`, agregar el import de `DiaDenormalizado` y estos métodos antes de `eliminarCliente`:

```kotlin
    override suspend fun actualizarDiaDenormalizado(clienteId: String, valor: DiaDenormalizado) {
        coleccion.document(clienteId).update(
            mapOf(
                "ultimoDia" to valor.dia,
                "ultimoDiaFecha" to valor.fecha,
                "ultimoDiaEsAncla" to valor.esAncla
            )
        ).await()
    }

    override suspend fun actualizarTieneAccesoWeb(clienteId: String, tiene: Boolean) {
        coleccion.document(clienteId).update("tieneAccesoWeb", tiene).await()
    }
```

- [ ] **Step 4: Implementar en el fake**

En `app/src/main/java/com/osfit/app/data/fake/FakeClienteRepository.kt`, agregar el import de `DiaDenormalizado` y estos métodos junto a los demás `override`:

```kotlin
    override suspend fun actualizarDiaDenormalizado(clienteId: String, valor: DiaDenormalizado) {
        actualizarCliente(clienteId) {
            it.copy(
                ultimoDia = valor.dia,
                ultimoDiaFecha = valor.fecha,
                ultimoDiaEsAncla = valor.esAncla
            )
        }
    }

    override suspend fun actualizarTieneAccesoWeb(clienteId: String, tiene: Boolean) {
        actualizarCliente(clienteId) { it.copy(tieneAccesoWeb = tiene) }
    }
```

- [ ] **Step 5: Compilar y correr los tests**

Run: `./gradlew test`
Expected: PASS — 189 tests. Si falla la compilación por un `override` faltante, es que quedó una implementación de `ClienteRepository` sin actualizar.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/Cliente.kt \
        app/src/main/java/com/osfit/app/data/repository/ClienteRepository.kt \
        app/src/main/java/com/osfit/app/data/repository/FirestoreClienteRepository.kt \
        app/src/main/java/com/osfit/app/data/fake/FakeClienteRepository.kt
git commit -m "feat: store the denormalized routine day on the client document

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `SincronizadorDiaWeb` en todos los caminos de escritura

El riesgo de este diseño es que un camino de escritura olvide refrescar. Esta tarea existe para recorrerlos todos de una vez, y deja un test que falla si aparece un camino nuevo sin cubrir.

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/SincronizadorDiaWeb.kt`
- Modify: `app/src/main/java/com/osfit/app/data/AppContainer.kt`
- Modify: `app/src/main/java/com/osfit/app/domain/AsignarDiaManual.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt`
- Test: `app/src/test/java/com/osfit/app/domain/SincronizadorDiaWebTest.kt`

**Interfaces:**
- Consumes: `RutinaProgressCalculator.denormalizar` (Task 1), `ClienteRepository.actualizarDiaDenormalizado` (Task 2).
- Produces: `SincronizadorDiaWeb.refrescar(clienteId: String, hoy: String)` y `SincronizadorDiaWeb.refrescarTodos(hoy: String)`.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/test/java/com/osfit/app/domain/SincronizadorDiaWebTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.SincronizadorDiaWeb
import com.osfit.app.domain.EscenarioRutina.Companion.ANA
import com.osfit.app.domain.EscenarioRutina.Companion.DIA1
import com.osfit.app.domain.EscenarioRutina.Companion.DIA2
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * El trío denormalizado solo sirve si está fresco. Estos tests recorren cada camino que
 * mueve el día y verifican que después de cada uno, interpretar el trío guardado da lo
 * mismo que preguntarle al calculador.
 */
class SincronizadorDiaWebTest {

    private suspend fun assertFresco(e: EscenarioRutina, id: String, hoy: String) {
        val cliente = e.cliente(id)
        val totalDias = cliente.rutinaAsignada?.dias?.size ?: 0
        val guardado = com.osfit.app.data.model.DiaDenormalizado(
            dia = cliente.ultimoDia,
            fecha = cliente.ultimoDiaFecha,
            esAncla = cliente.ultimoDiaEsAncla
        )
        assertEquals(
            "el trío guardado quedó viejo",
            RutinaProgressCalculator.diaQueToca(cliente, e.asistenciasDe(id), hoy),
            RutinaProgressCalculator.interpretar(guardado, totalDias, hoy)
        )
    }

    private fun sincronizador(e: EscenarioRutina) =
        SincronizadorDiaWeb(e.clientes, e.asistencias)

    @Test
    fun `tras marcar asistencia el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras marcar falta el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = false)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras asignar dia el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ANA, dia = 3, fecha = DIA1)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras corregir el dia en calendario el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.corregirDiaEnCalendario(ANA, DIA1, dia = 2)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras reiniciar el dia el trio vuelve al estado anterior`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        sincronizador(e).refrescar(ANA, DIA1)
        e.reiniciarDia(DIA1)
        sincronizador(e).refrescarTodos(DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras iniciar tiempo el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.iniciarTiempo(ANA, DIA1)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `refrescar en un dia no adelanta el trio de dias futuros`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        sincronizador(e).refrescar(ANA, DIA1)
        // Sin escrituras nuevas, el mismo trío tiene que servir mañana.
        assertFresco(e, ANA, DIA2)
    }
}
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `./gradlew test --tests "com.osfit.app.domain.SincronizadorDiaWebTest"`
Expected: FAIL — `Unresolved reference: SincronizadorDiaWeb`

- [ ] **Step 3: Crear el sincronizador**

Crear `app/src/main/java/com/osfit/app/data/SincronizadorDiaWeb.kt`:

```kotlin
package com.osfit.app.data

import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.domain.RutinaProgressCalculator
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.flow.first

/**
 * Único lugar que refresca el día denormalizado que consume la web.
 *
 * Existe como clase aparte, y no como llamadas sueltas dentro de cada repositorio, porque
 * el riesgo de este diseño es justamente "un camino de escritura que olvidó refrescar":
 * concentrarlo hace que la pregunta "¿quién refresca?" se responda leyendo un solo archivo.
 *
 * Refrescar es idempotente y barato (una lectura y un update), así que ante la duda conviene
 * llamarlo de más y no de menos.
 */
class SincronizadorDiaWeb(
    private val clienteRepository: ClienteRepository,
    private val asistenciaRepository: AsistenciaRepository
) {
    companion object {
        /** Zona del gimnasio (Culiacán). No usar la del dispositivo: la web fija esta misma. */
        val ZONA: ZoneId = ZoneId.of("America/Mazatlan")

        fun hoy(): String = LocalDate.now(ZONA).toString()
    }

    suspend fun refrescar(clienteId: String, hoy: String = hoy()) {
        val cliente = clienteRepository.observarCliente(clienteId).first() ?: return
        val asistencias = asistenciaRepository.observarAsistenciasPorCliente(clienteId).first()
        val valor = RutinaProgressCalculator.denormalizar(cliente, asistencias, hoy)
        clienteRepository.actualizarDiaDenormalizado(clienteId, valor)
    }

    /** Para operaciones que tocan a varios clientes de una vez, como "Reiniciar día". */
    suspend fun refrescarTodos(hoy: String = hoy()) {
        clienteRepository.observarClientes().first().forEach { refrescar(it.id, hoy) }
    }
}
```

- [ ] **Step 4: Registrarlo en `AppContainer`**

En `app/src/main/java/com/osfit/app/data/AppContainer.kt`, agregar dentro del `object`:

```kotlin
    val sincronizadorDiaWeb: SincronizadorDiaWeb by lazy {
        SincronizadorDiaWeb(clienteRepository, asistenciaRepository)
    }
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `./gradlew test --tests "com.osfit.app.domain.SincronizadorDiaWebTest"`
Expected: PASS — 7 tests

- [ ] **Step 6: Llamarlo desde `AsignarDiaManual`**

En `app/src/main/java/com/osfit/app/domain/AsignarDiaManual.kt`, cambiar la firma de `ejecutar` para recibir el sincronizador y llamarlo al final:

```kotlin
    suspend fun ejecutar(
        clienteRepository: ClienteRepository,
        asistenciaRepository: AsistenciaRepository,
        clienteId: String,
        diaIndex: Int,
        hoy: String,
        sincronizador: SincronizadorDiaWeb? = null
    ) {
        val ancla = LocalDate.parse(hoy).minusDays(1).toString()
        clienteRepository.asignarDiaAncla(clienteId, diaIndex, ancla)
        asistenciaRepository.actualizarDiaRealizado(clienteId, hoy, diaIndex)
        // Se refresca al final, cuando el ancla y el registro ya están escritos: el trío
        // tiene que reflejar el estado final, no uno intermedio.
        sincronizador?.refrescar(clienteId, hoy)
    }
```

Agregar el import `com.osfit.app.data.SincronizadorDiaWeb`. El parámetro es opcional para no romper `EscenarioRutina`, que lo llama sin sincronizador a propósito: sus tests verifican el cálculo real, no la denormalización.

- [ ] **Step 7: Llamarlo desde los ViewModels que escriben asistencias**

En `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt`, agregar al constructor:

```kotlin
    private val sincronizadorDiaWeb: SincronizadorDiaWeb = AppContainer.sincronizadorDiaWeb
```

con el import `com.osfit.app.data.SincronizadorDiaWeb`, y pasarlo en la llamada a `AsignarDiaManual.ejecutar(...)` agregando `sincronizador = sincronizadorDiaWeb`.

También en `ClienteDetailViewModel`, en `asignarRutina` (línea ~117), agregar después de `clienteRepository.asignarRutina(clienteId, rutina)`:

```kotlin
            // Cambiar de rutina cambia la cantidad de días, así que el día denormalizado
            // puede quedar fuera de rango.
            sincronizadorDiaWeb.refrescar(clienteId)
```

En `app/src/main/java/com/osfit/app/ui/calendario/TomarAsistenciaViewModel.kt`, agregar al constructor `private val sincronizadorDiaWeb: SincronizadorDiaWeb = AppContainer.sincronizadorDiaWeb` con su import, y refrescar en los **cuatro** puntos que mueven el día:

| Línea aprox. | Llamada | Qué agregar después |
|---|---|---|
| 94 | `asistenciaRepository.iniciarTiempo(...)` | `sincronizadorDiaWeb.refrescar(cliente.id, fecha)` |
| 123 | `asistenciaRepository.registrarAsistencia(...)` | `sincronizadorDiaWeb.refrescar(cliente.id, fecha)` dentro del mismo bucle |
| 141 | `asistenciaRepository.reiniciarDia(fecha)` | `sincronizadorDiaWeb.refrescarTodos(fecha)` |
| 158 | `asistenciaRepository.actualizarDiaRealizado(...)` | `sincronizadorDiaWeb.refrescar(clienteId, fecha)` |

`detenerTiempo` (línea ~104) **no** necesita refresco: solo escribe `horaSalida` y `duracionMinutos`, que no entran en el cálculo del día.

`SandboxViewModel` tampoco: usa los repositorios fake en memoria y nunca toca Firestore.

- [ ] **Step 8: Correr toda la suite**

Run: `./gradlew test`
Expected: PASS — 196 tests

- [ ] **Step 9: Compilar**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 10: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/SincronizadorDiaWeb.kt \
        app/src/main/java/com/osfit/app/data/AppContainer.kt \
        app/src/main/java/com/osfit/app/domain/AsignarDiaManual.kt \
        app/src/main/java/com/osfit/app/ui/ \
        app/src/test/java/com/osfit/app/domain/SincronizadorDiaWebTest.kt
git commit -m "feat: refresh the denormalized day on every write path

Concentrated in one class rather than scattered across repositories: the failure
mode of this design is a write path that forgets to refresh, so the question
'who refreshes?' should be answerable by reading a single file.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `AccesoWeb` y su repositorio

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/AccesoWeb.kt`
- Create: `app/src/main/java/com/osfit/app/data/repository/AccesoWebRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/data/AppContainer.kt`

**Interfaces:**
- Produces: `AccesoWebRepository.observarAcceso(clienteId): Flow<AccesoWeb?>`, `.crearAcceso(clienteId): String` (devuelve el token), `.revocarAcceso(token)`.

- [ ] **Step 1: Crear el modelo**

Crear `app/src/main/java/com/osfit/app/data/model/AccesoWeb.kt`:

```kotlin
package com.osfit.app.data.model

import com.google.firebase.Timestamp

/**
 * Acceso web de un cliente, en la colección `accesosWeb`. **El id del documento es el token**
 * del link, así que canjearlo es una lectura directa por id en vez de una query.
 *
 * Vive fuera de `clientes/{id}` a propósito: así el documento que el propio cliente puede
 * leer no contiene ningún secreto.
 */
data class AccesoWeb(
    val token: String = "",
    val clienteId: String = "",
    val creado: Timestamp = Timestamp.now()
)
```

- [ ] **Step 2: Crear el repositorio**

Crear `app/src/main/java/com/osfit/app/data/repository/AccesoWebRepository.kt`:

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.AccesoWeb
import java.security.SecureRandom
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class AccesoWebRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("accesosWeb")

    private companion object {
        // Sin caracteres ambiguos: el entrenador puede terminar dictando un link por teléfono.
        const val ALFABETO = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        const val LARGO_TOKEN = 32
    }

    /**
     * SecureRandom y no Random: este valor es la única credencial del cliente, así que tiene
     * que ser impredecible, no solo variado.
     */
    private fun generarToken(): String {
        val random = SecureRandom()
        return (1..LARGO_TOKEN)
            .map { ALFABETO[random.nextInt(ALFABETO.length)] }
            .joinToString("")
    }

    fun observarAcceso(clienteId: String): Flow<AccesoWeb?> = callbackFlow {
        val registro = coleccion.whereEqualTo("clienteId", clienteId).limit(1)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val doc = snapshot?.documents?.firstOrNull()
                trySend(doc?.toObject(AccesoWeb::class.java)?.copy(token = doc.id))
            }
        awaitClose { registro.remove() }
    }

    /** Crea el acceso si no existe y devuelve el token vigente. Idempotente. */
    suspend fun crearAcceso(clienteId: String): String {
        val existente = coleccion.whereEqualTo("clienteId", clienteId).limit(1).get().await()
        existente.documents.firstOrNull()?.let { return it.id }

        val token = generarToken()
        coleccion.document(token)
            .set(AccesoWeb(clienteId = clienteId).copy(token = ""))
            .await()
        return token
    }

    /** Revocar es borrar: no deja un secreto inerte que alguien pueda olvidar consultar. */
    suspend fun revocarAcceso(token: String) {
        coleccion.document(token).delete().await()
    }
}
```

- [ ] **Step 3: Registrarlo en `AppContainer`**

```kotlin
    val accesoWebRepository: AccesoWebRepository by lazy { AccesoWebRepository() }
```

con su import.

- [ ] **Step 4: Compilar**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/AccesoWeb.kt \
        app/src/main/java/com/osfit/app/data/repository/AccesoWebRepository.kt \
        app/src/main/java/com/osfit/app/data/AppContainer.kt
git commit -m "feat: add per-client web access tokens

The token is the document id, so redeeming it is a direct read. It lives in its own
collection so the client document, which the client can read, holds no secrets.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Reglas de Firestore

Esta tarea cierra el agujero que hoy es inofensivo solo porque existe un único usuario.

**Files:**
- Modify: `firestore.rules`
- Create: `firebase.json`
- Create: `.firebaserc`

- [ ] **Step 1: Reescribir las reglas**

Reemplazar el contenido completo de `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // El entrenador es un UID literal. Con un solo entrenador es más simple y se audita de
    // un vistazo; si algún día hay dos, esto pasa a ser un custom claim.
    function esEntrenador() {
      return request.auth != null &&
             request.auth.uid == 'G8lW4rIgXhZrswQXJ84pT1StFx82';
    }

    // El claim lo pone la función `sesion` al canjear el token del link. No se puede
    // falsificar: viaja dentro de un token firmado por Firebase.
    function esCliente(cid) {
      return request.auth != null &&
             request.auth.token.clienteId == cid;
    }

    match /clientes/{cid} {
      allow read: if esEntrenador() || esCliente(cid);
      allow write: if esEntrenador();

      // Los pagos quedan fuera del alcance del cliente a propósito.
      match /pagos/{doc} {
        allow read, write: if esEntrenador();
      }
      match /medallas/{doc} {
        allow read: if esEntrenador() || esCliente(cid);
        allow write: if esEntrenador();
      }
      match /logrosPersonales/{doc} {
        allow read: if esEntrenador() || esCliente(cid);
        allow write: if esEntrenador();
      }
      match /videos/{doc} {
        allow read: if esEntrenador() || esCliente(cid);
        allow write: if esEntrenador();
      }
      match /personal_records/{doc} {
        allow read, write: if esEntrenador();
      }
    }

    match /asistencias/{doc} {
      allow read: if esEntrenador() ||
                     resource.data.clienteId == request.auth.token.clienteId;
      allow write: if esEntrenador();
    }

    match /cambiosDia/{doc} {
      allow read: if esEntrenador() ||
                     resource.data.clienteId == request.auth.token.clienteId;
      allow write: if esEntrenador();
    }

    // El token de acceso nunca se expone al navegador: solo lo lee el Admin SDK, que no
    // pasa por estas reglas.
    match /accesosWeb/{token} {
      allow read, write: if esEntrenador();
    }

    // Catálogos y configuración: el cliente no los necesita. Su rutina viaja embebida en su
    // propio documento, así que `rutinas` tampoco hace falta abrirla.
    match /rutinas/{doc} { allow read, write: if esEntrenador(); }
    match /medallas/{doc} { allow read, write: if esEntrenador(); }
    match /logrosPersonales/{doc} { allow read, write: if esEntrenador(); }
    match /configVideo/{doc} { allow read, write: if esEntrenador(); }
  }
}
```

- [ ] **Step 2: Crear la configuración de Firebase**

Crear `.firebaserc`:

```json
{
  "projects": {
    "default": "osfit-cccfe"
  }
}
```

Crear `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "hosting": {
    "public": "web/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "functions": {
    "source": "functions",
    "codebase": "default"
  }
}
```

El `rewrite` a `/index.html` es necesario para que `/c/<token>` y `/mi` lleguen al sitio en vez de dar 404: el ruteo lo hace el JS, no el servidor.

- [ ] **Step 3: Desplegar las reglas**

```bash
firebase deploy --only firestore:rules
```
Expected: `+ Deploy complete!`

- [ ] **Step 4: Verificar que la app sigue funcionando**

Run: `./gradlew installDebug`

Abrir la app en el teléfono y confirmar que la lista de clientes carga, que se puede marcar una asistencia y que el calendario se ve. **Si algo da "permission denied", las reglas están mal y hay que arreglarlas antes de seguir** — a partir de acá todo depende de ellas.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firebase.json .firebaserc
git commit -m "feat: scope Firestore rules to trainer and client sessions

The previous rule granted every authenticated session full read and write over the
whole database. That was harmless with a single user, but a client session would have
been able to read every other client's phone number, payments and history.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Botón "Compartir acceso web"

**Files:**
- Modify: `app/src/main/java/com/osfit/app/util/WhatsAppUtil.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`
- Test: `app/src/test/java/com/osfit/app/util/WhatsAppUtilTest.kt` (ya existe; agregar casos)

**Interfaces:**
- Consumes: `AccesoWebRepository` (Task 4).
- Produces: `WhatsAppUtil.crearUriAccesoWeb(telefono, nombreCliente, token): Uri`, `WhatsAppUtil.urlAccesoWeb(token): String`, y en el ViewModel `compartirAccesoWeb()` / `revocarAccesoWeb()`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `app/src/test/java/com/osfit/app/util/WhatsAppUtilTest.kt`:

```kotlin
    @Test
    fun `la url de acceso web usa el dominio del proyecto y la ruta c`() {
        assertEquals(
            "https://osfit-cccfe.web.app/c/abc123",
            WhatsAppUtil.urlAccesoWeb("abc123")
        )
    }
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `./gradlew test --tests "com.osfit.app.util.WhatsAppUtilTest"`
Expected: FAIL — `Unresolved reference: urlAccesoWeb`

- [ ] **Step 3: Agregar las funciones a `WhatsAppUtil`**

```kotlin
    /** Dominio gratuito del proyecto. Si algún día hay dominio propio, se cambia solo acá. */
    private const val DOMINIO_WEB = "https://osfit-cccfe.web.app"

    fun urlAccesoWeb(token: String): String = "$DOMINIO_WEB/c/$token"

    fun crearUriAccesoWeb(telefono: String, nombreCliente: String, token: String): Uri {
        val numero = normalizarTelefonoMx(telefono)
        val mensaje = "Hola, *$nombreCliente*, aqui tienes tu acceso personal a OSfit. " +
            "Ahi puedes ver el dia que te toca, tu calendario de asistencias, tu racha y tus " +
            "logros:\n\n${urlAccesoWeb(token)}\n\nEs solo tuyo, no lo compartas."
        val mensajeCodificado = URLEncoder.encode(mensaje, "UTF-8")
        return Uri.parse("https://wa.me/$numero?text=$mensajeCodificado")
    }
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `./gradlew test --tests "com.osfit.app.util.WhatsAppUtilTest"`
Expected: PASS

- [ ] **Step 5: Exponer el acceso en el ViewModel**

En `ClienteDetailViewModel`, agregar al constructor `private val accesoWebRepository: AccesoWebRepository = AppContainer.accesoWebRepository`, con su import, y agregar:

```kotlin
    val accesoWeb: StateFlow<AccesoWeb?> = accesoWebRepository.observarAcceso(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** Crea el acceso si hace falta y devuelve el token para compartirlo. Idempotente. */
    suspend fun asegurarAccesoWeb(): String {
        val token = accesoWebRepository.crearAcceso(clienteId)
        clienteRepository.actualizarTieneAccesoWeb(clienteId, true)
        return token
    }

    fun revocarAccesoWeb() {
        viewModelScope.launch {
            accesoWeb.value?.let { accesoWebRepository.revocarAcceso(it.token) }
            clienteRepository.actualizarTieneAccesoWeb(clienteId, false)
        }
    }
```

- [ ] **Step 6: Agregar los botones a la pantalla**

En `ClienteDetailScreen.kt`, dentro del `LazyColumn`, agregar un `item` **antes** del bloque que contiene el `OutlinedButton` de "Marcar cliente como inactivo":

```kotlin
            item {
                val acceso by viewModel.accesoWeb.collectAsState()
                val alcance = rememberCoroutineScope()
                Spacer(modifier = Modifier.height(12.dp))
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Acceso web", style = MaterialTheme.typography.titleMedium)
                        Text(
                            if (acceso == null) {
                                "Todavía no le compartiste su página personal."
                            } else {
                                WhatsAppUtil.urlAccesoWeb(acceso!!.token)
                            },
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        if (clienteActual.telefono.isNotBlank()) {
                            Button(
                                onClick = {
                                    alcance.launch {
                                        val token = viewModel.asegurarAccesoWeb()
                                        val uri = WhatsAppUtil.crearUriAccesoWeb(
                                            telefono = clienteActual.telefono,
                                            nombreCliente = clienteActual.nombre,
                                            token = token
                                        )
                                        try {
                                            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                        } catch (e: ActivityNotFoundException) {
                                            Toast.makeText(context, "No se encontró una app para abrir WhatsApp", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
                            ) {
                                Icon(Icons.Filled.Chat, contentDescription = null)
                                Text(
                                    if (acceso == null) "Compartir acceso web" else "Volver a compartir",
                                    modifier = Modifier.padding(start = 8.dp)
                                )
                            }
                        }
                        if (acceso != null) {
                            TextButton(
                                onClick = { viewModel.revocarAccesoWeb() },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Revocar acceso", color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }
```

Agregar los imports que falten: `androidx.compose.runtime.collectAsState`, `androidx.compose.runtime.getValue`, `androidx.compose.runtime.rememberCoroutineScope`, `androidx.compose.material3.Card`, `kotlinx.coroutines.launch`.

- [ ] **Step 7: Compilar e instalar**

Run: `./gradlew installDebug`
Expected: BUILD SUCCESSFUL

En el teléfono: abrir un cliente con teléfono cargado, tocar "Compartir acceso web", confirmar que abre WhatsApp con el mensaje y el link. Volver a la ficha y confirmar que ahora muestra la URL y el botón de revocar. Tocar revocar y confirmar que vuelve al estado inicial.

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/com/osfit/app/util/WhatsAppUtil.kt \
        app/src/main/java/com/osfit/app/ui/clientes/ \
        app/src/test/java/com/osfit/app/util/WhatsAppUtilTest.kt
git commit -m "feat: share and revoke a client's web access from their detail screen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Andamiaje del sitio y de las functions

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.ts`, `web/src/estilos.css`
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Crear el proyecto web**

```bash
mkdir -p web/src
cd web
npm init -y
npm install firebase
npm install -D vite typescript vitest
cd ..
```

- [ ] **Step 2: Configurar el sitio**

`web/package.json` — reemplazar la sección `scripts`:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "type": "module",
```

`web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

`web/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#121212" />
    <title>OSfit</title>
    <link rel="stylesheet" href="/src/estilos.css" />
  </head>
  <body>
    <main id="app"><p class="cargando">Cargando…</p></main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`web/src/estilos.css` — paleta tomada de `ui/theme/Theme.kt` para que la página se sienta la misma app:

```css
:root {
  --fondo: #121212;
  --superficie: #1C1C1E;
  --superficie-alta: #2C2C2E;
  --texto: #E6E6E6;
  --texto-tenue: #8A8A8A;
  --primario: #B388FF;
  --sobre-primario: #2A0064;
  --primario-oscuro: #6A1B9A;
  --verde: #2E9E4F;
  --rojo: #C4453D;
  --ambar: #C99A2E;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--fondo);
  color: var(--texto);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.45;
}
main { max-width: 480px; margin: 0 auto; padding: 16px 14px 48px; }
.cargando { color: var(--texto-tenue); text-align: center; padding: 40px 0; }
.tarjeta { background: var(--superficie); border-radius: 16px; padding: 14px 16px; margin-bottom: 12px; }
.tarjeta-titulo {
  font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
  color: var(--primario); margin: 0 0 6px;
}
.hoy { background: linear-gradient(150deg, var(--primario-oscuro), var(--primario)); color: #fff; }
.hoy .tarjeta-titulo { color: rgba(255, 255, 255, 0.82); }
.hoy-dia { font-size: 26px; font-weight: 800; margin: 2px 0 4px; line-height: 1.15; }
.fila { display: flex; gap: 12px; }
.fila > * { flex: 1; }
.numero { font-size: 30px; font-weight: 800; line-height: 1; margin: 4px 0; }
.vacio { text-align: center; padding: 24px 12px; }
.vacio-emoji { font-size: 40px; }
```

`web/src/main.ts` — provisional, se completa en tareas siguientes:

```typescript
const app = document.querySelector<HTMLElement>("#app")!;
app.innerHTML = `<p class="cargando">OSfit</p>`;
```

- [ ] **Step 3: Crear el proyecto de functions**

```bash
mkdir -p functions/src
cd functions
npm init -y
npm install firebase-admin firebase-functions
npm install -D typescript
cd ..
```

`functions/package.json` — agregar/reemplazar:

```json
  "main": "lib/index.js",
  "engines": { "node": "20" },
  "scripts": {
    "build": "tsc",
    "deploy": "npm run build && firebase deploy --only functions"
  },
```

`functions/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "lib",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

`functions/src/index.ts`:

```typescript
export { sesion } from "./sesion";
```

- [ ] **Step 4: Ignorar los artefactos de build**

Agregar a `.gitignore`:

```
node_modules/
web/dist/
functions/lib/
```

- [ ] **Step 5: Verificar que el sitio levanta**

```bash
cd web && npm run dev
```
Expected: Vite imprime una URL local; al abrirla se ve "OSfit" sobre fondo oscuro. Cortar con Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add web functions .gitignore
git commit -m "feat: scaffold the client web app and its cloud functions

Vite plus TypeScript with no UI framework: the page is a handful of read-only cards,
so a framework would be more bundle than content. Palette copied from Theme.kt so the
page reads as the same product.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Función `sesion`

**Files:**
- Create: `functions/src/sesion.ts`

**Interfaces:**
- Produces: endpoint HTTP `POST /sesion` con body `{ "token": string }`, respuesta `200 { "customToken": string, "clienteId": string }` o `404 { "error": "acceso_invalido" }`.

- [ ] **Step 1: Escribir la función**

Crear `functions/src/sesion.ts`:

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

/**
 * Canjea el token del link magico por un custom token de Firebase con el claim `clienteId`.
 *
 * El claim es lo que hace que las reglas de Firestore puedan acotar al cliente a sus propios
 * datos: viaja dentro de un token firmado por Firebase, asi que el navegador no puede
 * falsificarlo.
 */
export const sesion = onRequest(
  { region: "us-west1", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "metodo_no_permitido" });
      return;
    }

    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!token) {
      res.status(400).json({ error: "falta_token" });
      return;
    }

    const doc = await getFirestore().collection("accesosWeb").doc(token).get();

    // 404 generico a proposito: no distingue "nunca existio" de "revocado", para no
    // confirmarle nada a quien pruebe tokens al azar.
    if (!doc.exists) {
      res.status(404).json({ error: "acceso_invalido" });
      return;
    }

    const clienteId = doc.get("clienteId") as string;
    const customToken = await getAuth().createCustomToken(clienteId, { clienteId });

    res.json({ customToken, clienteId });
  }
);
```

Se usa `clienteId` como UID del custom token además de como claim: así cada cliente tiene una identidad estable en Authentication, y los logs de acceso son legibles.

- [ ] **Step 2: Compilar**

```bash
cd functions && npm run build && cd ..
```
Expected: sin errores; aparece `functions/lib/sesion.js`

- [ ] **Step 3: Desplegar**

```bash
firebase deploy --only functions:sesion
```
Expected: `+ Deploy complete!` y una URL como `https://sesion-xxxxx-uw.a.run.app`. **Anotarla**: la necesita la Task 9.

Si falla con un error de permisos sobre `createCustomToken`, darle a la service account de la función el rol *Service Account Token Creator* en IAM y volver a desplegar.

- [ ] **Step 4: Probarla a mano**

Crear un acceso desde la app (Task 6) para un cliente, copiar el token del link, y:

```bash
curl -X POST https://<url-de-la-funcion> \
  -H "Content-Type: application/json" \
  -d '{"token":"<token-del-link>"}'
```
Expected: JSON con `customToken` y `clienteId`.

Probar también con un token inventado:

```bash
curl -X POST https://<url-de-la-funcion> \
  -H "Content-Type: application/json" \
  -d '{"token":"noexiste"}'
```
Expected: `404 {"error":"acceso_invalido"}`

- [ ] **Step 5: Commit**

```bash
git add functions/src/sesion.ts
git commit -m "feat: exchange a magic-link token for a scoped Firebase session

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Sesión en el navegador

**Files:**
- Create: `web/src/fecha.ts`, `web/src/firebase.ts`, `web/src/dia.ts`
- Create: `web/src/dia.test.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Consumes: endpoint `sesion` (Task 8), campos denormalizados de `Cliente` (Task 2).
- Produces: `hoyEnMazatlan(): string`, `iniciarSesion(): Promise<string | null>` (devuelve `clienteId`), `interpretar(valor, totalDias, fecha): number | null`.

- [ ] **Step 1: Escribir el test que falla**

Crear `web/src/dia.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { interpretar } from "./dia";

describe("interpretar", () => {
  it("un ancla vale tal cual, sin importar la fecha", () => {
    const valor = { dia: 3, fecha: "2026-09-01", esAncla: true };
    expect(interpretar(valor, 4, "2026-09-05")).toBe(3);
  });

  it("una asistencia de hoy es el día que está haciendo hoy", () => {
    const valor = { dia: 1, fecha: "2026-09-10", esAncla: false };
    expect(interpretar(valor, 4, "2026-09-10")).toBe(1);
  });

  it("una asistencia anterior significa que le toca el siguiente", () => {
    const valor = { dia: 1, fecha: "2026-09-09", esAncla: false };
    expect(interpretar(valor, 4, "2026-09-10")).toBe(2);
  });

  it("da la vuelta al día 1 al terminar el ciclo", () => {
    const valor = { dia: 3, fecha: "2026-09-09", esAncla: false };
    expect(interpretar(valor, 4, "2026-09-10")).toBe(0);
  });

  it("sin día denormalizado devuelve null", () => {
    const valor = { dia: null, fecha: null, esAncla: false };
    expect(interpretar(valor, 4, "2026-09-10")).toBeNull();
  });

  it("sin rutina devuelve null", () => {
    const valor = { dia: 0, fecha: "2026-09-09", esAncla: false };
    expect(interpretar(valor, 0, "2026-09-10")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd web && npx vitest run`
Expected: FAIL — no existe `./dia`

- [ ] **Step 3: Implementar las tres líneas**

Crear `web/src/dia.ts`:

```typescript
/**
 * Interpretación del trío que denormaliza la app Android.
 *
 * GEMELO: `RutinaProgressCalculator.interpretar` en Kotlin. Si cambia allá, cambia acá.
 * Toda la lógica difícil (ancla, historial, clientes anteriores al corte) queda del lado
 * de Kotlin a propósito: acá solo se interpreta el resultado.
 *
 * Única diferencia con el gemelo: sin rutina, Kotlin devuelve 0 (para no romper a quien
 * espera un índice) y acá se devuelve null, porque la página necesita distinguir "día 1"
 * de "todavía no hay rutina" para elegir qué tarjeta mostrar.
 */
export interface DiaDenormalizado {
  dia: number | null;
  fecha: string | null;
  esAncla: boolean;
}

export function interpretar(
  valor: DiaDenormalizado,
  totalDias: number,
  fecha: string
): number | null {
  if (valor.dia === null || totalDias <= 0) return null;
  const acotado = Math.min(Math.max(valor.dia, 0), totalDias - 1);
  if (valor.esAncla) return acotado;
  if (valor.fecha === fecha) return acotado;
  return acotado + 1 >= totalDias ? 0 : acotado + 1;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd web && npx vitest run`
Expected: PASS — 6 tests

- [ ] **Step 5: Crear el helper de fecha**

Crear `web/src/fecha.ts`:

```typescript
/**
 * Zona del gimnasio (Culiacán, GMT-7). Se fija a propósito en vez de usar la del
 * dispositivo: la app calcula el día en la zona del entrenador, y si el navegador usara
 * otra, el cliente vería un día distinto del que ve él.
 *
 * GEMELO: `SincronizadorDiaWeb.ZONA` en Kotlin.
 */
const ZONA = "America/Mazatlan";

/** Fecha de hoy en formato ISO (AAAA-MM-DD) según la zona del gimnasio. */
export function hoyEnMazatlan(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
```

Se usa el locale `en-CA` porque su formato de fecha corto ya es `AAAA-MM-DD`, que es exactamente el que guardan los documentos.

- [ ] **Step 6: Crear el módulo de Firebase**

Crear `web/src/firebase.ts`. Los valores de `firebaseConfig` se copian de la consola: Configuración del proyecto → Tus apps → botón "Agregar app" → Web. **No son secretos**: identifican al proyecto, y quien protege los datos son las reglas.

```typescript
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithCustomToken,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "PEGAR_DESDE_LA_CONSOLA",
  authDomain: "osfit-cccfe.firebaseapp.com",
  projectId: "osfit-cccfe",
  storageBucket: "osfit-cccfe.firebasestorage.app",
  messagingSenderId: "PEGAR_DESDE_LA_CONSOLA",
  appId: "PEGAR_DESDE_LA_CONSOLA",
};

const URL_SESION = "PEGAR_LA_URL_DE_LA_FUNCION_SESION";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Devuelve el clienteId de la sesión, canjeando el token del link si la URL lo trae.
 *
 * Después de canjear reemplaza la URL por `/mi`: el token deja de estar a la vista apenas
 * se usa, así no queda en una captura de pantalla ni se comparte sin querer al pasar la
 * dirección. La sesión persiste, así que las próximas visitas entran sin el link.
 */
export async function iniciarSesion(): Promise<string | null> {
  await setPersistence(auth, browserLocalPersistence);

  const enLaUrl = location.pathname.match(/^\/c\/([A-Za-z0-9]+)$/);
  if (enLaUrl) {
    const respuesta = await fetch(URL_SESION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: enLaUrl[1] }),
    });
    if (!respuesta.ok) return null;
    const { customToken } = await respuesta.json();
    await signInWithCustomToken(auth, customToken);
    history.replaceState(null, "", "/mi");
  }

  return auth.currentUser?.uid ?? null;
}
```

- [ ] **Step 7: Arrancar la sesión desde `main.ts`**

Reemplazar `web/src/main.ts`:

```typescript
import { iniciarSesion } from "./firebase";

const app = document.querySelector<HTMLElement>("#app")!;

async function arrancar(): Promise<void> {
  const clienteId = await iniciarSesion();
  if (!clienteId) {
    app.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">🔒</div>
        <p>Este enlace ya no es válido.</p>
        <p style="color: var(--texto-tenue); font-size: 14px">
          Pídele a tu entrenador que te comparta uno nuevo.
        </p>
      </div>`;
    return;
  }
  app.innerHTML = `<p class="cargando">Sesión iniciada: ${clienteId}</p>`;
}

arrancar();
```

- [ ] **Step 8: Verificar de punta a punta**

```bash
cd web && npm run build && cd .. && firebase deploy --only hosting
```

Abrir en el teléfono el link que la app compartió por WhatsApp. Confirmar: aparece "Sesión iniciada" con el id del cliente, y **la barra de direcciones muestra `/mi`, no el token**. Recargar y confirmar que sigue funcionando sin el token en la URL.

- [ ] **Step 9: Commit**

```bash
git add web/src firebase.json
git commit -m "feat: redeem the magic link into a persistent client session

The token is swapped for a Firebase session and the URL is rewritten to /mi, so it
stops being visible the moment it is used.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Datos del cliente y tarjeta del día

**Files:**
- Create: `web/src/datos.ts`, `web/src/ui/tarjetaDia.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Consumes: `interpretar` (Task 9), `hoyEnMazatlan` (Task 9), reglas de Firestore (Task 5).
- Produces: `observarCliente(clienteId, alCambiar)`, `observarAsistencias(clienteId, alCambiar)`, `tarjetaDia(cliente, hoy): string`.

- [ ] **Step 1: Crear el módulo de datos**

Crear `web/src/datos.ts`:

```typescript
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

export interface Ejercicio { nombre: string; series: number; repeticiones: string; pesoONota: string; }
export interface DiaRutina { nombreDia: string; ejercicios: Ejercicio[]; }
export interface Rutina { id: string; nombre: string; dias: DiaRutina[]; }

export interface Cliente {
  nombre: string;
  activo: boolean;
  rutinaAsignada: Rutina | null;
  ultimoDia: number | null;
  ultimoDiaFecha: string | null;
  ultimoDiaEsAncla: boolean;
}

export interface Asistencia {
  fecha: string;
  asistio: boolean;
  justificada: boolean;
  duracionMinutos: number | null;
}

export function observarCliente(clienteId: string, alCambiar: (c: Cliente | null) => void) {
  return onSnapshot(doc(db, "clientes", clienteId), (snap) => {
    alCambiar(snap.exists() ? (snap.data() as Cliente) : null);
  });
}

/**
 * La query filtra por clienteId porque las reglas validan documento por documento: sin el
 * filtro, Firestore rechaza la consulta entera en vez de devolver solo lo permitido.
 */
export function observarAsistencias(clienteId: string, alCambiar: (a: Asistencia[]) => void) {
  const consulta = query(collection(db, "asistencias"), where("clienteId", "==", clienteId));
  return onSnapshot(consulta, (snap) => {
    alCambiar(snap.docs.map((d) => d.data() as Asistencia));
  });
}
```

- [ ] **Step 2: Crear la tarjeta del día**

Crear `web/src/ui/tarjetaDia.ts`:

```typescript
import type { Cliente } from "../datos";
import { interpretar } from "../dia";

/** Sábado y domingo no cuentan para la racha, así que la página lo dice en vez de mostrar
 *  un día de rutina que nadie va a hacer. */
function esFinDeSemana(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00`).getUTCDay();
  return dia === 0 || dia === 6;
}

function escapar(texto: string): string {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/**
 * La tarjeta muestra **solo el nombre del día**, nunca los ejercicios. Es deliberado: la
 * rutina se la manda el entrenador cuando el cliente la pide, y esa entrega sigue siendo un
 * acto suyo y no un autoservicio. Ver el spec, sección "Por qué la página no muestra los
 * ejercicios".
 */
export function tarjetaDia(cliente: Cliente, hoy: string): string {
  const dias = cliente.rutinaAsignada?.dias ?? [];

  if (dias.length === 0) {
    return `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">🌱</div>
        <p><strong>Todavía no tienes rutina</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">
          Tu entrenador te la asigna y aparece aquí.
        </p>
      </div>`;
  }

  const indice = interpretar(
    { dia: cliente.ultimoDia, fecha: cliente.ultimoDiaFecha, esAncla: cliente.ultimoDiaEsAncla },
    dias.length,
    hoy
  );

  if (esFinDeSemana(hoy)) {
    const proximo = indice !== null ? dias[indice]?.nombreDia ?? "" : "";
    return `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">😴</div>
        <p><strong>Hoy toca descansar</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">
          El lunes te toca ${escapar(proximo)}.
        </p>
      </div>`;
  }

  if (indice === null) return "";

  return `
    <div class="tarjeta hoy">
      <p class="tarjeta-titulo">Hoy te toca</p>
      <p class="hoy-dia">Día ${indice + 1}<br>${escapar(dias[indice].nombreDia)}</p>
    </div>`;
}
```

- [ ] **Step 3: Componer en `main.ts`**

Reemplazar el cuerpo de `arrancar()` después del chequeo de sesión:

```typescript
  const hoy = hoyEnMazatlan();
  observarCliente(clienteId, (cliente) => {
    if (!cliente) {
      app.innerHTML = `<div class="tarjeta vacio"><p>No encontramos tus datos.</p></div>`;
      return;
    }
    app.innerHTML = `
      <h1 style="font-size:20px;margin:4px 2px 14px">Hola, ${cliente.nombre} 👋</h1>
      ${tarjetaDia(cliente, hoy)}
    `;
  });
```

con los imports de `hoyEnMazatlan`, `observarCliente` y `tarjetaDia`.

- [ ] **Step 4: Desplegar y verificar**

```bash
cd web && npm run build && cd .. && firebase deploy --only hosting
```

En el teléfono, con el link ya canjeado: confirmar que aparece el saludo y el día correcto. **Contrastar contra la app**: el día que muestra la página tiene que ser exactamente el mismo que muestra la ficha del cliente. Probar también con un cliente sin rutina asignada.

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat: show the client's routine day for today

Shows the day name only, never the exercise list: the routine is delivered by the
trainer on request, and that stays an act of theirs rather than self-service.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Racha y promedio

**Files:**
- Create: `web/src/racha.ts`, `web/src/racha.test.ts`, `web/src/ui/tarjetasStats.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Consumes: `Asistencia` (Task 10).
- Produces: `rachaActual(asistencias, hoy): number`, `promedioMinutos(asistencias): number | null`, `tarjetasStats(asistencias, hoy): string`.

- [ ] **Step 1: Escribir el test que falla**

Crear `web/src/racha.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { promedioMinutos, rachaActual } from "./racha";

const vino = (fecha: string) => ({ fecha, asistio: true, justificada: false, duracionMinutos: null });
const falto = (fecha: string) => ({ fecha, asistio: false, justificada: false, duracionMinutos: null });
const justificada = (fecha: string) => ({ fecha, asistio: false, justificada: true, duracionMinutos: null });

describe("rachaActual", () => {
  it("cuenta días hábiles seguidos", () => {
    // 2026-09-08 es martes, 09 miércoles, 10 jueves
    expect(rachaActual([vino("2026-09-08"), vino("2026-09-09"), vino("2026-09-10")], "2026-09-10")).toBe(3);
  });

  it("una falta corta la racha", () => {
    expect(rachaActual([vino("2026-09-08"), falto("2026-09-09"), vino("2026-09-10")], "2026-09-10")).toBe(1);
  });

  it("una falta justificada mantiene la racha", () => {
    expect(rachaActual([vino("2026-09-08"), justificada("2026-09-09"), vino("2026-09-10")], "2026-09-10")).toBe(3);
  });

  it("el fin de semana ni suma ni corta", () => {
    // 2026-09-11 viernes, 12 sábado, 13 domingo, 14 lunes
    expect(rachaActual([vino("2026-09-11"), vino("2026-09-14")], "2026-09-14")).toBe(2);
  });

  it("hoy sin registro todavía no corta la racha", () => {
    expect(rachaActual([vino("2026-09-08"), vino("2026-09-09")], "2026-09-10")).toBe(2);
  });

  it("sin asistencias la racha es cero", () => {
    expect(rachaActual([], "2026-09-10")).toBe(0);
  });
});

describe("promedioMinutos", () => {
  it("promedia solo las sesiones con duración", () => {
    expect(promedioMinutos([
      { fecha: "2026-09-08", asistio: true, justificada: false, duracionMinutos: 50 },
      { fecha: "2026-09-09", asistio: true, justificada: false, duracionMinutos: 54 },
      { fecha: "2026-09-10", asistio: true, justificada: false, duracionMinutos: null },
    ])).toBe(52);
  });

  it("sin duraciones devuelve null", () => {
    expect(promedioMinutos([vino("2026-09-08")])).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd web && npx vitest run`
Expected: FAIL — no existe `./racha`

- [ ] **Step 3: Implementar**

Crear `web/src/racha.ts`:

```typescript
import type { Asistencia } from "./datos";

/**
 * GEMELO: `RachaCalculator` en Kotlin. Se duplica porque es corto y autocontenido; a
 * diferencia del día de rutina, acá no hay ancla ni historial que interpretar.
 */

function esDiaHabil(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00`).getUTCDay();
  return dia !== 0 && dia !== 6;
}

function restarUnDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Las justificadas ("soborno") valen igual que una asistencia para la racha. */
function fechasQueCuentan(asistencias: Asistencia[]): Set<string> {
  return new Set(asistencias.filter((a) => a.asistio || a.justificada).map((a) => a.fecha));
}

export function rachaActual(asistencias: Asistencia[], hoy: string): number {
  const cuentan = fechasQueCuentan(asistencias);
  let fecha = hoy;

  // Día de gracia: si hoy es hábil y todavía no hay registro, no corta la racha.
  if (esDiaHabil(fecha) && !cuentan.has(fecha)) fecha = restarUnDia(fecha);

  let racha = 0;
  // Tope de seguridad: sin él, un dato raro colgaría la pestaña del cliente.
  for (let i = 0; i < 3650; i++) {
    if (esDiaHabil(fecha)) {
      if (!cuentan.has(fecha)) break;
      racha++;
    }
    fecha = restarUnDia(fecha);
  }
  return racha;
}

export function promedioMinutos(asistencias: Asistencia[]): number | null {
  const duraciones = asistencias
    .filter((a) => a.asistio && a.duracionMinutos !== null)
    .map((a) => a.duracionMinutos as number);
  if (duraciones.length === 0) return null;
  return Math.round(duraciones.reduce((s, d) => s + d, 0) / duraciones.length);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd web && npx vitest run`
Expected: PASS — 14 tests (6 de `dia` + 8 de `racha`)

- [ ] **Step 5: Crear las tarjetas**

Crear `web/src/ui/tarjetasStats.ts`:

```typescript
import type { Asistencia } from "../datos";
import { promedioMinutos, rachaActual } from "../racha";

export function tarjetasStats(asistencias: Asistencia[], hoy: string): string {
  const racha = rachaActual(asistencias, hoy);
  const promedio = promedioMinutos(asistencias);

  return `
    <div class="fila">
      <div class="tarjeta">
        <p class="tarjeta-titulo">Tu racha</p>
        <p class="numero">🔥 ${racha}</p>
        <p style="color: var(--texto-tenue); font-size: 12px; margin: 0">
          ${racha === 1 ? "día seguido sin faltar" : "días seguidos sin faltar"}
        </p>
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

- [ ] **Step 6: Componer en `main.ts`**

Suscribirse también a las asistencias y volver a pintar cuando cualquiera de las dos fuentes cambie:

```typescript
  let cliente: Cliente | null = null;
  let asistencias: Asistencia[] = [];

  function pintar(): void {
    if (!cliente) return;
    app.innerHTML = `
      <h1 style="font-size:20px;margin:4px 2px 14px">Hola, ${cliente.nombre} 👋</h1>
      ${tarjetaDia(cliente, hoy)}
      ${tarjetasStats(asistencias, hoy)}
    `;
  }

  observarCliente(clienteId, (c) => { cliente = c; pintar(); });
  observarAsistencias(clienteId, (a) => { asistencias = a; pintar(); });
```

- [ ] **Step 7: Desplegar y verificar**

```bash
cd web && npm run build && cd .. && firebase deploy --only hosting
```

Contrastar la racha contra la que muestra la app para el mismo cliente. Tienen que coincidir.

- [ ] **Step 8: Commit**

```bash
git add web/src
git commit -m "feat: show current streak and average session length

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Calendario mensual

**Files:**
- Create: `web/src/ui/calendario.ts`
- Modify: `web/src/main.ts`, `web/src/estilos.css`

**Interfaces:**
- Consumes: `Asistencia` (Task 10).
- Produces: `calendario(asistencias, mes, hoy): string` donde `mes` es `"AAAA-MM"`.

- [ ] **Step 1: Agregar los estilos**

Agregar a `web/src/estilos.css`:

```css
.cal-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.cal-nav button {
  background: var(--superficie-alta); color: var(--texto); border: 0;
  border-radius: 8px; width: 32px; height: 32px; font-size: 16px; cursor: pointer;
}
.cal-nav button:disabled { opacity: 0.3; cursor: default; }
.cal-dias, .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-dias { font-size: 11px; color: var(--texto-tenue); text-align: center; margin-bottom: 4px; }
.cal span {
  aspect-ratio: 1; border-radius: 7px; background: var(--superficie-alta);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--texto-tenue);
}
.cal span.vacia { background: transparent; }
.cal span.ok { background: var(--verde); color: #fff; }
.cal span.no { background: var(--rojo); color: #fff; }
.cal span.just { background: var(--ambar); color: #2A1A00; }
.cal span.hoy-celda { outline: 2px solid var(--primario); font-weight: 800; color: var(--texto); }
.leyenda { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; font-size: 11px; color: var(--texto-tenue); }
.leyenda span { display: flex; align-items: center; gap: 4px; }
.punto { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
```

- [ ] **Step 2: Crear el calendario**

Crear `web/src/ui/calendario.ts`:

```typescript
import type { Asistencia } from "../datos";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Lunes primero, como el calendario de la app. */
function columnaDe(fecha: Date): number {
  return (fecha.getUTCDay() + 6) % 7;
}

/**
 * Un mes por vez, y abre en el actual. La app deja recorrer meses porque el entrenador
 * audita historial; el cliente solo quiere saber si faltó esta semana.
 */
export function calendario(asistencias: Asistencia[], mes: string, hoy: string): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(anio, numeroMes - 1, 1));
  const diasEnMes = new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate();

  const porFecha = new Map(asistencias.map((a) => [a.fecha, a]));

  const celdas: string[] = [];
  for (let i = 0; i < columnaDe(primero); i++) {
    celdas.push(`<span class="vacia"></span>`);
  }

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
    const registro = porFecha.get(fecha);
    const clases: string[] = [];
    if (registro?.asistio) clases.push("ok");
    else if (registro?.justificada) clases.push("just");
    else if (registro) clases.push("no");
    if (fecha === hoy) clases.push("hoy-celda");
    celdas.push(`<span class="${clases.join(" ")}">${dia}</span>`);
  }

  const esMesActual = mes >= hoy.slice(0, 7);

  return `
    <div class="tarjeta">
      <div class="cal-nav">
        <button id="mes-anterior">‹</button>
        <strong>${NOMBRES_MES[numeroMes - 1]} ${anio}</strong>
        <button id="mes-siguiente" ${esMesActual ? "disabled" : ""}>›</button>
      </div>
      <div class="cal-dias"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="cal">${celdas.join("")}</div>
      <div class="leyenda">
        <span><i class="punto" style="background: var(--verde)"></i>Viniste</span>
        <span><i class="punto" style="background: var(--rojo)"></i>Faltaste</span>
        <span><i class="punto" style="background: var(--ambar)"></i>Justificada</span>
      </div>
    </div>`;
}

/** Mes anterior o siguiente en formato "AAAA-MM". */
export function moverMes(mes: string, delta: number): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(anio, numeroMes - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
```

- [ ] **Step 3: Componer en `main.ts` con navegación de meses**

```typescript
  let mesVisible = hoy.slice(0, 7);

  function pintar(): void {
    if (!cliente) return;
    app.innerHTML = `
      <h1 style="font-size:20px;margin:4px 2px 14px">Hola, ${cliente.nombre} 👋</h1>
      ${tarjetaDia(cliente, hoy)}
      ${tarjetasStats(asistencias, hoy)}
      ${calendario(asistencias, mesVisible, hoy)}
    `;
    document.querySelector("#mes-anterior")?.addEventListener("click", () => {
      mesVisible = moverMes(mesVisible, -1);
      pintar();
    });
    document.querySelector("#mes-siguiente")?.addEventListener("click", () => {
      mesVisible = moverMes(mesVisible, 1);
      pintar();
    });
  }
```

con los imports de `calendario` y `moverMes`.

- [ ] **Step 4: Desplegar y verificar**

```bash
cd web && npm run build && cd .. && firebase deploy --only hosting
```

Contrastar el calendario contra el de la app para el mismo cliente: los días verdes, rojos y ámbar tienen que coincidir uno a uno. Confirmar que el botón de mes siguiente está deshabilitado en el mes actual y que se puede retroceder.

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat: show the client's monthly attendance calendar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Verificación final en dispositivo

Nada de esto se prueba con tests automáticos: son las cosas que solo fallan contra Firebase real.

**Files:** ninguno (verificación)

- [ ] **Step 1: Correr todas las suites**

```bash
./gradlew test
cd web && npx vitest run && cd ..
```
Expected: Kotlin PASS (196), TypeScript PASS (14)

- [ ] **Step 2: Verificar el aislamiento entre clientes**

Este es el test negativo, y es el más importante de todos. Con la página abierta como cliente A, abrir la consola del navegador y ejecutar:

```javascript
const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js");
await getDoc(doc(getFirestore(), "clientes", "<ID_DE_OTRO_CLIENTE>"));
```

Expected: **error de permisos**. Si devuelve datos, las reglas están mal y no se puede seguir.

Repetir con `accesosWeb` y con `clientes/<propio-id>/pagos`. Los tres tienen que fallar.

- [ ] **Step 3: Verificar el ciclo completo del link**

1. Compartir acceso a un cliente de prueba desde la app.
2. Abrir el link. Confirmar que la URL queda en `/mi`.
3. Recargar: sigue adentro.
4. Revocar el acceso desde la app.
5. Abrir el link viejo en una ventana privada: muestra "Este enlace ya no es válido".

- [ ] **Step 4: Verificar la coincidencia del día**

Para tres clientes distintos — uno a mitad de ciclo, uno en el último día del ciclo, y uno con "Asignar día" aplicado hoy — confirmar que el día de la página es idéntico al de la app.

Después marcar una asistencia desde la app **con la página del cliente abierta**, y confirmar que el calendario se pinta solo, sin recargar.

- [ ] **Step 5: Verificar los estados vacíos**

- Cliente sin rutina asignada → "Todavía no tienes rutina".
- Abrir en sábado o domingo (o cambiar la fecha del teléfono) → "Hoy toca descansar".
- Cliente sin asistencias → racha 0, promedio "—", calendario vacío.

- [ ] **Step 6: Actualizar el README**

Agregar a `README.md`, antes de "Estructura del proyecto":

```markdown
## Web para clientes

Cada cliente tiene una página de solo lectura en `https://osfit-cccfe.web.app`, a la que
entra por un link personal que se comparte desde su ficha ("Compartir acceso web").
Muestra el día que le toca, su racha, su promedio por sesión y su calendario.

- `web/` — sitio estático (Vite + TypeScript). `npm run dev` para desarrollo,
  `npm run build` para compilar.
- `functions/` — Cloud Functions. `sesion` canjea el token del link por una sesión de
  Firebase acotada a ese cliente.

Desplegar: `firebase deploy --only hosting,functions,firestore:rules`

El día de rutina **no** se recalcula en la web: la app lo denormaliza en
`Cliente.ultimoDia` / `ultimoDiaFecha` / `ultimoDiaEsAncla` (ver
`RutinaProgressCalculator.denormalizar`), y la web solo lo interpreta en `web/src/dia.ts`.

Diseño completo en
[docs/superpowers/specs/2026-09-10-web-clientes-design.md](docs/superpowers/specs/2026-09-10-web-clientes-design.md).
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: document the client web app in the README

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Qué queda para las etapas siguientes

- **Etapa 2:** `cambiarDia` y `revivirRacha`, el cupo de 3 por mes, los motivos del cambio de día, la confirmación del revive, y los indicadores en el calendario de la app.
- **Etapa 3:** subida de insignias a Storage, `imagenUrl` en los catálogos, botón de publicar video, retención de 6, y las secciones de medallas, logros y videos en la página.
