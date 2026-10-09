# Paso 4: vectoriza las máscaras y escribe el SVG.  Uso: python3 vectorizar.py SALIDA.svg
import numpy as np, cv2, sys
from skimage.morphology import skeletonize
S=4; D=np.load('masks2.npz'); AX=float(D['AX']); fig=D['fig']; H,W=fig.shape
ys,xs=np.where(fig); M=10*S
half=max(AX-xs.min(),xs.max()-AX)+M; x0=AX-half; y0=ys.min()-M
VW=2*half/S; VH=(ys.max()+M-y0)/S
def P(p): return ((p[0]-x0)/S,(p[1]-y0)/S)
def f(p): return f"{p[0]:.1f},{p[1]:.1f}"
def gsmooth(c,sigma,closed):
    r=int(3*sigma); t=np.arange(-r,r+1); g=np.exp(-t**2/(2*sigma**2)); g/=g.sum()
    if closed: pad=np.concatenate([c[-r:],c,c[:r]])
    else: pad=np.concatenate([np.repeat(c[:1],r,0),c,np.repeat(c[-1:],r,0)])
    return np.stack([np.convolve(pad[:,i],g,'valid') for i in (0,1)],1)
def bez(a,closed):
    n=len(a); d="M"+f(a[0])
    rng=range(n) if closed else range(n-1)
    for i in rng:
        p0=a[i-1] if (closed or i>0) else a[0]; p1=a[i]; p2=a[(i+1)%n]
        p3=a[(i+2)%n] if (closed or i+2<n) else a[-1]
        c1=(p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6); c2=(p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6)
        d+=f" C{f(c1)} {f(c2)} {f(p2)}"
    return d+(" Z" if closed else "")
def area_paths(mask,sigma=1.6*S,eps=0.3*S,minarea=15*S*S):
    cs,_=cv2.findContours(mask.astype(np.uint8),cv2.RETR_CCOMP,cv2.CHAIN_APPROX_NONE); out=[]
    for c in cs:
        if len(c)<12 or abs(cv2.contourArea(c))<minarea: continue
        sm=gsmooth(c[:,0,:].astype(float),sigma,True)
        a=cv2.approxPolyDP(sm.astype(np.float32).reshape(-1,1,2),eps,True)[:,0,:]
        if len(a)>=3: out.append(bez([P(p) for p in a],True))
    return ' '.join(out)
