# Paleta de la web del cliente: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Que el entrenador elija, desde la app, la paleta de colores de la página web de cada clienta, con el mismo catálogo que ya usan los videos y diez paletas nuevas.

**Architecture:** El catálogo de paletas se muda de `video/` a `paletas/` y gana cuatro colores de web junto a los cuatro de video, quedando como el único lugar del proyecto donde se define un color de marca. La app resuelve la paleta elegida a hex y los guarda en el documento de la clienta; la web lee esos hex y los vuelca como variables CSS, sin saber qué es una paleta.

**Tech Stack:** Kotlin + Jetpack Compose + Firestore (app), TypeScript + Vite + Vitest (web). Pruebas: JUnit 4 (`gradlew test`) y Vitest (`npm test` en `web/`).

**Spec:** `docs/superpowers/specs/2026-09-13-paleta-web-cliente-design.md`

## Global Constraints

- **Los `id` de las cinco paletas existentes no cambian:** `aqua_noche`, `atardecer`, `bosque`, `ultravioleta`, `brasa`. Están guardados en los documentos de `configVideo`; cambiarlos haría que toda quincena configurada cayera en la paleta por defecto.
- **Los colores de video de esas cinco paletas no cambian.** Ni un dígito.
- **Dos por defecto distintos:** `porDefectoVideo = AQUA_NOCHE`, `porDefectoWeb = MORADO_OSFIT`. El despliegue no debe cambiar el aspecto de ningún video ni de ninguna página por su cuenta.
- **`AQUA_NOCHE` sigue siendo el primer elemento de `Paletas.disponibles`** (hay una prueba que lo exige).
- **`firestore.rules` no se toca.** `clientes/{cid}` ya permite a la clienta leer lo suyo.
- **Los colores se escriben como `Int` ARGB en Kotlin** (`0xFFRRGGBB.toInt()`) y como string `#RRGGBB` en Firestore y en la web.
- **Idioma:** nombres de paleta, textos de UI, comentarios y nombres de prueba en español, como el resto del proyecto.
- **Contraste mínimo 4.5:1** de `webPrimario` sobre `#121212` y de `webSobrePrimario` sobre su propio `webPrimario`, en las 15.
- **Vitest corre en Node, sin `jsdom`:** no hay `document` en las pruebas de la web. Toda función de la web que toque el DOM recibe el elemento como parámetro.

---

### Task 1: Mudar y renombrar el catálogo

Renombrado mecánico, sin ningún cambio de comportamiento ni de color. Se hace solo para que el catálogo deje de vivir en `video/` antes de que la web dependa de él.

**Files:**
- Create: `app/src/main/java/com/osfit/app/paletas/Paleta.kt` (movido desde `app/src/main/java/com/osfit/app/video/PaletaVideo.kt`)
- Delete: `app/src/main/java/com/osfit/app/video/PaletaVideo.kt`
- Modify: `app/src/main/java/com/osfit/app/data/repository/ConfigVideoRepository.kt:4-5,37,41`
- Modify: `app/src/main/java/com/osfit/app/ui/configvideo/ConfigVideoScreen.kt:34-35,83,116`
- Modify: `app/src/main/java/com/osfit/app/ui/configvideo/ConfigVideoViewModel.kt:9-10,22,49`
- Modify: `app/src/main/java/com/osfit/app/video/BlobsGeometria.kt:27`
- Modify: `app/src/main/java/com/osfit/app/video/FondoBlobRenderer.kt:31`
- Modify: `app/src/main/java/com/osfit/app/video/ResumenFrameRenderer.kt:174,192,218,446,542,680`
- Test: `app/src/test/java/com/osfit/app/paletas/PaletasTest.kt` (movido desde `app/src/test/java/com/osfit/app/video/PaletasVideoTest.kt`)
- Modify: `app/src/test/java/com/osfit/app/video/BlobsGeometriaTest.kt:9,38,45`

**Interfaces:**
- Consumes: nada.
- Produces: `com.osfit.app.paletas.Paleta` (data class con `id: String`, `nombre: String`, `blobA: Int`, `blobB: Int`, `blobC: Int`, `destacado: Int`); `com.osfit.app.paletas.Paletas` con `disponibles: List<Paleta>`, `porDefectoVideo: Paleta`, `porIdVideo(id: String?): Paleta`.

- [x] **Step 1: Mover el archivo conservando el historial**

```bash
mkdir -p app/src/main/java/com/osfit/app/paletas
git mv app/src/main/java/com/osfit/app/video/PaletaVideo.kt app/src/main/java/com/osfit/app/paletas/Paleta.kt
mkdir -p app/src/test/java/com/osfit/app/paletas
git mv app/src/test/java/com/osfit/app/video/PaletasVideoTest.kt app/src/test/java/com/osfit/app/paletas/PaletasTest.kt
```

- [x] **Step 2: Renombrar dentro de `Paleta.kt`**

Cambios exactos en `app/src/main/java/com/osfit/app/paletas/Paleta.kt`:

- `package com.osfit.app.video` → `package com.osfit.app.paletas`
- `data class PaletaVideo(` → `data class Paleta(`
- `object PaletasVideo {` → `object Paletas {`
- las cinco `private val X = PaletaVideo(` → `private val X = Paleta(`
- `val disponibles: List<PaletaVideo>` → `val disponibles: List<Paleta>`
- `val porDefecto: PaletaVideo = AQUA_NOCHE` → `val porDefectoVideo: Paleta = AQUA_NOCHE`
- `fun porId(id: String?): PaletaVideo =` → `fun porIdVideo(id: String?): Paleta =`
- dentro de `porIdVideo`, `?: porDefecto` → `?: porDefectoVideo`

El KDoc de la clase menciona "video" en todas sus frases y sigue siendo correcto en esta tarea: los campos que describe sí son los del video. La Task 2 lo reescribe cuando deje de serlo.

- [x] **Step 3: Actualizar los consumidores**

En los seis archivos de `main` listados arriba: sustituir `PaletaVideo` por `Paleta` y `PaletasVideo` por `Paletas`, y cambiar los imports `com.osfit.app.video.PaletaVideo` / `com.osfit.app.video.PaletasVideo` por `com.osfit.app.paletas.Paleta` / `com.osfit.app.paletas.Paletas`.

`BlobsGeometria.kt`, `FondoBlobRenderer.kt` y `ResumenFrameRenderer.kt` están en el paquete `com.osfit.app.video`, así que ahora **necesitan import explícito** de `com.osfit.app.paletas.Paleta`; antes no lo tenían porque la clase vivía en su mismo paquete. Es el error de compilación más probable de esta tarea.

Dos llamadas cambian de nombre, no solo de tipo:
- `ConfigVideoRepository.kt:41`: `PaletasVideo.porId(id)` → `Paletas.porIdVideo(id)`
- `ConfigVideoViewModel.kt:49`: `PaletasVideo.porId(paletasPorPeriodo[rangoInicio])` → `Paletas.porIdVideo(paletasPorPeriodo[rangoInicio])`

En `ConfigVideoPeriodo.kt:9` hay un comentario que dice "ver PaletasVideo"; cambiarlo a "ver Paletas".

- [x] **Step 4: Actualizar las pruebas**

En `app/src/test/java/com/osfit/app/paletas/PaletasTest.kt`: `package com.osfit.app.video` → `package com.osfit.app.paletas`, `class PaletasVideoTest` → `class PaletasTest`, todo `PaletasVideo.` → `Paletas.`, y `porDefecto` → `porDefectoVideo` y `porId(` → `porIdVideo(` en los cinco tests que los usan.

