# Carga la referencia tal como la usan los demás pasos.
import numpy as np
from PIL import Image

EJE = 175.5            # eje de simetría del cuerpo (en la imagen volteada)


def cargar():
    """Referencia volteada en horizontal. Solo es para medir: todas las medidas de lineas.py y
    mascaras.py están en esta imagen volteada, y vectorizar.py vuelve a voltear el dibujo al
    escribirlo, así que el SVG queda como la referencia. El texto que asoma en el borde y la barra
    gris de abajo quedan fuera de la silueta y no se usan."""
    return np.array(Image.open('referencia.png').convert('RGB'))[:, ::-1].astype(np.float32)
