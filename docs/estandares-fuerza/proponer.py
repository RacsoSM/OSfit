"""
Propuesta de estándares de fuerza por ejercicio (punto 4 / mapa muscular).

Genera `estandares.json` (lo que se cargará al banco como `estandares`) y `propuesta.md`
(la hoja que revisa el entrenador). Para cambiar un valor: edita FAMILIAS o EJERCICIOS
aquí y vuelve a correr `python3 proponer.py`. Ver `README.md` de esta carpeta.

Cada ejercicio tiene 8 cortes por sexo (NIVELES, niveles 1 a 8). Las tablas públicas dan 5
(Principiante, Novato, Intermedio, Avanzado, Élite), que caen en los niveles 1, 3, 5, 7 y 8;
los niveles 2, 4 y 6 son el punto medio entre dos de ellos, en los tramos donde más tarda
subir, para que se sienta que se avanza más seguido. Los nombres de NIVELES son los de la app,
no los de las tablas.
FAMILIAS y CORPORAL guardan los 5 de las tablas; `a_ocho` arma los 8.
- "peso": 1RM estimado / peso corporal. En mancuernas, el peso de UNA mancuerna.
- "corporal": repeticiones seguidas con el propio cuerpo.
- "tiempo": no alimenta el mapa (spec), no lleva estándares.
"""
import json
import math
from pathlib import Path
from statistics import NormalDist

AQUI = Path(__file__).parent
BANCO = AQUI.parent.parent / "functions" / "semilla" / "ejercicios.json"

# Ejercicios de referencia (1RM / peso corporal), de tablas públicas de fuerza por peso
# corporal (estilo Strength Level / ExRx), redondeados. H = hombre, M = mujer.
FAMILIAS = {
    "banca":       {"H": [0.50, 0.75, 1.00, 1.50, 2.00], "M": [0.25, 0.50, 0.75, 1.00, 1.50]},
    "sentadilla":  {"H": [0.75, 1.25, 1.50, 2.25, 2.75], "M": [0.50, 0.75, 1.25, 1.50, 2.00]},
    "muerto":      {"H": [1.00, 1.50, 2.00, 2.50, 3.00], "M": [0.50, 1.00, 1.25, 1.75, 2.50]},
    "militar":     {"H": [0.35, 0.55, 0.75, 1.00, 1.30], "M": [0.20, 0.35, 0.50, 0.75, 1.00]},
    "curl":        {"H": [0.20, 0.40, 0.60, 0.85, 1.15], "M": [0.10, 0.20, 0.40, 0.60, 0.85]},
    "remo":        {"H": [0.50, 0.75, 1.00, 1.50, 1.75], "M": [0.25, 0.40, 0.65, 0.90, 1.20]},
    "jalon":       {"H": [0.50, 0.75, 1.00, 1.40, 1.75], "M": [0.30, 0.45, 0.65, 0.90, 1.20]},
    "prensa":      {"H": [1.25, 2.00, 3.00, 4.25, 5.50], "M": [0.75, 1.50, 2.25, 3.25, 4.25]},
    "triceps":     {"H": [0.25, 0.45, 0.65, 0.95, 1.25], "M": [0.15, 0.25, 0.40, 0.60, 0.85]},
    "extension":   {"H": [0.50, 0.75, 1.15, 1.60, 2.10], "M": [0.35, 0.55, 0.85, 1.20, 1.60]},
    "femoral":     {"H": [0.35, 0.55, 0.80, 1.10, 1.45], "M": [0.25, 0.40, 0.60, 0.85, 1.15]},
    "pantorrilla": {"H": [0.50, 1.00, 1.60, 2.40, 3.25], "M": [0.35, 0.75, 1.25, 1.90, 2.60]},
    "encogimiento":{"H": [0.60, 1.00, 1.50, 2.10, 2.75], "M": [0.35, 0.60, 0.95, 1.40, 1.85]},
    "hipthrust":   {"H": [0.75, 1.25, 1.75, 2.50, 3.25], "M": [0.50, 1.00, 1.50, 2.25, 3.00]},
    "muneca":      {"H": [0.20, 0.35, 0.55, 0.80, 1.05], "M": [0.10, 0.20, 0.35, 0.50, 0.70]},
    "abductor":    {"H": [0.40, 0.70, 1.05, 1.50, 2.00], "M": [0.35, 0.65, 1.00, 1.45, 1.95]},
    "lateral":     {"H": [0.05, 0.10, 0.20, 0.30, 0.40], "M": [0.03, 0.06, 0.12, 0.18, 0.25]},
    "crunch":      {"H": [0.30, 0.55, 0.85, 1.20, 1.60], "M": [0.20, 0.35, 0.55, 0.80, 1.10]},
}

