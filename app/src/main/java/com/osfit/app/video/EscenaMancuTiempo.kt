package com.osfit.app.video

import android.graphics.Paint
import android.graphics.Path
import android.graphics.PathMeasure
import kotlin.math.hypot
import kotlin.math.ceil

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
    private val medida = PathMeasure()
    private val revelado = Path()
    private var distancias = FloatArray(0)
    private var indiceMaximo = 0
    private var datos: EscenaResumen.Tiempo? = null
    private var fechas = emptyList<String>()
    private var maximo = 120

    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Tiempo) {
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.TIEMPO_PREFIJO, ctx.elapsedMs, 0, 900,
            540f, 280f, 54f, esTitulo = true, color = PaletaMancu.TINTA)
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.tiempoDuracion(escena.minutos), ctx.elapsedMs, 900, 2400,
            540f, 490f, 120f, esTitulo = true, color = PaletaMancu.ROJO)
        grafica(ctx, escena)
        val t = ctx.elapsedMs
        val salto = t - 5500L
        val sy = MancuAnimacion.escalaYSalto(salto)
        val y = 640f - 80f * MancuAnimacion.alturaSalto(salto)
        val valores = escena.tiempoPorDia
        val actuacion = when {
            salto in 0L..900L -> pose.copy(brazos = Brazos.ORGULLO, ojos = Ojos.FELIZ, boca = Boca.ABIERTA)
            t >= 4600L && valores.size >= 2 && valores.maxOf { it.minutos } > 0 -> {
                val xPunto = 220f + 770f * indiceMaximo / (valores.size - 1)
                val yPunto = GeometriaMancu.yGrafica(valores[indiceMaximo].minutos, maximo, 956f, 1276f)
                // Hombro derecho (160,86) del dibujo 200×200, trasladado al actor en pantalla.
                pose.copy(brazos = Brazos.SENALA, boca = Boca.SONRISA,
                    anguloSenala = MancuAnimacion.anguloHacia(90f + 300f * 160f / 200f,
                        y + 300f * 86f / 200f, xPunto, yPunto))
            }
            else -> pose
        }
        ctx.actor.colocar(90f, y, 300f, actuacion, escalaX = 1f / sy, escalaY = sy)
        ctx.textos.bloqueMaquina(ctx.canvas,
            TextosEscena.comparacion(escena.ranking, TextosEscena.TIEMPO_PRIMERO, TextosEscena.TIEMPO_LUGAR),
            ctx.elapsedMs, 4000, 1500, 540f, 1588f, 48f)
    }
    private fun grafica(ctx: ContextoEscenaMancu, escena: EscenaResumen.Tiempo) {
        val valores = escena.tiempoPorDia
        if (valores.size < 2 || valores.maxOf { it.minutos } <= 0) return
        if (datos !== escena) {
            datos = escena
            fechas = valores.map { GeometriaMancu.fechaEje(it.fecha) }
            maximo = GeometriaMancu.maximoGrafica(valores.map { it.minutos })
            indiceMaximo = valores.indices.maxBy { valores[it].minutos }
            distancias = FloatArray(valores.size)
            camino.reset()
            var anteriorX = 0f
            var anteriorY = 0f
            valores.forEachIndexed { i, valor ->
                val x = 220f + 770f * i / (valores.size - 1)
                val y = GeometriaMancu.yGrafica(valor.minutos, maximo, 956f, 1276f)
                if (i == 0) camino.moveTo(x, y) else {
                    camino.lineTo(x, y)
                    distancias[i] = distancias[i - 1] + hypot(x - anteriorX, y - anteriorY)
                }
                anteriorX = x
                anteriorY = y
            }
            medida.setPath(camino, false)
        }
        val alpha = ((ctx.elapsedMs - 3400) / 300f).coerceIn(0f, 1f)
        if (alpha <= 0f) return
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
        vertical(ctx, "Minutos por día", 105f, (arriba + abajo) / 2, Paint.Align.CENTER)
        c.restoreToCount(guardado)
        val progreso = ((ctx.elapsedMs - 3400L) / 1200f).coerceIn(0f, 1f)
        revelado.reset()
        medida.getSegment(0f, medida.length * progreso, revelado, true)
        c.drawPath(revelado, linea)
        valores.forEachIndexed { i, valor ->
            val x = izquierda + paso * i
            val y = GeometriaMancu.yGrafica(valor.minutos, maximo, arriba, abajo)
            // El recorrido acumulado sincroniza cada punto con el extremo real de PathMeasure.
            val nacimiento = 3400L + ceil(1200.0 * distancias[i] / medida.length).toLong()
            val escala = MancuAnimacion.popLetra(ctx.elapsedMs - nacimiento)
            if (escala <= 0f) return@forEachIndexed
            if (valor.minutos > 0) c.drawCircle(x, y, 9f * escala, punto)
            val texto = c.save()
            c.scale(escala, escala, x, abajo + 12f)
            vertical(ctx, fechas[i], x, abajo + 12f, Paint.Align.RIGHT)
            c.restoreToCount(texto)
        }
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
