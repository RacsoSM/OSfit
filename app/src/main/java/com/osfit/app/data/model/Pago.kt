package com.osfit.app.data.model

import com.google.firebase.Timestamp

data class Pago(
    val id: String = "",
    val monto: Double = 0.0,
    val fecha: Timestamp = Timestamp.now(),
    val fechaProximoPagoGenerada: Timestamp = Timestamp.now(),
    val nota: String = ""
)
