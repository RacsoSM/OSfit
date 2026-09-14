# Archivos locales en la nube — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las canciones y las imágenes de insignias que el entrenador sube queden también en Firebase Storage, y que la app las recupere sola al arrancar si faltan en `filesDir`.

**Architecture:** `filesDir` sigue siendo la fuente que lee el generador de video; la nube es respaldo. Al escribir, la canción se sube además a Storage y su ruta se guarda en el documento de la clienta. Al arrancar, un `RestauradorDeArchivos` —con la misma forma que `SincronizadorDiaWeb`— baja sólo lo que falta en disco. La decisión de qué falta es una función pura y es lo único con pruebas unitarias.

**Tech Stack:** Kotlin, Firebase Storage (`com.google.firebase.storage`), Firestore, Coroutines (`kotlinx.coroutines.tasks.await`), JUnit 4 con `org.junit.Assert`.

**Spec:** `docs/superpowers/specs/2026-09-14-archivos-locales-en-la-nube-design.md`

## Global Constraints

- **`filesDir` no deja de ser la fuente.** Ninguna tarea toca el generador de video ni lo hace depender de la red.
- **Todo campo nuevo de Firestore lleva valor por defecto** (`= null`), como el resto de los modelos: Firestore omite los campos nunca escritos y el documento viejo debe seguir deserializando.
- **Una subida o bajada que falla no rompe nada más.** Cada operación de red va en su propio `runCatching`; el archivo local ya está escrito y el video funciona igual.
- **Carpeta local = carpeta lógica.** Los tres grupos viven en `filesDir/<carpeta>/`, con `carpeta` ∈ {`canciones`, `medallas`, `logrosPersonales`}. No inventar subdirectorios nuevos.
- **Las rutas de insignias se arman con id y carpeta**, nunca se parsean de `imagenUrl`.
- **Idioma:** el código y los comentarios de este repo están en español. Los nombres de test van entre backticks, como en `CupoRevivesCalculatorTest`.

---

### Task 1: El núcleo puro — qué se espera y qué falta

Toda la decisión, sin Firebase ni Android. Es lo único que se prueba con JUnit.

**Files:**
- Create: `app/src/main/java/com/osfit/app/domain/ArchivosQueFaltan.kt`
- Modify: `app/src/main/java/com/osfit/app/data/model/Cliente.kt:35`
- Test: `app/src/test/java/com/osfit/app/domain/ArchivosQueFaltanTest.kt`

**Interfaces:**
- Consumes: `com.osfit.app.data.model.Cliente`, `MedallaCatalogo`, `LogroPersonalCatalogo` (ya existen).
- Produces:
  - `data class ArchivoEsperado(val nombreLocal: String, val carpeta: String, val rutaRemota: String?)`
  - `ArchivosQueFaltan.esperadosDe(clientes: List<Cliente>, medallas: List<MedallaCatalogo>, logros: List<LogroPersonalCatalogo>): List<ArchivoEsperado>`
  - `ArchivosQueFaltan.calcular(esperados: List<ArchivoEsperado>, existeEnDisco: (ArchivoEsperado) -> Boolean): List<ArchivoEsperado>`
  - `Cliente.cancionRuta: String?`

- [ ] **Step 1: Añadir `cancionRuta` al modelo**

En `app/src/main/java/com/osfit/app/data/model/Cliente.kt`, justo debajo de `cancionArchivo` (línea 35):

```kotlin
    // Nombre del archivo dentro de filesDir/canciones/ (no la URI original: se copia al
    // elegirla para no depender de un permiso de content:// que puede revocarse).
    val cancionArchivo: String? = null,
    // Ruta del respaldo en Storage, `canciones/<clienteId>.<ext>`. Se guarda la ruta y no la
    // URL de descarga por el mismo motivo que los resúmenes: una URL permanente dentro del
    // documento vale sin sesión. null = clienta anterior a este campo, o subida que falló;
    // en los dos casos no hay nada que restaurar.
    val cancionRuta: String? = null,
    val cancionInicioSegundos: Int? = null,
```

