package com.osfit.app.video

enum class Brazos { HOLA, ORGULLO, ESFUERZO, SENALA, ABAJO, LIBRE, MUSCULO }
enum class Ojos { NORMAL, FELIZ, FUERZA, LADO, TRISTE, GUINO }
enum class Guante { ABIERTO, PUNO, PULGAR }
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
    val fasePaso: Float = -1f,
    val anguloBrazoIzq: Float = 110f,
    val anguloBrazoDer: Float = 70f,
    val codoIzq: Float = 0f,
    val codoDer: Float = 0f,
    val guanteIzq: Guante = Guante.ABIERTO,
    val guanteDer: Guante = Guante.ABIERTO,
    val reloj: Boolean = false,
    val piernasAbiertas: Float = 0f,
    val impacto: Float = 0f
)
