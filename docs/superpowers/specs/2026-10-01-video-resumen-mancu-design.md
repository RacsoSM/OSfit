# Video de resumen con Mancu, la mascota — diseño

**Fecha:** 2026-10-01
**Estado:** diseño aprobado por el trainer, sin código escrito. Falta el plan de implementación.

## Objetivo

Agregar un **segundo estilo de video** de resumen (`app/.../video/`): una animación ilustrada
"dibujada a mano", guiada por una mascota llamada **Mancu**. **No reemplaza al actual.**

El trainer quiere tener **varios estilos de video predefinidos y elegir uno por quincena**,
igual que hoy elige la paleta de colores por quincena. Hoy hay uno (el de **blobs**); Mancu es el
segundo, y el diseño debe dejar la puerta abierta a más estilos después.

**La estructura de contenido no cambia en ningún estilo**: mismas escenas, mismo orden, mismos
datos, mismas duraciones base. Cada estilo solo decide cómo se dibuja.

## Estilos de video seleccionables por periodo

### Concepto

Un **estilo** es código, no datos (igual que un preset de paleta): un id, un nombre y un
renderer. Los estilos iniciales:

| id | nombre | descripción |
|---|---|---|
| `blobs` | Blobs | El video actual: fondo negro con blobs difusos, tipografía actual. **Por defecto.** |
| `mancu` | Mancu | Papel crema, sol amarillo y la mascota disco de 20 kg. Este spec. |

Un periodo sin configurar usa `blobs`, así que **la app sin tocar produce los mismos videos de
hoy**. Un id desconocido (estilo eliminado del código) también cae en `blobs`, nunca falla.

### Relación con la paleta

Son dos decisiones independientes por quincena, y la paleta solo aplica a algunos estilos:

- **`blobs`**: usa la `Paleta` elegida para el periodo (blobs + color destacado), como hoy.
- **`mancu`**: usa su **paleta fija** (ver más abajo) e **ignora** la paleta del periodo.

En la pantalla de configuración, al elegir `mancu` el selector de paleta se oculta o se
muestra deshabilitado, con una nota ("este estilo usa colores propios"). La paleta guardada del
periodo no se borra: si el trainer vuelve a `blobs`, reaparece.

### Persistencia

Se extiende el documento existente `configVideo/{rangoInicio}` (el mismo identificador de
periodo que ya usan las paletas, `MedallaOtorgada` y `LogroPersonalOtorgado`):

```
configVideo/{rangoInicio}  →  { paletaId: "atardecer", estiloId: "mancu" }
```

- `estiloId` es un campo **nuevo y opcional**. Los documentos que ya existen no lo tienen y se
  leen como `blobs`; **no hace falta migración**.
- `ConfigVideoPeriodo` gana `estiloId: String = ""`.
- **Cuidado:** hoy `ConfigVideoRepository.guardar(rangoInicio, paletaId)` hace
  `set(mapOf("paletaId" to ...))`, que **pisa el documento entero**. Con dos campos, cambiar la
  paleta borraría el estilo y viceversa. Hay que usar `set(..., SetOptions.merge())` o dos
  métodos (`guardarPaleta`, `guardarEstilo`) que escriban solo su campo.
- `observarTodas()` hoy devuelve `Map<String, String>` (rangoInicio → paletaId); debe pasar a
  devolver la config completa por periodo (paleta + estilo), y `ConfigVideoViewModel` ajustarse.
- Lectura puntual para generar: preferible una sola `configDe(rangoInicio)` que devuelva estilo
  y paleta con una lectura (hoy `paletaDe` hace una por video; no debe pasar a dos).

### Pantalla "Configuración de video"

Ya existe (`ui/configvideo/ConfigVideoScreen.kt`, `ConfigVideoViewModel.kt`) y lista las últimas
12 quincenas más la siguiente, con una tira de colores y el nombre de la paleta. Cambios:

- Cada renglón muestra además el **nombre del estilo** (o una miniatura/ícono por estilo).
- El diálogo de edición de un periodo pasa a tener **dos selecciones**: estilo y, si el estilo
  la usa, paleta. Sigue sin botón de guardar aparte (elegir guarda).
- Mantener la quincena actual primero y marcada.

### Arquitectura de render

Hoy `ResumenFrameRenderer` es un `object` que dibuja el video de blobs y recibe el
`FondoBlobRenderer` y la `Paleta` por parámetro; el generador los crea y llama
`ResumenFrameRenderer.dibujarFrame(canvas, timeline, fondo, tiempoMs, paleta)`
(`ResumenVideoGenerator.kt`, líneas ~83-97).

