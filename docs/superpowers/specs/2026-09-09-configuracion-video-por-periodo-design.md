# Configuración de video por periodo: paletas de color

## Contexto y objetivo

Hoy todos los videos de resumen se ven iguales, siempre. El fondo son cuatro
blobs difusos con tres tonos fijos (magenta / cian / púrpura) escritos como
constantes en `BlobsGeometria`, y el dato importante de cada escena se pinta
siempre en el mismo verde aqua (`DESTACADO = #00E6A8`) dentro de
`ResumenFrameRenderer`. No hay forma de cambiar ninguno de los dos sin
recompilar.

Este spec agrega dos cosas:

1. **Blobs más chicos y más definidos.** Ajuste fijo del render, sin UI.
2. **Una paleta de color por periodo.** El entrenador elige, desde una
   pantalla nueva, cuál de varios presets usa cada quincena. Todos los videos
   generados para esa quincena — de cualquier cliente — salen con esos
   colores.

La distinción es deliberada: la **paleta es del periodo** (una decisión
estética de temporada, pareja para todo el grupo), mientras que la **música
sigue siendo del cliente** (`cancionArchivo` / `cancionInicioSegundos` en el
modelo `Cliente`, elegida en su pantalla de edición). Este spec no toca la
música en absoluto.

Alcance: sólo el resumen **quincenal**, que es el único con botón que lo
dispara. La generación semanal y mensual sigue en el código sin entrada de UI
y hereda la paleta por defecto.

## Los presets de paleta

Un preset es **código, no datos**. Vive en un archivo nuevo
`app/src/main/java/com/osfit/app/video/PaletaVideo.kt`:

```kotlin
data class PaletaVideo(
    val id: String,
    val nombre: String,
    // Los tres matices del fondo, en el orden en que los consume BlobsGeometria.
    val blobA: Int,
    val blobB: Int,
    val blobC: Int,
    // Color del dato importante de cada escena.
    val destacado: Int
)
```

Tres colores de blob, no cuatro: la geometría actual tiene cuatro blobs, pero
el primero y el cuarto comparten matiz (ambos MAGENTA hoy). Mantener esa
estructura de tres matices conserva la coherencia visual del fondo y hace los
presets más fáciles de definir.

Los colores de blob se guardan **ya con su alfa** (`0xB3…`, ~70%): la
transparencia parcial es parte de lo que los mantiene como fondo y no como
protagonistas, así que es una propiedad del color, no del renderer.

`PaletasVideo.disponibles` es la lista ordenada de presets. La primera es la
paleta por defecto y **reproduce exactamente los colores de hoy**:

| id | nombre | blobs | destacado |
|---|---|---|---|
| `aqua_noche` | Aqua noche | `#B37B1575` magenta, `#B3157B7B` cian, `#B34C157B` púrpura | `#00E6A8` verde aqua |
| `atardecer` | Atardecer | naranja quemado, coral, vino | ámbar cálido |
| `bosque` | Bosque | verde profundo, oliva, teal | lima brillante |
| `ultravioleta` | Ultravioleta | índigo, violeta, fucsia | cian eléctrico |
| `brasa` | Brasa | rojo oscuro, ámbar, marrón | amarillo dorado |

Los valores hex exactos de los cuatro presets nuevos se afinan durante la
implementación contra un video real; el requisito que deben cumplir es que el
`destacado` tenga contraste suficiente sobre el fondo negro con blobs
encendidos, ya que es el color del dato que el cliente tiene que leer.

`PaletasVideo.porId(id: String?): PaletaVideo` devuelve el preset pedido o la
paleta por defecto si el id es `null` o no existe — así un preset que se
elimine del código en el futuro no rompe los periodos que lo tenían guardado.

## Persistencia

Colección nueva de Firestore, un documento por periodo:

```
configVideo/{rangoInicio}   →   { paletaId: "atardecer" }
```

El id del documento es el `rangoInicio` en ISO (`2026-09-01`), **el mismo
identificador de periodo que ya usan `MedallaOtorgada` y
`LogroPersonalOtorgado`**. No se inventa una noción nueva de periodo.

```kotlin
data class ConfigVideoPeriodo(
    val rangoInicio: String = "",
    val paletaId: String = ""
)
```

`ConfigVideoRepository` sigue el patrón de `MedallaRepository`:

- `observarTodas(): Flow<Map<String, String>>` — `rangoInicio` → `paletaId`,
  vía `addSnapshotListener` en `callbackFlow`. Lo consume la pantalla de
  configuración, que necesita ver todos los periodos a la vez.
- `suspend fun paletaDe(rangoInicio: String): PaletaVideo` — lectura puntual
  para la generación del video. Un documento ausente devuelve la paleta por
  defecto, nunca falla.
- `suspend fun guardar(rangoInicio: String, paletaId: String)` — `set` con id
  fijo, o sea upsert por periodo.

Un periodo sin documento usa `aqua_noche`. Como esa paleta son literalmente
los colores actuales, **la app sin configurar produce videos idénticos a los
de hoy**: nada cambia hasta que el entrenador elija otra cosa.

## Pantalla "Configuración de video"