En `app/src/test/java/com/osfit/app/video/BlobsGeometriaTest.kt`: añadir `import com.osfit.app.paletas.Paletas`, y cambiar `PaletasVideo.porDefecto` → `Paletas.porDefectoVideo`, `PaletasVideo.porId("atardecer")` → `Paletas.porIdVideo("atardecer")`, `PaletasVideo.disponibles` → `Paletas.disponibles`.

- [x] **Step 5: Comprobar que nada quedó colgando**

```bash
grep -rn "PaletaVideo\|PaletasVideo" app/src
```

Esperado: sin resultados.

- [x] **Step 6: Compilar y correr las pruebas**

```bash
./gradlew :app:compileDebugKotlin test
```

Esperado: BUILD SUCCESSFUL. Las pruebas de `PaletasTest` y `BlobsGeometriaTest` pasan exactamente como antes — este renombrado no cambia ningún comportamiento, así que una prueba roja aquí significa que se tocó algo de más.

- [x] **Step 7: Commit**

```bash
git add -A app/src
git commit -m "refactor: move the palette catalogue out of the video package

The web is about to pick from the same list, and a client screen importing
from video/ would not explain itself."
```

---

### Task 2: Los colores de web y las diez paletas nuevas

**Files:**
- Modify: `app/src/main/java/com/osfit/app/paletas/Paleta.kt`
- Test: `app/src/test/java/com/osfit/app/paletas/PaletasTest.kt`

**Interfaces:**
- Consumes: `Paleta`, `Paletas` de la Task 1.
- Produces: `Paleta` con cuatro campos más — `webPrimario: Int`, `webPrimarioOscuro: Int`, `webPrimarioClaro: Int`, `webSobrePrimario: Int`; `Paletas.porDefectoWeb: Paleta`; `Paletas.porIdWeb(id: String?): Paleta`. `Paletas.disponibles` pasa a tener 15 elementos, con `AQUA_NOCHE` primero.

- [x] **Step 1: Escribir las pruebas que fallan**

Añadir a `app/src/test/java/com/osfit/app/paletas/PaletasTest.kt`, dentro de la clase:

```kotlin
    /** Luminancia relativa de WCAG 2.1, sobre los ocho bits bajos de cada canal. */
    private fun luminancia(color: Int): Double {
        val canales = listOf(16, 8, 0).map { ((color shr it) and 0xFF) / 255.0 }
        val lineal = canales.map {
            if (it <= 0.03928) it / 12.92 else Math.pow((it + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2]
    }

    private fun contraste(a: Int, b: Int): Double {
        val la = luminancia(a)
        val lb = luminancia(b)
        return (maxOf(la, lb) + 0.05) / (minOf(la, lb) + 0.05)
    }

    /** El fondo de la web, que no cambia con la paleta (ver estilos.css). */
    private val FONDO_WEB = 0xFF121212.toInt()

    @Test
    fun `hay quince paletas`() {
        assertEquals(15, Paletas.disponibles.size)
    }

    /** La web sin configurar tiene que seguir viéndose como el día anterior al despliegue.
     *  Estos cuatro valores son literalmente los de :root en web/src/estilos.css. */
    @Test
    fun `la paleta por defecto de la web conserva los colores actuales de la pagina`() {
        val defecto = Paletas.porDefectoWeb
        assertEquals("morado_osfit", defecto.id)
        assertEquals(0xFFB388FF.toInt(), defecto.webPrimario)
        assertEquals(0xFF6A1B9A.toInt(), defecto.webPrimarioOscuro)
        assertEquals(0xFFE3D2FF.toInt(), defecto.webPrimarioClaro)
        assertEquals(0xFF2A0064.toInt(), defecto.webSobrePrimario)
    }

    @Test
    fun `porIdWeb devuelve la paleta pedida`() {
        Paletas.disponibles.forEach { paleta ->
            assertEquals(paleta, Paletas.porIdWeb(paleta.id))
        }
    }

    /** Una clienta sin paleta asignada, y una con un preset ya retirado del código, tienen
     *  que caer en el morado de siempre y no en una pantalla rota. */
    @Test
    fun `porIdWeb cae en el morado ante null, vacio o desconocido`() {
        assertEquals(Paletas.porDefectoWeb, Paletas.porIdWeb(null))
        assertEquals(Paletas.porDefectoWeb, Paletas.porIdWeb(""))
        assertEquals(Paletas.porDefectoWeb, Paletas.porIdWeb("preset_que_ya_no_existe"))
    }

    /** Los dos por defecto son distintos a propósito: cada lado conserva su aspecto previo. */
    @Test
    fun `el por defecto del video sigue siendo aqua noche y el de la web es el morado`() {
        assertEquals("aqua_noche", Paletas.porDefectoVideo.id)
        assertEquals("morado_osfit", Paletas.porDefectoWeb.id)
    }

    /** Los colores de web se pintan sobre superficies opacas: un alfa distinto de FF aquí
     *  sería un color a medio escribir, no una decisión. */
    @Test
    fun `los cuatro colores de web de toda paleta son opacos`() {
        Paletas.disponibles.forEach { paleta ->
            listOf(
                paleta.webPrimario,
                paleta.webPrimarioOscuro,
                paleta.webPrimarioClaro,
                paleta.webSobrePrimario
            ).forEach { color ->
                assertEquals("alfa en ${paleta.id}", 0xFF, (color ushr 24) and 0xFF)
            }
        }
    }

    /** Un campo olvidado en un constructor de diez colores sale como 0, que es transparente
     *  o negro según dónde se pinte, y en ninguno de los dos casos es una decisión. */
    @Test
    fun `ninguna paleta tiene un color en cero`() {
        Paletas.disponibles.forEach { paleta ->
            listOf(
                paleta.blobA, paleta.blobB, paleta.blobC, paleta.destacado,
                paleta.webPrimario, paleta.webPrimarioOscuro,
                paleta.webPrimarioClaro, paleta.webSobrePrimario
            ).forEach { color ->
                assertNotEquals("color en cero en ${paleta.id}", 0, color)
            }
        }
    }

    /** Lo que impide que una paleta bonita deje el saludo ilegible. */
    @Test
    fun `el primario de web de toda paleta contrasta con el fondo oscuro`() {
        Paletas.disponibles.forEach { paleta ->
            val ratio = contraste(paleta.webPrimario, FONDO_WEB)
            assertTrue("contraste bajo en ${paleta.id}: $ratio", ratio >= 4.5)
        }
    }

    @Test
    fun `el texto sobre primario contrasta con su propio primario`() {
        Paletas.disponibles.forEach { paleta ->
            val ratio = contraste(paleta.webSobrePrimario, paleta.webPrimario)
            assertTrue("contraste bajo en ${paleta.id}: $ratio", ratio >= 4.5)
        }
    }
```

- [x] **Step 2: Correr las pruebas para verlas fallar**

```bash
./gradlew :app:testDebugUnitTest --tests "com.osfit.app.paletas.PaletasTest"
```

Esperado: error de compilación — `Unresolved reference: webPrimario`, `porDefectoWeb`, `porIdWeb`. Es el fallo correcto: los campos todavía no existen.

- [x] **Step 3: Extender la data class**

En `app/src/main/java/com/osfit/app/paletas/Paleta.kt`, sustituir el KDoc de la clase y la clase por:

