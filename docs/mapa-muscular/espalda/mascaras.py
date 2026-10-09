# Paso 1: silueta, eje y máscara de cada músculo y de cada zona sin color (mitad izquierda de la
# imagen volteada, que es el lado derecho de la persona). Cómo se carga la referencia: cargar.py.
import numpy as np, cv2
S = 4
from cargar import cargar, EJE
im = cargar()
h0, w0 = im.shape[:2]
H, W = h0 * S, w0 * S
yy = np.arange(H)[:, None]; xx = np.arange(W)[None, :]
AX = EJE * S                         # eje de simetría (en la imagen volteada)
LN_TRICEPS_UMBRAL = 9                # verde mínimo de las puntas del tríceps (el de siempre es 22)


def k(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def piezas(m, minimo=40):
    n, cc, st, cen = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    return [((cc == i).astype(np.uint8), cen[i] / S) for i in range(1, n) if st[i, 4] >= minimo * S * S]


def simetrica(m):
    o = m.copy(); xs = np.arange(W); mx = np.round(2 * AX - xs).astype(int)
    sel = (xs > AX) & (mx >= 0); o[:, xs[sel]] = m[:, mx[sel]]; return o


rgb = cv2.resize(cv2.GaussianBlur(im, (0, 0), 0.8), (W, H), interpolation=cv2.INTER_CUBIC)
R_, G_, B_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
mx_ = rgb.max(2); mn_ = rgb.min(2); lum = rgb.mean(2); sat = mx_ - mn_
# Silueta: todo lo que no es fondo. El fondo es lo oscuro conectado al borde de la imagen; lo
# oscuro encerrado por las líneas blancas (cabeza, manos, piernas, trapecio, lumbar) es cuerpo.
oscuro = (mx_ < 90).astype(np.uint8)
n, cc = cv2.connectedComponents(oscuro, connectivity=4)
borde = set(cc[0]) | set(cc[-1]) | set(cc[:, 0]) | set(cc[:, -1])
fondo = np.isin(cc, list(borde)) & (oscuro > 0)
fig = (~fondo).astype(np.uint8)
n, cc, st, _ = cv2.connectedComponentsWithStats(fig, 8); fig = (cc == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
fig = cv2.morphologyEx(fig, cv2.MORPH_OPEN, k(2))
# la coronilla casi toca el borde de arriba de la imagen: se redondea
fig = np.where(yy < 14 * S, (cv2.GaussianBlur(fig.astype(np.float32), (0, 0), 3.0 * S, borderType=cv2.BORDER_CONSTANT) > 0.5), fig).astype(np.uint8)
fig = simetrica(fig)
# la entrepierna está algo corrida del eje en la foto; al reflejarla su punta sale con dos lóbulos:
# se redondea en una sola
entre = (yy > 440 * S) & (yy < 500 * S) & (np.abs(xx - AX) < 18 * S)
fig = np.where(entre, cv2.GaussianBlur(fig.astype(np.float32), (0, 0), 2.5 * S) > 0.5, fig).astype(np.uint8)
izq = (xx < AX)
dentro = (cv2.distanceTransform(fig, cv2.DIST_L2, 5) > 1.5 * S).astype(np.uint8)
lim = lambda m, o=3: cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, k(o))

# Colores: cada uno se corta a mitad de su transición hacia el blanco
rojo = (R_ - np.maximum(G_, B_) > 60)
verde = (G_ - np.maximum(R_, B_) > 22) & (lum < 200)
azul = (B_ - np.maximum(R_, G_) > 70)
celeste = (np.minimum(G_, B_) - R_ > 45) & ~azul & ~verde
antebrazo = (sat > 9) & (lum < 243) & (lum > 120) & ~rojo & ~verde & ~azul & ~celeste
negro = (mx_ < 90)

# Piezas del mismo color que se tocan donde la línea blanca entre ellas es tenue (deltoide e
# infraespinoso, las dos cabezas de la pantorrilla): cada una crece desde su núcleo de color
# intenso hasta el valle de esa línea (cuenca de agua, watershed).
from skimage.segmentation import watershed


def partir(mascara, croma, umbral, minimo):
    nucleos = piezas(lim((croma > umbral) & mascara, 3), minimo)
    marcas = np.zeros((H, W), np.int32)
    for i, (p, _) in enumerate(nucleos): marcas[p > 0] = i + 1
    cuencas = watershed(-croma, marcas, mask=mascara > 0)
    return [((cuencas == i + 1).astype(np.uint8), c) for i, (_, c) in enumerate(nucleos)]


G = {}
c_rojo = (R_ - np.maximum(G_, B_)).astype(np.float32)
for m, (cx, cy) in partir(lim(rojo & izq & dentro), c_rojo, 150, 20):
    G.setdefault('pantorrilla', []).append(m)
c_verde = (G_ - np.maximum(R_, B_)).astype(np.float32)
for m, (cx, cy) in partir(lim(verde & izq & dentro), c_verde, 52, 15):
    # deltoide arriba y afuera, infraespinoso hacia la columna, tríceps en el brazo (un mismo
    # músculo puede salir en varios trozos si tiene varios núcleos: se juntan)
    G.setdefault('hombro' if cy < 185 and cx < 185 else 'infraespinoso' if cx > 185 and cy < 225 else 'triceps', []).append(m)
# El tríceps se aclara hacia las puntas de sus ramas: con el umbral de siempre las puntas salen
# romas. Se le añade el verde tenue que le queda pegado (sin pasar a los otros verdes).
verde_tenue = (G_ - np.maximum(R_, B_) > LN_TRICEPS_UMBRAL) & (lum < 225)
otros_verdes = np.any(G.get('hombro', []) + G.get('infraespinoso', []), 0).astype(np.uint8)
tri = np.any(G['triceps'], 0).astype(np.uint8)
extra = verde_tenue & izq & (dentro > 0) & (cv2.dilate(tri, k(3 * S)) > 0) & (cv2.dilate(otros_verdes, k(2 * S)) == 0)
G['triceps'] = [cv2.morphologyEx((tri | extra).astype(np.uint8), cv2.MORPH_OPEN, k(S))]
for m, (cx, cy) in piezas(lim(azul & izq & dentro), 20):
    if cy < 455: G.setdefault('gluteo', []).append(m)
# la franja de fuera del muslo es un huso que se aclara hacia las puntas: umbral más bajo
azul_claro = (B_ - np.maximum(R_, G_) > 40) & (yy > 450 * S) & (yy < 600 * S)
for m, (cx, cy) in piezas(lim(azul_claro & izq & dentro & (xx < 191 * S)), 20):
    G.setdefault('cuadriceps', []).append(m)
for m, (cx, cy) in piezas(lim(celeste & izq & dentro), 20):
    G.setdefault('dorsal' if cy < 330 else 'isquiotibiales', []).append(m)
G['antebrazo'] = [max((p for p, _ in piezas(lim(antebrazo & izq & dentro & (yy > 255 * S) & (yy < 395 * S) & (xx < 225 * S), 4), 40)),
                      key=lambda p: int(p.sum()))]
# Zonas sin color (negras en la referencia): cada hueco oscuro encerrado por líneas blancas
for m, (cx, cy) in piezas(lim(negro & izq & dentro & (fig > 0), 2), 40):
    if cy < 97: g = 'gris-cabeza'
    elif cy < 230 and cx > 175: g = 'trapecio'
    elif cy < 380 and cx > 225: g = 'lumbar'
    elif cy > 370 and cx < 120: g = 'gris-mano'
    elif cy > 700: g = 'gris-pie' if cy > 830 else 'gris-pierna'
    else: g = 'otro'
    G.setdefault(g, []).append(m)
# Las piezas que se tocan tras partirlas (las dos cabezas de la pantorrilla) se guardan por
# separado ('grupo#i'), para que luego quede entre ellas la separación de siempre.
SEPARADAS = ('pantorrilla',)
out = {}
for g, ms in G.items():
    if g == 'otro': continue
    if g in SEPARADAS:
        for i, m in enumerate(ms): out[f'{g}#{i}'] = m.astype(np.uint8)
    else:
        out[g] = np.any(ms, 0).astype(np.uint8)
np.savez_compressed('masks.npz', AX=AX, fig=fig, **out)
