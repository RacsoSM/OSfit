# Mapa muscular de espalda (mujer): cómo se genera el SVG

`web/public/mapa-muscular-espalda-mujer.svg` está calcado de `referencia.png` (la que compartió
el entrenador). Usa el mismo método que la espalda del hombre (`../espalda/README.md`): no está
dibujado a mano, sale de estos scripts.

Desde esta carpeta (requisitos: `numpy pillow opencv-python-headless scikit-image scipy`):

```sh
python3 ridge.py          # 1. filtro de Sato: centro de las líneas blancas (ridge.npy)
python3 mascaras.py       # 2. silueta, eje y máscara de cada músculo y de cada zona gris
python3 vectorizar.py ../../../web/public/mapa-muscular-espalda-mujer.svg   # 3. SVG final
```

Lo que cambia respecto a la del hombre:

- **Los músculos salen de las líneas, no del color:** en esta referencia la espalda y las piernas
  son de un solo lila, así que cada pieza es una zona encerrada por líneas blancas (por eso aquí
  el mapa de crestas va primero). Los rojos (deltoide, tríceps, antebrazo) sí salen del color.
- **Volteo:** se mide sobre la referencia volteada (`cargar.py`) y al escribir se vuelve a
  voltear, así que el dibujo queda como la referencia: la coleta cae del lado izquierdo de la
  persona, igual que de frente. De espaldas, la derecha de la persona queda a la derecha del
  dibujo.
- **Cabeza asimétrica:** la cabeza va tal cual (no se refleja), con la línea que separa la coleta
  (`LINEAS_SIN_REFLEJO`), y junto a ella cada mitad del trapecio sigue a la cabeza de su lado
  (`CUELLO_HUECO`): la foto aclara el cuello casi hasta el blanco.
- **Bordes:** en esta foto el blanco entre cada pieza y el contorno mide 7-9 px (brillo del
  contorno); cada pieza se lleva hasta el contorno con el borde de siempre (`MARGEN_FONDO`), sin
  tocar el blanco de codos, rodillas y tobillos.
- **Formas lisas:** glúteo, pantorrillas y pie se rehacen con pocos armónicos de Fourier; el
  dorsal, el isquiotibial y la franja de fuera del muslo siguen el borde del glúteo.
- **Columna:** lleva el huso blanco de arriba medido en la foto (`COLUMNA_HUSO`), centrado.
- **Ids:** los mismos que la espalda del hombre, sin `lumbar` (aquí es parte del dorsal). En la
  rodilla, la punta de la franja de fuera del muslo queda cortada por el cruce de líneas, como en
  la referencia, y es otra pieza de `cuadriceps`.
