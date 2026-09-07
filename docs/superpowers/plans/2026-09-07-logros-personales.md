# Logros personales por cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Si estás ejecutando esto como Gemini** (o cualquier agente sin las skills de superpowers): ignora la línea de arriba y lee `GEMINI.md` en la raíz del repo. Ejecuta las tareas **en orden, una a la vez**, respetando el ciclo test→fail→implement→pass→commit de cada una.

**Goal:** Que el entrenador pueda otorgar manualmente uno o varios "logros personales" a cada cliente en su resumen quincenal, mostrarlos en una escena nueva del video (hasta 3 por escena) y conservarlos como historial en el perfil.

**Architecture:** Espejo del sistema de medallas ya existente — catálogo en Firestore (`logrosPersonales`) + historial denormalizado por cliente (`clientes/{id}/logrosPersonales`), repositorio propio registrado en `AppContainer`, pantalla de catálogo en el drawer, pantalla de historial por cliente, diálogo de confirmación encadenado después del de medalla en el flujo quincenal, y una escena `EscenaResumen.LogrosPersonales` dibujada con el mismo Canvas que la medalla. Tres diferencias deliberadas contra las medallas: varios por quincena (doc id compuesto `<rangoInicio>_<logroId>`), cero automatismo (sin ranking ni sugerencia) y agrupación de a 3 por escena de video.

**Tech Stack:** Kotlin, Jetpack Compose (Material3), Firebase Firestore, Android `Canvas`/`MediaCodec` (pipeline de video existente), JUnit4 para tests de dominio y timeline.

**Spec:** `docs/superpowers/specs/2026-09-07-logros-personales-design.md`

## Global Constraints

- **Sólo el resumen quincenal.** Semanal y mensual no cambian en ningún aspecto: ni otorgan logros ni muestran la escena.
- **Cero automatismo.** No existe `LogroPersonalCalculator`, no hay sugerencia, no hay siembra de catálogo. El catálogo arranca vacío y el entrenador lo llena.
- **Máximo 3 logros por escena de video.** Si se otorgan más, se agregan escenas adicionales (`chunked(3)`). Ningún logro otorgado queda fuera del video.
- **Los mensajes de los logros sólo se dibujan cuando la escena trae UN solo logro.** Con 2 o 3 no caben legibles.
- **`$nombrePersona`** en el campo `mensaje` se reemplaza por el nombre del cliente al generar el video, igual que ya hace `ResumenVideoGenerator.personalizarMensaje`.
- **Denormalización obligatoria:** `nombreLogro` y `mensaje` se copian al `LogroPersonalOtorgado` en el momento de otorgar, para que editar el catálogo después no reescriba el historial.
- **Tests:** dominio y timeline con tests JVM (JUnit4). Repositorios Firestore, pantallas Compose y render Canvas **no** se testean unitariamente — no hay precedente en este repo — y se verifican en dispositivo en la Tarea 11.
- **Convenciones del repo, sin excepciones:** subcolecciones bajo `clientes/{id}/...` (como `PagoRepository`); repositorios como clases planas, no interfaces (como `RutinaRepository`); los `ViewModel` leen `AppContainer` por parámetro con valor por defecto.
- **Comandos:** `./gradlew test` corre todos los tests JVM; `./gradlew assembleDebug` compila. Ambos desde la raíz del repo.

---

### Task 1: Rename — `Screen.Logros` pasa a ser `Screen.MedallasCliente`

Hoy la pantalla que se llama "Logros" lista **medallas**. Antes de agregar logros personales de verdad hay que quitar esa ambigüedad. Es un rename mecánico, cero cambios de comportamiento.

**Files:**
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/Screen.kt:31-33`
- Rename: `app/src/main/java/com/osfit/app/ui/clientes/LogrosClienteScreen.kt` → `MedallasClienteScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt:47,84,88`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt:80,307-309`

**Interfaces:**
- Produces: `Screen.MedallasCliente.crearRuta(clienteId: String): String` y el composable `MedallasClienteScreen(clienteId: String)` — consumidos por Task 9, que agrega los suyos al lado.

- [x] **Step 1: Renombrar la entrada de navegación**

En `Screen.kt`, reemplazar el bloque:

```kotlin
    data object Logros : Screen("logros/{clienteId}") {
        fun crearRuta(clienteId: String) = "logros/$clienteId"
    }
```

por:

```kotlin
    data object MedallasCliente : Screen("medallas_cliente/{clienteId}") {
        fun crearRuta(clienteId: String) = "medallas_cliente/$clienteId"
    }
```

- [x] **Step 2: Renombrar el archivo y el composable**

```bash
git mv app/src/main/java/com/osfit/app/ui/clientes/LogrosClienteScreen.kt \
       app/src/main/java/com/osfit/app/ui/clientes/MedallasClienteScreen.kt
```

Dentro del archivo renombrado: `fun LogrosClienteScreen(` → `fun MedallasClienteScreen(`, `private fun LogroCard(` → `private fun MedallaCard(`, y el texto visible `Text("Logros", ...)` → `Text("Medallas", ...)`. El texto `"Todavía no tiene insignias."` se queda igual.

- [x] **Step 3: Actualizar el NavHost**

En `OSfitNavHost.kt`: `onVerLogros = { id -> navController.navigate(Screen.Logros.crearRuta(id)) }` → `onVerMedallas = { id -> navController.navigate(Screen.MedallasCliente.crearRuta(id)) }`; `route = Screen.Logros.route` → `route = Screen.MedallasCliente.route`; y `com.osfit.app.ui.clientes.LogrosClienteScreen(clienteId = clienteId)` → `com.osfit.app.ui.clientes.MedallasClienteScreen(clienteId = clienteId)`.

- [x] **Step 4: Actualizar el perfil del cliente**

En `ClienteDetailScreen.kt`: el parámetro `onVerLogros: (String) -> Unit` → `onVerMedallas: (String) -> Unit`, y la tarjeta con `texto = "Logros"` → `texto = "Medallas"` con `onClick = { onVerMedallas(clienteId) }`.

- [x] **Step 5: Verificar que compila y los tests siguen pasando**

Run: `./gradlew assembleDebug test`
Expected: BUILD SUCCESSFUL, sin tests nuevos ni rotos.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename the client Logros screen to MedallasCliente

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Modelos de datos

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/model/LogroPersonalCatalogo.kt`
- Create: `app/src/main/java/com/osfit/app/data/model/LogroPersonalOtorgado.kt`

**Interfaces:**
- Produces: `LogroPersonalCatalogo(id, nombre, mensaje, imagenArchivo)` y `LogroPersonalOtorgado(id, rangoInicio, logroId, nombreLogro, mensaje, encabezadoRango, orden)` — consumidos por las Tasks 3, 4, 6, 8, 9 y 10.

- [ ] **Step 1: Crear el modelo del catálogo**

`LogroPersonalCatalogo.kt`:

```kotlin
package com.osfit.app.data.model

