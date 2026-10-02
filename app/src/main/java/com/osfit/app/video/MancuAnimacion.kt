package com.osfit.app.video

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

object MancuAnimacion {
    fun progresoNube(alphaEntrante: Float): Float {
        val alpha = alphaEntrante.coerceIn(0f, 1f)
        val subida = 1f - abs(2f * alpha - 1f)
        return subida * subida * (3f - 2f * subida)
    }

    fun escenaVisibleEsEntrante(alphaEntrante: Float): Boolean = alphaEntrante >= 0.5f

    /** Seno en [-1, 1], periodo 1400 ms y origen en cero; admite tiempos negativos. */
    fun reboteY(tMs: Long): Float = sin(2.0 * PI * Math.floorMod(tMs, 1400L) / 1400.0).toFloat()

    /** Ciclo 3600 ms: abierto hasta 3312, cierre lineal a 0.1 en 3420, abierto en 3528. */
    fun factorParpadeo(tMs: Long): Float {
        val fase = Math.floorMod(tMs, 3600L)
        if (fase <= 3312L || fase >= 3528L) return 1f
        return 0.1f + 0.9f * abs(fase - 3420L).toFloat() / 108f
    }

    /**
     * Altura normalizada en [0, 1]: parte en 1, cae hasta 0 en 450 ms, rebota una vez
     * y se asienta en 0 exacto desde 900 ms. Antes de entrar conserva la altura inicial.
     * El valor absoluto mantiene la oscilación amortiguada sobre el piso.
     */
    fun saltoEntrada(elapsedMs: Long): Float {
        if (elapsedMs <= 0L) return 1f
        if (elapsedMs >= 900L) return 0f
        val q = elapsedMs / 900f
        return (1f - q) * (1f - q) * abs(cos(PI * q).toFloat())
    }

    /**
     * Escalas positivas con x*y=1: x parte en 1.22, oscila un ciclo amortiguado
     * y desde 700 ms ambas valen 1. Antes del golpe conserva el aplastamiento inicial.
     * Devuelve un Pair para el consumidor de escenas; el dibujo por frame no lo utiliza.
     */
    fun squash(elapsedMs: Long): Pair<Float, Float> {
        val q = (elapsedMs / 700f).coerceIn(0f, 1f)
        val x = 1f + 0.22f * (1f - q) * (1f - q) * cos(2.0 * PI * q).toFloat()
        return x to 1f / x
    }
}