- [ ] **Step 2: Escribir las pruebas que fallan**

Crear `app/src/test/java/com/osfit/app/domain/ArchivosQueFaltanTest.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.MedallaCatalogo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Desinstalar borra filesDir. Estas pruebas fijan las dos mitades de la decisión: qué
 * archivos deberían estar, y cuáles hay que bajar porque no están.
 */
class ArchivosQueFaltanTest {

    private val cancionDeAna = ArchivoEsperado("ana.mp3", "canciones", "canciones/ana.mp3")

    @Test
    fun `si todo esta en disco no baja nada`() {
        val faltantes = ArchivosQueFaltan.calcular(listOf(cancionDeAna)) { true }
        assertTrue(faltantes.isEmpty())
    }

    @Test
    fun `baja lo que falta en disco y tiene respaldo`() {
        val faltantes = ArchivosQueFaltan.calcular(listOf(cancionDeAna)) { false }
        assertEquals(listOf(cancionDeAna), faltantes)
    }

    @Test
    fun `lo que falta sin respaldo no se intenta bajar`() {
        val sinRespaldo = ArchivoEsperado("ana.mp3", "canciones", rutaRemota = null)
        val faltantes = ArchivosQueFaltan.calcular(listOf(sinRespaldo)) { false }
        assertTrue(faltantes.isEmpty())
    }

    @Test
    fun `una clienta sin cancion no espera ningun archivo`() {
        val ana = Cliente(id = "ana", cancionArchivo = null, cancionRuta = null)
        val esperados = ArchivosQueFaltan.esperadosDe(listOf(ana), emptyList(), emptyList())
        assertTrue(esperados.isEmpty())
    }

    @Test
    fun `la cancion de una clienta usa la ruta guardada en su documento`() {
        val ana = Cliente(id = "ana", cancionArchivo = "ana.mp3", cancionRuta = "canciones/ana.mp3")
        val esperados = ArchivosQueFaltan.esperadosDe(listOf(ana), emptyList(), emptyList())
        assertEquals(listOf(cancionDeAna), esperados)
    }

    @Test
    fun `una cancion de antes de este campo se espera pero sin respaldo`() {
        val ana = Cliente(id = "ana", cancionArchivo = "ana.mp3", cancionRuta = null)
        val esperados = ArchivosQueFaltan.esperadosDe(listOf(ana), emptyList(), emptyList())
        assertEquals(listOf(ArchivoEsperado("ana.mp3", "canciones", null)), esperados)
    }

    @Test
    fun `la imagen de una medalla se arma con su id, no con su imagenUrl`() {
        val medalla = MedallaCatalogo(
            id = "constancia",
            imagenArchivo = "constancia.png",
            imagenUrl = "https://firebasestorage.example/cualquier-cosa?token=abc"
        )
        val esperados = ArchivosQueFaltan.esperadosDe(emptyList(), listOf(medalla), emptyList())
        assertEquals(
            listOf(ArchivoEsperado("constancia.png", "medallas", "insignias/medallas/constancia.png")),
            esperados
        )
    }

    @Test
    fun `una medalla que nunca se subio no tiene respaldo`() {
        val medalla = MedallaCatalogo(id = "constancia", imagenArchivo = "constancia.png", imagenUrl = null)
        val esperados = ArchivosQueFaltan.esperadosDe(emptyList(), listOf(medalla), emptyList())
        assertEquals(listOf(ArchivoEsperado("constancia.png", "medallas", null)), esperados)
    }

    @Test
    fun `un logro personal apunta a su propia carpeta`() {
        val logro = LogroPersonalCatalogo(
            id = "primer_mes",
            imagenArchivo = "primer_mes.png",
            imagenUrl = "https://firebasestorage.example/x"
        )
        val esperados = ArchivosQueFaltan.esperadosDe(emptyList(), emptyList(), listOf(logro))
        assertEquals(
            listOf(
                ArchivoEsperado(
                    "primer_mes.png",
                    "logrosPersonales",
                    "insignias/logrosPersonales/primer_mes.png"
                )
            ),
            esperados
        )
    }

    @Test
    fun `una medalla sin imagen propia no espera archivo`() {
        val medalla = MedallaCatalogo(id = "racha", imagenArchivo = null)
        val esperados = ArchivosQueFaltan.esperadosDe(emptyList(), listOf(medalla), emptyList())
        assertTrue(esperados.isEmpty())
    }
}
```

