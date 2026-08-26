package com.osfit.app.video

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.osfit.app.domain.RankingResultado
import com.osfit.app.domain.ResumenClienteCalculator

sealed class TarjetaResumen {
    data class Asistencia(
        val encabezado: String,
        val nombreCliente: String,
        val dias: Int,
        val unidad: String,
        val ranking: RankingResultado
    ) : TarjetaResumen()

    data class Tiempo(val minutos: Int, val ranking: RankingResultado) : TarjetaResumen()

    data class DiaFavorito(val nombreDia: String?, val unidad: String) : TarjetaResumen()

    data class RachaMasLarga(val dias: Int, val ranking: RankingResultado) : TarjetaResumen()
}

object ResumenCardRenderer {

    private const val VERDE = 0xFF048751.toInt()
    private const val FONDO = 0xFF121212.toInt()

    fun renderizar(tarjeta: TarjetaResumen, ancho: Int = 1080, alto: Int = 1920): Bitmap {
        val bitmap = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(FONDO)

        when (tarjeta) {
            is TarjetaResumen.Asistencia -> dibujarAsistencia(canvas, ancho, tarjeta)
            is TarjetaResumen.Tiempo -> dibujarTiempo(canvas, ancho, tarjeta)
            is TarjetaResumen.DiaFavorito -> dibujarDiaFavorito(canvas, ancho, alto, tarjeta)
            is TarjetaResumen.RachaMasLarga -> dibujarRacha(canvas, ancho, tarjeta)
        }
        return bitmap
    }

    private fun dibujarAsistencia(canvas: Canvas, ancho: Int, t: TarjetaResumen.Asistencia) {
        var y = 160f
        y = dibujarTexto(canvas, t.encabezado, ancho, y, 48f, Color.WHITE, Typeface.NORMAL)
        y += 40f
        y = dibujarTexto(canvas, "Hola, ${t.nombreCliente}", ancho, y, 56f, Color.WHITE, Typeface.BOLD)
        y += 120f
        y = dibujarTexto(canvas, "Esta ${t.unidad} asististe ${t.dias} días", ancho, y, 80f, VERDE, Typeface.BOLD)
        y += 100f
        val comparacion = if (t.ranking.nombresPorEncima.isEmpty()) {
            "¡Vas primero en asistencias esta ${t.unidad}!"
        } else {
            "Estás en el lugar ${t.ranking.puesto} de asistencias, solamente detrás de: " +
                t.ranking.nombresPorEncima.joinToString(", ")
        }
        y = dibujarTexto(canvas, comparacion, ancho, y, 40f, Color.LTGRAY, Typeface.NORMAL)
        y += 80f
        dibujarTexto(canvas, ResumenClienteCalculator.leyendaPorPuesto(t.ranking.puesto), ancho, y, 52f, Color.WHITE, Typeface.BOLD_ITALIC)
    }

    private fun dibujarTiempo(canvas: Canvas, ancho: Int, t: TarjetaResumen.Tiempo) {
        val horas = t.minutos / 60
        val minutos = t.minutos % 60
        var y = 300f
        y = dibujarTexto(canvas, "Estuviste en el poderoso Focus un total de", ancho, y, 44f, Color.WHITE, Typeface.NORMAL)
        y += 30f
        y = dibujarTexto(canvas, "${horas}h ${minutos}min", ancho, y, 96f, VERDE, Typeface.BOLD)
        y += 120f
        val comparacion = if (t.ranking.nombresPorEncima.isEmpty()) {
            "¡Vas primero en tiempo asistido!"
        } else {
            "Estás en el lugar ${t.ranking.puesto} de tiempo asistido, solamente detrás de: " +
                t.ranking.nombresPorEncima.joinToString(", ")
        }
        y = dibujarTexto(canvas, comparacion, ancho, y, 40f, Color.LTGRAY, Typeface.NORMAL)
        y += 80f
        dibujarTexto(canvas, ResumenClienteCalculator.leyendaPorPuesto(t.ranking.puesto), ancho, y, 52f, Color.WHITE, Typeface.BOLD_ITALIC)
    }

    private fun dibujarDiaFavorito(canvas: Canvas, ancho: Int, alto: Int, t: TarjetaResumen.DiaFavorito) {
        val y = alto / 2f - 100f
        val texto = if (t.nombreDia != null) {
            "Tu día favorito fue ${t.nombreDia}"
        } else {
            "Esta ${t.unidad} no viniste, ¡te esperamos la próxima!"
        }
        dibujarTexto(canvas, texto, ancho, y, 64f, Color.WHITE, Typeface.BOLD)
    }

    private fun dibujarRacha(canvas: Canvas, ancho: Int, t: TarjetaResumen.RachaMasLarga) {
        var y = 300f
        y = dibujarTexto(canvas, "Tu racha más larga este mes fue de", ancho, y, 44f, Color.WHITE, Typeface.NORMAL)
        y += 30f
        y = dibujarTexto(canvas, "${t.dias} días seguidos", ancho, y, 88f, VERDE, Typeface.BOLD)
        y += 120f
        val comparacion = if (t.ranking.nombresPorEncima.isEmpty()) {
            "¡Vas primero en racha este mes!"
        } else {
            "Estás en el lugar ${t.ranking.puesto} de racha, solamente detrás de: " +
                t.ranking.nombresPorEncima.joinToString(", ")
        }
        y = dibujarTexto(canvas, comparacion, ancho, y, 40f, Color.LTGRAY, Typeface.NORMAL)
        y += 80f
        dibujarTexto(canvas, ResumenClienteCalculator.leyendaPorPuesto(t.ranking.puesto), ancho, y, 52f, Color.WHITE, Typeface.BOLD_ITALIC)
    }

    /** Dibuja texto centrado, ajustado al ancho disponible; devuelve el Y justo debajo del bloque. */
    private fun dibujarTexto(
        canvas: Canvas,
        texto: String,
        anchoCanvas: Int,
        y: Float,
        tamano: Float,
        color: Int,
        estilo: Int
    ): Float {
        val margen = 80
        val paint = TextPaint().apply {
            isAntiAlias = true
            this.color = color
            textSize = tamano
            typeface = Typeface.create(Typeface.DEFAULT, estilo)
        }
        val anchoDisponible = anchoCanvas - margen * 2
        val layout = StaticLayout.Builder
            .obtain(texto, 0, texto.length, paint, anchoDisponible)
            .setAlignment(Layout.Alignment.ALIGN_CENTER)
            .build()
        canvas.save()
        canvas.translate(margen.toFloat(), y)
        layout.draw(canvas)
        canvas.restore()
        return y + layout.height
    }
}
