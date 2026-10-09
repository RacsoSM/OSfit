# Mapa muscular: cómo se genera el SVG

`web/public/mapa-muscular-frente.svg` está calcado de `referencia.png` (imagen libre de uso
que compartió el entrenador; ver `docs/backlog-2.md`, punto 4). No está dibujado a mano: sale
de estos scripts, así que para retocarlo se cambia el script y se vuelve a generar.

Requisitos: `pip install numpy pillow opencv-python-headless scikit-image`.

Desde esta carpeta:

```sh
python3 segmentar.py      # 1. cada píxel -> color de la paleta (labels.npy)
python3 ridge.py          # 2. filtro de Sato: dónde están las líneas blancas finas (ridge.npy)
python3 mascaras.py       # 3. máscaras limpias y simétricas por músculo + líneas internas
python3 vectorizar.py ../../web/public/mapa-muscular-frente.svg   # 4. contornos -> Bézier
```

Cómo funciona, por si hay que tocarlo:

- **Simetría:** el eje está en x = 200.5 de la foto. Se usa solo la mitad izquierda del
  dibujo y se refleja; los paths del lado `izq` son el reflejo exacto de los del lado `der`.
- **Relleno:** cada músculo se rellena entero con su contorno exterior (cierre morfológico),
  y las divisiones internas (abdomen, muslo, antebrazo, la curva del pecho) se dibujan
  encima como trazos de grosor uniforme, sacados del esqueleto del mapa de crestas.
- **Los umbrales** de cada músculo están en `mascaras.py` (`umbral` y `close`). Si una línea
  sobra o falta, es ahí.
