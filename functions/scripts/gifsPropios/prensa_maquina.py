"""Genera el GIF de "Prensa en máquina" (prensa horizontal sentado, a dos piernas).

El dataset solo trae la prensa horizontal a UNA pierna (2611, © Gym visual). Este script
la convierte en dos piernas, pose por pose:

  1. borra la pierna que descansa en el escalón y reconstruye la máquina que tapaba;
  2. dibuja detrás una copia de la pierna que empuja, desplazada y más oscura (la pierna
     lejana), con sombra donde se junta con la cercana;
  3. vuelve a poner encima la pierna cercana y el torso originales.

Las animaciones de Gym visual son dos poses con un fundido entre ellas; aquí se rehacen
igual: 1 s en cada pose y 5 cuadros de 0.1 s de transición.

Uso, desde `functions/`:

    python3 -I scripts/gifsPropios/prensa_maquina.py             # baja 2611 del dataset
    python3 -I scripts/gifsPropios/prensa_maquina.py --revision  # además, hoja con las guías

Deja `scripts/salida/propios/prensa-maquina.gif` (ignorada por git, como los demás GIF de
Gym visual). Requiere Pillow y numpy. El proceso completo está en `docs/generargifs.md`.
"""
import io
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# GEMELO: `DATASET` en `scripts/bancoEjercicios.mjs`. Fijo al mismo commit para que el
# resultado no cambie si el autor del dataset reemplaza el archivo.
URL_ORIGEN = (
    "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/"
    "7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/2611-9KU9TYF.gif"
)
SALIDA = Path(__file__).resolve().parent.parent / "salida" / "propios"
ARCHIVO = "prensa-maquina.gif"

BLANCO = (255, 255, 255)
NEGRO = (6, 6, 6)

# Cuadros del GIF original que tienen las dos poses limpias (los demás son el fundido).
CUADRO_FLEXIONADA = 0
CUADRO_EXTENDIDA = 6

# Polígonos en píxeles del GIF de 180×180, trazados a mano sobre una ampliación con
# cuadrícula. "cerca": pie, espinilla y muslo de la pierna que empuja. "descansa": la que
# se borra. "torso": persona a la derecha del muslo. "movil": el asiento, que se desliza
# y por eso no sirve de fondo para la otra pose. "caja": el escalón, que la pierna que
# descansa tapa en las dos poses y hay que repintar. "recorte_lejos": redondea la
# rodilla lejana, que hereda la esquina del recorte de la cercana.
POSES = {
    "flexionada": {
        "cerca": [(22, 70), (27, 66), (33, 74), (45, 76), (56, 73), (63, 71), (69, 69), (75, 71),
                  (80, 79), (81, 86), (81, 97), (80, 110), (78, 120), (72, 128), (62, 130),
                  (56, 124), (57, 118), (58, 108), (59, 96), (57, 90), (46, 90), (36, 92),
                  (29, 91), (23, 88)],
        "descansa": [(35, 91), (46, 89), (58, 89), (62, 96), (61, 108), (55, 117), (49, 123),
                     (48, 129), (46, 138), (32, 138), (17, 137), (16, 128), (27, 124), (32, 116),
                     (33, 104)],
        "torso": [(78, 56), (112, 56), (115, 90), (110, 110), (100, 125), (98, 150), (76, 150),
                  (76, 125), (81, 100), (80, 82)],
        "movil": [(44, 118), (87, 118), (87, 138), (44, 138)],
        "caja": [(19, 136), (45, 136), (42, 158), (20, 158)],
        "recorte_lejos": [(60, 60), (92, 60), (92, 82), (82, 79), (80, 74), (77, 71), (73, 69.5),
                          (67, 70), (60, 71.5)],
    },
    "extendida": {
        "cerca": [(22, 70), (27, 66), (35, 75), (50, 81), (64, 86), (72, 89), (78, 90),
                  (90, 96), (102, 103), (110, 110), (112, 122), (104, 128), (92, 126), (84, 118),
                  (74, 107), (66, 103), (52, 101), (40, 97), (30, 94), (23, 90)],
        "descansa": [(17, 127), (28, 126), (42, 121), (55, 116), (66, 110), (76, 108), (86, 112),
                     (92, 122), (84, 127), (74, 126), (62, 131), (48, 135), (36, 139), (18, 139)],
        "torso": [(108, 55), (145, 55), (148, 90), (140, 115), (130, 125), (128, 150), (110, 150),
                  (108, 128), (112, 112), (110, 85)],
        "movil": [(75, 120), (113, 120), (113, 138), (75, 138)],
        "caja": [(19, 136), (45, 136), (42, 158), (20, 158)],
    },
}

# La pierna lejana: cuánto se corre (atrás y arriba), cuánto se oscurece y la sombra de
# contacto con la cercana. Con menos de ~6 px se lee como un contorno doble, no como pierna.
DESPLAZA = (7, -7)
OSCURECE = 0.8
SOMBRA = 0.3
SOMBRA_RADIO = 2.5


