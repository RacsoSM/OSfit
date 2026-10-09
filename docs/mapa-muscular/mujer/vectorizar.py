# Paso 4: vectoriza las máscaras, añade las líneas de lineas.py y escribe el SVG.
# Uso: python3 vectorizar.py SALIDA.svg
import sys
import numpy as np, cv2
from scipy.ndimage import distance_transform_edt
import lineas as LN

S = 4
D = np.load('masks.npz'); AX = float(D['AX']); fig = D['fig'].astype(np.uint8); H, W = fig.shape
xx = np.arange(W)[None, :]; yy = np.arange(H)[:, None]
# Unidades SVG por píxel de la foto: sin contar la coleta, la figura mide 780 unidades, como la
# del hombre, así que líneas y huecos miden lo mismo en los dos. La coleta sube un poco más.
ys, xs = np.where(fig)
K = 0.7635
M = 10 / K * S
half = max(AX - xs.min(), xs.max() - AX) + M
x0 = AX - half; y0 = ys.min() - M
VW = 2 * half / S * K; VH = (ys.max() + M - y0) / S * K
HUECO = 3.0 / K * S       # separación entre músculos: 3 unidades, como las líneas
BORDE = 5.0 / K * S       # contorno blanco hacia el fondo: en esta foto mide ~7 px (más que las líneas)
BORDE_MANO = 3.5 / K * S  # en las manos el borde de la foto es más fino y suave (como en el hombre)
JUNTOS = 11.0 / K * S     # hasta esta separación en la foto, dos piezas se consideran vecinas
MANCHA = (12.0 / K * S) ** 2
SUAVIZADO = 2.5 * S         # radio del voto que suaviza los bordes entre piezas (px grandes)   # área máxima de un blanco de unión que se rellena


def P(p): return ((p[0] - x0) / S * K, (p[1] - y0) / S * K)
def F(p): return P((p[0] * S, p[1] * S))
def f(p): return f"{p[0]:.2f},{p[1]:.2f}"
def mirror(p): return (VW - p[0], p[1])


def catmull(pts, closed):
    """Curva Catmull-Rom centrípeta que pasa por todos los puntos -> path de Bézier cúbicas."""
    pts = [np.array(p, float) for p in pts]; n = len(pts)
    pts = ([2 * pts[0] - pts[1]] + pts + [2 * pts[-1] - pts[-2]]) if not closed else ([pts[-1]] + pts + [pts[0], pts[1]])
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


def area_paths(mask, sigma=1.0 * S, eps=0.3 * S, minarea=15 * S * S, espejo=False):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cs:
        if len(c) < 12 or abs(cv2.contourArea(c)) < minarea: continue
        sm = gsmooth(c[:, 0, :].astype(float), sigma)
        a = cv2.approxPolyDP(sm.astype(np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :]
        if len(a) >= 3:
            pts = [P(p) for p in a]
            out.append(catmull([mirror(p) for p in pts] if espejo else pts, True))
    return ' '.join(out)


def suave(mask, sigma):
    return (cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigma) > 0.5).astype(np.uint8)


def espejar(m):
    o = np.zeros_like(m); xs_ = np.arange(W); mx_ = np.round(2 * AX - xs_).astype(int)
    ok = (mx_ >= 0) & (mx_ < W); o[:, xs_[ok]] = m[:, mx_[ok]]; return o


izq = (xx < AX)
grupos = ['hombro', 'pecho', 'biceps', 'antebrazo', 'abdomen', 'cuadriceps', 'pantorrilla']
piezas = {}
for g in grupos:
    m = suave(D[g], 1.5 * S)
    if g == 'abdomen':
        piezas['abdomen'] = (m & (xx < AX + 2)) | espejar(m & (xx < AX + 2))
    else:
        piezas[g + '-der'] = m & izq; piezas[g + '-izq'] = espejar(m & izq)
# retoques medidos (lineas.py)
for poli in getattr(LN, 'MUSLO_PARCHES', []):
    pm = np.zeros((H, W), np.uint8); cv2.fillPoly(pm, [np.round(np.array(poli) * S).astype(np.int32)], 1)
    pm &= fig
    piezas['cuadriceps-der'] |= pm; piezas['cuadriceps-izq'] |= espejar(pm)
for n in ('cuello', 'pelo', 'coleta'):
    piezas['gris-' + n] = suave(D['gris_' + n], 1.0 * S)
for z in ('manos', 'pies'):
    m = suave(D['gris_' + z], 1.0 * S) & izq
    piezas[f'gris-{z}-der'] = m; piezas[f'gris-{z}-izq'] = espejar(m)



