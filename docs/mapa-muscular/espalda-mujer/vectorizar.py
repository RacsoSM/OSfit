# Paso 3: vectoriza las máscaras y escribe el SVG.  Uso: python3 vectorizar.py SALIDA.svg
# Mismo método que la espalda del hombre (../espalda/vectorizar.py), con la cabeza asimétrica.
import sys
import numpy as np, cv2
from scipy.ndimage import distance_transform_edt
from skimage.segmentation import watershed
import lineas as LN

S = 4
D = np.load('masks.npz'); AX = float(D['AX']); fig = D['fig'].astype(np.uint8); H, W = fig.shape
xx = np.arange(W)[None, :]; yy = np.arange(H)[:, None]
# Misma altura que la mujer de frente sin la coleta (780 unidades), así que las dos vistas se
# pueden poner juntas a la misma escala y líneas y huecos miden lo mismo.
ys, xs = np.where(fig)
K = 780.25 / ((ys.max() - ys.min()) / S)            # unidades SVG por píxel de la foto
M = 10 / K * S
half = max(AX - xs.min(), xs.max() - AX) + M
x0 = AX - half; y0 = ys.min() - M
VW = 2 * half / S * K; VH = (ys.max() + M - y0) / S * K
U = S / K                  # px grandes por unidad SVG
HUECO, BORDE = 3.0 * U, 3.0 * U            # separación entre piezas y contorno: como de frente
HUECO_MANO, BORDE_MANO = 2.2 * U, 2.6 * U   # en la mano, como la mano de frente
JUNTOS = 9.5 * S          # hasta este hueco en la foto (px), dos piezas se consideran vecinas
JUNTOS_FONDO = 6.5 * S    # y una pieza y el fondo; los márgenes blancos más anchos (piernas, cadera) se conservan
COLUMNA = 7.0 * S         # piezas a menos de esto del eje llegan hasta la columna
MANCHA = (12.0 * U) ** 2  # área máxima de un blanco de unión que se rellena
SUAVIZADO = 2.5 * S       # radio del voto que suaviza los bordes entre piezas


# Se trabajó sobre la referencia volteada (cargar.py); al escribir se vuelve a voltear, así que el
# dibujo queda como la referencia (la coleta cae del mismo lado de la persona que de frente).
def P(p): return (VW - (p[0] - x0) / S * K, (p[1] - y0) / S * K)
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


def area_paths(mask, sigma=1.0 * S, eps=0.3 * S, minarea=8 * S * S, espejo=False):
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


def suave(mask, sigma):   # fuera de la imagen cuenta como vacío (la coronilla casi toca el borde)
    return (cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigma, borderType=cv2.BORDER_CONSTANT) > 0.5).astype(np.uint8)


def espejar(m):
    o = np.zeros_like(m); xs_ = np.arange(W); mx_ = np.round(2 * AX - xs_).astype(int)
    ok = (mx_ >= 0) & (mx_ < W); o[:, xs_[ok]] = m[:, mx_[ok]]; return o


def muestrear(pts):
    """Puntos densos sobre la curva Catmull-Rom que pasa por pts."""
    pts = np.array(pts, float); ext = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]]); out = []
    for i in range(1, len(pts)):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for t in np.linspace(0, 1, 40, endpoint=False):
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1]); return np.array(out)


izq = (xx < AX)
MUSCULOS = ['trapecio', 'hombro', 'infraespinoso', 'triceps', 'antebrazo', 'dorsal',
            'gluteo', 'isquiotibiales', 'cuadriceps', 'pantorrilla']
