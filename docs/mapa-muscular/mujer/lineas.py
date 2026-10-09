# Líneas blancas internas de la mujer, medidas sobre referencia.png (eje del mapa de crestas),
# en píxeles de la foto. Las del muslo, la pantorrilla y la ingle se ajustaron después a curvas
# suaves (polinomios por longitud de arco, ver alisar.py) respetando sus puntos de unión: los
# puntos medidos traían 1-2 px de ruido que se veía como pulso tembloroso. Solo la mitad izquierda del dibujo (lado derecho de la persona); el eje
# está en x = 198 y el otro lado se obtiene reflejando. Mismo sistema que ../lineas.py (hombre):
# curvas suaves por estos puntos; cuando una línea nace de otra comparte el punto exacto, y los
# extremos que tocan el borde de su músculo se alargan un poco porque el recorte los deja justo
# en el borde.
EJE = 198.0

# --- Abdomen -----------------------------------------------------------------------------
R1, R2, R3 = (161.0, 370.8), (162.5, 400.5), (163.0, 430.5)    # cruces del recto con las horizontales
ABD_RECTO = [(159.8, 344), (159.8, 352.5), (159.9, 360), (160.3, 366.5), R1, (161.4, 385), R2,
             (162.8, 415), R3, (163.3, 445), (163.8, 460), (164.6, 475), (165.8, 488), (167.0, 498),
             (167.6, 503), (168.2, 508)]
ABD_H1 = [R1, (164.8, 370.0), (168.2, 368.0), (171.8, 365.6), (175.2, 363.6), (178.8, 362.4),
          (182.2, 361.2), (185.8, 359.9), (189.2, 358.9), (192.8, 358.3), (EJE, 358.2)]
ABD_H2 = [R2, (166.8, 400.0), (170.2, 398.1), (173.8, 396.8), (177.2, 395.3), (180.8, 394.0),
          (184.2, 393.0), (187.8, 392.0), (191.2, 391.0), (194.8, 390.6), (EJE, 390.5)]
ABD_H3 = [R3, (166.8, 430.0), (170.2, 429.2), (173.8, 428.3), (177.2, 427.5), (180.8, 426.8),
          (184.2, 426.2), (187.8, 425.3), (191.2, 424.9), (194.8, 424.9), (EJE, 425.0)]
ABD_CENTRO = [(EJE, 334), (EJE, 358.2), (EJE, 390.5), (EJE, 425.0), (EJE, 441)]   # acaba bajo la H3

# --- Muslo -------------------------------------------------------------------------------
M_F = (160.4, 588.4)          # bifurcación de la línea central
M_P = (141.6, 669.3)          # donde se juntan la exterior (A) y la rama izquierda
M_V = (130.5, 457.0)          # vértice de la cadera: de aquí salen la ingle, A y B
MUSLO_A = [M_V, (125.8, 492.9), (120.5, 528.6), (117.4, 564.8), (118.8, 601.2), (126.4, 636.7), M_P]
MUSLO_B = [M_V, (137.2, 478.5), (143.1, 500.2), (148.3, 522), (152.9, 544), (156.9, 566.2), M_F]
MUSLO_C_IZQ = [M_F, (155.9, 601.5), (152.4, 614.9), (149.6, 628.5), (147.1, 642.1), (144.6, 655.8), M_P]
MUSLO_C_DER = [M_F, (166.5, 600.2), (170, 613.2), (172.3, 626.8), (174.6, 640.5), (178.3, 653.5), (184.5, 665.5)]   # acaba en el borde interno
MUSLO_ABAJO = [M_P, (142.3, 673.9), (142.9, 678.5), (143.4, 683.1), (143.8, 687.7), (144.1, 692.4), (144.3, 697)]   # hasta la muesca de abajo
# Borde de abajo del muslo (donde acaba el lila, medido columna a columna): dos lóbulos redondos
# con la muesca de la línea de abajo entre ellos. Lo que queda por debajo es rodilla (blanco).
MUSLO_FONDO = [(110, 674), (113, 680.5), (116, 688.2), (119, 692.8), (122, 696.4), (125, 700.9),
               (128, 703.2), (131, 702.4), (134, 700.5), (137, 697.8), (140, 691.1), (141.6, 687),
               (143, 684), (144.6, 685.5), (146, 688.5), (149, 698.5), (152, 702.4), (155, 704.4),
               (158, 705.9), (161, 706.6), (164, 707.4), (167, 707.5), (170, 706.2), (173, 700),
               (176, 691), (179, 684.6), (182, 677), (186, 668)]