def muestrear(pts):
    """Puntos densos sobre la curva Catmull-Rom que pasa por pts."""
    pts = np.array(pts, float); ext = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]]); out = []
    for i in range(1, len(pts)):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for t in np.linspace(0, 1, 40, endpoint=False):
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1]); return np.array(out)


def curva_y(pts, lado):
    """y de la frontera para cada columna, y las columnas que cubre (lado izq: reflejada)."""
    c = muestrear(pts) * S
    if lado == 'izq': c = np.column_stack([2 * AX - c[:, 0], c[:, 1]])[::-1]
    yl = np.interp(np.arange(W), c[:, 0], c[:, 1])[None, :]
    return yl, (xx >= c[:, 0].min()) & (xx <= c[:, 0].max())


UNICAS = ('abdomen', 'gris-cuello')   # piezas de una sola pieza, sobre el eje


def nombre(g, lado): return g if g in UNICAS else f'{g}-{lado}'


# Las fronteras medidas son límites duros para lo trazado: nada del primero por debajo de su
# curva ni del segundo por encima (por ejemplo, el lila claro de la costura entre los pechos no
# es abdomen).
for arriba, abajo, pts in LN.FRONTERAS:
    for lado in ('der', 'izq'):
        yl, rango = curva_y(pts, lado)
        piezas[nombre(arriba, lado)] = (piezas[nombre(arriba, lado)] & ~(rango & (yy > yl))).astype(np.uint8)
        piezas[nombre(abajo, lado)] = (piezas[nombre(abajo, lado)] & ~(rango & (yy < yl))).astype(np.uint8)

CORTES = {'cuadriceps': (LN.MUSLO_FONDO, 760), 'pantorrilla': (LN.PANT_FONDO, 960)}


def corte_fondo(m, g, lado):
    """Quita lo que queda por debajo del borde de abajo medido (rodilla, tobillo)."""
    pts, hasta = CORTES[g]
    c = np.array(pts, float) * S
    if lado == 'izq': c = np.column_stack([2 * AX - c[:, 0], c[:, 1]])[::-1]
    yl = np.interp(np.arange(W), c[:, 0], c[:, 1])[None, :]
    rango = (xx >= c[:, 0].min()) & (xx <= c[:, 0].max())
    return (m & ~(rango & (yy > yl) & (yy < hasta * S))).astype(np.uint8)


for g in CORTES:
    for lado in ('der', 'izq'):
        piezas[f'{g}-{lado}'] = corte_fondo(piezas[f'{g}-{lado}'], g, lado)

# --- Separaciones uniformes ---------------------------------------------------------------
# Un píxel blanco es una separación si la suma de sus distancias a las dos piezas más cercanas
# (o a una pieza y al fondo) no pasa de JUNTOS: ahí se reparte entre ambas (junto al fondo, todo
# para la pieza). Después cada pieza se retira HUECO/2 de las demás y BORDE del fondo, así que
# todas las separaciones blancas miden lo mismo. Los blancos anchos (rodillas, entrepierna,
# cara) no cumplen la suma y conservan su borde.
nombres = list(piezas) + ['fondo']
FONDO = len(nombres) - 1
masks = [piezas[n] for n in nombres[:-1]] + [(1 - fig).astype(np.uint8)]
dist = lambda m: cv2.distanceTransform((1 - m).astype(np.uint8), cv2.DIST_L2, 5)
d1 = np.full((H, W), np.inf, np.float32); d2 = d1.copy()
i1 = np.full((H, W), -1, np.int16); i2 = i1.copy()
for i, m in enumerate(masks):
    d = dist(m)
    nuevo1 = d < d1; nuevo2 = ~nuevo1 & (d < d2)
    d2 = np.where(nuevo1, d1, np.where(nuevo2, d, d2)); i2 = np.where(nuevo1, i1, np.where(nuevo2, i, i2))
    d1 = np.where(nuevo1, d, d1); i1 = np.where(nuevo1, i, i1)
