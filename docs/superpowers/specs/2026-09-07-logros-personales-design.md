# Logros personales por cliente

## Contexto y objetivo

Hoy el resumen quincenal en video cierra con una **medalla**: un premio
*grupal* y competitivo — se otorga por ranking contra los demás clientes
activos, y sólo puede haber **una por quincena** por persona (ver
`2026-09-04-medallas-logros-design.md`).

Falta el otro eje: reconocer a cada cliente **contra sí mismo**, sin que todo
sea competencia. Este spec agrega **logros personales**: un catálogo que el
entrenador define por su cuenta y del que otorga manualmente uno o varios a
cada cliente en su resumen quincenal, mostrados en una escena nueva del video
y guardados como historial en el perfil.

El diseño es deliberadamente un **espejo del sistema de medallas** (mismo
modelo de catálogo + historial denormalizado, mismo repositorio, misma
pantalla de catálogo en el drawer, mismo diálogo de confirmación en el flujo
quincenal, misma escena de video dibujada en Canvas). Las diferencias son sólo
tres, todas deliberadas:

1. **Varios por quincena** (0..N), no exactamente uno.
2. **Sin ranking ni sugerencia automática**: la asignación es 100% manual.
3. **Hasta 3 por escena de video**, con escenas adicionales si hay más.

Alcance: sólo el resumen **quincenal**. Semanal y mensual no se tocan.

## Modelo de datos

### Catálogo (Firestore `logrosPersonales`)

```kotlin
data class LogroPersonalCatalogo(
    val id: String = "",
    val nombre: String = "",
    // Se muestra debajo del logro en la escena del video cuando es el único de su escena.
    // "$nombrePersona" se reemplaza por el nombre del cliente al generar el video.
    val mensaje: String = "",
    // Nombre de archivo en filesDir/logrosPersonales/; null = insignia genérica dibujada
    // por el renderer (no hay imágenes empaquetadas).
    val imagenArchivo: String? = null
)
```

Sin campo `categoria`: no hay fórmula de ranking detrás de ningún logro
personal. Por lo mismo **no hay siembra automática** — el catálogo arranca
vacío y el entrenador crea sus propios logros, igual que hoy hace con las
medallas subjetivas. Todos son editables y **todos son borrables** (a
diferencia de las 5 categorías automáticas de medallas).

Los ids los genera quien llama (`UUID.randomUUID().toString()`), igual que
`MedallasScreen` hace hoy para las subjetivas: así la imagen se puede copiar a
`filesDir/logrosPersonales/<id>.<ext>` antes de guardar el documento.

### Otorgado (Firestore `clientes/{clienteId}/logrosPersonales`)

```kotlin
data class LogroPersonalOtorgado(
    // Doc id compuesto "<rangoInicio>_<logroId>". Ésta es la ÚNICA diferencia estructural
    // con MedallaOtorgada (que usa rangoInicio a secas) y es exactamente lo que permite
    // varios logros en la misma quincena sin poder duplicar el mismo logro en ella.
    val id: String = "",
    val rangoInicio: String = "",     // ISO date del inicio de la quincena
    val logroId: String = "",         // referencia a LogroPersonalCatalogo.id
    val nombreLogro: String = "",     // copia del nombre al momento de otorgarlo
    val mensaje: String = "",         // copia del mensaje al momento de otorgarlo
    val encabezadoRango: String = "", // "2da quincena de agosto"
    val orden: Int = 0                // orden de selección; define el orden en el video
)
```

`nombreLogro` y `mensaje` se denormalizan por el mismo motivo que en
`MedallaOtorgada`: si el catálogo se edita después, el historial no cambia
retroactivamente.

`orden` no existe en `MedallaOtorgada` porque allá siempre hay uno solo. Acá
define en qué orden aparecen dentro de la escena y en qué grupos de 3 caen.

Nada impide que dos clientes reciban el mismo logro en la misma quincena — es
esperable, y ya no hay ranking que lo desincentive.

### Reglas de Firestore

Sin cambios: `firestore.rules` permite lectura/escritura a cualquier usuario
autenticado sobre todos los documentos.

## Repositorio (`LogroPersonalRepository`)

Espejo de `MedallaRepository`, menos la siembra:

```kotlin
class LogroPersonalRepository(db: FirebaseFirestore = FirebaseFirestore.getInstance()) {
    fun observarCatalogo(): Flow<List<LogroPersonalCatalogo>>
    suspend fun guardarLogro(logro: LogroPersonalCatalogo)   // require(id no vacío)
    suspend fun eliminarLogro(logroId: String)

    fun observarOtorgados(clienteId: String): Flow<List<LogroPersonalOtorgado>>
    suspend fun otorgarLogros(clienteId: String, rangoInicio: String, logros: List<LogroPersonalOtorgado>)
    suspend fun quitarLogro(clienteId: String, id: String)
}
```

