package com.osfit.app.video

enum class Brazos { HOLA, ORGULLO, ESFUERZO, SENALA, ABAJO }
enum class Ojos { NORMAL, FELIZ, FUERZA, LADO, TRISTE }
enum class Boca { SONRISA, ABIERTA, DIENTES, O, TRISTE }

data class PoseMancu(
    val brazos: Brazos,
    val ojos: Ojos,
    val boca: Boca,
    val salto: Boolean = false,
    val sudor: Boolean = false,
    val confeti: Boolean = false,
    val anguloSenala: Float = 0f,
    val ondeo: Float = 0f,
    val fasePaso: Float = -1f
)
