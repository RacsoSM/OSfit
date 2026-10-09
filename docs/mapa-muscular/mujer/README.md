# Mapa muscular de la mujer: cómo se genera el SVG

`web/public/mapa-muscular-frente-mujer.svg` está calcado de `referencia.png` (la que compartió el
entrenador). Igual que el del hombre (`../README.md`), no está dibujado a mano: sale de estos
scripts, así que para retocarlo se cambia el script y se vuelve a generar.

Desde esta carpeta (requisitos: `numpy pillow opencv-python-headless scikit-image scipy`):

```sh
python3 segmentar.py      # 1. cada píxel -> color de la paleta (labels.npy)
python3 mascaras.py       # 2. silueta, eje y máscara de cada músculo y de las partes grises
python3 ridge.py          # 3. filtro de Sato: centro de las líneas blancas (ridge.npy)
python3 vectorizar.py ../../../web/public/mapa-muscular-frente-mujer.svg   # 4. SVG final
```

Cómo funciona, por si hay que tocarlo:

- **Simetría:** el eje está en x = 198 de la foto (las dos mitades coinciden en un 98.7 %). Se
  trabaja con la mitad izquierda del dibujo y se refleja; la cabeza no, porque la coleta va a un
  lado.
- **Escala:** sin contar la coleta, la figura mide 780 unidades, como la del hombre, así que
  líneas y huecos miden lo mismo en los dos.
- **Bordes de cada color:** donde el color cruza la mitad de su transición hacia el blanco (rojo,
  morado y lila por separado), no por la etiqueta más cercana, que deja fuera el halo del borde.
- **Separaciones:** entre dos músculos, la frontera es el centro de la línea blanca de la foto
  (inundación sobre el mapa de crestas), y luego cada uno se retira lo mismo: toda separación
  mide 3 unidades. El contorno hacia el fondo mide 5 (en esta foto es más grueso que las líneas)
  y 3.5 en las manos. Los bordes se suavizan por voto entre vecinos, para que donde se juntan
  tres piezas no quede una gota blanca.
- **`lineas.py`**: líneas internas (abdomen, muslo, pantorrilla, V del cuello, tobillo) como
  curvas suaves por puntos medidos en la foto; fronteras medidas (pecho/abdomen e ingle), que
  mandan sobre el trazado; el borde de abajo del muslo y de la pantorrilla, medido columna a
  columna; y el parche de la parte alta del muslo, que en la foto es casi blanca.
- **Peinado:** la cabeza (pelo, coleta alta y cara) se calca de `referencia-peinado.png`, otra
  imagen del entrenador, porque le gustaba más que el moño de la primera. Es un dibujo de
  líneas: las zonas que encierran son el pelo, la coleta y la cara. `PEINADO_TRANSF`
  (`mascaras.py`) la pone encima de la cara de la primera foto (solapan un 82 %); del cuello para
  abajo todo sigue siendo de la primera. Pelo y coleta son grises, separados por la línea del
  contorno de la cabeza.
- Esa misma imagen, con el torso más nítido, sirvió para confirmar cómo se conectan las líneas
  del abdomen y del cuello. El torso no se calca de ella: tiene otras proporciones.

- **Líneas lisas:** las del muslo, la pantorrilla y la ingle se ajustaron a curvas suaves con
  `alisar.py` (los puntos medidos traían 1-2 px de ruido, que se veía como pulso tembloroso). Las
  dos cabezas de la pantorrilla se rehacen como husos lisos (pocos armónicos de Fourier,
  `PANT_ARMONICOS`) y se separan a lo largo de la línea `PANTORRILLA` con el ancho de siempre.
- **Pecho:** el borde de arriba sigue una curva medida (frontera con el cuello) y la costura entre
  los dos pechos va sobre el eje con el ancho de las demás separaciones (`COSTURAS`); el cuello es
  simétrico. Así arriba se forma una "Y" limpia en el esternón.
- `TRAMOS_LIBRES`: trozos de línea que se dibujan sin recorte donde nacen justo en el borde de su
  músculo (vértice de la cadera, muesca de abajo del muslo), para que no quede un hilo de color.

Para mover una línea o un borde, se cambian sus puntos en `lineas.py` y se vuelve a correr el
paso 4.
