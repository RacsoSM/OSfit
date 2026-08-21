package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Pago
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.RutinaRepository
import com.osfit.app.domain.RachaCalculator
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ClienteDetailViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val pagoRepository: PagoRepository = AppContainer.pagoRepository,
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository
) : ViewModel() {

    val cliente: StateFlow<Cliente?> = clienteRepository.observarCliente(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val pagos: StateFlow<List<Pago>> = pagoRepository.observarPagos(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val plantillasDisponibles: StateFlow<List<Rutina>> = rutinaRepository.observarRutinas()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val rachaActual: StateFlow<Int> = asistenciaRepository.observarAsistenciasPorCliente(clienteId)
        .map { asistencias ->
            val fechas = asistencias.filter { it.asistio }.map { LocalDate.parse(it.fecha) }.toSet()
            RachaCalculator.calcularRachaActual(fechas, LocalDate.now())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _errorPago = MutableStateFlow<String?>(null)
    val errorPago: StateFlow<String?> = _errorPago.asStateFlow()

    private val _eliminado = MutableStateFlow(false)
    val eliminado: StateFlow<Boolean> = _eliminado.asStateFlow()

    fun registrarPago(monto: Double, fecha: Timestamp, fechaProximoPago: Timestamp, nota: String) {
        if (monto <= 0.0) {
            _errorPago.value = "El monto debe ser mayor a 0"
            return
        }
        _errorPago.value = null
        viewModelScope.launch {
            pagoRepository.registrarPago(clienteId, monto, fecha, fechaProximoPago, nota)
        }
    }

    fun limpiarErrorPago() {
        _errorPago.value = null
    }

    fun asignarRutina(rutina: Rutina) {
        viewModelScope.launch {
            clienteRepository.asignarRutina(clienteId, rutina)
        }
    }

    fun actualizarActivo(activo: Boolean) {
        viewModelScope.launch {
            clienteRepository.actualizarActivo(clienteId, activo)
        }
    }

    fun asignarDiaActual(diaIndex: Int) {
        viewModelScope.launch {
            clienteRepository.actualizarDiaActual(clienteId, diaIndex)
        }
    }

    fun asignarProximoPago(fecha: Timestamp) {
        viewModelScope.launch {
            clienteRepository.actualizarProximoPago(clienteId, fecha)
        }
    }

    fun eliminarCliente() {
        viewModelScope.launch {
            clienteRepository.eliminarCliente(clienteId)
            _eliminado.value = true
        }
    }
}
