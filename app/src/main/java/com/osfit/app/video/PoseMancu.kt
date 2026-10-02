package com.osfit.app.video

enum class Brazos { HOLA, ORGULLO, ESFUERZO }
enum class Ojos { NORMAL, FELIZ, FUERZA, LADO }
enum class Boca { SONRISA, ABIERTA, DIENTES, O }

data class PoseMancu(
    val brazos: Brazos,
    val ojos: Ojos,
    val boca: Boca,
    val salto: Boolean = false,
    val sudor: Boolean = false,
    val confeti: Boolean = false
)
