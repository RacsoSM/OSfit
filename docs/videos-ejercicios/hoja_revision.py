"""
Junta las hojas `salida/<id>-poses.png` que deja `camino1.py` en pocas imágenes para revisar
de un vistazo (y mandárselas al entrenador): `salida/_revision-1.png`, `_revision-2.png`, …
Cada celda lleva el id y el nombre del ejercicio. Solo usa Pillow.

Uso, desde `docs/videos-ejercicios/`:
  venv/bin/python hoja_revision.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI / "salida"
SEMILLA = AQUI.parent.parent / "functions" / "semilla" / "ejercicios.json"
POR_HOJA = 20  # 2 columnas x 10 filas: legible en el teléfono
ANCHO, ALTO, TEXTO = 480, 240, 22


def main() -> None:
    nombres = {e["id"]: e["nombre"] for e in json.loads(SEMILLA.read_text(encoding="utf-8"))}
    hojas = sorted(SALIDA.glob("*-poses.png"))
    if not hojas:
        raise SystemExit("No hay hojas en salida/: corre camino1.py primero.")
    for n, inicio in enumerate(range(0, len(hojas), POR_HOJA), start=1):
        grupo = hojas[inicio:inicio + POR_HOJA]
        filas = (len(grupo) + 1) // 2
        lienzo = Image.new("RGB", (2 * ANCHO, filas * (ALTO + TEXTO)), "white")
        dibujo = ImageDraw.Draw(lienzo)
        for k, ruta in enumerate(grupo):
            id_ = ruta.name.removesuffix("-poses.png")
            x, y = (k % 2) * ANCHO, (k // 2) * (ALTO + TEXTO)
            lienzo.paste(Image.open(ruta).convert("RGB").resize((ANCHO, ALTO)), (x, y + TEXTO))
            dibujo.text((x + 4, y + 4), f"{id_} · {nombres.get(id_, '?')}", fill="black")
        destino = SALIDA / f"_revision-{n}.png"
        lienzo.save(destino)
        print(destino)


if __name__ == "__main__":
    main()