Propuesta: una abstracción pequeña por estilo, p. ej.

```kotlin
interface RendererVideo {
    fun dibujarFrame(canvas: Canvas, timeline: TimelineResumen, tiempoMs: Long)
}
```

- `ResumenVideoGenerator` resuelve el estilo del periodo (una lectura, junto con la paleta),
  **crea una instancia de renderer por generación** y la usa en el bucle de frames. El resto
  del generador (escenas, medalla, logros, música, encoder, compartir) **no cambia** y es común
  a todos los estilos.
- Un renderer por estilo, en archivos separados: el actual de blobs **se queda como está**
  (envolverlo con el mínimo cambio posible, sin reescribirlo), y el de Mancu es nuevo.
- **Estado mutable por instancia, nunca en un `object`**: dos generaciones simultáneas ocurren
  en esta app (basta salir de la pantalla y volver a entrar). Es la misma razón por la que
  `FondoBlobRenderer` es clase. El renderer de Mancu debe ser clase, con sus `Paint`, `Path` y
  bitmaps creados una vez por generación.
- Los tests existentes que llaman funciones estáticas de `ResumenFrameRenderer`
  (`MedallaAnimacionTest`) **deben seguir pasando sin cambios**: es el criterio para saber que
  el estilo blobs no se tocó.
- Las duraciones de `TimelineResumen` son compartidas. Si la coreografía de Mancu necesita otras,
  decidir si el timeline recibe las duraciones del estilo; **por defecto, no cambiar las de blobs**.

## Referencia de estilo

Video de WhatsApp del trainer (`Downloads/WhatsApp Video 2026-09-30 at 2.50.21 PM.mp4`, 13 s,
captura de pantalla de un tweet). Lo que se toma de él:

- Papel crema con textura suave y un círculo amarillo ("sol") detrás del personaje.
- Contorno de tinta oscura y gruesa, colores planos (rojo, naranja, amarillo).
- Personaje con cara expresiva y movimiento de dibujos animados: squash & stretch, rebotes,
  líneas de velocidad.
- Títulos gruesos y redondeados con un número/etiqueta pequeña encima.
- Transición con explosión/nube de caricatura en lugar de fundido.

## Decisiones ya tomadas con el trainer

1. **Mascota:** un **disco de 20 kg gris** (disco olímpico visto de frente) con ojos y piernas.
   Se descartaron la mancuerna negra en cuatro variantes (torre, goma, sticker, disco) y el
   estilo rojo con ojos de la primera ronda.
2. **Diseño elegido:** "Mancu clásico", **sin nariz ni agujero central**. Cara limpia (ojos,
   mejillas, boca) sobre el acero, con "20 KG" grabado en arco abajo. Tiene **brazos de
   manguera con guantes blancos** (para saludar, celebrar y señalar números) y piernas de
   manguera con zapatos rojos.
3. **Paleta y fondo fijos en el estilo Mancu** (papel crema, sol amarillo, rojo, tinta). Este
   estilo **no** usa la paleta del periodo ni la que la clienta elige en Ajustes. Así el gris de
   Mancu y el dibujo a mano se ven bien con una paleta controlada. El estilo Mancu no usa
   `FondoBlobRenderer`; el estilo blobs sigue usándolo con su `Paleta`.
4. **Mancu es un estilo más, no un reemplazo.** El trainer elige el estilo **por quincena**
   (blobs o Mancu, y los que vengan). Ver "Estilos de video seleccionables por periodo".
5. Se avanza por etapas, validando con el trainer antes de seguir.

## Prototipo de referencia

`docs/superpowers/specs/assets/mancu-prototipo.html`: abrir en el navegador. Contiene el
dibujo completo de Mancu en SVG (función `clasico`) con las tres poses y tres escenas de
ejemplo. **Es la fuente de verdad de proporciones y colores**; portar a Canvas.

### Geometría de Mancu (viewBox 200×200, escalar al tamaño en pantalla)

