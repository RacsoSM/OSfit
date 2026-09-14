package com.osfit.app.video

import android.content.Context
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.domain.ResumenClienteData
import com.osfit.app.domain.TipoResumen
import com.osfit.app.util.CancionUtil
import com.osfit.app.util.CompartirUtil
import com.osfit.app.util.LogroPersonalImagenUtil
import com.osfit.app.util.MedallaImagenUtil
import java.io.File
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * El mp4 recién generado y su duración. Se devuelve para que publicar en la web reuse este
 * mismo archivo en vez de volver a codificarlo: regenerar cuesta una codificación entera y
 * podría dar un video distinto del que el entrenador acaba de ver al compartirlo.
 */
data class ResumenGenerado(val archivo: File, val duracionSegundos: Int)

object ResumenVideoGenerator {

    private const val FPS = 30
    private const val VIDA_UTIL_MS = 60 * 60 * 1000L
    private val FORMATO_DIA_MES = DateTimeFormatter.ofPattern("d 'de' MMMM", Locale("es"))
    private const val MENSAJE_SIN_MEDALLA =
        "La verdad es que no hiciste nada muy relevante en este periodo pero no te quise dejar sin medalla así que, te tocó esta."

    suspend fun generarYCompartir(
        context: Context,
        resumen: ResumenClienteData,
        medallaOtorgada: MedallaCatalogo? = null,
        logrosOtorgados: List<LogroPersonalCatalogo> = emptyList(),
        onProgreso: (Float) -> Unit = {}
    ): ResumenGenerado {
        // El timestamp evita que dos generaciones que lleguen a solaparse (por ejemplo una
        // huérfana que siga corriendo) escriban el mismo archivo con dos MediaMuxer a la vez.
        val ahora = System.currentTimeMillis()
        val carpeta = File(context.cacheDir, "resumenes")
        val salida = File(carpeta, "${resumen.cliente.id}_${resumen.rango.tipo}_$ahora.mp4")
        val medallaEscena = when {
            medallaOtorgada != null -> EscenaResumen.Medalla(
                nombre = medallaOtorgada.nombre,
                categoria = medallaOtorgada.categoria,
                imagenPersonalizada = MedallaImagenUtil.cargarBitmapPropio(context, medallaOtorgada),
                mensaje = personalizarMensaje(medallaOtorgada.mensaje, resumen.cliente.nombre)
            )
            // Solo la quincena pasa por el flujo de confirmación de medalla (ver
            // ConfirmarMedallaDialog): semanal y mensual nunca llegan acá con medallaOtorgada
            // null "a propósito", así que no deben mostrar el mensaje de consuelo.
            resumen.rango.tipo == TipoResumen.QUINCENAL -> EscenaResumen.Medalla(
                nombre = null,
                categoria = null,
                imagenPersonalizada = null,
                mensaje = personalizarMensaje(MENSAJE_SIN_MEDALLA, resumen.cliente.nombre)
            )
            else -> null
        }
        // Los bitmaps se decodifican acá, donde hay Context, y se agrupan de a 3: así el
        // ResumenFrameRenderer sigue sin depender de Context, igual que con la medalla.
        val escenasDeLogros = logrosOtorgados
            .map { logro ->
                EscenaResumen.LogroEnEscena(
                    nombre = logro.nombre,
                    imagen = LogroPersonalImagenUtil.cargarBitmapPropio(context, logro),
                    mensaje = personalizarMensaje(logro.mensaje, resumen.cliente.nombre)
                )
            }
            .chunked(3)
            .map { grupo -> EscenaResumen.LogrosPersonales(grupo) }
        val timeline = withContext(Dispatchers.Default) {
            borrarResumenesViejos(carpeta, ahora)
            TimelineResumen(construirEscenas(resumen, medallaEscena, escenasDeLogros))
        }
        // Una sola lectura por video, no una por frame: la paleta es del periodo y no cambia
        // mientras se genera.
        val paleta = AppContainer.configVideoRepository.paletaDe(resumen.rango.inicio.toString())
        // Una instancia de fondo por generación: su bitmap y sus paints son estado mutable,
        // y dos generaciones solapadas se corromperían los frames si lo compartieran.
        val fondo = FondoBlobRenderer(paleta)
        val cancionArchivo = resumen.cliente.cancionArchivo
        ResumenVideoEncoder.generar(
            duracionTotalMs = timeline.duracionTotalMs,
            fps = FPS,
            context = context,
            salida = salida,
            archivoMusica = cancionArchivo?.let { CancionUtil.archivoCancion(context, it) },
            inicioMusicaSegundos = resumen.cliente.cancionInicioSegundos ?: 0,
            onProgreso = onProgreso
        ) { canvas, tiempoMs ->
            ResumenFrameRenderer.dibujarFrame(canvas, timeline, fondo, tiempoMs, paleta)
        }
        CompartirUtil.compartirVideo(context, salida)
        // Se redondea hacia arriba: la duración sólo rotula el video en la web y truncar
        // dejaría el último segundo empezado fuera de la cuenta.
        val duracionSegundos = ((timeline.duracionTotalMs + 999) / 1000).toInt()
        return ResumenGenerado(salida, duracionSegundos)
    }