/**
 * Logro que el entrenador define por su cuenta y otorga a mano. A diferencia de
 * [MedallaCatalogo] no tiene categoría: no hay ranking ni fórmula detrás, y por eso tampoco
 * hay siembra automática — el catálogo arranca vacío.
 */
data class LogroPersonalCatalogo(
    val id: String = "",
    val nombre: String = "",
    // Se muestra debajo del logro en la escena del video cuando es el único de su escena.
    // "$nombrePersona" se reemplaza por el nombre del cliente al generar el video.
    val mensaje: String = "",
    // Nombre de archivo en filesDir/logrosPersonales/; null = insignia genérica dibujada por
    // el renderer (no hay imágenes empaquetadas).
    val imagenArchivo: String? = null
)
```

- [ ] **Step 2: Crear el modelo del otorgado**

`LogroPersonalOtorgado.kt`:

```kotlin
package com.osfit.app.data.model

/**
 * Un logro personal ya otorgado a un cliente en un período.
 *
 * A diferencia de [MedallaOtorgada], que usa `rangoInicio` como id de documento y por eso
 * admite exactamente uno por quincena, acá el id es compuesto ("<rangoInicio>_<logroId>"):
 * permite varios logros en la misma quincena, e impide duplicar el mismo logro dentro de ella.
 */
data class LogroPersonalOtorgado(
    val id: String = "",              // doc id: "<rangoInicio>_<logroId>"
    val rangoInicio: String = "",     // ISO date del inicio de la quincena
    val logroId: String = "",         // referencia a LogroPersonalCatalogo.id
    // Copias del catálogo al momento de otorgarlo: si el catálogo se edita después, el
    // historial no cambia retroactivamente (mismo criterio que MedallaOtorgada).
    val nombreLogro: String = "",
    val mensaje: String = "",
    val encabezadoRango: String = "", // "2da quincena de agosto"
    // Orden de selección del entrenador; define el orden en el video y en qué grupo de 3 cae.
    val orden: Int = 0
)
```

- [ ] **Step 3: Verificar que compila**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/model/LogroPersonalCatalogo.kt app/src/main/java/com/osfit/app/data/model/LogroPersonalOtorgado.kt
git commit -m "feat: add LogroPersonalCatalogo and LogroPersonalOtorgado models

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `InsigniaImagenUtil` — generalizar el manejo de imágenes

`MedallaImagenUtil` ya hace exactamente lo que los logros necesitan, pero con la carpeta fija. Se extrae el cuerpo a una clase parametrizada y quedan dos fachadas. **La API pública de `MedallaImagenUtil` no cambia**, así que ningún llamador existente se toca.

**Files:**
- Create: `app/src/main/java/com/osfit/app/util/InsigniaImagenUtil.kt`
- Modify: `app/src/main/java/com/osfit/app/util/MedallaImagenUtil.kt` (queda como fachada)
- Create: `app/src/main/java/com/osfit/app/util/LogroPersonalImagenUtil.kt`

**Interfaces:**
- Consumes: `LogroPersonalCatalogo` (Task 2).
- Produces: `LogroPersonalImagenUtil.copiarImagen(context, uri, logroId): String?`, `.eliminarImagen(context, nombreArchivo)`, `.cargarBitmapPropio(context, logro): Bitmap?` — consumidos por Tasks 6, 8 y 9.

- [ ] **Step 1: Crear `InsigniaImagenUtil` con el cuerpo actual de `MedallaImagenUtil`**

```kotlin
package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import java.io.File

/**
 * Copia la imagen elegida por el trainer a almacenamiento interno de la app (mismo motivo que
 * [CancionUtil]: un content:// puede perder su permiso de lectura al reiniciar el proceso o si
 * el trainer borra el archivo de su galería).
 *
 * Parametrizado por [carpeta] para que medallas y logros personales compartan el código sin
 * pisarse los archivos: cada uno vive en su propio subdirectorio de filesDir.
 */
class InsigniaImagenUtil(private val carpeta: String) {

    fun carpetaImagenes(context: Context): File =
        File(context.filesDir, carpeta).apply { mkdirs() }

    fun archivoImagen(context: Context, nombreArchivo: String): File =
        File(carpetaImagenes(context), nombreArchivo)

