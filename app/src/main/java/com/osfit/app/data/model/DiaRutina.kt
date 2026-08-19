package com.osfit.app.data.model

data class DiaRutina(
    val nombreDia: String = "",
    val ejercicios: List<Ejercicio> = emptyList()
)