    /**
     * Como el nombre del archivo ahora lleva timestamp, ya no se sobrescribe solo: se borran
     * los videos viejos para que el caché no crezca sin límite. Se respeta la última hora
     * para no borrarle el archivo a un share sheet todavía abierto.
     */
    private fun borrarResumenesViejos(carpeta: File, ahora: Long) {
        val limite = ahora - VIDA_UTIL_MS
        runCatching {
            carpeta.listFiles()?.forEach { archivo ->
                if (archivo.isFile && archivo.lastModified() < limite) archivo.delete()
            }
        }
    }

    private fun personalizarMensaje(mensaje: String, nombreCliente: String): String =
        mensaje.replace("\$nombrePersona", nombreCliente)

    fun construirEscenas(
        resumen: ResumenClienteData,
        medalla: EscenaResumen.Medalla? = null,
        logrosPersonales: List<EscenaResumen.LogrosPersonales> = emptyList()
    ): List<EscenaResumen> {
        val unidad = when (resumen.rango.tipo) {
            TipoResumen.SEMANAL -> "semana"
            TipoResumen.QUINCENAL -> "quincena"
            TipoResumen.MENSUAL -> "mes"
        }
        val encabezadoRango = if (resumen.rango.tipo == TipoResumen.SEMANAL) {
            "Semana del ${resumen.rango.inicio.format(FORMATO_DIA_MES)} al ${resumen.rango.fin.format(FORMATO_DIA_MES)}"
        } else {
            resumen.rango.encabezado
        }
        val escenas = mutableListOf<EscenaResumen>(
            EscenaResumen.Saludo(nombreCliente = resumen.cliente.nombre),
            EscenaResumen.Asistencia(
                encabezadoRango = encabezadoRango,
                dias = resumen.diasAsistidos,
                unidad = unidad,
                ranking = resumen.rankingAsistencia
            ),
            EscenaResumen.Tiempo(
                minutos = resumen.minutosEnGym,
                ranking = resumen.rankingTiempo,
                tiempoPorDia = resumen.tiempoPorDia
            )
        )
        val desglose = resumen.desgloseEsfuerzo
        if (desglose != null) {
            escenas += EscenaResumen.Esfuerzo(
                minutosTotales = resumen.minutosEnGym,
                desglose = desglose
            )
        }
        escenas += listOf(
            EscenaResumen.DiaFavorito(
                nombreDia = resumen.diaFavoritoNombre,
                unidad = unidad,
                diasAsistidos = resumen.diasAsistidos,
                conteoDias = resumen.conteoDias
            )
        )
        val racha = resumen.rachaMasLarga
        val rankingRacha = resumen.rankingRacha
        val incluyeRacha = resumen.rango.tipo == TipoResumen.MENSUAL || resumen.rango.tipo == TipoResumen.QUINCENAL
        if (incluyeRacha && racha != null && rankingRacha != null) {
            escenas += EscenaResumen.RachaMasLarga(dias = racha, ranking = rankingRacha)
        }
        // Primero la medalla grupal (cómo le fue contra los demás), después el reconocimiento
        // personal como cierre: el video termina con lo suyo y no con la comparación.
        // Los logros ya vienen agrupados de a 3 desde generarYCompartir.
        if (medalla != null) escenas += medalla
        escenas += logrosPersonales
        escenas += EscenaResumen.Despedida
        return escenas
    }
}
