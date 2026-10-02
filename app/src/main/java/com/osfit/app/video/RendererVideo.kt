package com.osfit.app.video

import android.graphics.Canvas

interface RendererVideo {
    /** Una instancia por generación: su estado mutable no se comparte entre videos. */
    fun dibujarFrame(canvas: Canvas, timeline: TimelineResumen, tiempoMs: Long)
}
