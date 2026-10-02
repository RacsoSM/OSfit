package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

class NubeTransicionMancu : TransicionMancu {
    private val relleno = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFF7E3.toInt() }
    private val contorno = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = PaletaMancu.TINTA
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
    }
    private val sol = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PaletaMancu.SOL }
    private val rojo = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PaletaMancu.ROJO }
    private val rafaga = Path()
    private val limites = RectF()
    // Centro x/ancho, centro y/alto, radio/ancho y desfase. Las cuatro filas
    // cubren incluso las esquinas con margen al alcanzar el radio final.
    private val circulos = floatArrayOf(
        0.08f, 0.04f, 0.46f, 0.00f, 0.50f, 0.06f, 0.57f, 0.08f, 0.92f, 0.04f, 0.46f, 0.04f,
        0.06f, 0.35f, 0.47f, 0.10f, 0.50f, 0.35f, 0.62f, 0.02f, 0.94f, 0.35f, 0.47f, 0.12f,
        0.06f, 0.65f, 0.47f, 0.06f, 0.50f, 0.65f, 0.62f, 0.00f, 0.94f, 0.65f, 0.47f, 0.08f,
        0.08f, 0.96f, 0.46f, 0.12f, 0.50f, 0.94f, 0.57f, 0.04f, 0.92f, 0.96f, 0.46f, 0.10f
    )
    // La estrella conserva sus direcciones sin calcular trigonometría por frame.
    private val direcciones = FloatArray(48).apply {
        for (i in 0 until 24) {
            val angulo = -PI / 2.0 + i * PI / 12.0
            this[i * 2] = cos(angulo).toFloat()
            this[i * 2 + 1] = sin(angulo).toFloat()
        }
    }

    override fun dibujar(canvas: Canvas, ancho: Float, alto: Float, progreso: Float,
                         a: Float, centroX: Float, centroY: Float) {
        dibujar(canvas, ancho, alto, progreso)
    }

    fun dibujar(canvas: Canvas, ancho: Float, alto: Float, progreso: Float) {
        if (progreso <= 0f) return
        val avance = progreso.coerceAtMost(1f)
        contorno.strokeWidth = 8f * ancho / 1080f
        var i = 0
        while (i < circulos.size) {
            val desfase = circulos[i + 3]
            // Normalizar tras el desfase garantiza que todos lleguen a tamaño completo
            // justo al cambiar la escena; también conserva la retirada simétrica.
            val crecimiento = ((avance - desfase) / (1f - desfase)).coerceIn(0f, 1f)
            val radio = circulos[i + 2] * ancho * crecimiento
            if (radio > 0f) {
                val x = circulos[i] * ancho
                val y = circulos[i + 1] * alto
                limites.set(x - radio, y - radio, x + radio, y + radio)
                canvas.drawOval(limites, relleno)
                canvas.drawOval(limites, contorno)
            }
            i += 4
        }
        val tamano = ((avance - 0.72f) / 0.28f).coerceIn(0f, 1f) * min(ancho, alto) * 0.28f
        if (tamano <= 0f) return
        rafaga.reset()
        for (punta in 0 until 24) {
            val radio = tamano * if (punta % 2 == 0) 1f else 0.52f
            val x = ancho * 0.5f + direcciones[punta * 2] * radio
            val y = alto * 0.5f + direcciones[punta * 2 + 1] * radio
            if (punta == 0) rafaga.moveTo(x, y) else rafaga.lineTo(x, y)
        }
        rafaga.close()
        canvas.drawPath(rafaga, sol)
        canvas.drawPath(rafaga, contorno)
        canvas.drawCircle(ancho * 0.5f, alto * 0.5f, tamano * 0.23f, rojo)
        canvas.drawCircle(ancho * 0.5f, alto * 0.5f, tamano * 0.23f, contorno)
    }
}