```kotlin
/**
 * Una paleta de color de OSfit, compartida por los videos de resumen y por la página web de
 * cada clienta. Los presets son código, no datos — en Firestore sólo se guarda qué [id] usa
 * cada periodo (ConfigVideoRepository) y cuál usa cada clienta (PaletaWebRepository).
 *
 * Los cuatro primeros colores son del video. Los de blob llevan su alfa incluida (~70%): la
 * transparencia parcial es lo que los mantiene como fondo y no como protagonistas, así que es
 * propiedad del color, no del renderer. El [destacado], en cambio, va opaco: es el dato que la
 * clienta tiene que leer. Son tres matices y no cuatro aunque haya cuatro blobs en pantalla:
 * el primero y el cuarto comparten matiz (ver BlobsGeometria), y esa repetición es parte de la
 * composición.
 *
 * Los cuatro `web*` son propios y no derivados de los de video. Los blobs están calculados
 * para verse difuminados al 70% sobre negro; sacados de ahí y puestos en un texto, varios
 * quedan turbios o sin contraste. Van opacos, y PaletasTest verifica que cada uno mantenga
 * 4.5:1 contra el fondo de la página.
 */
data class Paleta(
    val id: String,
    val nombre: String,
    val blobA: Int,
    val blobB: Int,
    val blobC: Int,
    val destacado: Int,
    val webPrimario: Int,
    val webPrimarioOscuro: Int,
    val webPrimarioClaro: Int,
    val webSobrePrimario: Int
)
```

- [x] **Step 4: Añadir los cuatro colores de web a las cinco paletas existentes**

Sin tocar sus colores de video. Añadir a cada constructor, después de `destacado`:

```kotlin
    // AQUA_NOCHE
    webPrimario = 0xFF3FE0B8.toInt(),
    webPrimarioOscuro = 0xFF0E6B57.toInt(),
    webPrimarioClaro = 0xFFC8FFEE.toInt(),
    webSobrePrimario = 0xFF03251C.toInt()

    // ATARDECER
    webPrimario = 0xFFFFB347.toInt(),
    webPrimarioOscuro = 0xFF8A3B12.toInt(),
    webPrimarioClaro = 0xFFFFE3B0.toInt(),
    webSobrePrimario = 0xFF2E1403.toInt()

    // BOSQUE
    webPrimario = 0xFFA8E05A.toInt(),
    webPrimarioOscuro = 0xFF2F6B1E.toInt(),
    webPrimarioClaro = 0xFFE4F7C4.toInt(),
    webSobrePrimario = 0xFF12240A.toInt()

    // ULTRAVIOLETA
    webPrimario = 0xFF6FD8FF.toInt(),
    webPrimarioOscuro = 0xFF1B4E8A.toInt(),
    webPrimarioClaro = 0xFFD6F2FF.toInt(),
    webSobrePrimario = 0xFF041A26.toInt()

    // BRASA
    webPrimario = 0xFFFF8A5C.toInt(),
    webPrimarioOscuro = 0xFF8A2B15.toInt(),
    webPrimarioClaro = 0xFFFFD9C7.toInt(),
    webSobrePrimario = 0xFF2B0C04.toInt()
```

- [x] **Step 5: Añadir las diez paletas nuevas**

Después de `BRASA` y antes de `disponibles`:

```kotlin
    /** Los colores que la web tuvo siempre, ahora elegibles como cualquier otra paleta. Es el
     *  por defecto de la web: mientras lo sea, una clienta sin configurar se ve igual que
     *  antes de que esta pantalla existiera. */
    private val MORADO_OSFIT = Paleta(
        id = "morado_osfit",
        nombre = "Morado OSfit",
        blobA = 0xB36A1B9A.toInt(),
        blobB = 0xB34527A0.toInt(),
        blobC = 0xB38E24AA.toInt(),
        destacado = 0xFFC9A7FF.toInt(),
        webPrimario = 0xFFB388FF.toInt(),
        webPrimarioOscuro = 0xFF6A1B9A.toInt(),
        webPrimarioClaro = 0xFFE3D2FF.toInt(),
        webSobrePrimario = 0xFF2A0064.toInt()
    )

    private val CEREZA = Paleta(
        id = "cereza",
        nombre = "Cereza",
        blobA = 0xB38A1538.toInt(),
        blobB = 0xB3B31550.toInt(),
        blobC = 0xB35A1560.toInt(),
        destacado = 0xFFFF4D7E.toInt(),
        webPrimario = 0xFFFF6E9C.toInt(),
        webPrimarioOscuro = 0xFF8A123F.toInt(),
        webPrimarioClaro = 0xFFFFD1E0.toInt(),
        webSobrePrimario = 0xFF2B0413.toInt()
    )

    private val MENTA_FRIA = Paleta(
        id = "menta_fria",
        nombre = "Menta fría",
        blobA = 0xB315706B.toInt(),
        blobB = 0xB31F5A7B.toInt(),
        blobC = 0xB315805A.toInt(),
        destacado = 0xFF4DFFD2.toInt(),
        webPrimario = 0xFF5FE6C4.toInt(),
        webPrimarioOscuro = 0xFF0F5C50.toInt(),
        webPrimarioClaro = 0xFFCFFFF2.toInt(),
        webSobrePrimario = 0xFF04231D.toInt()
    )

    private val OCEANO = Paleta(
        id = "oceano",
        nombre = "Océano",
        blobA = 0xB3153A7B.toInt(),
        blobB = 0xB315588A.toInt(),
        blobC = 0xB31F2A6B.toInt(),
        destacado = 0xFF4DA8FF.toInt(),
        webPrimario = 0xFF6BB6FF.toInt(),
        webPrimarioOscuro = 0xFF123A75.toInt(),
        webPrimarioClaro = 0xFFD2E8FF.toInt(),
        webSobrePrimario = 0xFF04162B.toInt()
    )

    private val ARENA = Paleta(
        id = "arena",
        nombre = "Arena",
        blobA = 0xB38A6A2E.toInt(),
        blobB = 0xB37B5A15.toInt(),
        blobC = 0xB36B4A2E.toInt(),
        destacado = 0xFFFFD9A0.toInt(),
        webPrimario = 0xFFE8C28A.toInt(),
        webPrimarioOscuro = 0xFF6B4A1E.toInt(),
        webPrimarioClaro = 0xFFFAEBD4.toInt(),
        webSobrePrimario = 0xFF2B1D06.toInt()
    )

    private val NEON = Paleta(
        id = "neon",
        nombre = "Neón",
        blobA = 0xB3A0158A.toInt(),
        blobB = 0xB315809E.toInt(),
        blobC = 0xB36B15A0.toInt(),
        destacado = 0xFFFF3DD1.toInt(),
        webPrimario = 0xFFFF6FE0.toInt(),
        webPrimarioOscuro = 0xFF7B1268.toInt(),
        webPrimarioClaro = 0xFFFFD4F5.toInt(),
        webSobrePrimario = 0xFF2B0424.toInt()
    )

    private val BRUMA = Paleta(
        id = "bruma",
        nombre = "Bruma",
        blobA = 0xB33A4A5A.toInt(),
        blobB = 0xB32E3A4A.toInt(),
        blobC = 0xB34A5A6B.toInt(),
        destacado = 0xFFA8C4E0.toInt(),
        webPrimario = 0xFFA9C6E3.toInt(),
        webPrimarioOscuro = 0xFF37506B.toInt(),
        webPrimarioClaro = 0xFFE2EDF7.toInt(),
        webSobrePrimario = 0xFF0C1722.toInt()
    )

    private val VINO = Paleta(
        id = "vino",
        nombre = "Vino",
        blobA = 0xB35A153A.toInt(),
        blobB = 0xB37B1F2E.toInt(),
        blobC = 0xB33A1550.toInt(),
        destacado = 0xFFE06B8A.toInt(),
        webPrimario = 0xFFE58BA4.toInt(),
        webPrimarioOscuro = 0xFF5E1230.toInt(),
        webPrimarioClaro = 0xFFFADCE4.toInt(),
        webSobrePrimario = 0xFF260610.toInt()
    )

    private val LIMA = Paleta(
        id = "lima",
        nombre = "Lima",
        blobA = 0xB35A7B15.toInt(),
        blobB = 0xB32E7B3A.toInt(),
        blobC = 0xB37B9E15.toInt(),
        destacado = 0xFFD9FF4D.toInt(),
        webPrimario = 0xFFC6F24F.toInt(),
        webPrimarioOscuro = 0xFF4A6B12.toInt(),
        webPrimarioClaro = 0xFFEDFBC6.toInt(),
        webSobrePrimario = 0xFF1A2604.toInt()
    )

    private val COBRE = Paleta(
        id = "cobre",
        nombre = "Cobre",
        blobA = 0xB38A3A15.toInt(),
        blobB = 0xB3A05A15.toInt(),
        blobC = 0xB36B2E1F.toInt(),
        destacado = 0xFFFF9E5C.toInt(),
        webPrimario = 0xFFF0A46B.toInt(),
        webPrimarioOscuro = 0xFF6B3312.toInt(),
        webPrimarioClaro = 0xFFFBE0CB.toInt(),
        webSobrePrimario = 0xFF2B1204.toInt()
    )
```

