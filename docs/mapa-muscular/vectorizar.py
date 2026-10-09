# Paso 4: vectoriza las máscaras, añade las líneas y formas de lineas.py y escribe el SVG.
# Uso: python3 vectorizar.py SALIDA.svg
import sys, re
import numpy as np, cv2
from PIL import Image
import lineas as LN

S = 4
D = np.load('masks2.npz'); AX = float(D['AX']); fig = D['fig']; H, W = fig.shape
ys, xs = np.where(fig); M = 10 * S
half = max(AX - xs.min(), xs.max() - AX) + M
x0 = AX - half; y0 = ys.min() - M
VW = 2 * half / S; VH = (ys.max() + M - y0) / S
xx = np.arange(W)[None, :]


def P(p):          # píxel grande -> coordenada SVG
    return ((p[0] - x0) / S, (p[1] - y0) / S)


def F(p):          # píxel de la foto -> coordenada SVG
    return P((p[0] * S, p[1] * S))


def f(p):
    return f"{p[0]:.2f},{p[1]:.2f}"


def mirror(p):     # reflejo en coordenadas SVG
    return (VW - p[0], p[1])


def catmull(pts, closed):
    """Curva Catmull-Rom centrípeta que pasa por todos los puntos -> path de Bézier cúbicas."""
    pts = [np.array(p, float) for p in pts]
    n = len(pts)
    if not closed:
        pts = [2 * pts[0] - pts[1]] + pts + [2 * pts[-1] - pts[-2]]
    else:
        pts = [pts[-1]] + pts + [pts[0], pts[1]]
    d = "M" + f(pts[1])
    for i in range(1, n if not closed else n + 1):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        d1, d2, d3 = (max(np.linalg.norm(b - a) ** 0.5, 1e-6) for a, b in ((p0, p1), (p1, p2), (p2, p3)))
        b1 = (d1 * d1 * p2 - d2 * d2 * p0 + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1) / (3 * d1 * (d1 + d2))
        b2 = (d3 * d3 * p1 - d2 * d2 * p3 + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2) / (3 * d3 * (d3 + d2))
        d += f" C{f(b1)} {f(b2)} {f(p2)}"
    return d + (" Z" if closed else "")


def gsmooth(c, sigma):
    r = int(3 * sigma); t = np.arange(-r, r + 1); g = np.exp(-t ** 2 / (2 * sigma ** 2)); g /= g.sum()
    pad = np.concatenate([c[-r:], c, c[:r]])
    return np.stack([np.convolve(pad[:, i], g, 'valid') for i in (0, 1)], 1)


def area_paths(mask, sigma=1.6 * S, eps=0.3 * S, minarea=15 * S * S, espejo=False):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cs:
        if len(c) < 12 or abs(cv2.contourArea(c)) < minarea:
            continue
        sm = gsmooth(c[:, 0, :].astype(float), sigma)
        a = cv2.approxPolyDP(sm.astype(np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :]
        if len(a) >= 3:
            pts = [P(p) for p in a]
            out.append(catmull([mirror(p) for p in pts] if espejo else pts, True))
    return ' '.join(out)


def mayores(mask, n):
    """Solo las n piezas más grandes (quita restos sueltos)."""
    k, cc, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    orden = 1 + np.argsort(-st[1:, 4])[:n]
    return np.isin(cc, orden).astype(np.uint8)


def suave(mask, sigma):
    """Suaviza el borde de una máscara sin encogerla."""
    return (cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigma) > 0.5).astype(np.uint8)


piezas = dict(pantorrilla=2)
grupos = ['trapecio', 'hombro', 'pecho', 'biceps', 'antebrazo', 'abdomen', 'cuadriceps', 'pantorrilla']

