package com.osfit.app.ui.calendario

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import java.time.YearMonth

class CalendarioViewModel(
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository
) : ViewModel() {

    private val _mesVisible = MutableStateFlow(YearMonth.now())
    val mesVisible: StateFlow<YearMonth> = _mesVisible.asStateFlow()

    /**
     * Todos, también los inactivos: un día pasado se pinta contra los clientes que había ese día
     * (`AsistenciaCalendario`), y quien ya se fue también contaba entonces.
     */
    val clientes: StateFlow<List<Cliente>> = clienteRepository.observarClientes()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /**
     * Todas las asistencias y no solo las del mes: la primera y la última de cada cliente dicen
     * desde y hasta cuándo contaba, porque no siempre hay fecha de ingreso y no se guarda la de
     * baja. Son pocos cientos de documentos y el SDK solo vuelve a pedir lo que cambia.
     */
    val asistencias: StateFlow<List<Asistencia>> = asistenciaRepository.observarTodasAsistencias()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun cambiarMes(mes: YearMonth) {
        _mesVisible.value = mes
    }
}