# Ejercicios con peso: (familia, factor, nota). El estándar es familia × factor.
PESO = {
    "press-banca": ("banca", 1.00, ""),
    "press-banca-inclinado": ("banca", 0.82, ""),
    "press-banca-declinado": ("banca", 1.05, ""),
    "press-cerrado": ("banca", 0.85, ""),
    "press-mancuernas": ("banca", 0.38, "por mancuerna"),
    "press-inclinado-mancuernas": ("banca", 0.33, "por mancuerna"),
    "aperturas-mancuernas": ("banca", 0.20, "por mancuerna"),
    "aperturas-inclinadas": ("banca", 0.18, "por mancuerna"),
    "cruce-poleas": ("banca", 0.36, "por lado; base ×2 sobre 0.18 y polea doble ×1.3 = ×2.6 (decisión del entrenador, 2026-10-16)"),
    # Las mismas poleas que el cruce, a otra altura: el mismo estándar (2026-10-23).
    "aperturas-polea-media": ("banca", 0.36, "por lado; como el cruce de poleas"),
    "aperturas-polea-alta": ("banca", 0.36, "por lado; como el cruce de poleas"),
    "pec-deck": ("banca", 0.80, "máquina: varía por marca"),
    "press-pecho-maquina": ("banca", 0.90, "máquina: varía por marca"),
    "sentadilla": ("sentadilla", 1.00, ""),
    "sentadilla-frontal": ("sentadilla", 0.82, ""),
    "sentadilla-smith": ("sentadilla", 0.95, "máquina: varía por marca"),
    "sentadilla-hack": ("sentadilla", 1.10, "máquina: varía por marca"),
    "sentadilla-hack-maquina": ("sentadilla", 1.10, "máquina: varía por marca"),
    # Solo el disco colgado del cinturón: sin barra y sin carga en la espalda (2026-10-23).
    "belt-squat": ("sentadilla", 0.50, "el peso del disco colgado"),
    "sentadilla-goblet": ("sentadilla", 0.35, "una mancuerna o pesa rusa"),
    "sentadilla-sumo-mancuerna": ("sentadilla", 0.38, "una mancuerna"),
    "sentadilla-bulgara": ("sentadilla", 0.25, "por mancuerna"),
    "zancadas": ("sentadilla", 0.25, "por mancuerna"),
    "zancadas-atras": ("sentadilla", 0.25, "por mancuerna"),
    "subidas-cajon": ("sentadilla", 0.22, "por mancuerna"),
    "buenos-dias": ("muerto", 0.45, ""),
    "prensa": ("prensa", 1.00, "máquina: varía por marca"),
    "prensa-pies-abiertos": ("prensa", 1.00, "máquina: varía por marca"),
    "prensa-horizontal-una-pierna": ("prensa", 0.40, "una pierna; máquina"),
    # La misma máquina de placas que la de una pierna, con las dos: el doble (2026-10-21). La de
    # 45° (×1.00) es de discos y en una pila sus números no se alcanzan.
    "prensa-maquina": ("prensa", 0.235, "máquina de 16 barras"),
    "extension-cuadriceps": ("extension", 1.00, "máquina"),
    "curl-femoral-acostado": ("femoral", 1.00, "máquina"),
    "curl-femoral-sentado": ("femoral", 1.10, "máquina"),
    "peso-muerto": ("muerto", 1.00, ""),
    "peso-muerto-sumo": ("muerto", 1.00, ""),
    "peso-muerto-rumano": ("muerto", 0.75, ""),
    "peso-muerto-piernas-rigidas": ("muerto", 0.72, ""),
    "peso-muerto-rumano-mancuernas": ("muerto", 0.33, "por mancuerna"),
    "peso-muerto-piernas-rigidas-mancuernas": ("muerto", 0.32, "por mancuerna"),
    "swing-kettlebell": ("muerto", 0.20, "una pesa rusa"),
    "hip-thrust": ("hipthrust", 1.00, ""),
    "pantorrilla-de-pie": ("pantorrilla", 1.00, "máquina"),
    "pantorrilla-sentado": ("pantorrilla", 0.70, "máquina"),
    "pantorrilla-prensa": ("pantorrilla", 1.10, "en prensa: varía por marca"),
    "pantorrilla-prensa-45": ("pantorrilla", 1.10, "en prensa: varía por marca"),
    "abductores-maquina": ("abductor", 1.00, "máquina"),
    "aductores-maquina": ("abductor", 1.00, "máquina"),
    "patada-gluteo-polea": ("abductor", 0.805, "polea: el peso marcado no es el real, × 2.3 sobre 0.35 (decisión del entrenador, 2026-10-16; antes × 1.3)"),
    "patada-gluteo-maquina": ("abductor", 0.80, "máquina de palanca, una pierna: varía por marca"),
    "jalon-al-pecho": ("jalon", 1.00, ""),
    "jalon-agarre-abierto": ("jalon", 0.95, ""),
    "jalon-triangulo": ("jalon", 1.00, ""),
    "jalon-supino": ("jalon", 1.00, ""),
    "remo-sentado-polea": ("jalon", 1.05, ""),
    "pullover-polea": ("triceps", 0.90, ""),
    "remo-con-barra": ("remo", 1.00, ""),
    "remo-maquina": ("remo", 0.95, "máquina: varía por marca"),
    "remo-en-t": ("remo", 0.85, "solo los discos"),
    "remo-mancuerna": ("remo", 0.45, "una mancuerna"),
    "encogimientos-barra": ("encogimiento", 1.00, ""),
    "encogimientos-mancuernas": ("encogimiento", 0.45, "por mancuerna"),
    "press-militar": ("militar", 1.00, ""),
    "press-militar-sentado": ("militar", 1.03, ""),
    "press-militar-maquina": ("militar", 0.95, "máquina: varía por marca"),
    "press-hombro-mancuernas": ("militar", 0.40, "por mancuerna"),
    "press-arnold": ("militar", 0.36, "por mancuerna"),
    "remo-al-menton": ("militar", 0.80, ""),
    "elevaciones-laterales": ("lateral", 1.00, "por mancuerna"),
    "elevaciones-laterales-polea": ("lateral", 0.80, "por lado"),
    "elevaciones-frontales": ("lateral", 2.20, "con disco, a dos manos: el peso del disco, ×2 sobre el de una sola mano (decisión del entrenador, 2026-10-16)"),
    "pajaros": ("lateral", 0.90, "por mancuerna"),
    "rear-delt-maquina": ("militar", 0.75, "máquina: varía por marca"),
    "face-pull": ("triceps", 1.17, "polea; base ×1.3 sobre 0.90 (decisión del entrenador, 2026-10-16)"),
    "curl-barra": ("curl", 1.00, ""),
    "curl-barra-z": ("curl", 1.00, ""),
    "curl-polea": ("curl", 1.00, ""),
    "curl-predicador": ("curl", 0.85, ""),
    "curl-predicador-maquina": ("curl", 0.85, "máquina"),
    "spider-curl": ("curl", 0.75, ""),
    "curl-mancuernas": ("curl", 0.45, "por mancuerna"),
    "curl-martillo": ("curl", 0.50, "por mancuerna"),
    "curl-inclinado": ("curl", 0.38, "por mancuerna"),
    "curl-concentrado": ("curl", 0.40, "una mancuerna"),
    "curl-inverso-barra": ("curl", 0.75, ""),
    "curl-inverso-polea": ("curl", 0.75, ""),
    "curl-inverso-mancuernas": ("curl", 0.33, "por mancuerna"),
    "curl-muneca-barra": ("muneca", 1.00, ""),
    "curl-muneca-polea": ("muneca", 0.90, ""),
    "curl-muneca-inverso-barra": ("muneca", 0.60, ""),
    "curl-muneca-mancuernas": ("muneca", 0.45, "por mancuerna"),
    "curl-muneca-inverso-mancuernas": ("muneca", 0.28, "por mancuerna"),
    "extension-triceps-polea": ("triceps", 1.00, ""),
    "extension-triceps-cuerda": ("triceps", 0.90, ""),
    "extension-triceps-trasnuca-polea": ("triceps", 0.85, ""),
    "copa-polea-un-brazo": ("triceps", 0.40, "un brazo; polea"),
    "press-frances": ("triceps", 0.80, ""),
    "extension-triceps-mancuerna": ("triceps", 0.45, "copa a dos manos: el peso de la pesa completa, no por brazo"),
    "patada-triceps": ("triceps", 0.20, "por mancuerna"),
    # Máquina de fondos sentado, de placas (GIF 1451). Como el press de pecho en máquina: el
    # empuje lo lleva el pecho y el tríceps juntos (2026-10-22).
    "fondos-maquina": ("banca", 0.90, "máquina: varía por marca"),
    "crunch-polea": ("crunch", 1.00, ""),
    # Máquina de placas, no la estación de polea doble. ×1.13: el entrenador quiere a Dulce
    # (M, 31.5 kg × 12) en Fuerte, a media banda; con ×1.00 salía Avanzada (2026-10-21).
    "crunch-maquina": ("crunch", 1.13, "máquina de placas"),
    # La rotación mueve bastante menos que el crunch en la misma polea (2026-10-23).
    "giro-polea": ("crunch", 0.50, "polea, de pie con brazos estirados"),
}

