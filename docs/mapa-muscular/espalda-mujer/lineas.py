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
