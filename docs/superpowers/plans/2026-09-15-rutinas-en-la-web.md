# Rutinas en la web — ejercicios, rutina propia y variaciones

> **For agentic workers:** Las tareas van en orden. Una a la vez, terminada por completo (incluido su commit) antes de empezar la siguiente. Steps usan checkbox (`- [ ]`) para tracking.

**Goal:** Que la página de la clienta muestre los ejercicios del día de hoy; que el entrenador pueda sacar a una clienta de la plantilla compartida y editarle la rutina solo a ella; y que cada día del ciclo pueda tener variaciones que roten solas vuelta a vuelta.

**Architecture:** Nada de esto necesita backend nuevo. No hay functions nuevas, `firestore.rules` **no cambia**, y no hay migración: la clienta ya lee su documento entero y los ejercicios ya viajan al navegador. El trabajo es (a) pintar lo que ya llega, (b) dos campos nuevos en modelos existentes, (c) un calculador puro con gemelo en TypeScript, y (d) UI de edición en la app.

**Tech Stack:** Kotlin + Jetpack Compose, Firebase Firestore + Hosting, sitio en Vite + TypeScript sin framework, Vitest para TS, JUnit4 para Kotlin.

**Spec:** `docs/superpowers/specs/2026-09-15-rutinas-en-la-web-design.md`. **Léelo completo antes de tocar código** — este plan explica *qué* escribir, el spec explica *por qué*, y varias decisiones parecen arbitrarias hasta que ves el motivo. En particular la sección "Lo que este spec revierte, a propósito": esta feature revierte una decisión explícita del spec del 2026-09-10, y eso no es un descuido.

## Global Constraints

- **Idioma:** código, nombres de variables, comentarios y nombres de test **en español**. Mensajes de commit **en inglés**. Ver `GEMINI.md`.
- **Comentarios:** solo explican el *porqué* de decisiones no obvias, nunca repiten lo que el código ya dice.
- **Firestore:** todo `data class` necesita valor por defecto en **todos** los campos. El `id` no se guarda dentro del documento.
- **Repositorios:** clases planas, no interfaces. Cada uno tiene su gemelo en `data/fake/` y **hay que actualizarlo también**.
- **ViewModels:** reciben repositorios por constructor con `AppContainer.xxx` como valor por defecto.
- **Tests Kotlin:** JUnit4, nombres en backticks y en español. Solo para `domain/` y `video/`.
- **Tests TS:** Vitest, `npm test` dentro de `web/`.
- **Proyecto Firebase:** `osfit-cccfe`.
- **Desplegar compilando a mano antes** — `firebase.json` no tiene hooks de `predeploy`; sin eso se sube el `dist` viejo y parece que el despliegue no sirvió (backlog 17).
- **Commits:** uno por tarea, en inglés, terminando con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## Tres cosas que el spec no fija y hay que decidir acá

Se anotan arriba y no escondidas dentro de una tarea, porque la primera es una trampa que se traga datos en silencio.

### 1. `registrarAsistencia` borra todo campo que no se nombre

`FirestoreAsistenciaRepository.registrarAsistencia` construye un `Asistencia(...)` **desde cero** y hace `set()`. No es un `copy()`. Todo campo que no aparezca en esa lista se pierde en cada marcada. El archivo ya lleva dos comentarios avisándolo, uno de ellos porque perder la bandera *"le regalaría al cliente el revive que ya gastó"*.

`variacionRealizada` entra en esa lista o se borra cada vez que el entrenador vuelve a marcar la asistencia del día — y el síntoma sería que la rotación se reinicia sola, de noche, sin que nadie lo relacione con la remarcada.

Se sigue el patrón que el archivo ya usa para `diaRutinaRealizado` en `iniciarTiempo`: **se respeta lo ya guardado, y el parámetro solo se usa si no había nada.**

```kotlin
variacionRealizada = if (asistio) (existente?.variacionRealizada ?: variacionRealizada) else null,
```

Los **tres** caminos que escriben el día tienen que tratar la variación, no solo el primero:

| Camino | Qué hace hoy | Qué tiene que hacer |
|---|---|---|
| `registrarAsistencia` | `set()` completo | Nombrar el campo, con la regla de arriba |
| `iniciarTiempo` | `copy()` sobre lo existente | Poner la variación al crear; preservarla si ya había |
| `actualizarDiaRealizado` | `update("diaRutinaRealizado", n)` | **Recalcular la variación**: la guardada era del día viejo |

El tercero es el sutil. Corregir el día realizado deja una variación que pertenece a otro día, y a partir de ahí la rotación de los dos días queda mal. La firma gana un parámetro y el llamador pasa la variación recalculada.

### 2. La variación se calcula fuera del repositorio y se pasa

El repositorio no conoce la rutina del cliente ni su historial, y darle acceso lo convertiría en otra cosa. El ViewModel ya tiene las dos cosas, así que calcula con `VariacionCalculator` y pasa el entero. El repositorio solo persiste.

### 3. El orden de los bloques es por qué se puede desplegar solo

- **Bloque A** (los ejercicios en la página) sirve tal cual, sin nada de lo demás: hay clientas en plantillas que ya tienen ejercicios cargados y los verían el mismo día. Se despliega solo.
- **Bloque B** (rutina propia y edición) es solo app, no toca la web, no necesita despliegue.
- **Bloque C** (variaciones) es lo caro y lo último. Si hay que cortar algo, se corta esto y los bloques A y B siguen en pie.

---

## Bloque A — Los ejercicios en la página

### Task 1: `tarjetaDia` lista los ejercicios del día

**Archivos:** `web/src/ui/tarjetaDia.ts`, `web/src/ui/tarjetaDia.test.ts` (nuevo), `web/src/estilos.css`

- [ ] **Borrar el comentario de las líneas 24-29.** Dice hoy exactamente lo contrario de lo que la función va a hacer (*"muestra solo el nombre del día, nunca los ejercicios... Ver el spec, sección 'Por qué la página no muestra los ejercicios'"*). Reemplazarlo por uno que apunte a `docs/superpowers/specs/2026-09-15-rutinas-en-la-web-design.md` y diga que esa decisión fue revertida el 2026-09-15. Si se deja, el siguiente que lo lea va a quitar la lista creyendo que es un error.
- [ ] Escribir los tests primero, en `tarjetaDia.test.ts`. Cuatro estados, en este orden de precedencia (el spec los fija):
  - `` `fin de semana no lista ejercicios aunque el día los tenga` `` — el estado "hoy toca descansar" manda.
  - `` `sin rutina asignada sigue mostrando la tarjeta de siembra` `` — el 🌱 actual, sin cambios.
  - `` `día sin ejercicios explica que el entrenador no los cargó` `` — el caso mayoritario: la mayoría de las rutinas hoy no traen ejercicios. Texto: "Tu entrenador todavía no cargó los ejercicios de este día."
  - `` `día con ejercicios los lista con series, repeticiones y nota` `` — los cuatro campos.
  - `` `el texto del ejercicio se escapa` `` — meter `<script>` y comillas en `nombre` y en `pesoONota`, verificar que sale escapado.
- [ ] **Expected: FAIL.** Correr `npm test` dentro de `web/` y confirmarlo antes de implementar.
- [ ] Implementar. De cada ejercicio se muestran **nombre, series, repeticiones y `pesoONota`** (decisión del entrenador el 2026-09-15). Todo pasa por `escapar()`, que ya está en ese archivo: `pesoONota` es texto libre y termina dentro del HTML.
- [ ] Estilos en `estilos.css`, usando las variables de la paleta que ya existen (`--texto-tenue` y compañía). Nada de colores fijos: la paleta se la asigna el entrenador por clienta.
- [ ] `npm test` en verde. Commit.

**No toca `datos.ts`:** `Ejercicio`, `DiaRutina` y `Rutina` ya están declarados ahí con los cuatro campos, y `Cliente.rutinaAsignada` ya se lee. No hay nada que agregar a la capa de datos.

### Task 2: Desplegar el bloque A

