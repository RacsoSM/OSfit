# Más estilos en Ajustes: neón, cómic y minimalista

Sigue a `2026-10-07-estilo-pixel-art-design.md`: mismo combo, mismo mecanismo
(`data-estilo` en `<html>`, una hoja por estilo, preferencia en `localStorage`).
El combo queda: Clásico (por defecto), Pixel art, Neón, Cómic, Minimalista.

## Lo que se generalizó

- **Fuentes por estilo.** `FUENTES` en `estilo.ts` dice qué pide cada uno a
  Google Fonts; el script en línea de `index.html` las repite (corre antes del
  bundle). `estilo.test.ts` revisa que las dos copias coincidan, que cada hoja
  esté enlazada y que vayan después de `estilos.css`.
- **Una transición por estilo**, elegida por el estilo al que se LLEGA
  (`ui/cambioDeEstilo.ts`). Su CSS vive en `estilos.css` sin colgar de
  `data-estilo`, porque la mitad que tapa corre con el estilo viejo puesto. Las
  fuentes del destino se piden al empezar la transición, no al terminar, para
  que lleguen mientras la pantalla está tapada.
- **La ruleta queda fuera** de los botones de cada estilo
  (`.boton:not(.ruleta-caja .boton)`): sobre su tapete verde, un botón del
  color de la paleta se camuflaría (entrada 26 del backlog).

## Neón

Synthwave de los 80. Cada borde es un tubo: filo `--primario-claro` y halo de
`--primario`. Secundarios y deshabilitados son tubos apagados (sin halo).
Fondo de CSS puro: sol retro en franjas (máscara) asentado en el horizonte de
una cuadrícula en perspectiva que avanza. Monoton solo en saludo y títulos
(se lee únicamente en grande); Tilt Neon en el resto. El nombre tiene un
"falso contacto" ocasional. Transición: apagón con parpadeo y encendido de
monitor viejo.

## Cómic

Tema claro, de papel con trama de puntos. Todo con tinta: contorno grueso y
sombra dura. Los títulos de tarjeta son el recuadro amarillo del narrador,
colgado de la esquina. Los botones principales son amarillos con letra negra
en todas las paletas, por contraste. Un "¡POW!" junto al ☰. Las medallas del
ranking pasan a marcatexto (el oro sobre papel no se leía). Transición: una
onomatopeya al azar que estalla y la viñeta que se va como página que se pasa.

## Minimalista

El único tema claro "de lectura": pensado para usar la página a pleno sol.
Inter, mucho aire y un solo acento. Como el `--primario` de las paletas es
claro (pensado para fondo oscuro), el acento de texto es `--primario-oscuro`;
la tarjeta del día es el único bloque de color. Los días sin marcar del
calendario son solo un número. Transición: fundido.

## Fuera de alcance

Sincronizar el estilo entre dispositivos y que el entrenador lo elija desde la
app.