GRISES = ['gris-cabeza', 'gris-mano', 'gris-pie']
UNICAS = ()                    # cruzan el eje y son simétricas: una sola pieza
ASIMETRICAS = ('gris-cabeza',) # la cabeza (con la coleta) va tal cual, sin reflejar
# Cada trozo separado (cada dedo, cada cabeza de la pantorrilla) es una pieza propia, para que
# también entre ellos la separación tenga el ancho de siempre: nombre 'grupo#i-lado'.
piezas = {}
for clave in D.files:
    g = clave.split('#')[0]
    if g not in MUSCULOS + GRISES: continue
    if g in UNICAS:
        m = suave(D[clave], 1.5 * S); piezas[g] = (m & (xx < AX + 2)) | espejar(m & (xx < AX + 2)); continue
    if g in ASIMETRICAS:
        piezas[g] = suave(D[clave], 1.5 * S); continue
    # cada trozo por separado, antes de suavizar (si no, dos trozos cercanos se juntarían)
    n_, cc_, st_, _ = cv2.connectedComponentsWithStats((D[clave] & izq).astype(np.uint8), 8)
    for i in range(1, n_):
        if st_[i, 4] < 15 * S * S: continue
        t = suave(cc_ == i, 1.5 * S) & izq
        nombre = f"{g}#{clave.split('#')[1] if '#' in clave else ''}{i}"
        piezas[nombre + '-der'] = t; piezas[nombre + '-izq'] = espejar(t)
grupo = lambda n: n.split('#')[0].rsplit('-', 1)[0] if '#' not in n else n.split('#')[0]
es_mano = lambda n: grupo(n) == 'gris-mano'

# --- Separaciones uniformes ---------------------------------------------------------------
# Un píxel blanco es una separación si la suma de sus distancias a las dos piezas más cercanas
# (o a una pieza y al fondo) no pasa de JUNTOS. Quién se lo queda lo decide una inundación sobre
# el mapa de crestas de la foto (la frontera cae en el centro de la línea blanca); después cada
# pieza se retira la mitad del hueco de las demás y el contorno del fondo. Los blancos anchos
# (cintura, rodillas, la T del cuello, la cuña del tríceps) no cumplen la suma y se conservan.
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
contra_fondo = (i1 == FONDO) | (i2 == FONDO)
sep = fig.astype(bool) & (d1 > 0) & (d1 + d2 <= np.where(contra_fondo, JUNTOS_FONDO, JUNTOS))
# La columna es la costura entre las dos mitades: lo blanco junto al eje es de la pieza de su lado
# (luego cada una se retira medio hueco del eje y la columna queda del ancho de siempre).
asim = np.any([piezas[n] for n in ASIMETRICAS if n in piezas], 0).astype(np.uint8) if ASIMETRICAS else np.zeros((H, W), np.uint8)
lejos_asim = cv2.distanceTransform(1 - asim, cv2.DIST_L2, 5) > COLUMNA     # la cabeza no tiene columna
sep |= fig.astype(bool) & (np.abs(xx - AX) < COLUMNA) & (d1 < COLUMNA) & (i1 != FONDO) & lejos_asim
cresta = cv2.GaussianBlur(np.load('ridge.npy'), (0, 0), 1.0 * S)
nucleo = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(3 * S) + 1,) * 2)
marcas = np.zeros((H, W), np.int32)
for i, n in enumerate(nombres[:-1]):
    nu = cv2.erode(piezas[n], nucleo)
    marcas[(nu if nu.any() else piezas[n]) > 0] = i + 1
zona_ws = sep | np.any([piezas[n] for n in nombres[:-1]], 0).astype(bool)
ws = watershed(cresta, marcas, mask=zona_ws)
region = {n: (ws == i + 1) for i, n in enumerate(nombres[:-1])}
# Junto al eje no manda la línea de la foto (allí la columna va 2 px corrida): lo blanco de cada
# lado es de la pieza más cercana de ese lado, y la columna queda centrada en el eje.
banda = sep & (np.abs(xx - AX) < COLUMNA) & (i1 != FONDO) & lejos_asim
for i, n in enumerate(nombres[:-1]):
    if n in UNICAS: continue
    lado = (xx < AX) if n.endswith('-der') else (xx >= AX)
    region[n] = (region[n] & ~(banda & ~lado)) | (banda & lado & (i1 == i))


def curva_y(pts, lado):
    c = muestrear(pts) * S
    if lado == 'izq': c = np.column_stack([2 * AX - c[:, 0], c[:, 1]])[::-1]
    return np.interp(np.arange(W), c[:, 0], c[:, 1])[None, :], (xx >= c[:, 0].min()) & (xx <= c[:, 0].max())


