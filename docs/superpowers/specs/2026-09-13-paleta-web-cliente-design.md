# Paleta de la web del cliente desde la app

## Contexto y objetivo

La página web de cada clienta es morada y lo es para siempre: `#B388FF` y
`#6A1B9A` viven escritos a mano en `web/src/estilos.css` y, tres veces más,
dentro del SVG del fondo en `web/index.html`. Cambiarlos exige editar el
repositorio y desplegar.

Los videos de resumen, en cambio, ya tienen paletas: cinco presets en
`app/src/main/java/com/osfit/app/video/PaletaVideo.kt`, elegibles por quincena
desde Configuración de video. Este spec extiende ese mismo catálogo para que
sirva también a la web, y lo vuelve el único lugar donde se define un color:
**agregar una paleta es editar un archivo Kotlin, y aparece a la vez en
Configuración de video y en la nueva pantalla de Web.**

Cierra el punto 7 del backlog:

> feature: a button on the OSfit app that can change the whole color palette of
> the web osfit, like the palettes of the quincenales videos

Además agrega **10 paletas nuevas**, que por construcción entran a los dos
lados a la vez.

**Alcance:** la paleta de la web es **por clienta**, y se elige desde la card
de Web de su ficha. No hay paleta global ni herencia entre clientas.

**Fuera de alcance:** editar colores a mano (los presets son código, no datos,
igual que hoy en los videos); cambiar el fondo oscuro, las superficies de las
tarjetas o los colores de texto de la web; tocar la generación de video más
allá de renombrar el catálogo.

## El catálogo compartido

`video/PaletaVideo.kt` se mueve a `paletas/Paleta.kt`, con los tipos
renombrados `PaletaVideo` → `Paleta` y `PaletasVideo` → `Paletas`. El nombre
viejo mentiría en cuanto la web use el mismo catálogo, y el paquete `video`
dejaría de explicar por qué la pantalla de una clienta importa de ahí.

Los **`id` no cambian**. `aqua_noche`, `atardecer`, `bosque`, `ultravioleta` y
`brasa` son lo que está guardado en los documentos de `configVideo`; tocarlos
haría que toda quincena ya configurada cayera silenciosamente en la paleta por
defecto.

`Paleta` gana cuatro campos de web junto a los cuatro de video:

| campo | uso |
|---|---|
| `blobA`, `blobB`, `blobC` | los tres matices del fondo del video, con su alfa ~70% incluida |
| `destacado` | el dato resaltado del video, opaco |
| `webPrimario` | acento de la web: saludo, títulos de tarjeta, botones, manchas del fondo |
| `webPrimarioOscuro` | extremo hondo del degradado de la tarjeta del día y del fondo |
| `webPrimarioClaro` | extremo claro del degradado del nombre en el saludo (hoy `#E3D2FF` quemado) |
| `webSobrePrimario` | texto sobre superficie primaria |

Los cuatro de web son **colores propios de cada paleta, no derivados de los de
video**. Los blobs están calculados para verse difuminados al 70% sobre negro;
sacados de ahí y puestos en un texto, varios quedarían turbios o sin contraste.
Cuatro campos más por paleta se escriben una vez; un saludo ilegible se sufre
cada vez que la clienta abre la página.

### Dos colores por defecto

```kotlin
val porDefectoVideo: Paleta = AQUA_NOCHE
val porDefectoWeb: Paleta = MORADO_OSFIT
```

Son distintos a propósito. Aqua noche son los colores originales del video, y
Morado OSfit son los colores actuales de la web: con estos dos por defecto, el
día que esto se despliegue **ningún video y ninguna página cambian de aspecto
solos**. El cambio ocurre únicamente donde el entrenador lo pide.

`porId(id: String?)` se conserva tal cual —tolerando nulos, vacíos y presets
retirados— pero necesita saber a cuál de los dos por defecto caer, así que pasa
a ser dos funciones: `porIdVideo(id)` y `porIdWeb(id)`.

## Los 15 presets

Las cinco existentes conservan sus colores de video intactos y sólo estrenan
los de web. Las diez nuevas son todas las demás.

