# Reinicio semanal del ciclo de rutina — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que en las rutinas marcadas con `reinicioSemanal` el ciclo se reinicie cada lunes, de modo que el último día y el primero —que trabajan la misma parte del cuerpo— nunca caigan en días consecutivos.

**Architecture:** El ciclo sigue derivándose del historial de asistencias. Lo único que cambia es que el **ancla efectiva** nunca puede ser anterior al domingo pasado, y que el ciclo **deja de dar la vuelta**: si el día realizado era el último, hoy toca descansar. Eso convierte "el día que toca" en "la N-ésima asistencia de la semana" sin reescribir el calculador ni guardar estado nuevo.

**Tech Stack:** Kotlin 2.0.21 / Android (Compose, JUnit 4, coroutines), TypeScript / Vite / Vitest en `web/`, Firestore.

**Spec:** [`docs/superpowers/specs/2026-09-21-reinicio-semanal-rutina-design.md`](../specs/2026-09-21-reinicio-semanal-rutina-design.md)

## Global Constraints

- **La semana va de lunes a domingo.** Es el mismo criterio que ya usa `RachaCalculator.esDiaHabil`. No se introduce ninguna otra definición de semana.
- **El ancla es exclusiva.** El historial manda *estrictamente después* de `ancla.fecha`. Por eso el ancla del reinicio se fecha en **domingo**, no en lunes.
- **`reinicioSemanal` nace en `false`.** Ninguna rutina existente cambia de comportamiento. No hay migración de datos: Firestore omite los campos nunca escritos y Kotlin lee el default.
- **`Descanso` solo puede ocurrir con `reinicioSemanal = true`.** Con el ciclo rodante el resultado nunca cambia respecto de hoy.
- **Fechas siempre como `String` ISO-8601 (`YYYY-MM-DD`)**, comparables lexicográficamente. Es la convención de todo el proyecto; no se introducen `LocalDate` en las firmas públicas.
- **Zona horaria en la web:** toda construcción de fecha usa `new Date(\`${fecha}T12:00:00\`)` y lectores `getUTC*`. Es lo que ya hace `esFinDeSemana` y mezclarlo con lectores locales produce discrepancias en los bordes del día.
- **El contrato gemelo es ley:** para toda fecha `d >= hoy`, `interpretar(denormalizar(c, a, hoy), totalDias, d, r) == diaQueToca(c, a, d)`. Lo verifica `DiaDenormalizadoTest` y no puede quedar en rojo al terminar ninguna tarea.
- **Comandos de prueba:** Android `./gradlew test` desde la raíz (en PowerShell, `.\gradlew.bat test`). Web `npm test` desde `web/`.

---

### Task 1: El campo y el helper de semana

Lo más pequeño que se puede construir y probar solo: el campo booleano en los tres lugares donde vive el tipo `Rutina`, y la aritmética de semanas que el resto del plan va a usar.

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/SemanaDeRutina.kt`
- Create: `app/src/test/java/com/osfit/app/domain/SemanaDeRutinaTest.kt`
- Modify: `app/src/main/java/com/osfit/app/data/model/Rutina.kt`
- Modify: `web/src/datos.ts:25`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `Rutina.reinicioSemanal: Boolean` (default `false`)
  - `SemanaDeRutina.lunesDe(fecha: String): String`
  - `SemanaDeRutina.domingoAnterior(fecha: String): String`
  - En TypeScript, `Rutina.reinicioSemanal?: boolean`

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/test/java/com/osfit/app/domain/SemanaDeRutinaTest.kt`:

```kotlin
package com.osfit.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Fechas de referencia: 2026-09-07 es lunes, 2026-09-11 viernes, 2026-09-12 sábado,
 * 2026-09-13 domingo y 2026-09-14 el lunes siguiente.
 */
class SemanaDeRutinaTest {

    @Test
    fun `el lunes es su propio lunes`() {
        assertEquals("2026-09-07", SemanaDeRutina.lunesDe("2026-09-07"))
    }

    @Test
    fun `entre semana devuelve el lunes de esa semana`() {
        assertEquals("2026-09-07", SemanaDeRutina.lunesDe("2026-09-11"))
    }

    @Test
    fun `el sabado sigue perteneciendo a la semana que empezo el lunes`() {
        assertEquals("2026-09-07", SemanaDeRutina.lunesDe("2026-09-12"))
    }

    @Test
    fun `el domingo cierra su semana y no abre la siguiente`() {
        assertEquals("2026-09-07", SemanaDeRutina.lunesDe("2026-09-13"))
    }

    @Test
    fun `el lunes siguiente ya es otra semana`() {
        assertEquals("2026-09-14", SemanaDeRutina.lunesDe("2026-09-14"))
    }

    @Test
    fun `el domingo anterior es el dia previo al lunes de la semana`() {
        assertEquals("2026-09-06", SemanaDeRutina.domingoAnterior("2026-09-07"))
        assertEquals("2026-09-06", SemanaDeRutina.domingoAnterior("2026-09-11"))
        assertEquals("2026-09-06", SemanaDeRutina.domingoAnterior("2026-09-13"))
        assertEquals("2026-09-13", SemanaDeRutina.domingoAnterior("2026-09-14"))
    }

    @Test
    fun `las semanas se comparan lexicograficamente igual que cronologicamente`() {
        val anterior = SemanaDeRutina.lunesDe("2026-09-11")
        val actual = SemanaDeRutina.lunesDe("2026-09-14")
        assertEquals(true, anterior < actual)
    }
}
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `./gradlew test --tests "com.osfit.app.domain.SemanaDeRutinaTest"`
Expected: FAIL — error de compilación, `Unresolved reference: SemanaDeRutina`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `app/src/main/java/com/osfit/app/domain/SemanaDeRutina.kt`:

```kotlin
package com.osfit.app.domain

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Aritmética de la semana de entrenamiento, que va de **lunes a domingo** — el mismo
 * criterio que `RachaCalculator.esDiaHabil`.
 *
 * GEMELO: `lunesDe` en `web/src/dia.ts`. Si cambia acá, cambia allá.
 *
 * Devuelve `String` y no `LocalDate` a propósito: todo el resto del dominio compara
 * fechas como texto ISO-8601, y devolver otro tipo obligaría a convertir en cada uso.
 */
object SemanaDeRutina {

    /** Lunes de la semana en la que cae [fecha]. */
    fun lunesDe(fecha: String): String =
        LocalDate.parse(fecha).with(DayOfWeek.MONDAY).toString()

