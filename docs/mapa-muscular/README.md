# Mapa muscular: cómo se genera el SVG

`web/public/mapa-muscular-frente.svg` está calcado de `referencia.png` (imagen libre de uso
que compartió el entrenador; ver `docs/backlog-2.md`, punto 4). No está dibujado a mano: sale
de estos scripts, así que para retocarlo se cambia el script y se vuelve a generar.

Requisitos: `pip install numpy pillow opencv-python-headless scikit-image`.

Desde esta carpeta:

```sh
python3 segmentar.py      # 1. cada píxel -> color de la paleta (labels.npy)
python3 ridge.py          # 2. filtro de Sato: dónde están las líneas blancas finas (ridge.npy)
python3 mascaras.py       # 3. máscaras limpias y simétricas de cada músculo
python3 vectorizar.py ../../web/public/mapa-muscular-frente.svg   # 4. SVG final
```

(`vectorizar.py` importa `lineas.py`, así que se corre sin `-I`.)

Cómo funciona, por si hay que tocarlo:

- **Simetría:** el eje está en x = 200.5 de la foto. Se trabaja con la mitad izquierda del
  dibujo; los paths del lado `izq` son el reflejo exacto de los del lado `der`.
- **Relleno de cada músculo:** sale del trazado de la foto (pasos 1–3), suavizado.
- **Separaciones uniformes:** donde dos músculos son vecinos, el borde se pone en la línea
  media entre ambos y cada uno se retira lo mismo, así que toda separación blanca mide 3 px,
  igual que las líneas. Las fronteras más visibles (pecho/abdomen, bíceps/abdomen,
  abdomen/muslo) no salen del trazado sino de curvas medidas en `lineas.py`.
- **Líneas internas** (pecho, abdomen, muslo, antebrazo) y el **trapecio** están dibujados en
  `lineas.py` como curvas suaves por puntos medidos sobre la foto. Cuando una línea nace de
  otra comparte el punto exacto, así que siempre conectan; y se recortan con la forma de su
  músculo (`clipPath`), por eso terminan justo en el borde.
- **Retoques:** la foto es tan borrosa en la rodilla y en el arranque del muslo que el trazado
  pierde puntas finas; `MUSLO_PARCHES` en `lineas.py` las completa.

Para mover una línea o un borde, se cambian los puntos en `lineas.py` y se vuelve a correr el
paso 4.
