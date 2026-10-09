# Retoques medidos sobre la referencia (espalda del hombre), en píxeles de la imagen VOLTEADA
# (ver mascaras.py), solo la mitad izquierda (lado derecho de la persona); el eje está en
# x = 270.5 y el otro lado se obtiene reflejando.
EJE = 270.5
LINEAS = {}          # grupo -> líneas internas (se recortan con la forma del músculo)
FRONTERAS = []       # (arriba, abajo, puntos): frontera medida entre dos músculos vecinos

# --- Mano: en la referencia es un dibujo de líneas (los huecos oscuros de los dedos miden 1-2 px,
# no se pueden calcar). Se hace como la mano de frente: la silueta en gris con contorno fino y,
# encima, las líneas de dentro como trazos lisos de grosor fijo, medidas sobre el mapa de crestas.
# Los extremos que quedan cerca del contorno se alargan solos hasta tocarlo.
MANO_ZONA = (389, 112)          # la mano es lo que queda por debajo de y y a la izquierda de x
MANO_CONTORNO = 2.6
MANO_LINEA = 2.2
MANO_LINEAS = [
    [(62.5, 391.5), (65.5, 399), (67.5, 407), (66.5, 416), (63.5, 426), (61.5, 437), (61.5, 448),
     (62.5, 458), (64.5, 466), (66.5, 471)],                                # meñique-anular / medio
    [(79, 393.5), (77, 401), (76, 411), (75.5, 421), (75.5, 430), (75.5, 441), (75.8, 452),
     (76.5, 461), (77.5, 468)],                                             # medio / índice
    [(75.7, 424), (79, 425.5), (83, 425.2), (86.5, 422), (90, 418)],       # base del pulgar
]

# --- La "T" blanca del cuello (arranque de la columna): media anchura por altura, medida en la
# foto (donde el blanco cruza a la mitad hacia el negro). En la foto está 2 px a la izquierda del
# eje del cuerpo; aquí se dibuja centrada. Abajo se estrecha hasta el ancho de la columna.
CUELLO_T = [(97, 8.8), (104, 8.7), (112, 8.5), (120, 8.7), (123, 9.4), (126, 10.4), (128, 11.0),
            (130, 11.4), (132, 11.2), (134, 9.8), (136, 8.1), (138, 6.3), (140, 4.9), (142, 3.7),
            (145, 2.5), (149, 1.7)]

PANT_ARMONICOS = 10  # armónicos con que se rehace cada cabeza de la pantorrilla (menos = más liso)
