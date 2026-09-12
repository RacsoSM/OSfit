# Web para clientes — Etapa 2: las dos acciones

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el cliente pueda, desde su página, cambiar el día de rutina que le toca (ilimitado, con motivo) y justificar una ausencia para proteger su racha (máximo 3 al mes, sin motivo); y que el entrenador se entere de ambas cosas dentro de su app, sin autorizar nada.

**Architecture:** El cliente nunca escribe en Firestore. Las reglas siguen siendo de solo lectura para él; las dos acciones pasan por Cloud Functions que corren con el Admin SDK y por lo tanto se saltan las reglas. Cada función valida el claim `clienteId` del token de sesión que ya mintea `sesion`, aplica exactamente la misma escritura que hace la app Android en el mismo caso, y **deja el trío denormalizado coherente antes de responder**. Los dos cálculos nuevos (cupo de revives y cuál fue la falta que rompió la racha) son lógica pura y se escriben dos veces — Kotlin para la app, TypeScript para la web — con los mismos casos de prueba.

**Tech Stack:** Kotlin + Jetpack Compose (app existente), Firebase Auth + Firestore + Hosting, Cloud Functions v2 sobre Node 22 + TypeScript, sitio en Vite + TypeScript sin framework, Vitest para los tests de TS, JUnit4 para los de Kotlin.

**Spec:** `docs/superpowers/specs/2026-09-10-web-clientes-design.md` — secciones "Los tres endpoints", "El cupo se cuenta, no se guarda", "Motivos del cambio de día", "Faltar no pide explicaciones", y los puntos 4 y 5 de "Cambios en la app Android".

**Etapa previa:** `docs/superpowers/plans/2026-09-10-web-clientes-etapa-1.md`, completa y verificada en dispositivo.

## Global Constraints

- **Idioma:** código, nombres de variables, comentarios y nombres de test **en español**. Mensajes de commit **en inglés**. Ver `GEMINI.md`.
- **Comentarios:** solo explican el *porqué* de decisiones no obvias, nunca repiten lo que el código ya dice.
- **Firestore:** todo `data class` necesita valor por defecto en **todos** los campos (constructor sin argumentos). El `id` no se guarda dentro del documento: se escribe con `.copy(id = "")` y se rellena al leer desde `doc.id`.
- **Repositorios:** clases planas, no interfaces. La única interfaz es `ClienteRepository`, por razones históricas — al agregarle un método hay que implementarlo en `FirestoreClienteRepository` **y** en `FakeClienteRepository`.
- **ViewModels:** reciben repositorios por constructor con `AppContainer.xxx` como valor por defecto.
- **Tests Kotlin:** JUnit4, nombres en backticks y en español describiendo el comportamiento. Solo para `domain/` y `video/`.
- **Zona horaria:** todo cálculo de "hoy" usa `America/Mazatlan`. Nunca la zona del navegador, nunca la del servidor de la función.
- **UID del entrenador:** `G8lW4rIgXhZrswQXJ84pT1StFx82`.
- **Proyecto Firebase:** `osfit-cccfe`. Región de functions: `us-west1`.
- **Commits:** uno por tarea, en inglés, con prefijo `feat:` / `fix:` / `refactor:` / `docs:`, terminando con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **No hacer `push`** salvo que el entrenador lo pida.

---

## Tres decisiones de plan que el spec no fija

Se anotan acá, y no escondidas dentro de una tarea, porque son los lugares donde este plan elige algo que el spec dejó abierto.

**1. Las funciones nuevas son `onCall`, no `onRequest`.**

`sesion` es `onRequest` porque corre **antes** de que exista sesión: no hay token que verificar, y recibe el suyo propio en el body. `cambiarDia` y `revivirRacha` son lo contrario — el spec dice que "validan que `request.auth.token.clienteId` exista antes de hacer nada", y eso es exactamente lo que `onCall` entrega ya resuelto. Con `onRequest` habría que leer el header `Authorization`, partir el `Bearer`, llamar a `verifyIdToken` y traducir los errores a mano en las dos funciones: código de seguridad duplicado, que es el peor sitio donde duplicar. `onCall` además resuelve CORS solo y trae `HttpsError` con códigos que el cliente distingue sin parsear strings.

`sesion` **no se toca**: sigue siendo `onRequest` y sigue funcionando igual.

**2. El catálogo de motivos vive solo en TypeScript.**

La sección de Testing del spec lista `MotivosCambioDia` entre los tests de Kotlin, pero al recorrer el resto del spec el único que **ofrece** la lista es la web; la app Android nunca la muestra, solo **lee** el string ya elegido para pintarlo en el indicador del calendario (Task 11). Un catálogo en Kotlin sin nadie que lo consuma es código muerto que además hay que mantener sincronizado con su gemelo.

Así que el catálogo y su filtrado van a `web/src/motivos.ts` con sus tests en Vitest, cubriendo los mismos casos que el spec pedía en Kotlin (filtra el motivo del lunes cuando no es lunes; filtra el de "más de dos días" cuando asistió ayer). Si algún día la app necesita ofrecer la lista, se porta entonces.

**3. `cambiarDia` escribe el trío denormalizado a mano, sin portar `denormalizar()`.**

Es el agujero fácil de este plan: si la función escribe el ancla y **no** refresca el trío, la página del cliente le sigue mostrando el día viejo hasta que el entrenador toque algo en la app. Pero portar `denormalizar()` entero a TypeScript va contra el espíritu del spec — "toda la lógica difícil queda del lado de Kotlin".

No hace falta: la función **acaba de fijar el ancla**, así que sabe en cuál de sus dos ramas cae `denormalizar()` sin recorrer el historial. Hay que elegir entre las dos, y ahí está el detalle que se come a quien lo escriba deprisa:

- **Sin asistencia hoy** → `{ dia: diaIndex, fecha: <el ancla>, esAncla: true }`.
- **Con asistencia hoy** → `{ dia: diaIndex, fecha: hoy, esAncla: false }`.

La segunda rama existe porque el ancla se fecha **ayer** (igual que en `AsignarDiaManual`, y por la misma razón), y `denormalizar()` toma las asistencias con `fecha > ancla && fecha <= hoy`: una asistencia de hoy cae dentro de esa ventana y le gana al ancla. Escribir el trío de ancla cuando el cliente ya vino hoy lo dejaría trabado en ese día mañana en vez de avanzar el ciclo — que es, letra por letra, la regresión que ya se arregló una vez en el commit `d424286`.

El trío va en el mismo `batch` que el ancla, así no existe un instante en que uno esté escrito y el otro no.