# --- Fronteras entre músculos vecinos (centro de la línea blanca, medido en la foto) ----------
# (arriba, abajo, puntos): lo de arriba de la curva es del primero y lo de abajo del segundo, así
# que la separación sigue la curva exactamente. Son también límites duros para lo trazado.
FRONTERAS = [
    # borde de arriba del pecho, contra el gris del cuello: del hombro hasta el esternón, donde
    # se juntan con la V del cuello y empieza la costura (una "Y", como en la segunda imagen)
    ('gris-cuello', 'pecho', [(136, 239.5), (141, 239.5), (150, 240), (160, 241.5), (166, 243.3),
                              (172, 245.6), (178, 248.2), (184, 250.8), (190, 252.6), (194, 253.3),
                              (198, 253.5)]),
    ('pecho', 'abdomen', [(128, 339.6), (134, 343.0), (140, 345.2), (146, 346.5), (152, 346.9),
                          (158, 346.4), (164, 345.3), (170, 343.5), (176, 341.3), (182, 338.7),
                          (188, 335.9), (194, 332.8), (198, 330.8)]),
    # ingle: del vértice de la cadera hasta la entrepierna, pasando por el final del recto
    ('abdomen', 'cuadriceps', [(127, 449.5), (136.6, 463.4), (146.5, 477.1), (156.9, 490.4), (167.6, 503.4), (173.4, 517.5), (179, 531.6), (184.6, 545.8), (190, 560)]),
]
# Costuras sobre el eje entre las dos mitades de un músculo (grupo, desde y, hasta y): en ese
# tramo cada mitad llega hasta el centro y la costura queda del mismo ancho que las demás
# separaciones, sin las esquinas redondeadas del trazado.
COSTURAS = [('pecho', 252, 334)]

# La parte alta del muslo, junto a la cadera, es casi blanca en la foto y el trazado la pierde;
# este polígono la completa hasta el vértice de la cadera (lo que cae fuera de la silueta o al
# otro lado de la ingle se recorta solo).
MUSLO_PARCHES = [[(108, 494), (108, 470), (121, 452), (128, 447), (138, 463), (148, 477), (157, 494)]]

# --- Pantorrilla: eje de la separación entre sus dos cabezas (donde el lila baja, medido fila a
# fila). No se dibuja: las dos cabezas se separan a lo largo de él.
PANTORRILLA = [(144.5, 780), (145.5, 802.9), (146.8, 825.8), (148.4, 848.6), (150.4, 871.4), (152.7, 894.2), (155.4, 917)]
PANT_ARMONICOS = 7   # armónicos con que se rehace cada cabeza (más = más fiel, menos = más liso)
# Borde de abajo de la pantorrilla (donde acaba el lila): las dos puntas, con la muesca de la
# línea entre ellas. Lo de abajo es blanco hasta el tobillo.
PANT_FONDO = [(128, 852), (132, 865.9), (134, 872.2), (136, 881.5), (138, 888.1), (140, 893.2),
              (142, 900.8), (144, 908.5), (146, 912.4), (148, 914.0), (150, 914.6), (152, 914.6),
              (153.6, 913.4), (155.2, 911.8), (156.8, 915), (158, 921), (160, 926.4), (162, 927.8),
              (164, 928.8), (166, 929.2), (168, 929.5), (170, 925), (172, 911.2), (174, 888), (176, 866)]

LINEAS = {
    'abdomen': [ABD_RECTO, ABD_H1, ABD_H2, ABD_H3],
    'cuadriceps': [MUSLO_A, MUSLO_B, MUSLO_C_IZQ, MUSLO_C_DER, MUSLO_ABAJO],
}
LINEAS_EJE = {'abdomen': [ABD_CENTRO]}
# Tramos (línea, 'inicio' o 'fin', largo en px) que se dibujan sin recorte: donde una línea nace
# justo en el borde de su músculo, el borde del relleno y el del recorte coinciden y el antialias
# deja un hilo de color.
TRAMOS_LIBRES = [('MUSLO_A', 'inicio', 14), ('MUSLO_B', 'inicio', 14), ('MUSLO_ABAJO', 'fin', 18)]

# --- Partes grises -----------------------------------------------------------------------
# Cuello: la V del esternocleidomastoideo, de debajo de la oreja al centro, sobre el esternón.
CUELLO_V = [(169.8, 200), (171.8, 206), (174.5, 212), (177.0, 219), (179.5, 226), (182.0, 233),
            (184.6, 238.4), (188.2, 243.2), (192.4, 247.4), (EJE, 251.5)]
# Tobillo: empieza recto a esta altura (debajo es gris) y lleva una línea blanca hasta el pie.
TOBILLO_ARRIBA = 951.5
TOBILLO = [(132, 976.2), (145, 975.2), (155, 975.0), (165, 975.6), (175, 976.5), (188, 977.8)]
LINEAS_GRIS = {'gris-cuello': [CUELLO_V], 'gris-pies': [TOBILLO]}
