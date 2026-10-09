# Líneas blancas internas y formas dibujadas a mano, medidas sobre referencia.png.
# Coordenadas en píxeles de la foto, solo la mitad izquierda del dibujo (lado derecho de la
# persona); el eje está en x = 200.5 y el otro lado se obtiene reflejando.
#
# Cada línea es una lista de puntos por los que pasa una curva suave (Catmull-Rom). Cuando una
# línea nace de otra, su primer punto es EXACTAMENTE un vértice de la otra, así que siempre
# conectan. Las líneas se recortan con la forma de su músculo (clipPath), por eso los extremos
# que tocan el borde se alargan un poco hacia fuera: el recorte los deja justo en el borde.

EJE = 200.5

# --- Pecho -------------------------------------------------------------------------------
PECHO_COSTURA = [(EJE, 185), (EJE, 270)]                     # división central (en el eje)
PECHO_CURVA = [(EJE, 205), (190, 206), (180, 208.5), (170, 212), (160, 216.5),
               (150, 221.5), (140, 227.5), (132, 233), (124, 239), (118, 244)]

# --- Abdomen -----------------------------------------------------------------------------
R1, R2, R3 = (163.2, 291), (163.2, 318), (166, 346)          # cruces del recto con las horizontales
ABD_RECTO = [(165.5, 250), (164.2, 266), (163.4, 278), R1, (163, 304), R2, (163.6, 333), R3]
ABD_V = [R3, (170.5, 361), (175.5, 377), (180.5, 394), (184.5, 409), (187.6, 421), (189, 427)]
ABD_H1 = [R1, (170, 288.2), (177, 284.2), (184, 281), (191.5, 279), (EJE, 278.2)]
ABD_H2 = [R2, (170, 316), (178, 313.4), (188, 311.2), (EJE, 310.2)]
ABD_H3 = [R3, (175, 345), (184, 342.8), (190.5, 340.2), (196, 337), (EJE, 335.4)]
ABD_CENTRO = [(EJE, 236), (EJE, 278.2), (EJE, 310.2), (EJE, 335.4)]   # termina en la H3

# --- Muslo (cuádriceps) -------------------------------------------------------------------
M_J = (168.6, 482)                                              # donde nace la diagonal
M_P = (137.8, 551)                                              # donde se juntan exterior y diagonal
M_J1 = (135, 410)                                               # donde nace A, en el borde exterior
M_T = (176.3, 535.5)                                            # punta de la sección interna
MUSLO_TOPE = 395.5   # sobre esta altura, a la izquierda de B no hay músculo (es contorno)
MUSLO_B = [(146.2, 385), (146.7, 389), (147.6, 394), (148.8, 399), (150.5, 404), (152, 411), (154.7, 419),
           (157, 428), (161.5, 445), (165.5, 465),
           M_J, (170.2, 490), (171.6, 498), (172.5, 505), (173.1, 515), (173.6, 524),
           (174.4, 530.5), M_T]
# La foto es tan borrosa aquí que el trazado pierde la punta de la sección interna y estrecha
# el lóbulo central; estos polígonos (borde del color, medido en la foto) lo completan.
MUSLO_PARCHES = [
    [(169.2, 483), (170.2, 490), (171.6, 498), (172.5, 505), (173.1, 515), (173.6, 524),
     (174.4, 530.5), M_T, (177.4, 531), (178.6, 526), (180, 518), (181.25, 510), (183.5, 500),
     (185.75, 490), (187.4, 480)],
    [M_T, (174.3, 543), (173.5, 551), (172.3, 559), (170, 570), (165, 570), (165, 530)],
    # punta de la franja exterior (entre el contorno y la línea A)
    [(134.5, 411.5), (135.3, 416.5), (133.8, 423), (131.8, 429), (129.6, 440), (120, 442),
     (123, 433), (127, 423.8), (130.3, 417.5), (133, 413)],
    # punta superior de la sección central (de la punta a J1); llega hasta debajo de B
    [(144, 396.5), (142, 399), (138.5, 404), (136.3, 410.5), (140, 413), (150, 405), (149.5, 398),
     (147, 395.5)],
]
MUSLO_A = [(136.5, 404), M_J1, (135.3, 416.5), (133.8, 423), (131.8, 429), (129.6, 440), (127.6, 452),
           (125.9, 465), (125.3, 485),
           (126, 505), (128, 525), (132, 541), M_P]
MUSLO_C = [M_J, (159, 494), (151.2, 509), (145, 525), (140.5, 540), M_P, (136.5, 566), (135.5, 585)]

# --- Antebrazo ---------------------------------------------------------------------------
ANTEBRAZO = [(87, 308), (85, 317), (82, 330), (78, 342.5), (72.8, 355.5), (66.3, 369),
             (59.5, 381), (52, 393), (46, 402)]

LINEAS = {
    'pecho': [PECHO_CURVA],
    'abdomen': [ABD_RECTO, ABD_V, ABD_H1, ABD_H2, ABD_H3],
    'cuadriceps': [MUSLO_B, MUSLO_A, MUSLO_C],
    'antebrazo': [ANTEBRAZO],
}
# Tramos que van pegados al borde de su músculo: se dibujan sin recorte para tapar ese borde
# (si coincidieran el borde del relleno y el del recorte, el antialias dejaría un hilo de color).
LINEAS_LIBRES = [[(146.6, 387.8), (146.7, 389), (147.6, 394), (148.8, 399), (150.5, 404)]]
# Líneas que caen sobre el eje: se dibujan una sola vez, sin reflejo.
LINEAS_EJE = {'pecho': [PECHO_COSTURA], 'abdomen': [ABD_CENTRO]}

# --- Fronteras entre músculos vecinos ------------------------------------------------------
# Curvas medidas en la foto por donde pasa la separación blanca. (primero, segundo, puntos): en
# una franja alrededor de la curva, lo que queda arriba (o a la izquierda, en FRONTERAS_V) es
# del primer músculo y lo de abajo (o a la derecha) del segundo, así que la separación sigue la
# curva exactamente. La franja nunca toma píxeles de un tercer músculo.
FRONTERAS_V = [
    ('biceps', 'abdomen', [(125.3, 241), (125.2, 248), (125.3, 256), (125.6, 265), (126.2, 274),
                           (127, 280)]),
]
FRONTERAS = [
    ('pecho', 'abdomen', [(126, 240.5), (130, 243.3), (140, 250), (150, 256.7), (160, 264.4),
                          (165, 265.6), (170, 263.3), (175.5, 257.8), (180, 254.4),
                          (186.7, 251.7), (193.3, 248.9), (EJE, 247.2)]),
    ('abdomen', 'cuadriceps', [(147, 386.4), (150.7, 387), (160.7, 392), (167.9, 397),
                               (175, 404.3), (180.7, 410), (185, 417), (187.9, 423),
                               (192, 434), (195, 441)]),
]

# --- Trapecio: banda triangular entre el contorno, el cuello y el pecho --------------------
TRAPECIO = [(143.8, 174.2), (147.8, 169.4), (153.4, 164.8), (158.8, 161.2), (163.8, 158.2),
            (168.4, 156.1), (171.8, 155.6), (173, 158.5), (173.1, 166.5), (172.9, 173.8),
            (171.2, 175.6), (160, 175.6), (150, 175.9), (145.5, 176)]
