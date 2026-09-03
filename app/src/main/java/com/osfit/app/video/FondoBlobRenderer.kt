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
 * El `Paint`, el `BlurMaskFilter` y la bitmap de la capa se construyen una sola vez por
 * instancia y se reutilizan en todos los frames (antes se creaban 4 de cada uno por frame:
 * ~3.500 por video).
 *
 * **Esto es una clase, no un `object`, a propósito**: todo ese estado es mutable, así que
 * compartirlo entre dos generaciones simultáneas (que sí ocurren: basta salir de la pantalla
 * y volver a entrar) haría que se pisaran los blobs una a la otra. Se crea una instancia por
 * generación de video, se usa desde el único hilo de su bucle de frames, y se descarta con
 * ella —lo que además evita retener la bitmap de ~518 KB durante toda la vida del proceso.
 */
class FondoBlobRenderer {

    /** La capa y su canvas viven juntos: no hay estado a medio publicar ni `!!` que sostener. */
    private class Capa(val bitmap: Bitmap) {
        val canvas = Canvas(bitmap)
    }

    private val paintBlob = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        maskFilter = BlurMaskFilter(RADIO_BLUR_PX / FACTOR_ESCALA, BlurMaskFilter.Blur.NORMAL)
    }

    /** Filtrado bilineal al escalar: sin él el degradado saldría escalonado. */
    private val paintEscalado = Paint(Paint.FILTER_BITMAP_FLAG)

    private val destino = RectF()
    private var capa: Capa? = null

    fun dibujar(canvas: Canvas, ancho: Int, alto: Int, tiempoGlobalMs: Long) {
        val anchoCapa = (ancho / FACTOR_ESCALA).coerceAtLeast(1)
        val altoCapa = (alto / FACTOR_ESCALA).coerceAtLeast(1)

        val cacheada = capa
        val capaActual = if (
            cacheada != null &&
            cacheada.bitmap.width == anchoCapa && cacheada.bitmap.height == altoCapa
        ) {
            cacheada
        } else {
            cacheada?.bitmap?.recycle()
            Capa(Bitmap.createBitmap(anchoCapa, altoCapa, Bitmap.Config.ARGB_8888)).also {
                capa = it
            }
        }

        // La capa se reutiliza entre frames: hay que borrarla entera antes de repintarla.
        capaActual.bitmap.eraseColor(Color.TRANSPARENT)
        BlobsGeometria.blobs.forEach { blob ->
            val centro = BlobsGeometria.posicionEn(blob, tiempoGlobalMs)
            paintBlob.color = blob.colorArgb
            capaActual.canvas.drawCircle(
                centro.x * anchoCapa,
                centro.y * altoCapa,
                blob.radio * anchoCapa,
                paintBlob
            )
        }

        // Componer los blobs entre sí en la capa y luego la capa sobre el fondo negro da el
        // mismo resultado que pintarlos uno a uno sobre el fondo: SrcOver es asociativo.
        destino.set(0f, 0f, ancho.toFloat(), alto.toFloat())
        canvas.drawBitmap(capaActual.bitmap, null, destino, paintEscalado)
    }

    private companion object {
        const val RADIO_BLUR_PX = 80f

        /** Reducción de la capa de blobs: 1080x1920 se dibuja como 270x480. */
        const val FACTOR_ESCALA = 4
    }
}
