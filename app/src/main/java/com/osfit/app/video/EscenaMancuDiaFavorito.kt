package com.osfit.app.video

import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.atan2

internal class EscenaMancuDiaFavorito {
    private val pose = PoseMancu(Brazos.HOLA, Ojos.LADO, Boca.SONRISA)
    private val relleno = Paint(Paint.ANTI_ALIAS_FLAG)
    private val tinta = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = PaletaMancu.TINTA; style = Paint.Style.STROKE; strokeWidth = 4f
        strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val etiqueta = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = PaletaMancu.MARRON; textAlign = Paint.Align.CENTER
    }
    private val exterior = RectF(319f, 907f, 761f, 1349f)
    private val interior = RectF(412.5f, 1000.5f, 667.5f, 1255.5f)
    private val rebanada = Path()
    private val colores = intArrayOf(PaletaMancu.ROJO, 0xffe88738.toInt(), PaletaMancu.SOL,
        0xffaa9582.toInt(), 0xffc5ad8c.toInt(), 0xff88786c.toInt(), 0xffd9c8aa.toInt())
    private var datos: EscenaResumen.DiaFavorito? = null
    private var nombres = emptyList<List<String>>()
    private var barridos = emptyList<Float>()

    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.DiaFavorito) {
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.mensajeDiaFavorito(escena),
            ctx.elapsedMs, 0, 2200, 540f, 430f, 72f, esTitulo = true, color = PaletaMancu.TINTA)
        val alpha = ((ctx.elapsedMs - 2400) / 500f).coerceIn(0f, 1f)
        val conteo = escena.conteoDias
        val total = conteo.sumOf { it.veces }
        if (conteo.isEmpty() || total <= 0 || alpha <= 0f) return
        if (datos !== escena) {
            datos = escena
            nombres = conteo.map { dia ->
                val lineas = GeometriaMancu.partirNombreDia(dia.nombreDia).toMutableList()
                lineas[lineas.lastIndex] = "${lineas.last()} ×${dia.veces}"
                lineas
            }
            barridos = conteo.map { GeometriaMancu.barridoDona(it.veces, total) }
        }
        etiqueta.typeface = ctx.tipografias.mano
        val c = ctx.canvas
        val guardado = c.saveLayerAlpha(80f, 690f, 1000f, 1810f, (alpha * 255).toInt())
        var inicio = -90f
        val gap = if (conteo.size > 1) 3f else 0f
        conteo.forEachIndexed { i, _ ->
            val barrido = barridos[i]
            val fin = inicio + barrido - gap / 2
            val comienzo = inicio + gap / 2
            val radInicio = Math.toRadians(comienzo.toDouble())
            rebanada.reset()
            rebanada.moveTo(540f + 221f * cos(radInicio).toFloat(), 1128f + 221f * sin(radInicio).toFloat())
            rebanada.arcTo(exterior, comienzo, (barrido - gap).coerceAtLeast(0f))
            val radFin = Math.toRadians(fin.toDouble())
            rebanada.lineTo(540f + 127.5f * cos(radFin).toFloat(), 1128f + 127.5f * sin(radFin).toFloat())
            rebanada.arcTo(interior, fin, -(barrido - gap).coerceAtLeast(0f))
            rebanada.close()
            relleno.color = colores[i % colores.size]
            c.drawPath(rebanada, relleno)
            c.drawPath(rebanada, tinta)
            val medio = Math.toRadians((inicio + barrido / 2).toDouble())
            val ux = cos(medio).toFloat()
            val uy = sin(medio).toFloat()
            flecha(ctx, 540f + 236f * ux, 1128f + 236f * uy, 540f + 332f * ux, 1128f + 332f * uy)
            // La etiqueta conserva radio 411 y flecha 96; se limita su centro y tamaño al papel.
            val x = (540f + 411f * ux).coerceIn(210f, 870f)
            val y = 1128f + 411f * uy
            etiqueta.textSize = 30f
            val ancho = nombres[i].maxOf { etiqueta.measureText(it) }
            val disponible = 2f * minOf(x - 80f, 1000f - x)
            etiqueta.textSize = if (ancho > disponible) 30f * disponible / ancho else 30f
            nombres[i].forEachIndexed { j, nombre ->
                c.drawText(nombre, x, y + (j - (nombres[i].size - 1) / 2f) * 36f + 10f, etiqueta)
            }
            inicio += barrido
        }
        ctx.actor.colocar(150f, 1530f, 280f, pose, alpha = alpha)
        // HOLA ya levanta el guante derecho; una flecha desde allí evita añadir otra pose.
        val mayor = conteo.indices.maxByOrNull { conteo[it].veces } ?: 0
        val medioMayor = Math.toRadians((-90f + barridos.take(mayor).sum() + barridos[mayor] / 2).toDouble())
        flecha(ctx, 413f, 1589f, 540f + 175f * cos(medioMayor).toFloat(), 1128f + 175f * sin(medioMayor).toFloat())
        c.restoreToCount(guardado)
    }
    private fun flecha(ctx: ContextoEscenaMancu, x1: Float, y1: Float, x2: Float, y2: Float) {
        ctx.canvas.drawLine(x1, y1, x2, y2, tinta)
        val angulo = atan2(y2 - y1, x2 - x1).toDouble()
        val abertura = Math.toRadians(25.0)
        for (signo in signos) ctx.canvas.drawLine(x2, y2,
            x2 - 14f * cos(angulo + signo * abertura).toFloat(),
            y2 - 14f * sin(angulo + signo * abertura).toFloat(), tinta)
    }
    private val signos = intArrayOf(-1, 1)
}
