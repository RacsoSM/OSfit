# Paso 2: silueta, eje y máscara de cada músculo y de cada zona gris (mitad izquierda de la imagen
# volteada, que es el lado derecho de la persona). Cómo se carga la referencia: cargar.py.
#
# En esta referencia la espalda y las piernas son de un solo color lila: los músculos solo se
# distinguen por las líneas blancas. Por eso sus piezas salen de las zonas que encierran esas
# líneas (mapa de crestas, ridge.npy: corre antes ridge.py), no del color.
import numpy as np, cv2
from skimage.segmentation import watershed
from cargar import cargar, EJE
S = 4
im = cargar()
h0, w0 = im.shape[:2]
H, W = h0 * S, w0 * S
yy = np.arange(H)[:, None]; xx = np.arange(W)[None, :]
AX = EJE * S
CUELLO = 172                          # sobre esta altura la cabeza va tal cual (la coleta es asimétrica)


def k(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def piezas(m, minimo=40):
    n, cc, st, cen = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    return [((cc == i).astype(np.uint8), cen[i] / S) for i in range(1, n) if st[i, 4] >= minimo * S * S]


def simetrica(m):
    """La mitad izquierda reflejada sobre la derecha (solo bajo el cuello)."""
    o = m.copy(); xs = np.arange(W); mx = np.round(2 * AX - xs).astype(int)
    sel = (xs > AX) & (mx >= 0); cuerpo = yy >= CUELLO * S
    o[:, xs[sel]] = np.where(cuerpo, m[:, mx[sel]], m[:, xs[sel]]); return o


rgb = cv2.resize(cv2.GaussianBlur(im, (0, 0), 0.8), (W, H), interpolation=cv2.INTER_CUBIC)
R_, G_, B_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
mx_ = rgb.max(2); lum = rgb.mean(2); sat = mx_ - rgb.min(2)
# Silueta: todo lo que no es oscuro. En esta vista no hay nada negro dentro del cuerpo, y el
# hueco negro entre el brazo y la cintura queda encerrado (la mano toca la cadera): por eso no
# basta con quitar lo oscuro que toca el borde de la imagen.
fig = (mx_ >= 70).astype(np.uint8)
n, cc, st, _ = cv2.connectedComponentsWithStats(fig, 8); fig = (cc == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
n, cc, st, _ = cv2.connectedComponentsWithStats((1 - fig).astype(np.uint8), 4)   # sin agujeritos de ruido
fig = (fig | np.isin(cc, [i for i in range(1, n) if st[i, 4] < 20 * S * S])).astype(np.uint8)
fig = simetrica(cv2.morphologyEx(fig, cv2.MORPH_OPEN, k(2)))
izq = (xx < AX)
dentro = (cv2.distanceTransform(fig, cv2.DIST_L2, 5) > 1.5 * S).astype(np.uint8)
lim = lambda m, o=3: cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, k(o))

G = {}
# Rojo (deltoide, tríceps, antebrazo): cada pieza crece desde su núcleo de rojo intenso hasta el
# valle de la línea que la separa de la vecina.
croma = (R_ - np.maximum(G_, B_)).astype(np.float32)
rojo = (croma > 60) & izq & (dentro > 0)
nucleos = piezas(lim((croma > 132) & rojo, 3), 15)   # la línea deltoide/tríceps baja el rojo solo a ~120
marcas = np.zeros((H, W), np.int32)
for i, (p, _) in enumerate(nucleos): marcas[p > 0] = i + 1
cuencas = watershed(-croma, marcas, mask=lim(rojo) > 0)
for i, (_, (cx, cy)) in enumerate(nucleos):
    G.setdefault('hombro' if cy < 250 else 'triceps' if cy < 340 else 'antebrazo', []).append((cuencas == i + 1).astype(np.uint8))
# Lila (espalda, glúteo, piernas): zonas encerradas por las líneas blancas
cresta = np.load('ridge.npy')
lila = ((B_ - G_) > 40) & ((B_ - R_) > -10) & (mx_ < 245)
zonas = cv2.morphologyEx((lila & (cresta < 0.12) & izq & (dentro > 0)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
n_, cc_, st_, cen_ = cv2.connectedComponentsWithStats(zonas, 4)
for i in range(1, n_):
    if st_[i, 4] < 40 * S * S: continue      # (40: entra la astilla de fuera de la rodilla)
    cx, cy = cen_[i] / S
    if cy < 245 and cx > 140: g = 'trapecio'
    elif cy < 275: g = 'infraespinoso'
    elif cy < 380: g = 'dorsal'
    elif cy < 495: g = 'gluteo'
    elif cy < 632: g = 'cuadriceps' if cx < 126 else 'isquiotibiales'
    else: g = 'pantorrilla'
    G.setdefault(g, []).append((cc_ == i).astype(np.uint8))
# Gris (pelo, manos, pies): gris neutro dentro de la silueta, cada uno en su zona
gris = (sat < 22) & (lum > 120) & (lum < 228) & (fig > 0)
# (la mano toca la cadera, cuyo brillo de contorno también sale grisáceo: la zona de la mano acaba
# en x = 76 y de cada zona queda solo la pieza más grande)
for z, zona in dict(cabeza=yy < 190 * S, mano=(yy > 440 * S) & (xx < 76 * S), pie=yy > 815 * S).items():
    m = lim(gris & zona & ((xx < AX) if z != 'cabeza' else True), 2)
    m = max((p for p, _ in piezas(m, 30)), key=lambda p: int(p.sum()))
    G['gris-' + z] = [m]
# Las piezas que se tocan (las dos de la pantorrilla) se guardan por separado ('grupo#i'), para
# que luego quede entre ellas la separación de siempre.
SEPARADAS = ('pantorrilla',)
out = {}
for g, ms in G.items():
    if g in SEPARADAS:
        for i, m in enumerate(ms): out[f'{g}#{i}'] = m
    else:
        out[g] = np.any(ms, 0).astype(np.uint8)
for g in sorted(out): print(g, int(out[g].sum() // (S * S)))
# La mano toca la cadera en la foto: en el dibujo se separan con una franja negra de MANO_HUECO
# px, para que no parezca pegada al cuerpo. La franja va por donde la mano y el cuerpo están a la
# misma distancia, solo donde se juntan (allí donde la suma de distancias es pequeña).
MANO_HUECO = 2.0                     # px de la foto (≈ 2 unidades del SVG)
mano_ = (out['gris-mano'] | out['antebrazo']).astype(np.uint8)
cuerpo_ = np.any([out[g] for g in ('gluteo', 'cuadriceps', 'dorsal')], 0).astype(np.uint8)
dm = cv2.distanceTransform(1 - mano_, cv2.DIST_L2, 5); dc = cv2.distanceTransform(1 - cuerpo_, cv2.DIST_L2, 5)
corte = (np.abs(dm - dc) < MANO_HUECO * S) & (dm + dc < 26 * S) & (yy > 430 * S) & izq
# del lado de la mano, la silueta es solo la mano con su contorno (MANO_BORDE_FOTO px alrededor del
# gris): el brillo del contorno de la cadera que quedaba de ese lado pasa a fondo
MANO_BORDE_FOTO = 4.0
lado_mano = (dm < dc) & (yy > 440 * S) & izq & (dm > MANO_BORDE_FOTO * S) & (dm + dc < 26 * S)
fig = (fig & ~corte & ~lado_mano).astype(np.uint8)
zona_m = (yy > 440 * S) & (dm < dc + MANO_HUECO * S) & izq      # el contorno de la mano, liso
fig = np.where(zona_m, cv2.GaussianBlur(fig.astype(np.float32), (0, 0), 1.2 * S) > 0.5, fig).astype(np.uint8)
n, cc, st, _ = cv2.connectedComponentsWithStats(fig, 8); fig = (cc == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
fig = simetrica(fig)
np.savez_compressed('masks.npz', AX=AX, fig=fig, **out)