# Corporales: repeticiones seguidas.
# La estación de poleas del gimnasio es de polea doble: la pila marca bastante más de lo que se
# siente. Con los estándares de las tablas, 5 barras de tríceps daban Avanzado a quien el
# entrenador ve entre Intermedio y Atlética. Él eligió ×1.3 (2026-10-14) y dijo qué ejercicios
# van en esa estación.
FACTOR_POLEA_DOBLE = 1.3
POLEA_DOBLE = {
    "pullover-polea", "face-pull", "elevaciones-laterales-polea", "curl-polea", "curl-inverso-polea",
    "curl-muneca-polea", "extension-triceps-polea", "extension-triceps-cuerda",
    "extension-triceps-trasnuca-polea", "copa-polea-un-brazo", "crunch-polea", "cruce-poleas",
    "aperturas-polea-media", "aperturas-polea-alta", "giro-polea",
}

# Factor aparte por sexo, encima del de `PESO`, para los ejercicios donde un solo factor no
# deja bien a los dos. Curl femoral acostado: 10 barras (45 kg) × 8 es de un hombre muy fuerte,
# y con ×0.6 eso es Élite; las mujeres con ×0.8 (Brianda, 5 barras × 8, en Intermedio).
# Decisión del entrenador, 2026-10-16.
# Prensa en máquina, mujeres ×2: 50 kg × 12 de una clienta de 70 kg salía en Élite, y el
# entrenador dice que en esa máquina es lo normal; con ×2 queda al inicio de Atlética. Hombres
# ×1.3: un hombre normal hace 10 barras × 12, y el entrenador lo quiere a media banda de
# Intermedio (2026-10-27). Con eso Élite ya no cabe en la pila de 16 barras × 12.
FACTOR_POR_SEXO = {
    "curl-femoral-acostado": {"H": 0.6, "M": 0.8},
    "prensa-maquina": {"H": 1.3, "M": 2.0},
}