`observarOtorgados` ordena por `rangoInicio` descendente **en Firestore** y
luego por `orden` ascendente **en memoria**: encadenar dos `orderBy` obligaría
a crear un índice compuesto en la consola de Firebase, y la lista de logros de
un cliente es chica de sobra para ordenarla en el cliente.

`otorgarLogros` es la única operación sin análogo directo en
`MedallaRepository`, y por eso merece explicación:

- Es un **batch**: primero borra todos los documentos ya existentes con ese
  `rangoInicio` (query por `whereEqualTo("rangoInicio", rangoInicio)`),
  después escribe los nuevos.
- Ese borrado previo hace la operación **idempotente por quincena**: si el
  entrenador regenera el video de la misma quincena con otra selección, no
  quedan logros huérfanos de la selección anterior. Es el equivalente al
  upsert que `MedallaRepository.otorgarMedalla` consigue gratis usando
  `rangoInicio` como doc id.
- Con `logros` vacío, la operación se reduce a limpiar la quincena. Es el
  comportamiento correcto para "ningún logro esta vez".

Se registra en `AppContainer` como `logroPersonalRepository`, igual que los
demás.

### Imágenes (`InsigniaImagenUtil`)

`MedallaImagenUtil` ya hace exactamente lo que necesitan los logros
personales, pero con la carpeta `"medallas"` fija como constante privada. En
vez de duplicar sus ~60 líneas, se **extrae el cuerpo** a un
`InsigniaImagenUtil` que recibe la carpeta:

```kotlin
class InsigniaImagenUtil(private val carpeta: String) {
    fun carpetaImagenes(context: Context): File
    fun archivoImagen(context: Context, nombreArchivo: String): File
    fun copiarImagen(context: Context, uri: Uri, insigniaId: String): String?
    fun eliminarImagen(context: Context, nombreArchivo: String)
    fun cargarBitmap(context: Context, imagenArchivo: String?): Bitmap?
    // extensionDe(...) queda privado dentro, sin cambios de lógica
}

object MedallaImagenUtil {                              // fachada, API pública intacta
    private val delegado = InsigniaImagenUtil("medallas")
    fun cargarBitmapPropio(context: Context, medalla: MedallaCatalogo): Bitmap? =
        delegado.cargarBitmap(context, medalla.imagenArchivo)
    // ...resto delegando igual
}

object LogroPersonalImagenUtil {
    private val delegado = InsigniaImagenUtil("logrosPersonales")
    fun cargarBitmapPropio(context: Context, logro: LogroPersonalCatalogo): Bitmap? =
        delegado.cargarBitmap(context, logro.imagenArchivo)
    // ...
}
```

`MedallaImagenUtil` conserva su firma pública exacta, así que **ningún
llamador existente cambia**. La única diferencia interna es que
`cargarBitmap` recibe el nombre de archivo (`String?`) en vez del modelo, para
que el delegado no conozca ni `MedallaCatalogo` ni `LogroPersonalCatalogo`.

## Video

### Escena nueva

Ambos tipos van **dentro** de la sealed class `EscenaResumen` (o sea
`EscenaResumen.LogroEnEscena` y `EscenaResumen.LogrosPersonales`);
`LogroEnEscena` es una clase anidada, no una rama de la sealed class.

```kotlin
data class LogroEnEscena(
    val nombre: String,
    val imagen: Bitmap?,
    // Ya con "$nombrePersona" reemplazado. Sólo se dibuja cuando la escena trae UN logro.
    val mensaje: String
)

data class LogrosPersonales(val logros: List<LogroEnEscena>) : EscenaResumen()  // 1..3
```

### Agrupación en `construirEscenas`

Los logros otorgados llegan a `ResumenVideoGenerator.generarYCompartir` ya
ordenados por `orden`, se resuelven sus bitmaps ahí (donde hay `Context`,
igual que la medalla) y se agrupan de tres en tres:

```kotlin
logrosEscena.chunked(3).forEach { grupo -> escenas += EscenaResumen.LogrosPersonales(grupo) }
```

Insertadas **entre `RachaMasLarga` y `Medalla`**: primero el reconocimiento
personal, después el premio grupal como cierre, después `Despedida`.

Con 4 logros salen dos escenas (3 + 1); con 6, dos de 3. Así ningún logro
otorgado se queda fuera del video.

Igual que la medalla, sólo el flujo **quincenal** puede pasar logros: semanal
y mensual llaman a `generarYCompartir` sin ellos y la escena nunca aparece.
A diferencia de la medalla, **no hay escena de consuelo**: si no se otorgó
ningún logro personal, simplemente no se agrega ninguna escena.

### Duración (`TimelineResumen.duracionParaTipo`)