| Parte | Valor |
|---|---|
| Disco | centro (100, 88), radio 62, relleno `#8f9298`, contorno tinta 5 |
| Aro interior | radio 55, trazo `#6d7076` 4; anillo fino radio 48, `#c9ccd1` 2 al 70% |
| Brillo | arco `#c9ccd1` 5, esquina superior izquierda |
| Texto | "20 KG", Lilita One 15, interletraje 2.5, color `#4a4d52`, sobre arco inferior de radio 50 |
| Ojos | centros (100±22, 70), elipse blanca rx 11.5 ry 13.7, contorno tinta 3.7, pupila r 6.3 tinta con brillo blanco; parpadeo cada ~3.6 s |
| Mejillas | círculos rojo `#d9412b` al 75%, r 6, a ±(22+9) y +16 bajo los ojos |
| Boca | en (100, 100): sonrisa (arco), abierta (relleno `#8c2a1c` con lengua `#e8796a`), dientes (rect blanco con 2 divisiones) |
| Piernas | mangueras tinta 7, salen de y=148; zapatos elipse rx 14 ry 7 rojo con contorno 4 |
| Brazos | mangueras tinta 7 desde los costados del disco (40, ~92) y (160, ~86); guante círculo blanco r 8 contorno 4 |
| Sombra | elipse tinta al 18% en y=192 |

Poses: **hola** (brazo derecho arriba saludando, izquierdo abajo), **orgulloso** (salto,
ambos brazos arriba, ojos felices `^ ^`, boca abierta, confeti), **esfuerzo** (piernas
abiertas, cejas inclinadas, dientes apretados, gotas de sudor).

### Paleta fija

| Token | Hex |
|---|---|
| Papel | `#f3e7c9` (sombra de papel `#eadbb3`) |
| Sol | `#f7d774` |
| Rojo | `#d9412b` |
| Tinta | `#1b1512` |
| Marrón (texto secundario) | `#5a4a40` |
| Grises de Mancu | `#8f9298`, `#6d7076`, `#4a4d52`, `#c9ccd1` |

### Tipografías

- **Lilita One**: títulos y números grandes (contorno de tinta y sombra dura en los números).
- **Patrick Hand**: notas a mano, etiquetas y pie de escena.
- **Nunito** (opcional) para texto de apoyo.

Las tres son Google Fonts con licencia libre: incluirlas en `res/font` (no depender de red).

## Qué hace Mancu en cada escena

| Escena | Pose / acción |
|---|---|
| Saludo | Entra saltando y saluda con el guante. |
| Asistencia | Sostiene el número y lo aplasta al aparecer. |
| Tiempo | Mira de reojo ("curioso") mientras se dibuja la gráfica de línea. |
| Día favorito | Señala la rebanada más grande de la dona. |
| Racha más larga | Pose de esfuerzo, sudor y sentadillas. |
| Medalla | Se pone la medalla y celebra con confeti. |
| Logros personales | Cada logro entra de la mano de Mancu. |
| Despedida | Se despide y se va caminando. |

(La escena "Esfuerzo" ya se quitó del video en `1d92b16`; no se repone.)

Entre escenas, una **nube de caricatura** limpia la pantalla (reemplaza al crossfade de 600 ms).
Hay que decidir al implementar si la nube mantiene la ventana de 600 ms de
`TimelineResumen` o la reemplaza, sin cambiar las duraciones por escena.

## Estado actual del código (para no re-explorar)

- Todo el video vive en `app/src/main/java/com/osfit/app/video/`:
  - `EscenaResumen.kt`: modelo de escenas (`Saludo`, `Asistencia`, `Tiempo`, `DiaFavorito`,
    `RachaMasLarga`, `Medalla`, `LogrosPersonales`, `Despedida`). **No cambia.**
  - `TimelineResumen.kt`: duraciones por escena y crossfade de 600 ms con reloj de contenido
    adelantado. Las duraciones deben mantenerse (revisar solo si la coreografía nueva no cabe).
    `MENSAJE_MEDALLA_INICIO_MS` debe coincidir con el bloque de texto del renderer.
  - `ResumenFrameRenderer.kt` (~970 líneas): dibuja cada frame en `Canvas`. **Aquí está el
    grueso del trabajo.**
  - `FondoBlobRenderer.kt`: fondo de blobs con `Paleta` y `BlurMaskFilter`. **Se queda**: es del
    estilo blobs. Mancu tiene su propio fondo de papel + sol.