`revivirRacha` **no** toca el trío: justificar una falta no mueve el día del ciclo — las faltas guardan `diaRutinaRealizado = null` y quedan fuera de la ventana por construcción.

---

## Estructura de archivos

**Kotlin (app existente):**

| Archivo | Responsabilidad |
|---|---|
| `domain/CupoRevivesCalculator.kt` (crear) | Cuenta los revives gastados del mes. Gemelo de `web/src/cupo.ts`. |
| `domain/FaltaQueRompioLaRacha.kt` (crear) | Cuál es la falta justificable hacia atrás. Gemelo de `web/src/faltaRompio.ts`. |
| `data/model/Asistencia.kt` (modificar) | Campo `justificadaPorCliente`. |
| `data/model/CambioDiaWeb.kt` (crear) | Cambio de día pedido desde la web. |
| `data/repository/CambioDiaWebRepository.kt` (crear) | Observa los cambios de una fecha, para el indicador. |
| `ui/calendario/TomarAsistenciaViewModel.kt` (modificar) | Expone los cambios de día y los avisos de ausencia del día. |
| `ui/calendario/TomarAsistenciaScreen.kt` (modificar) | Pinta los dos indicadores en la fila del cliente. |
| `ui/clientes/ClienteDetailViewModel.kt` (modificar) | Expone el cupo de revives del mes. |
| `ui/clientes/ClienteDetailScreen.kt` (modificar) | "Revives: N de 3 disponibles este mes". |

**Web:**

| Archivo | Responsabilidad |
|---|---|
| `web/src/cupo.ts` | Cuenta los revives gastados del mes. |
| `web/src/faltaRompio.ts` | Cuál es la falta que rompió la racha. |
| `web/src/motivos.ts` | Catálogo de motivos y su filtrado por condición. |
| `web/src/acciones.ts` | Llamadas a las dos funciones. Nadie más llama a `httpsCallable`. |
| `web/src/ui/accionDia.ts` | Botón "Cambiar mi día" y su hoja de motivos. |
| `web/src/ui/accionFalta.ts` | Botones de ausencia/revive, confirmación y respuesta. |
| `web/src/main.ts` (modificar) | Compone las dos secciones nuevas. |
| `web/src/datos.ts` (modificar) | `justificadaPorCliente` en `Asistencia`. |
| `web/src/firebase.ts` (modificar) | Exporta `functions`. |

**Functions:**

| Archivo | Responsabilidad |
|---|---|
| `functions/src/cambiarDia.ts` (crear) | Ancla + trío denormalizado + `cambiosDia`. |
| `functions/src/revivirRacha.ts` (crear) | Valida fecha y cupo, escribe la justificación. |
| `functions/src/comun.ts` (crear) | `clienteDeLaSesion()`, `hoyEnMazatlan()`, constantes compartidas. |
| `functions/src/index.ts` (modificar) | Exporta las dos funciones nuevas. |

**Configuración:**

| Archivo | Responsabilidad |
|---|---|
| `firestore.indexes.json` (crear) | Índice compuesto `(clienteId, justificadaPorCliente, fecha)`. |
| `firebase.json` (modificar) | Apunta `firestore.indexes` al archivo nuevo. |

---

### Task 1: `CupoRevivesCalculator` en Kotlin

El cupo se cuenta, nunca se guarda (spec, "El cupo se cuenta, no se guarda"). Esta tarea define el contrato; la Task 9 lo porta a TypeScript con los mismos casos.

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/CupoRevivesCalculator.kt`
- Test: `app/src/test/java/com/osfit/app/domain/CupoRevivesCalculatorTest.kt`

**Interfaces:**
- Consumes: `Asistencia` (con el campo `justificadaPorCliente` de la Task 3 — esta tarea se escribe **después** de la 3 si se ejecuta en orden estricto; ver nota abajo).
- Produces:
  - `const val MAXIMO_REVIVES_POR_MES = 3`
  - `fun gastadosEnElMes(asistencias: List<Asistencia>, mes: String): Int`
  - `fun disponiblesEnElMes(asistencias: List<Asistencia>, mes: String): Int`

> **Orden:** esta tarea depende del campo `justificadaPorCliente`, que crea la Task 3. Si se ejecuta el plan en orden, hacer primero el Step 1 de la Task 3 (agregar el campo al modelo) y volver acá. Se dejan en este orden porque el cálculo es lo que define **por qué** el campo tiene que existir.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/test/java/com/osfit/app/domain/CupoRevivesCalculatorTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * El cupo se cuenta, no se guarda: si el entrenador desmarca una justificada desde su app,
 * el cupo se le devuelve al cliente solo. Estos tests fijan esa forma de contar.
 */
class CupoRevivesCalculatorTest {

    private fun falta(fecha: String, porCliente: Boolean, justificada: Boolean = true) =
        Asistencia(
            clienteId = "ana",
            fecha = fecha,
            asistio = false,
            justificada = justificada,
            justificadaPorCliente = porCliente
        )

    @Test
    fun `cuenta solo las justificadas por el cliente`() {
        val asistencias = listOf(
            falta("2026-09-01", porCliente = true),
            falta("2026-09-02", porCliente = true),
            falta("2026-09-03", porCliente = false)
        )
        assertEquals(2, CupoRevivesCalculator.gastadosEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `el soborno del entrenador no gasta cupo del cliente`() {
        val asistencias = listOf(falta("2026-09-01", porCliente = false))
        assertEquals(0, CupoRevivesCalculator.gastadosEnElMes(asistencias, "2026-09"))
        assertEquals(3, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `ignora las de otros meses`() {
        val asistencias = listOf(
            falta("2026-08-31", porCliente = true),
            falta("2026-10-01", porCliente = true),
            falta("2026-09-15", porCliente = true)
        )
        assertEquals(1, CupoRevivesCalculator.gastadosEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `con tres gastadas quedan cero disponibles`() {
        val asistencias = listOf(
            falta("2026-09-01", porCliente = true),
            falta("2026-09-02", porCliente = true),
            falta("2026-09-03", porCliente = true)
        )
        assertEquals(0, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `nunca devuelve disponibles negativos`() {
        val asistencias = (1..5).map { falta("2026-09-0$it", porCliente = true) }
        assertEquals(0, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `una justificada que el entrenador desmarco deja de contar`() {
        val asistencias = listOf(falta("2026-09-01", porCliente = true, justificada = false))
        assertEquals(0, CupoRevivesCalculator.gastadosEnElMes(asistencias, "2026-09"))
    }
}
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
./gradlew test --tests "com.osfit.app.domain.CupoRevivesCalculatorTest"
```
Expected: no compila — `CupoRevivesCalculator` no existe.

