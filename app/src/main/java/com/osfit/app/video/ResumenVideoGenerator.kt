package com.osfit.app.video

import android.content.Context
import com.osfit.app.domain.ResumenClienteData
import com.osfit.app.domain.TipoResumen
import com.osfit.app.util.CancionUtil
import com.osfit.app.util.CompartirUtil
import java.io.File
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object ResumenVideoGenerator {

    private const val FPS = 30
    private const val VIDA_UTIL_MS = 60 * 60 * 1000L
    private val FORMATO_DIA_MES = DateTimeFormatter.ofPattern("d 'de' MMMM", Locale("es"))

    suspend fun generarYCompartir(
        context: Context,
        resumen: ResumenClienteData,
        onProgreso: (Float) -> Unit = {}
    ) {
        // El timestamp evita que dos generaciones que lleguen a solaparse (por ejemplo una
        // huérfana que siga corriendo) escriban el mismo archivo con dos MediaMuxer a la vez.
        val ahora = System.currentTimeMillis()
        val carpeta = File(context.cacheDir, "resumenes")
        val salida = File(carpeta, "${resumen.cliente.id}_${resumen.rango.tipo}_$ahora.mp4")
        val timeline = withContext(Dispatchers.Default) {
            borrarResumenesViejos(carpeta, ahora)
            TimelineResumen(construirEscenas(resumen))
        }
        // Una instancia de fondo por generación: su bitmap y sus paints son estado mutable,
        // y dos generaciones solapadas se corromperían los frames si lo compartieran.
        val fondo = FondoBlobRenderer()
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
            ResumenFrameRenderer.dibujarFrame(canvas, timeline, fondo, tiempoMs)
        }
        CompartirUtil.compartirVideo(context, salida)
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

    fun construirEscenas(resumen: ResumenClienteData): List<EscenaResumen> {
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
                diasAsistidos = resumen.diasAsistidos
            )
        )
        val racha = resumen.rachaMasLarga
        val rankingRacha = resumen.rankingRacha
        val incluyeRacha = resumen.rango.tipo == TipoResumen.MENSUAL || resumen.rango.tipo == TipoResumen.QUINCENAL
        if (incluyeRacha && racha != null && rankingRacha != null) {
            escenas += EscenaResumen.RachaMasLarga(dias = racha, ranking = rankingRacha)
        }
        escenas += EscenaResumen.Despedida
        return escenas
    }
}
