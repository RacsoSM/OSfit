package com.osfit.app.data.model

import com.google.firebase.Timestamp

data class RecordPersonal(
    val id: String = "",
    val clienteId: String = "",
    val ejercicio: String = "",
    val marca: String = "",
    val fecha: Timestamp = Timestamp.now()
)