`Screen.ConfigVideo` con ruta `config_video`, registrada en `OSfitNavHost` y
alcanzable desde una entrada nueva del drawer en `OSfitApp`, debajo de
"Logros personales". No entra en la barra inferior: esa barra es para las tres
pantallas de uso diario (Clientes / Calendario / Rutinas) y esto es
configuración ocasional.

La pantalla lista quincenas. **La lista se genera del calendario, no de la
base**: las quincenas son deterministas (días 1–15 y 16–fin de mes, según
`ResumenClienteCalculator.rangoQuincenal`), así que se calculan las últimas 12
más la siguiente a partir de la fecha de hoy, sin consultar nada. Cada renglón
muestra:

- El encabezado del rango ("2da quincena de agosto"), formateado por el mismo
  `rangoQuincenal` que usa el resumen, para que los nombres coincidan.
- Una tira con muestras de los colores de la paleta asignada: los tres blobs
  más el destacado.
- El nombre del preset.

La quincena actual va primero y se marca visualmente como tal.

Al tocar un renglón se abre un diálogo con los presets disponibles, cada uno
como una fila con su nombre y sus cuatro muestras de color, con el actual
preseleccionado. Elegir uno guarda y cierra. No hay botón de guardar aparte:
la acción es una sola elección.

`ConfigVideoViewModel` expone la lista de periodos ya combinada con su paleta
resuelta, para que el Composable no haga lookups.

## Cómo llega la paleta al video

### Blobs

`BlobsGeometria.blobs` deja de ser una `val` y pasa a ser
`fun blobs(paleta: PaletaVideo): List<BlobSpec>`: la misma geometría de
siempre, con `colorArgb` tomado del preset. El objeto sigue siendo puro y
determinístico — sin Android, sin Random — así que sigue siendo testeable
directamente.

`FondoBlobRenderer` recibe la paleta en su constructor. Ya es una clase (no un
`object`) precisamente porque tiene estado mutable por generación, así que
guardar la paleta ahí es consistente con su diseño actual y seguro ante dos
generaciones simultáneas.

### Texto destacado

Éste es el punto delicado. `ResumenFrameRenderer` es un `object` y `DESTACADO`
es una constante privada usada en ~12 sitios (números grandes de asistencia y
tiempo, racha, línea de la gráfica, nombre de medalla y de logros personales,
etiquetas).

La paleta **debe entrar como parámetro** de `dibujarFrame` y bajar por
argumento a los helpers que la necesitan. **No** debe guardarse como campo
mutable del `object`: dos generaciones simultáneas sí ocurren en esta app —
basta salir de la pantalla y volver a entrar — y se pisarían la paleta entre
sí. Es exactamente el problema que `FondoBlobRenderer` ya documenta como razón
para ser clase y no `object`.

La paleta pastel de la dona (`DONA_PALETA_PASTEL`) y los colores de insignia
por categoría **no se tocan**: siguen fijos, fuera del alcance del preset.

### Origen del dato

`ResumenVideoGenerator.generarYCompartir` resuelve la paleta antes de arrancar
el bucle de frames, con `configVideoRepository.paletaDe(resumen.rango.inicio.toString())`,
y la pasa a `FondoBlobRenderer` y a `ResumenFrameRenderer`. Una sola lectura
por video, no una por frame.

## Ajuste de los blobs

Cambio fijo, sin configuración:

- **Radios**: de `0.24f–0.34f` a aproximadamente `0.17f–0.24f` (~70% del
  actual), conservando las proporciones relativas entre los cuatro blobs.
- **Blur**: `RADIO_BLUR_PX` de `80f` a `~45f`.

Ambos números se afinan visualmente contra un video real; lo que el spec fija
es la dirección: más chicos y con el borde más definido, sin llegar a leerse
como círculos duros. Las amplitudes y periodos de movimiento no cambian.

`FACTOR_ESCALA = 4` se mantiene: aun con blur de 45px, la capa de blobs sigue
siendo puro degradado suave y no hay detalle que perder al pintarla en
270×480.

## Tests

Unitarios, en el mismo estilo que los existentes:

- `BlobsGeometria.blobs(paleta)` toma los colores del preset y deja la
  geometría intacta (mismos centros, radios y periodos para cualquier paleta).
- `PaletasVideo.porId` devuelve la paleta por defecto ante `null` y ante un id
  desconocido.
- La primera paleta de `disponibles` conserva los colores actuales — es la
  garantía de que no hay cambio visual sin configurar.
- El repositorio devuelve la paleta por defecto cuando el periodo no tiene
  documento.

Lo visual — que los blobs se lean bien al nuevo tamaño y que cada preset tenga
contraste suficiente — se verifica generando un video real en el dispositivo,
que es como se ha validado el resto de esta feature.

## Fuera de alcance

- Editar los colores de un preset o crear presets propios. Si más adelante
  hace falta, el modelo ya soporta guardar colores en Firestore en vez de un
  id; el cambio sería aditivo.
- Cambiar la paleta de la dona o de las insignias de medalla.
- Tocar la música, que sigue siendo por cliente.
- Aplicar paletas a los resúmenes semanal y mensual más allá de heredar la
  paleta por defecto.
