# Paso 3: máscaras limpias y simétricas de cada músculo y de sus líneas internas.
from PIL import Image
import numpy as np, cv2
from skimage.morphology import skeletonize
S=4
L=np.load('labels.npy'); names=open('names.txt').read().split('\n'); idx={n:i for i,n in enumerate(names)}
H,W=L.shape; yy=np.arange(H)[:,None]; xx=np.arange(W)[None,:]
def k(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*r+1,2*r+1))
def fill_holes(m):
    cs,_=cv2.findContours(m.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    o=np.zeros(m.shape,np.uint8); cv2.drawContours(o,cs,-1,1,-1); return o
def comps(m,minarea=60*S*S):
    n,cc,st,cen=cv2.connectedComponentsWithStats(m.astype(np.uint8),8)
    return [((cc==i).astype(np.uint8),cen[i]) for i in range(1,n) if st[i,4]>=minarea]
fig=(L!=idx['negro']).astype(np.uint8)
n,cc,st,_=cv2.connectedComponentsWithStats(fig,8); fig=(cc==1+np.argmax(st[1:,4])).astype(np.uint8)
fig=fill_holes(cv2.morphologyEx(fig,cv2.MORPH_OPEN,k(2)))
AX=200.5*S
def sym(m):
    o=m.copy(); xs=np.arange(W); right=xs>AX; mx=np.round(2*AX-xs).astype(int)
    sel=right&(mx>=0); o[:,xs[sel]]=m[:,mx[sel]]; return o
left=(xx<=AX)
_im=cv2.resize(np.array(Image.open('referencia.png').convert('RGB')),(W,H),interpolation=cv2.INTER_CUBIC).astype(float)
lum=cv2.GaussianBlur(_im.mean(2),(0,0),2)
manoB=((xx<70*S)&(yy>374*S)&left)
from skimage.filters import sato as _sato
val=_sato(lum/255,sigmas=[2,3,4],black_ridges=True); val/=np.percentile(val[manoB],99.5)
surco=(val>0.35)&manoB&(yy>420*S)&(lum<200)
fig=np.where(manoB,fig&(lum>150)&~surco,fig).astype(np.uint8)
fig=fill_holes(cv2.morphologyEx(fig,cv2.MORPH_OPEN,k(3)))
figS=sym(fig); fig=cv2.erode(figS,k(9))
manoZ=sym(((xx<70*S)&(yy>374*S)&left).astype(np.uint8))
fig=np.where(manoZ>0,cv2.erode(figS,k(3)),fig).astype(np.uint8)
lab=lambda n:(L==idx[n]).astype(np.uint8)
colored=(1-lab('negro'))&(1-lab('blanco'))&(1-lab('gris'))
def clean(m,o=3): m=cv2.morphologyEx(m.astype(np.uint8),cv2.MORPH_OPEN,k(o)); return m
R={}   # (grupo, parte) -> máscara rellena (mitad izquierda del dibujo)
# brazo: todo lo coloreado fuera del torso, entre hombro y muñeca; el codo lo separa la línea blanca
arm=clean(colored&(xx<126*S)&(yy>226*S)&(yy<392*S)&(1-lab('hombro')),3)
for m,c in comps(arm):
    R.setdefault('biceps' if c[1]<292*S else 'antebrazo',[]).append(m)
R['hombro']=[m for m,_ in comps(clean(lab('hombro')&left))]
red=clean(lab('rojo')&left)
R['pecho']=[m for m,c in comps(red) if c[1]<300*S]
R['pantorrilla']=[m for m,c in comps(red) if c[1]>=300*S]
bimg=cv2.resize(np.array(Image.open('referencia.png').convert('RGB')),(W,H),interpolation=cv2.INTER_CUBIC).astype(int)
azul=((bimg[:,:,2]-bimg[:,:,0])>25)&(bimg[:,:,2]>150)
R['trapecio']=[max(comps(clean(azul.astype(np.uint8)&left&(yy<186*S)&(yy>140*S)&(xx>128*S)&fig,2),20*S*S),key=lambda t:t[0].sum())[0]]
R['abdomen']=[clean(lab('abdomen')&left)]
R['cuadriceps']=[clean(lab('cuadriceps')&left)]
from PIL import Image
im=np.array(Image.open('referencia.png').convert('RGB'))
big=cv2.resize(im,(W,H),interpolation=cv2.INTER_CUBIC).astype(float)
mx_=big.max(2); mn_=big.min(2); sat=(mx_-mn_)/np.maximum(mx_,1)
blancura=cv2.GaussianBlur((1-sat)*(mx_/255),(0,0),2)
ridge=np.load('ridge.npy'); ridge=ridge/np.percentile(ridge,99.5)
umbral=dict(trapecio=9,hombro=9,abdomen=0.15,cuadriceps=0.3,antebrazo=0.35,biceps=0.5,pecho=0.25,pantorrilla=9)
gris=sym(np.any([c for c,_ in comps(clean(lab('gris')&left,2),150*S*S)],0).astype(np.uint8)&fig)
# manos: todo gris dentro de la silueta (la foto tiene brillos blancos)
mano=(xx<66*S)&(yy>378*S)&left
manoM=cv2.erode(fig,k(5))&mano.astype(np.uint8)
gris=cv2.dilate(gris,k(3))&cv2.erode(fig,k(5))
out_mano=sym(manoM)
gris=gris|out_mano
out={}
for g,ms in R.items():
    m=np.any(ms,0).astype(np.uint8)&fig
    close=dict(pecho=3,pantorrilla=5,abdomen=16,cuadriceps=20,antebrazo=16,biceps=6,trapecio=6,hombro=4).get(g,0)
    if close:
        filled=fill_holes(cv2.morphologyEx(m,cv2.MORPH_CLOSE,k(close)))
        if g in('abdomen',):  # el abdomen llega al eje: cerrar también con su reflejo
            sm=sym(m); filled=fill_holes(cv2.morphologyEx(sm,cv2.MORPH_CLOSE,k(close)))&left
        lines=cv2.erode(filled,k(5))&(ridge>umbral[g]).astype(np.uint8)
        if g in ('pecho','abdomen'): lines[:, int(AX)-4*S:]=0   # la costura central se pone aparte
        filled=cv2.morphologyEx(filled,cv2.MORPH_OPEN,k(2))
    else:
        filled=m; lines=np.zeros_like(m)
    out[g]=sym(filled&left.astype(np.uint8)); out[g+'_lineas']=sym((lines&filled&left).astype(np.uint8))
# costura central del abdomen (línea alba): en la foto va de y=248 a y=338
lp=out['pecho_lineas']; ys_=np.where(out['pecho'][:,int(AX)-6])[0]; lp[ys_.min()+2*S:ys_.max()-2*S, int(AX)-2:int(AX)+3]=1
la=out['abdomen_lineas']; la[250*S:338*S, int(AX)-2:int(AX)+3]=1

figL=(cv2.GaussianBlur(fig.astype(np.float32),(0,0),2.0*S)>0.5).astype(np.uint8)
fig=np.where(manoZ>0,fig,figL).astype(np.uint8)
out['gris']=gris; out['fig']=fig; out['mano']=out_mano
np.savez('masks2.npz',AX=AX,**out)
for g in R: print(g,len(R[g]))
