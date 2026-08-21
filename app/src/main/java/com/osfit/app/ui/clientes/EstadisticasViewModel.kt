package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.RecordPersonal
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.RecordPersonalRepository
import com.osfit.app.domain.RachaCalculator
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class EstadisticasUiState(
    val rachaActual: Int = 0,
    val rachaMasLarga: Int = 0,
    val diasTotalesAsistidos: Int = 0,
    val diaFavoritoIndex: Int? = null,
    val diaFavoritoNombre: String? = null,
    val ejercicioFavorito: String? = null,
    val diasDesdeIngreso: Int? = null
)

class EstadisticasViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository,
    private val recordPersonalRepository: RecordPersonalRepository = AppContainer.recordPersonalRepository
) : ViewModel() {

    val cliente: StateFlow<Cliente?> = clienteRepository.observarCliente(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val records: StateFlow<List<RecordPersonal>> = recordPersonalRepository.observarRecords(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val asistencias: StateFlow<List<Asistencia>> = asistenciaRepository.observarAsistenciasPorCliente(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val uiState: StateFlow<EstadisticasUiState> = combine(cliente, asistencias) { clienteActual, listaAsistencias ->
        val hoy = LocalDate.now()
        val fechasAsistidas = listaAsistencias.filter { it.asistio }.map { LocalDate.parse(it.fecha) }.toSet()
        val diaFavoritoEfectivo = clienteActual?.diaFavoritoIndex ?: RachaCalculator.diaFavorito(listaAsistencias)
        EstadisticasUiState(
            rachaActual = RachaCalculator.calcularRachaActual(fechasAsistidas, hoy),
            rachaMasLarga = RachaCalculator.calcularRachaMasLarga(fechasAsistidas),
            diasTotalesAsistidos = RachaCalculator.diasTotalesAsistidos(listaAsistencias),
            diaFavoritoIndex = diaFavoritoEfectivo,
            diaFavoritoNombre = diaFavoritoEfectivo?.let { indice ->
                clienteActual?.rutinaAsignada?.dias?.getOrNull(indice)?.nombreDia
            },
            ejercicioFavorito = diaFavoritoEfectivo?.let { indice ->
                clienteActual?.ejercicioFavoritoPorDia?.get(indice.toString())
            },
            diasDesdeIngreso = clienteActual?.fechaIngreso?.let { fecha ->
                RachaCalculator.diasDesdeIngreso(fecha.toLocalDate(), hoy)
            }
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), EstadisticasUiState())

    fun actualizarFechaIngreso(fecha: Timestamp) {
        viewModelScope.launch {
            clienteRepository.actualizarFechaIngreso(clienteId, fecha)
        }
    }

    fun guardarEjercicioFavorito(diaIndex: Int, ejercicio: String) {
        viewModelScope.launch {
            clienteRepository.actualizarEjercicioFavorito(clienteId, diaIndex, ejercicio)
        }
    }

    fun cambiarDiaFavorito(diaIndex: Int) {
        viewModelScope.launch {
            clienteRepository.actualizarDiaFavorito(clienteId, diaIndex)
        }
    }

    fun registrarRecord(ejercicio: String, marca: String, fecha: Timestamp) {
        viewModelScope.launch {
            recordPersonalRepository.registrarRecord(clienteId, ejercicio, marca, fecha)
        }
    }

    fun eliminarRecord(recordId: String) {
        viewModelScope.launch {
            recordPersonalRepository.eliminarRecord(clienteId, recordId)
        }
    }
}

private fun Timestamp.toLocalDate(): LocalDate =
    toDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate()