- [ ] `cd web && npm ci && npm run build`
- [ ] `firebase deploy --only hosting` — solo hosting: no se tocaron functions ni reglas.
- [ ] Abrir la página de una clienta que tenga ejercicios cargados y ver la lista. Abrir la de una que no, y ver el texto de "todavía no los cargó".
- [ ] **Avisarle al entrenador que `pesoONota` dejó de ser privado.** El spec lo marca como riesgo aceptado, pero aceptarlo por escrito no es lo mismo que que él lo sepa el día que sus notas ("bajarle, se lastimó") aparecen en la pantalla de la clienta. Este paso no se salta.

> **Si el backlog 17 sigue sin desplegar cuando llegues acá**, este despliegue se lleva también el esqueleto de carga y el caché persistente, que están en `main` sin desplegar desde el 2026-09-15. No es un problema —son cambios de `web/` igual— pero conviene saber que van juntos y verificar los dos.

---

## Bloque B — Rutina propia y edición por cliente

### Task 3: La sección Rutina dentro de la tarjeta Web

**Archivos:** `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`

Solo lectura en esta tarea. Editar viene en la siguiente.

- [x] Dentro de la tarjeta **Acceso web** (arranca en la línea 375), agregar una sección **Rutina**. El criterio de qué va en esta tarjeta es *todo lo que la clienta ve en su página*, y la rutina ahora lo es.
- [x] Mostrar de dónde sale la rutina, con los **tres** estados que el spec separa:
  - `plantillaOrigenId` vacío → "Rutina propia".
  - Con valor y la plantilla existe → "Sigue la plantilla «Fuerza 3 días»".
  - Con valor y la plantilla **no** existe → "⚠ La plantilla que seguía ya no existe. Está usando la última copia."
  
  Hoy los dos últimos casos se ven igual, porque `plantillas.firstOrNull { it.id == plantillaOrigenId }` (línea 188) devuelve `null` en ambos y el `?:` cae a la copia sin decir nada. Con esta feature la diferencia importa: uno es normal y el otro es un aviso.
- [x] Listar los días del ciclo, plegables, con el de hoy marcado, y dentro de cada uno sus ejercicios.
- [x] **No duplicar la tarjeta "Rutina asignada"** que ya existe en la línea 182. Esa responde *qué rutina tiene y qué día le toca*; ésta responde *qué ejercicios ve la clienta*. Las dos se quedan, y el botón de WhatsApp de la vieja también — sigue sirviendo para quien pide la rutina sin abrir la página.
- [x] Compilar (`./gradlew assembleDebug`). Commit.

### Task 4: Editar los ejercicios de un cliente, y desprenderse de la plantilla

**Archivos:** `ClienteDetailScreen.kt`, `ClienteDetailViewModel.kt`, `FirestoreClienteRepository.kt`, `ClienteRepository.kt`, `FakeClienteRepository.kt`, `ui/rutinas/RutinaEditorScreen.kt`

- [ ] **Extraer `EjercicioRow`** de `RutinaEditorScreen.kt:102` a un componente compartido (p. ej. `ui/common/EjercicioRow.kt`) y dejar de tenerlo `private`. Es exactamente el editor de ejercicio que hace falta acá y reescribirlo sería tener dos que se separan con el tiempo.
- [ ] Botón **Editar** por día en la sección Rutina: agregar, quitar, reordenar y modificar ejercicios.
- [ ] **El diálogo de desprenderse.** Si el cliente sigue una plantilla, antes de guardar la primera edición:

  > Jaime va a dejar de seguir la plantilla «Fuerza 3 días». Los cambios que le hagas a la plantilla ya no le van a llegar.
  > `[Cancelar]` `[Entiendo]`

  Va antes y no callado porque el efecto no se nota hasta semanas después, cuando el entrenador edite la plantilla y se pregunte por qué a Jaime no le llegó.
- [ ] Al aceptar: congelar **la plantilla viva** en `rutinaAsignada` (la viva, no la copia guardada, que puede tener meses) y **borrar `plantillaOrigenId`**. Nada más.
- [ ] **No se agrega ningún campo de "modo".** `plantillaOrigenId` ya discrimina los dos casos y un booleano aparte sería una segunda fuente de verdad capaz de contradecir a la primera. El `?:` de la línea 188 ya cae a `rutinaAsignada` cuando el campo está vacío, así que el camino de lectura ya hace lo correcto sin tocarlo.
- [ ] **No tocar `diaActualIndex` ni `diaAnclaFecha`.** El día del ciclo y el origen de la rutina son cosas distintas; moverlo acá le cambiaría el día al cliente sin motivo.
- [ ] Método nuevo en el repositorio (y en el fake). Compilar. Commit.

