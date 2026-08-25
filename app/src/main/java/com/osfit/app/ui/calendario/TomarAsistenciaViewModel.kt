package com.osfit.app.ui.calendario

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.domain.RutinaProgressCalculator
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
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

    private val cambiosDiaPendientes = MutableStateFlow<Map<String, Int>>(emptyMap())

    val diaRealizadoPorCliente: StateFlow<Map<String, Int>> =
        combine(asistenciasDelDia, cambiosDiaPendientes) { asistencias, pendientes ->
            asistencias.mapNotNull { asistencia ->
                asistencia.diaRutinaRealizado?.let { asistencia.clienteId to it }
            }.toMap() + pendientes
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    private val _guardando = MutableStateFlow(false)
    val guardando: StateFlow<Boolean> = _guardando

    private val _guardandoDia = MutableStateFlow(false)
    val guardandoDia: StateFlow<Boolean> = _guardandoDia

    fun marcar(cliente: Cliente, asistio: Boolean) {
        cambiosPendientes.value = cambiosPendientes.value + (cliente.id to asistio)
    }

    fun marcarDiaRealizado(cliente: Cliente, diaIndex: Int) {
        cambiosDiaPendientes.value = cambiosDiaPendientes.value + (cliente.id to diaIndex)
    }

    fun guardarTodo(onCompletado: () -> Unit) {
        viewModelScope.launch {
            _guardando.value = true
            val pendientes = cambiosPendientes.value
            val yaRegistrados = asistenciasDelDia.value.map { it.clienteId }.toSet()
            coroutineScope {
                clientesActivos.value.mapNotNull { cliente ->
                    // Solo se escribe si el entrenador lo tocó en esta sesión, o si el cliente
                    // todavía no tiene registro para esta fecha (línea base "Faltó"). Así nunca
                    // se pisa una asistencia ya guardada por una lectura desincronizada del listener.
                    val asistio = pendientes[cliente.id]
                        ?: if (cliente.id in yaRegistrados) return@mapNotNull null else false
                    cliente to asistio
                }.map { (cliente, asistio) ->
                    async {
                        val diaEfectivo = RutinaProgressCalculator.diaEfectivo(cliente)
                        asistenciaRepository.registrarAsistencia(
                            clienteId = cliente.id,
                            fecha = fecha,
                            asistio = asistio,
                            diaActualIndexPrevio = diaEfectivo,
                            diaRutinaRealizado = if (asistio) diaEfectivo else null,
                            totalDiasRutina = cliente.rutinaAsignada?.dias?.size ?: 1,
                            diaPendienteFechaActual = cliente.diaPendienteFecha
                        )
                    }
                }.awaitAll()
            }
            _guardando.value = false
            onCompletado()
        }
    }

    fun guardarCambiosDia(onCompletado: () -> Unit) {
        viewModelScope.launch {
            _guardandoDia.value = true
            val cambios = cambiosDiaPendientes.value
            coroutineScope {
                clientesActivos.value.mapNotNull { cliente ->
                    val diaElegido = cambios[cliente.id] ?: return@mapNotNull null
                    val totalDias = cliente.rutinaAsignada?.dias?.size ?: return@mapNotNull null
                    Triple(cliente.id, diaElegido, totalDias)
                }.map { (clienteId, diaElegido, totalDias) ->
                    async {
                        asistenciaRepository.actualizarDiaRealizado(clienteId, fecha, diaElegido)
                        val siguiente = (diaElegido + 1).let { if (it >= totalDias) 0 else it }
                        clienteRepository.actualizarDiaActual(clienteId, siguiente)
                    }
                }.awaitAll()
            }
            cambiosDiaPendientes.value = emptyMap()
            _guardandoDia.value = false
            onCompletado()
        }
    }
}