- [x] **Step 6: Actualizar la lista y los dos por defecto**

Sustituir el bloque final del `object Paletas` por:

```kotlin
    /** AQUA_NOCHE va primero porque es el por defecto del video y hay una prueba que lo exige;
     *  el resto va en el orden en que se fueron añadiendo. */
    val disponibles: List<Paleta> = listOf(
        AQUA_NOCHE, ATARDECER, BOSQUE, ULTRAVIOLETA, BRASA,
        MORADO_OSFIT, CEREZA, MENTA_FRIA, OCEANO, ARENA,
        NEON, BRUMA, VINO, LIMA, COBRE
    )

    /** Los colores originales del video: un periodo sin configurar se ve como siempre. */
    val porDefectoVideo: Paleta = AQUA_NOCHE

    /** Los colores originales de la web: una clienta sin configurar se ve como siempre.
     *  Distinto del de video a propósito — cada lado conserva el aspecto que ya tenía. */
    val porDefectoWeb: Paleta = MORADO_OSFIT

    /** Tolera ids nulos, vacíos y desconocidos: un periodo puede no estar configurado, o tener
     *  guardado un preset que después se quitó del código. */
    fun porIdVideo(id: String?): Paleta =
        disponibles.firstOrNull { it.id == id } ?: porDefectoVideo

    /** Igual que [porIdVideo] pero cayendo en el morado: una clienta sin paleta asignada tiene
     *  que ver la página de siempre, no el aqua de los videos. */
    fun porIdWeb(id: String?): Paleta =
        disponibles.firstOrNull { it.id == id } ?: porDefectoWeb
```

- [x] **Step 7: Correr las pruebas**

```bash
./gradlew :app:testDebugUnitTest --tests "com.osfit.app.paletas.PaletasTest" --tests "com.osfit.app.video.BlobsGeometriaTest"
```

Esperado: PASS. `PaletasTest` queda con 18 pruebas — las 9 que ya tenía más las 9 de esta tarea — y `BlobsGeometriaTest` sigue verde sin haberla tocado. Si falla `el primario de web de toda paleta contrasta con el fondo oscuro`, el mensaje dice qué paleta y con qué ratio — hay que aclarar ese `webPrimario`, no bajar el umbral.

- [x] **Step 8: Commit**

```bash
git add app/src/main/java/com/osfit/app/paletas/Paleta.kt app/src/test/java/com/osfit/app/paletas/PaletasTest.kt
git commit -m "feat: give every palette its own web colours, and add ten palettes

The blob colours are built to sit blurred at 70% over black; lifted out and put
behind text several of them turn muddy, so the web colours are declared rather
than derived. A test holds every palette to 4.5:1 against the page background."
```

---

### Task 3: Muestras de paleta compartidas

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/common/MuestrasPaleta.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/configvideo/ConfigVideoScreen.kt` (quitar el `private fun MuestrasPaleta` de las líneas 114-128 y sus imports ya sin uso)

**Interfaces:**
- Consumes: `Paleta` de la Task 2.
- Produces: `com.osfit.app.ui.common.MuestrasPaletaVideo(paleta: Paleta, modifier: Modifier = Modifier)` y `com.osfit.app.ui.common.MuestrasPaletaWeb(paleta: Paleta, modifier: Modifier = Modifier)`, ambos `@Composable`.

- [x] **Step 1: Crear el componente compartido**

`app/src/main/java/com/osfit/app/ui/common/MuestrasPaleta.kt`:

```kotlin
package com.osfit.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.osfit.app.paletas.Paleta

/**
 * Las muestras de una paleta, para poder compararlas de un vistazo.
 *
 * Hay dos variantes porque cada pantalla enseña los colores que esa pantalla realmente cambia:
 * enseñar blobs en la pantalla de la web haría elegir a ciegas, ya que ninguno de esos tres
 * colores llega a la página. Vive en `common` para que una paleta nueva aparezca en ambas sin
 * editar ninguna de las dos.
 */
@Composable
fun MuestrasPaletaVideo(paleta: Paleta, modifier: Modifier = Modifier) {
    Muestras(listOf(paleta.blobA, paleta.blobB, paleta.blobC, paleta.destacado), modifier)
}

/** El primario y sus dos extremos. `webSobrePrimario` no se muestra: es color de texto, y como
 *  punto suelto no dice nada. */
@Composable
fun MuestrasPaletaWeb(paleta: Paleta, modifier: Modifier = Modifier) {
    Muestras(listOf(paleta.webPrimarioOscuro, paleta.webPrimario, paleta.webPrimarioClaro), modifier)
}

@Composable
private fun Muestras(colores: List<Int>, modifier: Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        colores.forEach { color ->
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(Color(color))
            )
        }
    }
}
```

- [x] **Step 2: Hacer que `ConfigVideoScreen` use el compartido**

En `app/src/main/java/com/osfit/app/ui/configvideo/ConfigVideoScreen.kt`:

1. Borrar el bloque completo desde el comentario `/** Los tres blobs y el destacado, ... */` hasta el final del archivo (la función privada `MuestrasPaleta`).
2. Añadir `import com.osfit.app.ui.common.MuestrasPaletaVideo`.
3. Cambiar las dos llamadas `MuestrasPaleta(periodo.paleta)` y `MuestrasPaleta(paleta)` por `MuestrasPaletaVideo(periodo.paleta)` y `MuestrasPaletaVideo(paleta)`.
4. Borrar los imports que quedan sin uso: `androidx.compose.foundation.background`, `androidx.compose.foundation.layout.Box`, `androidx.compose.foundation.layout.size`, `androidx.compose.foundation.shape.CircleShape`, `androidx.compose.ui.draw.clip`, `androidx.compose.ui.graphics.Color`, `com.osfit.app.paletas.Paleta`.

El aspecto de Configuración de video no cambia: son los mismos cuatro círculos de 20dp, en el mismo orden.

- [x] **Step 3: Compilar**

```bash
./gradlew :app:compileDebugKotlin
```

Esperado: BUILD SUCCESSFUL, sin warnings de import sin usar en `ConfigVideoScreen.kt`.

- [x] **Step 4: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/common/MuestrasPaleta.kt app/src/main/java/com/osfit/app/ui/configvideo/ConfigVideoScreen.kt
git commit -m "refactor: share the palette swatches between both pickers

A new palette should show up in the video settings and in the web screen
without either screen being edited."
```

