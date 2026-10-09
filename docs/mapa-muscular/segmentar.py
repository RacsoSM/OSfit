# Paso 1: clasifica cada píxel de la referencia en un color de la paleta.
from PIL import Image; import numpy as np, cv2, sys
SRC='referencia.png'
im=np.array(Image.open(SRC).convert('RGB'))
S=4  # sobremuestreo
big=cv2.resize(im,(im.shape[1]*S,im.shape[0]*S),interpolation=cv2.INTER_CUBIC)
big=cv2.bilateralFilter(big,9,40,9)
pts=dict(negro=(5,5),blanco=(130,590),gris=(200,70),trapecio=(155,165),hombro=(105,220),
         rojo=(160,215),biceps=(100,270),antebrazo=(70,340),abdomen=(175,330),cuadriceps=(130,480),rojo2=(115,650))
pal={k:np.median(im[y-1:y+2,x-1:x+2].reshape(-1,3),0) for k,(x,y) in pts.items()}
for k,v in pal.items(): print(k,v)
names=[k for k in pal if k!='rojo2']; P=np.array([pal[k] for k in names],float)
lab_P=cv2.cvtColor(P.astype(np.uint8)[None],cv2.COLOR_RGB2LAB)[0].astype(float)
lab=cv2.cvtColor(big,cv2.COLOR_RGB2LAB).astype(float)
d=((lab[:,:,None,:]-lab_P[None,None])**2).sum(-1)
L=d.argmin(-1).astype(np.uint8)
np.save('labels.npy',L); open('names.txt','w').write('\n'.join(names))
