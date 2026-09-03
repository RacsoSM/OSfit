package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.osfit.app.domain.RankingResultado

private data class BloqueTexto(
    val texto: String,
    val inicioMs: Long,
    val duracionMs: Long,
    val y: Float,
    val tamano: Float,
    val color: Int,
    val estilo: Int
)

/**
 * Compone cada frame del video: fondo de blobs (tiempo global, continuo) + el texto de la
 * escena activa, o de la escena activa y la entrante mezcladas por alpha durante un crossfade.
 * Reemplaza a ResumenCardRenderer (una tarjeta estática por bitmap, sin animación).
 */
object ResumenFrameRenderer {

    private const val NEGRO = 0xFF000000.toInt()
    /** Color del dato destacado de cada escena. Rojo vivo: sobre el fondo negro con blobs
     *  apagados es lo que más contrasta, y no se confunde con el magenta/púrpura del fondo. */
    private const val DESTACADO = 0xFFFF3B30.toInt()
    private const val ANCHO_DEFECTO = 1080
    private const val ALTO_DEFECTO = 1920

    /**
     * Pinta el frame de [tiempoGlobalMs] directamente sobre [canvas] —el de la Surface del
     * codificador— en vez de componerlo en una bitmap intermedia de pantalla completa
     * (~8.3 MB por frame) que después habría que blitear. El `drawColor(NEGRO)` inicial no es
     * decorativo: el canvas que entrega `Surface.lockCanvas()` puede traer contenido viejo y
     * esto es lo que lo limpia.
     *
     * [canvas] sólo se usa durante la llamada; no se guarda ninguna referencia a él.
     *
     * [fondo] lo aporta quien genera el video: es estado mutable (bitmap y paints
     * reutilizados entre frames) y debe ser exclusivo de esa generación, porque dos
     * generaciones pueden solaparse. Este renderer no guarda ninguna referencia a él.
     */
    fun dibujarFrame(
        canvas: Canvas,
        timeline: TimelineResumen,
        fondo: FondoBlobRenderer,
        tiempoGlobalMs: Long,
        ancho: Int = ANCHO_DEFECTO,
        alto: Int = ALTO_DEFECTO
    ) {
        canvas.drawColor(NEGRO)
        fondo.dibujar(canvas, ancho, alto, tiempoGlobalMs)

        val activo = timeline.tramoActivo(tiempoGlobalMs)
        val entrante = timeline.tramoEntrante(tiempoGlobalMs)
        if (entrante != null) {
            val alphaEntrante = timeline.alphaEntrante(tiempoGlobalMs)
            dibujarEscena(canvas, ancho, activo.escena, timeline.elapsedEnTramo(activo, tiempoGlobalMs), alpha = 1f - alphaEntrante)
            dibujarEscena(canvas, ancho, entrante.escena, timeline.elapsedEnTramo(entrante, tiempoGlobalMs), alpha = alphaEntrante)
        } else {
            dibujarEscena(canvas, ancho, activo.escena, timeline.elapsedEnTramo(activo, tiempoGlobalMs), alpha = 1f)
        }
    }

    private fun dibujarEscena(canvas: Canvas, ancho: Int, escena: EscenaResumen, elapsedMs: Long, alpha: Float) {
        bloquesPara(escena).forEach { bloque ->
            val texto = MaquinaEscribir.textoVisible(bloque.texto, elapsedMs - bloque.inicioMs, bloque.duracionMs)
            if (texto.isNotEmpty()) {
                dibujarTexto(canvas, texto, ancho, bloque.y, bloque.tamano, bloque.color, bloque.estilo, alpha)
            }
        }
    }