### Task 5: Confirmar antes de reasignar plantilla a quien tiene rutina propia

**Archivos:** `ClienteDetailScreen.kt`

- [ ] `asignarRutina` sobreescribe `rutinaAsignada` entero y resetea `diaActualIndex`/`diaAnclaFecha`. Asignarle una plantilla a alguien con rutina propia **le borra sus ejercicios personalizados y, más adelante, sus variaciones, sin vuelta atrás.** Hoy no confirma nada porque no había nada que perder.
- [ ] Pedir confirmación **solo** cuando `plantillaOrigenId` está vacío. Para todos los demás el flujo se queda exactamente como está: no se le agrega fricción al caso normal.
- [ ] Compilar. Commit.

---

## Bloque C — Variaciones

### Task 6: `VariacionDia` y `DiaRutina.variaciones`

**Archivos:** `data/model/VariacionDia.kt` (nuevo), `data/model/DiaRutina.kt`, `domain/EjerciciosDelDia.kt` (nuevo), `app/src/test/java/com/osfit/app/domain/EjerciciosDelDiaTest.kt` (nuevo)

```kotlin
data class VariacionDia(
    val ejercicios: List<Ejercicio> = emptyList()
)

data class DiaRutina(
    val nombreDia: String = "",
    val ejercicios: List<Ejercicio> = emptyList(),      // igual que hoy
    val variaciones: List<VariacionDia> = emptyList()   // nuevo
)
```

- [x] `VariacionDia` existe **porque Firestore no admite arreglos anidados**: un `List<List<Ejercicio>>` no se puede guardar. Envolver cada variación en un objeto la convierte en un arreglo de mapas, que sí. Dejarlo escrito en un comentario, o alguien lo va a "simplificar".
- [x] Función pura `ejerciciosDe(dia: DiaRutina, variacion: Int): List<Ejercicio>` en `domain/`, que aplica el invariante: `variaciones` vacía → `ejercicios`; si no → `variaciones[variacion]`, acotando el índice.
- [x] Tests primero, **Expected: FAIL**, después implementar:
  - `` `sin variaciones devuelve la lista base` ``
  - `` `con variaciones devuelve la de su índice` ``
  - `` `un índice fuera de rango se acota en vez de reventar` `` — un documento puede quedar con más variaciones de las que tenía cuando se calculó.
- [x] `./gradlew test` en verde. Commit.

**Invariante, y hay que respetarlo al escribir:** exactamente una de las dos listas está llena. Al crear la **primera** variación de un día se mueve `ejercicios` a `variaciones[0]` y se **vacía** `ejercicios`; al borrar la última, el camino inverso. Se vacía en vez de dejarla ahí porque una lista que ya nadie lee se queda vieja en silencio y el siguiente que la mire va a creerle.

### Task 7: `Asistencia.variacionRealizada` y los tres caminos de escritura

**Archivos:** `data/model/Asistencia.kt`, `data/repository/AsistenciaRepository.kt`, `FirestoreAsistenciaRepository.kt`, `data/fake/FakeAsistenciaRepository.kt`

- [ ] `val variacionRealizada: Int? = null` en `Asistencia`, junto a `diaRutinaRealizado`. Comentario: es el **registro de lo que pasó**, no un contador mutable — la misma naturaleza que `diaRutinaRealizado`, que ya vive ahí.
- [ ] Los tres caminos, según la tabla de la sección "Tres cosas que el spec no fija" de arriba. **Releerla antes de escribir**: el primero se traga el campo en silencio si se olvida, y el tercero deja la variación de un día pegada a otro.
- [ ] `actualizarDiaRealizado` gana el parámetro de la variación recalculada.
- [ ] Actualizar `FakeAsistenciaRepository` con los mismos tres cambios. Si se queda atrás, los tests prueban un comportamiento que la app real no tiene.
- [ ] Compilar. Commit.

