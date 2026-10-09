# Retoques medidos sobre la referencia (espalda de la mujer), en píxeles de la imagen VOLTEADA
# (ver cargar.py), solo la mitad izquierda; el eje está en x = 175.5 y el otro lado se refleja.
EJE = 175.5
LINEAS = {}          # grupo -> líneas internas (se recortan con la forma del músculo)
FRONTERAS = []       # (arriba, abajo, puntos): frontera medida entre dos músculos vecinos
GLUTEO_ARMONICOS = 8   # armónicos con que se rehace el glúteo (menos = más liso)
MARGEN_FONDO = 11      # px de la foto: blanco entre una pieza y el fondo que se rellena (es brillo del contorno)
# Línea del pelo: separa la coleta (que cae del lado derecho de la imagen volteada) del resto de la
# cabeza. Va sin reflejar, recortada con la forma de la cabeza.
LINEAS_SIN_REFLEJO = {'gris-cabeza': [[(189.5, 50), (194.5, 63), (196.4, 78), (196.6, 94), (195.6, 108),
                                       (192.6, 121), (188, 132.5), (182, 143.5), (175, 153.5), (168, 163)]]}
CUELLO_HUECO = 16     # px de la foto: blanco entre cuello y cabeza que el trapecio rellena
# Huso blanco en lo alto de la columna: media anchura por altura, medida en la foto (donde el
# blanco cruza a 200 de luminosidad). En la foto está 2 px corrido del eje; aquí va centrado. Fuera
# de estas alturas la columna tiene el ancho de las demás separaciones.
COLUMNA_HUSO = [(194, 1.5), (198, 3.0), (202, 4.6), (206, 5.9), (210, 6.1), (214, 5.2), (218, 4.4),
                (222, 3.8), (226, 3.4), (230, 2.9), (234, 2.5), (238, 2.1), (244, 1.6)]
PIERNA_ARMONICOS = 12  # armónicos con que se rehace el pie (menos = más liso)
PANT_ARMONICOS = 8      # ídem para las pantorrillas
GLUTEO_CRECER_HASTA = 455  # el glúteo crece hasta tocar el contorno por encima de esta altura (más abajo se abre la cadera)
GLUTEO_SEGUIR = 16         # px de la foto: hueco bajo el glúteo que rellenan el isquiotibial y la franja del muslo
# Mano: la línea que separa el pulgar de la palma (de la muñeca al hueco del pulgar, medida en la
# foto) y una por el medio de los dedos, que en la foto van juntos, para que se lean como en las
# otras manos. Se dibujan más finas que las demás (MANO_LINEA) y recortadas con la silueta.
MANO_LINEA = 2.2
LINEAS_GRIS = {'gris-mano': [
    [(64.7, 448.6), (64.8, 452), (64.6, 459), (63.6, 465), (61.4, 469.5), (59.9, 473.5), (59.2, 478), (58.4, 482), (57.4, 488)],
    [(47.6, 476), (47.4, 486), (48, 495), (49.6, 503), (51.6, 510), (53, 514)],
]}
# Separaciones más finas (unidades SVG) entre estos pares de grupos: hombro y omóplato, e
# isquiotibial con sus vecinos.
SEPARACION_FINA = 2.0
PARES_FINOS = [('hombro', 'trapecio'), ('hombro', 'infraespinoso'), ('hombro', 'triceps'),
               ('infraespinoso', 'trapecio'), ('infraespinoso', 'dorsal'), ('infraespinoso', 'triceps'),
               ('trapecio', 'dorsal'),
               ('isquiotibiales', 'cuadriceps'), ('isquiotibiales', 'gluteo'), ('isquiotibiales', 'pantorrilla')]