    private fun bloquesPara(escena: EscenaResumen): List<BloqueTexto> = when (escena) {
        is EscenaResumen.Saludo -> listOf(
            BloqueTexto("Hola, ${escena.nombreCliente}", inicioMs = 0, duracionMs = 2_000, y = 880f, tamano = 76f, color = Color.WHITE, estilo = Typeface.BOLD)
        )
        is EscenaResumen.Asistencia -> listOf(
            BloqueTexto(escena.encabezadoRango, inicioMs = 0, duracionMs = 400, y = 160f, tamano = 44f, color = Color.LTGRAY, estilo = Typeface.NORMAL),
            BloqueTexto(
                "${determinante(escena.unidad, mayuscula = true)} ${escena.unidad} asististe ${escena.dias} días",
                inicioMs = 400, duracionMs = 2_400, y = 700f, tamano = 84f, color = DESTACADO, estilo = Typeface.BOLD
            ),
            BloqueTexto(
                comparacion(escena.ranking, "¡Vas primero en asistencias ${determinante(escena.unidad)} ${escena.unidad}!", "asistencias"),
                inicioMs = 3_400, duracionMs = 800, y = 1500f, tamano = 48f, color = Color.LTGRAY, estilo = Typeface.NORMAL
            )
        )
        is EscenaResumen.Tiempo -> {
            val horas = escena.minutos / 60
            val minutos = escena.minutos % 60
            listOf(
                BloqueTexto("Estuviste en el poderoso Focus un total de", inicioMs = 0, duracionMs = 900, y = 500f, tamano = 44f, color = Color.WHITE, estilo = Typeface.NORMAL),
                BloqueTexto("${horas}h ${minutos}min", inicioMs = 900, duracionMs = 2_400, y = 800f, tamano = 96f, color = DESTACADO, estilo = Typeface.BOLD),
                BloqueTexto(
                    comparacion(escena.ranking, "¡Vas primero en tiempo asistido!", "tiempo asistido"),
                    inicioMs = 4_000, duracionMs = 1_200, y = 1500f, tamano = 48f, color = Color.LTGRAY, estilo = Typeface.NORMAL
                )
            )
        }
        is EscenaResumen.Esfuerzo -> listOf(
            BloqueTexto(
                "De tu tiempo asistido, ${formatoDuracion(escena.minutosTotales)}",
                inicioMs = 0, duracionMs = 900, y = 460f, tamano = 44f, color = Color.WHITE, estilo = Typeface.NORMAL
            ),
            BloqueTexto(
                "Estuviste entrenando ${formatoDuracion(escena.desglose.minutosEntrenando)} y descansando " +
                    formatoDuracion(escena.desglose.minutosDescansando),
                inicioMs = 900, duracionMs = 2_600, y = 760f, tamano = 72f, color = DESTACADO, estilo = Typeface.BOLD
            ),
            BloqueTexto(
                "lo cual representa un ${escena.desglose.porcentajeEntrenando}% del total del tiempo",
                inicioMs = 4_000, duracionMs = 1_200, y = 1500f, tamano = 48f, color = Color.LTGRAY, estilo = Typeface.NORMAL
            )
        )
        is EscenaResumen.DiaFavorito -> listOf(
            BloqueTexto(mensajeDiaFavorito(escena), inicioMs = 0, duracionMs = 2_200, y = 860f, tamano = 64f, color = Color.WHITE, estilo = Typeface.BOLD)
        )
        is EscenaResumen.RachaMasLarga -> listOf(
            BloqueTexto("Tu racha más larga fue de", inicioMs = 0, duracionMs = 300, y = 700f, tamano = 44f, color = Color.WHITE, estilo = Typeface.NORMAL),
            BloqueTexto("${escena.dias} días seguidos", inicioMs = 300, duracionMs = 1_900, y = 1000f, tamano = 88f, color = DESTACADO, estilo = Typeface.BOLD),
            BloqueTexto(
                comparacion(escena.ranking, "¡Vas primero en racha este mes!", "racha"),
                inicioMs = 2_600, duracionMs = 600, y = 1500f, tamano = 48f, color = Color.LTGRAY, estilo = Typeface.NORMAL
            )
        )
    }

    /** Formatea un total de minutos como texto legible: "1h 27min", "1h", "16min", "0min". */
    private fun formatoDuracion(minutos: Int): String {
        val horas = minutos / 60
        val mins = minutos % 60
        return when {
            horas > 0 && mins > 0 -> "${horas}h ${mins}min"
            horas > 0 -> "${horas}h"
            else -> "${mins}min"
        }
    }

    private fun determinante(unidad: String, mayuscula: Boolean = false): String {
        val base = if (unidad == "mes") "este" else "esta"
        return if (mayuscula) base.replaceFirstChar { it.uppercase() } else base
    }

    /**
     * [fraseVasPrimero] es el texto exacto ya usado en el renderer de tarjetas estáticas para
     * el caso "vas primero" de cada tipo de escena (Asistencia incluye "esta semana"/"este mes",
     * Tiempo no lleva sufijo, Racha lo tiene fijo en "este mes") — se preserva verbatim, no se
     * genera genéricamente a partir de [etiquetaLugar].
     */
    private fun comparacion(ranking: RankingResultado, fraseVasPrimero: String, etiquetaLugar: String): String =
        if (ranking.nombresPorEncima.isEmpty()) {
            fraseVasPrimero
        } else {
            "Estás en el lugar ${ranking.puesto} de $etiquetaLugar, solamente detrás de: " +
                ranking.nombresPorEncima.joinToString(", ")
        }

    private fun mensajeDiaFavorito(t: EscenaResumen.DiaFavorito): String = when {
        t.nombreDia != null -> "Tu día favorito fue ${t.nombreDia}"
        t.diasAsistidos == 0 ->
            "${determinante(t.unidad, mayuscula = true)} ${t.unidad} no viniste, ¡te esperamos la próxima!"
        else -> "¡Sigue registrando tu día de rutina para descubrir cuál es tu favorito!"
    }

    private fun dibujarTexto(
        canvas: Canvas, texto: String, anchoCanvas: Int, y: Float,
        tamano: Float, color: Int, estilo: Int, alpha: Float
    ) {
        val margen = 80
        val paint = TextPaint().apply {
            isAntiAlias = true
            this.color = color
            this.alpha = (255 * alpha).toInt().coerceIn(0, 255)
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
    }
}
