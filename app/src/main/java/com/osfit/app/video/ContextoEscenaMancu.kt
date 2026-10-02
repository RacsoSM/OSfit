package com.osfit.app.video

import android.graphics.Canvas

internal data class ContextoEscenaMancu(
    val canvas: Canvas,
    val ancho: Float,
    val alto: Float,
    /** Reloj visible: admite tiempos negativos bajo la nube. */
    val elapsedMs: Long,
    val actor: ActorMancu,
    val tipografias: TipografiasMancu,
    val textos: TextoMancu
)
