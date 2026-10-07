# Estilo de la página desde Ajustes: pixel art

## Qué

Ajustes deja de decir "Muy pronto" y trae un combo (`<select>`) **Estilo de la
página** con dos opciones: **Clásico** (el de siempre, marcado por defecto) y
**Pixel art**. El estilo cambia solo cuando la clienta elige otra opción del
combo, y se queda guardado en ese navegador.

## Decisiones

- **Solo front.** La preferencia vive en `localStorage` (`osfit.estilo`), no en
  Firestore: la página no escribe en Firestore, y un estilo visual no justifica
  una Cloud Function ni un campo nuevo. Costo aceptado: en otro teléfono vuelve
  a verse el clásico hasta que lo cambie ahí.
- **El clásico no se toca.** El estilo se marca con `data-estilo="pixel"` en
  `<html>`; el clásico *quita* el atributo. Todo el pixel art vive en
  `estiloPixel.css` y cada regla cuelga de `:root[data-estilo="pixel"]`, así que
  sin el atributo la página es exactamente la de antes.
- **Sin parpadeo al cargar.** Un script en línea en `index.html` lee la
  preferencia y pone el atributo y las fuentes antes de que llegue el bundle.
- **La paleta se respeta.** El pixel art cambia neutros (fondo, superficies,
  texto) y la forma; `--primario*` sigue siendo lo que eligió el entrenador. El
  cielo, las montañas y la cortina se tiñen con ella.
- **Combo nativo.** En el teléfono abre la hoja del sistema y el lector de
  pantalla lo entiende sin ARIA a mano; solo se estiliza la caja cerrada.

## El pixel art

- Fuentes: Press Start 2P para títulos y números, Pixelify Sans para el texto
  corrido (la primera es ilegible en párrafos). Se piden a Google Fonts solo si
  se elige pixel.
- Bordes mellados de 8 bits hechos con cuatro sombras sin difuminar, biseles y
  grosor inferior; botones que se hunden un píxel al apretarlos.
- Tarjeta del día con el degradado de la paleta en franjas y tramado
  (dithering) de tablero.
- Fondo: cielo en franjas, estrellas que titilan por turnos, luna, estrella
  fugaz cada 9 s y montañas con pinos, todo con `crispEdges` y trazos solo H/V.
  Vive en `ui/fondoPixel.ts`, no en el HTML, para no cargárselo al clásico.
- Menú como cuadro de diálogo de RPG: velo tramado, panel que entra a saltos y
  un cursor ▸ que parpadea junto a la ventana activa.
- Líneas de monitor CRT muy tenues y un puntero de flecha pixelado en
  computadora.
- El cambio de estilo pasa detrás de una cortina de cuadros que barre en
  diagonal y se retira (tapa además el instante en que llegan las fuentes).
- `prefers-reduced-motion`: sin cortina, sin titileo, sin estrella fugaz.

## Fuera de alcance

Más estilos (el catálogo `ESTILOS` en `estilo.ts` está listo para sumarlos), la
paleta elegida por la clienta (spec del 2026-09-25) y sincronizar el estilo
entre dispositivos.
