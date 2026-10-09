# Paso 1: clasifica cada píxel de la referencia en un color de la paleta.
from PIL import Image
import numpy as np, cv2
S = 4
im = np.array(Image.open('referencia.png').convert('RGB'))
big = cv2.bilateralFilter(cv2.resize(im, (im.shape[1] * S, im.shape[0] * S), interpolation=cv2.INTER_CUBIC), 9, 40, 9)
# (nombre, punto de muestra en la foto)
PALETA = [('negro', (5, 5)), ('blanco', (150, 740)), ('gris', (200, 50)), ('rojo', (115, 265)),
          ('morado', (165, 290)), ('morado', (170, 330)), ('lila', (170, 380)), ('lila', (140, 850))]
cols = np.array([np.median(im[y - 1:y + 2, x - 1:x + 2].reshape(-1, 3), 0) for _, (x, y) in PALETA], np.uint8)
lab_p = cv2.cvtColor(cols[None], cv2.COLOR_RGB2LAB)[0].astype(float)
lab = cv2.cvtColor(big, cv2.COLOR_RGB2LAB).astype(float)
cerca = ((lab[:, :, None, :] - lab_p[None, None]) ** 2).sum(-1).argmin(-1)
nombres = list(dict.fromkeys(n for n, _ in PALETA))
L = np.array([nombres.index(PALETA[i][0]) for i in range(len(PALETA))], np.uint8)[cerca]
np.save('labels.npy', L); open('names.txt', 'w').write('\n'.join(nombres))
