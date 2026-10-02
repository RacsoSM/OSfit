package com.osfit.app.video

import android.graphics.Canvas

interface TransicionMancu {
    fun dibujar(canvas: Canvas, ancho: Float, alto: Float, progreso: Float,
                a: Float, centroX: Float, centroY: Float)
}
