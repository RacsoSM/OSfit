package com.osfit.app.ui.configvideo

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.repository.ConfigVideoRepository
import com.osfit.app.data.repository.ConfigVideoGuardada
import com.osfit.app.domain.PeriodosQuincenales
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.paletas.Paleta
import com.osfit.app.data.repository.ConfigVideoResuelta
import com.osfit.app.video.EstiloVideo
import java.time.LocalDate
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Un periodo de la lista, ya resuelto: el Composable no hace lookups. */
data class PeriodoConConfig(
    val rangoInicio: String,
    val encabezado: String,
    val paleta: Paleta,
    val estilo: EstiloVideo,
    val esActual: Boolean
)

class ConfigVideoViewModel(
    private val repositorio: ConfigVideoRepository = AppContainer.configVideoRepository
) : ViewModel() {

    // Se fija una sola vez al crear el ViewModel: si se recalculara en cada emisión, la lista
    // podría cambiar de largo bajo los pies del usuario al cruzar la medianoche del día 16.
    private val hoy = LocalDate.now()
    private val periodoActual = ResumenClienteCalculator.rangoQuincenal(hoy).inicio.toString()

    val periodos: StateFlow<List<PeriodoConConfig>> = repositorio.observarTodas()
        .map { configPorPeriodo -> construir(configPorPeriodo) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), construir(emptyMap()))

    fun asignarPaleta(rangoInicio: String, paletaId: String) {
        viewModelScope.launch { repositorio.guardarPaleta(rangoInicio, paletaId) }
    }

    fun asignarEstilo(rangoInicio: String, estiloId: String) {
        viewModelScope.launch { repositorio.guardarEstilo(rangoInicio, estiloId) }
    }

    private fun construir(configPorPeriodo: Map<String, ConfigVideoGuardada>): List<PeriodoConConfig> =
        PeriodosQuincenales.ultimos(hoy).map { rango ->
            val rangoInicio = rango.inicio.toString()
            val config = ConfigVideoResuelta.desde(configPorPeriodo[rangoInicio])
            PeriodoConConfig(
                rangoInicio = rangoInicio,
                encabezado = rango.encabezado,
                paleta = config.paleta,
                estilo = config.estilo,
                esActual = rangoInicio == periodoActual
            )
        }
}