# --- Separaciones uniformes ---------------------------------------------------------------
# Donde dos piezas son vecinas (a menos de RMAX), el borde se pone en la línea media entre
# ambas y cada una se retira HUECO/2: así todas las separaciones blancas miden lo mismo que
# las líneas. Donde no hay vecina, la pieza conserva su borde.
HUECO, RMAX = 3.0 * S, 6.0 * S
def espejar(m):
    o = np.zeros_like(m); xs_ = np.arange(W); mx_ = np.round(2 * AX - xs_).astype(int)
    ok = (mx_ >= 0) & (mx_ < W); o[:, xs_[ok]] = m[:, mx_[ok]]; return o


piezas_m = {}
def rasterizar(pts_foto):
    """Forma dibujada a mano (curva cerrada por puntos de la foto) -> máscara."""
    pts = np.array(pts_foto, float) * S
    n = len(pts); dens = []
    for i in range(n):   # muestrear la Catmull-Rom cerrada
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        for t in np.linspace(0, 1, 12, endpoint=False):
            t2, t3 = t * t, t * t * t
            dens.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.round(np.array(dens)).astype(np.int32)], 1)
    return m


for g in grupos:
    if g == 'abdomen':
        piezas_m['abdomen'] = suave(mayores(D['abdomen'], 1), 2.5 * S)
        continue
    if g == 'trapecio':
        izq = rasterizar(LN.TRAPECIO)
    else:
        izq = suave(mayores((D[g] & (xx < AX)).astype(np.uint8), piezas.get(g, 1)), 1.5 * S) & (xx < AX)
    if g == 'cuadriceps':
        for poli in LN.MUSLO_PARCHES:
            cv2.fillPoly(izq, [np.round(np.array(poli) * S).astype(np.int32)], 1)
    piezas_m[g + '-der'] = izq
    piezas_m[g + '-izq'] = espejar(izq)
# Fronteras medidas: en una franja de 6 px alrededor de cada curva, reparto por lado.
def muestrear(pts_foto, n=400):
    pts = np.array(pts_foto, float); m = len(pts)
    ext = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]]); out = []
    for i in range(1, m):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for t in np.linspace(0, 1, 40, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1]); return np.array(out)



yy = np.arange(H)[:, None]
fronteras = [(a, b, p, False) for a, b, p in LN.FRONTERAS] + [(a, b, p, True) for a, b, p in LN.FRONTERAS_V]
for arriba, abajo, pts, vertical in fronteras:
    c = muestrear(pts) * S
    if vertical:   # x en función de y: lo de la izquierda es del primero
        xl = np.interp(np.arange(H), c[:, 1], c[:, 0])[:, None]
        rango = (yy >= c[:, 1].min()) & (yy <= c[:, 1].max())
        franja = rango & (np.abs(xx - xl) < 6 * S) & fig.astype(bool)
        lado1, lado2 = (xx < xl), (xx >= xl)
    else:          # y en función de x: lo de arriba es del primero
        yl = np.interp(np.arange(W), c[:, 0], c[:, 1])[None, :]
        rango = (xx >= c[:, 0].min()) & (xx <= c[:, 0].max())
        franja = rango & (np.abs(yy - yl) < 6 * S) & fig.astype(bool)
        lado1, lado2 = (yy < yl), (yy >= yl)
    otros = np.zeros((H, W), bool)
    for n, m in piezas_m.items():
        if n.rsplit('-', 1)[0] not in (arriba, abajo) and n not in (arriba, abajo):
            otros |= m.astype(bool)
    franja &= ~otros
    sobre = (franja & lado1).astype(np.uint8); bajo = (franja & lado2).astype(np.uint8)
    for nombre, mas, menos in ((arriba, sobre, bajo), (abajo, bajo, sobre)):
        if nombre == 'abdomen':
            piezas_m['abdomen'] = ((piezas_m['abdomen'] | mas | espejar(mas)) & ~(menos | espejar(menos))).astype(np.uint8)
        else:
            izq = ((piezas_m[nombre + '-der'] | mas) & ~menos).astype(np.uint8)
            piezas_m[nombre + '-der'] = izq; piezas_m[nombre + '-izq'] = espejar(izq)