    /**
     * Domingo anterior al lunes de la semana de [fecha].
     *
     * Es la fecha que sirve como ancla del reinicio semanal, y es **domingo y no lunes**
     * porque el ancla es exclusiva: el historial manda estrictamente después de ella, así
     * que fecharla en domingo es lo que hace que la asistencia del lunes ya cuente.
     */
    fun domingoAnterior(fecha: String): String =
        LocalDate.parse(fecha).with(DayOfWeek.MONDAY).minusDays(1).toString()
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `./gradlew test --tests "com.osfit.app.domain.SemanaDeRutinaTest"`
Expected: PASS, 7 tests.

- [ ] **Step 5: Agregar el campo a `Rutina`**

En `app/src/main/java/com/osfit/app/data/model/Rutina.kt`, reemplazar el archivo entero:

```kotlin
package com.osfit.app.data.model

data class Rutina(
    val id: String = "",
    val nombre: String = "",
    val dias: List<DiaRutina> = emptyList(),
    /**
     * El ciclo se reinicia cada lunes en vez de rodar sin fin.
     *
     * Existe para las rutinas cuyo primer y último día trabajan la misma parte del cuerpo
     * —día 1 "Pierna (cuádriceps)", día 5 "Pierna completa"—: con el ciclo rodante, una
     * falta los deja en días consecutivos. Con esto activado, el día que toca es la
     * N-ésima asistencia de la semana y **el último día solo se hace si vino la semana
     * completa**. Ver `docs/superpowers/specs/2026-09-21-reinicio-semanal-rutina-design.md`.
     *
     * Nace en `false`: toda rutina anterior a este campo conserva el ciclo rodante.
     */
    val reinicioSemanal: Boolean = false
)
```

- [ ] **Step 6: Agregar el campo al tipo de la web**

En `web/src/datos.ts`, reemplazar la línea 25:

```ts
export interface Rutina { id: string; nombre: string; dias: DiaRutina[]; reinicioSemanal?: boolean; }
```

Es opcional (`?`) porque Firestore omite los campos nunca escritos y una rutina anterior llega sin él.

- [ ] **Step 7: Correr toda la suite para confirmar que nada se rompió**

Run: `./gradlew test`
Expected: PASS, todo verde. Agregar un campo con default no cambia ningún comportamiento.

Run: `cd web && npm test`
Expected: PASS, todo verde.

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/SemanaDeRutina.kt \
        app/src/test/java/com/osfit/app/domain/SemanaDeRutinaTest.kt \
        app/src/main/java/com/osfit/app/data/model/Rutina.kt \
        web/src/datos.ts
git commit -m "feat: campo reinicioSemanal y aritmetica de la semana de rutina"
```

---

### Task 2: El tipo `DiaQueToca`, sin cambiar comportamiento

Refactor puro. Al terminar, **toda la suite tiene que seguir verde sin haber cambiado ninguna expectativa de comportamiento**. Si algún test cambia de valor esperado, algo salió mal.

El motivo del tipo está en el spec: el cálculo necesita poder decir "hoy no hay día", y un `Int` no puede sin inventarse un centinela. Ojo con la confusión fácil: **lo que se guarda no necesita nada nuevo** — `asistio = true` con `diaRutinaRealizado = null` ya es un estado coherente hoy (cuenta para la racha, no mueve el ciclo, porque el filtro del ciclo exige las dos condiciones).

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/DiaQueToca.kt`
- Modify: `app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt:76-95` (`diaQueToca`) y `:143-150` (`interpretar`)
- Modify: `app/src/test/java/com/osfit/app/domain/EscenarioRutina.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/calendario/TomarAsistenciaViewModel.kt:53-62, 89-91, 148, 180`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt:126`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClientesListViewModel.kt:36-44`
- Modify: `app/src/main/java/com/osfit/app/ui/sandbox/SandboxViewModel.kt:56-63, 81`
- Modify: `app/src/test/java/com/osfit/app/domain/RutinaProgressCalculatorTest.kt`
- Modify: `app/src/test/java/com/osfit/app/domain/SincronizadorDiaWebTest.kt`

**Interfaces:**
- Consumes: `Rutina.reinicioSemanal` (Task 1), aunque todavía no se usa.
- Produces:
  - `sealed interface DiaQueToca` con `Dia(indice: Int)`, `Descanso`, `SinRutina`
  - `RutinaProgressCalculator.diaQueToca(cliente, asistencias, hoy): DiaQueToca`
  - `RutinaProgressCalculator.interpretar(valor, totalDias, fecha): DiaQueToca`
  - `EscenarioRutina.estado(id, hoy): DiaQueToca` y `EscenarioRutina.diaQueToca(id, hoy): Int` (el segundo desenvuelve el primero)

- [ ] **Step 1: Crear el tipo**

Crear `app/src/main/java/com/osfit/app/domain/DiaQueToca.kt`:

```kotlin
package com.osfit.app.domain

/**
 * Lo que le toca hoy a un cliente.
 *
 * Es un tipo y no un `Int` porque desde el reinicio semanal hay un tercer caso real —la
 * semana ya está completa— y un entero no puede decirlo sin inventarse un valor centinela.
 * Al ser sellado, el compilador obliga a que cada pantalla decida qué hace con él en vez
 * de dejar que un caso nuevo se cuele en silencio.
 *
 * Es **solo el resultado del cálculo**. Lo que se guarda en una asistencia no cambia: una
 * asistencia con `asistio = true` y `diaRutinaRealizado = null` ya significaba hoy "vino
 * pero esto no mueve el ciclo", y sigue significando eso.
 */
sealed interface DiaQueToca {

    /** Índice dentro de `rutinaAsignada.dias`. La UI muestra `indice + 1`. */
    data class Dia(val indice: Int) : DiaQueToca

    /**
     * Ya completó el ciclo de esta semana: hoy no hay día que darle.
     * Solo puede ocurrir con [com.osfit.app.data.model.Rutina.reinicioSemanal].
     */
    data object Descanso : DiaQueToca

    /** El cliente no tiene rutina asignada, o la tiene sin días. */
    data object SinRutina : DiaQueToca
}
```

- [ ] **Step 2: Cambiar la firma de `diaQueToca`**

En `RutinaProgressCalculator.kt`, reemplazar el cuerpo de `diaQueToca(cliente, asistenciasDelCliente, hoy)` por:

```kotlin
    fun diaQueToca(cliente: Cliente, asistenciasDelCliente: List<Asistencia>, hoy: String): DiaQueToca {
        val rutina = cliente.rutinaAsignada ?: return DiaQueToca.SinRutina
        val totalDias = rutina.dias.size
        if (totalDias <= 0) return DiaQueToca.SinRutina

        val ancla = anclaDe(cliente)

        val ultima = asistenciasDelCliente
            .filter { it.clienteId == cliente.id || cliente.id.isEmpty() }
            .filter { it.asistio && it.diaRutinaRealizado != null }
            .filter { it.fecha > ancla.fecha && it.fecha <= hoy }
            .maxByOrNull { it.fecha }
            ?: return DiaQueToca.Dia(ancla.dia.coerceIn(0, totalDias - 1))

        val realizado = ultima.diaRutinaRealizado!!.coerceIn(0, totalDias - 1)
        return if (ultima.fecha == hoy) {
            DiaQueToca.Dia(realizado)
        } else {
            DiaQueToca.Dia(siguienteDia(realizado, totalDias))
        }
    }
```

Y la versión de conveniencia:

```kotlin
    fun diaQueToca(cliente: Cliente, asistenciasDelCliente: List<Asistencia>): DiaQueToca =
        diaQueToca(cliente, asistenciasDelCliente, LocalDate.now().toString())
```

- [ ] **Step 3: Cambiar la firma de `interpretar`**

En el mismo archivo, reemplazar `interpretar`:

```kotlin
    fun interpretar(valor: DiaDenormalizado, totalDias: Int, fecha: String): DiaQueToca {
        val dia = valor.dia ?: return DiaQueToca.SinRutina
        if (totalDias <= 0) return DiaQueToca.SinRutina
        val acotado = dia.coerceIn(0, totalDias - 1)
        if (valor.esAncla) return DiaQueToca.Dia(acotado)
        return if (valor.fecha == fecha) {
            DiaQueToca.Dia(acotado)
        } else {
            DiaQueToca.Dia(siguienteDia(acotado, totalDias))
        }
    }
```

**Ojo:** `SinRutina` reemplaza al `0` que antes devolvían estas dos funciones cuando no había rutina. Eso es un cambio de representación, no de comportamiento, siempre que cada sitio de llamada lo traduzca de vuelta a `0` (los pasos siguientes lo hacen).

- [ ] **Step 4: Absorber el cambio en el escenario de pruebas**

En `app/src/test/java/com/osfit/app/domain/EscenarioRutina.kt`, reemplazar el método `diaQueToca` por estos dos:

```kotlin
    /** Estado completo del día, incluido el descanso del reinicio semanal. */
    suspend fun estado(id: String, hoy: String): DiaQueToca =
        RutinaProgressCalculator.diaQueToca(cliente(id), asistenciasDe(id), hoy)

    /**
     * Índice del día, como lo veían los tests antes de que el cálculo tuviera tres estados.
     * `SinRutina` sigue valiendo 0, igual que antes. `Descanso` revienta a propósito: un test
     * que lo encuentre por accidente tiene que enterarse, no recibir un número inventado.
     */
    suspend fun diaQueToca(id: String, hoy: String): Int = when (val d = estado(id, hoy)) {
        is DiaQueToca.Dia -> d.indice
        DiaQueToca.SinRutina -> 0
        DiaQueToca.Descanso -> error("le toca descansar en $hoy; usa estado() para afirmarlo")
    }
```

Y en el método `marcar`, sustituir el cálculo del día por uno que tolere el descanso:

```kotlin
    /** Marcar Asistió/Faltó y guardar (TomarAsistenciaViewModel.guardarTodo). */
    suspend fun marcar(id: String, fecha: String, asistio: Boolean) {
        val dia = if (asistio) (estado(id, fecha) as? DiaQueToca.Dia)?.indice else null
        asistencias.registrarAsistencia(
            clienteId = id,
            fecha = fecha,
            asistio = asistio,
            diaRutinaRealizado = dia,
            nota = ""
        )
    }
```

Esto imita lo que hará el ViewModel real: si hoy toca descansar y aun así se marca presente, se guarda la asistencia sin día.

Dejar `iniciarTiempo` como está por ahora; la Task 6 lo ajusta.

- [ ] **Step 5: Traducir los sitios de llamada de la UI**

Los cuatro ViewModels tienen que volver a exponer enteros, porque todavía nadie sabe pintar el descanso. La traducción es siempre la misma; se repite en cada archivo a propósito, para no crear una utilidad compartida que la Task 6 va a tener que deshacer.

En `TomarAsistenciaViewModel.kt`, `diaQueTocaPorCliente`:

```kotlin
    /** Día del ciclo que le toca a cada cliente en la fecha abierta. */
    val diaQueTocaPorCliente: StateFlow<Map<String, DiaQueToca>> =
        combine(clientesActivos, todasAsistencias) { clientes, asistencias ->
            val porCliente = asistencias.groupBy { it.clienteId }
            clientes.associate { cliente ->
                cliente.id to RutinaProgressCalculator.diaQueToca(
                    cliente, porCliente[cliente.id].orEmpty(), fecha
                )
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())
```

(Este flujo **no lo lee nadie hoy** — la pantalla solo usa `diaRealizadoPorCliente`. Por eso puede exponer el tipo nuevo directamente; la Task 6 lo empieza a consumir.)

Y el helper privado del mismo archivo, que sí alimenta escrituras:

```kotlin
    private fun diaQueToca(cliente: Cliente): DiaQueToca = RutinaProgressCalculator.diaQueToca(
        cliente, todasAsistencias.value.filter { it.clienteId == cliente.id }, fecha
    )

    /** El índice a escribir, o null si hoy no hay día que registrar. */
    private fun indiceQueToca(cliente: Cliente): Int? =
        (diaQueToca(cliente) as? DiaQueToca.Dia)?.indice
```

En `iniciarTiempo` (línea ~148), sustituir:

```kotlin
    fun iniciarTiempo(cliente: Cliente) {
        viewModelScope.launch {
            val dia = indiceQueToca(cliente) ?: return@launch
            asistenciaRepository.iniciarTiempo(
                clienteId = cliente.id,
                fecha = fecha,
                diaRutinaRealizado = dia,
                variacionRealizada = variacionQueToca(cliente, dia)
            )
            sincronizadorDiaWeb.refrescar(cliente.id, fecha)
        }
    }
```

En `guardarTodo` (línea ~180), sustituir la línea del día:

```kotlin
                        val dia = if (asistio) indiceQueToca(cliente) else null
```

En `ClienteDetailViewModel.kt:126`:

```kotlin
        if (c == null) 0 else when (val d = RutinaProgressCalculator.diaQueToca(c, asistencias)) {
            is DiaQueToca.Dia -> d.indice
            else -> 0
        }
```

En `ClientesListViewModel.kt:36-44`, dentro del `associate`:

```kotlin
                cliente.id to when (
                    val d = RutinaProgressCalculator.diaQueToca(
                        cliente, porCliente[cliente.id].orEmpty()
                    )
                ) {
                    is DiaQueToca.Dia -> d.indice
                    else -> 0
                }
```

En `SandboxViewModel.kt`, el flujo de la línea 56 igual que el anterior, y el helper de la línea 81:

```kotlin
    private fun diaQueTocaDe(cliente: Cliente): Int =
        (RutinaProgressCalculator.diaQueToca(
            cliente, todasAsistencias.value.filter { it.clienteId == cliente.id }
        ) as? DiaQueToca.Dia)?.indice ?: 0
```

Añadir `import com.osfit.app.domain.DiaQueToca` donde haga falta.

- [ ] **Step 6: Actualizar los dos tests que llaman al calculador directo**

`RutinaProgressCalculatorTest.kt` y `SincronizadorDiaWebTest.kt` no pasan por `EscenarioRutina`, así que sus aserciones comparan contra enteros. Envolver cada valor esperado:

- `assertEquals(2, RutinaProgressCalculator.diaQueToca(...))` → `assertEquals(DiaQueToca.Dia(2), RutinaProgressCalculator.diaQueToca(...))`
- Donde se esperaba `0` **por no haber rutina**, el esperado pasa a ser `DiaQueToca.SinRutina`. Donde se esperaba `0` **por la vuelta del ciclo**, sigue siendo `DiaQueToca.Dia(0)`. Distinguirlos leyendo el nombre del test; no son intercambiables.
- Lo mismo con `interpretar`.

Añadir `import com.osfit.app.domain.DiaQueToca` si el archivo está en otro paquete.

- [ ] **Step 7: Correr toda la suite**

Run: `./gradlew test`
Expected: PASS. **Ningún test debe haber cambiado de comportamiento esperado**, solo de representación. Si uno falla con un valor distinto del que tenía, la traducción de algún sitio de llamada está mal.

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/DiaQueToca.kt \
        app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt \
        app/src/test/java/com/osfit/app/domain/EscenarioRutina.kt \
        app/src/test/java/com/osfit/app/domain/RutinaProgressCalculatorTest.kt \
        app/src/test/java/com/osfit/app/domain/SincronizadorDiaWebTest.kt \
        app/src/main/java/com/osfit/app/ui/calendario/TomarAsistenciaViewModel.kt \
        app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt \
        app/src/main/java/com/osfit/app/ui/clientes/ClientesListViewModel.kt \
        app/src/main/java/com/osfit/app/ui/sandbox/SandboxViewModel.kt
git commit -m "refactor: el dia que toca es un tipo sellado, no un Int"
```

---

### Task 3: La regla del reinicio semanal en Kotlin

Aquí está el comportamiento nuevo. Es la tarea central del plan.

**Files:**
- Modify: `app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt`
- Modify: `app/src/main/java/com/osfit/app/data/fake/FakeClienteRepository.kt`
- Modify: `app/src/test/java/com/osfit/app/domain/EscenarioRutina.kt`
- Create: `app/src/test/java/com/osfit/app/domain/ReinicioSemanalTest.kt`
- Modify: `app/src/test/java/com/osfit/app/domain/AvanceDiaSecuenciaTest.kt`
- Modify: `app/src/test/java/com/osfit/app/domain/DiaDenormalizadoTest.kt`

**Interfaces:**
- Consumes: `SemanaDeRutina.domingoAnterior` y `lunesDe` (Task 1), `DiaQueToca` (Task 2).
- Produces:
  - `RutinaProgressCalculator.interpretar(valor, totalDias, fecha, reinicioSemanal: Boolean = false): DiaQueToca`
  - Cliente fake `"5"` "Elena", rutina de 5 días con `reinicioSemanal = true`
  - `EscenarioRutina.ELENA`, y las constantes `LUNES`, `MARTES`, `MIERCOLES`, `JUEVES`, `VIERNES`, `SABADO`, `LUNES_SIGUIENTE`

- [ ] **Step 1: Sembrar el cliente de prueba**

En `FakeClienteRepository.kt`, añadir el constructor de rutina junto a `rutinaDe3Dias`:

```kotlin
    /**
     * El caso que motivó el reinicio semanal: el primer día y el último trabajan pierna.
     * Con el ciclo rodante, una falta los deja en días consecutivos.
     */
    private fun rutinaDe5DiasConReinicio(nombre: String): Rutina = Rutina(
        id = "rutina-$nombre",
        nombre = nombre,
        reinicioSemanal = true,
        dias = listOf(
            DiaRutina(nombreDia = "Pierna (cuádriceps)", ejercicios = ejercicios("Sentadilla")),
            DiaRutina(nombreDia = "Espalda", ejercicios = ejercicios("Remo")),
            DiaRutina(nombreDia = "Pecho", ejercicios = ejercicios("Press")),
            DiaRutina(nombreDia = "Hombro y brazo", ejercicios = ejercicios("Press militar")),
            DiaRutina(nombreDia = "Pierna completa", ejercicios = ejercicios("Peso muerto"))
        )
    )
```

Y el cliente, después de Diego, dentro de `clientesIniciales`:

```kotlin
        // e. Rutina de 5 días con reinicio semanal, anclada al día 1 en la fecha de corte.
        //    Es el caso de "Mujeres básicos": día 1 y día 5 son pierna.
        Cliente(
            id = "5",
            nombre = "Elena Semana Completa",
            telefono = "555-0005",
            activo = true,
            rutinaAsignada = rutinaDe5DiasConReinicio("Elena"),
            plantillaOrigenId = "rutina-Elena",
            diaActualIndex = 0,
            diaAnclaFecha = RutinaProgressCalculator.FECHA_CORTE
        )
```

Subir el contador de ids para que no choque: `private val idCounter = AtomicInteger(6)`.

- [ ] **Step 2: Añadir las constantes al escenario**

En `EscenarioRutina.kt`, dentro del `companion object`, añadir:

```kotlin
        const val ELENA = "5"