### Task 8: `VariacionCalculator`

**Archivos:** `domain/VariacionCalculator.kt` (nuevo), `app/src/test/java/com/osfit/app/domain/VariacionCalculatorTest.kt` (nuevo)

Espejo de `RutinaProgressCalculator.diaQueToca`: mira la **última** asistencia a ese día del ciclo y avanza una posición.

```
variacionQueToca(dia, asistencias, hoy, total):
    si total <= 1: 0
    ultima = la asistencia mas reciente con
                 asistio == true
                 diaRutinaRealizado == dia
                 fecha <= hoy
    si no hay ultima:        0              # nunca ha hecho este dia
    v = ultima.variacionRealizada ?: 0
    si ultima.fecha == hoy:  v              # ya entreno hoy: se queda en la que hizo
    si no:                   (v + 1) % total
```

- [ ] Tests primero, **Expected: FAIL**. Mirar `RutinaProgressCalculatorTest.kt` y `EscenarioRutina.kt` para el estilo y reutilizar los helpers de escenario:
  - `` `sin asistencias previas toca la primera variación` ``
  - `` `la siguiente vuelta avanza una posición` ``
  - `` `después de la última vuelve a la primera` ``
  - `` `si ya entrenó hoy se queda en la variación que hizo` `` — **el importante**: la clienta abre su página en la mañana, el entrenador le marca asistencia, y la página no debe saltarle a otros ejercicios mientras entrena.
  - `` `una falta no avanza la variación` `` — las faltas guardan `diaRutinaRealizado = null` y quedan fuera del filtro por construcción, igual que no avanzan el día.
  - `` `una asistencia sin variacionRealizada cuenta como la primera` `` — todo lo anterior a esta feature llega sin el campo.
  - `` `cada día del ciclo rota por su cuenta` `` — el Día 1 puede tener 3 variaciones y el Día 2 ninguna.
  - `` `si se quitan variaciones el índice se acota` ``
- [ ] `./gradlew test` en verde. Commit.

**Por qué mira la última y no cuenta las ocurrencias** (está argumentado en el spec, resumen para quien implemente): contar rompe si alguien hace la entrada 17c del backlog —acotar `observarAsistencias` a 12 meses le movería la variación a todo el mundo en silencio—, y contar se recorre entero si corriges una asistencia vieja. Mirar la última es inmune a las dos cosas y tiene la misma forma que `diaQueToca`.

### Task 9: Escribir la variación al marcar asistencia

**Archivos:** los ViewModels que llaman a `registrarAsistencia`, `iniciarTiempo` y `actualizarDiaRealizado`

- [ ] Localizarlos con `grep -rn "registrarAsistencia\|iniciarTiempo\|actualizarDiaRealizado" --include=*.kt app/src/main/java`. Son varios: Tomar Asistencia, el cronómetro y la corrección desde la pestaña Rutina.
- [ ] Cada uno calcula con `VariacionCalculator.variacionQueToca(...)` **antes** de escribir y pasa el entero. El repositorio no conoce la rutina ni el historial y no debe conocerlos.
- [ ] Compilar. Commit.

### Task 10: UI de variaciones en la tarjeta Web

**Archivos:** `ClienteDetailScreen.kt`, `ClienteDetailViewModel.kt`, repositorio de clientes y su fake

- [ ] Dentro de cada día de la sección Rutina, **solo si el cliente está en rutina propia**: sus variaciones con sus ejercicios, y cuál le toca hoy a esta clienta.
- [ ] Botones **Agregar variación** y **Quitar variación**, aplicando el invariante del Task 6 (la primera mueve `ejercicios` a `variaciones[0]` y vacía `ejercicios`; borrar la última hace el camino inverso).
- [ ] En modo plantilla compartida, las variaciones **no se ofrecen**. El spec las deja fuera de las plantillas a propósito: con una plantilla compartida habría que decidir si Ana y Jaime rotan juntos o por separado, y las dos respuestas se defienden. El editor de la pestaña Rutinas **no se toca en toda esta feature**.
- [ ] Compilar. Commit.

