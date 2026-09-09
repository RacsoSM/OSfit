package com.osfit.app.ui.configvideo

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.repository.ConfigVideoRepository
import com.osfit.app.domain.PeriodosQuincenales
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.video.PaletaVideo
import com.osfit.app.video.PaletasVideo
import java.time.LocalDate
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Un periodo de la lista, ya resuelto: el Composable no hace lookups. */
data class PeriodoConPaleta(
    val rangoInicio: String,
    val encabezado: String,
    val paleta: PaletaVideo,
    val esActual: Boolean
)

class ConfigVideoViewModel(
    private val repositorio: ConfigVideoRepository = AppContainer.configVideoRepository
) : ViewModel() {

    // Se fija una sola vez al crear el ViewModel: si se recalculara en cada emisión, la lista
    // podría cambiar de largo bajo los pies del usuario al cruzar la medianoche del día 16.
    private val hoy = LocalDate.now()
    private val periodoActual = ResumenClienteCalculator.rangoQuincenal(hoy).inicio.toString()

    val periodos: StateFlow<List<PeriodoConPaleta>> = repositorio.observarTodas()
        .map { paletasPorPeriodo -> construir(paletasPorPeriodo) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), construir(emptyMap()))

    fun asignar(rangoInicio: String, paletaId: String) {
        viewModelScope.launch { repositorio.guardar(rangoInicio, paletaId) }
    }

    private fun construir(paletasPorPeriodo: Map<String, String>): List<PeriodoConPaleta> =
        PeriodosQuincenales.ultimos(hoy).map { rango ->
            val rangoInicio = rango.inicio.toString()
            PeriodoConPaleta(
                rangoInicio = rangoInicio,
                encabezado = rango.encabezado,
                paleta = PaletasVideo.porId(paletasPorPeriodo[rangoInicio]),
                esActual = rangoInicio == periodoActual
            )
        }
}