CORPORAL = {
    "lagartijas":              {"H": [3, 15, 30, 45, 65], "M": [1, 5, 15, 28, 40]},
    "fondos-pecho":            {"H": [1, 8, 18, 30, 42], "M": [1, 3, 8, 15, 25]},
    "fondos-banco":            {"H": [5, 15, 30, 45, 60], "M": [3, 10, 22, 35, 50]},
    "fondos-triceps":          {"H": [1, 8, 18, 30, 42], "M": [1, 3, 8, 15, 25]},
    "dominadas":               {"H": [1, 6, 12, 20, 30], "M": [1, 3, 6, 12, 18]},
    "dominadas-supinas":       {"H": [1, 7, 13, 21, 31], "M": [1, 3, 7, 13, 19]},
    "sentadilla-salto":        {"H": [5, 15, 30, 45, 60], "M": [3, 10, 22, 35, 50]},
    "zancadas-caminando":      {"H": [8, 20, 35, 50, 70], "M": [6, 15, 28, 42, 60]},
    "patada-gluteo-liga":      {"H": [10, 20, 35, 50, 70], "M": [10, 20, 35, 50, 70]},
    "hiperextensiones":        {"H": [5, 15, 30, 45, 60], "M": [5, 12, 25, 40, 55]},
    "glute-ham-raise":         {"H": [1, 5, 10, 16, 24], "M": [1, 3, 6, 10, 15]},
    "pantorrilla-escalon":     {"H": [10, 25, 40, 55, 75], "M": [8, 20, 35, 50, 70]},
    "crunch":                  {"H": [10, 25, 45, 65, 90], "M": [8, 20, 38, 55, 80]},
    "abdominales-completos":   {"H": [5, 20, 35, 50, 70], "M": [3, 15, 28, 42, 60]},
    "elevacion-piernas-colgado": {"H": [1, 6, 12, 20, 30], "M": [1, 4, 9, 15, 22]},
    "elevacion-piernas":       {"H": [5, 15, 25, 40, 55], "M": [4, 12, 22, 35, 48]},
    "giros-rusos":             {"H": [10, 25, 40, 60, 80], "M": [10, 22, 35, 52, 70]},
    "bicho-muerto":            {"H": [10, 20, 35, 50, 70], "M": [10, 20, 35, 50, 70]},
    "burpees":                 {"H": [3, 10, 20, 30, 40], "M": [2, 7, 15, 24, 32]},
}
NOTAS_CORPORAL = {
    "patada-gluteo-liga": "con liga: depende de la liga, poco confiable",
    "bicho-muerto": "por lado",
    "zancadas-caminando": "pasos por pierna",
}

