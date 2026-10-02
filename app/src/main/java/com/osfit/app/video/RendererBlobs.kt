package com.osfit.app.video

import android.graphics.Canvas
import com.osfit.app.paletas.Paleta

class RendererBlobs(private val paleta: Paleta) : RendererVideo {
    private val fondo = FondoBlobRenderer(paleta)

    override fun dibujarFrame(canvas: Canvas, timeline: TimelineResumen, tiempoMs: Long) {
        ResumenFrameRenderer.dibujarFrame(canvas, timeline, fondo, tiempoMs, paleta)
    }
}