    /** Copia el contenido de [uri] a `filesDir/<carpeta>/<insigniaId>.<ext>` y devuelve el
     *  nombre de archivo resultante, o null si no se pudo leer/copiar. */
    fun copiarImagen(context: Context, uri: Uri, insigniaId: String): String? {
        val extension = extensionDe(context, uri) ?: "jpg"
        val destino = File(carpetaImagenes(context), "$insigniaId.$extension")
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

    /** Bitmap del archivo propio de la insignia, o null si no tiene uno: en ese caso quien
     *  llama dibuja una insignia/ícono por defecto en su lugar. */
    fun cargarBitmap(context: Context, imagenArchivo: String?): Bitmap? {
        val archivo = imagenArchivo ?: return null
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

- [ ] **Step 2: Reemplazar `MedallaImagenUtil` por una fachada**

El archivo completo pasa a ser:

```kotlin
package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import com.osfit.app.data.model.MedallaCatalogo
import java.io.File

/** Fachada sobre [InsigniaImagenUtil] para la carpeta de medallas. Su API pública no cambió
 *  al extraerse el cuerpo: los llamadores existentes siguen igual. */
object MedallaImagenUtil {

    private val delegado = InsigniaImagenUtil("medallas")

    fun carpetaMedallas(context: Context): File = delegado.carpetaImagenes(context)

    fun archivoImagen(context: Context, nombreArchivo: String): File =
        delegado.archivoImagen(context, nombreArchivo)

    fun copiarImagen(context: Context, uri: Uri, medallaId: String): String? =
        delegado.copiarImagen(context, uri, medallaId)

    fun eliminarImagen(context: Context, nombreArchivo: String) =
        delegado.eliminarImagen(context, nombreArchivo)

    fun cargarBitmapPropio(context: Context, medalla: MedallaCatalogo): Bitmap? =
        delegado.cargarBitmap(context, medalla.imagenArchivo)
}
```

- [ ] **Step 3: Crear `LogroPersonalImagenUtil`**

```kotlin
package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import com.osfit.app.data.model.LogroPersonalCatalogo
import java.io.File

/** Fachada sobre [InsigniaImagenUtil] para la carpeta de logros personales. */
object LogroPersonalImagenUtil {

    private val delegado = InsigniaImagenUtil("logrosPersonales")

    fun carpetaLogros(context: Context): File = delegado.carpetaImagenes(context)

    fun archivoImagen(context: Context, nombreArchivo: String): File =
        delegado.archivoImagen(context, nombreArchivo)

    fun copiarImagen(context: Context, uri: Uri, logroId: String): String? =
        delegado.copiarImagen(context, uri, logroId)

    fun eliminarImagen(context: Context, nombreArchivo: String) =
        delegado.eliminarImagen(context, nombreArchivo)

    fun cargarBitmapPropio(context: Context, logro: LogroPersonalCatalogo): Bitmap? =
        delegado.cargarBitmap(context, logro.imagenArchivo)
}
```

- [ ] **Step 4: Verificar que compila y nada se rompió**

Run: `./gradlew assembleDebug test`
Expected: BUILD SUCCESSFUL. Si algún llamador de `MedallaImagenUtil` falla al compilar, la fachada quedó incompleta — agregar el método faltante delegando, no cambiar el llamador.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/util/
git commit -m "refactor: extract InsigniaImagenUtil so logros can reuse the medal image handling

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `LogroPersonalRepository` y registro en `AppContainer`

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/repository/LogroPersonalRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/data/AppContainer.kt`

**Interfaces:**
- Consumes: `LogroPersonalCatalogo`, `LogroPersonalOtorgado` (Task 2).
- Produces: `AppContainer.logroPersonalRepository` con `observarCatalogo(): Flow<List<LogroPersonalCatalogo>>`, `guardarLogro(logro)`, `eliminarLogro(logroId)`, `observarOtorgados(clienteId): Flow<List<LogroPersonalOtorgado>>`, `otorgarLogros(clienteId, rangoInicio, logros)`, `quitarLogro(clienteId, id)` — consumidos por Tasks 8, 9 y 10.

- [ ] **Step 1: Crear el repositorio**

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.LogroPersonalOtorgado
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class LogroPersonalRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val catalogo = db.collection("logrosPersonales")
    private fun otorgadosCollection(clienteId: String) =
        db.collection("clientes").document(clienteId).collection("logrosPersonales")

    fun observarCatalogo(): Flow<List<LogroPersonalCatalogo>> = callbackFlow {
        val registro = catalogo.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val logros = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(LogroPersonalCatalogo::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(logros.sortedBy { it.nombre.lowercase() })
        }
        awaitClose { registro.remove() }
    }

    /** [logro.id] no puede estar vacío: quien llama lo genera con UUID antes de copiar la
     *  imagen a filesDir/logrosPersonales/<id>, mismo criterio que MedallaRepository. */
    suspend fun guardarLogro(logro: LogroPersonalCatalogo) {
        require(logro.id.isNotBlank()) { "LogroPersonalCatalogo.id no puede estar vacío al guardar" }
        catalogo.document(logro.id).set(logro.copy(id = "")).await()
    }

    /** Todos los logros personales son borrables: no hay categorías fijas como en medallas. */
    suspend fun eliminarLogro(logroId: String) {
        catalogo.document(logroId).delete().await()
    }

    /**
     * Ordena por `rangoInicio` descendente en Firestore y por `orden` ascendente **en memoria**:
     * encadenar dos `orderBy` obligaría a crear un índice compuesto en la consola de Firebase,
     * y la lista de logros de un cliente es chica de sobra para ordenarla acá.
     */
    fun observarOtorgados(clienteId: String): Flow<List<LogroPersonalOtorgado>> = callbackFlow {
        val registro = otorgadosCollection(clienteId)
            .orderBy("rangoInicio", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val otorgados = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(LogroPersonalOtorgado::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                // El comparador lleva las DOS claves: ordenar sólo por `orden` mezclaría
                // períodos (todos los orden=0 juntos, después todos los orden=1).
                trySend(
                    otorgados.sortedWith(
                        compareByDescending<LogroPersonalOtorgado> { it.rangoInicio }.thenBy { it.orden }
                    )
                )
            }
        awaitClose { registro.remove() }
    }

    /**
     * Reemplaza por completo los logros de [rangoInicio] para este cliente: primero borra los
     * que ya había en ese período, después escribe [logros], todo en un batch.
     *
     * El borrado previo es lo que hace la operación idempotente por quincena. MedallaRepository
     * consigue lo mismo gratis porque usa `rangoInicio` como doc id (un `set` pisa el anterior);
     * acá, con varios documentos por período, hay que limpiar a mano — si no, regenerar el video
     * de la misma quincena con otra selección dejaría huérfanos los logros de la anterior.
     *
     * Con [logros] vacío la operación se reduce a limpiar el período, que es el comportamiento
     * correcto para "esta quincena no le toca ningún logro".
     */
    suspend fun otorgarLogros(
        clienteId: String,
        rangoInicio: String,
        logros: List<LogroPersonalOtorgado>
    ) {
        val coleccion = otorgadosCollection(clienteId)
        val previos = coleccion.whereEqualTo("rangoInicio", rangoInicio).get().await()
        val batch = db.batch()
        previos.documents.forEach { batch.delete(it.reference) }
        logros.forEach { logro -> batch.set(coleccion.document(logro.id), logro.copy(id = "")) }
        batch.commit().await()
    }

    /** Quita un logro ya otorgado (p. ej. desde la pantalla del cliente, fuera del resumen). */
    suspend fun quitarLogro(clienteId: String, id: String) {
        otorgadosCollection(clienteId).document(id).delete().await()
    }
}
```

- [ ] **Step 2: Registrarlo en `AppContainer`**

Agregar el import `com.osfit.app.data.repository.LogroPersonalRepository` y, después de la línea de `medallaRepository`:

```kotlin
    val logroPersonalRepository: LogroPersonalRepository by lazy { LogroPersonalRepository() }
```

- [ ] **Step 3: Verificar que compila**

Run: `./gradlew assembleDebug test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/
git commit -m "feat: add LogroPersonalRepository (catalog + per-client award history)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Escena `LogrosPersonales` y su duración en el timeline

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/EscenaResumen.kt`
- Modify: `app/src/main/java/com/osfit/app/video/TimelineResumen.kt` (función `duracionParaTipo`)
- Test: `app/src/test/java/com/osfit/app/video/TimelineResumenTest.kt`

**Interfaces:**
- Produces: `EscenaResumen.LogrosPersonales(logros: List<LogroEnEscena>)` y `LogroEnEscena(nombre: String, imagen: Bitmap?, mensaje: String)` — consumidos por Tasks 6 y 7.

Nota: agregar una rama a la `sealed class` rompe la compilación de los dos `when` exhaustivos que hay sobre ella (`TimelineResumen.duracionParaTipo` y `ResumenFrameRenderer.lineasDeEscena`). El primero se arregla en esta tarea; el segundo, en la Task 7. Para que el proyecto compile mientras tanto, esta tarea agrega en `lineasDeEscena` una rama provisional `is EscenaResumen.LogrosPersonales -> emptyList()`, que la Task 7 reemplaza.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `TimelineResumenTest.kt`:

```kotlin
    private fun logros(cantidad: Int) = EscenaResumen.LogrosPersonales(
        (1..cantidad).map { EscenaResumen.LogroEnEscena("Logro $it", null, "mensaje $it") }
    )

    @Test
    fun `la escena de logros personales dura mas mientras mas logros trae`() {
        assertEquals(6_500L, TimelineResumen(listOf(logros(1))).duracionTotalMs)
        assertEquals(7_500L, TimelineResumen(listOf(logros(2))).duracionTotalMs)
        assertEquals(9_000L, TimelineResumen(listOf(logros(3))).duracionTotalMs)
    }
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `./gradlew test --tests "com.osfit.app.video.TimelineResumenTest"`
Expected: FAIL al compilar — `Unresolved reference: LogrosPersonales`.

- [ ] **Step 3: Agregar la escena al sealed class**

En `EscenaResumen.kt`, después de la rama `Medalla` y antes de `object Despedida`:

```kotlin
    /** Un logro personal ya resuelto para dibujar: bitmap decodificado y mensaje con
     *  "$nombrePersona" reemplazado. */
    data class LogroEnEscena(
        val nombre: String,
        val imagen: Bitmap?,
        // Sólo se dibuja cuando su escena trae un único logro: con 2 o 3 no cabe legible.
        val mensaje: String
    )

    /** Entre 1 y 3 logros personales otorgados en la quincena. Si se otorgaron más, el
     *  generador arma varias escenas de a 3 (ver ResumenVideoGenerator.construirEscenas). */
    data class LogrosPersonales(val logros: List<LogroEnEscena>) : EscenaResumen()
```

- [ ] **Step 4: Agregar la duración en el timeline**

En `TimelineResumen.duracionParaTipo`, entre las ramas de `Medalla` y `Despedida`:

```kotlin
        // Escala con la cantidad porque el contenido en pantalla cambia: con 1 logro es el
        // mismo layout y ritmo que Medalla (título + insignia + mensaje); con 2 o 3 no hay
        // mensaje que leer, pero sí insignias entrando en cascada (la tercera recién a los
        // ~3.2s) y varios nombres.
        is EscenaResumen.LogrosPersonales -> when (escena.logros.size) {
            1 -> 6_500L
            2 -> 7_500L
            else -> 9_000L
        }
```

- [ ] **Step 5: Agregar la rama provisional en el renderer para que compile**

En `ResumenFrameRenderer.kt`, en el `when` de `lineasDeEscena` (junto a `is EscenaResumen.Medalla ->`):

```kotlin
        // Provisional: la Task 7 la reemplaza por el título y el mensaje reales.
        is EscenaResumen.LogrosPersonales -> emptyList()
```

- [ ] **Step 6: Correr los tests**

Run: `./gradlew test --tests "com.osfit.app.video.TimelineResumenTest"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ app/src/test/java/com/osfit/app/video/TimelineResumenTest.kt
git commit -m "feat: add EscenaResumen.LogrosPersonales and its timeline duration

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Armado de escenas en `ResumenVideoGenerator`

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt`
- Test: `app/src/test/java/com/osfit/app/video/ResumenVideoGeneratorTest.kt`

**Interfaces:**
- Consumes: `EscenaResumen.LogrosPersonales`, `EscenaResumen.LogroEnEscena` (Task 5); `LogroPersonalCatalogo` (Task 2); `LogroPersonalImagenUtil.cargarBitmapPropio` (Task 3).
- Produces: `ResumenVideoGenerator.generarYCompartir(context, resumen, medallaOtorgada, logrosOtorgados: List<LogroPersonalCatalogo>, onProgreso)` y `construirEscenas(resumen, medalla, logrosPersonales: List<EscenaResumen.LogrosPersonales>)` — consumidos por Task 10.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `ResumenVideoGeneratorTest.kt`:

```kotlin
    private fun logro(nombre: String) = EscenaResumen.LogroEnEscena(nombre, null, "mensaje de $nombre")

    private fun escenasDeLogros(cantidad: Int): List<EscenaResumen.LogrosPersonales> =
        (1..cantidad).map { logro("Logro $it") }
            .chunked(3)
            .map { EscenaResumen.LogrosPersonales(it) }

    @Test
    fun `sin logros personales no aparece ninguna escena de logros`() {
        val rango = ResumenClienteCalculator.rangoQuincenal(LocalDate.of(2024, 3, 20))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, racha = 4))

        assertTrue(escenas.none { it is EscenaResumen.LogrosPersonales })
    }

