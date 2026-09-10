package com.osfit.app.ui.calendario

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.SincronizadorDiaWeb
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
import java.time.LocalDate

class TomarAsistenciaViewModel(
    private val fecha: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository,
    private val sincronizadorDiaWeb: SincronizadorDiaWeb = AppContainer.sincronizadorDiaWeb
) : ViewModel() {

    val esHoy: Boolean = fecha == LocalDate.now().toString()

    val clientesActivos: StateFlow<List<Cliente>> = clienteRepository.observarClientes()
        .map { lista -> lista.filter { it.activo } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Historial completo: hace falta para deducir qué día le toca a cada cliente, ya que
    // esa respuesta ahora sale de los registros de asistencia y no de un campo del cliente.
    private val todasAsistencias: StateFlow<List<Asistencia>> = asistenciaRepository.observarTodasAsistencias()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val asistenciasDelDia: StateFlow<List<Asistencia>> = todasAsistencias
        .map { lista -> lista.filter { it.fecha == fecha } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Día del ciclo que le toca a cada cliente en la fecha abierta. */
    val diaQueTocaPorCliente: StateFlow<Map<String, Int>> =
        combine(clientesActivos, todasAsistencias) { clientes, asistencias ->
            val porCliente = asistencias.groupBy { it.clienteId }
            clientes.associate { cliente ->
                cliente.id to RutinaProgressCalculator.diaQueToca(
                    cliente, porCliente[cliente.id].orEmpty(), fecha
                )
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    private fun diaQueToca(cliente: Cliente): Int = RutinaProgressCalculator.diaQueToca(
        cliente, todasAsistencias.value.filter { it.clienteId == cliente.id }, fecha
    )

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

    private val _reiniciando = MutableStateFlow(false)
    val reiniciando: StateFlow<Boolean> = _reiniciando

    fun marcar(cliente: Cliente, asistio: Boolean) {
        cambiosPendientes.value = cambiosPendientes.value + (cliente.id to asistio)
    }

    fun marcarDiaRealizado(cliente: Cliente, diaIndex: Int) {
        cambiosDiaPendientes.value = cambiosDiaPendientes.value + (cliente.id to diaIndex)
    }

    fun iniciarTiempo(cliente: Cliente) {
        viewModelScope.launch {
            asistenciaRepository.iniciarTiempo(
                clienteId = cliente.id,
                fecha = fecha,
                diaRutinaRealizado = diaQueToca(cliente)
            )
            sincronizadorDiaWeb.refrescar(cliente.id, fecha)
        }
    }

    fun detenerTiempo(cliente: Cliente) {
        viewModelScope.launch {
            asistenciaRepository.detenerTiempo(cliente.id, fecha)
        }
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
                        asistenciaRepository.registrarAsistencia(
                            clienteId = cliente.id,
                            fecha = fecha,
                            asistio = asistio,
                            diaRutinaRealizado = if (asistio) diaQueToca(cliente) else null,
                            nota = ""
                        )
                        sincronizadorDiaWeb.refrescar(cliente.id, fecha)
                    }
                }.awaitAll()
            }
            _guardando.value = false
            onCompletado()
        }
    }

    fun reiniciarDia(onCompletado: () -> Unit) {
        viewModelScope.launch {
            _reiniciando.value = true
            asistenciaRepository.reiniciarDia(fecha)
            sincronizadorDiaWeb.refrescarTodos(fecha)
            cambiosPendientes.value = emptyMap()
            cambiosDiaPendientes.value = emptyMap()
            _reiniciando.value = false
            onCompletado()
        }
    }

    fun guardarCambiosDia(onCompletado: () -> Unit) {
        viewModelScope.launch {
            _guardandoDia.value = true
            val cambios = cambiosDiaPendientes.value
            coroutineScope {
                cambios.map { (clienteId, diaElegido) ->
                    async {
                        // Solo se corrige el registro: al ser la fuente de verdad, el día
                        // que le toca al cliente se recalcula solo a partir de él.
                        asistenciaRepository.actualizarDiaRealizado(clienteId, fecha, diaElegido)
                        sincronizadorDiaWeb.refrescar(clienteId, fecha)
                    }
                }.awaitAll()
            }
            cambiosDiaPendientes.value = emptyMap()
            _guardandoDia.value = false
            onCompletado()
        }
    }
}
