package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.text.Layout
import android.text.SpannableStringBuilder
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.ForegroundColorSpan
import com.osfit.app.data.model.CategoriaMedallaAutomatica
import com.osfit.app.domain.ConteoDiaRutina
import com.osfit.app.domain.PuntoTiempoDiario
import com.osfit.app.domain.RankingResultado
import java.time.format.DateTimeFormatter
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin

private data class Resaltado(val rango: IntRange, val color: Int)

private data class BloqueTexto(
    val texto: String,
    val inicioMs: Long,
    val duracionMs: Long,
    val y: Float,
    val tamano: Float,
    val color: Int,
    val estilo: Int,
    val resaltados: List<Resaltado> = emptyList()
)

/**
 * Compone cada frame del video: fondo de blobs (tiempo global, continuo) + el texto de la
 * escena activa, o de la escena activa y la entrante mezcladas por alpha durante un crossfade.
 * Reemplaza a ResumenCardRenderer (una tarjeta estática por bitmap, sin animación).
 */
object ResumenFrameRenderer {

    private const val NEGRO = 0xFF000000.toInt()
    /** Color del dato destacado de cada escena. Verde aqua fuerte: se distingue bien del fondo
     *  negro con blobs apagados y del magenta/púrpura del fondo, sin ser tan agresivo como el rojo. */
    private const val DESTACADO = 0xFF00E6A8.toInt()
    /** Velocidad de máquina de escribir de los textos destacados grandes (Asistencia y Esfuerzo):
     *  ambos deben "sentirse" igual de rápidos aunque su longitud de texto varíe. */
    private const val VELOCIDAD_DESTACADO_MS_POR_CARACTER = 2_400.0 / 29.0
    /** Misma velocidad que el saludo ("Hola, <nombre>", 2000ms para ~13 caracteres de
     *  referencia): la usa también la Despedida para que ambas se sientan iguales. */
    private const val VELOCIDAD_SALUDO_MS_POR_CARACTER = 2_000.0 / 13.0
    private const val ANCHO_DEFECTO = 1080
    private const val ALTO_DEFECTO = 1920

    /** La gráfica de la escena Tiempo aparece justo después de que termina de escribirse
     *  el número grande (900ms de inicio + 2400ms de máquina de escribir). */
    private const val GRAFICA_INICIO_MS = 3_400L
    private const val GRAFICA_FADE_MS = 600L
    /** El texto de "en qué lugar quedó" se corrió 15% de la altura del video (1920 * 0.15)
     *  hacia abajo, a pedido del trainer. */
    private const val DESPLAZAMIENTO_ABAJO = ALTO_DEFECTO * 0.15f
    /** La gráfica en sí se corrió esos mismos 15% hacia abajo y luego 10% de vuelta hacia
     *  arriba (1920 * 0.10), también a pedido del trainer — el texto del lugar no se movió
     *  con ella, por eso lleva su propio desplazamiento en vez de reusar el de arriba. */
    private const val DESPLAZAMIENTO_GRAFICA = DESPLAZAMIENTO_ABAJO - ALTO_DEFECTO * 0.10f
    private val FORMATO_FECHA_EJE = DateTimeFormatter.ofPattern("dd/MM")

    /** La dona de la escena DiaFavorito aparece justo después de que termina de escribirse
     *  su mensaje (2200ms de máquina de escribir). */
    private const val DONA_INICIO_MS = 2_400L
    private const val DONA_FADE_MS = 500L
    /** Título y dona de la escena DiaFavorito se subieron 20% de la altura del video
     *  (1920 * 0.20), a pedido del trainer. */
    private const val DESPLAZAMIENTO_ARRIBA_DIA_FAVORITO = ALTO_DEFECTO * 0.20f
    /** La dona sola se bajó otro 20% de vuelta (el título no se movió), también a pedido
     *  del trainer — por eso lleva su propio desplazamiento en vez de reusar el de arriba. */
    private const val DESPLAZAMIENTO_ABAJO_DONA_DIA_FAVORITO = ALTO_DEFECTO * 0.20f
    /** La dona sola se subió otro 10% adicional (el título tampoco se movió con esto),
     *  también a pedido del trainer. */
    private const val DESPLAZAMIENTO_ARRIBA_DONA_ADICIONAL = ALTO_DEFECTO * 0.10f
    /** Las flechas que conectan cada rebanada con su etiqueta se acortaron 20% (de 120px a
     *  96px), dejando la etiqueta donde estaba antes de ese cambio, también a pedido del
     *  trainer. */
    private const val LARGO_FLECHA_ETIQUETA = 120f * 0.8f
    /** Nombres de día de más de esta longitud (p. ej. "Hombro, bíceps y tríceps") se
     *  parten en dos renglones para no desbordar el ancho disponible entre rebanadas. */
    private const val DONA_LARGO_MAXIMO_UNA_LINEA = 12
    /** Paleta pastel para las rebanadas de la dona, asignada en orden fijo (día con más
     *  repeticiones primero): así cada rebanada se distingue por color además de por su
     *  etiqueta directa, en vez del esquema anterior de "favorito destacado vs. resto apagado". */
    private val DONA_PALETA_PASTEL = listOf(
        0xFFA8E6CF.toInt(), // menta
        0xFFAEC9F0.toInt(), // azul
        0xFFF6D186.toInt(), // amarillo
        0xFFF3A6C1.toInt(), // rosa
        0xFFCBB7EE.toInt(), // lavanda
        0xFFF6B989.toInt() // durazno
    )

