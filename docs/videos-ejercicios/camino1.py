"""
Videos HD de los ejercicios del banco, "camino 1".

Por cada ejercicio de `functions/semilla/ejercicios.json`:
  1. baja su GIF del dataset (el mismo commit fijado que usa la carga del banco);
  2. toma sus 2 poses (los cuadros que duran 1 s: inicio y final del movimiento);
  3. las escala x4 con Real-ESRGAN (180 px -> 720 px);
  4. arma un MP4 en bucle con un fundido entre las dos poses, como el GIF original pero nítido.

Deja en `salida/`: `<id>.mp4` (lo que se sube) y `<id>-poses.png` (para revisar a ojo).
Ver `docs/videos-ejercicios/camino1.md` para instalar, revisar y subir.

Uso, desde `docs/videos-ejercicios/`:
  venv/bin/python camino1.py press-banca sentadilla     # solo esos
  venv/bin/python camino1.py --todos                    # todo el banco
"""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageSequence
from spandrel import ModelLoader

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
SEMILLA = RAIZ / "functions" / "semilla" / "ejercicios.json"
SALIDA = AQUI / "salida"
TRABAJO = AQUI / "trabajo"
MODELO = AQUI / "modelos" / "RealESRGAN_x4plus.pth"
URL_MODELO = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"

# GEMELO de DATASET en functions/scripts/bancoEjercicios.mjs: mismo repo y mismo commit.
DATASET = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae41b330c265e7cd4b78dfa848e7ce5ebd/"

# El video: 720 px, 30 cuadros/s. Cada pose quieta 1 s y un fundido de 0.6 s entre ellas:
# 1.0 (A) + 0.6 (A->B) + 1.0 (B) + 0.6 (B->A) = 3.2 s, y el último cuadro empata con el primero.
LADO = 720
QUIETO = 1.0
FUNDIDO = 0.6
CALIDAD = 23  # CRF de H.264: 23 deja cada video en ~110-150 kB sin artefactos visibles


def poses_del_gif(gif: Path) -> tuple[Image.Image, Image.Image] | None:
    """Las 2 poses (cuadros de 1 s), o None si el GIF no sigue el patrón de 2 poses."""
    cuadros = [(c.info.get("duration", 0), c.convert("RGB").copy()) for c in ImageSequence.Iterator(Image.open(gif))]
    poses = [img for dur, img in cuadros if dur >= 500]
    if len(cuadros) != 12 or len(poses) != 2:
        return None
    return poses[0], poses[1]


def escalar(modelo, img: Image.Image) -> Image.Image:
    x = torch.from_numpy(np.asarray(img, dtype=np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0)
    with torch.no_grad():
        y = modelo(x).clamp(0, 1)[0].permute(1, 2, 0).numpy()
    return Image.fromarray((y * 255).round().astype(np.uint8))


def armar_video(a: Path, b: Path, mp4: Path) -> None:
    filtro = (
        f"[0][1]xfade=transition=fade:duration={FUNDIDO}:offset={QUIETO}[ab];"
        f"[ab][2]xfade=transition=fade:duration={FUNDIDO}:offset={2 * QUIETO + FUNDIDO},"
        f"scale={LADO}:{LADO}:flags=lanczos,fps=30,format=yuv420p"
    )
    subprocess.run([
        "ffmpeg", "-nostdin", "-v", "error", "-y",
        "-loop", "1", "-t", str(QUIETO + FUNDIDO), "-i", str(a),
        "-loop", "1", "-t", str(2 * QUIETO + FUNDIDO), "-i", str(b),
        "-loop", "1", "-t", str(FUNDIDO), "-i", str(a),
        "-filter_complex", filtro,
        "-c:v", "libx264", "-preset", "slow", "-crf", str(CALIDAD),
        "-movflags", "+faststart", "-an", str(mp4),
    ], check=True)


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    semilla = json.loads(SEMILLA.read_text(encoding="utf-8"))
    ids = [e["id"] for e in semilla] if args == ["--todos"] else args
    por_id = {e["id"]: e for e in semilla}
    desconocidos = [i for i in ids if i not in por_id]
    if desconocidos:
        sys.exit(f"No están en la semilla: {', '.join(desconocidos)}")

    if not MODELO.exists():
        MODELO.parent.mkdir(parents=True, exist_ok=True)
        print("Bajando el modelo Real-ESRGAN (64 MB)…")
        urllib.request.urlretrieve(URL_MODELO, MODELO)
    modelo = ModelLoader().load_from_file(str(MODELO)).eval()
    torch.set_num_threads(max(1, torch.get_num_threads()))

    indice = json.loads(urllib.request.urlopen(DATASET + "data/exercises.json").read())
    gif_por_origen = {x["id"]: x["gif_url"] for x in indice}

    SALIDA.mkdir(exist_ok=True)
    TRABAJO.mkdir(exist_ok=True)
    hechos, saltados = 0, []
    for i in ids:
        t0 = time.time()
        gif = TRABAJO / f"{i}.gif"
        urllib.request.urlretrieve(DATASET + gif_por_origen[por_id[i]["gifOrigen"]], gif)
        poses = poses_del_gif(gif)
        if poses is None:
            saltados.append(i)
            print(f"– {i}: su GIF no es de 2 poses, se salta (se queda con su GIF)")
            continue
        a, b = (escalar(modelo, p) for p in poses)
        pa, pb = TRABAJO / f"{i}-a.png", TRABAJO / f"{i}-b.png"
        a.save(pa)
        b.save(pb)
        mp4 = SALIDA / f"{i}.mp4"
        armar_video(pa, pb, mp4)
        # Hoja para revisar: las 2 poses lado a lado.
        hoja = Image.new("RGB", (2 * LADO, LADO), "white")
        hoja.paste(a.resize((LADO, LADO)), (0, 0))
        hoja.paste(b.resize((LADO, LADO)), (LADO, 0))
        hoja.resize((LADO, LADO // 2)).save(SALIDA / f"{i}-poses.png")
        hechos += 1
        print(f"✓ {i} ({mp4.stat().st_size // 1024} kB, {time.time() - t0:.0f} s)")

    print(f"\n{hechos} videos en {SALIDA}" + (f"; saltados: {', '.join(saltados)}" if saltados else ""))


if __name__ == "__main__":
    main()