def aplicar_fronteras(region, libres):
    for arriba, abajo, pts in LN.FRONTERAS:
        for lado in ('der', 'izq'):
            yl_, rango_ = curva_y(pts, lado)
            na = next(n for n in region if n.startswith(arriba + '#') and n.endswith(lado))
            nb = next(n for n in region if n.startswith(abajo + '#') and n.endswith(lado))
            libre = region[na] | region[nb] | (libres & ~np.any([r for n, r in region.items() if n not in (na, nb)], 0))
            franja = rango_ & (np.abs(yy - yl_) < 7 * S) & libre & fig.astype(bool)
            region[na] = (region[na] & ~(franja & (yy >= yl_))) | (franja & (yy < yl_))
            region[nb] = (region[nb] & ~(franja & (yy < yl_))) | (franja & (yy >= yl_))


aplicar_fronteras(region, sep)


def separar(region):
    todas = np.zeros((H, W), np.int16)
    for r in region.values(): todas += r
    out = {}
    for n, r in region.items():
        otras = (todas - r) > 0
        hueco, borde = (HUECO_MANO, BORDE_MANO) if es_mano(n) else (HUECO, BORDE)
        lejos = cv2.distanceTransform((~otras).astype(np.uint8), cv2.DIST_L2, 5) > hueco / 2
        out[n] = (r & lejos & (d_fondo > borde)).astype(np.uint8)
    return out


norm = separar(region)
# Donde se juntan tres piezas queda un blanco redondo más ancho que una separación: esas manchas
# pequeñas se reparten entre la pieza más cercana y se vuelve a separar.
ocupado = np.any([m for m in norm.values()], 0)
blanco = fig.astype(bool) & ~ocupado & (d_fondo > BORDE)
d_p = cv2.distanceTransform((~ocupado).astype(np.uint8), cv2.DIST_L2, 5)
ancho = blanco & (d_p > HUECO / 2 + 0.6 * S)
n_, cc_, st_, _ = cv2.connectedComponentsWithStats(ancho.astype(np.uint8), 8)
manchas = np.isin(cc_, [i for i in range(1, n_) if st_[i, 4] <= MANCHA])
manchas = cv2.dilate(manchas.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(HUECO) * 2 + 1,) * 2)) & blanco
dueño = np.where(i1 == FONDO, i2, i1)
for i, n in enumerate(nombres[:-1]):
    region[n] = region[n] | (manchas.astype(bool) & (dueño == i))
# Bordes suaves sin redondear las uniones: voto ponderado entre todas las piezas, el blanco
# ancho y el fondo.
etiquetas = list(region) + ['_blanco', '_fondo']
indic = dict(region); indic['_fondo'] = ~fig.astype(bool)
indic['_blanco'] = fig.astype(bool) & ~np.any([r for r in region.values()], 0)
mejor_v = np.full((H, W), -1.0, np.float32); mejor_i = np.zeros((H, W), np.int16)
for i, n in enumerate(etiquetas):
    sig = 1.2 * S if n.startswith('gris-mano') else SUAVIZADO
    b_ = cv2.GaussianBlur(indic[n].astype(np.float32), (0, 0), sig, borderType=cv2.BORDER_CONSTANT)
    m_ = b_ > mejor_v; mejor_v[m_] = b_[m_]; mejor_i[m_] = i
region = {n: (mejor_i == i) & fig.astype(bool) for i, n in enumerate(etiquetas[:-2])}
aplicar_fronteras(region, sep | manchas.astype(bool))
norm = separar(region)


def mayor(m):
    k_, cc, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    return m if k_ <= 1 else (cc == 1 + np.argmax(st[1:, 4])).astype(np.uint8)


# sin astillas: fuera lo que mida menos de 2.5 unidades de ancho (la rama de fuera del tríceps
# mide unas 5, y se tiene que quedar)
abre = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2.5 * U) | 1,) * 2)
for n in norm:
    if not grupo(n).startswith('gris'):
        norm[n] = cv2.morphologyEx(norm[n], cv2.MORPH_OPEN, abre)
    norm[n] = mayor(norm[n])
# simetría exacta: la mitad derecha nunca pasa de media separación antes del eje (la columna)
for n in list(norm):
    if n.endswith('-der'):
        norm[n] = (norm[n] & (xx < AX - HUECO / 2)).astype(np.uint8)
        norm[n[:-4] + '-izq'] = espejar(norm[n])