---

### Task 4: Guardar la paleta de la clienta

**Files:**
- Create: `app/src/main/java/com/osfit/app/paletas/PaletaWebFirestore.kt`
- Create: `app/src/main/java/com/osfit/app/data/repository/PaletaWebRepository.kt`
- Test: `app/src/test/java/com/osfit/app/paletas/PaletaWebFirestoreTest.kt`

El repositorio no lleva prueba: habla con Firestore, y en este proyecto ningún repositorio está cubierto. Lo que sí es comprobable —y lo que de verdad puede salir mal— es la conversión de colores a hex, así que vive en una función pura aparte y esa sí tiene pruebas.

**Interfaces:**
- Consumes: `Paleta`, `Paletas` de la Task 2.
- Produces: `com.osfit.app.paletas.aHexWeb(color: Int): String`; `com.osfit.app.paletas.camposFirestore(paleta: Paleta): Map<String, Any>`; `com.osfit.app.data.repository.PaletaWebRepository` con `fun observarPaletaId(clienteId: String): Flow<String?>` y `suspend fun guardar(clienteId: String, paleta: Paleta)`.

- [x] **Step 1: Escribir las pruebas que fallan**

`app/src/test/java/com/osfit/app/paletas/PaletaWebFirestoreTest.kt`:

```kotlin
package com.osfit.app.paletas

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PaletaWebFirestoreTest {

    @Test
    fun `un color ARGB se escribe como hex de seis digitos con almohadilla`() {
        assertEquals("#B388FF", aHexWeb(0xFFB388FF.toInt()))
    }

    /** Los ceros a la izquierda se pierden si se formatea sin ancho fijo, y un "#4162B" no es
     *  un color válido en CSS: la página se quedaría sin ese token, en silencio. */
    @Test
    fun `un color con ceros a la izquierda conserva sus seis digitos`() {
        assertEquals("#04162B", aHexWeb(0xFF04162B.toInt()))
        assertEquals("#000000", aHexWeb(0xFF000000.toInt()))
    }

    /** El alfa no viaja: la web pinta estos colores sobre superficies opacas. */
    @Test
    fun `el alfa se descarta`() {
        assertEquals("#B388FF", aHexWeb(0x00B388FF))
    }

    @Test
    fun `los campos guardados son el id y los cuatro colores de web`() {
        val campos = camposFirestore(Paletas.porIdWeb("oceano"))
        assertEquals(
            mapOf(
                "id" to "oceano",
                "primario" to "#6BB6FF",
                "primarioOscuro" to "#123A75",
                "primarioClaro" to "#D2E8FF",
                "sobrePrimario" to "#04162B"
            ),
            campos
        )
    }

    /** Todo lo que se guarda tiene que ser legible por la web, que valida #RRGGBB y descarta
     *  lo que no pase. Una paleta que escribiera un hex mal formado se vería morada sin avisar. */
    @Test
    fun `toda paleta produce cuatro colores con formato valido`() {
        val formato = Regex("^#[0-9A-F]{6}$")
        Paletas.disponibles.forEach { paleta ->
            val campos = camposFirestore(paleta)
            listOf("primario", "primarioOscuro", "primarioClaro", "sobrePrimario").forEach { clave ->
                val valor = campos[clave] as String
                // assertTrue y no el `assert` de Kotlin: ese se compila a nada sin -ea, así
                // que la prueba pasaría siempre sin comprobar nada.
                assertTrue("${paleta.id}.$clave = $valor", formato.matches(valor))
            }
        }
    }
}
```

- [x] **Step 2: Correr las pruebas para verlas fallar**

```bash
./gradlew :app:testDebugUnitTest --tests "com.osfit.app.paletas.PaletaWebFirestoreTest"
```

Esperado: error de compilación — `Unresolved reference: aHexWeb`.

- [x] **Step 3: Escribir la conversión**

`app/src/main/java/com/osfit/app/paletas/PaletaWebFirestore.kt`:

```kotlin
package com.osfit.app.paletas

/**
 * Cómo una [Paleta] se convierte en lo que la web lee.
 *
 * Se guardan los hex ya resueltos y no sólo el id porque el catálogo existe únicamente en
 * Kotlin: la web recibe colores y los aplica, sin una copia de la lista que se pueda
 * desincronizar. El id viaja igual, para marcar cuál está seleccionada en la app y para poder
 * reasignar en masa si algún día se rehacen los colores de un preset.
 */

/** `#RRGGBB`, en mayúsculas y con los seis dígitos siempre: sin el ancho fijo, un color como
 *  0xFF04162B saldría "#4162B" y la web lo descartaría por no ser un hex válido. El alfa se
 *  descarta porque estos colores se pintan sobre superficies opacas. */
fun aHexWeb(color: Int): String = "#%06X".format(color and 0xFFFFFF)

fun camposFirestore(paleta: Paleta): Map<String, Any> = mapOf(
    "id" to paleta.id,
    "primario" to aHexWeb(paleta.webPrimario),
    "primarioOscuro" to aHexWeb(paleta.webPrimarioOscuro),
    "primarioClaro" to aHexWeb(paleta.webPrimarioClaro),
    "sobrePrimario" to aHexWeb(paleta.webSobrePrimario)
)
```

- [x] **Step 4: Correr las pruebas**

```bash
./gradlew :app:testDebugUnitTest --tests "com.osfit.app.paletas.PaletaWebFirestoreTest"
```

Esperado: PASS, las cinco.

- [x] **Step 5: Escribir el repositorio**

`app/src/main/java/com/osfit/app/data/repository/PaletaWebRepository.kt`:

```kotlin
package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.osfit.app.paletas.Paleta
import com.osfit.app.paletas.camposFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * La paleta de la página web de una clienta, guardada en su propio documento.
 *
 * Va ahí y no en una colección aparte porque la web ya observa ese documento (`observarCliente`
 * en web/src/datos.ts): no hace falta un listener nuevo, ni una lectura extra, ni una regla de
 * Firestore — `clientes/{cid}` ya deja a la clienta leer lo suyo.
 */
class PaletaWebRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val clientes = db.collection("clientes")

    /** Sólo el id: es lo único que la pantalla necesita para marcar cuál está seleccionada.
     *  Los hex que viajan junto a él son para la web, no para la app. */
    fun observarPaletaId(clienteId: String): Flow<String?> = callbackFlow {
        val registro = clientes.document(clienteId).addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            @Suppress("UNCHECKED_CAST")
            val paleta = snapshot?.get("paletaWeb") as? Map<String, Any>
            trySend(paleta?.get("id") as? String)
        }
        awaitClose { registro.remove() }
    }

    /** `merge` y no `set` a secas: el documento de la clienta tiene todo lo demás —nombre,
     *  rutina, música— y un set completo lo borraría. */
    suspend fun guardar(clienteId: String, paleta: Paleta) {
        clientes.document(clienteId)
            .set(mapOf("paletaWeb" to camposFirestore(paleta)), SetOptions.merge())
            .await()
    }
}
```

- [x] **Step 6: Compilar**

```bash
./gradlew :app:compileDebugKotlin test
```

Esperado: BUILD SUCCESSFUL y todas las pruebas en verde.

- [x] **Step 7: Commit**

```bash
git add app/src/main/java/com/osfit/app/paletas/PaletaWebFirestore.kt app/src/main/java/com/osfit/app/data/repository/PaletaWebRepository.kt app/src/test/java/com/osfit/app/paletas/PaletaWebFirestoreTest.kt
git commit -m "feat: store a client's web palette on her own document

The resolved hex travels with the id so the catalogue can stay Kotlin-only:
the page reads colours and applies them, with no second copy of the list."
```

---

### Task 5: La pantalla de la app

**Files:**
- Create: `app/src/main/java/com/osfit/app/ui/clientes/PaletaWebClienteScreen.kt`
- Modify: `app/src/main/java/com/osfit/app/ui/clientes/WebClienteScreen.kt` (firma de `WebClienteScreen` y `seccionesWeb`)
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/Screen.kt` (después del bloque `VideosWebCliente`)
- Modify: `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt:92-108`

**Interfaces:**
- Consumes: `Paletas`, `MuestrasPaletaWeb`, `PaletaWebRepository`.
- Produces: `PaletaWebClienteScreen(clienteId: String)`; `Screen.PaletaWebCliente` con `crearRuta(clienteId: String)`; `WebClienteScreen` pasa a recibir también `onVerPaletaWeb: (String) -> Unit`.

- [x] **Step 1: Escribir el ViewModel y la pantalla**

`app/src/main/java/com/osfit/app/ui/clientes/PaletaWebClienteScreen.kt`:

```kotlin
package com.osfit.app.ui.clientes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.repository.PaletaWebRepository
import com.osfit.app.paletas.Paleta
import com.osfit.app.paletas.Paletas
import com.osfit.app.ui.common.MuestrasPaletaWeb
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class PaletaWebClienteViewModel(
    private val clienteId: String,
    private val repo: PaletaWebRepository = PaletaWebRepository()
) : ViewModel() {

    private val _seleccionada = MutableStateFlow(Paletas.porDefectoWeb)
    val seleccionada: StateFlow<Paleta> = _seleccionada

    init {
        viewModelScope.launch {
            // Un error de permisos o de red deja la selección en el morado por defecto, que es
            // lo que la clienta está viendo de todos modos: la pantalla se puede seguir usando.
            repo.observarPaletaId(clienteId)
                .catch { }
                .collect { id -> _seleccionada.value = Paletas.porIdWeb(id) }
        }
    }

    fun asignar(paleta: Paleta) {
        // Optimista: la marca se mueve al tocar, sin esperar a Firestore. El listener confirma
        // o corrige un instante después.
        _seleccionada.value = paleta
        viewModelScope.launch { runCatching { repo.guardar(clienteId, paleta) } }
    }
}

/**
 * Elige la paleta de la página web de una clienta. Guarda al tocar, sin botón de confirmar:
 * igual que Configuración de video, y por lo mismo — es una decisión reversible de un toque.
 */
@Composable
fun PaletaWebClienteScreen(clienteId: String) {
    val viewModel: PaletaWebClienteViewModel = viewModel(
        factory = viewModelFactory { initializer { PaletaWebClienteViewModel(clienteId) } }
    )
    val seleccionada by viewModel.seleccionada.collectAsState()

    Scaffold { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text("Paleta de colores", style = MaterialTheme.typography.headlineSmall)
            }
            item {
                Text(
                    "Cambia los colores de la página web de esta clienta. Ella lo ve al instante, sin recargar.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }
            items(Paletas.disponibles, key = { it.id }) { paleta ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.asignar(paleta) }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        RadioButton(
                            selected = paleta.id == seleccionada.id,
                            onClick = { viewModel.asignar(paleta) }
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(paleta.nombre, style = MaterialTheme.typography.titleMedium)
                        }
                        MuestrasPaletaWeb(paleta, modifier = Modifier.padding(end = 8.dp))
                    }
                }
            }
        }
    }
}
```

- [x] **Step 2: Añadir la ruta**

En `app/src/main/java/com/osfit/app/ui/navigation/Screen.kt`, justo después del bloque `VideosWebCliente`:

```kotlin
    data object PaletaWebCliente : Screen("paleta_web_cliente/{clienteId}") {
        fun crearRuta(clienteId: String) = "paleta_web_cliente/$clienteId"
    }
```

- [x] **Step 3: Conectar la navegación**

En `app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt`, dentro del `composable` de `Screen.WebCliente` (líneas 92-101), añadir el parámetro nuevo a la llamada:

```kotlin
            com.osfit.app.ui.clientes.WebClienteScreen(
                clienteId = clienteId,
                onVerVideosWeb = { id -> navController.navigate(Screen.VideosWebCliente.crearRuta(id)) },
                onVerPaletaWeb = { id -> navController.navigate(Screen.PaletaWebCliente.crearRuta(id)) }
            )
```

Y después del `composable` de `Screen.VideosWebCliente` (que termina en la línea 108), añadir:

```kotlin
        composable(
            route = Screen.PaletaWebCliente.route,
            arguments = listOf(navArgument("clienteId") { type = NavType.StringType })
        ) { backStackEntry ->
            val clienteId = backStackEntry.arguments?.getString("clienteId") ?: return@composable
            com.osfit.app.ui.clientes.PaletaWebClienteScreen(clienteId = clienteId)
        }
```

- [x] **Step 4: Añadir la tarjeta a la pantalla de Web**

En `app/src/main/java/com/osfit/app/ui/clientes/WebClienteScreen.kt`:

1. Añadir el import `androidx.compose.material.icons.filled.Palette`.
2. Cambiar la firma:

```kotlin
fun WebClienteScreen(
    clienteId: String,
    onVerVideosWeb: (String) -> Unit,
    onVerPaletaWeb: (String) -> Unit
) {
    val secciones = seccionesWeb(onVerVideosWeb = onVerVideosWeb, onVerPaletaWeb = onVerPaletaWeb)
```

3. Cambiar `seccionesWeb` al final del archivo:

```kotlin
private fun seccionesWeb(
    onVerVideosWeb: (String) -> Unit,
    onVerPaletaWeb: (String) -> Unit
) = listOf(
    SeccionWeb(
        icono = Icons.Filled.VideoLibrary,
        texto = "Videos en la web",
        alAbrir = onVerVideosWeb
    ),
    SeccionWeb(
        icono = Icons.Filled.Palette,
        texto = "Paleta de colores",
        alAbrir = onVerPaletaWeb
    )
)
```

Con dos secciones la rejilla queda en una fila completa y el `Spacer` de relleno ya no entra; no hay que tocar nada más de esa pantalla.

- [x] **Step 5: Compilar y correr las pruebas** *(hecho el 2026-09-14 en la laptop SISTEMAS-03,
  que sí tiene SDK: BUILD SUCCESSFUL, 247 pruebas en 24 clases, 0 fallos)*

```bash
./gradlew :app:compileDebugKotlin test
```