- Selección por periodo ya existente: `data/repository/ConfigVideoRepository.kt` (colección
  `configVideo/{rangoInicio}`, hoy solo `paletaId`; `paletaDe` devuelve la `Paleta` y
  `guardar` hace `set` que pisa el documento), `data/model/ConfigVideoPeriodo.kt`,
  `ui/configvideo/ConfigVideoScreen.kt` y `ConfigVideoViewModel.kt`, y `paletas/Paleta.kt`
  (`Paletas.porIdVideo`). El generador la lee en `ResumenVideoGenerator.kt` línea ~83. Nota: el
  spec antiguo `2026-09-09-configuracion-video-por-periodo-design.md` habla de `PaletaVideo`,
  pero el código ya evolucionó a `Paleta`; fiarse del código.
  - `ResumenVideoEncoder.kt` (MediaCodec, ~38 KB) y `ResumenVideoGenerator.kt` (30 fps,
    arma escenas desde `ResumenClienteData`, medalla y logros): no deberían cambiar.
  - `MaquinaEscribir.kt`: efecto máquina de escribir; reusable para textos.
- El renderer no depende de `Context`: los bitmaps (medalla, logros) llegan ya decodificados en
  las escenas. Las fuentes nuevas obligan a pasarle los `Typeface` ya cargados (cargarlos en el
  generador, igual que los bitmaps).
- El graphify de este repo no está generado (`graphify-out/` no existe); se exploró con
  búsqueda normal.

## Plan por etapas

0. **Infraestructura de estilos (sin cambio visual):** `EstiloVideo` (id, nombre), `estiloId` en
   `ConfigVideoPeriodo` y en el repositorio (con merge, sin pisar la paleta), `RendererVideo`,
   el renderer actual envuelto como estilo `blobs`, y el generador eligiendo el renderer por
   periodo. Con solo `blobs` registrado, **los videos salen idénticos a hoy** y los tests
   existentes pasan sin modificarse. Se puede commitear y validar antes de dibujar nada de Mancu.
1. **Selector en la pantalla de configuración:** estilo por quincena (y paleta solo si el
   estilo la usa). Con un único estilo real se puede probar con un `mancu` temporal que dibuje
   un frame de prueba.
2. **Mascota y base de Mancu:** fuentes en `res/font`; clase de dibujo de Mancu en Canvas
   (parámetros: pose, parpadeo, rebote, tiempo) y fondo papel + sol. Verificar con un frame suelto.
3. **Escena de Saludo** en el estilo Mancu y un video de prueba que el trainer revise.
4. **Resto de escenas** (Asistencia, Tiempo, Día favorito, Racha, Medalla, Logros, Despedida),
   una por una, manteniendo los mismos textos y datos.
5. **Transición de nube** entre escenas.
6. Ajustar duraciones si hace falta y agregar tests (estilo por id con fallback a `blobs`,
   persistencia de estilo sin pisar paleta).

## Riesgos y cosas a vigilar

- **Rendimiento:** la textura de papel y el trazo irregular cuestan por frame. Pre-renderizar
  en un `Bitmap` reutilizable (como ya hace `FondoBlobRenderer` con su capa) y no crear `Paint`
  ni `Path` por frame.
- **Mascota en Canvas:** reproducir el SVG con `Path`/`drawOval`/`drawArc`; las mangueras de
  brazos y piernas son curvas cuadráticas con `StrokeCap.ROUND`.
- **Legibilidad:** textos de gráficas (línea de tiempo, dona) y mensajes de medalla/logros
  deben seguir siendo claros sobre el papel crema; revisar contraste.
- **Medallas/logros con imagen propia** deben seguir apareciendo igual de grandes y legibles.
- **Trabajo sin commitear:** al empezar la sesión hay cambios en
  `domain/ResumenClienteCalculator.kt` y su test, y un plan sin rastrear
  (`plans/2026-10-01-promedio-dias-sin-tiempo-video.md`). No tocar ni mezclar en el commit de
  este trabajo; confirmar con el trainer si ya están cerrados.

## Fuera de alcance

- Cambiar qué datos muestra cada escena, su orden o los textos.
- Música/audio (`CancionUtil`) y el flujo de compartir o publicar en la web.
- Usar la paleta de la clienta o la del periodo en el estilo Mancu.
- Modificar el aspecto o las animaciones del estilo `blobs`.
- Estilos adicionales más allá de `blobs` y `mancu` (solo se deja la estructura lista).
- Elegir estilo por cliente: es **por quincena**, parejo para todos los clientes del periodo,
  igual que la paleta. La música sigue siendo por cliente.
- Resúmenes semanal y mensual: siguen heredando el estilo por defecto (`blobs`), como hoy con
  la paleta.