- [ ] **Step 3: Correr las pruebas y ver que fallan**

Run: `./gradlew :app:testDebugUnitTest --tests "*ArchivosQueFaltanTest*"`
Expected: FAIL — `Unresolved reference: ArchivosQueFaltan` y `Unresolved reference: ArchivoEsperado`.

- [ ] **Step 4: Escribir la implementación mínima**

Crear `app/src/main/java/com/osfit/app/domain/ArchivosQueFaltan.kt`:

```kotlin
package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.MedallaCatalogo

/**
 * Un archivo que debería estar en `filesDir/<carpeta>/<nombreLocal>`, y de dónde bajarlo si
 * no está. [rutaRemota] nula significa "no hay respaldo": se sabe que el archivo debería
 * existir, pero no hay de dónde recuperarlo.
 */
data class ArchivoEsperado(
    val nombreLocal: String,
    val carpeta: String,
    val rutaRemota: String?
)

/**
 * Decide qué hay que bajar al arrancar. Está separado de quien lo baja a propósito: así la
 * regla —"sólo lo que falta, y sólo si hay de dónde"— se prueba sin Firebase ni dispositivo,
 * que es donde esta clase de bug se esconde.
 */
object ArchivosQueFaltan {

    /**
     * Las rutas de insignias se arman con el id y la carpeta, igual que las construye
     * `InsigniaStorageRepository.subir` al subirlas. No se parsea `imagenUrl`: esa URL existe
     * para que la web pinte un `<img src>` sin cargar el SDK, y su forma no es asunto nuestro.
     * Que `imagenUrl` sea nula sí importa, porque es la única señal de que la imagen nunca
     * llegó a Storage.
     */
    fun esperadosDe(
        clientes: List<Cliente>,
        medallas: List<MedallaCatalogo>,
        logros: List<LogroPersonalCatalogo>
    ): List<ArchivoEsperado> {
        val deCanciones = clientes.mapNotNull { cliente ->
            cliente.cancionArchivo?.let { nombre ->
                ArchivoEsperado(nombre, "canciones", cliente.cancionRuta)
            }
        }
        val deMedallas = medallas.mapNotNull { medalla ->
            medalla.imagenArchivo?.let { nombre ->
                ArchivoEsperado(
                    nombre,
                    "medallas",
                    medalla.imagenUrl?.let { "insignias/medallas/${medalla.id}.png" }
                )
            }
        }
        val deLogros = logros.mapNotNull { logro ->
            logro.imagenArchivo?.let { nombre ->
                ArchivoEsperado(
                    nombre,
                    "logrosPersonales",
                    logro.imagenUrl?.let { "insignias/logrosPersonales/${logro.id}.png" }
                )
            }
        }
        return deCanciones + deMedallas + deLogros
    }

    /**
     * [existeEnDisco] entra como parámetro y no como acceso directo al sistema de archivos
     * para poder probar esto sin tocar disco. Si el archivo está, no se toca la red: en un
     * arranque normal esta función devuelve la lista vacía.
     */
    fun calcular(
        esperados: List<ArchivoEsperado>,
        existeEnDisco: (ArchivoEsperado) -> Boolean
    ): List<ArchivoEsperado> =
        esperados.filter { it.rutaRemota != null && !existeEnDisco(it) }
}
```

- [ ] **Step 5: Correr las pruebas y ver que pasan**

Run: `./gradlew :app:testDebugUnitTest --tests "*ArchivosQueFaltanTest*"`
Expected: PASS, 10 pruebas.