for n in UNICAS:
    if n in norm: norm[n] = (norm[n] & (xx < AX + 2)) | espejar(norm[n] & (xx < AX + 2))


# --- Formas lisas y bordes finos ------------------------------------------------------------
def fourier(m, armonicos):
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(float)
    s = np.r_[0, np.cumsum(np.hypot(*np.diff(np.vstack([c, c[:1]]), axis=0).T))]
    t = np.linspace(0, s[-1], 512, endpoint=False)
    z = np.interp(t, s, np.r_[c[:, 0], c[0, 0]]) + 1j * np.interp(t, s, np.r_[c[:, 1], c[0, 1]])
    F_ = np.fft.fft(z); F_[armonicos + 1:-armonicos] = 0; z = np.fft.ifft(F_)
    o = np.zeros((H, W), np.uint8)
    cv2.fillPoly(o, [np.round(np.column_stack([z.real, z.imag])).astype(np.int32)], 1)
    return o


# (Lo mismo con la franja de fuera del muslo, otro huso rodeado de blanco.)

# Glúteo: forma lisa sacada del trazado (pocos armónicos de Fourier). Para que su lado de la
# columna quede recto, antes de alisar se prolonga a través del eje y después se corta en la
# costura. Sus vecinos (dorsal, isquiotibial, franja del muslo) siguen luego su borde.
for n in [n for n in norm if grupo(n) == 'gluteo' and n.endswith('-der')]:
    ext = piezas[n].copy()
    for r in np.nonzero(ext.any(1))[0]:
        xs_ = np.nonzero(ext[r])[0]
        if xs_.max() > AX - 6 * S: ext[r, xs_.max():int(AX + 6 * S)] = 1
    lisa = (fourier(ext, LN.GLUTEO_ARMONICOS) & (xx < AX - HUECO / 2) & (d_fondo > BORDE)).astype(np.uint8)
    norm[n] = lisa; norm[n[:-4] + '-izq'] = espejar(lisa)


def seguir(pieza, ref, limite=JUNTOS):
    """La pieza llega hasta HUECO de 'ref' en los tramos donde estaban a menos de 'limite' (las
    líneas finas de la foto), y nunca se le acerca más; donde el blanco es ancho no se toca."""
    dr = cv2.distanceTransform(1 - ref, cv2.DIST_L2, 5); dp = cv2.distanceTransform(1 - pieza, cv2.DIST_L2, 5)
    hueco = fig.astype(bool) & ~pieza.astype(bool) & ~ref.astype(bool) & (dp + dr <= limite)
    nueva = (pieza.astype(bool) | hueco) & (dr > HUECO) & (d_fondo > BORDE)
    return (suave(nueva, 1.5 * U) & (dr > HUECO) & (d_fondo > BORDE)).astype(np.uint8)


glu = norm[[n for n in norm if grupo(n) == 'gluteo' and n.endswith('-der')][0]]
for n in [n for n in norm if grupo(n) in ('dorsal', 'isquiotibiales', 'cuadriceps') and n.endswith('-der')]:
    norm[n] = (seguir(norm[n], glu) & (xx < AX - HUECO / 2)).astype(np.uint8)
    norm[n[:-4] + '-izq'] = espejar(norm[n])

# Cuello: bajo la cabeza la foto aclara el lila casi hasta el blanco y el trazado se queda corto;
# el trapecio sube hasta la cabeza con la separación de siempre. La cabeza no es simétrica (la
# coleta cae de un lado), así que aquí cada mitad sigue a la cabeza de su lado; abajo del cuello
# las dos mitades siguen siendo iguales.
cabeza = norm['gris-cabeza']
for n in [n for n in norm if grupo(n) == 'trapecio']:
    lado = (xx < AX - HUECO / 2) if n.endswith('-der') else (xx > AX + HUECO / 2)
    norm[n] = (seguir(norm[n], cabeza, LN.CUELLO_HUECO * S) & lado).astype(np.uint8)

