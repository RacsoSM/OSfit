package com.osfit.app.video

import android.graphics.Canvas

internal data class ContextoEscenaMancu(
    val canvas: Canvas,
    val ancho: Float,
    val alto: Float,
    val elapsedMs: Long,
    val mancu: MancuDibujo,
    val tipografias: TipografiasMancu,
    val textos: TextoMancu
)