d_fondo = dist(masks[FONDO])
sep = fig.astype(bool) & (d1 > 0) & (d1 + d2 <= JUNTOS)
# Quién se queda cada píxel de separación: inundación (watershed) sobre el mapa de crestas de
# la foto, desde el interior de cada pieza. Así la frontera entre dos piezas cae justo en el
# centro de la línea blanca, no a medio camino entre dos bordes trazados con ruido. Junto al
# fondo no compite nadie: la pieza llega hasta el contorno y luego se retira BORDE.
from skimage.segmentation import watershed
cresta = cv2.GaussianBlur(np.load('ridge.npy'), (0, 0), 1.0 * S)
# en la cabeza mandan las líneas del peinado nuevo, no las de esta foto
lp = D['linea_peinado'].astype(np.float32)
cresta = np.where(cv2.dilate(D['linea_peinado'], nucleo := cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(4 * S) + 1,) * 2)) > 0,
                  cv2.GaussianBlur(lp, (0, 0), 1.0 * S), np.where(yy < 215 * S, 0, cresta)).astype(np.float32)
marcas = np.zeros((H, W), np.int32)
for i, n in enumerate(nombres[:-1]):
    marcas[cv2.erode(piezas[n], nucleo) > 0] = i + 1
zona_ws = sep | np.any([piezas[n] for n in nombres[:-1]], 0).astype(bool)
ws = watershed(cresta, marcas, mask=zona_ws)
region = {n: (ws == i + 1) for i, n in enumerate(nombres[:-1])}


# Fronteras medidas (lineas.py): en una franja de 7 px alrededor de la curva, lo de arriba es
# del primero y lo de abajo del segundo. Solo se tocan píxeles de esos dos o de separación. Se
# aplica tras la inundación y otra vez tras rellenar uniones y suavizar, que podrían saltársela.
def aplicar_fronteras(region, libres):
    for arriba, abajo, pts in LN.FRONTERAS:
        for lado in ('der', 'izq'):
            yl_, rango_ = curva_y(pts, lado)
            na, nb = nombre(arriba, lado), nombre(abajo, lado)
            libre = region[na] | region[nb] | (libres & ~np.any([r for n, r in region.items() if n not in (na, nb)], 0))
            franja = rango_ & (np.abs(yy - yl_) < 7 * S) & libre & fig.astype(bool)
            region[na] = (region[na] & ~(franja & (yy >= yl_))) | (franja & (yy < yl_))
            region[nb] = (region[nb] & ~(franja & (yy < yl_))) | (franja & (yy >= yl_))


    for g, y0c, y1c in LN.COSTURAS:
        nd, ni = f'{g}-der', f'{g}-izq'
        otros = np.any([r for n, r in region.items() if n not in (nd, ni)], 0)
        franja = (np.abs(xx - AX) < 7 * S) & (yy >= y0c * S) & (yy <= y1c * S) & fig.astype(bool) & ~otros
        region[nd] = (region[nd] & ~franja) | (franja & (xx < AX))
        region[ni] = (region[ni] & ~franja) | (franja & (xx >= AX))


aplicar_fronteras(region, sep)


def separar(region):
    todas = np.zeros((H, W), np.int16)
    for r in region.values(): todas += r
    out = {}
    for n, r in region.items():
        otras = (todas - r) > 0
        lejos = cv2.distanceTransform((~otras).astype(np.uint8), cv2.DIST_L2, 5) > HUECO / 2
        borde = BORDE_MANO if n.startswith('gris-manos') else BORDE
        out[n] = (r & lejos & (d_fondo > borde)).astype(np.uint8)
    return out


norm = separar(region)
# Donde se juntan tres piezas (axila, cadera) queda un blanco redondo más ancho que una
# separación: esas manchas pequeñas se reparten entre la pieza más cercana y se vuelve a separar.
ocupado = np.any([m for m in norm.values()], 0)
blanco = fig.astype(bool) & ~ocupado & (d_fondo > BORDE)
d_p = cv2.distanceTransform((~ocupado).astype(np.uint8), cv2.DIST_L2, 5)
ancho = blanco & (d_p > HUECO / 2 + 0.6 * S)
n_, cc_, st_, _ = cv2.connectedComponentsWithStats(ancho.astype(np.uint8), 8)
manchas = np.isin(cc_, [i for i in range(1, n_) if st_[i, 4] <= MANCHA])
manchas = cv2.dilate(manchas.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(HUECO) * 2 + 1,) * 2)) & blanco
dueño_p = np.where(i1 == FONDO, i2, i1)
for i, n in enumerate(nombres[:-1]):  # manchas de unión: a la pieza más cercana
    region[n] = region[n] | (manchas.astype(bool) & (dueño_p == i))