    @Test
    fun `cuatro logros personales se reparten en dos escenas de 3 y 1`() {
        val rango = ResumenClienteCalculator.rangoQuincenal(LocalDate.of(2024, 3, 20))
        val escenas = ResumenVideoGenerator.construirEscenas(
            resumen(rango, racha = 4),
            logrosPersonales = escenasDeLogros(4)
        )

        val deLogros = escenas.filterIsInstance<EscenaResumen.LogrosPersonales>()
        assertEquals(2, deLogros.size)
        assertEquals(3, deLogros[0].logros.size)
        assertEquals(1, deLogros[1].logros.size)
        assertEquals("Logro 4", deLogros[1].logros[0].nombre)
    }

    @Test
    fun `las escenas de logros van despues de RachaMasLarga y antes de Medalla`() {
        val rango = ResumenClienteCalculator.rangoQuincenal(LocalDate.of(2024, 3, 20))
        val medalla = EscenaResumen.Medalla(
            nombre = "Rey de la asistencia",
            categoria = CategoriaMedallaAutomatica.ASISTENCIA,
            imagenPersonalizada = null,
            mensaje = "felicidades"
        )
        val escenas = ResumenVideoGenerator.construirEscenas(
            resumen(rango, racha = 4),
            medalla = medalla,
            logrosPersonales = escenasDeLogros(2)
        )

        val indiceRacha = escenas.indexOfFirst { it is EscenaResumen.RachaMasLarga }
        val indiceLogros = escenas.indexOfFirst { it is EscenaResumen.LogrosPersonales }
        val indiceMedalla = escenas.indexOfFirst { it is EscenaResumen.Medalla }

        assertTrue(indiceRacha < indiceLogros)
        assertTrue(indiceLogros < indiceMedalla)
    }
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `./gradlew test --tests "com.osfit.app.video.ResumenVideoGeneratorTest"`
Expected: FAIL al compilar — `construirEscenas` no acepta el parámetro `logrosPersonales`.

- [ ] **Step 3: Agregar el parámetro a `construirEscenas`**

Cambiar la firma:

```kotlin
    fun construirEscenas(
        resumen: ResumenClienteData,
        medalla: EscenaResumen.Medalla? = null,
        logrosPersonales: List<EscenaResumen.LogrosPersonales> = emptyList()
    ): List<EscenaResumen> {
```

y, dentro, insertar las escenas **entre el bloque de `RachaMasLarga` y el de la medalla** — es decir, justo antes de la línea `if (medalla != null) escenas += medalla`:

```kotlin
        // Primero el reconocimiento personal (contra sí mismo), después la medalla grupal
        // como cierre. Ya vienen agrupadas de a 3 desde generarYCompartir.
        escenas += logrosPersonales
```

- [ ] **Step 4: Resolver los bitmaps y agrupar en `generarYCompartir`**

Agregar el parámetro a la firma, después de `medallaOtorgada`:

```kotlin
        logrosOtorgados: List<LogroPersonalCatalogo> = emptyList(),
```

y, antes de construir el timeline (junto al bloque que arma `medallaEscena`):

```kotlin
        // Los bitmaps se decodifican acá, donde hay Context, y se agrupan de a 3: así el
        // ResumenFrameRenderer sigue sin depender de Context, igual que con la medalla.
        val escenasDeLogros = logrosOtorgados
            .map { logro ->
                EscenaResumen.LogroEnEscena(
                    nombre = logro.nombre,
                    imagen = LogroPersonalImagenUtil.cargarBitmapPropio(context, logro),
                    mensaje = personalizarMensaje(logro.mensaje, resumen.cliente.nombre)
                )
            }
            .chunked(3)
            .map { grupo -> EscenaResumen.LogrosPersonales(grupo) }
```

y pasarlas al timeline:

```kotlin
            TimelineResumen(construirEscenas(resumen, medallaEscena, escenasDeLogros))
```

Agregar los imports `com.osfit.app.data.model.LogroPersonalCatalogo` y `com.osfit.app.util.LogroPersonalImagenUtil`.

- [ ] **Step 5: Correr los tests**

Run: `./gradlew test --tests "com.osfit.app.video.ResumenVideoGeneratorTest"`
Expected: PASS (los tests existentes también siguen pasando: el parámetro nuevo tiene valor por defecto).

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenVideoGenerator.kt app/src/test/java/com/osfit/app/video/ResumenVideoGeneratorTest.kt
git commit -m "feat: group personal achievements into video scenes of up to 3

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Render de la escena en `ResumenFrameRenderer`

**Files:**
- Modify: `app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt`

**Interfaces:**
- Consumes: `EscenaResumen.LogrosPersonales`, `EscenaResumen.LogroEnEscena` (Task 5).
- Produces: nada que otras tareas consuman. Se verifica en dispositivo en la Task 11.

- [ ] **Step 1: Generalizar `dibujarInsigniaMedalla`**

Cambiar la firma para que reciba color y glifo ya resueltos, en vez de derivarlos de la categoría:

```kotlin
    /** Insignia por defecto cuando no hay imagen propia: un círculo de [colorInsignia] con
     *  [glifo] al centro. La medalla pasa el color/inicial de su categoría; los logros
     *  personales, un color de la paleta pastel y una estrella. */
    private fun dibujarInsignia(
        canvas: Canvas, cx: Float, cy: Float, radio: Float,
        colorInsignia: Int, glifo: String, alphaAplicado: Int
    ) {
        val paintCirculo = Paint().apply { isAntiAlias = true; color = colorInsignia; alpha = alphaAplicado; style = Paint.Style.FILL }
        canvas.drawCircle(cx, cy, radio, paintCirculo)
        val paintGlifo = Paint().apply {
            isAntiAlias = true; color = NEGRO; alpha = alphaAplicado; textSize = radio
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD); textAlign = Paint.Align.CENTER
        }
        canvas.drawText(glifo, cx, cy + radio * 0.35f, paintGlifo)
    }
```

Y en `dibujarMedalla`, reemplazar la llamada `dibujarInsigniaMedalla(canvas, centroX, centroY, radio, escena.categoria, alphaAplicado)` por:

```kotlin
            dibujarInsignia(
                canvas, centroX, centroY, radio,
                colorInsignia = escena.categoria?.let { COLOR_INSIGNIA_MEDALLA[it] } ?: 0xFFB0B0B0.toInt(),
                glifo = escena.categoria?.name?.first()?.toString() ?: "★",
                alphaAplicado = alphaAplicado
            )
```

- [ ] **Step 2: Reemplazar la rama provisional en `lineasDeEscena`**

Cambiar `is EscenaResumen.LogrosPersonales -> emptyList()` (puesta en la Task 5) por:

```kotlin
        is EscenaResumen.LogrosPersonales -> buildList {
            add(BloqueTexto("Y contra ti mismo, lograste:", inicioMs = 0, duracionMs = 1_800, y = 600f, tamano = 56f, color = Color.WHITE, estilo = Typeface.BOLD))
            // El mensaje sólo cabe legible cuando la escena trae un único logro; con 2 o 3
            // la escena se queda en título + insignias + nombres. Mismo tratamiento que el
            // mensaje de la medalla: duracionMs = 0 lo muestra de golpe, sin máquina de
            // escribir, porque son textos largos.
            val unico = escena.logros.singleOrNull()
            if (unico != null && unico.mensaje.isNotBlank()) {
                add(
                    BloqueTexto(
                        unico.mensaje, inicioMs = MEDALLA_INICIO_MS + MEDALLA_FADE_MS + 100,
                        duracionMs = 0L, y = 1620f, tamano = 38f, color = Color.LTGRAY, estilo = Typeface.NORMAL
                    )
                )
            }
        }
```

- [ ] **Step 3: Dibujar las insignias**

Agregar la llamada en `dibujarEscena`, junto a la que ya existe para la medalla:

```kotlin
        if (escena is EscenaResumen.LogrosPersonales) {
            dibujarLogrosPersonales(canvas, ancho, escena, elapsedMs, alpha)
        }
```

Y la función, junto a `dibujarMedalla`:

```kotlin
    /**
     * Con un solo logro, mismo layout que la medalla (insignia grande centrada, nombre debajo,
     * y el mensaje lo dibuja lineasDeEscena). Con 2 o 3, insignias más chicas repartidas a lo
     * ancho, cada una entrando 500ms después de la anterior.
     */
    private fun dibujarLogrosPersonales(
        canvas: Canvas, ancho: Int, escena: EscenaResumen.LogrosPersonales,
        elapsedMs: Long, alphaEscena: Float
    ) {
        val cantidad = escena.logros.size
        if (cantidad == 0) return
        val unico = cantidad == 1
        val radio = if (unico) 220f else 130f
        val centroY = if (unico) 1150f else 1100f

        escena.logros.forEachIndexed { indice, logro ->
            val inicio = if (unico) MEDALLA_INICIO_MS else 1_200L + indice * 500L
            val progreso = ((elapsedMs - inicio).coerceIn(0L, MEDALLA_FADE_MS)).toFloat() / MEDALLA_FADE_MS
            if (progreso <= 0f) return@forEachIndexed
            val alphaAplicado = (255 * progreso * alphaEscena).toInt().coerceIn(0, 255)

            // Columnas de ancho igual: la insignia i queda en el centro de la columna i.
            val anchoColumna = ancho.toFloat() / cantidad
            val centroX = anchoColumna * (indice + 0.5f)

            val bitmap = logro.imagen
            if (bitmap != null) {
                val destino = RectF(centroX - radio, centroY - radio, centroX + radio, centroY + radio)
                val paintImagen = Paint().apply { isAntiAlias = true; alpha = alphaAplicado }
                canvas.drawBitmap(bitmap, null, destino, paintImagen)
            } else {
                dibujarInsignia(
                    canvas, centroX, centroY, radio,
                    colorInsignia = DONA_PALETA_PASTEL[indice % DONA_PALETA_PASTEL.size],
                    glifo = "★",
                    alphaAplicado = alphaAplicado
                )
            }

            dibujarTextoCentradoMultilinea(
                canvas, listOf(logro.nombre), centroX, centroY + radio + (if (unico) 90f else 60f),
                tamano = if (unico) 44f else 28f, color = DESTACADO, alphaAplicado = alphaAplicado
            )
        }
    }
```

- [ ] **Step 4: Verificar que compila y los tests siguen pasando**

Run: `./gradlew assembleDebug test`
Expected: BUILD SUCCESSFUL. El render no tiene test JVM (requiere `android.graphics.Bitmap` real) — se valida en dispositivo en la Task 11.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt
git commit -m "feat: render the LogrosPersonales scene with up to 3 cascading badges

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Pantalla de catálogo de logros personales

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/logros/LogrosPersonalesViewModel.kt`
- Create: `app/src/main/java/com/osfit/app/ui/logros/LogrosPersonalesScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/Screen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/OSfitApp.kt` (drawer)

**Interfaces:**
- Consumes: `AppContainer.logroPersonalRepository` (Task 4), `LogroPersonalImagenUtil` (Task 3), `LogroPersonalCatalogo` (Task 2).
- Produces: `Screen.LogrosPersonales` (ruta `logros_personales`) y el composable `LogrosPersonalesScreen()`.

- [ ] **Step 1: Crear el ViewModel**

```kotlin
package com.osfit.app.ui.logros

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.repository.LogroPersonalRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Espejo de MedallasViewModel, sin el `init { asegurarCategoriasAutomaticas() }`: los logros
 *  personales no tienen categorías fijas ni siembra, el catálogo arranca vacío. */
class LogrosPersonalesViewModel(
    private val repositorio: LogroPersonalRepository = AppContainer.logroPersonalRepository
) : ViewModel() {

    val logros: StateFlow<List<LogroPersonalCatalogo>> = repositorio.observarCatalogo()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun guardar(logro: LogroPersonalCatalogo) {
        viewModelScope.launch { repositorio.guardarLogro(logro) }
    }

    fun eliminar(logro: LogroPersonalCatalogo) {
        viewModelScope.launch { repositorio.eliminarLogro(logro.id) }
    }
}
```

- [ ] **Step 2: Crear la pantalla**

Copiar la estructura de `app/src/main/java/com/osfit/app/ui/medallas/MedallasScreen.kt` y adaptarla. Diferencias contra el original, todas por la ausencia de categorías:

- La lista se ordena por nombre (ya viene ordenada del repositorio), sin el `sortedWith` por categoría.
- `LogroItem` **siempre** muestra el `IconButton` de borrar (en medallas está condicionado a `medalla.categoria == null`), y el subtítulo bajo el nombre es el `mensaje` recortado a una línea (`maxLines = 1`) en vez de "Automática"/"Subjetiva". Si el mensaje está en blanco, no se dibuja ese `Text`.
- `EditarLogroDialog` usa el título `"Nuevo logro"` cuando `logro.nombre.isBlank()` y `"Editar logro"` si no.
- Usa `LogroPersonalImagenUtil` en vez de `MedallaImagenUtil`, y `LogroPersonalCatalogo` en vez de `MedallaCatalogo`.
- El FAB dice `contentDescription = "Nuevo logro"`, y el diálogo de nuevo se abre con `LogroPersonalCatalogo(id = UUID.randomUUID().toString())` — igual que medallas, el id se genera acá para poder copiar la imagen antes de guardar el documento.
- El diálogo de borrar no tiene condición: cualquier logro se puede borrar. Antes de llamar a `viewModel.eliminar(logro)`, si `logro.imagenArchivo != null`, llamar a `LogroPersonalImagenUtil.eliminarImagen(context, logro.imagenArchivo!!)`.

- [ ] **Step 3: Agregar la ruta**

En `Screen.kt`, después de `data object Medallas`:

```kotlin
    data object LogrosPersonales : Screen("logros_personales")
```

- [ ] **Step 4: Registrarla en el NavHost**

En `OSfitNavHost.kt`, junto al `composable(Screen.Medallas.route)`:

```kotlin
        composable(Screen.LogrosPersonales.route) {
            com.osfit.app.ui.logros.LogrosPersonalesScreen()
        }
```

- [ ] **Step 5: Agregar la entrada al drawer**

En `OSfitApp.kt`, duplicar el `NavigationDrawerItem` de "Medallas" justo después, con `label = { Text("Logros personales") }`, `selected = rutaActual == Screen.LogrosPersonales.route` y navegando a `Screen.LogrosPersonales.route`.

- [ ] **Step 6: Verificar que compila y los tests siguen pasando**

Run: `./gradlew assembleDebug test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/
git commit -m "feat: add the personal achievements catalog screen, reachable from the drawer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Historial de logros personales por cliente

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/clientes/LogrosPersonalesClienteScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/Screen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`

**Interfaces:**
- Consumes: `AppContainer.logroPersonalRepository` (Task 4), `LogroPersonalOtorgado` y `LogroPersonalCatalogo` (Task 2).
- Produces: `Screen.LogrosPersonalesCliente.crearRuta(clienteId)`, el composable `LogrosPersonalesClienteScreen(clienteId: String)`, y en `ClienteDetailViewModel`: `catalogoLogrosPersonales: StateFlow<List<LogroPersonalCatalogo>>`, `logrosPersonalesOtorgados: StateFlow<List<LogroPersonalOtorgado>>`, `otorgarLogroPersonal(logro)`, `quitarLogroPersonal(otorgado)`.

- [ ] **Step 1: Exponer los flows y las acciones en `ClienteDetailViewModel`**

Agregar el repositorio como parámetro del constructor con valor por defecto (`private val logroPersonalRepository: LogroPersonalRepository = AppContainer.logroPersonalRepository`), y junto a los de medallas:

```kotlin
    val catalogoLogrosPersonales: StateFlow<List<LogroPersonalCatalogo>> =
        logroPersonalRepository.observarCatalogo()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val logrosPersonalesOtorgados: StateFlow<List<LogroPersonalOtorgado>> =
        logroPersonalRepository.observarOtorgados(clienteId)
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
```

(Copiar el `stateIn` exacto que ya usan `catalogoMedallas`/`medallasOtorgadas` en ese archivo, para no divergir.)

Y las acciones:

```kotlin
    /** Otorga un logro personal fuera del flujo del resumen quincenal. Usa un rangoInicio
     *  sintético por timestamp para que el doc id compuesto no choque con los de una quincena
     *  real — mismo recurso que [otorgarMedalla]. */
    fun otorgarLogroPersonal(logro: LogroPersonalCatalogo) {
        viewModelScope.launch {
            val rangoInicio = "manual_${System.currentTimeMillis()}"
            logroPersonalRepository.otorgarLogros(
                clienteId,
                rangoInicio,
                listOf(
                    LogroPersonalOtorgado(
                        id = "${rangoInicio}_${logro.id}",
                        rangoInicio = rangoInicio,
                        logroId = logro.id,
                        nombreLogro = logro.nombre,
                        mensaje = logro.mensaje,
                        encabezadoRango = "Otorgado manualmente el ${LocalDate.now()}",
                        orden = 0
                    )
                )
            )
        }
    }

