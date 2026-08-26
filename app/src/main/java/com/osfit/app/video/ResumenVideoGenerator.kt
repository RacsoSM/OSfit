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

    suspend fun generarYCompartir(context: Context, resumen: ResumenClienteData) {
        // Dibujar 3-4 bitmaps de 1080x1920 con StaticLayout no puede pasar por el hilo
        // principal: quien llama lo hace desde un scope de Compose (Dispatchers.Main) y
        // `generar` recién cambia de dispatcher internamente.
        val tarjetas = withContext(Dispatchers.Default) {
            construirTarjetas(resumen).map { ResumenCardRenderer.renderizar(it) }
        }
        val salida = File(context.cacheDir, "resumenes/${resumen.cliente.id}_${resumen.rango.tipo}.mp4")
        ResumenVideoEncoder.generar(
            tarjetas = tarjetas,
            segundosPorTarjeta = SEGUNDOS_POR_TARJETA,
            context = context,
            salida = salida
        )
        CompartirUtil.compartirVideo(context, salida)
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
                unidad = unidad
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