def skel_paths(mask,region=None,minlen=6*S):
    sk=skeletonize(mask>0).astype(np.uint8); H_,W_=sk.shape
    nb=[(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
    pts=set(zip(*np.where(sk)))
    def neigh(p): return [(p[0]+a,p[1]+b) for a,b in nb if (p[0]+a,p[1]+b) in pts]
    deg={p:len(neigh(p)) for p in pts}
    nodes={p for p in pts if deg[p]!=2}
    seen=set(); paths=[]
    def walk(a,b):
        path=[a,b]; prev,cur=a,b
        while cur not in nodes:
            nx=[q for q in neigh(cur) if q!=prev and (min(cur,q),max(cur,q)) not in seen]
            if not nx: break
            seen.add((min(cur,nx[0]),max(cur,nx[0]))); prev,cur=cur,nx[0]; path.append(cur)
        return path
    for nd in nodes:
        for q in neigh(nd):
            e=(min(nd,q),max(nd,q))
            if e in seen: continue
            seen.add(e); paths.append(walk(nd,q))
    out=[]
    for p in paths:
        if len(p)<minlen: continue
        c=np.array([(x,y) for y,x in p],float)
        if region is not None and len(c)>8:
            for end in (0,1):
                cc=c if end==1 else c[::-1]
                d_=cc[-1]-cc[-8]; d_/=max(np.hypot(*d_),1e-6); q=cc[-1].copy(); ext=[]
                for _ in range(10*S):
                    q=q+d_; xi,yi=int(round(q[0])),int(round(q[1]))
                    if not(0<=yi<H and 0<=xi<W) or not region[yi,xi]: break
                    if _>2*S and sk[yi,xi]: ext.append(q.copy()); break
                    ext.append(q.copy())
                if ext and (len(ext)<10*S):
                    cc=np.vstack([cc,ext]); c=cc if end==1 else cc[::-1]
        sm=gsmooth(c,1.5*S,False)
        a=cv2.approxPolyDP(sm.astype(np.float32).reshape(-1,1,2),0.3*S,False)[:,0,:]
        out.append(bez([P(q) for q in a],False))
    return ' '.join(out)
xx=np.arange(W)[None,:]
def split(mask):
    l=(mask&(xx<AX)).astype(np.uint8); r=(mask&(xx>=AX)).astype(np.uint8); return l,r
import re
def mirror_d(d): return re.sub(r"(-?\d+\.\d),(-?\d+\.\d)",lambda m_:f"{VW-float(m_.group(1)):.1f},{m_.group(2)}",d)
order=['trapecio','hombro','pecho','biceps','antebrazo','abdomen','cuadriceps','pantorrilla']
el=[]; lines=[]
for g in order:
    m=D[g]
    if g=='abdomen':
        el.append(f'    <path id="musculo-abdomen" class="musculo" data-musculo="abdomen" d="{area_paths(m)}"/>')
    else:
        l,r=split(m); d_der=area_paths(l)   # der = derecha de la persona (izquierda del dibujo)
        for lado,dd in (('der',d_der),('izq',mirror_d(d_der))):
            el.append(f'    <path id="musculo-{g}-{lado}" class="musculo" data-musculo="{g}" d="{dd}"/>')
    if g+'_lineas' in D and D[g+'_lineas'].any():
        lm=D[g+'_lineas']
        if g=='abdomen': lines.append(skel_paths(lm,m))
        else:
            # trazar la mitad izquierda y reflejar, para que las líneas sean idénticas
            l,_=split(lm); d=skel_paths(l,m)
            lines.append(d)
            lines.append(mirror_d(d))
svg=f'''<?xml version="1.0" encoding="UTF-8"?>
<!--
  Mapa muscular, vista de frente (hombre). Calcado de la imagen de referencia (libre de uso,
  ver docs/backlog-2.md, punto 4): colores clasificados, contornos y líneas vectorizados, y la
  mitad izquierda reflejada para que sea simétrico.

  Cada músculo es un path con clase "musculo", data-musculo (grupo) y un id único:
    musculo-GRUPO-der / musculo-GRUPO-izq   (derecha/izquierda DE LA PERSONA:
                                             su derecha queda a la izquierda del dibujo)
  El abdomen es un solo bloque central: musculo-abdomen.
  Para pintar por nivel basta con cambiar el fill desde CSS, por ejemplo:
    [data-musculo="pecho"] {{ fill: #ff8800; }}
  Los colores de abajo son los de la referencia y solo sirven por defecto.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW:.0f} {VH:.0f}" role="img" aria-label="Mapa muscular de frente">
  <style>
    .fondo {{ fill: #000; }}
    .contorno {{ fill: #f7f5f5; }}
    .sin-color {{ fill: #c6c7d9; }}
    .linea {{ fill: none; stroke: #f7f5f5; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }}
    .linea-mano {{ fill: none; stroke: #f7f5f5; stroke-width: 1.6; stroke-linecap: round; }}
    [data-musculo="trapecio"]    {{ fill: #64a2f5; }}
    [data-musculo="hombro"]      {{ fill: #13c652; }}
    [data-musculo="pecho"]       {{ fill: #d10a10; }}
    [data-musculo="biceps"]      {{ fill: #64a2f5; }}
    [data-musculo="antebrazo"]   {{ fill: #a58af5; }}
    [data-musculo="abdomen"]     {{ fill: #ecd066; }}
    [data-musculo="cuadriceps"]  {{ fill: #2550cf; }}
    [data-musculo="pantorrilla"] {{ fill: #d10a10; }}
  </style>
  <rect class="fondo" width="{VW:.0f}" height="{VH:.0f}"/>
  <path id="contorno" class="contorno" d="{area_paths(fig,sigma=1.0*S,eps=0.25*S,minarea=0)}"/>
  <path id="sin-color" class="sin-color" d="{area_paths(D['gris']&(1-D['mano']),sigma=2.2*S,eps=0.3*S)} {area_paths(D['mano'],sigma=1.0*S,eps=0.25*S)}"/>
  <g id="musculos">
{chr(10).join(el)}
  </g>
  <g id="lineas">
    <path class="linea" d="{' '.join(lines)}"/>
  </g>
</svg>
'''
open(sys.argv[1],'w').write(svg); print(len(svg),'bytes',VW,VH)
