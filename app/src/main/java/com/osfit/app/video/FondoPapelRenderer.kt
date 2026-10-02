package com.osfit.app.video

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import kotlin.math.PI
import kotlin.math.sin
import kotlin.random.Random

class FondoPapelRenderer {
    private val papel = 0xfff3e7c9.toInt()
    private val sombraPapel = 0xffeadbb3.toInt()
    // Coordenadas normalizadas: cambiar el tamaño del destino no recrea el gradiente.
    private val vineta = RadialGradient(0.5f, 0.5f, 0.71f, papel, sombraPapel, Shader.TileMode.CLAMP)
    private val matrizVineta = Matrix()
    private val pinturaPapel = Paint(Paint.ANTI_ALIAS_FLAG).apply { shader = vineta }
    private val textura = Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888).apply {
        val azar = Random(20)
        val pixeles = IntArray(256 * 256) {
            val alfa = azar.nextInt(9)
            val gris = if (azar.nextBoolean()) 0x00ffffff else 0
            (alfa shl 24) or gris
        }
        setPixels(pixeles, 0, 256, 0, 0, 256, 256)
    }
    private val pinturaTextura = Paint().apply {
        shader = BitmapShader(textura, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
    }
    private val pinturaSol = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xfff7d774.toInt()
        alpha = (255f * 0.85f).toInt()
    }

    fun dibujar(canvas: Canvas, ancho: Int, alto: Int, tMs: Long) {
        if (ancho <= 0 || alto <= 0) return
        matrizVineta.setScale(ancho.toFloat(), alto.toFloat())
        vineta.setLocalMatrix(matrizVineta)
        canvas.drawRect(0f, 0f, ancho.toFloat(), alto.toFloat(), pinturaPapel)
        val respiracion = 1f + 0.02f * sin(2.0 * PI * Math.floorMod(tMs, 5000L) / 5000.0).toFloat()
        // El prototipo de teléfono coloca el borde superior del sol al 28% de la altura.
        canvas.drawCircle(ancho * 0.5f, alto * 0.28f + ancho * 0.45f,
            ancho * 0.45f * respiracion, pinturaSol)
        canvas.drawRect(0f, 0f, ancho.toFloat(), alto.toFloat(), pinturaTextura)
    }
}
