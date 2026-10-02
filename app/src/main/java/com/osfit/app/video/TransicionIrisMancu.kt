package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max

class TransicionIrisMancu : TransicionMancu {
    private val capa = Path()
    private val tinta = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PaletaMancu.TINTA }
    private val anillo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = PaletaMancu.SOL
        style = Paint.Style.STROKE
        strokeWidth = 12f
    }

    override fun dibujar(canvas: Canvas, ancho: Float, alto: Float, progreso: Float,
                         a: Float, centroX: Float, centroY: Float) {
        if (progreso <= 0f) return
        val radioMaximo = hypot(max(abs(centroX), abs(ancho - centroX)),
            max(abs(centroY), abs(alto - centroY))) + 20f
        val radio = (1f - progreso.coerceIn(0f, 1f)) * radioMaximo
        capa.reset()
        capa.fillType = Path.FillType.EVEN_ODD
        capa.addRect(0f, 0f, ancho, alto, Path.Direction.CW)
        if (radio > 0f) capa.addCircle(centroX, centroY, radio, Path.Direction.CW)
        canvas.drawPath(capa, tinta)
        if (radio > 0f) canvas.drawCircle(centroX, centroY, radio, anillo)
    }
}