gris_sin_manos = (D['gris'] & (1 - D['mano'])).astype(np.uint8)
piezas_m['gris'] = gris_sin_manos
nombres = list(piezas_m)
dist = np.stack([cv2.distanceTransform((1 - piezas_m[n]).astype(np.uint8), cv2.DIST_L2, 5) for n in nombres])
grupo_de = [n.rsplit('-', 1)[0] if n.endswith(('-der', '-izq')) else n for n in nombres]
cerca = np.zeros((H, W), np.int32)   # cuántos músculos DISTINTOS hay cerca (der e izq cuentan como uno)
for gr in dict.fromkeys(grupo_de):
    cerca += np.any([dist[i] <= RMAX for i, x in enumerate(grupo_de) if x == gr], axis=0)
# Solo es frontera compartida lo que queda ENTRE dos músculos: las direcciones hacia el punto
# más cercano de cada uno tienen que ser casi opuestas (más de 120°). Así no crecen hacia un
# hueco que solo tienen al lado (por ejemplo, bajo la punta del abdomen, en la entrepierna).
from scipy.ndimage import distance_transform_edt
py_, px_ = np.nonzero(cerca >= 2)
cerc = np.zeros((len(nombres), len(py_), 2), np.float32); dcand = np.zeros((len(nombres), len(py_)), np.float32)
for i, n in enumerate(nombres):
    d_, ind = distance_transform_edt(1 - piezas_m[n], return_indices=True)
    dcand[i] = d_[py_, px_]; cerc[i, :, 0] = ind[0][py_, px_] - py_; cerc[i, :, 1] = ind[1][py_, px_] - px_
    del d_, ind
orden = np.argsort(dcand, 0)
g_arr = np.array(grupo_de)
primero = orden[0]; segundo = np.full(len(py_), -1)
for k in range(1, len(nombres)):   # el más cercano de OTRO grupo
    c_ = orden[k]; libre = (segundo < 0) & (g_arr[c_] != g_arr[primero])
    segundo[libre] = c_[libre]
idx_ = np.arange(len(py_))
v1 = cerc[primero, idx_]; v2 = cerc[segundo, idx_]
cosang = (v1 * v2).sum(1) / np.maximum(np.linalg.norm(v1, axis=1) * np.linalg.norm(v2, axis=1), 1e-6)
entre = np.zeros((H, W), bool); entre[py_, px_] = cosang < -0.5
cerca = np.where(entre, cerca, np.minimum(cerca, 1))
y0e, y1e, ae = LN.ENTREPIERNA
ingle = (np.arange(H)[:, None] > y0e * S) & (np.arange(H)[:, None] < y1e * S) & (np.abs(xx - AX) < ae * S)
cerca = np.where(ingle, np.minimum(cerca, 1), cerca)

mejor = dist.argmin(0); dmin = dist.min(0)
dentro = cv2.distanceTransform(fig.astype(np.uint8), cv2.DIST_L2, 5) > 1.5 * S
asignado = (dmin <= RMAX) & ((cerca >= 2) | (dmin <= HUECO / 2 + 0.5 * S)) & dentro
norm = {}
for i, n in enumerate(nombres):
    reg = (asignado & (mejor == i)).astype(np.uint8)
    norm[n] = (cv2.distanceTransform(reg, cv2.DIST_L2, 5) > HUECO / 2).astype(np.uint8)

