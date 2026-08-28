package com.osfit.app.video

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF

/**
 * Dibuja los blobs de fondo en su posición para [tiempoGlobalMs], con blur real vía
 * BlurMaskFilter — funciona en un canvas por software normal (el que arma cada frame),
 * sin necesitar Surface.lockHardwareCanvas() ni ramificar por versión de Android.
 *
 * La capa de blobs se pinta en una bitmap reducida [FACTOR_ESCALA] veces y luego se escala
 * al canvas destino: es puro degradado suave, no hay detalle que perder, y desenfocar
 * 270x480 en vez de 1080x1920 recorta el área borrosa ~16x. Toda la geometría del blob ya
 * está en fracciones del canvas (ver [BlobSpec]), así que se escala sola al pintar sobre la
 * capa pequeña; lo único que hay que escalar a mano es el radio del blur, que está en px.
 *
 * El `Paint`, el `BlurMaskFilter` y la bitmap de la capa se construyen una sola vez y se
 * reutilizan en todos los frames (antes se creaban 4 de cada uno por frame: ~3.500 por video).
 * Pensado para el bucle de frames de [ResumenVideoEncoder], que es de un solo hilo.
 */
object FondoBlobRenderer {
    private const val RADIO_BLUR_PX = 80f

    /** Reducción de la capa de blobs: 1080x1920 se dibuja como 270x480. */
    private const val FACTOR_ESCALA = 4

    private val paintBlob = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        maskFilter = BlurMaskFilter(RADIO_BLUR_PX / FACTOR_ESCALA, BlurMaskFilter.Blur.NORMAL)
    }

    /** Filtrado bilineal al escalar: sin él el degradado saldría escalonado. */
    private val paintEscalado = Paint(Paint.FILTER_BITMAP_FLAG)

    private val destino = RectF()
    private var capa: Bitmap? = null
    private var canvasCapa: Canvas? = null

    fun dibujar(canvas: Canvas, ancho: Int, alto: Int, tiempoGlobalMs: Long) {
        val anchoCapa = (ancho / FACTOR_ESCALA).coerceAtLeast(1)
        val altoCapa = (alto / FACTOR_ESCALA).coerceAtLeast(1)

        val cacheada = capa
        val bitmapCapa = if (
            cacheada != null && !cacheada.isRecycled &&
            cacheada.width == anchoCapa && cacheada.height == altoCapa
        ) {
            cacheada
        } else {
            cacheada?.recycle()
            Bitmap.createBitmap(anchoCapa, altoCapa, Bitmap.Config.ARGB_8888).also {
                capa = it
                canvasCapa = Canvas(it)
            }
        }
        val lienzoCapa = canvasCapa!!

        // La capa se reutiliza entre frames: hay que borrarla entera antes de repintarla.
        bitmapCapa.eraseColor(Color.TRANSPARENT)
        BlobsGeometria.blobs.forEach { blob ->
            val centro = BlobsGeometria.posicionEn(blob, tiempoGlobalMs)
            paintBlob.color = blob.colorArgb
            lienzoCapa.drawCircle(
                centro.x * anchoCapa,
                centro.y * altoCapa,
                blob.radio * anchoCapa,
                paintBlob
            )
        }

        // Componer los blobs entre sí en la capa y luego la capa sobre el fondo negro da el
        // mismo resultado que pintarlos uno a uno sobre el fondo: SrcOver es asociativo.
        destino.set(0f, 0f, ancho.toFloat(), alto.toFloat())
        canvas.drawBitmap(bitmapCapa, null, destino, paintEscalado)
    }
}
