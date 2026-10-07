# Estilo sakura

Sexto estilo del combo de Ajustes, sobre el mismo mecanismo que los anteriores
(ver `2026-10-07-estilo-pixel-art-design.md`). Pedido: estilo japonés, con un
cerezo de fondo, pétalos animados cayendo en toda la ventana y el rosa del
sakura como color dominante.

## Decisiones

- **Ilustrado, no pixel art.** Ya existe un estilo pixel; el sakura se hizo
  como una estampa ukiyo-e: sol rosado, el Fuji tenue, un cerezo de tinta en
  flor que sube desde la esquina y una rama que entra por arriba.
- **No usa la paleta de la clienta.** Es el único estilo así: el pedido era que
  mandara el rosa del cerezo. Ojo al tocarlo: `paleta.ts` escribe
  `--primario*` en línea sobre `<html>`, así que redefinirlas en la hoja no
  sirve; el estilo usa sus propias variables `--sk-*`.
- **El árbol crece por código** (`ui/sakura.ts`): ramas que se parten en dos o
  tres más cortas y finas, con racimos de flores en las puntas y a lo largo de
  las ramas finas. Semilla fija: es el mismo árbol en cada carga.
- **Pétalos en `<canvas>`** (`ui/petalos.ts`), no un nodo por pétalo, para no
  recomponer la página en cada cuadro. Dos capas: unos 32 chicos detrás de las
  tarjetas y unos 7 grandes y desenfocados delante (sin atrapar toques), por la
  profundidad. Física: brisa que cambia sin repetirse y nunca cambia de
  sentido, vaivén, giro y volteo (se ven de canto y caen un poco más rápido).
- **Tocar la pantalla sopla los pétalos** lejos del dedo (escucha `passive`:
  nunca frena el scroll ni un botón).
- **Ahorro:** la animación se detiene de verdad al salir del estilo (no solo se
  esconde), `requestAnimationFrame` se pausa en otra pestaña, la densidad del
  lienzo tiene tope de 2 y la cantidad de pétalos escala con la pantalla.
- **Menos movimiento:** sin pétalos cayendo ni árbol meciéndose; el paisaje en
  flor se queda.
- Colores del calendario en tonos tradicionales que dicen lo mismo: matcha
  (asististe), bermellón shu (faltaste), amarillo yamabuki (justificada).
- Detalles: sello rojo con 桜 junto al ☰, olas seigaiha y una flor que gira
  despacio en la tarjeta del día, una florecita en cada título. Fuentes:
  Shippori Mincho (títulos) y Zen Maru Gothic (texto).
- Transición: una ráfaga de pétalos cruza la pantalla mientras se tiñe de rosa.