Esperado: BUILD SUCCESSFUL. Si `Icons.Filled.Palette` no resuelve, es que el proyecto usa el set de iconos básico; en ese caso usar `Icons.Filled.ColorLens`, que está en el mismo set que `VideoLibrary`.

`material-icons-extended` está en `app/build.gradle.kts:75`, así que `Icons.Filled.Palette`
debería resolver sin el respaldo de `ColorLens`. Queda por confirmar al compilar.

- [x] **Step 6: Commit**

```bash
git add app/src/main/java/com/osfit/app/ui/clientes/PaletaWebClienteScreen.kt app/src/main/java/com/osfit/app/ui/clientes/WebClienteScreen.kt app/src/main/java/com/osfit/app/ui/navigation/Screen.kt app/src/main/java/com/osfit/app/ui/navigation/OSfitNavHost.kt
git commit -m "feat: pick a client's web palette from the Web card"
```

---

### Task 6: La web pinta la paleta

**Files:**
- Create: `web/src/paleta.ts`
- Test: `web/src/paleta.test.ts`
- Modify: `web/src/datos.ts` (interfaz `Cliente`)
- Modify: `web/src/main.ts` (imports y el callback de `observarCliente`)
- Modify: `web/src/estilos.css:1-13` y la regla `.saludo-nombre`
- Modify: `web/index.html:22-37`

**Interfaces:**
- Consumes: los campos que la Task 4 escribe en `clientes/{cid}.paletaWeb`.
- Produces: `export interface PaletaWeb { id: string; primario: string; primarioOscuro: string; primarioClaro: string; sobrePrimario: string }` y `export function aplicarPaleta(paleta: PaletaWeb | null | undefined, raiz: HTMLElement): void`.

- [x] **Step 1: Escribir las pruebas que fallan**

`web/src/paleta.test.ts`. La raíz llega como parámetro y no desde `document` porque Vitest corre en Node sin jsdom: no hay DOM que tomar.

```ts
import { describe, expect, it } from "vitest";
import type { PaletaWeb } from "./paleta";
import { aplicarPaleta } from "./paleta";

/** Un doble de HTMLElement que sólo sabe lo que `aplicarPaleta` usa. */
function raizFalsa() {
  const escritas: Record<string, string> = {};
  const raiz = {
    style: {
      setProperty(nombre: string, valor: string) {
        escritas[nombre] = valor;
      },
    },
  } as unknown as HTMLElement;
  return { raiz, escritas };
}

const OCEANO: PaletaWeb = {
  id: "oceano",
  primario: "#6BB6FF",
  primarioOscuro: "#123A75",
  primarioClaro: "#D2E8FF",
  sobrePrimario: "#04162B",
};

describe("aplicarPaleta", () => {
  it("vuelca los cuatro colores como variables CSS", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta(OCEANO, raiz);
    expect(escritas).toEqual({
      "--primario": "#6BB6FF",
      "--primario-oscuro": "#123A75",
      "--primario-claro": "#D2E8FF",
      "--sobre-primario": "#04162B",
    });
  });

  /** Una clienta sin paleta asignada: se quedan los valores de :root, que son el morado. */
  it("sin paleta no escribe nada", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta(undefined, raiz);
    aplicarPaleta(null, raiz);
    expect(escritas).toEqual({});
  });

  /** Un campo corrupto degrada a morado en ese color y sólo en ese: la página es lo único
   *  que la clienta tiene, y no puede quedarse en blanco por un hex mal escrito. */
  it("descarta el color invalido y aplica los demas", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta({ ...OCEANO, primario: "rojo" }, raiz);
    expect(escritas["--primario"]).toBeUndefined();
    expect(escritas["--primario-oscuro"]).toBe("#123A75");
    expect(escritas["--primario-claro"]).toBe("#D2E8FF");
    expect(escritas["--sobre-primario"]).toBe("#04162B");
  });

  it("descarta un campo ausente o de otro tipo", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta({ id: "roto", primario: "#6BB6FF" } as unknown as PaletaWeb, raiz);
    expect(escritas).toEqual({ "--primario": "#6BB6FF" });
  });

  it("acepta hex en minusculas", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta({ ...OCEANO, primario: "#6bb6ff" }, raiz);
    expect(escritas["--primario"]).toBe("#6bb6ff");
  });
});
```

- [x] **Step 2: Correr las pruebas para verlas fallar**

```bash
cd web && npm test
```

Esperado: falla al resolver `./paleta` — el módulo todavía no existe.

- [x] **Step 3: Escribir el módulo**

`web/src/paleta.ts`:

```ts
/**
 * Los colores de marca de la página vienen de la app: el entrenador elige una paleta por
 * clienta y ahí quedan guardados los hex ya resueltos. Este módulo sólo los vuelca como
 * variables CSS; el catálogo de paletas no existe aquí, vive únicamente en Kotlin.
 */
export interface PaletaWeb {
  id: string;
  primario: string;
  primarioOscuro: string;
  primarioClaro: string;
  sobrePrimario: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

const VARIABLES: ReadonlyArray<[keyof PaletaWeb, string]> = [
  ["primario", "--primario"],
  ["primarioOscuro", "--primario-oscuro"],
  ["primarioClaro", "--primario-claro"],
  ["sobrePrimario", "--sobre-primario"],
];

/**
 * Aplica la paleta sobre `raiz`, normalmente `document.documentElement`.
 *
 * La raíz entra como parámetro en vez de tomarse del global para que esto se pueda probar:
 * las pruebas corren en Node y ahí no hay `document`.
 *
 * Cada color se valida por separado y los que no pasan se dejan sin escribir, conservando el
 * valor de `:root`. Un documento a medio escribir degrada a morado en ese color concreto,
 * nunca a una página en blanco.
 */
export function aplicarPaleta(paleta: PaletaWeb | null | undefined, raiz: HTMLElement): void {
  if (!paleta) return;
  for (const [campo, variable] of VARIABLES) {
    const valor = paleta[campo];
    if (typeof valor === "string" && HEX.test(valor)) {
      raiz.style.setProperty(variable, valor);
    }
  }
}
```

- [x] **Step 4: Correr las pruebas**

```bash
cd web && npm test
```

Esperado: PASS, las cinco de `aplicarPaleta`, y el resto de la suite sigue en verde.

- [x] **Step 5: Declarar el campo en el modelo de la clienta**

En `web/src/datos.ts`, añadir el import al principio del archivo:

```ts
import type { PaletaWeb } from "./paleta";
```

y el campo dentro de `interface Cliente`, después de `ultimoDiaEsAncla`:

```ts
  /**
   * La paleta que el entrenador le eligió desde la app. Opcional: una clienta a la que nunca
   * se le asignó una no tiene el campo, y entonces la página se queda con el morado de :root.
   */
  paletaWeb?: PaletaWeb;
```

- [x] **Step 6: Aplicarla al llegar la clienta**

En `web/src/main.ts`:

1. Añadir el import junto a los demás de módulos propios:

```ts
import { aplicarPaleta } from "./paleta";
```

2. Cambiar el callback de `observarCliente`, casi al final de `arrancar`:

```ts
  observarCliente(clienteId, (c) => {
    cliente = c;
    // Antes de pintar: así el primer repintado ya sale con los colores buenos y la página no
    // parpadea de morado al color de la clienta.
    aplicarPaleta(c?.paletaWeb, document.documentElement);
    pintar();
  });
```

- [x] **Step 7: Añadir el token que falta y quitar el hex quemado**

