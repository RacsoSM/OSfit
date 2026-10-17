"""El ícono de Músculos de la barra de abajo de la web, sacado del mapa muscular de frente.

Es el busto del mapa (cabeza, hombros, pecho, brazos, abdomen) relleno de un color, con las
separaciones entre músculos en hueco, igual que en la pestaña. Uno por sexo. Los paths del
mapa pesan 40–70 kB; aquí se muestrean, se llevan a una caja de 24×24 y se simplifican
(Ramer–Douglas–Peucker) para que el ícono pese unos kB.

Uso, desde esta carpeta (solo biblioteca estándar):

    python3 -I icono_barra.py ../../web/src/ui/iconoMusculos.ts

Ver `web/src/ui/barraInferior.ts`.
"""
import math
import re
import sys
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent.parent / "web" / "public"

# El recuadro (en unidades del mapa) que se vuelve el ícono de 24×24: de la cabeza a la
# cintura, con los brazos. Las dos figuras no comparten coordenadas (420 vs 285 de ancho).
VISTAS = {
    "H": {"archivo": "mapa-muscular-frente.svg", "caja": (45, 20, 330), "base": ()},
    # En la de mujer la cara es parte del contorno, no de un músculo: sin el contorno de
    # base el ícono sale con la cara hueca.
    "M": {"archivo": "mapa-muscular-frente-mujer.svg", "caja": (-22, 18, 330), "base": ("contorno",)},
}
PARTES = ("musculo", "sin-color")
LADO = 24
SEPARACION = 16  # el hueco entre músculos, en unidades del mapa
TOLERANCIA = 0.06  # Ramer–Douglas–Peucker, en unidades del ícono
PASOS_POR_CURVA = 8


def paths_de(svg, clases):
    res = []
    for p in re.findall(r"<path[^>]*/>", svg):
        c = re.search(r'class="([^"]+)"', p)
        if c and c.group(1) in clases:
            res.append(re.search(r'\sd="([^"]+)"', p).group(1))
    return res


def subpaths(d):
    """Cada subpath como lista de puntos. Los mapas solo usan M, C y Z absolutos."""
    fichas = re.findall(r"[MCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    res, actual, i, cmd = [], [], 0, None
    while i < len(fichas):
        f = fichas[i]
        if f in "MCZ":
            cmd = f
            i += 1
            if cmd == "Z":
                if actual:
                    res.append(actual)
                actual = []
            continue
        if cmd == "M":
            actual = [(float(fichas[i]), float(fichas[i + 1]))]
            i += 2
            cmd = "L"  # pares sueltos después de M serían líneas; no aparecen en los mapas
        elif cmd == "C":
            p0 = actual[-1]
            p1, p2, p3 = [(float(fichas[i + k]), float(fichas[i + k + 1])) for k in (0, 2, 4)]
            for s in range(1, PASOS_POR_CURVA + 1):
                t = s / PASOS_POR_CURVA
                u = 1 - t
                actual.append((
                    u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
                ))
            i += 6
        else:
            actual.append((float(fichas[i]), float(fichas[i + 1])))
            i += 2
    if actual:
        res.append(actual)
    return res


def rdp(puntos, eps):
    if len(puntos) < 3:
        return puntos
    (x1, y1), (x2, y2) = puntos[0], puntos[-1]
    largo = math.hypot(x2 - x1, y2 - y1) or 1e-9
    peor, cual = 0.0, 0
    for k in range(1, len(puntos) - 1):
        x, y = puntos[k]
        dist = abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / largo
        if dist > peor:
            peor, cual = dist, k
    if peor <= eps:
        return [puntos[0], puntos[-1]]
    return rdp(puntos[: cual + 1], eps)[:-1] + rdp(puntos[cual:], eps)


def a_icono(puntos, caja):
    x0, y0, lado = caja
    k = LADO / lado
    return [((x - x0) * k, (y - y0) * k) for x, y in puntos]


def visible(puntos):
    return any(-2 <= x <= LADO + 2 and -2 <= y <= LADO + 2 for x, y in puntos)


def d_de(subs):
    partes = []
    for pts in subs:
        # Cerrado: el primero y el último casi coinciden; RDP sobre el anillo partido en dos.
        mitad = len(pts) // 2
        simple = rdp(pts[: mitad + 1], TOLERANCIA)[:-1] + rdp(pts[mitad:] + [pts[0]], TOLERANCIA)[:-1]
        if len(simple) < 3 or not visible(simple):
            continue
        partes.append("M" + "L".join(f"{x:.1f} {y:.1f}".replace(".0 ", " ") for x, y in simple) + "Z")
    return "".join(partes)


def icono(sexo):
    v = VISTAS[sexo]
    svg = (PUBLIC / v["archivo"]).read_text()
    caja = v["caja"]
    base = "".join(d_de([a_icono(s, caja) for s in subpaths(d)]) for d in paths_de(svg, v["base"]))
    partes = "".join(d_de([a_icono(s, caja) for s in subpaths(d)]) for d in paths_de(svg, PARTES))
    return base, partes, round(SEPARACION * LADO / caja[2], 2)


def main(destino):
    lineas = [
        "/**",
        " * El ícono de Músculos de la barra de abajo: el busto del mapa muscular de frente, uno",
        " * por sexo, en una caja de 24×24. GENERADO por `docs/mapa-muscular/icono_barra.py`;",
        " * no se edita a mano.",
        " *",
        " * `base` se rellena entera y `partes` se rellenan con un trazo del grosor `separacion`",
        " * en negro de máscara: así quedan huecos entre músculos sobre cualquier fondo.",
        " */",
        "export interface IconoMusculos { base: string; partes: string; separacion: number }",
        "",
        'export const ICONO_MUSCULOS: Record<"H" | "M", IconoMusculos> = {',
    ]
    for sexo in ("H", "M"):
        base, partes, sep = icono(sexo)
        lineas.append(f"  {sexo}: {{")
        lineas.append(f'    base: "{base}",')
        lineas.append(f'    partes: "{partes}",')
        lineas.append(f"    separacion: {sep},")
        lineas.append("  },")
    lineas.append("};")
    Path(destino).write_text("\n".join(lineas) + "\n")
    print(f"✓ {destino} ({Path(destino).stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main(sys.argv[1])
