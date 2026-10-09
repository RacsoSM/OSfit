# Mapa muscular de espalda (hombre): cómo se genera el SVG

`web/public/mapa-muscular-espalda.svg` está calcado de `referencia.png` (la que compartió el
entrenador). Igual que el de frente (`../README.md`), no está dibujado a mano: sale de estos
scripts, así que para retocarlo se cambia el script y se vuelve a generar.

Desde esta carpeta (requisitos: `numpy pillow opencv-python-headless scikit-image scipy`):

```sh
python3 mascaras.py       # 1. silueta, eje y máscara de cada músculo y de cada zona sin color
python3 ridge.py          # 2. filtro de Sato: centro de las líneas blancas (ridge.npy)
python3 vectorizar.py ../../../web/public/mapa-muscular-espalda.svg   # 3. SVG final
```

Cómo funciona, por si hay que tocarlo:

- **Carga (`cargar.py`):** la referencia se voltea en horizontal, porque su mano izquierda sale
  cortada por el borde de la imagen y el método trabaja con la mitad izquierda y la refleja. La
  cabeza y el cuello están dibujados 2.4 px a la izquierda del eje del cuerpo y se centran.
- **Escala:** la figura mide 780 unidades de alto, como la de frente, así que las dos vistas van
  a la misma escala y líneas y huecos miden lo mismo (3 unidades).
- **Lados:** de espaldas, la derecha de la persona queda a la DERECHA del dibujo. Los músculos
  que también salen de frente (`hombro`, `antebrazo`, `cuadriceps`, `pantorrilla`) usan el mismo
  id, así que un nivel pinta las dos vistas.
- **Zonas sin color:** en la referencia son negras; aquí van en gris, como en las vistas de
  frente. `trapecio` y `lumbar` son músculos (se pueden pintar), grises por defecto.
- **Separaciones:** donde dos piezas están a menos de `JUNTOS`, la frontera cae en el centro de
  la línea blanca de la foto y cada una se retira lo mismo. Los blancos anchos (cintura, rodillas,
  la cuña del tríceps) se conservan. La columna va siempre centrada en el eje.
- **Formas lisas:** las cabezas de la pantorrilla y la franja de fuera del muslo se rehacen con
  pocos armónicos de Fourier (`PANT_ARMONICOS`); del glúteo y el antebrazo solo se alisa el borde
  que da al blanco.
- **`lineas.py`:** la T blanca del cuello (anchura medida fila a fila) y las líneas de la mano,
  que en la referencia es un dibujo de líneas: aquí es gris con contorno fino y las líneas encima,
  como la mano de frente.