        // Una semana real posterior a FECHA_CORTE: 2026-09-07 es lunes.
        const val LUNES = "2026-09-07"
        const val MARTES = "2026-09-08"
        const val MIERCOLES = "2026-09-09"
        const val JUEVES = "2026-09-10"
        const val VIERNES = "2026-09-11"
        const val SABADO = "2026-09-12"
        const val LUNES_SIGUIENTE = "2026-09-14"
```

Y actualizar el comentario de la clase añadiendo la línea:

```
 *  - "5" Elena — 5 días con reinicioSemanal, ancla día 1 en FECHA_CORTE
```

- [ ] **Step 3: Escribir los tests que fallan**

Crear `app/src/test/java/com/osfit/app/domain/ReinicioSemanalTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.domain.EscenarioRutina.Companion.ANA
import com.osfit.app.domain.EscenarioRutina.Companion.ELENA
import com.osfit.app.domain.EscenarioRutina.Companion.JUEVES
import com.osfit.app.domain.EscenarioRutina.Companion.LUNES
import com.osfit.app.domain.EscenarioRutina.Companion.LUNES_SIGUIENTE
import com.osfit.app.domain.EscenarioRutina.Companion.MARTES
import com.osfit.app.domain.EscenarioRutina.Companion.MIERCOLES
import com.osfit.app.domain.EscenarioRutina.Companion.SABADO
import com.osfit.app.domain.EscenarioRutina.Companion.VIERNES
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Rutina
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * El caso que originó la feature: la rutina de Elena empieza y termina con pierna, así que
 * el día 5 y el día 1 no pueden caer en días consecutivos.
 */
class ReinicioSemanalTest {

