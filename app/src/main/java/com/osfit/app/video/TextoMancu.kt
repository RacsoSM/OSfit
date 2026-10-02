package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Paint
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint

internal class TextoMancu(tipografias: TipografiasMancu) {
    private val titulo = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = tipografias.titulo }
    private val contorno = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = tipografias.titulo
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeWidth = 6f
        color = PaletaMancu.TINTA
    }
    private val sombra = Paint(contorno).apply { style = Paint.Style.FILL_AND_STROKE }
    private val mano = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = tipografias.mano }
    private val parrafo = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = tipografias.mano }
    private data class ClaveParrafo(val texto: String, val tamano: Float, val ancho: Int)
    private val parrafos = mutableMapOf<ClaveParrafo, StaticLayout>()

    fun titulo(canvas: Canvas, texto: String, centroX: Float, y: Float, tamano: Float,
               color: Int = PaletaMancu.ROJO) {
        titulo.textSize = tamano
        pintarTitulo(canvas, texto, 0, texto.length, centroX - titulo.measureText(texto) / 2f,
            y, tamano, color)
    }

    fun aMano(canvas: Canvas, texto: String, centroX: Float, y: Float, tamano: Float,
              color: Int = PaletaMancu.MARRON) {
        mano.textSize = tamano
        mano.color = color
        canvas.drawText(texto, centroX - mano.measureText(texto) / 2f, y, mano)
    }

    fun tituloAjustado(canvas: Canvas, texto: String, centroX: Float, y: Float,
                       tamano: Float, anchoMaximo: Float, color: Int = PaletaMancu.ROJO) {
        titulo(canvas, texto, centroX, y, tamanoQueCabe(texto, tamano, anchoMaximo), color)
    }

    fun tamanoQueCabe(texto: String, tamano: Float, anchoMaximo: Float): Float {
        titulo.textSize = tamano
        val anchoTexto = titulo.measureText(texto)
        return if (anchoTexto > anchoMaximo && anchoTexto > 0f) {
            tamano * anchoMaximo.coerceAtLeast(0f) / anchoTexto
        } else tamano
    }

    fun parrafoCentrado(canvas: Canvas, texto: String, centroX: Float, y: Float,
                        tamano: Float, ancho: Int, color: Int = PaletaMancu.MARRON) {
        if (ancho <= 0) return
        parrafo.textSize = tamano
        parrafo.color = color
        val clave = ClaveParrafo(texto, tamano, ancho)
        val layout = parrafos.getOrPut(clave) {
            StaticLayout.Builder.obtain(texto, 0, texto.length, parrafo, ancho)
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setIncludePad(false)
                .build()
        }
        val guardado = canvas.save()
        canvas.translate(centroX - ancho / 2f, y)
        // Los layouts comparten el paint: tamaño y color se restauran antes de cada dibujo.
        layout.draw(canvas)
        canvas.restoreToCount(guardado)
    }

    fun maquinaEscribir(canvas: Canvas, textoVisible: String, textoCompleto: String,
                        centroX: Float, y: Float, tamano: Float, anchoMaximo: Float,
                        inicioRojo: Int = textoCompleto.length) {
        val ajustado = tamanoQueCabe(textoCompleto, tamano, anchoMaximo)
        titulo.textSize = ajustado
        // El ancho completo mantiene fijo el saludo mientras aparecen sus letras.
        val x = centroX - titulo.measureText(textoCompleto) / 2f
        val corte = inicioRojo.coerceIn(0, textoVisible.length)
        pintarTitulo(canvas, textoVisible, 0, corte, x, y, ajustado, PaletaMancu.TINTA)
        val xNombre = x + titulo.measureText(textoVisible, 0, corte)
        pintarTitulo(canvas, textoVisible, corte, textoVisible.length, xNombre, y,
            ajustado, PaletaMancu.ROJO)
    }

    private fun pintarTitulo(canvas: Canvas, texto: String, inicio: Int, fin: Int,
                             x: Float, y: Float, tamano: Float, color: Int) {
        if (inicio == fin) return
        titulo.textSize = tamano
        titulo.color = color
        contorno.textSize = tamano
        sombra.textSize = tamano
        canvas.drawText(texto, inicio, fin, x + 4f, y + 5f, sombra)
        canvas.drawText(texto, inicio, fin, x, y, contorno)
        canvas.drawText(texto, inicio, fin, x, y, titulo)
    }
}
