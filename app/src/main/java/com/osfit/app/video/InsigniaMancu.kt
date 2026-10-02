package com.osfit.app.video

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import com.osfit.app.util.EncajeInsignia

/** Recursos por instancia: el halo cambia su matriz, nunca reconstruye el degradado por frame. */
internal class InsigniaMancu {
    private val imagen = Paint(Paint.ANTI_ALIAS_FLAG).apply { isFilterBitmap = true }
    private val circulo = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glifo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF000000.toInt()
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        textAlign = Paint.Align.CENTER
    }
    private val onda = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = PaletaMancu.ROJO
    }
    private val degradado = RadialGradient(0f, 0f, 1f,
        intArrayOf(PaletaMancu.SOL, 0x55E89A45, 0x00E89A45),
        floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP)
    private val halo = Paint(Paint.ANTI_ALIAS_FLAG).apply { shader = degradado }
    private val matriz = Matrix()
    private val destino = RectF()
    private val encajes = mutableMapOf<Bitmap, EncajeInsignia.Encaje>()

    fun halo(canvas: Canvas, x: Float, y: Float, radio: Float, factor: Float,
             alphaMaximo: Int, intensidad: Float, alpha: Float) {
        val r = radio * factor * (1f + (intensidad - 1f).coerceAtLeast(0f) * HALO_CRECIMIENTO_DESTELLO)
        if (r <= 0f) return
        matriz.setScale(r, r)
        matriz.postTranslate(x, y)
        degradado.setLocalMatrix(matriz)
        halo.alpha = (alphaMaximo * intensidad * alpha).toInt().coerceIn(0, 255)
        canvas.drawCircle(x, y, r, halo)
    }

    fun onda(canvas: Canvas, x: Float, y: Float, radio: Float, avance: Float) {
        if (avance <= 0f) return
        val desvanecido = (1f - avance) * (1f - avance)
        onda.alpha = (ONDA_ALPHA_MAXIMO * desvanecido).toInt().coerceIn(0, 255)
        onda.strokeWidth = ONDA_GROSOR_MAXIMO * desvanecido
        canvas.drawCircle(x, y, radio * (1f + (ONDA_FACTOR_FINAL - 1f) * avance), onda)
    }

    fun dibujar(canvas: Canvas, bitmap: Bitmap?, x: Float, y: Float, radio: Float,
                color: Int, letra: String, alpha: Float) {
        val opacidad = (alpha * 255).toInt().coerceIn(0, 255)
        if (bitmap != null) {
            // Las imágenes normales ya llegan cuadradas; el encaje también admite referencias rectangulares.
            val encaje = encajes.getOrPut(bitmap) { EncajeInsignia.calcular(bitmap.width, bitmap.height, 512) }
            val escala = radio * 2f / 512f
            val izquierda = x - radio + encaje.izquierda * escala
            val arriba = y - radio + encaje.arriba * escala
            destino.set(izquierda, arriba, izquierda + encaje.ancho * escala, arriba + encaje.alto * escala)
            imagen.alpha = opacidad
            canvas.drawBitmap(bitmap, null, destino, imagen)
        } else {
            circulo.color = color
            circulo.alpha = opacidad
            canvas.drawCircle(x, y, radio, circulo)
            glifo.alpha = opacidad
            glifo.textSize = radio
            canvas.drawText(letra, x, y + radio * 0.35f, glifo)
        }
    }
}