# Sin estándar a propósito.
SIN_ESTANDAR = {
    "dominadas-asistidas": "el peso es la ayuda de la máquina: más peso = menos fuerza",
}

# Nombres elegidos por el entrenador (2026-10-11). "Atlético" va en femenino para las
# mujeres ("Atlética"); los demás no cambian.
NIVELES = ["Principiante", "Ascenso", "En forma", "Intermedio", "Atlético / Atlética", "Fuerte",
           "Avanzado", "Élite"]
# Dónde cae cada uno de los 5 de las tablas entre los 8 (índice 0 = nivel 1).
ANCLAS = [0, 2, 4, 6, 7]
# A quién supera cada corte (decisión del entrenador, 2026-10-11, "camino B"): ya no se toman
# fijos de las tablas, salen de un modelo (`modelo`, abajo) en cada ejercicio y se promedian.
# Antes se partía cada tramo a la mitad y la gráfica quedaba en 15 % parejo, y al bajar la
# parte de arriba los porcentajes seguían siendo los de las tablas (inflados). `main` los
# calcula, los imprime y los deja en `percentiles.json`; van a `web/src/fuerza.ts`.
#
# El modelo: entre la gente que entrena, la fuerza (1RM ÷ peso, o reps) sigue una log-normal
# ajustada a los 5 puntos de las tablas (Principiante supera al 5 %, Novato 20 %, Intermedio
# 50 %, Avanzado 80 %, Élite 95 %). La gente que no entrena, otra log-normal con la misma
# dispersión y la mediana en el estándar de Principiante (lo que levanta un adulto promedio
# que no entrena). Toda la población: 1 de cada 4 entrena fuerza.
PCT_TABLAS = [0.05, 0.20, 0.50, 0.80, 0.95]
ENTRENAN_DE_LA_POBLACION = 0.25
# Élite: el 10 % más fuerte de quienes entrenan, según el modelo de cada ejercicio (el
# entrenador eligió 10 % sobre 5 % y 8 %: exclusivo pero alcanzable). Con lo que bajó Avanzado,
# antes Élite era ~13 % de quienes entrenan.
PCT_ELITE = 0.90


