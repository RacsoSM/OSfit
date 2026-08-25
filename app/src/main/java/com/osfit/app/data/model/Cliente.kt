package com.osfit.app.data.model

import com.google.firebase.Timestamp

data class Cliente(
    val id: String = "",
    val nombre: String = "",
    val telefono: String = "",
    val activo: Boolean = true,
    val rutinaAsignada: Rutina? = null,
    val plantillaOrigenId: String = "",
    val diaActualIndex: Int = 0,
    val diaPendienteIndex: Int? = null,
    val diaPendienteFecha: String? = null,
    val fechaProximoPago: Timestamp? = null,
    val fechaIngreso: Timestamp? = null,
    val ejercicioFavoritoPorDia: Map<String, String> = emptyMap(),
    val diaFavoritoIndex: Int? = null,
    val peso: Double? = null,
    val altura: Double? = null,
    val edad: Int? = null
)