# Borde interno del muslo en la entrepierna: curva de Hermite desde el borde que trae (con su
# pendiente) hasta la vertical medida, sin escalones.
y0b, y1b, y2b, xr = LN.ENTREPIERNA_BORDE
q = norm['cuadriceps-der']
borde = lambda y: np.nonzero(q[int(y * S), :int(AX)])[0].max() / S
xa, pend = borde(y0b), (borde(y0b) - borde(y0b - 4)) / 4
for yp in range(int(y0b * S), int(y2b * S)):
    t = min((yp / S - y0b) / (y1b - y0b), 1.0)
    xl = ((1 - 3 * t * t + 2 * t ** 3) * xa + (t - 2 * t * t + t ** 3) * (y1b - y0b) * pend
          + (3 * t * t - 2 * t ** 3) * xr)
    fila = q[yp]; fila[int(round(xl * S)):int(AX)] = 0          # nada más allá de la curva
    fila[int(round((xl - 8) * S)):int(round(xl * S))] = 1        # y relleno hasta ella

# Punta del abdomen: donde termina la frontera medida queda un hombro; se ajusta una curva
# suave (cúbica) al borde de antes y de después, y se usa en ese tramo (simétrico).
ab = norm['abdomen']
filas = [y for y in range(404 * S, 439 * S, S) if not (420 * S <= y <= 426 * S) and ab[y, :int(AX)].any()]
bx_ = [np.nonzero(ab[y, :int(AX)])[0].min() for y in filas]
coef = np.polyfit(np.array(filas, float), np.array(bx_, float), 3)
for yp in range(414 * S, 439 * S):
    if not ab[yp].any():
        continue
    xl = int(round(np.polyval(coef, yp)))
    ab[yp, :xl] = 0; ab[yp, xl:int(AX)] = 1
    xr = int(round(2 * AX - xl)); ab[yp, xr:] = 0; ab[yp, int(AX):xr] = 1

# Sobre la punta de la sección central, a la izquierda de B no hay músculo (es contorno).
b = np.array(LN.MUSLO_B) * S; xb = np.interp(np.arange(H), b[:, 1], b[:, 0])[:, None]
norm['cuadriceps-der'] &= ~((np.arange(H)[:, None] < LN.MUSLO_TOPE * S) & (xx < xb + 0.5 * S))

musculos, clips = [], []
for g in grupos:
    if g == 'abdomen':
        dd = area_paths(suave(norm['abdomen'], 1.0 * S), sigma=1.0 * S); di = None
    else:
        m = suave(norm[g + '-der'], 1.0 * S)
        dd = area_paths(m, sigma=1.0 * S); di = area_paths(m, sigma=1.0 * S, espejo=True)
    if di is None:
        musculos.append(f'    <path id="musculo-{g}" class="musculo" data-musculo="{g}" d="{dd}"/>')
        clips.append((g, [dd]))
    else:   # der = derecha de la persona = izquierda del dibujo
        musculos.append(f'    <path id="musculo-{g}-der" class="musculo" data-musculo="{g}" d="{dd}"/>')
        musculos.append(f'    <path id="musculo-{g}-izq" class="musculo" data-musculo="{g}" d="{di}"/>')
        clips.append((g, [dd, di]))

# Líneas internas: cada grupo recortado con la forma de su músculo
defs, lineas = [], []
for g, ds in clips:
    if g not in LN.LINEAS and g not in LN.LINEAS_EJE:
        continue
    defs.append(f'    <clipPath id="recorte-{g}">' + ''.join(f'<path d="{d}"/>' for d in ds) + '</clipPath>')
    trazos = []
    for linea in LN.LINEAS.get(g, []):
        pts = [F(p) for p in linea]
        trazos.append(catmull(pts, False)); trazos.append(catmull([mirror(p) for p in pts], False))
    for linea in LN.LINEAS_EJE.get(g, []):
        trazos.append(catmull([F(p) for p in linea], False))
    lineas.append(f'    <path class="linea" clip-path="url(#recorte-{g})" d="{" ".join(trazos)}"/>')

libres = []
for linea in LN.LINEAS_LIBRES:
    pts = [F(p) for p in linea]
    libres += [catmull(pts, False), catmull([mirror(p) for p in pts], False)]