# Bordes suaves sin redondear las uniones: cada píxel se queda con la etiqueta que domina a su
# alrededor (voto ponderado gaussiano entre todas las piezas, el blanco ancho y el fondo). Así
# los bordes pierden el ruido del trazado pero donde se juntan tres piezas no queda una gota
# blanca, como pasaría suavizando cada pieza por separado.
etiquetas = list(region) + ['_blanco', '_fondo']
indic = dict(region); indic['_fondo'] = ~fig.astype(bool)
indic['_blanco'] = fig.astype(bool) & ~np.any([r for r in region.values()], 0)
mejor_v = np.full((H, W), -1.0, np.float32); mejor_i = np.zeros((H, W), np.int16)
for i, n in enumerate(etiquetas):
    b_ = cv2.GaussianBlur(indic[n].astype(np.float32), (0, 0), SUAVIZADO)
    m_ = b_ > mejor_v; mejor_v[m_] = b_[m_]; mejor_i[m_] = i
region = {n: (mejor_i == i) & fig.astype(bool) for i, n in enumerate(etiquetas[:-2])}
aplicar_fronteras(region, sep | manchas.astype(bool))
norm = separar(region)
for g in CORTES:
    for lado in ('der', 'izq'):
        norm[f'{g}-{lado}'] = corte_fondo(norm[f'{g}-{lado}'], g, lado)
# el tobillo empieza recto (medido): sin las orejas que deja el borde al subir por los lados
for n in norm:
    if n.startswith('gris-pies'):
        norm[n] = (norm[n] & ~((yy < LN.TOBILLO_ARRIBA * S) & (yy > 900 * S))).astype(np.uint8)
# solo las piezas grandes (fuera islas sueltas que dejan las fronteras)
n_piezas = dict(pantorrilla=2)


def mayores(m, n):
    k_, cc, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    if k_ <= 1: return m
    return np.isin(cc, 1 + np.argsort(-st[1:, 4])[:n]).astype(np.uint8)


for n in norm:
    gr = n[:-4] if n.endswith(('-der', '-izq')) else n
    if not gr.startswith('gris'): norm[n] = mayores(norm[n], n_piezas.get(gr, 1))
# simetría exacta
for n in list(norm):   # la mitad derecha nunca pasa de media costura antes del eje
    if n.endswith('-der'):
        norm[n] = (norm[n] & (xx < AX - HUECO / 2)).astype(np.uint8)
        norm[n[:-4] + '-izq'] = espejar(norm[n])
for n in UNICAS:
    norm[n] = (norm[n] & (xx < AX + 2)) | espejar(norm[n] & (xx < AX + 2))


def fourier(m, armonicos):
    """Contorno exterior de m rehecho con pocos armónicos de Fourier: una forma lisa, sin el
    temblor del trazado, que conserva el tamaño y la orientación."""
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(float)
    s = np.r_[0, np.cumsum(np.hypot(*np.diff(np.vstack([c, c[:1]]), axis=0).T))]
    t = np.linspace(0, s[-1], 512, endpoint=False)
    z = np.interp(t, s, np.r_[c[:, 0], c[0, 0]]) + 1j * np.interp(t, s, np.r_[c[:, 1], c[0, 1]])
    F = np.fft.fft(z); F[armonicos + 1:-armonicos] = 0
    z = np.fft.ifft(F)
    o = np.zeros((H, W), np.uint8)
    cv2.fillPoly(o, [np.round(np.column_stack([z.real, z.imag])).astype(np.int32)], 1)
    return o


# Pantorrilla: dos cabezas en forma de huso, separadas a lo largo de la línea PANTORRILLA. Cada
# cabeza se rehace lisa (Fourier) y entre ellas queda una separación del ancho de siempre.
c = muestrear(LN.PANTORRILLA) * S
dv = c[-1] - c[-8]; c = np.vstack([c[0] - (c[8] - c[0]) * 6, c, c[-1] + dv * 6])     # hasta salir de la pierna
xl = np.interp(np.arange(H), c[:, 1], c[:, 0])[:, None]
p = norm['pantorrilla-der']
cabezas = [(p & (xx < xl)).astype(np.uint8), (p & (xx >= xl)).astype(np.uint8)]
pant = np.any([fourier(cab, LN.PANT_ARMONICOS) for cab in cabezas if cab.sum() > 0], 0).astype(np.uint8)
eje_p = np.zeros((H, W), np.uint8)                       # separación entre cabezas: ancho fijo
cv2.polylines(eje_p, [np.round(c).astype(np.int32)], False, 1, 1)
norm['pantorrilla-der'] = (pant & (cv2.distanceTransform(1 - eje_p, cv2.DIST_L2, 5) > HUECO / 2)).astype(np.uint8)
norm['pantorrilla-izq'] = espejar(norm['pantorrilla-der'])