Depende de cuántos logros trae la escena, porque el contenido en pantalla
cambia:

| Logros en la escena | Duración | Razón |
|---|---|---|
| 1 | 6 500 ms | Mismo layout y ritmo que `Medalla`: título + insignia + mensaje. |
| 2 | 7 500 ms | Dos insignias en cascada; sin mensaje que leer, pero dos nombres. |
| 3 | 9 000 ms | Tres insignias en cascada (la última entra a los ~3.2s) y tres nombres. |

### Render (`ResumenFrameRenderer`)

Título con máquina de escribir: **"Y contra ti mismo, lograste:"**
(`inicioMs = 0`, `duracionMs = 1_800`, `y = 600f`, tamaño 56f, blanco, bold —
mismos valores que el título de `Medalla`).

**Con 1 logro** — idéntico a `dibujarMedalla`: insignia centrada en
`centroX, 1150f` con radio `220f`, fade desde `MEDALLA_INICIO_MS` durante
`MEDALLA_FADE_MS`, nombre debajo en `DESTACADO` 44f, y el mensaje como
`BloqueTexto` con `duracionMs = 0` (de golpe, sin máquina de escribir) a
`y = 1620f`, tamaño 38f, `LTGRAY` — exactamente el mismo tratamiento que el
mensaje de la medalla.

**Con 2 o 3 logros** — insignias en fila, radio `130f`, repartidas a lo ancho
y centradas, todas en `centroY = 1100f`, con el nombre debajo de cada una
(tamaño 28f, `DESTACADO`, hasta dos líneas). Cada insignia *i* hace su
fade-in en `1_200 + i * 500 ms` durante `MEDALLA_FADE_MS` (cascada). **No se
dibujan los mensajes**: con tres columnas no quedan legibles.

**Colores de la insignia por defecto**: `dibujarInsigniaMedalla` hoy resuelve
el color con `COLOR_INSIGNIA_MEDALLA[categoria]` internamente. Se cambia su
firma para **recibir el color y el glifo ya resueltos**; `dibujarMedalla`
pasa los que ya calculaba, y los logros personales pasan
`DONA_PALETA_PASTEL[indice % size]` con glifo `"★"`. Un solo lugar dibuja
insignias, dos llamadores deciden su apariencia.

## UI

### Colisión de nombres a resolver primero

Hoy `Screen.Logros` (ruta `logros/{clienteId}`) y `LogrosClienteScreen.kt`
son el **historial de medallas** de un cliente — el nombre viene de que el
entrenador les decía "logros" a las medallas. Con logros personales de verdad
en el proyecto, ese nombre pasa a ser activamente confuso.

Rename mecánico, sin cambios de comportamiento:

| Hoy | Después |
|---|---|
| `Screen.Logros` → ruta `logros/{clienteId}` | `Screen.MedallasCliente` → ruta `medallas_cliente/{clienteId}` |
| `LogrosClienteScreen.kt` / `LogrosClienteScreen()` | `MedallasClienteScreen.kt` / `MedallasClienteScreen()` |
| `ClienteDetailScreen(onVerLogros = ...)` | `onVerMedallas` |
| Texto de la tarjeta del perfil: `"Logros"` | `"Medallas"` |
| Título dentro de la pantalla: `"Logros"` | `"Medallas"` |

Y las dos entradas nuevas:

| Nuevo | Ruta | Qué es |
|---|---|---|
| `Screen.LogrosPersonales` | `logros_personales` | Catálogo, en el drawer junto a "Medallas" |
| `Screen.LogrosPersonalesCliente` | `logros_personales/{clienteId}` | Historial del cliente, desde su perfil |

### Catálogo (`LogrosPersonalesScreen` + `LogrosPersonalesViewModel`)

Espejo de `MedallasScreen`/`MedallasViewModel`, más simple porque no hay
categorías:

- Lista todos los logros (imagen propia o insignia genérica + nombre),
  ordenados por nombre.
- Tocar uno: editar nombre, mensaje y reemplazar imagen.
- FAB "Nuevo logro": nombre, mensaje, imagen opcional. El id se genera con
  `UUID.randomUUID().toString()` antes de copiar la imagen.
- Todos con opción de borrar (con confirmación; borra también su archivo de
  imagen si tenía uno). El ViewModel **no** lleva `init { asegurar... }`.
- Nueva entrada en el drawer de `OSfitApp.kt`, justo después de "Medallas".

### Historial por cliente (`LogrosPersonalesClienteScreen`)

Espejo de la pantalla de medallas del cliente (la renombrada
`MedallasClienteScreen`): lista de logros otorgados agrupados visualmente por
`encabezadoRango`, más reciente primero, cada uno con botón de quitar, y un
FAB para otorgar uno a mano fuera del flujo del resumen.

