package com.osfit.app.video

import android.graphics.Paint
import android.graphics.Path

internal class EscenaMancuTiempo {
    private val pose = PoseMancu(Brazos.HOLA, Ojos.LADO, Boca.O)
    private val ejes = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PaletaMancu.MARRON; strokeWidth = 3f }
    private val linea = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = PaletaMancu.ROJO; strokeWidth = 9f; style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val punto = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PaletaMancu.ROJO }
    private val etiqueta = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PaletaMancu.MARRON; textSize = 26f }
    private val camino = Path()
    private var datos: EscenaResumen.Tiempo? = null
    private var fechas = emptyList<String>()
    private var maximo = 120

    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Tiempo) {
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.TIEMPO_PREFIJO, ctx.elapsedMs, 0, 900,
            540f, 280f, 54f, esTitulo = true, color = PaletaMancu.TINTA)
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.tiempoDuracion(escena.minutos), ctx.elapsedMs, 900, 2400,
            540f, 490f, 120f, esTitulo = true, color = PaletaMancu.ROJO)
        ctx.actor.colocar(90f, 640f, 300f, pose)
        grafica(ctx, escena)
        ctx.textos.bloqueMaquina(ctx.canvas,
            TextosEscena.comparacion(escena.ranking, TextosEscena.TIEMPO_PRIMERO, TextosEscena.TIEMPO_LUGAR),
            ctx.elapsedMs, 4000, 1500, 540f, 1588f, 48f)
    }
    private fun grafica(ctx: ContextoEscenaMancu, escena: EscenaResumen.Tiempo) {
        val valores = escena.tiempoPorDia
        if (valores.size < 2 || valores.maxOf { it.minutos } <= 0) return
        val alpha = ((ctx.elapsedMs - 3400) / 600f).coerceIn(0f, 1f)
        if (alpha <= 0f) return
        if (datos !== escena) {
            datos = escena
            fechas = valores.map { GeometriaMancu.fechaEje(it.fecha) }
            maximo = GeometriaMancu.maximoGrafica(valores.map { it.minutos })
        }
        etiqueta.typeface = ctx.tipografias.mano
        val c = ctx.canvas
        val guardado = c.saveLayerAlpha(80f, 940f, 1000f, 1450f, (alpha * 255).toInt())
        // Se conservan arriba=956 y abajo=1276; el eje se mete para respetar el margen del papel.
        val izquierda = 220f
        val derecha = 990f
        val arriba = 956f
        val abajo = 1276f
        val paso = (derecha - izquierda) / (valores.size - 1)
        c.drawLine(izquierda, arriba, izquierda, abajo, ejes)
        c.drawLine(izquierda, abajo, derecha, abajo, ejes)
        for (ref in referencias) {
            val y = GeometriaMancu.yGrafica(ref, maximo, arriba, abajo)
            ejes.alpha = 70
            c.drawLine(izquierda, y, derecha, y, ejes)
            ejes.alpha = 255
            etiqueta.textAlign = Paint.Align.RIGHT
            c.drawText("$ref min", izquierda - 12f, y + 8f, etiqueta)
        }
        camino.reset()
        valores.forEachIndexed { i, valor ->
            val x = izquierda + paso * i
            val y = GeometriaMancu.yGrafica(valor.minutos, maximo, arriba, abajo)
            if (i == 0) camino.moveTo(x, y) else camino.lineTo(x, y)
            if (valor.minutos > 0) c.drawCircle(x, y, 9f, punto)
            vertical(ctx, fechas[i], x, abajo + 12f, Paint.Align.RIGHT)
        }
        c.drawPath(camino, linea)
        vertical(ctx, "Minutos por día", 105f, (arriba + abajo) / 2, Paint.Align.CENTER)
        c.restoreToCount(guardado)
    }
    private fun vertical(ctx: ContextoEscenaMancu, texto: String, x: Float, y: Float, alineacion: Paint.Align) {
        val guardado = ctx.canvas.save()
        ctx.canvas.translate(x, y)
        ctx.canvas.rotate(-90f)
        etiqueta.textAlign = alineacion
        ctx.canvas.drawText(texto, 0f, 0f, etiqueta)
        ctx.canvas.restoreToCount(guardado)
    }
    private val referencias = intArrayOf(60, 120)
}
