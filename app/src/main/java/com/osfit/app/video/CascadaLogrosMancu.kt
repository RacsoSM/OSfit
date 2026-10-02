package com.osfit.app.video

internal object CascadaLogrosMancu {
    fun inicio(cantidad: Int, indice: Int): Long = ResumenFrameRenderer.LOGROS_RETRASO_MS +
        if (cantidad == 1) ResumenFrameRenderer.MEDALLA_INICIO_MS else 1200L + indice * 500L
    fun opacidad(cantidad: Int, indice: Int, elapsedMs: Long): Float =
        (elapsedMs - inicio(cantidad, indice)).coerceIn(0L, MEDALLA_FADE_MS).toFloat() / MEDALLA_FADE_MS
}