musculos, clips = [], []
for g in grupos:
    if g == 'abdomen':
        dd = area_paths(suave(norm['abdomen'], 0.8 * S)); di = None
    else:
        m = suave(norm[g + '-der'], 0.8 * S); dd = area_paths(m); di = area_paths(m, espejo=True)
    if di is None:
        musculos.append(f'    <path id="musculo-{g}" class="musculo" data-musculo="{g}" d="{dd}"/>'); clips.append((g, [dd]))
    else:   # der = derecha de la persona = izquierda del dibujo
        musculos.append(f'    <path id="musculo-{g}-der" class="musculo" data-musculo="{g}" d="{dd}"/>')
        musculos.append(f'    <path id="musculo-{g}-izq" class="musculo" data-musculo="{g}" d="{di}"/>')
        clips.append((g, [dd, di]))

defs, lineas = [], []
for g, ds in clips:
    if g not in LN.LINEAS and g not in LN.LINEAS_EJE: continue
    defs.append(f'    <clipPath id="recorte-{g}">' + ''.join(f'<path d="{d}"/>' for d in ds) + '</clipPath>')
    trazos = []
    for linea in LN.LINEAS.get(g, []):
        pts = [F(p) for p in linea]; trazos += [catmull(pts, False), catmull([mirror(p) for p in pts], False)]
    for linea in LN.LINEAS_EJE.get(g, []):
        trazos.append(catmull([F(p) for p in linea], False))
    lineas.append(f'    <path class="linea" clip-path="url(#recorte-{g})" d="{" ".join(trazos)}"/>')

libres = []
for nombre_l, extremo, largo in LN.TRAMOS_LIBRES:
    d_ = muestrear(getattr(LN, nombre_l)); s_ = np.r_[0, np.cumsum(np.hypot(*np.diff(d_, axis=0).T))]
    tramo = d_[s_ <= largo] if extremo == 'inicio' else d_[s_ >= s_[-1] - largo]
    pts = [F(p) for p in tramo[::4]] + [F(tramo[-1])]
    libres += [catmull(pts, False), catmull([mirror(p) for p in pts], False)]
lineas.append(f'    <path class="linea" d="{" ".join(libres)}"/>')

contorno = area_paths(suave(fig, 0.8 * S), sigma=0.5 * S, eps=0.15 * S, minarea=0)
gris_d = {}
for n in norm:
    if n.startswith('gris'):
        gr = n[:-4] if n.endswith(('-der', '-izq')) else n
        gris_d.setdefault(gr, []).append(area_paths(suave(norm[n], 0.8 * S)))
gris = ' '.join(' '.join(v_) for v_ in gris_d.values())
for gr, lineas_g in LN.LINEAS_GRIS.items():
    defs.append(f'    <clipPath id="recorte-{gr}">' + ''.join(f'<path d="{d}"/>' for d in gris_d[gr]) + '</clipPath>')
    trazos = []
    for linea in lineas_g:
        pts = [F(p) for p in linea]; trazos += [catmull(pts, False), catmull([mirror(p) for p in pts], False)]
    lineas.append(f'    <path class="linea" clip-path="url(#recorte-{gr})" d="{" ".join(trazos)}"/>')

svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<!--
  Mapa muscular, vista de frente (mujer). Calcado de docs/mapa-muscular/mujer/referencia.png
  (el peinado, de referencia-peinado.png) con los scripts de esa carpeta; no se edita a mano.
  Misma estructura que el del hombre.

  Cada músculo es un path con clase "musculo", data-musculo (grupo) y un id único:
    musculo-GRUPO-der / musculo-GRUPO-izq   (derecha/izquierda DE LA PERSONA:
                                             su derecha queda a la izquierda del dibujo)
  El abdomen es un solo bloque central: musculo-abdomen. A diferencia del hombre, no hay
  trapecio (en la referencia esa zona es gris).
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
    [data-musculo="hombro"]      {{ fill: #b8241c; }}
    [data-musculo="biceps"]      {{ fill: #b8241c; }}
    [data-musculo="antebrazo"]   {{ fill: #b8241c; }}
    [data-musculo="pecho"]       {{ fill: #5a35b0; }}
    [data-musculo="abdomen"]     {{ fill: #9a7fd6; }}
    [data-musculo="cuadriceps"]  {{ fill: #9a7fd6; }}
    [data-musculo="pantorrilla"] {{ fill: #9a7fd6; }}
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
print(len(svg), 'bytes', round(VW, 1), round(VH, 1), 'K', round(K, 4))
