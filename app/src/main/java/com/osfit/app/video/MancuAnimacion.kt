package com.osfit.app.video

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

object MancuAnimacion {
    fun transicion(tMs: Long, inicioMs: Long, duracionMs: Long): Float {
        require(duracionMs > 0L) { "La duracion de transicion debe ser positiva" }
        val fase = ((tMs - inicioMs) / duracionMs.toFloat()).coerceIn(0f, 1f)
        return fase * fase * (3f - 2f * fase)
    }

    // La elevación breve prepara el esfuerzo; el fondo exacto en 600 sincroniza las letras.
    fun sentadillaAnticipada(tMs: Long): Float {
        val fase = Math.floorMod(tMs, 1200L)
        return when {
            fase < 120L -> -0.15f * transicion(fase, 0L, 120L)
            fase < 600L -> -0.15f + 1.15f * transicion(fase, 120L, 480L)
            else -> 1f - transicion(fase, 600L, 600L)
        }
    }

    fun balanceoTriste(tMs: Long): Float =
        3f * sin(2.0 * PI * Math.floorMod(tMs, 2400L) / 2400.0).toFloat()

    fun popLetra(edadMs: Long): Float {
        if (edadMs < 0L) return 0f
        if (edadMs >= 260L) return 1f
        val fase = if (edadMs <= 150L) edadMs / 150f else (edadMs - 150L) / 110f
        val suave = fase * fase * (3f - 2f * fase)
        return if (edadMs <= 150L) 0.3f + 0.95f * suave else 1.25f - 0.25f * suave
    }

    fun subidaLetra(edadMs: Long): Float {
        val fase = (edadMs / 260f).coerceIn(0f, 1f)
        return -12f * (1f - fase * fase * (3f - 2f * fase))
    }

    // Reducir primero el reloj evita desbordamientos y conserva el periodo con tiempos negativos.
    fun temblorLetra(tMs: Long, indice: Int): Float =
        4f * sin(2.0 * PI * (Math.floorMod(tMs, 300L) / 300.0 + indice * 0.13)).toFloat()

    fun temblorLetraY(tMs: Long, indice: Int): Float =
        3f * sin(2.0 * PI * (Math.floorMod(tMs, 300L) / 300.0 + indice * 0.13)).toFloat()

    /** Primer contacto en 300 ms, un rebote sobre la base y reposo exacto desde 600 ms. */
    fun caidaLetra(edadMs: Long): Float {
        if (edadMs <= 0L) return -220f
        if (edadMs >= 600L) return 0f
        val fase = edadMs / 600f
        return -220f * (1f - fase) * (1f - fase) * abs(cos(PI * fase).toFloat())
    }

    // Canvas crece hacia abajo: el rebote negativo sube el cuerpo y debe estirarlo.
    fun respiracionEscalaY(tMs: Long): Float = 1f - 0.035f * reboteY(tMs)

    fun ondeoBrazo(tMs: Long): Float =
        20f * sin(2.0 * PI * Math.floorMod(tMs, 400L) / 400.0).toFloat()

    fun alturaSalto(tMs: Long): Float {
        if (tMs <= 180L || tMs >= 700L) return 0f
        val fase = (tMs - 180L) / 520f
        return 4f * fase * (1f - fase)
    }

    fun escalaYSalto(tMs: Long): Float {
        if (tMs < 0L || tMs > 900L) return 1f
        // Los cambios al despegar y tocar el piso son impactos deliberados entre fases.
        if (tMs < 180L) {
            val fase = tMs / 180f
            return 1f - 0.22f * fase * fase * (3f - 2f * fase)
        }
        if (tMs < 700L) return 1.12f
        val fase = (tMs - 700L) / 200f
        return 0.82f + 0.18f * fase * fase * (3f - 2f * fase)
    }

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

    fun viajeDesplazamiento(a: Float): Float {
        val alpha = a.coerceIn(0f, 1f)
        if (alpha < 0.5f) {
            val sprint = ((alpha * 2f - 0.3f) / 0.7f).coerceIn(0f, 1f)
            return 1.3f * sprint * sprint
        }
        val restante = 1f - (alpha - 0.5f) * 2f
        return -1.3f * restante * restante * restante
    }

    fun viajeInclinacion(a: Float): Float {
        val alpha = a.coerceIn(0f, 1f)
        val s = alpha * 2f
        return if (alpha < 0.5f) {
            if (s < 0.3f) -8f * s / 0.3f else 12f
        } else 10f * (1f - (alpha - 0.5f) * 2f)
    }

    fun viajeEscalaY(a: Float): Float {
        val alpha = a.coerceIn(0f, 1f)
        if (alpha < 0.5f) {
            val s = alpha * 2f
            return if (s < 0.3f) 1f - 0.18f * s / 0.3f else 1f / 1.2f
        }
        val llegada = (alpha - 0.5f) * 2f
        // La frenada empieza en 0.85 y recupera el volumen al asentarse.
        return if (llegada < 0.85f) 1f else
            0.85f + 0.15f * ((llegada - 0.85f) / 0.15f).coerceIn(0f, 1f)
    }

    fun viajeCorriendo(a: Float): Boolean = a >= 0.15f && a < 0.925f

    fun fasePaso(tMs: Long, periodoMs: Long): Float {
        require(periodoMs > 0L) { "El periodo de paso debe ser positivo" }
        return Math.floorMod(tMs, periodoMs).toFloat() / periodoMs.toFloat()
    }
}