Otorgar a mano usa `rangoInicio = "manual_<timestamp>"` y
`encabezadoRango = "Otorgado manualmente el <fecha>"` — exactamente el mismo
recurso que ya usa `ClienteDetailViewModel.otorgarMedalla` para no chocar con
los ids por quincena.

Se llega desde una tarjeta nueva "Logros personales" en `ClienteDetailScreen`,
junto a la de "Medallas".

### Flujo de confirmación al generar el resumen quincenal

Se encadena **después** del diálogo de medalla, sin tocar semanal ni mensual:

1. `SeleccionarRangoResumenDialog` (sin cambios).
2. `prepararConfirmacionMedalla` → renombrado a
   `prepararConfirmacionQuincenal`, ahora devuelve también el catálogo de
   logros personales.
3. `ConfirmarMedallaDialog` (sin cambios internos) → el entrenador elige
   medalla o "Sin medalla". **Ya no genera el video al confirmar**: la
   pantalla guarda la elección en estado y abre el siguiente diálogo.
4. `ConfirmarLogrosDialog` (nuevo) → checkboxes sobre el catálogo, selección
   múltiple, cero o más. El orden de marcado define `orden`. Debajo, un
   contador vivo: *"3 logros — salen en 1 escena"*, *"4 logros — salen en 2
   escenas"*. Botones: "Generar" y "Cancelar".
5. Al confirmar: se otorga la medalla (si hubo) y se otorgan los logros, y
   luego se genera el video con el resumen **ya calculado** — sin recomputar.

Si el catálogo de logros está vacío, el paso 4 se salta y se genera directo:
no tiene sentido mostrar un diálogo sin opciones.

Cancelar en el paso 4 aborta toda la generación y **no se otorga la medalla
tampoco**: el entrenador vuelve al perfil sin efectos secundarios.

### ViewModel (`ResumenClienteViewModel`)

```kotlin
data class PreparacionResumenQuincenal(       // era PreparacionMedalla
    val resumen: ResumenClienteData,
    val sugerencia: MedallaCatalogo?,
    val catalogo: List<MedallaCatalogo>,
    val catalogoLogros: List<LogroPersonalCatalogo>   // nuevo
)

suspend fun prepararConfirmacionQuincenal(
    fechaReferencia: LocalDate = LocalDate.now()
): PreparacionResumenQuincenal?

fun confirmarYGenerarQuincenal(
    context: Context,
    preparacion: PreparacionResumenQuincenal,
    medallaElegida: MedallaCatalogo?,
    logrosElegidos: List<LogroPersonalCatalogo>       // nuevo, en orden de selección
)
```

`confirmarYGenerarQuincenal` conserva su `try/catch/finally` actual; sólo suma
la llamada a `otorgarLogros` junto a la de `otorgarMedalla`, y pasa los logros
elegidos a `ResumenVideoGenerator.generarYCompartir`.

## Testing

Se sigue el precedente exacto del proyecto: **domain y timeline con tests JVM;
repositorios Firestore, pantallas Compose y render Canvas se verifican en
dispositivo.**

- `TimelineResumenTest` (casos nuevos): `LogrosPersonales` dura 6 500 / 7 500 /
  9 000 ms según traiga 1, 2 o 3 logros.
- `ResumenVideoGeneratorTest` (casos nuevos):
  - sin logros, ninguna escena `LogrosPersonales` aparece;
  - con 4 logros salen **dos** escenas, de 3 y 1, en ese orden;
  - las escenas van después de `RachaMasLarga` y antes de `Medalla`;
  - un resumen semanal o mensual nunca produce escenas `LogrosPersonales`.
- Verificación final en dispositivo: generar un video real de un cliente con
  1, con 3 y con 4 logros otorgados, y revisar que la cascada, los nombres y
  el mensaje se lean bien.

## Fuera de alcance (explícito)

- **Semanal y mensual no se tocan.** Sólo el quincenal otorga y muestra logros
  personales.
- **Sin sugerencia automática.** Se evaluó un `LogroPersonalCalculator` que
  detectara hitos contra el propio historial del cliente (su mejor quincena de
  asistencia, récord personal de minutos, su racha más larga, un regreso
  después de una pausa). Es una buena fase 2 — requiere leer asistencias
  históricas fuera del rango, que hoy no se leen — pero queda fuera: la
  asignación es manual.
- **Sin niveles** bronce/plata/oro ni logros escalonados.
- **Sin conexión con `RecordPersonal`** (el modelo de récords por ejercicio que
  ya existe y no toca el video).
- **Sin logros de "hito único"**: cualquier logro puede otorgarse en tantas
  quincenas como se quiera. Lo único que el modelo impide es el mismo logro
  dos veces en la misma quincena.
- **Sin notificación al cliente** fuera del video que ya se comparte.