En `web/src/estilos.css`, dentro de `:root`, después de `--primario-oscuro`:

```css
  --primario-claro: #E3D2FF;
```

Y en la regla `.saludo-nombre`, cambiar la línea del degradado:

```css
  background: linear-gradient(100deg, var(--primario) 0%, var(--primario-claro) 100%);
```

- [x] **Step 8: Hacer que el fondo pintado siga la paleta**

En `web/index.html`, dentro del `<svg class="fondo">`, sustituir los cinco literales:

- en `<radialGradient id="halo-claro">`, los dos `stop-color="#B388FF"` → `stop-color="var(--primario)"`
- en `<radialGradient id="halo-hondo">`, los dos `stop-color="#6A1B9A"` → `stop-color="var(--primario-oscuro)"`
- en el `<g ... stroke="#B388FF" ...>` de las líneas deformes, `stroke="#B388FF"` → `stroke="var(--primario)"`

El SVG es inline en el documento, así que hereda las variables de `:root` sin nada más. `<meta name="theme-color" content="#121212">` se queda como está: el fondo oscuro no cambia con la paleta.

- [x] **Step 9: Comprobar que no queda ningún color quemado**

```bash
grep -rn "B388FF\|6A1B9A\|E3D2FF\|2A0064" web/src web/index.html
```

Esperado: sólo las cuatro definiciones de `:root` en `web/src/estilos.css`. Cualquier otra coincidencia es un color que no seguirá a la paleta.

- [x] **Step 10: Compilar la web y correr las pruebas** *(89 en verde —las 84 de antes más las 5
  de `aplicarPaleta`— y `tsc && vite build` sin errores)*

```bash
cd web && npm test && npm run build
```

Esperado: pruebas en verde y build sin errores de TypeScript.

De paso se comprobó en Chromium lo único de esta tarea que ninguna prueba cubre: que un
atributo de presentación de SVG (`stop-color`, `stroke`) acepta `var(--primario)`. Sirviendo
`dist/` y cambiando la variable en `documentElement`, los dos `stop` y el `stroke` del fondo
pasaron de `rgb(179, 136, 255)` a `rgb(107, 182, 255)`. Sin eso, el fondo se habría quedado
morado para todas y sólo se habría notado en el teléfono.

- [x] **Step 11: Commit**

```bash
git add web/src/paleta.ts web/src/paleta.test.ts web/src/datos.ts web/src/main.ts web/src/estilos.css web/index.html
git commit -m "feat: paint the client page with the palette picked in the app

The page reads resolved hex and writes them as CSS variables; it holds no
catalogue of its own. Missing or malformed values fall back to the :root purple
one token at a time, so a half-written document never blanks the page."
```

---

### Task 7: Verificación de punta a punta y despliegue

**Files:**
- Modify: `docs/backlog.md:221-228`

- [x] **Step 1: Correr todo** *(cerrado el 2026-09-14 en la laptop SISTEMAS-03: `./gradlew test`
  BUILD SUCCESSFUL, 247 pruebas en 24 clases y 0 fallos; la web, 91 en 11 suites)*

```bash
./gradlew test
cd web && npm test && npm run build
```

Esperado: todo en verde. Anotar el número de pruebas que pasaron.

- [x] **Step 2: Comprobar a mano lo que las pruebas no cubren** *(verificado en dispositivo por
  el entrenador el 2026-09-14, con la app recién reinstalada en los dos teléfonos; no quedó
  registrado punto por punto)*

Con la app instalada y la página de una clienta de prueba abierta en el teléfono:

1. Ficha de la clienta → Web → la tarjeta "Paleta de colores" existe y abre.
2. Las 15 paletas se listan, con Morado OSfit marcada en una clienta sin configurar.
3. Tocar "Océano" → la página abierta cambia de color **sin recargar** (Firestore es en vivo).
4. El saludo, los títulos de tarjeta, la tarjeta del día y las manchas del fondo cambian todas; el fondo oscuro y las superficies de las tarjetas no.
5. Cerrar y reabrir la página: el color persiste.
6. Configuración de video (menú de las tres rayas) → una quincena cualquiera → las 15 paletas aparecen también ahí, con sus muestras de blobs.
7. Una quincena ya configurada antes de este cambio conserva su paleta.

- [x] **Step 3: Desplegar** *(hosting desplegado y comprobado desde fuera el 2026-09-14 —el bundle
  en vivo trae `paletaWeb` y `--primario`—; `assembleRelease` corrido e instalado en los dos
  teléfonos el 2026-09-14)*

```bash
cd web && npm run build && cd .. && firebase deploy --only hosting
./gradlew :app:assembleRelease
```

- [x] **Step 4: Marcar el backlog** *(marcado ✅ HECHO (2026-09-14) al cerrarse la verificación
  en dispositivo)*

En `docs/backlog.md`, cambiar el encabezado `## 7. Paleta de la web desde la app` por `## 7. Paleta de la web desde la app — ✅ HECHO (2026-09-13)`, dejando intacta la cita textual de abajo, y añadir después de ella un párrafo breve diciendo qué se hizo y qué no. La entrada no se borra.

El encabezado se deja **sin** el ✅ a propósito: con los Steps 1 a 3 pendientes, marcarlo
hecho diría que esto ya está en el teléfono de la entrenadora y en la página de las clientas,
y no lo está. En su lugar se anotó el avance debajo de la cita, que es lo que el backlog
pide de todos modos ("qué se hizo y qué no"). El ✅ lo pone quien cierre la verificación.

- [x] **Step 5: Commit**

```bash
git add docs/backlog.md
git commit -m "docs: record the web palette progress in the backlog"
```

---

## Notas para quien ejecute

- **El orden importa.** La Task 2 no compila sin la 1, la 5 no sin la 3 y la 4, y la 6 depende de que la 4 esté definiendo bien los campos de Firestore.
- **Las tareas 1 a 5 son de la app y la 6 es de la web**, sin solaparse en ningún archivo: si se reparten, ese es el corte.
- **Nunca afirmar que algo pasa sin haber corrido el comando y visto la salida.** Los pasos dicen qué se espera precisamente para que la comparación sea posible.

---

## Lo que quedó sin verificar (2026-09-14)

Las Tasks 1 a 4 ya venían hechas en el código —entraron en `dea6967`, "refactor: cambios
pendientes", sin que se marcaran los checkboxes— y aquí se completaron la 5 y la 6.

De la 5 falta **compilar**. Se intentó y no se pudo: la máquina donde se escribió no tiene
Android SDK, ni `local.properties`, ni `app/google-services.json`, y encima su red no alcanza
el repositorio de Google, así que Gradle ni siquiera resuelve el Android Gradle Plugin
(`Plugin [id: 'com.android.application', version: '8.6.1'] was not found`). O sea que de la
app **no se compiló ni corrió una sola prueba**: ni lo nuevo de la Task 5, ni lo que ya estaba
de las Tasks 1 a 4. Lo primero que hay que hacer en una máquina con SDK es:

```bash
./gradlew :app:compileDebugKotlin test
```

La 6 sí está verificada entera: 89 pruebas en verde, `tsc && vite build` limpio, y el fondo
SVG comprobado en un navegador de verdad (ver la nota del Step 10).

Pendientes, en orden: el compilado de arriba, la verificación en dispositivo (Task 7 Step 2,
los siete puntos), el despliegue (Step 3) y, sólo entonces, el ✅ del backlog (Step 4).
