package com.osfit.app.paletas

/**
 * Cómo una [Paleta] se convierte en lo que la web lee.
 *
 * Se guardan los hex ya resueltos y no sólo el id porque el catálogo existe únicamente en
 * Kotlin: la web recibe colores y los aplica, sin una copia de la lista que se pueda
 * desincronizar. El id viaja igual, para marcar cuál está seleccionada en la app y para poder
 * reasignar en masa si algún día se rehacen los colores de un preset.
 */

/** `#RRGGBB`, en mayúsculas y con los seis dígitos siempre: sin el ancho fijo, un color como
 *  0xFF04162B saldría "#4162B" y la web lo descartaría por no ser un hex válido. El alfa se
 *  descarta porque estos colores se pintan sobre superficies opacas. */
fun aHexWeb(color: Int): String = "#%06X".format(color and 0xFFFFFF)

fun camposFirestore(paleta: Paleta): Map<String, Any> = mapOf(
    "id" to paleta.id,
    "primario" to aHexWeb(paleta.webPrimario),
    "primarioOscuro" to aHexWeb(paleta.webPrimarioOscuro),
    "primarioClaro" to aHexWeb(paleta.webPrimarioClaro),
    "sobrePrimario" to aHexWeb(paleta.webSobrePrimario)
)
