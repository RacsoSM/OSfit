# Paso 2: silueta, eje y máscara de cada músculo (mitad izquierda del dibujo) y de las partes
# grises (pelo, manos, tobillos, pies).
from PIL import Image
import numpy as np, cv2
S = 4
L = np.load('labels.npy'); nombres = open('names.txt').read().split('\n'); idx = {n: i for i, n in enumerate(nombres)}
H, W = L.shape; yy = np.arange(H)[:, None]; xx = np.arange(W)[None, :]
AX = 198.0 * S                       # eje de simetría (las dos mitades coinciden en un 98.7 %)
CUELLO = 205                         # sobre esta altura la cabeza va tal cual (la coleta es asimétrica)


def k(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def rellenar(m):
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    o = np.zeros(m.shape, np.uint8); cv2.drawContours(o, cs, -1, 1, -1); return o


def piezas(m, minimo=40):
    n, cc, st, cen = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    return [((cc == i).astype(np.uint8), cen[i] / S) for i in range(1, n) if st[i, 4] >= minimo * S * S]


def simetrica(m):
    """La mitad izquierda reflejada sobre la derecha (solo bajo el cuello)."""
    o = m.copy(); xs = np.arange(W); mx = np.round(2 * AX - xs).astype(int)
    sel = (xs > AX) & (mx >= 0); cuerpo = yy >= CUELLO * S
    o[:, xs[sel]] = np.where(cuerpo, m[:, mx[sel]], m[:, xs[sel]]); return o


im = np.array(Image.open('referencia.png').convert('RGB')).astype(np.float32)
lum = cv2.resize(cv2.GaussianBlur(im.mean(2), (0, 0), 0.7), (W, H), interpolation=cv2.INTER_CUBIC)
# Silueta: el borde está donde la luminosidad cruza la mitad entre el negro y el contorno
fig = (lum > 120).astype(np.uint8)
n, cc, st, _ = cv2.connectedComponentsWithStats(fig, 8); fig = (cc == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
fig = simetrica(rellenar(cv2.morphologyEx(fig, cv2.MORPH_OPEN, k(2))))
izq = (xx < AX)
d_out = cv2.distanceTransform(fig, cv2.DIST_L2, 5)
dentro = (d_out > 1.5 * S).astype(np.uint8)
lab = lambda n: ((L == idx[n]) & dentro).astype(np.uint8)
lim = lambda m, o=3: cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, k(o))
# Cada color se corta a mitad de su transición hacia el blanco (ahí está el borde de verdad;
# la etiqueta más cercana deja fuera la franja rosada o lila del antialias).
rgb = cv2.resize(cv2.GaussianBlur(im, (0, 0), 1.2), (W, H), interpolation=cv2.INTER_CUBIC)
R_, G_, B_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
rojo = ((R_ - np.maximum(G_, B_) > 65) & dentro).astype(np.uint8)
azul = B_ - G_
nucleo = cv2.dilate(lab('morado'), k(3 * S))
morado = ((azul > 64) & (nucleo > 0) & dentro).astype(np.uint8)
lejos = lambda m: cv2.distanceTransform((1 - m).astype(np.uint8), cv2.DIST_L2, 5) > 1.5 * S
lila = ((azul > np.where(yy > 760 * S, 40, 50)) & (morado == 0)   # la pantorrilla es más pálida en las puntas
         & lejos(morado) & lejos(rojo) & dentro).astype(np.uint8)
# Las tres piezas rojas se tocan donde la línea rosa entre ellas es tenue: cada una crece desde
# su núcleo (rojo intenso) hasta el valle de esa línea (cuenca de agua, watershed).
from skimage.segmentation import watershed
croma = (R_ - np.maximum(G_, B_)).astype(np.float32)
nucleos = [(p, c) for p, c in piezas(lim((croma > 110) & izq & (dentro > 0), 4), 30)]
marcas = np.zeros((H, W), np.int32)
for i, (p, _) in enumerate(nucleos): marcas[p > 0] = i + 1
cuencas = watershed(-croma, marcas, mask=(rojo & izq) > 0)
G = {}
for i, (p, (cx, cy)) in enumerate(nucleos):
    G.setdefault('hombro' if cy < 295 else 'biceps' if cy < 400 else 'antebrazo', []).append((cuencas == i + 1).astype(np.uint8))
G['pecho'] = [max((p for p, _ in piezas(lim(morado & izq))), key=lambda p: int(p.sum()))]
for m, (cx, cy) in piezas(lim(lila & izq, 4), 30):
    if cy < 470 or (cy < 560 and cx > 165):
        G.setdefault('abdomen', []).append(m)
    elif cy < 730:
        G.setdefault('cuadriceps', []).append(m)
    else:
        G.setdefault('pantorrilla', []).append(m)
# El abdomen y el muslo tienen líneas dentro que los parten en trozos: se cierran (las líneas
# se dibujan después). De la pantorrilla quedan las dos piezas más grandes (sus dos cabezas;
# abajo se juntan y las separa una línea de lineas.py).
cierre = dict(abdomen=12, cuadriceps=22)
G['pantorrilla'] = sorted(G['pantorrilla'], key=lambda m: -int(m.sum()))[:2]
out = {}
for g, ms in G.items():
    m = np.any(ms, 0).astype(np.uint8)
    if g in cierre:
        if g == 'abdomen':   # llega al eje: se cierra junto con su reflejo
            ref = m.copy(); xs = np.arange(W); mx = np.round(2 * AX - xs).astype(int); s_ = (xs > AX) & (mx >= 0)
            ref[:, xs[s_]] = m[:, mx[s_]]; m = ref
        m = rellenar(cv2.morphologyEx(m, cv2.MORPH_CLOSE, k(cierre[g])))
        if g != 'abdomen': m = m & izq
    out[g] = m.astype(np.uint8)
# Partes grises: dentro de la silueta, gris neutro (el contorno es lavanda y la cara blanca),
# cada una en su zona. Se tapan los brillos pequeños, no la cara.
sat = rgb.max(2) - rgb.min(2)


def tapar(m, maximo):
    inv = (1 - m).astype(np.uint8); n, cc, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    o = m.copy()
    for i in range(1, n):
        if st[i, 4] <= maximo * S * S: o[cc == i] = 1
    return o


zonas = dict(cabeza=(yy < 252 * S, 16, 150), manos=((yy > 515 * S) & (np.abs(xx - AX) > 125 * S), 16, 30),
             pies=(yy > 949 * S, 24, 30))
for z, (zona, smax, hueco) in zonas.items():
    m = (fig & zona & (lum < 236) & (sat < smax)).astype(np.uint8)
    m = tapar(cv2.morphologyEx(m, cv2.MORPH_OPEN, k(2)), hueco)
    m = (np.any([p for p, _ in piezas(m, 60)], 0) & zona).astype(np.uint8)
    out['gris_' + z] = m if z == 'cabeza' else simetrica(m & izq)
# Cuello: todo gris entre la barbilla y el pecho (la foto aclara el centro; las líneas de la V
# se dibujan aparte). La cara es el hueco blanco más grande de la cabeza y no se toca.
musculos_ = cv2.dilate(np.any([m for g, m in out.items() if not g.startswith('gris')], 0).astype(np.uint8), k(2 * S))
cab = out['gris_cabeza']
huecos = (fig & (1 - cab) & (yy < 252 * S)).astype(np.uint8)
n_, cc_, st_, _ = cv2.connectedComponentsWithStats(huecos, 4)
cara = (cc_ == 1 + np.argmax(st_[1:, 4])).astype(np.uint8)
cuello = fig & (yy >= 200 * S) & (yy < 262 * S) & (np.abs(xx - AX) < 48 * S) & (1 - musculos_) & (1 - cv2.dilate(cara, k(3 * S)))
out['gris_cabeza'] = (cab | cuello).astype(np.uint8)
# --- Peinado: de referencia-peinado.png (coleta alta) ----------------------------------------
# Esa imagen es un dibujo de líneas blancas. Las zonas oscuras que encierran son la cara, el pelo
# (entre el contorno de la cabeza y la línea del nacimiento del pelo) y la coleta (del lazo de
# arriba hasta la punta). PEINADO_TRANSF la pone encima de la cara de esta foto (escala y
# desplazamiento, ajustados maximizando el solape de las dos caras); el cuello y el resto del
# cuerpo siguen siendo de esta foto.
PEINADO_TRANSF = (0.9452, -0.571, 16.4263)
CORTE_CUELLO = 200                   # sobre esta altura, la cabeza es la del peinado nuevo
r2 = np.array(Image.open('referencia-peinado.png').convert('RGB')).astype(np.float32)
linea2 = (r2.mean(2) > 110).astype(np.uint8)
n2, cc2 = cv2.connectedComponents((1 - linea2).astype(np.uint8), connectivity=4)
zona2 = lambda x, y: (cc2 == cc2[y, x]).astype(np.uint8)       # zona oscura que contiene (x, y)
cara2, pelo2, coleta2 = zona2(210, 140), zona2(165, 70), zona2(283, 100)
# silueta del peinado: todo lo que no es fondo (relleno desde las esquinas), por encima de la
# barbilla; así entran también las puntas de la coleta, que son solo línea
fondo2 = (1 - linea2).copy(); msk2 = np.zeros((fondo2.shape[0] + 2, fondo2.shape[1] + 2), np.uint8)
for esquina in [(0, 0), (fondo2.shape[1] - 1, 0)]:
    cv2.floodFill(fondo2, msk2, esquina, 2)
cabeza2 = ((fondo2 != 2) & (np.arange(fondo2.shape[0])[:, None] < 199)).astype(np.uint8)
s2, tx2, ty2 = PEINADO_TRANSF
M2 = np.float32([[s2 * S, 0, tx2 * S], [0, s2 * S, ty2 * S]])
calcar = lambda m: (cv2.warpAffine(m.astype(np.float32), M2, (W, H), flags=cv2.INTER_LINEAR) > 0.5).astype(np.uint8)
cabeza = calcar(cabeza2) & (yy < 215 * S)
fig = (((fig > 0) & (yy >= CORTE_CUELLO * S)) | (cabeza > 0)).astype(np.uint8)
union = cv2.morphologyEx(fig, cv2.MORPH_CLOSE, k(3 * S))           # sin rendijas en la unión
fig = np.where((yy > (CORTE_CUELLO - 8) * S) & (yy < (CORTE_CUELLO + 8) * S) & (np.abs(xx - AX) < 40 * S), union, fig).astype(np.uint8)
out['gris_pelo'] = calcar(pelo2)
out['gris_coleta'] = calcar(coleta2)
# el cuello empieza justo debajo de la línea de la barbilla del peinado nuevo
cuello = (out.pop('gris_cabeza') & (yy >= CORTE_CUELLO * S) & (1 - calcar(cabeza2)) & izq).astype(np.uint8)
xs_ = np.arange(W); mx_ = np.round(2 * AX - xs_).astype(int); s_ = (xs_ > AX) & (mx_ >= 0)
cuello[:, xs_[s_]] = cuello[:, mx_[s_]]            # simétrico, como el resto del cuerpo
out['gris_cuello'] = cuello
# líneas del peinado, para que las separaciones caigan en su centro (como el mapa de crestas)
out['linea_peinado'] = (calcar(linea2) & (yy < 215 * S)).astype(np.uint8)
np.savez_compressed('masks.npz', AX=AX, fig=fig, **out)
