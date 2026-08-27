package com.osfit.app.video

import android.content.Context
import com.osfit.app.domain.ResumenClienteData
import com.osfit.app.domain.TipoResumen
import com.osfit.app.util.CompartirUtil
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object ResumenVideoGenerator {

    private const val SEGUNDOS_POR_TARJETA = 8
    private const val VIDA_UTIL_MS = 60 * 60 * 1000L

    suspend fun generarYCompartir(context: Context, resumen: ResumenClienteData) {
        // Dibujar 3-4 bitmaps de 1080x1920 con StaticLayout no puede pasar por el hilo
        // principal: quien llama lo hace desde un scope de Compose (Dispatchers.Main) y
        // `generar` recién cambia de dispatcher internamente.
        // El timestamp evita que dos generaciones que lleguen a solaparse (por ejemplo una
        // huérfana que siga corriendo) escriban el mismo archivo con dos MediaMuxer a la vez.
        val ahora = System.currentTimeMillis()
        val carpeta = File(context.cacheDir, "resumenes")
        val salida = File(carpeta, "${resumen.cliente.id}_${resumen.rango.tipo}_$ahora.mp4")
        val tarjetas = withContext(Dispatchers.Default) {
            borrarResumenesViejos(carpeta, ahora)
            construirTarjetas(resumen).map { ResumenCardRenderer.renderizar(it) }
        }
        ResumenVideoEncoder.generar(
            tarjetas = tarjetas,
            segundosPorTarjeta = SEGUNDOS_POR_TARJETA,
            context = context,
            salida = salida
        )
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

    fun construirTarjetas(resumen: ResumenClienteData): List<TarjetaResumen> {
        val unidad = if (resumen.rango.tipo == TipoResumen.SEMANAL) "semana" else "mes"
        val tarjetas = mutableListOf<TarjetaResumen>(
            TarjetaResumen.Asistencia(
                encabezado = resumen.rango.encabezado,
                nombreCliente = resumen.cliente.nombre,
                dias = resumen.diasAsistidos,
                unidad = unidad,
                ranking = resumen.rankingAsistencia
            ),
            TarjetaResumen.Tiempo(
                minutos = resumen.minutosEnGym,
                ranking = resumen.rankingTiempo
            ),
            TarjetaResumen.DiaFavorito(
                nombreDia = resumen.diaFavoritoNombre,
                unidad = unidad,
                diasAsistidos = resumen.diasAsistidos
            )
        )
        val racha = resumen.rachaMasLarga
        val rankingRacha = resumen.rankingRacha
        if (resumen.rango.tipo == TipoResumen.MENSUAL && racha != null && rankingRacha != null) {
            tarjetas += TarjetaResumen.RachaMasLarga(dias = racha, ranking = rankingRacha)
        }
        return tarjetas
    }
}