# La parte de arriba, más baja que en las tablas (decisión del entrenador, 2026-10-11): las
# tablas tipo Strength Level salen de lo que reporta gente que entrena mucho, y para las
# clientas de un gym normal quedaba casi inalcanzable. Avanzado y Élite bajan 15 %; Fuerte,
# que es su punto medio con Atlético, baja con ellos (un poco menos). Bajar Fuerte 15 % parejo
# lo dejaba por debajo de Atlético en los ejercicios donde las tablas tienen Intermedio y
# Avanzado muy juntos.
ARRIBA = [6, 7]
BAJA_ARRIBA = 0.15
# Lo mínimo que pide cada nivel arriba del anterior, de Atlético para arriba.
SALTO_MIN = 0.06


_N = NormalDist()


def modelo(cinco: list) -> tuple[float, float]:
    """(mu, sigma) de la log-normal de quienes entrenan, ajustada a los 5 de las tablas."""
    z = [_N.inv_cdf(p) for p in PCT_TABLAS]
    lx = [math.log(v) for v in cinco]
    zm, lm = sum(z) / len(z), sum(lx) / len(lx)
    sig = sum((a - zm) * (b - lm) for a, b in zip(z, lx)) / sum((a - zm) ** 2 for a in z)
    return lm - sig * zm, sig


def percentiles(cinco: list, cortes: list) -> tuple[list, list]:
    """Qué % de quienes entrenan y de toda la población queda debajo de cada corte."""
    mu, sig = modelo(cinco)
    t = [_N.cdf((math.log(c) - mu) / sig) for c in cortes]
    u = [_N.cdf((math.log(c) - math.log(cinco[0])) / sig) for c in cortes]
    e = ENTRENAN_DE_LA_POBLACION
    return [100 * x for x in t], [100 * ((1 - e) * a + e * b) for a, b in zip(u, t)]


def con_elite(cinco: list, ocho: list, entero: bool) -> list:
    """`ocho` con Élite en el 5 % más fuerte del modelo (y siempre arriba de Avanzado)."""
    mu, sig = modelo(cinco)
    v = math.exp(mu + sig * _N.inv_cdf(PCT_ELITE))
    # Nunca más que el Élite de las tablas: el modelo se pasa en los corporales (dominadas
    # pedía 42 reps contra 30 de la tabla).
    v = max(min(v, cinco[4]), ocho[6] * (1 + SALTO_MIN))
    return ocho[:7] + [math.ceil(v) if entero else round(v, 3)]


def a_ocho(cinco: list, entero: bool = False) -> list:
    """Los 5 cortes de las tablas a 8: los 5 en ANCLAS y el punto medio en los huecos."""
    ocho: list = [None] * len(NIVELES)
    for i, v in zip(ANCLAS, cinco):
        ocho[i] = v
    original = ocho[:]
    original[5] = (original[4] + original[6]) / 2
    for i in ARRIBA:
        bajado = ocho[i] * (1 - BAJA_ARRIBA)
        ocho[i] = round(bajado) if entero else round(bajado, 3)
    for i, v in enumerate(ocho):
        if v is None:
            medio = (ocho[i - 1] + ocho[i + 1]) / 2
            ocho[i] = round(medio) if entero else round(medio, 3)
    # Si Avanzado quedó casi pegado a Atlético (tablas con Intermedio y Avanzado muy juntos),
    # Fuerte y Avanzado se reparten parejo entre Atlético y Élite: subir de nivel tiene que
    # pedir algo, y el salto a Élite no debe quedarse con todo el tramo.
    atl, eli = ocho[4], ocho[7]
    if not entero and (ocho[6] - atl) / atl < 2 * SALTO_MIN:
        # Nunca por encima de lo que pedían las tablas: esto es para bajar, no para subir.
        ocho[5] = round(min(atl + (eli - atl) / 3, original[5]), 3)
        ocho[6] = round(min(atl + 2 * (eli - atl) / 3, original[6]), 3)
    return ocho
PESO_EJEMPLO = {"H": 75, "M": 60}


def redondear_kg(kg: float) -> float:
    paso = 1 if kg < 20 else 2.5
    return round(kg / paso) * paso


