package com.osfit.app.data.model

/**
 * Configuración de video de un periodo. Se guarda en `configVideo/{rangoInicio}`, donde
 * [rangoInicio] es la fecha ISO de inicio de la quincena — el mismo identificador de periodo
 * que ya usan MedallaOtorgada y LogroPersonalOtorgado.
 *
 * Sólo se guarda el id del preset, no sus colores: los presets viven en el código
 * (ver Paletas), así que ajustar un color se hace una vez y aplica a todos los periodos
 * que lo usan.
 */
data class ConfigVideoPeriodo(
    val rangoInicio: String = "",
    val paletaId: String = ""
)
