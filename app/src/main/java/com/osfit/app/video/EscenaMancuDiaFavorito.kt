package com.osfit.app.video

import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.atan2

internal class EscenaMancuDiaFavorito {
    private val pose = PoseMancu(Brazos.HOLA, Ojos.LADO, Boca.O)
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
    private var mayor = 0
    private var mayorUx = 0f
    private var mayorUy = 0f

    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.DiaFavorito) {
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.mensajeDiaFavorito(escena),
            ctx.elapsedMs, 0, 2200, 540f, 430f, 72f, esTitulo = true, color = PaletaMancu.TINTA)
        val t = ctx.elapsedMs
        val conteo = escena.conteoDias
        val total = conteo.sumOf { it.veces }
        if (conteo.isEmpty() || total <= 0) {
            if (t >= 4600L) ctx.actor.actuar(150f, 1530f, 280f,
                AccionMancu.ESTIRARSE, t - 4600L, pose)
            else ctx.actor.colocar(150f, 1530f, 280f, pose)
            return
        }
        if (datos !== escena) {
            datos = escena
            nombres = conteo.map { dia ->
                val lineas = GeometriaMancu.partirNombreDia(dia.nombreDia).toMutableList()
                lineas[lineas.lastIndex] = "${lineas.last()} ×${dia.veces}"
                lineas
            }
            barridos = conteo.map { GeometriaMancu.barridoDona(it.veces, total) }
            mayor = conteo.indices.maxBy { conteo[it].veces }
            var comienzoMayor = -90f
            for (i in 0 until mayor) comienzoMayor += barridos[i]
            val medio = Math.toRadians((comienzoMayor + barridos[mayor] / 2f).toDouble())
            mayorUx = cos(medio).toFloat()
            mayorUy = sin(medio).toFloat()
        }
        val salida = MancuAnimacion.salidaRebanada(t - 3600L)
        val salto = t - 3700L
        val sy = MancuAnimacion.escalaYSalto(salto)
        val yMancu = 1530f - 120f * MancuAnimacion.alturaSalto(salto)
        val actuacion = if (t < 3600L) pose else pose.copy(brazos = Brazos.SENALA,
            ojos = if (salto in 0L..900L) Ojos.FELIZ else Ojos.NORMAL,
            boca = if (salto in 0L..900L) Boca.ABIERTA else Boca.SONRISA,
            // Hombro derecho (160,86) en el espacio 200×200; el destino sigue al sector separado.
            anguloSenala = MancuAnimacion.anguloHacia(150f + 280f * 160f / 200f,
                yMancu + 280f * 86f / 200f,
                540f + (175f + salida) * mayorUx, 1128f + (175f + salida) * mayorUy))
        if (t >= 4600L) ctx.actor.actuar(150f, 1530f, 280f,
            AccionMancu.ESTIRARSE, t - 4600L, pose)
        else ctx.actor.colocar(150f, yMancu, 280f, actuacion, escalaX = 1f / sy, escalaY = sy)
        if (t <= 2400L) return
        etiqueta.typeface = ctx.tipografias.mano
        val c = ctx.canvas
        val revelado = MancuAnimacion.barridoDona(t - 2400L)
        var inicio = -90f
        val gap = if (conteo.size > 1) 3f else 0f
        conteo.forEachIndexed { i, _ ->
            val barrido = barridos[i]
            val parcial = (revelado - (inicio + 90f)).coerceIn(0f, barrido)
            val fin = inicio + parcial - gap / 2
            val comienzo = inicio + gap / 2
            val sector = c.save()
            if (i == mayor) c.translate(salida * mayorUx, salida * mayorUy)
            val radInicio = Math.toRadians(comienzo.toDouble())
            rebanada.reset()
            rebanada.moveTo(540f + 221f * cos(radInicio).toFloat(), 1128f + 221f * sin(radInicio).toFloat())
            rebanada.arcTo(exterior, comienzo, (parcial - gap).coerceAtLeast(0f))
            val radFin = Math.toRadians(fin.toDouble())
            rebanada.lineTo(540f + 127.5f * cos(radFin).toFloat(), 1128f + 127.5f * sin(radFin).toFloat())
            rebanada.arcTo(interior, fin, -(parcial - gap).coerceAtLeast(0f))
            rebanada.close()
            relleno.color = colores[i % colores.size]
            if (parcial > gap) {
                c.drawPath(rebanada, relleno)
                c.drawPath(rebanada, tinta)
            }
            c.restoreToCount(sector)
            val nacimiento = 2400L + MancuAnimacion.llegadaBarrido(inicio + 90f + barrido)
            val escala = MancuAnimacion.popLetra(t - nacimiento)
            if (escala <= 0f) {
                inicio += barrido
                return@forEachIndexed
            }
            val medio = Math.toRadians((inicio + barrido / 2).toDouble())
            val ux = cos(medio).toFloat()
            val uy = sin(medio).toFloat()
            flecha(ctx, 540f + 236f * ux, 1128f + 236f * uy, 540f + 332f * ux, 1128f + 332f * uy)
            // La etiqueta conserva radio 411 y flecha 96; se limita su centro y tamaño al papel.
            val x = (540f + 411f * ux).coerceIn(210f, 870f)
            val y = 1128f + 411f * uy
            val texto = c.save()
            c.scale(escala, escala, x, y)
            etiqueta.textSize = 30f
            val ancho = nombres[i].maxOf { etiqueta.measureText(it) }
            val disponible = 2f * minOf(x - 80f, 1000f - x)
            etiqueta.textSize = if (ancho > disponible) 30f * disponible / ancho else 30f
            nombres[i].forEachIndexed { j, nombre ->
                c.drawText(nombre, x, y + (j - (nombres[i].size - 1) / 2f) * 36f + 10f, etiqueta)
            }
            c.restoreToCount(texto)
            inicio += barrido
        }
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
