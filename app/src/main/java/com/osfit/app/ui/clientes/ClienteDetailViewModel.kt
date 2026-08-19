package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Pago
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.RutinaRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ClienteDetailViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val pagoRepository: PagoRepository = AppContainer.pagoRepository,
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository
) : ViewModel() {

    val cliente: StateFlow<Cliente?> = clienteRepository.observarCliente(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val pagos: StateFlow<List<Pago>> = pagoRepository.observarPagos(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val plantillasDisponibles: StateFlow<List<Rutina>> = rutinaRepository.observarRutinas()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _errorPago = MutableStateFlow<String?>(null)
    val errorPago: StateFlow<String?> = _errorPago.asStateFlow()

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
}
