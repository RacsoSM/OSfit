package com.osfit.app.data.model

data class Asistencia(
    val id: String = "",
    val clienteId: String = "",
    val fecha: String = "",
    val asistio: Boolean = false,
    val diaRutinaRealizado: Int? = null,
    val nota: String = "",
    val duracionMinutos: Int? = null
)