    @Test
    fun `la semana completa recorre los cinco dias`() = runBlocking {
        val e = EscenarioRutina()
        val fechas = listOf(LUNES, MARTES, MIERCOLES, JUEVES, VIERNES)

        fechas.forEachIndexed { indice, fecha ->
            assertEquals("día en $fecha", DiaQueToca.Dia(indice), e.estado(ELENA, fecha))
            e.marcar(ELENA, fecha, asistio = true)
        }

        assertEquals("el lunes siguiente vuelve al día 1", DiaQueToca.Dia(0), e.estado(ELENA, LUNES_SIGUIENTE))
    }

    @Test
    fun `faltar un dia deja la semana en el dia 4 y el dia 5 no se hace`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ELENA, LUNES, asistio = true)      // día 1
        e.marcar(ELENA, MARTES, asistio = true)     // día 2
        e.marcar(ELENA, MIERCOLES, asistio = false) // falta
        e.marcar(ELENA, JUEVES, asistio = true)     // día 3
        e.marcar(ELENA, VIERNES, asistio = true)    // día 4

        assertEquals("termina la semana en el día 4", DiaQueToca.Dia(3), e.estado(ELENA, VIERNES))
        assertEquals(
            "y el lunes empieza en el día 1, no en el 5",
            DiaQueToca.Dia(0),
            e.estado(ELENA, LUNES_SIGUIENTE)
        )
    }

    @Test
    fun `faltar el lunes no corre el dia uno, lo hace el martes`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ELENA, LUNES, asistio = false)

        assertEquals("el martes es su primera asistencia de la semana", DiaQueToca.Dia(0), e.estado(ELENA, MARTES))
    }

    @Test
    fun `con la semana completa el sabado toca descansar`() = runBlocking {
        val e = EscenarioRutina()
        listOf(LUNES, MARTES, MIERCOLES, JUEVES, VIERNES).forEach {
            e.marcar(ELENA, it, asistio = true)
        }

        assertEquals("ya hizo los cinco días", DiaQueToca.Descanso, e.estado(ELENA, SABADO))
    }

    /** Decisión consciente del spec, sección "Un caso aceptado a sabiendas". */
    @Test
    fun `con la semana incompleta el sabado sirve para recuperar el dia que falta`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ELENA, LUNES, asistio = true)
        e.marcar(ELENA, MARTES, asistio = true)
        e.marcar(ELENA, MIERCOLES, asistio = false)
        e.marcar(ELENA, JUEVES, asistio = true)
        e.marcar(ELENA, VIERNES, asistio = true)

        assertEquals("le queda el día 5 por hacer", DiaQueToca.Dia(4), e.estado(ELENA, SABADO))
    }

    @Test
    fun `asignar el dia a mano manda el resto de la semana y no mas alla`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ELENA, dia = 1, fecha = MIERCOLES)

        assertEquals("el miércoles hace el día asignado", DiaQueToca.Dia(1), e.estado(ELENA, MIERCOLES))
        e.marcar(ELENA, MIERCOLES, asistio = true)
        assertEquals("el jueves sigue desde ahí", DiaQueToca.Dia(2), e.estado(ELENA, JUEVES))
        assertEquals(
            "y el lunes el reinicio lo barre igual",
            DiaQueToca.Dia(0),
            e.estado(ELENA, LUNES_SIGUIENTE)
        )
    }

    /**
     * Los clientes anteriores a `FECHA_CORTE` no tienen ancla propia: `anclaDe` se la congela
     * en la fecha de corte. Esa fecha es de una semana muy anterior, así que el reinicio la
     * corre al domingo sin necesitar ningún tratamiento especial.
     */
    @Test
    fun `un cliente anterior al corte arranca en el dia 1 con reinicio semanal`() {
        val rutina = Rutina(
            id = "r",
            nombre = "Cinco días",
            reinicioSemanal = true,
            dias = (1..5).map { DiaRutina(nombreDia = "Día $it") }
        )
        val cliente = Cliente(
            id = "legacy",
            nombre = "Anterior al corte",
            rutinaAsignada = rutina,
            diaActualIndex = 3,
            diaAnclaFecha = null,
            diaPendienteIndex = 4,
            diaPendienteFecha = "2026-08-20"
        )

        assertEquals(
            "el día congelado no sobrevive al reinicio",
            DiaQueToca.Dia(0),
            RutinaProgressCalculator.diaQueToca(cliente, emptyList(), LUNES)
        )
    }

    /**
     * `cambiarDia` (Cloud Function) fecha el ancla AYER. Hecho en lunes, ayer es domingo, que
     * es exactamente la fecha del ancla del reinicio. La comparación es `>=` y no `>` para que
     * ese empate lo gane el cambio manual: si lo perdiera, la clienta cambiaría su día un lunes
     * y el cambio se evaporaría en el acto.
     */
    @Test
    fun `un cambio manual hecho en lunes sobrevive al reinicio de ese mismo lunes`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ELENA, dia = 2, fecha = LUNES)

        assertEquals("el ancla de domingo empata y gana", DiaQueToca.Dia(2), e.estado(ELENA, LUNES))
    }

    @Test
    fun `una rutina sin reinicio sigue dando la vuelta`() = runBlocking {
        val e = EscenarioRutina()
        // Ana tiene 4 días, sin reinicio semanal, y su ancla la deja en el día 2 (índice 1).
        e.marcar(ANA, LUNES, asistio = true)      // índice 1
        e.marcar(ANA, MARTES, asistio = true)     // índice 2
        e.marcar(ANA, MIERCOLES, asistio = true)  // índice 3, el último

        assertEquals("da la vuelta al primero", DiaQueToca.Dia(0), e.estado(ANA, JUEVES))
        assertEquals(
            "y el lunes siguiente sigue rodando, sin reiniciar",
            DiaQueToca.Dia(0),
            e.estado(ANA, LUNES_SIGUIENTE)
        )
    }
}
```

- [ ] **Step 4: Correr los tests y verificar que fallan**

Run: `./gradlew test --tests "com.osfit.app.domain.ReinicioSemanalTest"`
Expected: FAIL. En particular, `faltar un dia deja la semana en el dia 4` falla porque el lunes siguiente devuelve `Dia(4)` (el día 5) en vez de `Dia(0)`, que es exactamente el bug que se está arreglando. `con la semana completa el sabado toca descansar` falla devolviendo `Dia(0)`.

Los dos que sí deben pasar ya son `una rutina sin reinicio sigue dando la vuelta` y `un cambio manual hecho en lunes sobrevive` — el primero porque nada cambió para el ciclo rodante, el segundo porque sin la regla el ancla manda de todos modos. Que pasen antes de implementar está bien; lo que importa es que **sigan** pasando después.

- [ ] **Step 5: Implementar el ancla efectiva y el fin de la vuelta**

En `RutinaProgressCalculator.kt`, añadir después de `anclaDe`:

```kotlin
    /**
     * El ancla que manda de verdad hoy.
     *
     * Con [reinicioSemanal], nunca puede ser anterior al domingo pasado: eso es todo lo que
     * hace falta para que el día sea "la N-ésima asistencia de la semana", porque el ancla ya
     * es exclusiva y `diaQueToca` ya ignora todo lo anterior a ella.
     *
     * Un ancla manual de esta misma semana sobrevive la comparación y manda hasta el domingo,
     * que es cuando el corrimiento la barre sola. No hay nada que borrar ni que programar.
     */
    private fun anclaEfectiva(ancla: Ancla, hoy: String, reinicioSemanal: Boolean): Ancla {
        if (!reinicioSemanal) return ancla
        val domingo = SemanaDeRutina.domingoAnterior(hoy)
        return if (ancla.fecha >= domingo) ancla else Ancla(dia = 0, fecha = domingo)
    }
