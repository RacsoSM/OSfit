package com.osfit.app.domain

/**
 * Calcula cuánto tiempo pasó un cliente en el gym a partir de cuándo llegó y se fue.
 */
object TiempoGymCalculator {

    const val TOPE_MINUTOS = 180

    fun calcularDuracionMinutos(inicioMillis: Long, finMillis: Long, topeMinutos: Int = TOPE_MINUTOS): Int {
        val minutos = (finMillis - inicioMillis) / 60_000
        return minutos.coerceIn(0, topeMinutos.toLong()).toInt()
    }
}