    fun quitarLogroPersonal(otorgado: LogroPersonalOtorgado) {
        viewModelScope.launch { logroPersonalRepository.quitarLogro(clienteId, otorgado.id) }
    }
```

- [ ] **Step 2: Crear la pantalla**

Copiar `MedallasClienteScreen.kt` (la renombrada en la Task 1) a `LogrosPersonalesClienteScreen.kt` y adaptarla:

- `fun LogrosPersonalesClienteScreen(clienteId: String)`, título `"Logros personales"`, vacío `"Todavía no tiene logros personales."`.
- Lee `viewModel.catalogoLogrosPersonales` y `viewModel.logrosPersonalesOtorgados`.
- `items(otorgados, key = { it.id })` — la clave es `id`, no `rangoInicio`, porque ahora hay varios por período.
- La tarjeta muestra `otorgado.nombreLogro` y `otorgado.encabezadoRango`, con el botón de quitar llamando a `viewModel.quitarLogroPersonal(otorgado)`.
- El diálogo del FAB usa radio buttons sobre `catalogoLogrosPersonales` y llama a `viewModel.otorgarLogroPersonal(logro)`.

- [ ] **Step 3: Agregar la ruta y registrarla**

En `Screen.kt`, después de `MedallasCliente`:

```kotlin
    data object LogrosPersonalesCliente : Screen("logros_personales/{clienteId}") {
        fun crearRuta(clienteId: String) = "logros_personales/$clienteId"
    }
```

En `OSfitNavHost.kt`, copiar el bloque `composable(...)` de `Screen.MedallasCliente` (con su `navArgument("clienteId")`) para `Screen.LogrosPersonalesCliente`, llamando a `com.osfit.app.ui.clientes.LogrosPersonalesClienteScreen(clienteId = clienteId)`. Y agregar el callback `onVerLogrosPersonales = { id -> navController.navigate(Screen.LogrosPersonalesCliente.crearRuta(id)) }` al llamado de `ClienteDetailScreen`.

**Ojo con el orden de rutas:** `logros_personales` (Task 8) y `logros_personales/{clienteId}` conviven sin ambigüedad en Navigation Compose porque tienen distinta cantidad de segmentos. No hace falta reordenar nada.

- [ ] **Step 4: Agregar la tarjeta al perfil**

En `ClienteDetailScreen.kt`, agregar el parámetro `onVerLogrosPersonales: (String) -> Unit` y, justo después de la tarjeta "Medallas", una idéntica con `texto = "Logros personales"` y `onClick = { onVerLogrosPersonales(clienteId) }`.

- [ ] **Step 5: Verificar que compila y los tests siguen pasando**

Run: `./gradlew assembleDebug test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/
git commit -m "feat: add the per-client personal achievements history screen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Encadenar la asignación en el flujo quincenal

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/clientes/ConfirmarLogrosDialog.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ResumenClienteViewModel.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailScreen.kt:114,407-437`

**Interfaces:**
- Consumes: `LogroPersonalRepository.otorgarLogros` (Task 4), `ResumenVideoGenerator.generarYCompartir(..., logrosOtorgados, ...)` (Task 6), `LogroPersonalCatalogo`/`LogroPersonalOtorgado` (Task 2).
- Produces: `ResumenClienteViewModel.PreparacionResumenQuincenal`, `prepararConfirmacionQuincenal(fechaReferencia)`, `confirmarYGenerarQuincenal(context, preparacion, medallaElegida, logrosElegidos)`, y el composable `ConfirmarLogrosDialog`.

- [ ] **Step 1: Crear `ConfirmarLogrosDialog`**

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
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.osfit.app.data.model.LogroPersonalCatalogo

/**
 * Selección múltiple de logros personales para la quincena. A diferencia de
 * [ConfirmarMedallaDialog] no hay sugerencia que preseleccionar: arranca vacío y el entrenador
 * marca los que quiera (o ninguno).
 *
 * El orden de marcado es el orden en que salen en el video, y define cómo se agrupan de a 3:
 * por eso la selección se guarda en una lista y no en un set.
 */
@Composable
fun ConfirmarLogrosDialog(
    catalogo: List<LogroPersonalCatalogo>,
    onConfirmar: (List<LogroPersonalCatalogo>) -> Unit,
    onCancelar: () -> Unit
) {
    val seleccionados = remember { mutableStateListOf<LogroPersonalCatalogo>() }
    val escenas = if (seleccionados.isEmpty()) 0 else (seleccionados.size + 2) / 3

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Logros personales de la quincena") },
        text = {
            Column {
                Text(
                    when {
                        seleccionados.isEmpty() -> "Ninguno seleccionado: no se agrega escena al video."
                        escenas == 1 -> "${seleccionados.size} logro(s) — salen en 1 escena."
                        else -> "${seleccionados.size} logros — salen en $escenas escenas."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 12.dp)
                )
                LazyColumn(modifier = Modifier.height(320.dp)) {
                    items(catalogo, key = { it.id }) { logro ->
                        val marcado = seleccionados.any { it.id == logro.id }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (marcado) seleccionados.removeAll { it.id == logro.id }
                                    else seleccionados.add(logro)
                                }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = marcado,
                                onCheckedChange = {
                                    if (marcado) seleccionados.removeAll { it.id == logro.id }
                                    else seleccionados.add(logro)
                                }
                            )
                            Text(logro.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(seleccionados.toList()) }) { Text("Generar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
```

- [ ] **Step 2: Extender el ViewModel**

En `ResumenClienteViewModel.kt`: agregar `private val logroPersonalRepository: LogroPersonalRepository = AppContainer.logroPersonalRepository` al constructor, renombrar `PreparacionMedalla` → `PreparacionResumenQuincenal` con el campo nuevo, y renombrar `prepararConfirmacionMedalla` → `prepararConfirmacionQuincenal`:

```kotlin
    data class PreparacionResumenQuincenal(
        val resumen: ResumenClienteData,
        val sugerencia: MedallaCatalogo?,
        val catalogo: List<MedallaCatalogo>,
        val catalogoLogros: List<LogroPersonalCatalogo>
    )

    suspend fun prepararConfirmacionQuincenal(
        fechaReferencia: LocalDate = LocalDate.now()
    ): PreparacionResumenQuincenal? {
        val resumen = calcularResumenQuincenal(fechaReferencia) ?: return null
        val catalogoActual = medallaRepository.observarCatalogo().first()
        val catalogoLogros = logroPersonalRepository.observarCatalogo().first()
        val categoriaSugerida = MedallaCalculator.sugerirCategoria(resumen)
        val sugerencia = categoriaSugerida?.let { cat -> catalogoActual.firstOrNull { it.categoria == cat } }
        return PreparacionResumenQuincenal(resumen, sugerencia, catalogoActual, catalogoLogros)
    }
```

Y en `confirmarYGenerarQuincenal`, agregar el parámetro y la escritura:

```kotlin
    fun confirmarYGenerarQuincenal(
        context: Context,
        preparacion: PreparacionResumenQuincenal,
        elegida: MedallaCatalogo?,
        logrosElegidos: List<LogroPersonalCatalogo> = emptyList()
    ) {
```

Dentro del `try`, después del bloque `if (elegida != null) { ... }` y antes de generar el video:

```kotlin
                val rangoInicio = preparacion.resumen.rango.inicio.toString()
                // Siempre se llama, incluso con lista vacía: así limpia los logros de una
                // generación anterior de la misma quincena (ver LogroPersonalRepository).
                logroPersonalRepository.otorgarLogros(
                    preparacion.resumen.cliente.id,
                    rangoInicio,
                    logrosElegidos.mapIndexed { indice, logro ->
                        LogroPersonalOtorgado(
                            id = "${rangoInicio}_${logro.id}",
                            rangoInicio = rangoInicio,
                            logroId = logro.id,
                            nombreLogro = logro.nombre,
                            mensaje = logro.mensaje,
                            encabezadoRango = preparacion.resumen.rango.encabezado,
                            orden = indice
                        )
                    }
                )
```

Y cambiar la llamada al generador a:

```kotlin
                ResumenVideoGenerator.generarYCompartir(
                    contextoApp, preparacion.resumen, elegida, logrosElegidos
                ) { fraccion -> _progreso.value = fraccion }
```

- [ ] **Step 3: Encadenar los dos diálogos en `ClienteDetailScreen`**

Reemplazar el estado `preparacionMedalla` por tres piezas:

```kotlin
    var preparacionQuincenal by remember {
        mutableStateOf<ResumenClienteViewModel.PreparacionResumenQuincenal?>(null)
    }
    // Elección del primer diálogo, retenida mientras se muestra el segundo.
    var medallaConfirmada by remember { mutableStateOf<MedallaCatalogo?>(null) }
    var eligiendoLogros by remember { mutableStateOf(false) }
```

En la rama `TipoResumen.QUINCENAL` del `SeleccionarRangoResumenDialog`, cambiar la asignación a `preparacionQuincenal = resumenViewModel.prepararConfirmacionQuincenal(fecha)`.

Y reemplazar el bloque `preparacionMedalla?.let { ... }` por:

```kotlin
    preparacionQuincenal?.let { prep ->
        if (!eligiendoLogros) {
            ConfirmarMedallaDialog(
                sugerencia = prep.sugerencia,
                catalogo = prep.catalogo,
                onConfirmar = { elegida ->
                    medallaConfirmada = elegida
                    if (prep.catalogoLogros.isEmpty()) {
                        // Sin catálogo de logros no tiene sentido un diálogo sin opciones.
                        resumenViewModel.confirmarYGenerarQuincenal(context, prep, elegida, emptyList())
                        preparacionQuincenal = null
                        medallaConfirmada = null
                    } else {
                        eligiendoLogros = true
                    }
                },
                onCancelar = {
                    preparacionQuincenal = null
                    medallaConfirmada = null
                }
            )
        } else {
            ConfirmarLogrosDialog(
                catalogo = prep.catalogoLogros,
                onConfirmar = { logros ->
                    resumenViewModel.confirmarYGenerarQuincenal(context, prep, medallaConfirmada, logros)
                    preparacionQuincenal = null
                    medallaConfirmada = null
                    eligiendoLogros = false
                },
                // Cancelar acá aborta toda la generación: tampoco se otorga la medalla, así
                // que el entrenador vuelve al perfil sin efectos secundarios.
                onCancelar = {
                    preparacionQuincenal = null
                    medallaConfirmada = null
                    eligiendoLogros = false
                }
            )
        }
    }
```

- [ ] **Step 4: Verificar que compila y todos los tests pasan**

Run: `./gradlew assembleDebug test`
Expected: BUILD SUCCESSFUL, todos los tests en verde.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/
git commit -m "feat: wire personal achievement selection into the quincenal flow

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Verificación en dispositivo

El render Canvas y las pantallas Compose no tienen test JVM en este repo (no hay precedente), así que la feature no está terminada hasta verse funcionando en un teléfono real. Es el mismo cierre que tuvo cada cambio de escena anterior.

**Files:** ninguno (verificación).

- [ ] **Step 1: Instalar en el dispositivo**

```bash
./gradlew installDebug
```

Con el teléfono conectado por USB y depuración USB activada (`adb devices` debe listarlo como `device`, no `unauthorized`).

- [ ] **Step 2: Crear el catálogo**

En el drawer → "Logros personales": crear al menos 4 logros. Al menos uno **con** imagen propia y al menos dos **sin** imagen (para ver la insignia dibujada y los colores de la paleta). A uno ponerle un mensaje largo que use `$nombrePersona`.

- [ ] **Step 3: Verificar el caso de 1 logro**

Generar el resumen quincenal de un cliente y marcar **un solo** logro. En el video:
- la escena aparece después de la racha y antes de la medalla;
- la insignia es grande y centrada, con el nombre debajo;
- el mensaje se lee completo y `$nombrePersona` salió reemplazado por el nombre del cliente;
- la escena no se corta antes de terminar de animarse.

- [ ] **Step 4: Verificar el caso de 3 logros**

Mismo cliente, misma quincena, ahora marcando **tres**. Verificar que:
- salen las tres insignias en fila, entrando una tras otra;
- los tres nombres se leen y no se encinan entre columnas;
- **no** se dibuja ningún mensaje;
- sigue habiendo una sola escena de logros.

- [ ] **Step 5: Verificar el caso de 4 logros y la idempotencia**

Marcar **cuatro**. Verificar que salen **dos** escenas (3 + 1), y que la segunda muestra el cuarto logro con el layout de uno solo (insignia grande + mensaje).

Después, entrar al perfil del cliente → "Logros personales" y confirmar que **hay exactamente 4** registros para esa quincena, no 8 — es decir, que la regeneración limpió los de la corrida anterior.

- [ ] **Step 6: Verificar que semanal y mensual no cambiaron**

Generar un resumen **semanal** y uno **mensual** del mismo cliente: no debe aparecer ninguna escena de logros personales, ni ningún diálogo nuevo.

- [ ] **Step 7: Verificar el caso de cero logros**

Generar el quincenal sin marcar ninguno: el video no debe traer escena de logros, y la generación no debe fallar.

- [ ] **Step 8: Commit final**

```bash
git add -A
git commit -m "docs: mark personal achievements plan as verified on device

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