```

Reemplazar el cuerpo de `diaQueToca(cliente, asistenciasDelCliente, hoy)`:

```kotlin
    fun diaQueToca(cliente: Cliente, asistenciasDelCliente: List<Asistencia>, hoy: String): DiaQueToca {
        val rutina = cliente.rutinaAsignada ?: return DiaQueToca.SinRutina
        val totalDias = rutina.dias.size
        if (totalDias <= 0) return DiaQueToca.SinRutina

        val ancla = anclaEfectiva(anclaDe(cliente), hoy, rutina.reinicioSemanal)

        val ultima = asistenciasDelCliente
            .filter { it.clienteId == cliente.id || cliente.id.isEmpty() }
            .filter { it.asistio && it.diaRutinaRealizado != null }
            .filter { it.fecha > ancla.fecha && it.fecha <= hoy }
            .maxByOrNull { it.fecha }
            ?: return DiaQueToca.Dia(ancla.dia.coerceIn(0, totalDias - 1))

        val realizado = ultima.diaRutinaRealizado!!.coerceIn(0, totalDias - 1)
        return when {
            ultima.fecha == hoy -> DiaQueToca.Dia(realizado)
            rutina.reinicioSemanal && realizado + 1 >= totalDias -> DiaQueToca.Descanso
            else -> DiaQueToca.Dia(siguienteDia(realizado, totalDias))
        }
    }
```

Y actualizar el KDoc de la función para que no siga describiendo solo el ciclo rodante:

```kotlin
    /**
     * Día del ciclo que le toca al cliente en [hoy].
     *
     * Toma la asistencia más reciente posterior al ancla: si es de hoy, es el día que está
     * haciendo hoy; si es anterior, le toca el siguiente del ciclo. Las faltas guardan
     * `diaRutinaRealizado = null`, así que quedan fuera por construcción y no avanzan el ciclo.
     *
     * Con [com.osfit.app.data.model.Rutina.reinicioSemanal] cambian dos cosas: el ancla nunca
     * es anterior al domingo pasado (ver [anclaEfectiva]), y el ciclo no da la vuelta —después
     * del último día viene [DiaQueToca.Descanso], no el primero—. Juntas hacen que el día sea
     * la N-ésima asistencia de la semana.
     *
     * [asistenciasDelCliente] puede traer asistencias de cualquier fecha; se filtran aquí.
     */
```

- [ ] **Step 6: Reflejarlo en `denormalizar` e `interpretar`**

En `denormalizar`, reemplazar las dos primeras líneas y el cálculo del ancla:

```kotlin
    fun denormalizar(
        cliente: Cliente,
        asistenciasDelCliente: List<Asistencia>,
        hoy: String
    ): DiaDenormalizado {
        val rutina = cliente.rutinaAsignada ?: return DiaDenormalizado()
        val totalDias = rutina.dias.size
        if (totalDias <= 0) return DiaDenormalizado()

        val ancla = anclaEfectiva(anclaDe(cliente), hoy, rutina.reinicioSemanal)
```

El resto del cuerpo queda igual.

Y reemplazar `interpretar` entera:

```kotlin
    /**
     * Interpreta el trío de [denormalizar]. Es la referencia de las pocas líneas que corre la
     * web: si cambia acá, hay que cambiar `web/src/dia.ts`.
     *
     * El cruce de semana se decide **antes** que el ancla, porque con [reinicioSemanal] un
     * ancla de la semana pasada también tiene que reiniciarse.
     */
    fun interpretar(
        valor: DiaDenormalizado,
        totalDias: Int,
        fecha: String,
        reinicioSemanal: Boolean = false
    ): DiaQueToca {
        val dia = valor.dia ?: return DiaQueToca.SinRutina
        if (totalDias <= 0) return DiaQueToca.SinRutina
        val acotado = dia.coerceIn(0, totalDias - 1)
        val fechaValor = valor.fecha

        if (reinicioSemanal && fechaValor != null &&
            SemanaDeRutina.lunesDe(fechaValor) < SemanaDeRutina.lunesDe(fecha)
        ) return DiaQueToca.Dia(0)

        if (valor.esAncla) return DiaQueToca.Dia(acotado)
        if (fechaValor == fecha) return DiaQueToca.Dia(acotado)
        if (reinicioSemanal && acotado + 1 >= totalDias) return DiaQueToca.Descanso
        return DiaQueToca.Dia(siguienteDia(acotado, totalDias))
    }
```

- [ ] **Step 7: Pasarle `reinicioSemanal` al contrato gemelo**

En `DiaDenormalizadoTest.kt`, dentro de `assertEquivale`, reemplazar las líneas que calculan `totalDias` e `interpretado`:

```kotlin
        val rutina = cliente.rutinaAsignada
        val totalDias = rutina?.dias?.size ?: 0

        val valor = RutinaProgressCalculator.denormalizar(cliente, asistencias, hoy)
        val interpretado = RutinaProgressCalculator.interpretar(
            valor, totalDias, cuando, rutina?.reinicioSemanal ?: false
        )
```

Y añadir al final de la clase los tres casos del reinicio:

```kotlin
    @Test
    fun `con reinicio semanal el cruce de semana equivale`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ELENA, EscenarioRutina.VIERNES, asistio = true)
        assertEquivale(e, ELENA, hoy = EscenarioRutina.VIERNES, cuando = EscenarioRutina.LUNES_SIGUIENTE)
    }

    @Test
    fun `con reinicio semanal el descanso equivale`() = runBlocking {
        val e = EscenarioRutina()
        listOf(
            EscenarioRutina.LUNES, EscenarioRutina.MARTES, EscenarioRutina.MIERCOLES,
            EscenarioRutina.JUEVES, EscenarioRutina.VIERNES
        ).forEach { e.marcar(ELENA, it, asistio = true) }
        assertEquivale(e, ELENA, hoy = EscenarioRutina.VIERNES, cuando = EscenarioRutina.SABADO)
    }

    @Test
    fun `con reinicio semanal el ancla de la semana pasada equivale`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ELENA, dia = 2, fecha = EscenarioRutina.MIERCOLES)
        assertEquivale(e, ELENA, hoy = EscenarioRutina.MIERCOLES, cuando = EscenarioRutina.LUNES_SIGUIENTE)
    }
