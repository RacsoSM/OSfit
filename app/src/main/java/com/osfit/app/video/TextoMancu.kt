package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Paint
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import kotlin.math.ceil

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
    private val haloClaro = Paint(contorno).apply {
        strokeWidth = 5f
        color = 0xFFFFF7E3.toInt()
    }
    private val sombraSuave = Paint(haloClaro).apply {
        style = Paint.Style.FILL_AND_STROKE
        color = 0xFFE3B94F.toInt()
    }
    private val mano = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = tipografias.mano }
    private val parrafo = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = tipografias.mano }
    private data class ClaveParrafo(val texto: String, val tamano: Float, val ancho: Int,
                                  val interletraje: Float = 0f)
    private val parrafos = mutableMapOf<ClaveParrafo, StaticLayout>()

    fun titulo(canvas: Canvas, texto: String, centroX: Float, y: Float, tamano: Float,
               color: Int = PaletaMancu.ROJO) {
        titulo.textSize = tamano
        titulo.letterSpacing = if (ColorMancu.esColorOscuro(color)) 0.03f else 0f
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
        titulo(canvas, texto, centroX, y, tamanoQueCabe(texto, tamano, anchoMaximo, color), color)
    }

    fun tamanoQueCabe(texto: String, tamano: Float, anchoMaximo: Float,
                      color: Int = PaletaMancu.ROJO): Float {
        titulo.textSize = tamano
        titulo.letterSpacing = if (ColorMancu.esColorOscuro(color)) 0.03f else 0f
        val anchoTexto = titulo.measureText(texto)
        return if (anchoTexto > anchoMaximo && anchoTexto > 0f) {
            tamano * anchoMaximo.coerceAtLeast(0f) / anchoTexto
        } else tamano
    }

    fun parrafoCentrado(canvas: Canvas, texto: String, centroX: Float, y: Float,
                        tamano: Float, ancho: Int, color: Int = PaletaMancu.MARRON) {
        if (ancho <= 0) return
        parrafo.typeface = mano.typeface
        parrafo.letterSpacing = 0f
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
                        inicioRojo: Int = textoCompleto.length, elapsedMs: Long,
                        duracionMs: Long, inicioMs: Long = 0L,
                        golpeMs: Long = Long.MIN_VALUE, cascada: Boolean = false) {
        if (elapsedMs < inicioMs) return
        val ajustado = tamanoQueCabe(textoCompleto, tamano, anchoMaximo, PaletaMancu.TINTA)
        titulo.textSize = ajustado
        // El ancho completo mantiene fijo el saludo mientras aparecen sus letras.
        val x = centroX - medirTitulo(textoCompleto, 0, textoCompleto.length,
            PaletaMancu.TINTA, inicioRojo, textoCompleto.length) / 2f
        pintarLetras(canvas, textoCompleto, 0, textoVisible.length.coerceAtMost(textoCompleto.length),
            x, y, ajustado, true, PaletaMancu.TINTA, inicioRojo, textoCompleto.length,
            elapsedMs, inicioMs, duracionMs, golpeMs, cascada)
    }

    /** Cachear el texto completo mantiene quietas las líneas mientras aparecen las letras. */
    fun bloqueMaquina(canvas: Canvas, texto: String, elapsedMs: Long, inicioMs: Long,
                      duracionMs: Long, centroX: Float, y: Float, tamano: Float,
                      ancho: Int = 900, esTitulo: Boolean = false,
                      color: Int = PaletaMancu.MARRON, inicioRojo: Int = texto.length,
                      finRojo: Int = texto.length, altoMaximo: Float = 1840f - y,
                      golpeMs: Long = Long.MIN_VALUE, cascada: Boolean = false) {
        if (elapsedMs < inicioMs) return
        val visibles = MaquinaEscribir.textoVisible(texto, elapsedMs - inicioMs, duracionMs).length
        parrafo.typeface = if (esTitulo) titulo.typeface else mano.typeface
        // Cortar con el mismo interletraje evita ensanchar las líneas fuera del papel.
        parrafo.letterSpacing = if (esTitulo && ColorMancu.esColorOscuro(color)) 0.03f else 0f
        var ajustado = tamano
        var layout: StaticLayout
        // El ranking puede traer muchos nombres: reducir también por altura evita cortar el final.
        do {
            parrafo.textSize = ajustado
            val clave = ClaveParrafo((if (esTitulo) "titulo:" else "mano:") + texto, ajustado,
                ancho, parrafo.letterSpacing)
            layout = parrafos.getOrPut(clave) {
                StaticLayout.Builder.obtain(texto, 0, texto.length, parrafo, ancho)
                    .setAlignment(Layout.Alignment.ALIGN_CENTER).setIncludePad(false).build()
            }
            if (layout.height <= altoMaximo || ajustado <= 1f) break
            ajustado *= 0.85f
        } while (true)
        for (linea in 0 until layout.lineCount) {
            val inicio = layout.getLineStart(linea)
            val fin = minOf(layout.getLineEnd(linea), visibles)
            if (fin <= inicio) break
            val x = centroX - ancho / 2f + layout.getLineLeft(linea)
            val base = y + layout.getLineBaseline(linea)
            pintarLetras(canvas, texto, inicio, fin, x, base, ajustado, esTitulo, color,
                inicioRojo, finRojo, elapsedMs, inicioMs, duracionMs, golpeMs, cascada)
        }
    }

    private fun pintarLetras(canvas: Canvas, texto: String, inicioLinea: Int, fin: Int,
                             x: Float, base: Float, tamano: Float, esTitulo: Boolean,
                             color: Int, inicioRojo: Int, finRojo: Int, elapsedMs: Long,
                             inicioMs: Long, duracionMs: Long, golpeMs: Long, cascada: Boolean) {
        val pintura = if (esTitulo) titulo else mano
        pintura.textSize = tamano
        pintura.color = color
        val golpe = if (golpeMs != Long.MIN_VALUE && elapsedMs >= golpeMs)
            MancuAnimacion.squash(elapsedMs - golpeMs) else null
        for (i in inicioLinea until fin) {
            if (texto[i] == '\n' || texto[i] == '\r') continue
            // MaquinaEscribir trunca len*t/duracion: la letra i nace al alcanzar i+1.
            // Ceil reproduce ese primer milisegundo visible; duración no positiva nace en inicioMs.
            val aparicion = if (duracionMs <= 0L) 0L else
                ceil((i + 1).toDouble() * duracionMs / texto.length).toLong()
            val edad = elapsedMs - inicioMs - aparicion
            if (edad < 0L) continue
            val roja = esTitulo && i >= inicioRojo && i < finRojo
            val letraX = x + if (esTitulo) {
                medirTitulo(texto, inicioLinea, i, color, inicioRojo, finRojo)
            } else pintura.measureText(texto, inicioLinea, i)
            if (esTitulo) pintura.letterSpacing =
                if (!roja && ColorMancu.esColorOscuro(color)) 0.03f else 0f
            val pivoteX = letraX + pintura.measureText(texto, i, i + 1) / 2f
            val escala = if (cascada) 1f else MancuAnimacion.popLetra(edad)
                .let { if (esTitulo) it else minOf(it, 1.1f) }
            var desplazamiento = if (cascada) MancuAnimacion.caidaLetra(edad)
                else MancuAnimacion.subidaLetra(edad)
            if (roja) desplazamiento += MancuAnimacion.temblorLetraY(elapsedMs, i)
            val guardado = canvas.save()
            canvas.translate(0f, desplazamiento)
            canvas.scale(escala, escala, pivoteX, base)
            if (golpe != null) canvas.scale(golpe.first, golpe.second, pivoteX, base)
            if (roja) canvas.rotate(MancuAnimacion.temblorLetra(elapsedMs, i), pivoteX, base)
            if (esTitulo) {
                pintarTitulo(canvas, texto, i, i + 1, letraX, base, tamano,
                    if (roja) PaletaMancu.ROJO else color)
            } else canvas.drawText(texto, i, i + 1, letraX, base, mano)
            canvas.restoreToCount(guardado)
        }
    }

    private fun medirTitulo(texto: String, inicio: Int, fin: Int, color: Int,
                            inicioRojo: Int, finRojo: Int): Float {
        val interletraje = if (ColorMancu.esColorOscuro(color)) 0.03f else 0f
        val desdeRojo = inicioRojo.coerceIn(inicio, fin)
        val hastaRojo = finRojo.coerceIn(desdeRojo, fin)
        // Un título mixto mide cada tramo con su espaciado para no ensanchar las letras rojas.
        titulo.letterSpacing = interletraje
        var ancho = titulo.measureText(texto, inicio, desdeRojo)
        titulo.letterSpacing = 0f
        ancho += titulo.measureText(texto, desdeRojo, hastaRojo)
        titulo.letterSpacing = interletraje
        return ancho + titulo.measureText(texto, hastaRojo, fin)
    }

    private fun pintarTitulo(canvas: Canvas, texto: String, inicio: Int, fin: Int,
                             x: Float, y: Float, tamano: Float, color: Int) {
        if (inicio == fin) return
        titulo.textSize = tamano
        titulo.color = color
        val oscuro = ColorMancu.esColorOscuro(color)
        titulo.letterSpacing = if (oscuro) 0.03f else 0f
        if (oscuro) {
            haloClaro.textSize = tamano
            sombraSuave.textSize = tamano
            haloClaro.letterSpacing = 0.03f
            sombraSuave.letterSpacing = 0.03f
            canvas.drawText(texto, inicio, fin, x + 3f, y + 4f, sombraSuave)
            canvas.drawText(texto, inicio, fin, x, y, haloClaro)
            canvas.drawText(texto, inicio, fin, x, y, titulo)
            return
        }
        contorno.textSize = tamano
        sombra.textSize = tamano
        canvas.drawText(texto, inicio, fin, x + 4f, y + 5f, sombra)
        canvas.drawText(texto, inicio, fin, x, y, contorno)
        canvas.drawText(texto, inicio, fin, x, y, titulo)
    }
}
