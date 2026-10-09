# Carga la referencia tal como la usan los demás pasos.
import numpy as np, cv2
from PIL import Image

EJE = 270.5            # eje de simetría del cuerpo (en la imagen volteada)
CABEZA_DESVIO = 2.4    # la cabeza y el cuello están dibujados 2.4 px a la izquierda del eje


def cargar():
    """Referencia volteada en horizontal (su mano izquierda sale cortada por el borde; la derecha
    está entera y el método trabaja con la mitad izquierda y la refleja) y con la cabeza y el
    cuello corridos CABEZA_DESVIO px para que queden centrados en el eje del cuerpo (el
    corrimiento baja suave hasta cero entre el cuello y los hombros)."""
    im = np.array(Image.open('referencia.png').convert('RGB'))[:, ::-1].astype(np.float32)
    h, w = im.shape[:2]
    out = im.copy()
    for y in range(140):
        d = CABEZA_DESVIO * float(np.clip((135 - y) / 40, 0, 1))
        if d > 0:
            out[y] = cv2.warpAffine(im[y:y + 1], np.float32([[1, 0, d], [0, 1, 0]]), (w, 1),
                                    flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)[0]
    out[0] = out[0] * 0 + np.median(im[2:6, :20].reshape(-1, 3), 0)   # fila de arriba: fondo
    return out
