# Paso 4: vectoriza las máscaras, añade las líneas y formas de lineas.py y escribe el SVG.
# Uso: python3 vectorizar.py SALIDA.svg
import sys
import numpy as np, cv2
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
    piezas_m[g + '-izq'] = izq[:, ::-1] if False else np.zeros_like(izq)
    xs_ = np.arange(W); mx_ = np.round(2 * AX - xs_).astype(int); ok = (mx_ >= 0) & (mx_ < W)
    piezas_m[g + '-izq'][:, xs_[ok]] = izq[:, mx_[ok]]
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


def espejar(m):
    o = np.zeros_like(m); xs_ = np.arange(W); mx_ = np.round(2 * AX - xs_).astype(int)
    ok = (mx_ >= 0) & (mx_ < W); o[:, xs_[ok]] = m[:, mx_[ok]]; return o


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
cerca = (dist <= RMAX).sum(0)
mejor = dist.argmin(0); dmin = dist.min(0)
dentro = cv2.distanceTransform(fig.astype(np.uint8), cv2.DIST_L2, 5) > 1.5 * S
asignado = (dmin <= RMAX) & ((cerca >= 2) | (dmin <= HUECO / 2 + 0.5 * S)) & dentro
norm = {}
for i, n in enumerate(nombres):
    reg = (asignado & (mejor == i)).astype(np.uint8)
    norm[n] = (cv2.distanceTransform(reg, cv2.DIST_L2, 5) > HUECO / 2).astype(np.uint8)

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

contorno = area_paths(fig, sigma=1.0 * S, eps=0.25 * S, minarea=0)
gris = (f"{area_paths(suave(norm['gris'], 1.5 * S), sigma=1.5 * S)} "
        f"{area_paths(D['mano'], sigma=1.0 * S, eps=0.25 * S)}")

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
