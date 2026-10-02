package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF

class TransicionTelonMancu : TransicionMancu {
    private val rojo = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PaletaMancu.ROJO }
    private val pliegue = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFA82E1E.toInt() }
    private val tinta = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = PaletaMancu.TINTA
        style = Paint.Style.STROKE
        strokeWidth = 8f
        strokeJoin = Paint.Join.ROUND
    }
    private val cortina = Path()
    private val cenefa = Path()
    private val arco = RectF()

    override fun dibujar(canvas: Canvas, ancho: Float, alto: Float, progreso: Float,
                         a: Float, centroX: Float, centroY: Float) {
        if (progreso <= 0f) return
        val p = progreso.coerceIn(0f, 1f)
        val avance = (ancho / 2f + 20f) * p
        for (lado in 0..1) {
            val guardado = canvas.save()
            if (lado == 1) { canvas.translate(ancho, 0f); canvas.scale(-1f, 1f) }
            cortina.reset()
            cortina.moveTo(-10f, -10f)
            cortina.lineTo(avance, -10f)
            for (i in 0 until 12) {
                val y = alto * i / 12f
                cortina.quadTo(avance + if (i % 2 == 0) 10f else -10f,
                    y + alto / 24f, avance, y + alto / 12f)
            }
            cortina.lineTo(-10f, alto + 10f)
            cortina.close()
            canvas.drawPath(cortina, rojo)
            val recorte = canvas.save()
            canvas.clipPath(cortina)
            // Los pliegues viajan con la tela, en vez de aparecer comprimidos al cerrar.
            val anchoTela = ancho / 2f + 20f
            for (i in 0 until 6) {
                val x = avance - anchoTela + (i + 0.3f) * anchoTela / 6f
                canvas.drawRect(x, 0f, x + anchoTela / 28f, alto, pliegue)
            }
            canvas.restoreToCount(recorte)
            canvas.drawPath(cortina, tinta)
            canvas.restoreToCount(guardado)
        }
        val guardado = canvas.save()
        canvas.translate(0f, -140f * (1f - p))
        cenefa.reset()
        cenefa.moveTo(-10f, -10f)
        cenefa.lineTo(ancho + 10f, -10f)
        cenefa.lineTo(ancho + 10f, 100f)
        val paso = ancho / 12f
        for (i in 11 downTo 0) {
            arco.set(i * paso, 60f, (i + 1) * paso, 140f)
            cenefa.arcTo(arco, 0f, 180f, false)
        }
        cenefa.lineTo(-10f, 100f)
        cenefa.close()
        canvas.drawPath(cenefa, rojo)
        canvas.drawPath(cenefa, tinta)
        canvas.restoreToCount(guardado)
    }
}