def mascara(tam, poly, suave=0.0):
    m = Image.new("L", tam, 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m.filter(ImageFilter.GaussianBlur(suave)) if suave else m


def silueta(orig, poly):
    """La forma sólida de lo que hay dentro del polígono: sin el fondo blanco que trae el
    polígono y sin huecos donde la piel tiene brillos casi blancos."""
    tam = orig.size
    m = np.array(mascara(tam, poly))
    piel = (np.array(orig.convert("L")) < 250).astype(np.uint8) * 255
    sil = Image.fromarray(np.minimum(piel, m))
    sil = sil.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    ImageDraw.floodfill(sil, (0, 0), 128)
    return Image.fromarray(np.minimum(np.where(np.array(sil) == 128, 0, 255), m).astype(np.uint8))


def componer(poses, nombre):
    cfg = POSES[nombre]
    orig = poses[nombre]
    tam = orig.size
    base = orig.copy()

    # 1. Borrar la pierna que descansa. La máquina (salvo el asiento) no se mueve entre
    # poses: lo que había detrás se toma de la otra pose donde ahí no estorba la persona.
    otro = next(n for n in POSES if n != nombre)
    o = POSES[otro]
    ocupado = np.maximum.reduce(
        [np.array(mascara(tam, o[k])) for k in ("cerca", "descansa", "torso", "movil")]
    )
    hueco = np.array(mascara(tam, cfg["descansa"]))
    ImageDraw.Draw(base).polygon(cfg["descansa"], fill=BLANCO)
    base.paste(poses[otro], (0, 0), Image.fromarray(np.where(ocupado > 0, 0, hueco).astype(np.uint8)))
    caja = np.minimum(hueco, np.array(mascara(tam, cfg["caja"])))
    base.paste(Image.new("RGB", tam, NEGRO), (0, 0), Image.fromarray(caja))

    # 2. La pierna lejana: copia sólida de la cercana, desplazada, oscurecida y con sombra
    # donde queda pegada a la cercana.
    sil = silueta(orig, cfg["cerca"])
    m_lejos = Image.new("L", tam, 0)
    m_lejos.paste(sil, DESPLAZA)
    if "recorte_lejos" in cfg:
        ImageDraw.Draw(m_lejos).polygon(cfg["recorte_lejos"], fill=0)
    lejos = Image.new("RGB", tam, BLANCO)
    lejos.paste(orig, DESPLAZA)
    cerca = mascara(tam, cfg["cerca"]).filter(ImageFilter.GaussianBlur(SOMBRA_RADIO))
    factor = OSCURECE * (1 - SOMBRA * np.array(cerca).astype(np.float32) / 255)
    arr = np.array(lejos).astype(np.float32) * factor[..., None]
    lejos = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
    base.paste(lejos, (0, 0), m_lejos.filter(ImageFilter.GaussianBlur(0.35)))

    # 3. Encima, la pierna cercana (por su silueta: el polígono traería fondo blanco que
    # taparía la lejana) y el torso originales.
    base.paste(orig, (0, 0), sil.filter(ImageFilter.GaussianBlur(0.4)))
    base.paste(orig, (0, 0), mascara(tam, cfg["torso"], 0.4))
    return base


def leer_poses(gif):
    im = Image.open(io.BytesIO(gif))
    poses = {}
    for nombre, n in (("flexionada", CUADRO_FLEXIONADA), ("extendida", CUADRO_EXTENDIDA)):
        im.seek(n)  # Pillow entrega el cuadro ya compuesto sobre los anteriores
        poses[nombre] = im.convert("RGB")
    return poses


def animar(a, b):
    """Igual que Gym visual: 1 s en cada pose y un fundido de 5 cuadros de 0.1 s."""
    cuadros = [a] + [Image.blend(a, b, i / 6) for i in range(1, 6)]
    cuadros += [b] + [Image.blend(b, a, i / 6) for i in range(1, 6)]
    duraciones = [1000] + [100] * 5 + [1000] + [100] * 5
    return cuadros, duraciones


def hoja_revision(poses, resultado):
    """Original con las guías encima y resultado, por pose, ampliado ×3."""
    colores = {"cerca": (0, 200, 0), "descansa": (0, 120, 255), "torso": (255, 0, 200)}
    piezas = []
    for nombre in POSES:
        g = poses[nombre].copy()
        d = ImageDraw.Draw(g)
        for k, c in colores.items():
            d.polygon(POSES[nombre][k], outline=c)
        piezas += [g, resultado[nombre]]
    hoja = Image.new("RGB", (180 * len(piezas), 180), BLANCO)
    for i, p in enumerate(piezas):
        hoja.paste(p, (180 * i, 0))
    return hoja.resize((hoja.width * 3, hoja.height * 3), Image.NEAREST)


def main(args):
    with urllib.request.urlopen(URL_ORIGEN) as r:
        poses = leer_poses(r.read())
    resultado = {n: componer(poses, n) for n in POSES}
    cuadros, duraciones = animar(resultado["flexionada"], resultado["extendida"])
    SALIDA.mkdir(parents=True, exist_ok=True)
    destino = SALIDA / ARCHIVO
    cuadros[0].save(destino, save_all=True, append_images=cuadros[1:], duration=duraciones,
                    loop=0, optimize=True)
    print(f"✓ {destino} ({destino.stat().st_size // 1024} kB)")
    if "--revision" in args:
        hoja = SALIDA / "prensa-maquina-revision.png"
        hoja_revision(poses, resultado).save(hoja)
        print(f"✓ {hoja}")


if __name__ == "__main__":
    main(sys.argv[1:])
