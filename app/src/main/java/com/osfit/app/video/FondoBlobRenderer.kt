package com.osfit.app.video

import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint

/**
 * Dibuja los blobs de fondo en su posición para [tiempoGlobalMs], con blur real vía
 * BlurMaskFilter — funciona en un canvas por software normal (el que arma cada frame),
 * sin necesitar Surface.lockHardwareCanvas() ni ramificar por versión de Android.
 */
object FondoBlobRenderer {
    private const val RADIO_BLUR_PX = 80f

    fun dibujar(canvas: Canvas, ancho: Int, alto: Int, tiempoGlobalMs: Long) {
        BlobsGeometria.blobs.forEach { blob ->
            val centro = BlobsGeometria.posicionEn(blob, tiempoGlobalMs)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = blob.colorArgb
                maskFilter = BlurMaskFilter(RADIO_BLUR_PX, BlurMaskFilter.Blur.NORMAL)
            }
            canvas.drawCircle(centro.x * ancho, centro.y * alto, blob.radio * ancho, paint)
        }
    }
}