| id | nombre | blobA | blobB | blobC | destacado |
|---|---|---|---|---|---|
| `aqua_noche` | Aqua noche | `B37B1575` | `B3157B7B` | `B34C157B` | `FF00E6A8` |
| `atardecer` | Atardecer | `B3B35A15` | `B3B33A2E` | `B37B1F3A` | `FFFFC24D` |
| `bosque` | Bosque | `B3156B3A` | `B3556B15` | `B3157B6B` | `FFB6E62E` |
| `ultravioleta` | Ultravioleta | `B32E1F8A` | `B35E15A0` | `B3A0157B` | `FF3DE0FF` |
| `brasa` | Brasa | `B38A1F15` | `B3B36A15` | `B35A2A15` | `FFFFD93D` |
| `morado_osfit` | Morado OSfit | `B36A1B9A` | `B34527A0` | `B38E24AA` | `FFC9A7FF` |
| `cereza` | Cereza | `B38A1538` | `B3B31550` | `B35A1560` | `FFFF4D7E` |
| `menta_fria` | Menta fría | `B315706B` | `B31F5A7B` | `B315805A` | `FF4DFFD2` |
| `oceano` | Océano | `B3153A7B` | `B315588A` | `B31F2A6B` | `FF4DA8FF` |
| `arena` | Arena | `B38A6A2E` | `B37B5A15` | `B36B4A2E` | `FFFFD9A0` |
| `neon` | Neón | `B3A0158A` | `B315809E` | `B36B15A0` | `FFFF3DD1` |
| `bruma` | Bruma | `B33A4A5A` | `B32E3A4A` | `B34A5A6B` | `FFA8C4E0` |
| `vino` | Vino | `B35A153A` | `B37B1F2E` | `B33A1550` | `FFE06B8A` |
| `lima` | Lima | `B35A7B15` | `B32E7B3A` | `B37B9E15` | `FFD9FF4D` |
| `cobre` | Cobre | `B38A3A15` | `B3A05A15` | `B36B2E1F` | `FFFF9E5C` |

| id | webPrimario | webPrimarioOscuro | webPrimarioClaro | webSobrePrimario |
|---|---|---|---|---|
| `aqua_noche` | `#3FE0B8` | `#0E6B57` | `#C8FFEE` | `#03251C` |
| `atardecer` | `#FFB347` | `#8A3B12` | `#FFE3B0` | `#2E1403` |
| `bosque` | `#A8E05A` | `#2F6B1E` | `#E4F7C4` | `#12240A` |
| `ultravioleta` | `#6FD8FF` | `#1B4E8A` | `#D6F2FF` | `#041A26` |
| `brasa` | `#FF8A5C` | `#8A2B15` | `#FFD9C7` | `#2B0C04` |
| `morado_osfit` | `#B388FF` | `#6A1B9A` | `#E3D2FF` | `#2A0064` |
| `cereza` | `#FF6E9C` | `#8A123F` | `#FFD1E0` | `#2B0413` |
| `menta_fria` | `#5FE6C4` | `#0F5C50` | `#CFFFF2` | `#04231D` |
| `oceano` | `#6BB6FF` | `#123A75` | `#D2E8FF` | `#04162B` |
| `arena` | `#E8C28A` | `#6B4A1E` | `#FAEBD4` | `#2B1D06` |
| `neon` | `#FF6FE0` | `#7B1268` | `#FFD4F5` | `#2B0424` |
| `bruma` | `#A9C6E3` | `#37506B` | `#E2EDF7` | `#0C1722` |
| `vino` | `#E58BA4` | `#5E1230` | `#FADCE4` | `#260610` |
| `lima` | `#C6F24F` | `#4A6B12` | `#EDFBC6` | `#1A2604` |
| `cobre` | `#F0A46B` | `#6B3312` | `#FBE0CB` | `#2B1204` |

Morado OSfit repite exactamente los cuatro colores que la web usa hoy, por eso
puede ser el por defecto sin cambiar nada de vista. Sus colores de video son
nuevos: los necesita para aparecer también en Configuración de video, que es la
condición que este spec se impone para toda paleta del catálogo.

## La app

### Entrada

Un elemento más en `seccionesWeb` de `WebClienteScreen.kt`, con icono
`Icons.Filled.Palette` y texto "Paleta de colores". La pantalla se creó
justamente para que crecer fuera esto y nada más; la ficha de la clienta no se
toca.

### Pantalla

`PaletaWebClienteScreen` lista las 15 paletas, cada una con su nombre, sus
muestras de web y una marca en la seleccionada. Tocar una guarda de inmediato:
no hay botón de confirmar, igual que en Configuración de video.

Las muestras salen a `ui/common/MuestrasPaleta.kt`, extraídas de
`ConfigVideoScreen.kt`, en dos variantes sobre el mismo componente:
`MuestrasPaletaVideo` (los tres blobs y el destacado, lo que ya existe, sin
cambios visuales) y `MuestrasPaletaWeb` (primario, primario oscuro y claro).
Cada pantalla enseña los colores que esa pantalla realmente va a cambiar;
enseñar blobs en la pantalla de la web haría elegir a ciegas.

Con la lista viviendo en `Paletas.disponibles` y el componente compartido, una
paleta nueva aparece en ambas pantallas sin editar ninguna de las dos.