- [ ] **Step 6: Correr la suite entera para no haber roto nada**

Run: `./gradlew test`
Expected: BUILD SUCCESSFUL. Antes de esta tarea eran 232 pruebas; ahora deben ser 242.

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app/domain/ArchivosQueFaltan.kt app/src/test/java/com/osfit/app/domain/ArchivosQueFaltanTest.kt app/src/main/java/com/osfit/app/data/model/Cliente.kt
git commit -m "feat: decide which local files are missing and can be restored"
```

---

### Task 2: Subir y bajar de Storage

Las dos operaciones de red. No llevan pruebas unitarias: son llamadas al SDK de Firebase, y un test con mocks sólo comprobaría que el mock se llamó. Se verifican en dispositivo en la Task 6.

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/repository/CancionStorageRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/data/repository/InsigniaStorageRepository.kt`
- Modify: `app/src/main/java/com/osfit/app/data/AppContainer.kt`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `CancionStorageRepository.subir(clienteId: String, archivo: File): String` — sube y devuelve la ruta (`canciones/<nombre>`).
  - `CancionStorageRepository.bajar(ruta: String, destino: File)` — descarga a `destino`.
  - `InsigniaStorageRepository.bajar(ruta: String, destino: File)` — misma firma, para insignias.
  - `AppContainer.cancionStorageRepository`

- [ ] **Step 1: Crear `CancionStorageRepository`**

Crear `app/src/main/java/com/osfit/app/data/repository/CancionStorageRepository.kt`:

```kotlin
package com.osfit.app.data.repository

import android.net.Uri
import com.google.firebase.storage.FirebaseStorage
import java.io.File
import kotlinx.coroutines.tasks.await

/**
 * Respaldo de las canciones en `canciones/<nombreArchivo>`, donde el nombre ya es
 * `<clienteId>.<ext>`.
 *
 * Devuelve la RUTA y no la URL de descarga, al revés que las insignias. El motivo es el mismo
 * que con los resúmenes: la URL de descarga lleva su token dentro y vale sin sesión, así que
 * guardarla en el documento de la clienta la dejaría accesible a cualquiera que lo lea. La
 * ruta obliga a pasar por las reglas de Storage.
 */
class CancionStorageRepository(
    private val storage: FirebaseStorage = FirebaseStorage.getInstance()
) {
    /**
     * [clienteId] entra aunque el nombre del archivo ya lo contenga: deja la llamada legible
     * en el sitio donde se usa y hace evidente de quién es la canción que se sube.
     */
    suspend fun subir(clienteId: String, archivo: File): String {
        val ruta = "canciones/${archivo.name}"
        storage.reference.child(ruta).putFile(Uri.fromFile(archivo)).await()
        return ruta
    }

    suspend fun bajar(ruta: String, destino: File) {
        destino.parentFile?.mkdirs()
        storage.reference.child(ruta).getFile(destino).await()
    }
}
```

- [ ] **Step 2: Añadir `bajar` a `InsigniaStorageRepository`**

En `app/src/main/java/com/osfit/app/data/repository/InsigniaStorageRepository.kt`, dentro de la clase, después de `subirLogro` y antes del `private suspend fun subir`:

```kotlin
    /**
     * Baja una insignia del catálogo a [destino]. La ruta la arma quien llama con el id y la
     * carpeta (ver `ArchivosQueFaltan.esperadosDe`), no se saca de `imagenUrl`.
     */
    suspend fun bajar(ruta: String, destino: File) {
        destino.parentFile?.mkdirs()
        storage.reference.child(ruta).getFile(destino).await()
    }
```

El archivo ya importa `java.io.File` y `kotlinx.coroutines.tasks.await`, así que no hacen falta imports nuevos.

- [ ] **Step 3: Registrar `CancionStorageRepository` en `AppContainer`**

En `app/src/main/java/com/osfit/app/data/AppContainer.kt`, añadir el import:

```kotlin
import com.osfit.app.data.repository.CancionStorageRepository
```