def main() -> None:
    banco = json.loads(BANCO.read_text())
    salida: dict = {}
    modelos: list[tuple[list, list]] = []
    por_mancuerna: list[str] = []
    filas: dict[str, list[str]] = {}
    faltan = []
    for e in banco:
        i, tipo, grupo = e["id"], e["tipo"], e["grupo"]
        filas.setdefault(grupo, [])
        if tipo in ("tiempo", "cardio"):
            filas[grupo].append(f"| {e['nombre']} | — | de {tipo}: no pinta el mapa |" + " |" * (len(NIVELES) - 1))
            continue
        if i in SIN_ESTANDAR:
            filas[grupo].append(f"| {e['nombre']} | — | sin estándar: {SIN_ESTANDAR[i]} |" + " |" * (len(NIVELES) - 1))
            continue
        if tipo == "peso" and i in PESO:
            fam, f, nota = PESO[i]
            if i in POLEA_DOBLE:
                f *= FACTOR_POLEA_DOBLE
                nota = f"{nota}; polea doble ×{FACTOR_POLEA_DOBLE:g}" if nota else f"polea doble ×{FACTOR_POLEA_DOBLE:g}"
            por_sexo = FACTOR_POR_SEXO.get(i, {"H": 1, "M": 1})
            if i in FACTOR_POR_SEXO:
                extra = f"H ×{por_sexo['H']:g}, M ×{por_sexo['M']:g}"
                nota = f"{nota}; {extra}" if nota else extra
            cinco = {s: [round(v * f * por_sexo[s], 3) for v in FAMILIAS[fam][s]] for s in ("H", "M")}
            est = {s: con_elite(cinco[s], a_ocho(cinco[s]), False) for s in ("H", "M")}
            salida[i] = est
            for s in ("H", "M"):
                modelos.append(percentiles(cinco[s], est[s]))
            if "mancuerna" in nota:
                por_mancuerna.append(i)
            for s in ("H", "M"):
                celdas = [f"{redondear_kg(v * PESO_EJEMPLO[s]):g} kg" for v in est[s]]
                n = f" · {nota}" if nota else ""
                filas[grupo].append(f"| {e['nombre'] if s == 'H' else ''} | {'H' if s == 'H' else 'M'}{n if s == 'H' else ''} | " + " | ".join(celdas) + " |")
        elif tipo == "corporal" and i in CORPORAL:
            est = {s: con_elite(CORPORAL[i][s], a_ocho(CORPORAL[i][s], entero=True), True) for s in ("H", "M")}
            salida[i] = est
            for s in ("H", "M"):
                modelos.append(percentiles(CORPORAL[i][s], est[s]))
            nota = NOTAS_CORPORAL.get(i, "")
            for s in ("H", "M"):
                n = f" · {nota}" if nota and s == "H" else ""
                filas[grupo].append(f"| {e['nombre'] if s == 'H' else ''} | {s}{n} | " + " | ".join(f"{v} rep" if v == 1 else f"{v} reps" for v in est[s]) + " |")
        else:
            faltan.append(i)
    if faltan:
        raise SystemExit(f"Ejercicios del banco sin propuesta: {faltan}")
    # Cada nivel tiene que pedir algo más que el anterior: con dos cortes iguales, uno de los
    # niveles nunca se vería.
    repetidos = [f"{i} {s}" for i, est in salida.items() for s in ("H", "M")
                 if any(a >= b for a, b in zip(est[s], est[s][1:]))]
    if repetidos:
        raise SystemExit(f"Cortes repetidos o al revés: {repetidos}")
    pegados = [f"{i} {s}" for i, est in salida.items() for s in ("H", "M")
               if PESO.get(i) and any((b - a) / a < SALTO_MIN for a, b in zip(est[s][4:], est[s][5:]))]
    if pegados:
        print(f"Aviso — niveles de arriba con poco salto: {pegados}")

    # El promedio del modelo en todos los ejercicios y los dos sexos: lo que dice la página.
    SUPERA_ENTRENAN = [round(sum(m[0][k] for m in modelos) / len(modelos)) for k in range(len(NIVELES))]
    SUPERA_POBLACION = [round(sum(m[1][k] for m in modelos) / len(modelos)) for k in range(len(NIVELES))]
    (AQUI / "percentiles.json").write_text(json.dumps(
        {"entrenan": SUPERA_ENTRENAN, "poblacion": SUPERA_POBLACION}, indent=2) + "\n")
    print("supera a quienes entrenan:", SUPERA_ENTRENAN)
    print("supera a toda la población:", SUPERA_POBLACION)

    # Lo que carga `functions/scripts/cargarEstandares.mjs` en `ejercicios/{id}`.
    banco_salida = {
        i: {"estandares": est, "pesoPorMancuerna": i in por_mancuerna} for i, est in salida.items()
    }
    (AQUI / "estandares.json").write_text(json.dumps(banco_salida, ensure_ascii=False, indent=2) + "\n")

    nombres_grupo = {"pecho": "Pecho", "cuadriceps": "Cuádriceps", "femoral": "Femoral",
                     "gluteo": "Glúteo", "pantorrilla": "Pantorrilla", "espalda": "Espalda",
                     "trapecio": "Trapecio", "hombro": "Hombro", "biceps": "Bíceps",
                     "antebrazo": "Antebrazo", "triceps": "Tríceps", "abdomen": "Abdomen",
                     "cardio": "Cardio"}
    cab = "| Ejercicio | Sexo | " + " | ".join(NIVELES) + " |\n|---|---|" + "---|" * len(NIVELES)
    md = [
        "# Propuesta de estándares de fuerza — para revisar",
        "",
        "Generado por `proponer.py` (no editar a mano: cambia el script y vuelve a correrlo).",
        "",
        "## Cómo leerla",
        "",
        f"- Los kilos son **un ejemplo** para un hombre de {PESO_EJEMPLO['H']} kg y una mujer de "
        f"{PESO_EJEMPLO['M']} kg. Lo que se guarda es la proporción (1RM ÷ peso corporal), así "
        "que a una clienta de 80 kg le pide un tercio más que a una de 60.",
        "- Los kilos son el **1RM estimado** (el máximo a 1 repetición). La página lo calcula de lo "
        "que registre: por ejemplo 40 kg × 8 reps ≈ 50 kg de 1RM.",
        "- **Mancuernas: el peso de UNA mancuerna.** Hay que decirlo así en Registro.",
        "- Corporales: repeticiones seguidas con el propio cuerpo.",
        "- Máquinas y poleas varían por marca: tómalas como aproximadas o ajústalas a las de tu gym.",
        "",
        "## Las dos comparaciones",
        "",
        "**8 niveles**, con los nombres que eligió el entrenador. Salen de los 5 de las tablas "
        "públicas (en los niveles 1, 3, 5, 7 y 8) más el punto medio entre dos de ellos en los "
        "niveles 2, 4 y 6, donde más se tarda en subir. **Fuerte y Avanzado van más bajos** "
        "que en las tablas, para que la parte de arriba sea alcanzable; **Élite** es el 10 % "
        "más fuerte de quienes entrenan. A las mujeres se les dice *Atlética*.",
        "",
        "Cada corte se compara contra **toda la población** (incluye a la gente que no entrena) "
        "y contra **la gente que sí entrena**. Son los mismos cortes vistos desde dos grupos:",
        "",
        "| Nivel | Supera a toda la población | Supera a quienes entrenan |",
        "|---|---|---|",
        *[f"| {n} | {p} % | {t} % |" for n, p, t in zip(NIVELES, SUPERA_POBLACION, SUPERA_ENTRENAN)],
        "",
        "Los porcentajes salen de un modelo: entre quienes entrenan, la fuerza se reparte como "
        "una curva (mucha gente en el medio, poca en los extremos) ajustada a las tablas "
        "públicas; quien no entrena levanta en promedio lo de Principiante, y 1 de cada 4 "
        "adultos entrena fuerza. Son el promedio de todos los ejercicios: una estimación, no un "
        "censo.",
        "",
        "## Estándares por ejercicio",
    ]
    for g, fs in filas.items():
        md += ["", f"### {nombres_grupo.get(g, g)}", "", cab, *fs]
    (AQUI / "propuesta.md").write_text("\n".join(md) + "\n")
    print(f"{len(salida)} ejercicios con estándar; propuesta.md y estandares.json listos")


if __name__ == "__main__":
    main()
