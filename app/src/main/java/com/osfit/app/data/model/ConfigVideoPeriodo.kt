package com.osfit.app.data.model

/**
 * Configuración de video de un periodo. Se guarda en `configVideo/{rangoInicio}`, donde
 * [rangoInicio] es la fecha ISO de inicio de la quincena — el mismo identificador de periodo
 * que ya usan MedallaOtorgada y LogroPersonalOtorgado.
 *
 * Sólo se guardan los ids de paleta y estilo: sus definiciones viven en el código.
 */
data class ConfigVideoPeriodo(
    val rangoInicio: String = "",
    val paletaId: String = "",
    // Los documentos anteriores no tienen estilo; vacío se resuelve como blobs sin migración.
    val estiloId: String = ""
)