y, junto a `insigniaStorageRepository`:

```kotlin
    val cancionStorageRepository: CancionStorageRepository by lazy { CancionStorageRepository() }
```

- [ ] **Step 4: Compilar**

Run: `./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/repository/CancionStorageRepository.kt app/src/main/java/com/osfit/app/data/repository/InsigniaStorageRepository.kt app/src/main/java/com/osfit/app/data/AppContainer.kt
git commit -m "feat: back songs up to Storage and allow downloading either kind of file"
```

---

### Task 3: Subir la canción al elegirla

El camino de escritura. Al terminar esta tarea, toda canción nueva queda respaldada; las de antes siguen sin respaldo hasta que se vuelvan a elegir.

**Files:**
- Modify: `app/src/main/java/com/osfit/app/data/repository/ClienteRepository.kt:25`
- Modify: `app/src/main/java/com/osfit/app/data/repository/FirestoreClienteRepository.kt:87-92`
- Modify: `app/src/main/java/com/osfit/app/data/fake/FakeClienteRepository.kt:161-165`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt:177-181`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/ClienteEditarScreen.kt:71-110`

**Interfaces:**
- Consumes: `CancionStorageRepository.subir(clienteId, archivo)` y `AppContainer.cancionStorageRepository` (Task 2); `Cliente.cancionRuta` (Task 1).
- Produces: `ClienteRepository.actualizarCancion(clienteId: String, archivo: String?, ruta: String?, inicioSegundos: Int?)` — un parámetro más, en tercer lugar.

- [ ] **Step 1: Ampliar la interfaz del repositorio**

En `ClienteRepository.kt`, la línea 25 pasa a:

```kotlin
    suspend fun actualizarCancion(clienteId: String, archivo: String?, ruta: String?, inicioSegundos: Int?)
```

- [ ] **Step 2: Implementarlo en Firestore**

En `FirestoreClienteRepository.kt`, la función de la línea 87:

```kotlin
    override suspend fun actualizarCancion(
        clienteId: String,
        archivo: String?,
        ruta: String?,
        inicioSegundos: Int?
    ) {
        coleccion.document(clienteId).update(
            mapOf(
                "cancionArchivo" to archivo,
                "cancionRuta" to ruta,
                "cancionInicioSegundos" to inicioSegundos
            )
        ).await()
    }
```

Lo único que se añade es el parámetro `ruta` y la entrada `"cancionRuta"` del mapa; el resto del cuerpo se conserva tal como esté.

- [ ] **Step 3: Actualizar el fake**

En `FakeClienteRepository.kt`, la función de la línea 161 pasa a:

```kotlin
    override suspend fun actualizarCancion(
        clienteId: String,
        archivo: String?,
        ruta: String?,
        inicioSegundos: Int?
    ) {
        actualizarCliente(clienteId) {
            it.copy(
                cancionArchivo = archivo,
                cancionRuta = ruta,
                cancionInicioSegundos = inicioSegundos
            )
        }
    }
```

El helper se llama `actualizarCliente` y ya lo usan todos los demás métodos del fake.

- [ ] **Step 4: Pasar la ruta desde el ViewModel**

En `ClienteDetailViewModel.kt`, la función de la línea 177:

```kotlin
    fun actualizarCancion(archivo: String?, ruta: String?, inicioSegundos: Int?) {
        viewModelScope.launch {
            clienteRepository.actualizarCancion(clienteId, archivo, ruta, inicioSegundos)
        }
    }
```

- [ ] **Step 5: Subir al elegir la canción**

En `ClienteEditarScreen.kt`. Añadir los imports `androidx.compose.runtime.rememberCoroutineScope`, `kotlinx.coroutines.launch` y `com.osfit.app.data.AppContainer` si no están. El estado y el selector quedan:

```kotlin
    var cancionArchivo by remember { mutableStateOf(clienteActual.cancionArchivo) }
    var cancionRuta by remember { mutableStateOf(clienteActual.cancionRuta) }
    var inicioSegundos by remember { mutableStateOf(clienteActual.cancionInicioSegundos ?: 0) }
    val alcance = rememberCoroutineScope()

    val selectorCancion = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val archivoAnterior = cancionArchivo
            val nuevoArchivo = CancionUtil.copiarCancion(context, uri, clienteId)
            if (nuevoArchivo != null) {
                // El nombre siempre es "<clienteId>.<ext>": si cambia la extensión, el archivo
                // viejo con otra extensión se queda huérfano y hay que borrarlo aparte.
                if (archivoAnterior != null && archivoAnterior != nuevoArchivo) {
                    CancionUtil.eliminarCancion(context, archivoAnterior)
                }
                cancionArchivo = nuevoArchivo
                inicioSegundos = 0
                // La copia local ya está hecha y el video funciona con ella. El respaldo se
                // intenta después: si falla, la ruta se queda nula y esta canción se reintenta
                // la próxima vez que se elija. Nada más se rompe mientras tanto.
                cancionRuta = null
                alcance.launch {
                    val subida = runCatching {
                        AppContainer.cancionStorageRepository.subir(
                            clienteId,
                            CancionUtil.archivoCancion(context, nuevoArchivo)
                        )
                    }.getOrNull()
                    if (subida != null) cancionRuta = subida
                }
            }
        }
    }
```

- [ ] **Step 6: Pasar la ruta al guardar**

En el `onClick` del botón Guardar del mismo archivo (alrededor de la línea 105):

```kotlin
                    viewModel.actualizarCancion(
                        archivo = cancionArchivo,
                        ruta = cancionArchivo?.let { cancionRuta },
                        inicioSegundos = cancionArchivo?.let { inicioSegundos }
                    )
```

El `cancionArchivo?.let { ... }` replica el criterio que ya se usa con `inicioSegundos`: sin canción no hay ruta ni inicio que guardar.

- [ ] **Step 7: Compilar y correr toda la suite**

Run: `./gradlew :app:compileDebugKotlin test`
Expected: BUILD SUCCESSFUL, 242 pruebas en verde. Si alguna falla por la firma nueva de `actualizarCancion`, arreglar la llamada — no revertir la firma.

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/repository/ClienteRepository.kt app/src/main/java/com/osfit/app/data/repository/FirestoreClienteRepository.kt app/src/main/java/com/osfit/app/data/fake/FakeClienteRepository.kt app/src/main/java/com/osfit/app/ui/clientes/ClienteDetailViewModel.kt app/src/main/java/com/osfit/app/ui/clientes/ClienteEditarScreen.kt
git commit -m "feat: back a song up to Storage when the trainer picks it"
```

---

### Task 4: El restaurador

El camino de lectura, y el único sitio que responde "¿quién restaura?".

**Files:**
- Create: `app/src/main/java/com/osfit/app/data/RestauradorDeArchivos.kt`
- Modify: `app/src/main/java/com/osfit/app/data/AppContainer.kt`
- Modify: `app/src/main/java/com/osfit/app/MainActivity.kt`

**Interfaces:**
- Consumes: `ArchivosQueFaltan.esperadosDe(...)`, `ArchivosQueFaltan.calcular(...)` y `ArchivoEsperado` (Task 1); `CancionStorageRepository.bajar(ruta, destino)` e `InsigniaStorageRepository.bajar(ruta, destino)` (Task 2).
- Produces: `RestauradorDeArchivos.restaurar(context: Context)`, suspendida; `AppContainer.restauradorDeArchivos`.

- [ ] **Step 1: Crear la clase**

Crear `app/src/main/java/com/osfit/app/data/RestauradorDeArchivos.kt`:

```kotlin
package com.osfit.app.data

import android.content.Context
import com.osfit.app.data.repository.CancionStorageRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.InsigniaStorageRepository
import com.osfit.app.data.repository.LogroPersonalRepository
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.domain.ArchivoEsperado
import com.osfit.app.domain.ArchivosQueFaltan
import java.io.File
import kotlinx.coroutines.flow.first

