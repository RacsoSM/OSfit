package com.osfit.app.video

import kotlin.math.pow

internal object ColorMancu {
    /**
     * Luminancia relativa sRGB linealizada. El umbral 0.1 separa tinta y marrón del rojo:
     * con 0.3 también el rojo (~0.18) perdería su contorno original.
     */
    fun esColorOscuro(color: Int): Boolean {
        val rojo = canalLineal((color ushr 16) and 0xFF)
        val verde = canalLineal((color ushr 8) and 0xFF)
        val azul = canalLineal(color and 0xFF)
        return 0.2126 * rojo + 0.7152 * verde + 0.0722 * azul < 0.1
    }

    private fun canalLineal(canal: Int): Double {
        val normalizado = canal / 255.0
        return if (normalizado <= 0.04045) normalizado / 12.92
        else ((normalizado + 0.055) / 1.055).pow(2.4)
    }
}