# Huso blanco en lo alto de la columna (lineas.py, COLUMNA_HUSO): se recorta del trapecio
t = np.array(LN.COLUMNA_HUSO, float)
filas = np.arange(int(t[0, 0] * S), int(t[-1, 0] * S))
media = np.interp(filas / S, t[:, 0], t[:, 1])
media = np.convolve(np.pad(media, 6, mode='edge'), np.ones(13) / 13, 'valid') * S
huso = np.zeros((H, W), bool)
for y_, w_ in zip(filas, media): huso[y_, int(round(AX - w_ - HUECO / 2)):int(round(AX + w_ + HUECO / 2)) + 1] = True
for n in [n for n in norm if grupo(n) == 'trapecio']:
    norm[n] = (norm[n].astype(bool) & ~huso).astype(np.uint8)

# Bordes hacia el fondo: en esta foto el blanco entre cada pieza y el contorno mide 7-9 px (brillo
# del contorno). Cada pieza se lleva hasta BORDE del fondo rellenando solo lo que queda ENTRE ella
# y el fondo (los dos más cercanos en direcciones opuestas): el blanco de codos, rodillas y
# tobillos, que está entre dos piezas, queda como en la foto.
df_, if_ = distance_transform_edt(fig, return_indices=True)
vy2, vx2 = if_[0] - yy, if_[1] - xx
for n in [n for n in norm if n.endswith('-der') or grupo(n) == 'trapecio']:
    p = norm[n].astype(np.uint8)
    otras = np.any([m for o, m in norm.items() if o != n], 0).astype(np.uint8)
    dt, it = distance_transform_edt(1 - p, return_indices=True)
    vy1, vx1 = it[0] - yy, it[1] - xx
    cos = (vy1 * vy2 + vx1 * vx2) / np.maximum(np.hypot(vy1, vx1) * np.hypot(vy2, vx2), 1e-6)
    entre = (cos < -0.6) & (dt + df_ <= LN.MARGEN_FONDO * S) & ~p.astype(bool)
    lejos_o = cv2.distanceTransform(1 - otras, cv2.DIST_L2, 5) > HUECO
    nuevo = (p.astype(bool) | entre) & (d_fondo > BORDE) & lejos_o
    lado = (xx < AX - HUECO / 2) if n.endswith('-der') else (xx > AX + HUECO / 2)
    nuevo = suave(nuevo, (0.6 if es_mano(n) else 1.2) * U) & (d_fondo > (BORDE_MANO if es_mano(n) else BORDE)) & lejos_o & lado
    norm[n] = mayor(nuevo.astype(np.uint8))
    if grupo(n) != 'trapecio': norm[n[:-4] + '-izq'] = espejar(norm[n])
del df_, if_, vy2, vx2

# Pie y pantorrillas: formas lisas (Fourier), sin las ondas del trazado en sus bordes cortos (va
# después de llevar las piezas al contorno, que les añade esquinas)
for n in [n for n in norm if grupo(n) in ('gris-pie', 'pantorrilla') and n.endswith('-der')]:
    otras = np.any([m for o, m in norm.items() if o != n and o.endswith('-der')], 0).astype(np.uint8)
    base = norm[n]
    if grupo(n) == 'gris-pie':   # fuera las tiras finas que suben por los lados del tobillo (brillo)
        base = mayor(cv2.morphologyEx(base, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(6 * U) | 1,) * 2)))
    lisa = fourier(base, LN.PIERNA_ARMONICOS if grupo(n) == 'gris-pie' else LN.PANT_ARMONICOS) & (d_fondo > BORDE) & (cv2.distanceTransform(1 - otras, cv2.DIST_L2, 5) > HUECO)
    norm[n] = mayor(lisa.astype(np.uint8)); norm[n[:-4] + '-izq'] = espejar(norm[n])


# --- SVG -----------------------------------------------------------------------------------
por_grupo = {}
for n, m in norm.items():
    lado = None if n in UNICAS or n in ASIMETRICAS else n.rsplit('-', 1)[1]
    por_grupo.setdefault((grupo(n), lado), []).append(m)