/**
 * Único lugar que vuelve a bajar a `filesDir` lo que se subió a Storage.
 *
 * Existe como clase aparte por el mismo motivo que [SincronizadorDiaWeb]: el riesgo de este
 * diseño es "un camino que olvidó restaurar", y concentrarlo hace que la pregunta "¿quién
 * restaura?" se responda leyendo un solo archivo.
 *
 * Es idempotente y barato: si los archivos están, no toca la red. En un arranque normal no
 * baja nada.
 */
class RestauradorDeArchivos(
    private val clienteRepository: ClienteRepository,
    private val medallaRepository: MedallaRepository,
    private val logroPersonalRepository: LogroPersonalRepository,
    private val cancionStorageRepository: CancionStorageRepository,
    private val insigniaStorageRepository: InsigniaStorageRepository
) {
    suspend fun restaurar(context: Context) {
        val esperados = ArchivosQueFaltan.esperadosDe(
            clientes = clienteRepository.observarClientes().first(),
            medallas = medallaRepository.observarCatalogo().first(),
            logros = logroPersonalRepository.observarCatalogo().first()
        )
        val faltantes = ArchivosQueFaltan.calcular(esperados) { archivoDe(context, it).exists() }

        // Archivo por archivo: una descarga caída no debe llevarse las demás. La que falle se
        // reintenta sola en el siguiente arranque, porque el criterio es "falta en disco" y
        // seguirá faltando. Por eso no hace falta ni estado ni reintentos propios.
        faltantes.forEach { esperado ->
            val ruta = esperado.rutaRemota ?: return@forEach
            runCatching {
                val destino = archivoDe(context, esperado)
                if (esperado.carpeta == CARPETA_CANCIONES) {
                    cancionStorageRepository.bajar(ruta, destino)
                } else {
                    insigniaStorageRepository.bajar(ruta, destino)
                }
            }
        }
    }

    private fun archivoDe(context: Context, esperado: ArchivoEsperado): File =
        File(File(context.filesDir, esperado.carpeta), esperado.nombreLocal)

    private companion object {
        const val CARPETA_CANCIONES = "canciones"
    }
}
```

- [ ] **Step 2: Registrarlo en `AppContainer`**

En `app/src/main/java/com/osfit/app/data/AppContainer.kt`, junto a `sincronizadorDiaWeb`:

```kotlin
    val restauradorDeArchivos: RestauradorDeArchivos by lazy {
        RestauradorDeArchivos(
            clienteRepository,
            medallaRepository,
            logroPersonalRepository,
            cancionStorageRepository,
            insigniaStorageRepository
        )
    }
```

`RestauradorDeArchivos` vive en el mismo paquete `com.osfit.app.data`, así que no hace falta importarlo.

- [ ] **Step 3: Dispararlo al arrancar**

`app/src/main/java/com/osfit/app/MainActivity.kt` queda entero así:

```kotlin
package com.osfit.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.osfit.app.auth.AuthManager
import com.osfit.app.data.AppContainer
import com.osfit.app.ui.OSfitApp
import com.osfit.app.ui.theme.OSfitTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val authManager = AuthManager()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // En segundo plano y sin bloquear la interfaz: restaurar no corre prisa, sólo hace
        // falta antes del próximo video. Si falla del todo, el peor caso es el de hoy.
        lifecycleScope.launch {
            runCatching { AppContainer.restauradorDeArchivos.restaurar(applicationContext) }
        }
        setContent {
            OSfitTheme {
                OSfitApp(authManager = authManager)
            }
        }
    }
}
```

`lifecycleScope` viene de `androidx.lifecycle:lifecycle-runtime-ktx:2.8.7`, que ya está en `app/build.gradle.kts:77`. No hay que añadir dependencias.

- [ ] **Step 4: Compilar y correr toda la suite**

Run: `./gradlew :app:compileDebugKotlin test`
Expected: BUILD SUCCESSFUL, 242 pruebas en verde.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/osfit/app/data/RestauradorDeArchivos.kt app/src/main/java/com/osfit/app/data/AppContainer.kt app/src/main/java/com/osfit/app/MainActivity.kt
git commit -m "feat: restore missing local files from Storage at startup"
```

