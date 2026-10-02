package com.osfit.app.video

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

enum class AccionMancu { SALUDAR, APLAUDIR, TIJERAS, BAILAR, MUSCULO, PULGAR, RELOJ,
    ESTIRARSE, VOLTERETA, CORRER_SITIO }

data class CuadroAccion(
    val brazos: Brazos = Brazos.LIBRE,
    val ojos: Ojos = Ojos.NORMAL,
    val boca: Boca = Boca.SONRISA,
    val anguloBrazoIzq: Float = 110f,
    val anguloBrazoDer: Float = 70f,
    val codoIzq: Float = 0f,
    val codoDer: Float = 0f,
    val guanteIzq: Guante = Guante.ABIERTO,
    val guanteDer: Guante = Guante.ABIERTO,
    val reloj: Boolean = false,
    val piernasAbiertas: Float = 0f,
    val fasePaso: Float = -1f,
    val ondeo: Float = 0f,
    val sudor: Boolean = false,
    val confeti: Boolean = false,
    val alturaPx: Float = 0f,
    val rotacion: Float = 0f,
    val escalaY: Float = 1f,
    val impacto: Float = 0f
)

object AccionesMancu {
    private fun seno(tMs: Long, periodo: Long): Float =
        sin(2.0 * PI * MancuAnimacion.fasePaso(tMs, periodo)).toFloat()

    private fun pulso(tMs: Long, periodo: Long): Float =
        (1f - cos(2.0 * PI * MancuAnimacion.fasePaso(tMs, periodo)).toFloat()) / 2f

    fun cuadro(accion: AccionMancu, tMs: Long): CuadroAccion = when (accion) {
        AccionMancu.SALUDAR -> CuadroAccion(brazos = Brazos.HOLA,
            ondeo = MancuAnimacion.ondeoBrazo(tMs))
        AccionMancu.APLAUDIR -> {
            val cierre = pulso(tMs, 450)
            // Dos brazos de 52 y dos guantes de radio 8 cubren los 120 entre hombros.
            CuadroAccion(ojos = Ojos.FELIZ, anguloBrazoIzq = 55f * (1f - cierre),
                anguloBrazoDer = 180f - 55f * (1f - cierre),
                impacto = ((cierre - 0.9f) / 0.1f).coerceIn(0f, 1f))
        }
        AccionMancu.TIJERAS -> {
            val apertura = pulso(tMs, 700)
            // De 60 a 160 grados respecto a la vertical inferior, simétricos en pantalla.
            val anguloIzq = 150f + 100f * apertura
            CuadroAccion(boca = Boca.ABIERTA,
                anguloBrazoIzq = if (anguloIzq > 180f) anguloIzq - 360f else anguloIzq,
                anguloBrazoDer = 30f - 100f * apertura, piernasAbiertas = apertura,
                alturaPx = 30f * apertura)
        }
        AccionMancu.BAILAR -> {
            val fase = MancuAnimacion.fasePaso(tMs, 900)
            val izquierda = fase < 0.5f
            CuadroAccion(ojos = if (fase in 0.4f..0.6f) Ojos.GUINO else Ojos.NORMAL,
                anguloBrazoIzq = if (izquierda) -120f else 70f,
                anguloBrazoDer = if (izquierda) 110f else -60f,
                codoIzq = 0.5f, codoDer = -0.5f, piernasAbiertas = 0.4f,
                fasePaso = fase, rotacion = 10f * seno(tMs, 900))
        }
        AccionMancu.MUSCULO -> CuadroAccion(brazos = Brazos.MUSCULO, ojos = Ojos.FUERZA,
            boca = Boca.DIENTES, guanteIzq = Guante.PUNO, guanteDer = Guante.PUNO,
            escalaY = 1f + 0.06f * pulso(tMs, 600))
        AccionMancu.PULGAR -> CuadroAccion(ojos = Ojos.GUINO, anguloBrazoIzq = 70f,
            anguloBrazoDer = -15f, codoIzq = 0.8f, guanteDer = Guante.PULGAR,
            alturaPx = 5f * pulso(tMs, 700))
        AccionMancu.RELOJ -> {
            val encogimiento = MancuAnimacion.transicion(tMs, 900, 300)
            CuadroAccion(ojos = if (tMs < 900) Ojos.LADO else Ojos.NORMAL,
                boca = if (tMs < 900) Boca.O else Boca.SONRISA,
                anguloBrazoIzq = -140f + 280f * encogimiento,
                anguloBrazoDer = 70f - 30f * encogimiento, codoIzq = -0.7f,
                reloj = true, alturaPx = 4f * encogimiento)
        }
        AccionMancu.ESTIRARSE -> CuadroAccion(boca = Boca.O, anguloBrazoIzq = -100f,
            anguloBrazoDer = -80f, escalaY = 1.08f, rotacion = 8f * seno(tMs, 1800))
        AccionMancu.VOLTERETA -> {
            // El vuelo existente va de 180 a 700 ms; reserva el último ms para 360 exactos.
            val giro = when {
                tMs < 180 || tMs >= 700 -> 0f
                tMs <= 440 -> 180f * (tMs - 180) / 260f
                else -> 180f + 180f * (tMs - 440) / 259f
            }
            CuadroAccion(brazos = Brazos.ORGULLO, ojos = Ojos.FELIZ, boca = Boca.ABIERTA,
                confeti = tMs in 180L..699L, alturaPx = 220f * MancuAnimacion.alturaSalto(tMs),
                rotacion = giro, escalaY = MancuAnimacion.escalaYSalto(tMs))
        }
        AccionMancu.CORRER_SITIO -> {
            val alternancia = seno(tMs, 360)
            CuadroAccion(anguloBrazoIzq = 110f + 45f * alternancia,
                anguloBrazoDer = 70f - 45f * alternancia, codoIzq = 0.8f, codoDer = -0.8f,
                fasePaso = MancuAnimacion.fasePaso(tMs, 360), sudor = true)
        }
    }
}