musculos, clips = [], []
# Las piezas '-der' (mitad izquierda de la imagen volteada) quedan, al volver a voltear, a la
# derecha del dibujo: de espaldas, el lado derecho de la persona.
LADO_SVG = {'der': 'der', 'izq': 'izq'}
for g in MUSCULOS:
    for lado in ('izq', 'der'):
        if (g, lado) not in por_grupo: continue
        d = ' '.join(area_paths(suave(m, 0.8 * S)) for m in por_grupo[(g, lado)])
        musculos.append(f'    <path id="musculo-{g}-{LADO_SVG[lado]}" class="musculo" data-musculo="{g}" d="{d}"/>')
        clips.append((g, d))
gris = ' '.join(area_paths(suave(m, 0.6 * S if g == 'gris-mano' else 0.8 * S), eps=0.2 * S)
                for (g, _), ms in por_grupo.items() if g.startswith('gris') for m in ms)
defs, lineas = [], []
for g, lin in LN.LINEAS.items():
    ds = [d for gg, d in clips if gg == g]
    defs.append(f'    <clipPath id="recorte-{g}">' + ''.join(f'<path d="{d}"/>' for d in ds) + '</clipPath>')
    trazos = []
    for linea in lin:
        pts = [F(p) for p in linea]; trazos += [catmull(pts, False), catmull([mirror(p) for p in pts], False)]
    lineas.append(f'    <path class="linea" clip-path="url(#recorte-{g})" d="{" ".join(trazos)}"/>')
contorno = area_paths(suave(fig, 0.8 * S), sigma=0.5 * S, eps=0.15 * S, minarea=0)
for g, lin in LN.LINEAS_SIN_REFLEJO.items():
    m = norm[g] if g in norm else None
    if m is None: continue
    d_recorte = area_paths(suave(m, 0.8 * S), eps=0.2 * S)
    defs.append(f'    <clipPath id="recorte-{g}">' + f'<path d="{d_recorte}"/>' + '</clipPath>')
    trazos = [catmull([F(p) for p in linea], False) for linea in lin]
    lineas.append(f'    <path class="linea" clip-path="url(#recorte-{g})" d="{" ".join(trazos)}"/>')

svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<!--
  Mapa muscular, vista de espalda (mujer). Calcado de docs/mapa-muscular/espalda-mujer/referencia.png
  con los scripts de esa carpeta; no se edita a mano. Misma escala y estilo que el de frente.

  Cada músculo es un path con clase "musculo", data-musculo (grupo) y un id único:
    musculo-GRUPO-der / musculo-GRUPO-izq   (derecha/izquierda DE LA PERSONA: en esta vista
                                             de espalda su derecha queda a la DERECHA del dibujo)
  Los grupos que también salen de frente (hombro, antebrazo, cuadriceps, pantorrilla) usan el
  mismo id, así que un nivel pinta las dos vistas. Los de espalda usan los mismos ids que la
  espalda del hombre (aquí no hay lumbar: en la referencia es parte del dorsal).
  Para pintar por nivel basta con cambiar el fill desde CSS, por ejemplo:
    [data-musculo="dorsal"] {{ fill: #ff8800; }}
  Los colores de abajo son los de la referencia y solo sirven por defecto.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW:.0f} {VH:.0f}" role="img" aria-label="Mapa muscular de espalda (mujer)">
  <style>
    .fondo {{ fill: #000; }}
    .contorno {{ fill: #f7f5f5; }}
    .sin-color {{ fill: #c6c7d9; }}
    .linea {{ fill: none; stroke: #f7f5f5; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }}
    [data-musculo="trapecio"]       {{ fill: #a68ce0; }}
    [data-musculo="infraespinoso"]  {{ fill: #a68ce0; }}
    [data-musculo="dorsal"]         {{ fill: #a68ce0; }}
    [data-musculo="hombro"]         {{ fill: #b8241c; }}
    [data-musculo="triceps"]        {{ fill: #b8241c; }}
    [data-musculo="antebrazo"]      {{ fill: #b8241c; }}
    [data-musculo="gluteo"]         {{ fill: #7650d6; }}
    [data-musculo="isquiotibiales"] {{ fill: #9a7fd6; }}
    [data-musculo="cuadriceps"]     {{ fill: #9a7fd6; }}
    [data-musculo="pantorrilla"]    {{ fill: #9a7fd6; }}
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
