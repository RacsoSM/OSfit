package com.osfit.app.video

object MaquinaEscribir {
    /** Recorta [textoCompleto] a la cantidad de caracteres que corresponde a [elapsedMs] de
     * [duracionMs] transcurridos, para el efecto de máquina de escribir. */
    fun textoVisible(textoCompleto: String, elapsedMs: Long, duracionMs: Long): String {
        if (duracionMs <= 0L) return textoCompleto
        if (elapsedMs <= 0L) return ""
        if (elapsedMs >= duracionMs) return textoCompleto
        val proporcion = elapsedMs.toDouble() / duracionMs.toDouble()
        val caracteres = (textoCompleto.length * proporcion).toInt().coerceIn(0, textoCompleto.length)
        return textoCompleto.substring(0, caracteres)
    }
}
