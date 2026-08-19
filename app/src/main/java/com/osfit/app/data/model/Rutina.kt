package com.osfit.app.data.model

data class Rutina(
    val id: String = "",
    val nombre: String = "",
    val dias: List<DiaRutina> = emptyList()
)