- [ ] **Step 3: Implementar**

Crear `app/src/main/java/com/osfit/app/domain/CupoRevivesCalculator.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia

/**
 * Cupo mensual de revives del cliente.
 *
 * No hay contador en ningún lado: se cuenta consultando las asistencias del mes. Se prefiere
 * contar antes que mantener un contador porque si el entrenador desmarca una justificada
 * desde su app, el cupo se le devuelve al cliente solo; un contador se quedaría viejo y
 * habría que acordarse de corregirlo en un lugar que nadie mira.
 *
 * GEMELO: `web/src/cupo.ts`. Si cambia acá, cambia allá.
 */
object CupoRevivesCalculator {

    const val MAXIMO_POR_MES = 3

    /**
     * [mes] en formato `AAAA-MM`. Las fechas son strings ISO, así que comparar por prefijo
     * es exacto y no necesita parsear nada.
     *
     * Exige las dos banderas: `justificadaPorCliente` marca quién la pidió, y `justificada`
     * si sigue vigente. El entrenador puede desmarcar la segunda sin borrar la primera, y en
     * ese caso el revive no debe seguir contando como gastado.
     */
    fun gastadosEnElMes(asistencias: List<Asistencia>, mes: String): Int =
        asistencias.count {
            it.justificadaPorCliente && it.justificada && it.fecha.startsWith("$mes-")
        }

    fun disponiblesEnElMes(asistencias: List<Asistencia>, mes: String): Int =
        (MAXIMO_POR_MES - gastadosEnElMes(asistencias, mes)).coerceAtLeast(0)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
./gradlew test --tests "com.osfit.app.domain.CupoRevivesCalculatorTest"
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/CupoRevivesCalculator.kt app/src/test/java/com/osfit/app/domain/CupoRevivesCalculatorTest.kt
git commit -m "feat: add CupoRevivesCalculator for the monthly revive quota

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `FaltaQueRompioLaRacha` en Kotlin

La única fecha pasada que `revivirRacha` acepta. Es lo que impide que el cliente justifique cualquier día de su historial: solo puede reparar la rotura más reciente.

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/FaltaQueRompioLaRacha.kt`
- Test: `app/src/test/java/com/osfit/app/domain/FaltaQueRompioLaRachaTest.kt`

**Interfaces:**
- Consumes: `Asistencia`, y el mismo criterio de día hábil que usa `RachaCalculator`.
- Produces: `fun calcular(asistencias: List<Asistencia>, hoy: String): String?` — la fecha ISO, o `null` si la racha no está rota.

Definición del spec: la falta hábil más reciente, **estrictamente anterior** a hoy, con `asistio = false` y `justificada = false`, que además sea **posterior** a la última fecha que sí cuenta para la racha. Si no hay ninguna, la racha no está rota y la web no ofrece el botón.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/test/java/com/osfit/app/domain/FaltaQueRompioLaRachaTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * 2026-09-07 es lunes; 2026-09-12, sábado. Las fechas de estos tests se eligieron para que
 * la semana caiga entera de lunes a viernes y los fines de semana se vean aparte.
 */
class FaltaQueRompioLaRachaTest {

    private fun vino(fecha: String) =
        Asistencia(clienteId = "ana", fecha = fecha, asistio = true)

    private fun falto(fecha: String, justificada: Boolean = false) =
        Asistencia(clienteId = "ana", fecha = fecha, asistio = false, justificada = justificada)

