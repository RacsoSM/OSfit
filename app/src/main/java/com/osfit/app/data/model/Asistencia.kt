package com.osfit.app.data.model

import com.google.firebase.Timestamp

data class Asistencia(
    val id: String = "",
    val clienteId: String = "",
    val fecha: String = "",
    val asistio: Boolean = false,
    val diaRutinaRealizado: Int? = null,
    val nota: String = "",
    val horaLlegada: Timestamp? = null,
    val horaSalida: Timestamp? = null,
    val duracionMinutos: Int? = null
)