---

### Task 5: La regla de Storage

Sin esto la subida de canciones se rechaza y el respaldo nunca llega a existir.

**Files:**
- Modify: `storage.rules`

**Interfaces:**
- Consumes: la ruta `canciones/<clienteId>.<ext>` que produce `CancionStorageRepository.subir` (Task 2).
- Produces: nada de código.

- [ ] **Step 1: Añadir la regla**

En `storage.rules`, después del bloque `match /resumenes/{clienteId}/{archivo}` y dentro del mismo `match /b/{bucket}/o`:

```
    // Las canciones son el respaldo de filesDir/canciones/, y sólo las usa el generador de
    // video del entrenador. La web no las necesita: la música ya va dentro del mp4 generado,
    // no como archivo aparte. Por eso acá no hay esCliente() y en resumenes/ sí.
    match /canciones/{archivo} {
      allow read, write: if esEntrenador();
    }
```

El patrón es `{archivo}` y no `{clienteId}/{archivo}`: la ruta es plana (`canciones/<clienteId>.<ext>`), así que un segmento de más no casaría nunca.

- [ ] **Step 2: Desplegar sólo las reglas**

Run: `firebase deploy --only storage`
Expected: `Deploy complete!`

- [ ] **Step 3: Commit**

```bash
git add storage.rules
git commit -m "feat: let the trainer read and write the song backups"
```

---

### Task 6: Verificación en dispositivo y backlog

Lo único que prueba de verdad que esto sirve.

**Antes de empezar hay que poder instalar la app.** Ver la entrada 11 del backlog: la APK firmada en esta máquina no entra encima de la que trae el teléfono (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`), porque esa build se firmó en la otra laptop. Lo barato es copiar su `~/.android/debug.keystore`. **No desinstalar para salir del paso antes de tener esta funcionalidad instalada**: sería borrar justamente las canciones que aún no tienen respaldo.

**Files:**
- Modify: `docs/backlog.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada de código.

- [ ] **Step 1: Instalar y comprobar el camino feliz**

1. Elegir una canción para una clienta de prueba y guardar.
2. En la consola de Firebase → Storage, comprobar que aparece `canciones/<clienteId>.<ext>`.
3. En Firestore, comprobar que su documento tiene `cancionRuta` con esa misma ruta.
4. Generar un video suyo y comprobar que suena la música.

- [ ] **Step 2: La prueba que importa — sobrevivir a la desinstalación**

1. Desinstalar la app.
2. Reinstalarla y abrirla. Dejarla abierta unos segundos con red.
3. Sin tocar nada más, generar el video de esa clienta.
4. **Esperado:** sale con su música y con las imágenes de las medallas, sin haber vuelto a elegir nada.

Si la música no está, mirar primero si el archivo bajó a `filesDir/canciones/`: eso distingue un fallo de descarga de uno del generador.

- [ ] **Step 3: Comprobar que un arranque normal no baja nada**

Cerrar y volver a abrir la app con todo ya en disco, con el logcat abierto. No debe haber tráfico de Storage. Es la mitad de la regla que un test no puede ver, y si se rompe, la app baja archivos en cada arranque.

- [ ] **Step 4: Marcar el backlog**

En `docs/backlog.md`, añadir una entrada nueva, siguiendo la convención del archivo (las entradas se marcan, no se borran), con el encabezado:

`## 14. Los archivos locales sobreviven a una desinstalación — ✅ HECHO (fecha)`

Decir qué se verificó y qué no. Anotar explícitamente que las canciones anteriores a este cambio siguieron sin respaldo hasta volverse a elegir, y si se perdió alguna al desinstalar.

- [ ] **Step 5: Commit**

```bash
git add docs/backlog.md
git commit -m "docs: record that local files now survive an uninstall"
```
