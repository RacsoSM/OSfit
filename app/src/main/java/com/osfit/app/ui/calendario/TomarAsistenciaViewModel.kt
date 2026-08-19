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
import kotlinx.coroutines.flow.combine
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

    private val cambiosPendientes = MutableStateFlow<Map<String, Boolean>>(emptyMap())

    val estadoPorCliente: StateFlow<Map<String, Boolean>> =
        combine(asistenciasDelDia, cambiosPendientes) { asistencias, pendientes ->
            asistencias.associate { it.clienteId to it.asistio } + pendientes
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    private val _guardando = MutableStateFlow(false)
    val guardando: StateFlow<Boolean> = _guardando

    fun marcar(cliente: Cliente, asistio: Boolean) {
        cambiosPendientes.value = cambiosPendientes.value + (cliente.id to asistio)
    }

    fun guardarTodo(onCompletado: () -> Unit) {
        viewModelScope.launch {
            _guardando.value = true
            val estado = estadoPorCliente.value
            clientesActivos.value.forEach { cliente ->
                val asistio = estado[cliente.id] ?: false
                asistenciaRepository.registrarAsistencia(
                    clienteId = cliente.id,
                    fecha = fecha,
                    asistio = asistio,
                    diaActualIndexPrevio = cliente.diaActualIndex,
                    diaRutinaRealizado = if (asistio) cliente.diaActualIndex else null,
                    totalDiasRutina = cliente.rutinaAsignada?.dias?.size ?: 1
                )
            }
            _guardando.value = false
            onCompletado()
        }
    }
}
