# Herramienta (no forma parte de la generación): ajusta una línea medida a una curva suave
# (polinomios x(t), y(t) por longitud de arco) que respeta exactamente sus extremos y uniones, y
# devuelve pocos puntos de control repartidos. Con ella se alisaron las líneas del muslo, la
# pantorrilla y la ingle de lineas.py; sirve para alisar una línea nueva antes de pegarla allí.
# Uso: python3 alisar.py  (imprime el ajuste de las líneas actuales y cuánto se desvía)
import numpy as np, importlib, sys
import lineas as LN

def densa(pts, n=60):
    pts = np.array(pts, float); ext = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]]); out = []
    for i in range(1, len(pts)):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1]); return np.array(out)

def alisar(pts, fijos=(), grado=4, k=7):
    d = densa(pts); s = np.r_[0, np.cumsum(np.hypot(*np.diff(d, axis=0).T))]; t = s / s[-1]
    w = np.ones(len(d))
    tf = []
    for f in [pts[0], pts[-1], *fijos]:
        j = int(np.argmin(np.hypot(*(d - np.array(f)).T))); w[j] = 1e4; d[j] = f; tf.append(t[j])
    cx = np.polyfit(t, d[:, 0], grado, w=w); cy = np.polyfit(t, d[:, 1], grado, w=w)
    ts = sorted(set(np.round(np.linspace(0, 1, k), 4)) | set(np.round(tf, 4)))
    # quitar puntos demasiado cerca de un fijo
    ts2 = []
    for v in ts:
        if v in np.round(tf, 4) or all(abs(v - f) > 0.06 for f in tf): ts2.append(v)
    nuevo = [(round(float(np.polyval(cx, v)), 1), round(float(np.polyval(cy, v)), 1)) for v in ts2]
    for f in [pts[0], pts[-1], *fijos]:   # los fijos, exactos
        j = int(np.argmin([np.hypot(a - f[0], b - f[1]) for a, b in nuevo])); nuevo[j] = tuple(f)
    err = max(np.min(np.hypot(*(densa(nuevo) - p).T)) for p in densa(pts))
    return nuevo, err

if __name__ == '__main__':
    casos = {n: (getattr(LN, n), g) for n, g in [('MUSLO_A', 4), ('MUSLO_B', 3), ('MUSLO_C_IZQ', 3),
                                                  ('MUSLO_C_DER', 3), ('MUSLO_ABAJO', 2), ('PANTORRILLA', 2)]}
    # la ingle cambia de dirección en el final del recto: se ajusta en dos tramos
    ingle = next(p for a, b, p in LN.FRONTERAS if (a, b) == ('abdomen', 'cuadriceps'))
    j = ingle.index((167.6, 503.4))
    casos['INGLE (1)'] = (ingle[:j + 1], 2); casos['INGLE (2)'] = (ingle[j:], 2)
    for n, (p, g) in casos.items():
        nuevo, err = alisar(p, (), g, 7 if 'INGLE' not in n else 5)
        print(n, 'desvío máx %.2f px' % err); print('   ', nuevo)
