package com.osfit.app.ui.calendario

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class TomarAsistenciaViewModel(
    private val fecha: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository
) : ViewModel() {

    val clientesActivos: StateFlow<List<Cliente>> = clienteRepository.observarClientes()
        .map { lista -> lista.filter { it.activo } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val asistenciasDelDia: StateFlow<List<Asistencia>> = asistenciaRepository.observarAsistenciasPorFecha(fecha)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun marcarAsistio(cliente: Cliente, diaRealizado: Int) {
        val totalDias = cliente.rutinaAsignada?.dias?.size ?: return
        viewModelScope.launch {
            asistenciaRepository.registrarAsistencia(
                clienteId = cliente.id,
                fecha = fecha,
                asistio = true,
                diaActualIndexPrevio = cliente.diaActualIndex,
                diaRutinaRealizado = diaRealizado,
                totalDiasRutina = totalDias
            )
        }
    }

    fun marcarFalto(cliente: Cliente) {
        viewModelScope.launch {
            asistenciaRepository.registrarAsistencia(
                clienteId = cliente.id,
                fecha = fecha,
                asistio = false,
                diaActualIndexPrevio = cliente.diaActualIndex,
                diaRutinaRealizado = null,
                totalDiasRutina = cliente.rutinaAsignada?.dias?.size ?: 1
            )
        }
    }
}