```

Añadir `import com.osfit.app.domain.EscenarioRutina.Companion.ELENA` al encabezado.

- [ ] **Step 8: Partir el test de la vuelta del ciclo**

En `AvanceDiaSecuenciaTest.kt`, el test `dias seguidos recorren el ciclo y dan la vuelta` afirma la vuelta para Beto (3 días, sin reinicio). **Sigue siendo cierto y no se toca** — pero hay que renombrarlo para que diga de qué modo habla, porque ahora hay dos:

```kotlin
    @Test
    fun `sin reinicio semanal los dias seguidos recorren el ciclo y dan la vuelta`() = runBlocking {
```

La contraparte —que con reinicio no da la vuelta— ya vive en `ReinicioSemanalTest`. Dejarlo anotado en el KDoc de la clase:

```kotlin
/**
 * Secuencias día a día sobre los repositorios en memoria.
 *
 * Todo lo de aquí es el **ciclo rodante**, el modo por defecto. El modo de reinicio semanal
 * vive en `ReinicioSemanalTest`.
 */
```

- [ ] **Step 9: Correr todo**

Run: `./gradlew test`
Expected: PASS. Los 9 tests nuevos de `ReinicioSemanalTest` en verde, los 3 nuevos de `DiaDenormalizadoTest` en verde, y **todos los anteriores sin cambios**.

- [ ] **Step 10: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/RutinaProgressCalculator.kt \
        app/src/main/java/com/osfit/app/data/fake/FakeClienteRepository.kt \
        app/src/test/java/com/osfit/app/domain/EscenarioRutina.kt \
        app/src/test/java/com/osfit/app/domain/ReinicioSemanalTest.kt \
        app/src/test/java/com/osfit/app/domain/AvanceDiaSecuenciaTest.kt \
        app/src/test/java/com/osfit/app/domain/DiaDenormalizadoTest.kt
git commit -m "feat: el ciclo de rutina se reinicia cada lunes con reinicioSemanal"
```

---

### Task 4: El gemelo en TypeScript

`dia.ts` tiene que decir lo mismo que Kotlin. No replica la lógica difícil: solo interpreta el trío.

**Representación:** en Kotlin el resultado es un tipo sellado; acá es la unión `number | null | "descanso"`. Se eligió así porque `null` ya significaba "no hay rutina" y la página necesita distinguirlo, y porque mantiene intactos los once tests que ya existen. Es la segunda divergencia deliberada entre los gemelos, y se documenta junto a la primera.

**Files:**
- Modify: `web/src/dia.ts`
- Modify: `web/src/dia.test.ts`

**Interfaces:**
- Consumes: `Rutina.reinicioSemanal?: boolean` (Task 1).
- Produces:
  - `lunesDe(fecha: string): string`
  - `DESCANSO` (constante `"descanso"`) y el tipo `DiaQueToca = number | null | typeof DESCANSO`
  - `interpretar(valor, totalDias, fecha, reinicioSemanal?): DiaQueToca`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final del `describe("interpretar", ...)` de `web/src/dia.test.ts`, y un `describe` nuevo para `lunesDe`:

```ts
  it("con reinicio semanal, una asistencia de la semana pasada vuelve al día 1", () => {
    // 2026-09-11 es viernes, 2026-09-14 el lunes siguiente.
    const valor = { dia: 3, fecha: "2026-09-11", esAncla: false };
    expect(interpretar(valor, 5, "2026-09-14", true)).toBe(0);
  });

  it("con reinicio semanal, un ancla de la semana pasada también vuelve al día 1", () => {
    const valor = { dia: 2, fecha: "2026-09-09", esAncla: true };
    expect(interpretar(valor, 5, "2026-09-14", true)).toBe(0);
  });

  it("con reinicio semanal, un ancla de esta semana manda", () => {
    const valor = { dia: 2, fecha: "2026-09-09", esAncla: true };
    expect(interpretar(valor, 5, "2026-09-10", true)).toBe(2);
  });

  it("con reinicio semanal, después del último día toca descansar", () => {
    // Día 5 hecho el viernes; el sábado ya no hay día.
    const valor = { dia: 4, fecha: "2026-09-11", esAncla: false };
    expect(interpretar(valor, 5, "2026-09-12", true)).toBe(DESCANSO);
  });

  it("con reinicio semanal, dentro de la semana avanza normal", () => {
    const valor = { dia: 1, fecha: "2026-09-08", esAncla: false };
    expect(interpretar(valor, 5, "2026-09-09", true)).toBe(2);
  });

  it("sin reinicio semanal nada cambia al cruzar la semana", () => {
    const valor = { dia: 3, fecha: "2026-09-11", esAncla: false };
    expect(interpretar(valor, 5, "2026-09-14")).toBe(4);
  });
});

describe("lunesDe", () => {
  it("el lunes es su propio lunes", () => {
    expect(lunesDe("2026-09-07")).toBe("2026-09-07");
  });

  it("el viernes pertenece a la semana que empezó el lunes", () => {
    expect(lunesDe("2026-09-11")).toBe("2026-09-07");
  });

  it("el domingo cierra su semana y no abre la siguiente", () => {
    expect(lunesDe("2026-09-13")).toBe("2026-09-07");
  });

  it("el lunes siguiente ya es otra semana", () => {
    expect(lunesDe("2026-09-14")).toBe("2026-09-14");
  });
});
```

Y cambiar el import de la primera línea del archivo:

```ts
import { DESCANSO, interpretar, lunesDe } from "./dia";
```

**No tocar ninguno de los once tests que ya existen.** Todos afirman el modo por defecto y tienen que seguir pasando letra por letra: son la prueba de que las rutinas de 3 y 6 días no cambian.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd web && npx vitest run src/dia.test.ts`
Expected: FAIL — `lunesDe` y `DESCANSO` no existen.

- [ ] **Step 3: Implementar**

Reemplazar `web/src/dia.ts` entero:

```ts
/**
 * Interpretación del trío que denormaliza la app Android.
 *
 * GEMELO: `RutinaProgressCalculator.interpretar` en Kotlin. Si cambia allá, cambia acá.
 * Toda la lógica difícil (ancla, historial, clientes anteriores al corte) queda del lado
 * de Kotlin a propósito: acá solo se interpreta el resultado.
 *
 * Dos diferencias deliberadas con el gemelo, las dos por la misma razón —la página necesita
 * distinguir casos que a Kotlin le daba igual colapsar:
 *  1. Sin rutina, Kotlin devuelve `SinRutina` y acá se devuelve `null`, porque la página elige
 *     qué tarjeta mostrar con eso.
 *  2. El descanso es el literal `DESCANSO` y no un tipo sellado, porque `null` ya estaba
 *     tomado por el caso anterior.
 */

/** Hoy no hay día que hacer: ya completó el ciclo de la semana. */
export const DESCANSO = "descanso" as const;

export type DiaQueToca = number | null | typeof DESCANSO;

export interface DiaDenormalizado {
  dia: number | null | undefined;
  fecha: string | null | undefined;
  esAncla: boolean | undefined;
}

/**
 * Lunes de la semana en la que cae [fecha].
 *
 * GEMELO: `SemanaDeRutina.lunesDe` en Kotlin.
 *
 * Construye la fecha a mediodía UTC y lee `getUTCDay`, igual que `esFinDeSemana`: con la hora
 * local, un navegador al este o al oeste de UTC puede caer en el día de al lado y responder
 * una semana distinta de la que responde Kotlin.
 */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  const diaSemana = d.getUTCDay(); // 0 = domingo
  const retroceso = diaSemana === 0 ? 6 : diaSemana - 1;
  d.setUTCDate(d.getUTCDate() - retroceso);
  return d.toISOString().slice(0, 10);
}