### Task 11: El gemelo en TypeScript, y la variación en la página

**Archivos:** `web/src/variacion.ts` (nuevo), `web/src/variacion.test.ts` (nuevo), `web/src/datos.ts`, `web/src/ui/tarjetaDia.ts`, `web/src/main.ts`

- [ ] `web/src/variacion.ts` con la misma lógica del Task 8 y el comentario **GEMELO** que ya lleva `web/src/dia.ts`: *"Si cambia allá, cambia acá."*
- [ ] En `datos.ts`: `variaciones?: VariacionDia[]` en `DiaRutina` y `variacionRealizada?: number | null` en `Asistencia`. **Opcionales a propósito**, con el comentario que ese archivo ya usa dos veces: Firestore omite los campos que nunca se escribieron, así que todo lo anterior a esta feature llega con `undefined` y no con `null`. Usar `== null`, no `===`, por la misma razón que está documentada en `dia.ts` (con `===` se coló un `NaN` hasta indexar `dias[NaN]`).
- [ ] `tarjetaDia` gana el parámetro de asistencias para poder resolver la variación. Actualizar la llamada en `main.ts`.
- [ ] **Esto no se denormaliza al documento del cliente**, a diferencia del día. El día se denormalizó porque su cálculo es difícil (ancla, `FECHA_CORTE`, clientes viejos) y no valía la pena reescribirlo en la web. La variación es una búsqueda del máximo sobre asistencias que la web **ya tiene descargadas** con `observarAsistencias`, así que denormalizarla solo agregaría un campo capaz de quedar viejo, sin ahorrar nada.
- [ ] Tests de `variacion.ts` espejo de los del Task 8, más uno de `tarjetaDia` que verifique que lista los ejercicios de la variación que toca y no los de la primera.
- [ ] `npm test` en verde. Commit.

### Task 12: Desplegar el bloque C

- [ ] `cd web && npm ci && npm run build`
- [ ] `firebase deploy --only hosting`
- [ ] Compilar e instalar la app. **Ojo con la entrada 11 del backlog**: si se instala una build `debuggable` el generador de video se vuelve 25 veces más lento. Para esta feature no importa (no toca el video), pero si de paso se va a generar alguno, instalar una release firmada y correr `adb shell cmd package compile -m speed -f com.osfit.app` después.

---

## Cierre

### Task 13: Verificación en dispositivo

No se puede cubrir con tests: la rotación depende de asistencias reales en días reales, y la UI es Compose, que la suite no prueba.

- [ ] Crear una clienta de prueba, o usar una real **dejándola como estaba al terminar** (misma advertencia que U1 en el backlog: esto le mueve la rutina de verdad).
- [ ] Sacarla de la plantilla y comprobar que el diálogo aparece, que al aceptar queda en "Rutina propia", y que **editar la plantilla ya no le llega**.
- [ ] Ponerle 2 variaciones a un día y hacer la vuelta completa: marcar asistencia a ese día, ver que la página muestra la variación A; al siguiente ciclo, la B; al siguiente, la A otra vez.
- [ ] **Que la variación no salte a media jornada.** Abrir la página, marcarle asistencia desde la app con la página abierta, y verificar que los ejercicios **no cambian**. Es lo que protege la rama `ultima.fecha == hoy` y es el fallo que la clienta sí notaría.
- [ ] Marcar una **falta** en un día con variaciones y comprobar que la próxima vez le toca la misma variación, no la siguiente.
- [ ] **Corregir el día realizado** de una asistencia desde la pestaña Rutina y comprobar que la variación se recalcula para el día nuevo. Es el camino del Task 7 que más fácil se queda sin probar.
- [ ] Reasignarle una plantilla y comprobar que **pide confirmación** y que al aceptar se pierden las variaciones (que es lo esperado, y por eso confirma).
- [ ] Abrir la página **desde WhatsApp**, que es como entran las clientas de verdad, no desde Chrome de escritorio.
- [ ] Anotar en `docs/backlog.md` lo que quede pendiente, siguiendo la convención del archivo (una entrada nunca se borra; se marca `✅ HECHO (fecha)` con qué se verificó).