lineas.append(f'    <path class="linea" d="{" ".join(libres)}"/>')

# Mano: silueta calcada de referencia-mano.png (ver lineas.py)
zona = ((xx < 76 * S) & (np.arange(H)[:, None] > 379 * S)).astype(np.uint8)
mr = np.array(Image.open('referencia-mano.png').convert('RGB')).astype(int)
lum_m = mr.mean(2); sat_m = mr.max(2) - mr.min(2)
claro = (((lum_m > 150) & (sat_m < 70)) | ((mr[..., 0] > 120) & (mr[..., 1] > 80) & (mr[..., 2] < 100))).astype(np.uint8)
# las rayitas oscuras entre las franjas del antebrazo tocan el borde superior: se cierran antes
# de separar fondo y mano, para que no cuenten como fondo
cerrado = cv2.morphologyEx(claro, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
n_, cc_ = cv2.connectedComponents((1 - cerrado).astype(np.uint8), connectivity=4)
borde_ = set(cc_[0]) | set(cc_[-1]) | set(cc_[:, 0]) | set(cc_[:, -1])
fondo_m = np.isin(cc_, list(borde_)) & (cerrado == 0)
s_, a_, tx_, ty_ = LN.MANO_TRANSF
M_ = np.array([[s_ * np.cos(a_), -s_ * np.sin(a_), tx_], [s_ * np.sin(a_), s_ * np.cos(a_), ty_]], np.float32) * S
calcar = lambda m: (cv2.warpAffine(m.astype(np.float32), M_, (W, H), flags=cv2.INTER_LINEAR) > 0.5).astype(np.uint8)
mano_c = calcar(~fondo_m) & zona
mano_i = mayores(calcar(~fondo_m & (claro == 0)) & zona, 1)
# Grosores uniformes: el gris empieza siempre a MANO_CONTORNO del borde; las líneas de dentro
# (lineas.py, MANO_LINEAS) se dibujan encima como trazos de grosor MANO_LINEA, y cada extremo
# que queda cerca del contorno se alarga hasta tocarlo, para que conecten.
mano_c = (suave(mano_c, 0.6 * S) & zona).astype(np.uint8)
d_out = cv2.distanceTransform(mano_c, cv2.DIST_L2, 5)
trazos_mano = []
for linea in LN.MANO_LINEAS:
    c = np.array(linea, float) * S
    for lado in (0, 1):
        cc2 = c if lado == 1 else c[::-1]
        dv = cc2[-1] - cc2[-2]; dv /= np.hypot(*dv)
        q = cc2[-1].copy()
        for _ in range(int(5 * S)):
            q = q + dv
            if d_out[int(round(q[1])), int(round(q[0]))] <= LN.MANO_CONTORNO * S / 2:
                cc2 = np.vstack([cc2, q]); c = cc2 if lado == 1 else cc2[::-1]
                break
    pts = [P(p) for p in c]
    trazos_mano += [catmull(pts, False), catmull([mirror(p) for p in pts], False)]
# Cuñas blancas entre dedos: lo blanco de la referencia que queda dentro del contorno y toca
# alguna de las líneas (así no se cuelan restos del contorno, que no tocan ninguna).
trazo_m = np.zeros((H, W), np.uint8)
for linea in LN.MANO_LINEAS:
    cv2.polylines(trazo_m, [np.round(np.array(linea) * S).astype(np.int32)], False, 1, int(LN.MANO_LINEA * S))
blanco_int = (mano_c & (1 - mano_i) & (d_out > (LN.MANO_CONTORNO + 0.3) * S)).astype(np.uint8)
n_, cc_ = cv2.connectedComponents(blanco_int, connectivity=8)
tocan = np.unique(cc_[(trazo_m > 0) & (blanco_int > 0)]); tocan = tocan[tocan > 0]
cunas = suave(np.isin(cc_, tocan).astype(np.uint8), 0.5 * S)
cunas = cv2.dilate(cunas, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
mano_i = ((d_out > LN.MANO_CONTORNO * S) & (cunas == 0)).astype(np.uint8)
# fuera las astillas de gris de menos de 1.5 px que quedan entre cuña y contorno
mano_i = cv2.morphologyEx(mano_i, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
mano_i = (mayores(mano_i, 1) & zona).astype(np.uint8)
lineas.append(f'    <path class="linea-mano" d="{" ".join(trazos_mano)}"/>')
mano_c = ((mano_c | espejar(mano_c)) & (zona | espejar(zona))).astype(np.uint8)
mano_i = (mano_i | espejar(mano_i)).astype(np.uint8)
fig = ((fig & ~(zona | espejar(zona))) | mano_c).astype(np.uint8)
antebrazo = (norm['antebrazo-der'] | norm['antebrazo-izq']).astype(np.uint8)
lejos = cv2.distanceTransform((1 - antebrazo).astype(np.uint8), cv2.DIST_L2, 5) > HUECO
mano_g = (mano_i & lejos).astype(np.uint8)

contorno = area_paths(fig, sigma=0.5 * S, eps=0.15 * S, minarea=0)
gris = (f"{area_paths(suave(norm['gris'], 1.5 * S), sigma=1.5 * S)} "
        f"{area_paths(mano_g, sigma=1.0 * S, eps=0.15 * S)}")

svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<!--
  Mapa muscular, vista de frente (hombre). Calcado de docs/mapa-muscular/referencia.png
  (libre de uso) con los scripts de docs/mapa-muscular/; no se edita a mano.

  Cada músculo es un path con clase "musculo", data-musculo (grupo) y un id único:
    musculo-GRUPO-der / musculo-GRUPO-izq   (derecha/izquierda DE LA PERSONA:
                                             su derecha queda a la izquierda del dibujo)
  El abdomen es un solo bloque central: musculo-abdomen.
  Para pintar por nivel basta con cambiar el fill desde CSS, por ejemplo:
    [data-musculo="pecho"] {{ fill: #ff8800; }}
  Las líneas blancas van aparte, recortadas con la forma de su músculo, y no cambian.
  Los colores de abajo son los de la referencia y solo sirven por defecto.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW:.0f} {VH:.0f}" role="img" aria-label="Mapa muscular de frente">
  <style>
    .fondo {{ fill: #000; }}
    .contorno {{ fill: #f7f5f5; }}
    .sin-color {{ fill: #c6c7d9; }}
    .linea {{ fill: none; stroke: #f7f5f5; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }}
    .linea-mano {{ fill: none; stroke: #f7f5f5; stroke-width: {LN.MANO_LINEA}; stroke-linecap: round; stroke-linejoin: round; }}
    [data-musculo="trapecio"]    {{ fill: #64a2f5; }}
    [data-musculo="hombro"]      {{ fill: #13c652; }}
    [data-musculo="pecho"]       {{ fill: #d10a10; }}
    [data-musculo="biceps"]      {{ fill: #64a2f5; }}
    [data-musculo="antebrazo"]   {{ fill: #a58af5; }}
    [data-musculo="abdomen"]     {{ fill: #ecd066; }}
    [data-musculo="cuadriceps"]  {{ fill: #2550cf; }}
    [data-musculo="pantorrilla"] {{ fill: #d10a10; }}
  </style>
  <defs>
{chr(10).join(defs)}
  </defs>
  <rect class="fondo" width="{VW:.0f}" height="{VH:.0f}"/>
  <path id="contorno" class="contorno" d="{contorno}"/>
  <path id="sin-color" class="sin-color" d="{gris}"/>
  <g id="musculos">
{chr(10).join(musculos)}
  </g>
  <g id="lineas">
{chr(10).join(lineas)}
  </g>
</svg>
'''
open(sys.argv[1], 'w').write(svg)
print(len(svg), 'bytes', VW, VH)
