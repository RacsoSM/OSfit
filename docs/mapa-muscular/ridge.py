# Paso 2: mapa de crestas (líneas blancas finas) con el filtro de Sato.
import numpy as np, cv2
from PIL import Image
from skimage.filters import sato
im=np.array(Image.open('referencia.png').convert('RGB')).astype(float)
S=4; H,W=im.shape[0]*S,im.shape[1]*S
big=cv2.resize(im,(W,H),interpolation=cv2.INTER_CUBIC)
mx=big.max(2); mn=big.min(2); sat=(mx-mn)/np.maximum(mx,1)
r=sato((1-sat)*(mx/255),sigmas=[3,4,6],black_ridges=False)
np.save('ridge.npy',r.astype(np.float32))
