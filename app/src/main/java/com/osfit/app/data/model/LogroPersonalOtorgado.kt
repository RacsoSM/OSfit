package com.osfit.app.data.model

/**
 * Un logro personal ya otorgado a un cliente en un período.
 *
 * A diferencia de [MedallaOtorgada], que usa `rangoInicio` como id de documento y por eso
 * admite exactamente uno por quincena, acá el id es compuesto ("<rangoInicio>_<logroId>"):
 * permite varios logros en la misma quincena, e impide duplicar el mismo logro dentro de ella.
 */
data class LogroPersonalOtorgado(
    val id: String = "",              // doc id: "<rangoInicio>_<logroId>"
    val rangoInicio: String = "",     // ISO date del inicio de la quincena
    val logroId: String = "",         // referencia a LogroPersonalCatalogo.id
    // Copias del catálogo al momento de otorgarlo: si el catálogo se edita después, el
    // historial no cambia retroactivamente (mismo criterio que MedallaOtorgada).
    val nombreLogro: String = "",
    val mensaje: String = "",
    // También la insignia: si el entrenador le cambia el dibujo al logro, el que ya se ganó
    // tiene que seguir viéndose como se veía. null = la web dibuja la genérica.
    val imagenUrl: String? = null,
    val encabezadoRango: String = "", // "2da quincena de agosto"
    // Orden de selección del entrenador; define el orden en el video y en qué grupo de 3 cae.
    val orden: Int = 0
)