    @Test
    fun `encuentra la falta que rompio la racha`() {
        val asistencias = listOf(
            vino("2026-09-07"),
            falto("2026-09-08"),
            vino("2026-09-09"),
            vino("2026-09-10")
        )
        // Vino el 9 y el 10, así que la racha viva arranca el 9; la falta del 8 es la que la
        // cortó y es la única reparable.
        assertEquals("2026-09-08", FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `devuelve null si la racha esta viva`() {
        val asistencias = listOf(vino("2026-09-09"), vino("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `ignora las faltas ya justificadas`() {
        val asistencias = listOf(
            vino("2026-09-07"),
            falto("2026-09-08", justificada = true),
            vino("2026-09-09")
        )
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-10"))
    }

    @Test
    fun `ignora los fines de semana`() {
        // 2026-09-12 y 13 son sábado y domingo: no hay registro y no rompen nada.
        val asistencias = listOf(vino("2026-09-11"), vino("2026-09-14"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-15"))
    }

    @Test
    fun `un dia habil sin registro alguno cuenta como falta`() {
        // No venir y que nadie lo registre es faltar igual: la racha se rompe sola.
        val asistencias = listOf(vino("2026-09-07"), vino("2026-09-10"))
        assertEquals("2026-09-09", FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `nunca devuelve hoy`() {
        // Hoy se justifica por el otro camino ("hoy no voy a poder ir"), no por este.
        val asistencias = listOf(vino("2026-09-09"), falto("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-10"))
    }

    @Test
    fun `sin historial no hay nada que reparar`() {
        assertNull(FaltaQueRompioLaRacha.calcular(emptyList(), "2026-09-11"))
    }
}
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
./gradlew test --tests "com.osfit.app.domain.FaltaQueRompioLaRachaTest"
```
Expected: no compila.

- [ ] **Step 3: Implementar**

Crear `app/src/main/java/com/osfit/app/domain/FaltaQueRompioLaRacha.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import java.time.DayOfWeek
import java.time.LocalDate

/**
 * La única falta pasada que el cliente puede justificar desde la web.
 *
 * Acotarlo a una sola fecha es lo que impide que revivir la racha sea "justificar cualquier
 * día de mi historial": se repara la rotura más reciente o no se repara nada.
 *
 * GEMELO: `web/src/faltaRompio.ts`. Si cambia acá, cambia allá.
 */
object FaltaQueRompioLaRacha {

    /** Tope de seguridad: sin él, un dato raro haría girar el bucle para siempre. */
    private const val MAXIMO_DIAS_HACIA_ATRAS = 3650

    private fun esDiaHabil(fecha: LocalDate): Boolean =
        fecha.dayOfWeek != DayOfWeek.SATURDAY && fecha.dayOfWeek != DayOfWeek.SUNDAY

    fun calcular(asistencias: List<Asistencia>, hoy: String): String? {
        val cuentan = RachaCalculator.fechasQueCuentan(asistencias)

        // Se camina hacia atrás desde ayer: el primer día hábil que no cuenta es, por
        // definición, el que cortó la racha — todo lo posterior a él ya cuenta. Empezar en
        // ayer y no en hoy es lo que hace que hoy nunca se devuelva: hoy se justifica por el
        // otro camino, el de "hoy no voy a poder ir".
        var fecha = LocalDate.parse(hoy).minusDays(1)
        repeat(MAXIMO_DIAS_HACIA_ATRAS) {
            if (esDiaHabil(fecha) && fecha !in cuentan) return fecha.toString()
            if (esDiaHabil(fecha)) return null
            fecha = fecha.minusDays(1)
        }
        return null
    }
}
```

> El bucle sale en el **primer** día hábil que sí cuenta: si el día hábil más reciente ya está cubierto, la racha no está rota y no hay nada que reparar. Eso hace innecesario buscar "la última fecha que cuenta" por separado, que es como el spec lo describe en prosa.

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
./gradlew test --tests "com.osfit.app.domain.FaltaQueRompioLaRachaTest"
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/FaltaQueRompioLaRacha.kt app/src/test/java/com/osfit/app/domain/FaltaQueRompioLaRachaTest.kt
git commit -m "feat: add FaltaQueRompioLaRacha to bound which absence can be revived

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `justificadaPorCliente` en `Asistencia`

La distinción es necesaria: el "soborno" que otorga el entrenador **no debe gastar** el cupo del cliente (spec, "Campos nuevos en modelos existentes").

**Files:**
- Modify: `app/src/main/java/com/osfit/app/data/model/Asistencia.kt`
- Modify: `app/src/main/java/com/osfit/app/data/repository/FirestoreAsistenciaRepository.kt`
- Modify: `web/src/datos.ts`

**Interfaces:**
- Produces: `Asistencia.justificadaPorCliente: Boolean`

- [ ] **Step 1: Agregar el campo al modelo**

En `Asistencia.kt`, después de `justificada`:

```kotlin
    /** La justificó el cliente desde la web (no el entrenador). Solo estas gastan su cupo. */
    val justificadaPorCliente: Boolean = false,
```

- [ ] **Step 2: Conservarlo en `registrarAsistencia`**

`registrarAsistencia` hace un `set()` completo del documento, así que un campo que no se nombre se **borra**. Hoy ya conserva `justificada` con esa misma forma; hay que darle el mismo trato a la bandera nueva, o marcar asistencia y volver a marcar falta le devolvería el revive gastado al cliente.

En el bloque que construye la `Asistencia`, junto a `justificada`:

```kotlin
            justificada = !asistio && existente?.justificada == true,
            // Misma razón que la línea de arriba: `set()` borra lo que no se nombra, y
            // perder esta bandera le regalaría al cliente el revive que ya gastó.
            justificadaPorCliente = !asistio && existente?.justificadaPorCliente == true,
```

En `iniciarTiempo`, que también fuerza `justificada = false`, agregar al mismo `copy`:

```kotlin
            justificadaPorCliente = false,
```

> `justificarFalta()` no se toca: usa `update("justificada", …)`, que no pisa otros campos. Que el entrenador pueda desmarcar una justificada del cliente sin borrar `justificadaPorCliente` es deliberado — así `CupoRevivesCalculator` (que exige las dos banderas) le devuelve el cupo al cliente en cuanto eso pasa.

- [ ] **Step 3: Agregarlo al modelo de la web**

En `web/src/datos.ts`, en la interfaz `Asistencia`:

```ts
export interface Asistencia {
  fecha: string;
  asistio: boolean;
  justificada: boolean;
  /** La justificó el cliente desde la web. Solo estas gastan su cupo mensual. */
  justificadaPorCliente?: boolean;
  duracionMinutos: number | null;
}
```

> Opcional a propósito, igual que se aprendió en la Etapa 1: Firestore **omite** los campos que nunca se escribieron, así que toda asistencia anterior a esta etapa llega sin él y el tipo tiene que admitir `undefined`. Ver el commit `bf5463c`.

- [ ] **Step 4: Compilar y correr la suite**

```bash
./gradlew test
```
Expected: PASS, sin regresiones.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/Asistencia.kt app/src/main/java/com/osfit/app/data/repository/FirestoreAsistenciaRepository.kt web/src/datos.ts
git commit -m "feat: distinguish absences the client justified from the trainer's

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `CambioDiaWeb` y su repositorio

Existe porque si el cliente cambia su día **antes** de venir todavía no hay ningún registro de asistencia donde anotarlo (spec, "Colecciones nuevas").

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/CambioDiaWeb.kt`
- Create: `app/src/main/java/com/osfit/app/data/repository/CambioDiaWebRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/data/AppContainer.kt`

**Interfaces:**
- Produces:
  - `data class CambioDiaWeb(clienteId, fecha, diaIndex, motivo, creado)`
  - `CambioDiaWebRepository.observarPorFecha(fecha: String): Flow<List<CambioDiaWeb>>`

- [ ] **Step 1: Crear el modelo**

```kotlin
package com.osfit.app.data.model

import com.google.firebase.Timestamp

/**
 * Cambio de día pedido por el cliente desde la web. Alimenta el indicador del entrenador en
 * el calendario.
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

Clase plana, con el mismo `callbackFlow` que el resto del repo:

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.CambioDiaWeb
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/** Solo lectura: quien escribe `cambiosDia` es la función `cambiarDia`, nunca la app. */
class CambioDiaWebRepository(
    db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("cambiosDia")

    fun observarPorFecha(fecha: String): Flow<List<CambioDiaWeb>> = callbackFlow {
        val registro = coleccion.whereEqualTo("fecha", fecha)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(
                    snapshot?.documents?.mapNotNull { it.toObject(CambioDiaWeb::class.java) }
                        ?: emptyList()
                )
            }
        awaitClose { registro.remove() }
    }
}
```

- [ ] **Step 3: Registrarlo en `AppContainer`**

```kotlin
    val cambioDiaWebRepository: CambioDiaWebRepository by lazy { CambioDiaWebRepository() }
```

- [ ] **Step 4: Compilar**

```bash
./gradlew assembleDebug
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/CambioDiaWeb.kt app/src/main/java/com/osfit/app/data/repository/CambioDiaWebRepository.kt app/src/main/java/com/osfit/app/data/AppContainer.kt
git commit -m "feat: add CambioDiaWeb and its read-only repository

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Índice compuesto para el cupo

`revivirRacha` consulta las asistencias del mes filtrando por dos campos y un rango, y Firestore exige un índice compuesto para eso (spec, "El cupo se cuenta, no se guarda").

**Files:**
- Create: `firestore.indexes.json`
- Modify: `firebase.json`

- [ ] **Step 1: Crear el archivo de índices**

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

- [ ] **Step 2: Apuntar `firebase.json` al archivo**

```json
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
```

- [ ] **Step 3: Desplegar el índice**

```bash
firebase deploy --only firestore:indexes
```
Expected: `+ Deploy complete!`. El índice tarda un par de minutos en quedar `Enabled`; verificarlo en la consola de Firestore antes de la Task 7, o la primera llamada a `revivirRacha` va a fallar con `FAILED_PRECONDITION` y un link para crearlo.

- [ ] **Step 4: Commit**

```bash
git add firestore.indexes.json firebase.json
git commit -m "feat: add the composite index the revive quota query needs

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Utilidades compartidas de las functions

Las dos funciones nuevas necesitan lo mismo: sacar el `clienteId` del token, y saber qué día es en Mazatlán. Va a un módulo aparte para que la validación del claim exista una sola vez.

**Files:**
- Create: `functions/src/comun.ts`

**Interfaces:**
- Produces:
  - `clienteDeLaSesion(request): string` — o lanza `HttpsError("unauthenticated")`.
  - `hoyEnMazatlan(): string`
  - `REGION`, `db`

- [ ] **Step 1: Escribir el módulo**

```ts
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

export const REGION = "us-west1";

export const db = () => getFirestore();

/**
 * El `clienteId` del token de sesion, o un error si no hay.
 *
 * Es la unica puerta: ninguna funcion debe aceptar un clienteId que venga en el body, porque
 * eso seria dejar que el navegador diga de quien es la sesion. El claim lo pone `sesion` al
 * canjear el token del link y viaja firmado por Firebase.
 */
export function clienteDeLaSesion(request: CallableRequest): string {
  const clienteId = request.auth?.token?.clienteId;
  if (typeof clienteId !== "string" || clienteId === "") {
    throw new HttpsError("unauthenticated", "sesion_invalida");
  }
  return clienteId;
}

/**
 * Hoy en la zona del gimnasio, nunca la del navegador ni la del servidor.
 *
 * GEMELO: `hoyEnMazatlan()` en `web/src/fecha.ts` y `SincronizadorDiaWeb.hoy()` en Kotlin.
 * Las functions corren en UTC, asi que sin esto un cliente que abre la pagina a las 7pm
 * estaria escribiendo sobre el dia de manana.
 */
export function hoyEnMazatlan(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mazatlan" });
}
```

> `en-CA` da `AAAA-MM-DD`, que es justo el formato ISO que usa todo el repo. Es el truco que ya usa `web/src/fecha.ts`; se repite acá y no se importa porque `functions/` y `web/` son dos proyectos npm separados.

- [ ] **Step 2: Compilar**

```bash
cd functions && npx tsc --noEmit && cd ..
```
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add functions/src/comun.ts
git commit -m "feat: add shared helpers for the client-facing functions

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Función `cambiarDia`

Aplica exactamente lo que hace `AsignarDiaManual.ejecutar`: ancla fechada **el día anterior** a hoy, y corrección de `diaRutinaRealizado` si ya hay asistencia hoy. Más el trío denormalizado y el documento de `cambiosDia`.

**Files:**
- Create: `functions/src/cambiarDia.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `clienteDeLaSesion`, `hoyEnMazatlan` (Task 6).
- Produces: callable `cambiarDia({ diaIndex: number, motivo: string }) → { ok: true, diaIndex }`

- [ ] **Step 1: Escribir la función**

```ts
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

const MOTIVO_MAXIMO = 200;

/**
 * Cambia el dia de rutina que le toca al cliente. Sin limite de uso: si cambia dos veces el
 * mismo dia, la segunda pisa a la primera.
 *
 * Hace lo mismo que `AsignarDiaManual.ejecutar` en Kotlin, y por las mismas razones. Si esa
 * logica cambia alla, tiene que cambiar aca.
 */
export const cambiarDia = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);

  const diaIndex = request.data?.diaIndex;
  const motivo = typeof request.data?.motivo === "string" ? request.data.motivo.trim() : "";
  if (!Number.isInteger(diaIndex) || diaIndex < 0) {
    throw new HttpsError("invalid-argument", "dia_invalido");
  }
  if (motivo === "" || motivo.length > MOTIVO_MAXIMO) {
    throw new HttpsError("invalid-argument", "motivo_invalido");
  }

  const firestore = db();
  const clienteRef = firestore.collection("clientes").doc(clienteId);
  const cliente = await clienteRef.get();
  if (!cliente.exists) throw new HttpsError("not-found", "cliente_no_encontrado");

  // El rango valido sale de la rutina que tiene asignada: sin esto, un diaIndex fuera de
  // rango dejaria el ancla apuntando a un dia que no existe y la pagina no podria pintarlo.
  const totalDias = (cliente.get("rutinaAsignada.dias") as unknown[] | undefined)?.length ?? 0;
  if (totalDias === 0) throw new HttpsError("failed-precondition", "sin_rutina");
  if (diaIndex >= totalDias) throw new HttpsError("invalid-argument", "dia_invalido");

  const hoy = hoyEnMazatlan();
  // El ancla se fecha el dia ANTERIOR a hoy porque el calculador toma el historial
  // estrictamente despues del ancla: asi la asistencia de hoy entra en la ventana y manana
  // el ciclo avanza, en vez de quedarse trabado en el dia asignado para siempre.
  const ancla = new Date(`${hoy}T12:00:00Z`);
  ancla.setUTCDate(ancla.getUTCDate() - 1);
  const anclaFecha = ancla.toISOString().slice(0, 10);

  // Se consulta ANTES de armar el lote: de si hay asistencia hoy depende no solo la
  // correccion del dia realizado, sino tambien la forma del trio denormalizado.
  const deHoy = await firestore
    .collection("asistencias")
    .where("clienteId", "==", clienteId)
    .where("fecha", "==", hoy)
    .limit(1)
    .get();
  const asistenciaHoy = deHoy.docs[0];
  const vinoHoy = asistenciaHoy?.get("asistio") === true;

  const lote = firestore.batch();

  lote.update(clienteRef, {
    // Los nombres salen de `FirestoreClienteRepository.asignarDiaAncla`, que escribe
    // exactamente este par. Ojo con el primero: el dia del ancla se guarda en
    // `diaActualIndex`, no en un `diaAnclaIndex` que no existe.
    diaActualIndex: diaIndex,
    diaAnclaFecha: anclaFecha,
    // El trio denormalizado se escribe a mano, en el mismo lote que el ancla, para que no
    // exista un instante con el ancla nueva y el trio viejo.
    //
    // Las dos formas son las mismas dos que produce `denormalizar()`, y hay que elegir
    // igual que ella: el ancla se fecha AYER, asi que una asistencia de hoy cae dentro de
    // su ventana (`fecha > ancla && fecha <= hoy`) y gana. Escribir el trio de ancla
    // cuando el cliente ya vino hoy lo dejaria trabado en este dia manana, que es
    // exactamente la regresion del commit d424286.
    ...(vinoHoy
      ? { ultimoDia: diaIndex, ultimoDiaFecha: hoy, ultimoDiaEsAncla: false }
      : { ultimoDia: diaIndex, ultimoDiaFecha: anclaFecha, ultimoDiaEsAncla: true }),
  });

  // Si ya hay asistencia de hoy, el historial pisaria la correccion al instante. Mismo
  // motivo que el paso 2 de `AsignarDiaManual`.
  if (vinoHoy) {
    lote.update(asistenciaHoy.ref, { diaRutinaRealizado: diaIndex });
  }

  lote.set(firestore.collection("cambiosDia").doc(`${clienteId}_${hoy}`), {
    clienteId,
    fecha: hoy,
    diaIndex,
    motivo,
    creado: FieldValue.serverTimestamp(),
  });

  await lote.commit();
  return { ok: true, diaIndex };
});
```

> **El par de campos del ancla es `diaActualIndex` + `diaAnclaFecha`.** Verificado contra `FirestoreClienteRepository.asignarDiaAncla` (que escribe ese mapa literal) y contra `RutinaProgressCalculator.anclaDe` (que lee `cliente.diaAnclaFecha` y `cliente.diaActualIndex`). El nombre asimétrico es una trampa: es tentador escribir `diaAnclaIndex` por simetría con `diaAnclaFecha`, y ese campo **no existe** — el ancla quedaría a medias, con fecha nueva y día viejo, y el cambio de día haría algo peor que nada.
>
> **Clientes anteriores al corte:** `anclaDe` solo usa el par cuando `diaAnclaFecha != null`; si es null cae a la fórmula congelada. Como esta función **siempre** escribe los dos campos, el cliente queda con ancla propia desde el primer cambio de día y sale de esa rama para siempre. Es el mismo efecto que tiene hoy "Asignar día" desde la app, así que no introduce un estado nuevo.

- [ ] **Step 2: Exportarla**

En `functions/src/index.ts`, agregar la línea de export junto a la de `sesion`.

- [ ] **Step 3: Compilar y desplegar**

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions:cambiarDia
```
Expected: `+ Deploy complete!`

- [ ] **Step 4: Commit**

```bash
git add functions/src/cambiarDia.ts functions/src/index.ts
git commit -m "feat: add the cambiarDia function for the client web

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Función `revivirRacha`

**Files:**
- Create: `functions/src/revivirRacha.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `clienteDeLaSesion`, `hoyEnMazatlan` (Task 6); el índice de la Task 5.
- Produces: callable `revivirRacha({ fecha: string }) → { ok: true, disponibles: number }`

- [ ] **Step 1: Escribir la función**

Reglas del spec, en orden: valida que `fecha` sea hoy o la falta que rompió la racha; cuenta el cupo del mes y rechaza si ya hay 3; y escribe la asistencia — actualizando la falta existente, o creándola con `asistio = false` si el cliente avisa por adelantado. Se rechaza si la asistencia de esa fecha tiene `asistio = true`.

```ts
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { faltaQueRompioLaRacha } from "./faltaRompio";

const MAXIMO_POR_MES = 3;

export const revivirRacha = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);
  const fecha = typeof request.data?.fecha === "string" ? request.data.fecha : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new HttpsError("invalid-argument", "fecha_invalida");
  }

  const firestore = db();
  const hoy = hoyEnMazatlan();

  const todas = await firestore
    .collection("asistencias")
    .where("clienteId", "==", clienteId)
    .get();
  const asistencias = todas.docs.map((d) => ({ ref: d.ref, ...d.data() } as any));

  // Solo dos fechas son justificables: hoy, y la falta que rompio la racha. Se revalida en
  // el servidor y no se confia en la que mande la pagina, porque si no el cliente podria
  // justificar cualquier dia de su historial abriendo la consola del navegador.
  if (fecha !== hoy && fecha !== faltaQueRompioLaRacha(asistencias, hoy)) {
    throw new HttpsError("failed-precondition", "fecha_no_justificable");
  }

  const mes = hoy.slice(0, 7);
  const gastados = asistencias.filter(
    (a: any) => a.justificadaPorCliente && a.justificada && a.fecha.startsWith(`${mes}-`)
  ).length;
  if (gastados >= MAXIMO_POR_MES) {
    throw new HttpsError("resource-exhausted", "sin_cupo");
  }

  const existente = asistencias.find((a: any) => a.fecha === fecha);
  // Justificar un dia al que si vino no significa nada. Misma condicion que ya aplica
  // `justificarFalta()` en Kotlin.
  if (existente?.asistio === true) {
    throw new HttpsError("failed-precondition", "ya_asistio");
  }

  if (existente) {
    await existente.ref.update({ justificada: true, justificadaPorCliente: true });
  } else {
    // El caso de avisar por adelantado: todavia no hay registro. Crearlo funciona sin
    // coordinacion con la app porque `registrarAsistencia()` ya conserva `justificada` al
    // remarcar una falta, y la limpia sola si el cliente termina asistiendo.
    await firestore.collection("asistencias").add({
      clienteId,
      fecha,
      asistio: false,
      justificada: true,
      justificadaPorCliente: true,
      diaRutinaRealizado: null,
      nota: "",
      horaLlegada: null,
      horaSalida: null,
      duracionMinutos: null,
    });
  }

  return { ok: true, disponibles: MAXIMO_POR_MES - gastados - 1 };
});
```

> Se lee el historial completo del cliente con un solo `where("clienteId", ...)` en vez de la consulta de tres campos del spec. Es una lectura que ya se hace igual para calcular la falta que rompió la racha, así se hace una sola vez en lugar de dos. El índice de la Task 5 se despliega igual: lo necesita la consulta que el spec describe y conviene tenerlo si el historial crece lo bastante como para querer acotarlo.

- [ ] **Step 2: Portar `faltaQueRompioLaRacha` a `functions/`**

Crear `functions/src/faltaRompio.ts` con el mismo algoritmo de la Task 2. Es un tercer gemelo (Kotlin, web, functions) y hay que anotarlo como tal en el comentario de cabecera de los tres.

> Es duplicación consciente: `functions/` y `web/` son proyectos npm independientes, sin paquete compartido, y montar uno para veinte líneas costaría más que copiarlas. Lo que **no** puede pasar es que el servidor confíe en la fecha que mande la página — por eso se duplica hacia el servidor y no se elimina de ahí.

- [ ] **Step 3: Exportarla, compilar y desplegar**

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions:revivirRacha
```
Expected: `+ Deploy complete!`

- [ ] **Step 4: Commit**

```bash
git add functions/src/revivirRacha.ts functions/src/faltaRompio.ts functions/src/index.ts
git commit -m "feat: add the revivirRacha function with its monthly quota

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Gemelos de TypeScript en la web

**Files:**
- Create: `web/src/cupo.ts`, `web/src/cupo.test.ts`
- Create: `web/src/faltaRompio.ts`, `web/src/faltaRompio.test.ts`
- Create: `web/src/motivos.ts`, `web/src/motivos.test.ts`

**Interfaces:**
- Produces:
  - `gastadosEnElMes(asistencias, mes): number` / `disponiblesEnElMes(asistencias, mes): number`
  - `faltaQueRompioLaRacha(asistencias, hoy): string | null`
  - `motivosDisponibles(hoy, asistencias): Motivo[]`

- [ ] **Step 1: Escribir los tests que fallan**

Portar caso por caso los de la Task 1 y la Task 2 — los mismos nombres, las mismas fechas, los mismos números esperados. Que sean idénticos es lo que hace que sirvan de gemelos: si alguien cambia un lado, el otro test sigue diciendo cuál era el contrato.

Para `motivos.test.ts`, los dos casos del spec:
- `"filtra el motivo del lunes cuando no es lunes"`
- `"filtra el de mas de dos dias cuando asistio ayer"`

Y uno más que conviene fijar: `"un lunes con mas de dos dias sin venir ofrece los seis"`.

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
cd web && npx vitest run && cd ..
```
Expected: fallan por módulos inexistentes.

- [ ] **Step 3: Implementar los tres módulos**

`cupo.ts` y `faltaRompio.ts` son traducción directa de sus gemelos de Kotlin, con la cabecera `GEMELO:` apuntando a los otros dos.

`motivos.ts` lleva el catálogo del spec:

```ts
export interface Motivo {
  id: string;
  texto: string;
  /** Habilita el campo de texto libre. */
  libre?: boolean;
}

const CATALOGO: Motivo[] = [
  { id: "lunes", texto: "Hoy es lunes y quiero iniciar con algo que me guste" },
  { id: "ausencia", texto: "Tengo más de dos días sin venir y quiero iniciar con lo que yo quiera" },
  { id: "adelantar", texto: "Quiero adelantar el día" },
  { id: "reservado", texto: "La neta no te quiero decir, solo no quiero hacerlo" },
  { id: "fragil", texto: "Soy una perra frágil" },
  { id: "otro", texto: "Otro (describe el motivo)", libre: true },
];
```

Los dos primeros son condicionales porque son **afirmaciones sobre hechos**: "hoy es lunes" ofrecido un miércoles es absurdo, y ofrecerlo igual enseña que las opciones no significan nada. `motivosDisponibles` filtra `lunes` si `hoy` no es lunes, y `ausencia` si el cliente asistió en alguno de los últimos 2 días hábiles.

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
cd web && npx vitest run && cd ..
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/cupo.ts web/src/cupo.test.ts web/src/faltaRompio.ts web/src/faltaRompio.test.ts web/src/motivos.ts web/src/motivos.test.ts
git commit -m "feat: port the quota, broken-streak and motive logic to the web

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Las dos acciones en la página

**Files:**
- Modify: `web/src/firebase.ts`
- Create: `web/src/acciones.ts`
- Create: `web/src/ui/accionDia.ts`
- Create: `web/src/ui/accionFalta.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Consumes: `motivosDisponibles`, `disponiblesEnElMes`, `faltaQueRompioLaRacha` (Task 9); los callables de las Tasks 7 y 8.

- [ ] **Step 1: Exportar `functions` desde `firebase.ts`**

```ts
import { getFunctions } from "firebase/functions";
export const functions = getFunctions(app, "us-west1");
```

La región tiene que ser la misma con la que se desplegaron o el callable pega a un endpoint que no existe.

- [ ] **Step 2: Crear `acciones.ts`**

Un `httpsCallable` por función y nada más. Que sea el único archivo que las llama es lo que hace que el día que cambie una firma haya un solo sitio que tocar.

- [ ] **Step 3: Crear `accionDia.ts`**

Botón "Cambiar mi día" que abre la hoja de motivos. Al elegir uno (con el texto libre si eligió "Otro"), llama a `cambiarDia` y deja el botón deshabilitado mientras responde. La tarjeta del día se repinta sola: `observarCliente` ya está suscrito y el trío lo actualizó la función.

- [ ] **Step 4: Crear `accionFalta.ts`**

Dos entradas al mismo endpoint:
- **"Hoy no voy a poder ir"** → `fecha = hoy`.
- **"Revivir mi racha"** → `fecha = faltaQueRompioLaRacha(...)`. Si devuelve `null`, **el botón no se muestra**: la racha no está rota y no hay nada que reparar.

Antes de gastar el revive se confirma, porque son 3 al mes y el cliente no debe descubrir que gastó uno por un toque accidental:

> **¿Usar uno de tus 3 revives?**
> Te quedan 2 este mes.
> [ Cancelar ] [ Sí, usar uno ]

Y al confirmar, la página responde:

> **Esperamos que todo esté bien, te vemos mañana si Dios quiere!**

Ninguna de las dos pide motivo. No hay lista, no hay texto libre, no se guarda nada — ver el spec, "Faltar no pide explicaciones". Si el `catch` recibe `resource-exhausted`, el mensaje es que ya no le quedan revives este mes, no un error genérico.

- [ ] **Step 5: Componer en `main.ts`**

Las acciones van **debajo** de la tarjeta del día y de las stats, antes del calendario: el orden de la página es el de urgencia, y consultar es más frecuente que actuar.

- [ ] **Step 6: Desplegar y verificar**

```bash
cd web && npm run build && cd ..
firebase deploy --only hosting
```

- [ ] **Step 7: Commit**

```bash
git add web/src/firebase.ts web/src/acciones.ts web/src/ui/accionDia.ts web/src/ui/accionFalta.ts web/src/main.ts
git commit -m "feat: let the client change their day and revive their streak

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Indicadores en el calendario del entrenador

Junto a cada cliente del día, una marca si avisó que no viene, o si cambió su día — en ese caso **con el motivo**; el aviso de ausencia no lleva motivo (spec, punto 4 de "Cambios en la app Android").

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/calendario/TomarAsistenciaViewModel.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/calendario/TomarAsistenciaScreen.kt`

**Interfaces:**
- Consumes: `CambioDiaWebRepository.observarPorFecha` (Task 4), `Asistencia.justificadaPorCliente` (Task 3).

- [ ] **Step 1: Exponer los cambios del día en el ViewModel**

Dos `StateFlow` nuevos, con el mismo patrón de `stateIn` que ya usan `asistenciasDelDia` y `diaQueTocaPorCliente`:

```kotlin
    /** clienteId → motivo que eligió al cambiar su día hoy. */
    val cambioDiaPorCliente: StateFlow<Map<String, String>>

    /** clienteIds que avisaron que no vienen hoy. */
    val avisoAusenciaPorCliente: StateFlow<Set<String>>
```

El segundo sale de `asistenciasDelDia`, filtrando `justificadaPorCliente && !asistio`. Ambas colecciones ya se observan en tiempo real; no hay plumbing nuevo.

- [ ] **Step 2: Pintar los indicadores en `ClienteAsistenciaRow`**

Debajo del nombre, cuando aplique:
- Avisó que no viene → una marca sobria, **sin motivo**.
- Cambió su día → marca + el motivo que eligió.

El indicador dice *que* el cliente avisó, nunca *por qué*. Si el entrenador quiere saberlo, le pregunta — que es exactamente lo que haría de todos modos.

- [ ] **Step 3: Compilar e instalar**

```bash
./gradlew installDebug
```

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/calendario/
git commit -m "feat: show day changes and absence notices in the attendance screen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Cupo visible en la ficha del cliente

Para poder contrastar cuando un cliente diga que se le acabaron (spec, punto 5).

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`

**Interfaces:**
- Consumes: `CupoRevivesCalculator` (Task 1).

- [ ] **Step 1: Exponer el cupo en el ViewModel**

Deriva de las asistencias del cliente, que la pantalla ya observa. El mes es el de `SincronizadorDiaWeb.hoy()`, no el del dispositivo.

- [ ] **Step 2: Mostrarlo en la pantalla**

"Revives: 2 de 3 disponibles este mes", junto a los controles de acceso web que ya existen.

- [ ] **Step 3: Compilar e instalar**

```bash
./gradlew installDebug
```

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/
git commit -m "feat: show the client's remaining revives in their detail screen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Verificación final en dispositivo

Nada de esto se prueba con tests automáticos: son las cosas que solo fallan contra Firebase real. No se testean unitariamente los endpoints ni las reglas — no hay precedente en el repo y requerirían emuladores.

**Files:** ninguno (verificación)

- [ ] **Step 1: Correr todas las suites**

```bash
./gradlew test
cd web && npx vitest run && cd ..
```

- [ ] **Step 2: Verificar que el cliente sigue sin poder escribir**

Es el test negativo más importante de esta etapa: las acciones pasan por functions justamente para que las reglas sigan siendo de solo lectura. Con la página abierta como cliente A, en la consola del navegador:

```javascript
const { getFirestore, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js");
await updateDoc(doc(getFirestore(), "clientes", "<SU_PROPIO_ID>"), { ultimoDia: 0 });
```

Expected: **error de permisos**. Repetir contra `asistencias` y `cambiosDia`. Los tres tienen que fallar.

- [ ] **Step 3: Verificar `cambiarDia` de punta a punta**

1. Cambiar el día desde la página y confirmar que la tarjeta se repinta sola, sin recargar.
2. Confirmar que la app muestra **el mismo día** para ese cliente.
3. **Al día siguiente**, confirmar que el ciclo avanzó y no se quedó trabado en el día asignado. Es la regresión que ya mordió una vez (commit `d424286`).
4. Cambiar dos veces el mismo día: la segunda pisa a la primera, y el indicador muestra la última.
5. Cambiar el día **con asistencia ya marcada hoy** y confirmar dos cosas: que `diaRutinaRealizado` quedó corregido, y que **al día siguiente el ciclo avanza**. Es la rama `vinoHoy` del trío, y equivocarla no se nota hoy — solo mañana. Contrastar contra un cliente que cambió el día **sin** haber venido: ese sí debe seguir mañana en el mismo día, porque no hizo la rutina.

- [ ] **Step 4: Verificar `revivirRacha` de punta a punta**

1. "Hoy no voy a poder ir" sin registro previo → se crea la falta justificada y la racha no se rompe.
2. Con falta ya registrada por el entrenador → se actualiza, no se duplica.
3. Gastar los 3 del mes y confirmar que el cuarto intento muestra que no quedan.
4. Que el entrenador desmarque una justificada desde la app y confirmar que **el cupo se devuelve solo**.
5. Intentar justificar una fecha arbitraria del historial desde la consola, llamando al callable a mano: tiene que responder `failed-precondition`.
6. Un día al que el cliente sí vino: `ya_asistio`.

- [ ] **Step 5: Verificar los indicadores y el cupo en la app**

Con un cliente que cambió su día y otro que avisó ausencia, abrir Tomar Asistencia: el primero muestra motivo, el segundo no. La ficha del cliente muestra el cupo correcto.

- [ ] **Step 6: Actualizar el README**

Agregar a la sección "Web para clientes" que el cliente ya puede cambiar su día y justificar ausencias, y que ambas acciones pasan por Cloud Functions porque las reglas lo mantienen en solo lectura.

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: document the client web actions in the README

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Qué queda para la Etapa 3

- Subida de insignias a Storage, `imagenUrl` en los dos catálogos, botón de publicar video, retención de 6, y las secciones de medallas, logros y videos en la página.

## Del backlog, que esta etapa NO toca

- **Revocar el acceso no corta la sesión ya abierta** (`docs/backlog.md`, entrada 1). Se decidió dejarlo en el backlog en vez de plegarlo acá. Sigue sin ser urgente por el mismo motivo de siempre: el aislamiento entre clientes aguanta, y lo peor que ve un cliente con la sesión viva es su propia información. Con esta etapa gana un matiz que conviene anotar: ahora esa sesión viva también puede **escribir** por las dos acciones nuevas. El alcance sigue siendo el propio cliente — las functions sacan el `clienteId` del claim y jamás del body — así que lo que un revocado podría hacer es seguir cambiando su propio día. Molesto, no peligroso.
