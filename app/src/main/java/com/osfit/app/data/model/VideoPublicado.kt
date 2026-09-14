package com.osfit.app.data.model

import com.google.firebase.Timestamp

/** Video publicado en la web, en `clientes/{clienteId}/videos`. */
data class VideoPublicado(
    val id: String = "",
    val rangoInicio: String = "",      // ISO del inicio de la quincena; ordena el listado
    val encabezadoRango: String = "",  // "2da quincena de agosto"
    val rutaStorage: String = "",      // resumenes/<clienteId>/<rangoInicio>.mp4
    val duracionSegundos: Int = 0,
    val creado: Timestamp = Timestamp.now()
)