    private const val MEDALLA_INICIO_MS = 2_000L
    private const val MEDALLA_FADE_MS = 600L
    /** Mismos colores que [DONA_PALETA_PASTEL], mapeados por categoría (en vez de por índice de
     *  rebanada) para que la insignia por defecto se sienta parte del mismo lenguaje visual del
     *  video. Solo se usa cuando la medalla no tiene imagen propia. */
    private val COLOR_INSIGNIA_MEDALLA = mapOf(
        CategoriaMedallaAutomatica.ASISTENCIA to 0xFFA8E6CF.toInt(),
        CategoriaMedallaAutomatica.TIEMPO to 0xFFAEC9F0.toInt(),
        CategoriaMedallaAutomatica.RACHA to 0xFFF6D186.toInt(),
        CategoriaMedallaAutomatica.ESFUERZO to 0xFFF3A6C1.toInt(),
        CategoriaMedallaAutomatica.CONSTANCIA to 0xFFCBB7EE.toInt()
    )

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
                val resaltadosVisibles = bloque.resaltados.mapNotNull { resaltado ->
                    val inicio = resaltado.rango.first.coerceIn(0, texto.length)
                    val fin = resaltado.rango.last.plus(1).coerceIn(0, texto.length)
                    if (inicio < fin) Resaltado(inicio until fin, resaltado.color) else null
                }
                dibujarTexto(canvas, texto, ancho, bloque.y, bloque.tamano, bloque.color, bloque.estilo, alpha, resaltadosVisibles)
            }
        }
        if (escena is EscenaResumen.Tiempo) {
            dibujarGraficaTiempo(canvas, ancho, escena.tiempoPorDia, elapsedMs, alpha)
        }
        if (escena is EscenaResumen.DiaFavorito) {
            dibujarDonaDiasFavoritos(canvas, ancho, escena.conteoDias, elapsedMs, alpha)
        }
        if (escena is EscenaResumen.Medalla && escena.nombre != null) {
            dibujarMedalla(canvas, ancho, escena, elapsedMs, alpha)
        }
        if (escena is EscenaResumen.LogrosPersonales) {
            dibujarLogrosPersonales(canvas, ancho, escena, elapsedMs, alpha)
        }
    }

    private fun bloquesPara(escena: EscenaResumen): List<BloqueTexto> = when (escena) {
        is EscenaResumen.Saludo -> {
            val prefijo = "Hola, "
            val texto = prefijo + escena.nombreCliente
            listOf(
                BloqueTexto(
                    texto, inicioMs = 0, duracionMs = 2_000, y = 880f, tamano = 76f, color = Color.WHITE, estilo = Typeface.BOLD,
                    resaltados = listOf(Resaltado(prefijo.length until texto.length, DESTACADO))
                )
            )
        }
        is EscenaResumen.Despedida -> {
            val texto = "Gracias por confiar en nosotros"
            listOf(
                BloqueTexto(
                    texto, inicioMs = 0,
                    duracionMs = (texto.length * VELOCIDAD_SALUDO_MS_POR_CARACTER).toLong(),
                    y = 880f, tamano = 76f, color = Color.WHITE, estilo = Typeface.BOLD
                )
            )
        }
        is EscenaResumen.Asistencia -> {
            val prefijo = "${determinante(escena.unidad, mayuscula = true)} ${escena.unidad} asististe "
            val diasTexto = "${escena.dias} días"
            val texto = prefijo + diasTexto
            listOf(
                BloqueTexto(escena.encabezadoRango, inicioMs = 0, duracionMs = 400, y = 160f, tamano = 44f, color = Color.LTGRAY, estilo = Typeface.NORMAL),
                BloqueTexto(
                    texto,
                    inicioMs = 400,
                    duracionMs = (texto.length * VELOCIDAD_DESTACADO_MS_POR_CARACTER).toLong(),
                    y = 700f, tamano = 84f, color = Color.WHITE, estilo = Typeface.BOLD,
                    resaltados = listOf(Resaltado(prefijo.length until texto.length, DESTACADO))
                ),
                BloqueTexto(
                    comparacion(escena.ranking, "¡Vas primero en asistencias ${determinante(escena.unidad)} ${escena.unidad}!", "asistencias"),
                    inicioMs = 3_400, duracionMs = 800, y = 1500f, tamano = 48f, color = Color.LTGRAY, estilo = Typeface.NORMAL
                )
            )
        }
        is EscenaResumen.Tiempo -> {
            val horas = escena.minutos / 60
            val minutos = escena.minutos % 60
            listOf(
                BloqueTexto("Estuviste en el poderoso Focus un total de", inicioMs = 0, duracionMs = 900, y = 500f, tamano = 44f, color = Color.WHITE, estilo = Typeface.NORMAL),
                BloqueTexto("${horas}h ${minutos}min", inicioMs = 900, duracionMs = 2_400, y = 800f, tamano = 96f, color = DESTACADO, estilo = Typeface.BOLD),
                BloqueTexto(
                    comparacion(escena.ranking, "¡Vas primero en tiempo asistido!", "tiempo asistido"),
                    inicioMs = 4_000, duracionMs = 1_500,
                    y = 1500f + DESPLAZAMIENTO_ABAJO, tamano = 48f, color = Color.LTGRAY, estilo = Typeface.NORMAL
                )
            )
        }
        is EscenaResumen.Esfuerzo -> {
            val prefijoEntrenando = "Estuviste entrenando "
            val tiempoEntrenando = formatoDuracion(escena.desglose.minutosEntrenando)
            val medio = " y descansando "
            val tiempoDescansando = formatoDuracion(escena.desglose.minutosDescansando)
            val texto = prefijoEntrenando + tiempoEntrenando + medio + tiempoDescansando
            val inicioEntrenando = prefijoEntrenando.length
            val finEntrenando = inicioEntrenando + tiempoEntrenando.length
            val inicioDescansando = finEntrenando + medio.length
            val inicioPorcentaje = 900 + (texto.length * VELOCIDAD_DESTACADO_MS_POR_CARACTER).toLong() + 500
            val duracionPorcentaje = 1_200L
            listOf(
                BloqueTexto(
                    "De tu tiempo asistido, ${formatoDuracion(escena.minutosTotales)}",
                    inicioMs = 0, duracionMs = 900, y = 460f, tamano = 44f, color = Color.WHITE, estilo = Typeface.NORMAL
                ),
                BloqueTexto(
                    texto,
                    inicioMs = 900,
                    duracionMs = (texto.length * VELOCIDAD_DESTACADO_MS_POR_CARACTER).toLong(),
                    y = 760f, tamano = 72f, color = Color.WHITE, estilo = Typeface.BOLD,
                    resaltados = listOf(
                        Resaltado(inicioEntrenando until finEntrenando, DESTACADO),
                        Resaltado(inicioDescansando until texto.length, DESTACADO)
                    )
                ),
                BloqueTexto(
                    "Lo cual representa un ${escena.desglose.porcentajeEntrenando}% del total del tiempo",
                    inicioMs = inicioPorcentaje,
                    duracionMs = duracionPorcentaje, y = 1500f, tamano = 48f, color = Color.LTGRAY, estilo = Typeface.NORMAL
                ),
                // Aparece 500ms después de que termina de escribirse la línea del porcentaje.
                // y = 1580 + 10% de la altura del video (1920 * 0.10 = 192), a pedido del trainer.
                BloqueTexto(
                    "No te espantes, lo normal es entre 15% y 25%",
                    inicioMs = inicioPorcentaje + duracionPorcentaje + 500,
                    duracionMs = 1_200, y = 1580f + ALTO_DEFECTO * 0.10f, tamano = 40f, color = Color.LTGRAY, estilo = Typeface.NORMAL
                )
            )
        }
        is EscenaResumen.DiaFavorito -> listOf(
            BloqueTexto(
                mensajeDiaFavorito(escena), inicioMs = 0, duracionMs = 2_200,
                y = 860f - DESPLAZAMIENTO_ARRIBA_DIA_FAVORITO, tamano = 64f, color = Color.WHITE, estilo = Typeface.BOLD
            )
        )
        is EscenaResumen.RachaMasLarga -> listOf(
            BloqueTexto("Tu racha más larga fue de", inicioMs = 0, duracionMs = 300, y = 700f, tamano = 44f, color = Color.WHITE, estilo = Typeface.NORMAL),
            BloqueTexto("${escena.dias} días seguidos", inicioMs = 300, duracionMs = 1_900, y = 1000f, tamano = 88f, color = DESTACADO, estilo = Typeface.BOLD),
            BloqueTexto(
                comparacion(escena.ranking, "¡Vas primero en racha este mes!", "racha"),
                inicioMs = 2_600, duracionMs = 600, y = 1500f, tamano = 48f, color = Color.LTGRAY, estilo = Typeface.NORMAL
            )
        )
        is EscenaResumen.Medalla -> buildList {
            if (escena.nombre != null) {
                add(BloqueTexto("¡Felicidades! Te ganaste:", inicioMs = 0, duracionMs = 1_800, y = 600f, tamano = 56f, color = Color.WHITE, estilo = Typeface.BOLD))
            }
            if (escena.mensaje.isNotBlank()) {
                // Con medalla, el mensaje aparece justo después de que la imagen/insignia
                // terminó su fade (MEDALLA_INICIO_MS + MEDALLA_FADE_MS); sin medalla, es el
                // único contenido de la escena y aparece casi de inmediato. duracionMs = 0
                // lo muestra de golpe (sin máquina de escribir): son mensajes largos y el
                // efecto letra por letra tardaría más que la escena entera.
                val inicioMensaje = if (escena.nombre != null) MEDALLA_INICIO_MS + MEDALLA_FADE_MS + 100 else 400L
                add(
                    BloqueTexto(
                        escena.mensaje, inicioMs = inicioMensaje, duracionMs = 0L,
                        y = if (escena.nombre != null) 1620f else 860f,
                        tamano = if (escena.nombre != null) 38f else 48f,
                        color = if (escena.nombre != null) Color.LTGRAY else Color.WHITE,
                        estilo = Typeface.NORMAL
                    )
                )
            }
        }
        is EscenaResumen.LogrosPersonales -> buildList {
            add(BloqueTexto("Y contra ti mismo, lograste:", inicioMs = 0, duracionMs = 1_800, y = 600f, tamano = 56f, color = Color.WHITE, estilo = Typeface.BOLD))
            // El mensaje sólo cabe legible cuando la escena trae un único logro; con 2 o 3
            // la escena se queda en título + insignias + nombres. Mismo tratamiento que el
            // mensaje de la medalla: duracionMs = 0 lo muestra de golpe, sin máquina de
            // escribir, porque son textos largos.
            val unico = escena.logros.singleOrNull()
            if (unico != null && unico.mensaje.isNotBlank()) {
                add(
                    BloqueTexto(
                        unico.mensaje, inicioMs = MEDALLA_INICIO_MS + MEDALLA_FADE_MS + 100,
                        duracionMs = 0L, y = 1620f, tamano = 38f, color = Color.LTGRAY, estilo = Typeface.NORMAL
                    )
                )
            }
        }
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
        tamano: Float, color: Int, estilo: Int, alpha: Float,
        resaltados: List<Resaltado> = emptyList()
    ) {
        val margen = 80
        val paint = TextPaint().apply {
            isAntiAlias = true
            this.color = color
            this.alpha = (255 * alpha).toInt().coerceIn(0, 255)
            textSize = tamano
            typeface = Typeface.create(Typeface.DEFAULT, estilo)
        }
        val alphaAplicado = (255 * alpha).toInt().coerceIn(0, 255)
        val contenido: CharSequence = if (resaltados.isEmpty()) {
            texto
        } else {
            SpannableStringBuilder(texto).apply {
                resaltados.forEach { resaltado ->
                    val colorConAlpha = Color.argb(
                        alphaAplicado,
                        Color.red(resaltado.color), Color.green(resaltado.color), Color.blue(resaltado.color)
                    )
                    setSpan(
                        ForegroundColorSpan(colorConAlpha),
                        resaltado.rango.first, resaltado.rango.last + 1,
                        android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
            }
        }
        val anchoDisponible = anchoCanvas - margen * 2
        val layout = StaticLayout.Builder
            .obtain(contenido, 0, contenido.length, paint, anchoDisponible)
            .setAlignment(Layout.Alignment.ALIGN_CENTER)
            .build()
        canvas.save()
        canvas.translate(margen.toFloat(), y)
        layout.draw(canvas)
        canvas.restore()
    }

    /**
     * Línea de minutos por día del rango. Un solo trazo, un solo color —el mismo [DESTACADO]
     * del número grande de arriba, para que se lea como parte del mismo dato—, con puntos
     * solo en los días con asistencia real. Eje Y a la izquierda ("Minutos por día", vertical)
     * y eje X abajo con la fecha de cada día en formato dd/MM, también vertical: a esta escala
     * (hasta 31 puntos en un resumen mensual) una etiqueta horizontal por día se encimaría con
     * la siguiente.
     */
    private fun dibujarGraficaTiempo(
        canvas: Canvas, ancho: Int, valores: List<PuntoTiempoDiario>, elapsedMs: Long, alphaEscena: Float
    ) {
        if (valores.size < 2) return
        val maximo = valores.maxOf { it.minutos }
        if (maximo <= 0) return

        val progreso = ((elapsedMs - GRAFICA_INICIO_MS).coerceIn(0L, GRAFICA_FADE_MS)).toFloat() / GRAFICA_FADE_MS
        if (progreso <= 0f) return
        val alphaAplicado = (255 * progreso * alphaEscena).toInt().coerceIn(0, 255)

        // izquierda queda más adentro que el margen general: entre margen y ella van la
        // etiqueta vertical del eje Y y, más cerca de la gráfica, los valores de referencia.
        val margen = 80f
        val izquierda = 170f
        val derecha = ancho - margen
        val arriba = 1060f + DESPLAZAMIENTO_GRAFICA
        val abajo = 1380f + DESPLAZAMIENTO_GRAFICA
        val pasoX = (derecha - izquierda) / (valores.size - 1)
        fun puntoX(indice: Int) = izquierda + pasoX * indice
        fun puntoY(minutos: Int) = abajo - (minutos.toFloat() / maximo) * (abajo - arriba)

        val paintBase = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            alpha = (alphaAplicado * 0.25f).toInt()
            strokeWidth = 2f
        }
        canvas.drawLine(izquierda, abajo, derecha, abajo, paintBase)

        // Valores de referencia del eje Y (p.ej. 30/60/120 min): líneas guía tenues más los
        // minutos exactos a la izquierda, para poder ubicar cualquier punto de la línea sin
        // tener que adivinar la escala.
        val paintGuia = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            alpha = (alphaAplicado * 0.15f).toInt()
            strokeWidth = 2f
        }
        val paintEtiquetaEje = Paint().apply {
            isAntiAlias = true
            color = Color.LTGRAY
            alpha = alphaAplicado
            textSize = 22f
            textAlign = Paint.Align.RIGHT
        }
        calcularValoresReferenciaEje(maximo).forEach { minutosReferencia ->
            val y = puntoY(minutosReferencia)
            canvas.drawLine(izquierda, y, derecha, y, paintGuia)
            canvas.drawText("$minutosReferencia min", izquierda - 12f, y + 8f, paintEtiquetaEje)
        }

        val trazo = Path()
        valores.forEachIndexed { indice, punto ->
            val x = puntoX(indice)
            val y = puntoY(punto.minutos)
            if (indice == 0) trazo.moveTo(x, y) else trazo.lineTo(x, y)
        }
        val paintLinea = Paint().apply {
            isAntiAlias = true
            color = DESTACADO
            alpha = alphaAplicado
            style = Paint.Style.STROKE
            strokeWidth = 5f
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        canvas.drawPath(trazo, paintLinea)

        val paintPunto = Paint().apply {
            isAntiAlias = true
            color = DESTACADO
            alpha = alphaAplicado
            style = Paint.Style.FILL
        }
        valores.forEachIndexed { indice, punto ->
            if (punto.minutos > 0) canvas.drawCircle(puntoX(indice), puntoY(punto.minutos), 8f, paintPunto)
        }

        dibujarTextoVertical(
            canvas, "Minutos por día", x = 60f, y = (arriba + abajo) / 2f,
            tamano = 32f, color = Color.LTGRAY, alphaAplicado = alphaAplicado, alineacion = Paint.Align.CENTER
        )
        valores.forEachIndexed { indice, punto ->
            dibujarTextoVertical(
                canvas, punto.fecha.format(FORMATO_FECHA_EJE), x = puntoX(indice), y = abajo + 12f,
                tamano = 22f, color = Color.LTGRAY, alphaAplicado = alphaAplicado, alineacion = Paint.Align.RIGHT
            )
        }
    }

    /**
     * Valores "redondos" (múltiplos de 5, 10, 15, 30 o 60) para usar como referencia en el eje
     * Y de [dibujarGraficaTiempo], espaciados en pasos regulares desde 0 hasta [maximo]. Con
     * [maximo] chico da algo como 15/30/45 min; con uno grande, 30/60/120 min.
     */
    private fun calcularValoresReferenciaEje(maximo: Int): List<Int> {
        if (maximo <= 0) return emptyList()
        val candidatosPaso = listOf(5, 10, 15, 30, 60, 90, 120, 180, 240)
        val paso = candidatosPaso.firstOrNull { it * 3 >= maximo } ?: candidatosPaso.last()
        return generateSequence(paso) { it + paso }
            .takeWhile { it <= maximo }
            .take(4)
            .toList()
    }

    /** Imagen propia de la medalla si la hay (fade-in), o su insignia por defecto si no, con el
     *  nombre debajo en [DESTACADO]. */
    private fun dibujarMedalla(canvas: Canvas, ancho: Int, escena: EscenaResumen.Medalla, elapsedMs: Long, alphaEscena: Float) {
        val nombre = escena.nombre ?: return
        val progreso = ((elapsedMs - MEDALLA_INICIO_MS).coerceIn(0L, MEDALLA_FADE_MS)).toFloat() / MEDALLA_FADE_MS
        if (progreso <= 0f) return
        val alphaAplicado = (255 * progreso * alphaEscena).toInt().coerceIn(0, 255)

        val centroX = ancho / 2f
        val centroY = 1150f
        val radio = 220f
        val bitmap = escena.imagenPersonalizada
        if (bitmap != null) {
            val destino = RectF(centroX - radio, centroY - radio, centroX + radio, centroY + radio)
            val paintImagen = Paint().apply { isAntiAlias = true; alpha = alphaAplicado }
            canvas.drawBitmap(bitmap, null, destino, paintImagen)
        } else {
            dibujarInsignia(
                canvas, centroX, centroY, radio,
                colorInsignia = escena.categoria?.let { COLOR_INSIGNIA_MEDALLA[it] } ?: 0xFFB0B0B0.toInt(),
                glifo = escena.categoria?.name?.first()?.toString() ?: "★",
                alphaAplicado = alphaAplicado
            )
        }

        dibujarTextoCentradoMultilinea(
            canvas, listOf(nombre), centroX, centroY + radio + 90f,
            tamano = 44f, color = DESTACADO, alphaAplicado = alphaAplicado
        )
    }

    /** Insignia por defecto cuando no hay imagen propia: un círculo de [colorInsignia] con
     *  [glifo] al centro. La medalla pasa el color/inicial de su categoría; los logros
     *  personales, un color de la paleta pastel y una estrella. */
    private fun dibujarInsignia(
        canvas: Canvas, cx: Float, cy: Float, radio: Float,
        colorInsignia: Int, glifo: String, alphaAplicado: Int
    ) {
        val paintCirculo = Paint().apply { isAntiAlias = true; color = colorInsignia; alpha = alphaAplicado; style = Paint.Style.FILL }
        canvas.drawCircle(cx, cy, radio, paintCirculo)
        val paintGlifo = Paint().apply {
            isAntiAlias = true; color = NEGRO; alpha = alphaAplicado; textSize = radio
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD); textAlign = Paint.Align.CENTER
        }
        canvas.drawText(glifo, cx, cy + radio * 0.35f, paintGlifo)
    }

    /**
     * Con un solo logro, mismo layout que la medalla (insignia grande centrada, nombre debajo,
     * y el mensaje lo dibuja lineasDeEscena, o sea bloquesPara). Con 2 o 3, insignias más
     * chicas repartidas a lo ancho, cada una entrando 500ms después de la anterior.
     */
    private fun dibujarLogrosPersonales(
        canvas: Canvas, ancho: Int, escena: EscenaResumen.LogrosPersonales,
        elapsedMs: Long, alphaEscena: Float
    ) {
        val cantidad = escena.logros.size
        if (cantidad == 0) return
        val unico = cantidad == 1
        val radio = if (unico) 220f else 130f
        val centroY = if (unico) 1150f else 1100f

        escena.logros.forEachIndexed { indice, logro ->
            val inicio = if (unico) MEDALLA_INICIO_MS else 1_200L + indice * 500L
            val progreso = ((elapsedMs - inicio).coerceIn(0L, MEDALLA_FADE_MS)).toFloat() / MEDALLA_FADE_MS
            if (progreso <= 0f) return@forEachIndexed
            val alphaAplicado = (255 * progreso * alphaEscena).toInt().coerceIn(0, 255)

            // Columnas de ancho igual: la insignia i queda en el centro de la columna i.
            val anchoColumna = ancho.toFloat() / cantidad
            val centroX = anchoColumna * (indice + 0.5f)

            val bitmap = logro.imagen
            if (bitmap != null) {
                val destino = RectF(centroX - radio, centroY - radio, centroX + radio, centroY + radio)
                val paintImagen = Paint().apply { isAntiAlias = true; alpha = alphaAplicado }
                canvas.drawBitmap(bitmap, null, destino, paintImagen)
            } else {
                dibujarInsignia(
                    canvas, centroX, centroY, radio,
                    colorInsignia = DONA_PALETA_PASTEL[indice % DONA_PALETA_PASTEL.size],
                    glifo = "★",
                    alphaAplicado = alphaAplicado
                )
            }

            dibujarTextoCentradoMultilinea(
                canvas, listOf(logro.nombre), centroX, centroY + radio + (if (unico) 90f else 60f),
                tamano = if (unico) 44f else 28f, color = DESTACADO, alphaAplicado = alphaAplicado
            )
        }
    }

    /**
     * Dona con cuántas veces se hizo cada día de la rutina en el rango. Cada rebanada usa un
     * color distinto de [DONA_PALETA_PASTEL] (día con más repeticiones primero) y lleva su
     * nombre y conteo como etiqueta directa en ese mismo color.
     */
    private fun dibujarDonaDiasFavoritos(
        canvas: Canvas, ancho: Int, conteo: List<ConteoDiaRutina>, elapsedMs: Long, alphaEscena: Float
    ) {
        if (conteo.isEmpty()) return
        val total = conteo.sumOf { it.veces }
        if (total <= 0) return

        val progreso = ((elapsedMs - DONA_INICIO_MS).coerceIn(0L, DONA_FADE_MS)).toFloat() / DONA_FADE_MS
        if (progreso <= 0f) return
        val alphaAplicado = (255 * progreso * alphaEscena).toInt().coerceIn(0, 255)

        val centroX = ancho / 2f
        val centroY = 1320f - DESPLAZAMIENTO_ARRIBA_DIA_FAVORITO + DESPLAZAMIENTO_ABAJO_DONA_DIA_FAVORITO - DESPLAZAMIENTO_ARRIBA_DONA_ADICIONAL
        val radioExterior = 260f
        val radioInterior = 150f
        val radioMedio = (radioExterior + radioInterior) / 2f
        val grosor = radioExterior - radioInterior
        // Separación visual entre rebanadas (el "surface gap" entre rellenos adyacentes);
        // sin espacio si solo hay una rebanada, para que se vea como un círculo completo.
        val gapGrados = if (conteo.size > 1) 3f else 0f

        val rect = RectF(centroX - radioMedio, centroY - radioMedio, centroX + radioMedio, centroY + radioMedio)
        val paintArco = Paint().apply {
            isAntiAlias = true
            style = Paint.Style.STROKE
            strokeWidth = grosor
        }

        var anguloInicio = -90f
        conteo.forEachIndexed { indice, dia ->
            val color = DONA_PALETA_PASTEL[indice % DONA_PALETA_PASTEL.size]
            val sweep = (dia.veces.toFloat() / total) * 360f
            val sweepDibujado = (sweep - gapGrados).coerceAtLeast(0f)
            paintArco.color = color
            paintArco.alpha = alphaAplicado
            canvas.drawArc(rect, anguloInicio + gapGrados / 2f, sweepDibujado, false, paintArco)

            // La etiqueta se separó de la rebanada (antes pegada al borde) y se conecta con
            // una flecha delgada, para que nombres largos ("Hombro, bíceps y tríceps") tengan
            // espacio y no se encimen entre sí ni con la dona.
            val anguloMedioRad = Math.toRadians((anguloInicio + sweep / 2f).toDouble())
            val radioEtiqueta = radioExterior + 190f
            val xEtiqueta = centroX + (radioEtiqueta * cos(anguloMedioRad)).toFloat()
            val yEtiqueta = centroY + (radioEtiqueta * sin(anguloMedioRad)).toFloat()

            // La flecha se acortó 20% (de 120px a 96px), dejando su punta más lejos de la
            // etiqueta que antes; la etiqueta no se movió de donde estaba.
            val radioInicioFlecha = radioExterior + 15f
            val radioFinFlecha = radioInicioFlecha + LARGO_FLECHA_ETIQUETA
            dibujarFlechaEtiqueta(
                canvas,
                x1 = centroX + (radioInicioFlecha * cos(anguloMedioRad)).toFloat(),
                y1 = centroY + (radioInicioFlecha * sin(anguloMedioRad)).toFloat(),
                x2 = centroX + (radioFinFlecha * cos(anguloMedioRad)).toFloat(),
                y2 = centroY + (radioFinFlecha * sin(anguloMedioRad)).toFloat(),
                color = color, alphaAplicado = alphaAplicado
            )

            val renglones = partirNombreDia(dia.nombreDia).toMutableList()
            renglones[renglones.lastIndex] = "${renglones.last()} ×${dia.veces}"
            dibujarTextoCentradoMultilinea(canvas, renglones, xEtiqueta, yEtiqueta, tamano = 30f, color = color, alphaAplicado = alphaAplicado)
            anguloInicio += sweep
        }
    }

    /**
     * Parte [nombreDia] en dos renglones si supera [DONA_LARGO_MAXIMO_UNA_LINEA] caracteres,
     * cortando por el espacio más cercano a la mitad (o, si no hay espacios, a los
     * [DONA_LARGO_MAXIMO_UNA_LINEA] caracteres) para no cortar una palabra a la mitad.
     */
    private fun partirNombreDia(nombreDia: String): List<String> {
        if (nombreDia.length <= DONA_LARGO_MAXIMO_UNA_LINEA) return listOf(nombreDia)
        val medio = nombreDia.length / 2
        val indiceEspacio = nombreDia.indices
            .filter { nombreDia[it] == ' ' }
            .minByOrNull { kotlin.math.abs(it - medio) }
        return if (indiceEspacio == null) {
            listOf(nombreDia.substring(0, DONA_LARGO_MAXIMO_UNA_LINEA), nombreDia.substring(DONA_LARGO_MAXIMO_UNA_LINEA))
        } else {
            listOf(nombreDia.substring(0, indiceEspacio).trim(), nombreDia.substring(indiceEspacio + 1).trim())
        }
    }

    /** Línea delgada de ([x1], [y1]) a ([x2], [y2]) con una punta de flecha leve en el
     *  extremo de la etiqueta, conectando cada rebanada de [dibujarDonaDiasFavoritos] con
     *  su nombre ya separado de la dona. */
    private fun dibujarFlechaEtiqueta(
        canvas: Canvas, x1: Float, y1: Float, x2: Float, y2: Float, color: Int, alphaAplicado: Int
    ) {
        val paint = Paint().apply {
            isAntiAlias = true
            this.color = color
            alpha = alphaAplicado
            style = Paint.Style.STROKE
            strokeWidth = 3f
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawLine(x1, y1, x2, y2, paint)
        val angulo = atan2(y2 - y1, x2 - x1)
        val largoPunta = 14f
        val aberturaPunta = Math.toRadians(25.0)
        canvas.drawLine(x2, y2, x2 - largoPunta * cos(angulo - aberturaPunta).toFloat(), y2 - largoPunta * sin(angulo - aberturaPunta).toFloat(), paint)
        canvas.drawLine(x2, y2, x2 - largoPunta * cos(angulo + aberturaPunta).toFloat(), y2 - largoPunta * sin(angulo + aberturaPunta).toFloat(), paint)
    }

    /** Dibuja [renglones] centrados horizontalmente en [x], apilados y centrados
     *  verticalmente alrededor de [y]. Usado para las etiquetas de las rebanadas de
     *  [dibujarDonaDiasFavoritos], que pueden ser uno o dos renglones. */
    private fun dibujarTextoCentradoMultilinea(
        canvas: Canvas, renglones: List<String>, x: Float, y: Float, tamano: Float, color: Int, alphaAplicado: Int
    ) {
        val paint = Paint().apply {
            isAntiAlias = true
            this.color = color
            alpha = alphaAplicado
            textSize = tamano
            typeface = Typeface.DEFAULT
            textAlign = Paint.Align.CENTER
        }
        val alturaRenglon = tamano * 1.2f
        val yPrimero = y - alturaRenglon * (renglones.size - 1) / 2f
        renglones.forEachIndexed { indice, renglon ->
            canvas.drawText(renglon, x, yPrimero + alturaRenglon * indice + tamano * 0.35f, paint)
        }
    }

    /** Dibuja [texto] rotado 90° en sentido antihorario (se lee de abajo hacia arriba),
     *  anclado en ([x], [y]) según [alineacion]. Usado para las etiquetas de los ejes de
     *  [dibujarGraficaTiempo], donde una etiqueta horizontal por punto no entra. */
    private fun dibujarTextoVertical(
        canvas: Canvas, texto: String, x: Float, y: Float,
        tamano: Float, color: Int, alphaAplicado: Int, alineacion: Paint.Align
    ) {
        val paint = Paint().apply {
            isAntiAlias = true
            this.color = color
            alpha = alphaAplicado
            textSize = tamano
            typeface = Typeface.DEFAULT
            textAlign = alineacion
        }
        canvas.save()
        canvas.translate(x, y)
        canvas.rotate(-90f)
        canvas.drawText(texto, 0f, 0f, paint)
        canvas.restore()
    }
}
