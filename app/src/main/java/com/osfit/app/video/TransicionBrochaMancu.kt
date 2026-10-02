package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import kotlin.random.Random

class TransicionBrochaMancu : TransicionMancu {
    private val relleno = Paint(Paint.ANTI_ALIAS_FLAG)
    private val tinta = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = PaletaMancu.TINTA
        style = Paint.Style.STROKE
        strokeWidth = 6f
        strokeJoin = Paint.Join.ROUND
    }
    private val pincelada = Path()
    private val cerdas = FloatArray(3 * 2 * 45).apply {
        val azar = Random(731)
        for (i in indices) this[i] = azar.nextFloat() * 20f - 10f
    }

    override fun dibujar(canvas: Canvas, ancho: Float, alto: Float, progreso: Float,
                         a: Float, centroX: Float, centroY: Float) {
        if (progreso <= 0f) return
        val escala = ancho / 1080f
        for (i in 0..2) {
            val desfase = i * 0.12f
            val fase = if (a < 0.5f) progreso else 1f - progreso
            val q = ((fase - desfase) / (1f - desfase)).coerceIn(0f, 1f)
            val suave = q * q * (3f - 2f * q)
            val desplazamiento = if (a < 0.5f) -3000f * (1f - suave) else 3000f * suave
            val guardado = canvas.save()
            canvas.translate(desplazamiento * escala, 0f)
            canvas.rotate(-20f, ancho / 2f, alto / 2f)
            canvas.translate(ancho / 2f, alto / 2f)
            canvas.scale(escala, escala)
            // A -20°, las esquinas de 1080×1920 proyectan |x| <= 836 y |y| <= 1087.
            // Centros -740, 0, 740 y semigrosor 380 con dientes ±10 garantizan
            // bandas sólidas de 740: unión [-1110,1110], sin huecos; x va de -1100 a 1100.
            val centro = (i - 1) * 740f
            pincelada.reset()
            for (j in 0..44) {
                val x = -1100f + j * 50f
                val y = centro - 380f + cerdas[i * 90 + j]
                if (j == 0) pincelada.moveTo(x, y) else pincelada.lineTo(x, y)
            }
            for (j in 44 downTo 0) {
                pincelada.lineTo(-1100f + j * 50f, centro + 380f + cerdas[i * 90 + 45 + j])
            }
            pincelada.close()
            relleno.color = if (i == 1) PaletaMancu.ROJO else PaletaMancu.SOL
            canvas.drawPath(pincelada, relleno)
            canvas.drawPath(pincelada, tinta)
            canvas.restoreToCount(guardado)
        }
    }
}