export function interpretar(
  valor: DiaDenormalizado,
  totalDias: number,
  fecha: string,
  reinicioSemanal = false
): DiaQueToca {
  // `== null` a proposito, no `===`: Firestore omite los campos que nunca se escribieron,
  // asi que un cliente anterior a la denormalizacion llega con `undefined` y no con `null`.
  // Con `===` se colaba hasta `Math.max(undefined, 0)`, que da NaN, y NaN tampoco lo
  // atrapaba el `indice === null` de quien llama: terminaba indexando `dias[NaN]`.
  if (valor.dia == null || totalDias <= 0) return null;
  const acotado = Math.min(Math.max(valor.dia, 0), totalDias - 1);

  // Antes que el ancla: con reinicio, un ancla de la semana pasada también se reinicia.
  if (reinicioSemanal && valor.fecha != null && lunesDe(valor.fecha) < lunesDe(fecha)) return 0;

  if (valor.esAncla) return acotado;
  if (valor.fecha === fecha) return acotado;
  if (reinicioSemanal && acotado + 1 >= totalDias) return DESCANSO;
  return acotado + 1 >= totalDias ? 0 : acotado + 1;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd web && npx vitest run src/dia.test.ts`
Expected: PASS — los 11 de antes más los 10 nuevos.

- [ ] **Step 5: Commit**

```bash
git add web/src/dia.ts web/src/dia.test.ts
git commit -m "feat: dia.ts interpreta el reinicio semanal, igual que su gemelo Kotlin"
```

---

### Task 5: La tarjeta de la web

Dos cosas: pasar `reinicioSemanal` al intérprete, y arreglar el "El lunes te toca X" del fin de semana, que ahora necesita preguntar por el lunes en vez de por hoy.

**Por qué el segundo cambio:** hoy la rama del fin de semana interpreta para **hoy** (sábado) y aprovecha que la vuelta del ciclo da el mismo número que daría el lunes. Con el reinicio semanal eso deja de valer: el sábado responde `DESCANSO`. Preguntar directamente por el próximo lunes es correcto en los dos modos y deja de depender de una coincidencia.

**Files:**
- Modify: `web/src/ui/tarjetaDia.ts`
- Modify: `web/src/ui/tarjetaDia.test.ts`

**Interfaces:**
- Consumes: `interpretar`, `lunesDe`, `DESCANSO` (Task 4); `Rutina.reinicioSemanal` (Task 1).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `web/src/ui/tarjetaDia.test.ts` (adaptar el armado del cliente al helper que ya use ese archivo; si no hay ninguno, construir el objeto literal como en los tests existentes):

```ts
  it("en sábado anuncia el día 1 de una rutina con reinicio semanal", () => {
    const cliente = {
      nombre: "Elena",
      plantillaOrigenId: "r",
      pesoPorEjercicio: {},
      rutinaAsignada: {
        id: "r",
        nombre: "Mujeres básicos",
        reinicioSemanal: true,
        dias: [
          { nombreDia: "Pierna (cuádriceps)", ejercicios: [] },
          { nombreDia: "Espalda", ejercicios: [] },
          { nombreDia: "Pecho", ejercicios: [] },
          { nombreDia: "Hombro y brazo", ejercicios: [] },
          { nombreDia: "Pierna completa", ejercicios: [] },
        ],
      },
      // Hizo el día 4 el viernes: le faltó uno, así que no llegó al 5.
      ultimoDia: 3,
      ultimoDiaFecha: "2026-09-11",
      ultimoDiaEsAncla: false,
    } as unknown as Cliente;

    const html = tarjetaDia(cliente, "2026-09-12"); // sábado

    expect(html).toContain("Hoy toca descansar");
    expect(html).toContain("Pierna (cuádriceps)");
    expect(html).not.toContain("Pierna completa");
  });

  it("sin reinicio semanal el sábado sigue anunciando lo de siempre", () => {
    const cliente = {
      nombre: "Jaime",
      plantillaOrigenId: "r",
      pesoPorEjercicio: {},
      rutinaAsignada: {
        id: "r",
        nombre: "Tres días",
        dias: [
          { nombreDia: "Pecho y espalda", ejercicios: [] },
          { nombreDia: "Hombro y brazo", ejercicios: [] },
          { nombreDia: "Pierna completa", ejercicios: [] },
        ],
      },
      ultimoDia: 2,
      ultimoDiaFecha: "2026-09-11",
      ultimoDiaEsAncla: false,
    } as unknown as Cliente;

    const html = tarjetaDia(cliente, "2026-09-12");

    expect(html).toContain("Hoy toca descansar");
    expect(html).toContain("Pecho y espalda");
  });
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd web && npx vitest run src/ui/tarjetaDia.test.ts`
Expected: FAIL — el primer test anuncia "Pierna completa" en vez de "Pierna (cuádriceps)", que es el choque visto desde la página.

- [ ] **Step 3: Implementar**

En `web/src/ui/tarjetaDia.ts`, cambiar el import de la línea 2:

```ts
import { DESCANSO, interpretar, lunesDe } from "../dia";
```

Añadir el helper justo debajo de `esFinDeSemana`:

```ts
/** El lunes de la semana que viene, para anunciar qué toca cuando hoy es fin de semana. */
function proximoLunes(fecha: string): string {
  const d = new Date(`${lunesDe(fecha)}T12:00:00`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}
```

Y reemplazar el bloque que va desde `const indice = interpretar(` hasta el `if (indice === null) return "";` inclusive:

```ts
  const reinicioSemanal = cliente.rutinaAsignada?.reinicioSemanal ?? false;
  const trio = {
    dia: cliente.ultimoDia,
    fecha: cliente.ultimoDiaFecha,
    esAncla: cliente.ultimoDiaEsAncla,
  };

  if (esFinDeSemana(hoy)) {
    // Se pregunta por el LUNES, no por hoy. Con el ciclo rodante daba lo mismo; con el
    // reinicio semanal, hoy responde DESCANSO y el lunes responde el día 1.
    const elLunes = interpretar(trio, dias.length, proximoLunes(hoy), reinicioSemanal);
    const proximo = typeof elLunes === "number" ? dias[elLunes]?.nombreDia ?? "" : "";
    return `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">😴</div>
        <p><strong>Hoy toca descansar</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">
          El lunes te toca ${escapar(proximo)}.
        </p>
      </div>`;
  }

  const indice = interpretar(trio, dias.length, hoy, reinicioSemanal);

  if (indice === DESCANSO) {
    return `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">😴</div>
        <p><strong>Hoy toca descansar</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">
          Ya completaste tu semana. El lunes empiezas de nuevo.
        </p>
      </div>`;
  }

  if (indice === null) return "";
```

- [ ] **Step 4: Correr los tests y el build**

Run: `cd web && npm test`
Expected: PASS, todo verde.

Run: `cd web && npm run build`
Expected: build limpio. `tsc` es quien verifica que ningún sitio se olvidó de contemplar `DESCANSO` en la unión.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/tarjetaDia.ts web/src/ui/tarjetaDia.test.ts
git commit -m "feat: la tarjeta de la web entiende el descanso del reinicio semanal"
```

---

### Task 6: Tomar Asistencia — "Semana completa"

El único lugar donde el descanso se ve de verdad: un sábado, en la app.

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/calendario/TomarAsistenciaScreen.kt:179-187, 346-390`
- Modify: `app/src/test/java/com/osfit/app/domain/EscenarioRutina.kt` (`iniciarTiempo`)
- Modify: `app/src/test/java/com/osfit/app/domain/ReinicioSemanalTest.kt`

**Interfaces:**
- Consumes: `TomarAsistenciaViewModel.diaQueTocaPorCliente: StateFlow<Map<String, DiaQueToca>>` (Task 2), `DiaQueToca.Descanso` (Task 3).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `ReinicioSemanalTest.kt`:

```kotlin
    @Test
    fun `marcar presente en un dia de descanso deja el registro sin dia y no mueve el ciclo`() = runBlocking {
        val e = EscenarioRutina()
        listOf(LUNES, MARTES, MIERCOLES, JUEVES, VIERNES).forEach {
            e.marcar(ELENA, it, asistio = true)
        }

        e.marcar(ELENA, SABADO, asistio = true)

        assertEquals("queda el registro de que vino", true, e.registro(ELENA, SABADO)?.asistio)
        assertEquals("pero sin día", null, e.registro(ELENA, SABADO)?.diaRutinaRealizado)
        assertEquals(
            "y el lunes sigue siendo el día 1",
            DiaQueToca.Dia(0),
            e.estado(ELENA, LUNES_SIGUIENTE)
        )
    }

    @Test
    fun `iniciar tiempo en un dia de descanso no registra nada`() = runBlocking {
        val e = EscenarioRutina()
        listOf(LUNES, MARTES, MIERCOLES, JUEVES, VIERNES).forEach {
            e.marcar(ELENA, it, asistio = true)
        }

        e.iniciarTiempo(ELENA, SABADO)

        assertEquals("no hay nada que cronometrar sin día", null, e.registro(ELENA, SABADO))
    }
```

Añadir el import de `assertNull` si se prefiere sobre `assertEquals(null, ...)`.

- [ ] **Step 2: Correr y verificar que falla**

Run: `./gradlew test --tests "com.osfit.app.domain.ReinicioSemanalTest"`
Expected: FAIL en el segundo test — `EscenarioRutina.iniciarTiempo` todavía llama al helper que revienta con `Descanso`.

(El primero ya debería pasar: la Task 2 dejó `marcar` tolerando el descanso. Si pasa, está bien — confirma que el camino de guardado quedó correcto desde entonces.)

- [ ] **Step 3: Alinear `iniciarTiempo` en el escenario**

En `EscenarioRutina.kt`, reemplazar `iniciarTiempo`:

```kotlin
    /** Botón "Iniciar tiempo". Sin día que hacer no hay nada que cronometrar. */
    suspend fun iniciarTiempo(id: String, fecha: String) {
        val dia = (estado(id, fecha) as? DiaQueToca.Dia)?.indice ?: return
        asistencias.iniciarTiempo(
            clienteId = id,
            fecha = fecha,
            diaRutinaRealizado = dia
        )
    }
```

Cuidado: el test existente `cliente sin rutina no rompe al iniciar tiempo` espera que Diego (sin rutina) **sí** quede registrado. `SinRutina` no es `Dia`, así que este `return` lo dejaría sin registro y ese test se pondría rojo. Mantenerlo verde tratando `SinRutina` como día 0, igual que hace el helper `diaQueToca`:

```kotlin
    suspend fun iniciarTiempo(id: String, fecha: String) {
        val dia = when (val d = estado(id, fecha)) {
            is DiaQueToca.Dia -> d.indice
            DiaQueToca.SinRutina -> 0
            DiaQueToca.Descanso -> return
        }
        asistencias.iniciarTiempo(clienteId = id, fecha = fecha, diaRutinaRealizado = dia)
    }
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `./gradlew test`
Expected: PASS, incluidos los dos nuevos y el de Diego.

- [ ] **Step 5: Mostrar "Semana completa" en la pantalla**

En `TomarAsistenciaScreen.kt`, leer el flujo junto a los demás (cerca de la línea 77):

```kotlin
    val diaQueTocaPorCliente by viewModel.diaQueTocaPorCliente.collectAsState()
```

En el `LazyColumn` de la pestaña Rutina (línea ~179), pasar el estado:

```kotlin
                    items(clientes, key = { it.id }) { cliente ->
                        val asistio = estadoPorCliente[cliente.id] ?: false
                        val diaRealizado = diaRealizadoPorCliente[cliente.id]
                        ClienteRutinaRow(
                            cliente = cliente,
                            asistio = asistio,
                            diaRealizado = diaRealizado,
                            semanaCompleta = diaQueTocaPorCliente[cliente.id] == DiaQueToca.Descanso,
                            onElegirDia = { diaElegido -> viewModel.marcarDiaRealizado(cliente, diaElegido) }
                        )
                    }
```

Y en `ClienteRutinaRow`, añadir el parámetro y la rama del texto:

```kotlin
@Composable
private fun ClienteRutinaRow(
    cliente: Cliente,
    asistio: Boolean,
    diaRealizado: Int?,
    semanaCompleta: Boolean,
    onElegirDia: (Int) -> Unit
) {
    var mostrarSelector by remember { mutableStateOf(false) }
    val dias = cliente.rutinaAsignada?.dias
    val editable = asistio && dias != null

    Card(
        onClick = { mostrarSelector = true },
        enabled = editable,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(cliente.nombre, style = MaterialTheme.typography.titleMedium)
            val texto = when {
                !asistio -> "Faltó"
                // Vino con la semana ya completa: no hay día sugerido, pero el entrenador
                // puede tocar la fila y elegir cuál hizo.
                diaRealizado == null && semanaCompleta -> "Semana completa"
                diaRealizado == null -> "Sin registrar"
                else -> {
                    val nombreDia = dias?.getOrNull(diaRealizado)?.nombreDia
                    if (nombreDia != null) "Día ${diaRealizado + 1}: $nombreDia" else "Asistió"
                }
            }
            Text(texto, style = MaterialTheme.typography.bodyMedium)
        }
    }
```

El resto de la función queda igual: el `SeleccionarDiaRealizadoDialog` ya existe y es el camino por el que el entrenador elige el día.

Añadir `import com.osfit.app.domain.DiaQueToca` al encabezado de la pantalla.

- [ ] **Step 6: Compilar y correr todo**

Run: `./gradlew assembleDebug`
Expected: compila.

Run: `./gradlew test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/calendario/TomarAsistenciaScreen.kt \
        app/src/test/java/com/osfit/app/domain/EscenarioRutina.kt \
        app/src/test/java/com/osfit/app/domain/ReinicioSemanalTest.kt
git commit -m "feat: Tomar Asistencia muestra Semana completa en el dia de descanso"
```

---

### Task 7: El switch del editor de rutinas

Lo último, porque hasta aquí no había forma de marcar una rutina desde la app.

**Esta tarea no lleva test automatizado, y conviene saber por qué.** `RutinaRepository` es una
clase concreta acoplada a `FirebaseFirestore`, no una interfaz, y `RutinaEditorViewModel`
resuelve sus dos dependencias desde `AppContainer` en los defaults del constructor. Construir
el ViewModel en un test unitario toca Firebase sin inicializar. Hacerlo testeable significa
extraer una interfaz de `RutinaRepository` y tocar todo lo que la usa, que es un refactor
ajeno a esta feature y merece su propia decisión.

Lo que se implementa aquí es una línea de estado (`copy`) y un `Switch` cableado a ella. La
verificación es el compilador y el punto 1 de la verificación manual. **No inventar un doble
del repositorio para simular una cobertura que no existe.**

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/rutinas/RutinaEditorViewModel.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/rutinas/RutinaEditorScreen.kt:49-57`

**Interfaces:**
- Consumes: `Rutina.reinicioSemanal` (Task 1).
- Produces: `RutinaEditorViewModel.cambiarReinicioSemanal(valor: Boolean)`

- [ ] **Step 1: Añadir el método al ViewModel**

En `RutinaEditorViewModel.kt`, justo después de `cambiarNombre`:

```kotlin
    /**
     * Tiene sentido solo en rutinas cuyo primer y último día trabajan la misma parte del
     * cuerpo, y eso la app no puede saberlo: el switch se muestra siempre y decide el
     * entrenador. Ver `docs/superpowers/specs/2026-09-21-reinicio-semanal-rutina-design.md`.
     */
    fun cambiarReinicioSemanal(valor: Boolean) {
        _rutina.value = _rutina.value.copy(reinicioSemanal = valor)
    }
```

No hace falta tocar `guardar()`: ya escribe `_rutina.value` entero, y `propagarASeguidoras`
copia `rutinaAsignada` completa a cada seguidora, así que el campo llega solo a las clientas.

- [ ] **Step 2: Poner el switch en la pantalla**

En `RutinaEditorScreen.kt`, añadir los imports que falten:

```kotlin
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Switch
import androidx.compose.ui.Alignment
```

Y añadir un `item` nuevo inmediatamente después del `item` del nombre de la rutina (el que
contiene el `OutlinedTextField` con label "Nombre de la rutina", alrededor de la línea 51):

```kotlin
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Reiniciar el ciclo cada lunes",
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Text(
                            "El último día solo se hace si viene la semana completa. " +
                                "Úsalo cuando el primer día y el último trabajan lo mismo.",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Switch(
                        checked = rutina.reinicioSemanal,
                        onCheckedChange = viewModel::cambiarReinicioSemanal
                    )
                }
            }
```

- [ ] **Step 3: Compilar**

Run: `./gradlew assembleDebug`
Expected: compila. Si `Column` o `Row` no estuvieran importados en ese archivo, añadirlos —
ambos ya lo están según el encabezado actual.

- [ ] **Step 4: Correr toda la suite, app y web**

Run: `./gradlew test`
Expected: PASS, toda la suite.

Run: `cd web && npm test && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 5: Cerrar la entrada del backlog**

En `docs/backlog.md`, en la entrada **"## 5. Rutina y semana incompleta"**, sustituir la línea
`Falta el plan de implementacion.` por el estado real: implementado, con el hash del commit, y
**lo que falta** — verificar en dispositivo, desplegar la web, y que el switch del editor no
tiene cobertura automatizada y por qué. No marcarla como HECHA hasta que la verificación
manual esté hecha: es la convención del archivo, y este plan termina sin haber visto correr
nada en un dispositivo real.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/rutinas/RutinaEditorViewModel.kt         app/src/main/java/com/osfit/app/ui/rutinas/RutinaEditorScreen.kt         docs/backlog.md
git commit -m "feat: switch de reinicio semanal en el editor de rutinas"
```

---

## Verificación manual, después del plan

El plan termina con todo en verde, pero nada de esto se ha visto correr. Antes de darlo por cerrado:

1. **En la app:** abrir una rutina de 5 días, activar el switch, guardar, y comprobar en Firestore que el documento tiene `reinicioSemanal: true`.
2. **El caso original:** en una clienta con esa rutina, marcar asistencia lunes y martes, falta el miércoles, asistencia jueves y viernes. Confirmar que el viernes dice **Día 4** y que el lunes siguiente dice **Día 1**, no Día 5.
3. **El sábado:** confirmar que Tomar Asistencia muestra "Semana completa" para quien vino los cinco días, y que tocando la fila se puede elegir el día igualmente.
4. **En la web:** con la página de esa clienta abierta un sábado, confirmar que dice "Hoy toca descansar" y **"El lunes te toca Pierna (cuádriceps)"**. Es el punto donde se ve que el choque desapareció.
5. **Una rutina sin el switch:** confirmar que una de 3 días sigue dando la vuelta exactamente como antes. Es la garantía de que nada se rompió para el resto de los clientes.