### Persistencia

`PaletaWebRepository` escribe un campo `paletaWeb` en el documento
`clientes/{clienteId}`, con `merge` para no pisar el resto de la clienta:

```json
"paletaWeb": {
  "id": "oceano",
  "primario": "#6BB6FF",
  "primarioOscuro": "#123A75",
  "primarioClaro": "#D2E8FF",
  "sobrePrimario": "#04162B"
}
```

Se guardan los hex ya resueltos, no sólo el `id`, para que **el catálogo exista
únicamente en Kotlin**. La web recibe colores y los aplica; no sabe qué es una
paleta, no tiene una copia de la lista que se pueda desincronizar, y agregar
una paleta nueva no toca TypeScript.

El `id` viaja igual porque es lo que la app necesita para marcar cuál está
seleccionada, y lo que permitiría reasignar en masa si algún día se rehacen los
colores de un preset.

**La contrapartida, explícita:** si se cambian los colores de una paleta ya
asignada, las clientas que la tengan conservan los viejos hasta que se les
reasigne. Es aceptable porque los presets son estables por diseño, y el `id`
guardado deja la puerta abierta a una migración si deja de serlo.

Va en el documento de la clienta, y no en una colección aparte, porque la web
**ya observa ese documento** (`observarCliente`, `web/src/datos.ts`): no hay
listener nuevo, ni lectura extra, ni regla de Firestore que escribir —
`clientes/{cid}` ya permite a la clienta leer lo suyo. `firestore.rules` no se
toca.

## La web

### Aplicar la paleta

`web/src/paleta.ts`, nuevo, con una sola función: recibe el `paletaWeb` de la
clienta y vuelca sus cuatro colores como variables CSS en
`document.documentElement`.

Se llama desde `main.ts` en el mismo punto donde ya llega la clienta. Si el
campo no existe, **no escribe nada** y quedan los valores de `:root` en
`estilos.css`, que son los de Morado OSfit: una clienta sin configurar se ve
exactamente como hoy.

### Tokens

`estilos.css` gana `--primario-claro: #E3D2FF` para sustituir el hex quemado
del degradado de `.saludo-nombre`. Los demás (`--primario`,
`--primario-oscuro`, `--sobre-primario`) ya existen y conservan sus valores
actuales como respaldo.

En `index.html`, los tres `#B388FF` y dos `#6A1B9A` del SVG del fondo pasan a
`var(--primario)` y `var(--primario-oscuro)`. El SVG es inline en el
documento, así que hereda las variables de `:root` sin más.

`<meta name="theme-color" content="#121212">` se queda: el fondo oscuro no
cambia con la paleta.

## Errores

Un color inválido no debe romper la página, que es lo único que la clienta
tiene. `paleta.ts` valida cada valor contra `/^#[0-9A-Fa-f]{6}$/` y **aplica
sólo los que pasan**, uno por uno; los que no, se quedan con el respaldo del
CSS. Un documento a medio escribir o un campo corrupto degrada a morado en ese
color concreto, nunca a una página en blanco.

Del lado de la app, `porIdWeb` ya absorbe ids desconocidos cayendo en Morado
OSfit, así que una paleta retirada del código no deja una pantalla vacía.

## Pruebas

**Kotlin** — `PaletasVideoTest` pasa a `PaletasTest` y suma, sobre las 15:

- los `id` son únicos, y los cinco originales siguen escritos igual;
- ningún color es cero (un campo olvidado sale transparente o negro);
- `destacado` es opaco y los tres blobs tienen alfa `0xB3`;
- cada color de web es un RGB opaco;
- **contraste ≥ 4.5:1 de `webPrimario` sobre `#121212`**, calculado con la
  fórmula de luminancia relativa de WCAG. Es lo que impide que una paleta
  bonita deje el saludo ilegible;
- contraste ≥ 4.5:1 de `webSobrePrimario` sobre su propio `webPrimario`.

Los colores de la tabla ya se verificaron contra ese umbral: las 15 lo pasan, y
la más ajustada es Morado OSfit con 6.15:1, así que el umbral queda con margen
de sobra y las pruebas nacen en verde.
- `porDefectoWeb` es `morado_osfit` y sus cuatro colores de web son
  literalmente los que hoy están en `estilos.css`. Esta prueba es la que
  garantiza que el despliegue no cambie ninguna página sola.

**TypeScript** (`web/src/paleta.test.ts`) — con `paletaWeb` completo se
escriben las cuatro variables; sin campo no se escribe ninguna; con un hex
inválido se escriben las demás y esa no.

Ambas suites ya existen y corren en el proyecto (`gradlew test`, `npm test`).

## Despliegue

Compilar y desplegar app y web.
