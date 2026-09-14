package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.AvisoFaltaWebRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.domain.RutinaProgressCalculator
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch

class ClientesListViewModel(
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository,
    private val avisoFaltaWebRepository: AvisoFaltaWebRepository = AppContainer.avisoFaltaWebRepository
) : ViewModel() {

    val clientes: StateFlow<List<Cliente>> = clienteRepository.observarClientes()
        .map { lista -> lista.sortedBy { !it.activo } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Día del ciclo que le toca a cada cliente, deducido del historial de asistencias. */
    val diaQueTocaPorCliente: StateFlow<Map<String, Int>> =
        combine(clientes, asistenciaRepository.observarTodasAsistencias()) { lista, asistencias ->
            val hoy = LocalDate.now().toString()
            val porCliente = asistencias.groupBy { it.clienteId }
            lista.associate { cliente ->
                cliente.id to RutinaProgressCalculator.diaQueToca(
                    cliente, porCliente[cliente.id].orEmpty(), hoy
                )
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    /**
     * El día que la lista está pintando. Lo empuja la pantalla desde `rememberFechaActual()`,
     * que ya despierta sola a medianoche: así, si el entrenador deja la app abierta toda la
     * noche, el resaltado amarillo se apaga al cambiar el día en vez de quedarse pegado.
     */
    private val fechaVisible = MutableStateFlow(LocalDate.now().toString())

    fun fijarFecha(fecha: String) {
        fechaVisible.value = fecha
    }

    /**
     * clienteIds que avisaron **hoy** que no vienen.
     *
     * `flatMapLatest` y no `combine`: al cambiar el día hay que rehacer la consulta a
     * Firestore con la fecha nueva, no combinar la vieja con nada.
     */
    @OptIn(ExperimentalCoroutinesApi::class)
    val avisaronQueNoVienen: StateFlow<Set<String>> = fechaVisible
        .flatMapLatest { fecha -> avisoFaltaWebRepository.observarPorFecha(fecha) }
        .map { avisos -> avisos.map { it.clienteId }.toSet() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptySet())

    private val _errorValidacion = MutableStateFlow<String?>(null)
    val errorValidacion: StateFlow<String?> = _errorValidacion.asStateFlow()

    fun crearCliente(nombre: String, telefono: String) {
        if (nombre.isBlank()) {
            _errorValidacion.value = "El nombre es obligatorio"
            return
        }
        _errorValidacion.value = null
        viewModelScope.launch {
            clienteRepository.crearCliente(nombre.trim(), telefono.trim())
        }
    }

    fun limpiarError() {
        _errorValidacion.value = null
    }
}
