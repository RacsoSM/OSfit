package com.osfit.app.ui.sandbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.fake.FakeAsistenciaRepository
import com.osfit.app.data.fake.FakeClienteRepository
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.domain.AsignarDiaManual
import com.osfit.app.domain.RutinaProgressCalculator
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate

/**
 * ViewModel de la pantalla "sandbox": permite a un desarrollador simular el avance de días
 * y probar el cómputo de día efectivo de rutina sin tocar Firebase. Todo el estado vive en
 * repositorios falsos (Fake*Repository), enteramente en memoria.
 */
class SandboxViewModel : ViewModel() {

    // Envueltos en un StateFlow (en vez de simples `var`) para que reiniciarSandbox() pueda
    // sustituir la instancia y que los flujos derivados (clientes, asistenciasDelDia), que ya
    // fueron suscritos con flatMapLatest, reaccionen y se vuelvan a suscribir al repo nuevo.
    private val _repos = MutableStateFlow(FakeClienteRepository() to FakeAsistenciaRepository())
    private val clienteRepository: FakeClienteRepository get() = _repos.value.first
    private val asistenciaRepository: FakeAsistenciaRepository get() = _repos.value.second

    private val _simulatedFecha = MutableStateFlow(LocalDate.now())
    val simulatedFecha: StateFlow<LocalDate> = _simulatedFecha

    @OptIn(ExperimentalCoroutinesApi::class)
    val clientes: StateFlow<List<Cliente>> = _repos
        .flatMapLatest { (clienteRepo, _) -> clienteRepo.observarClientes() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val todasAsistencias: StateFlow<List<Asistencia>> =
        _repos.flatMapLatest { (_, asistenciaRepo) -> asistenciaRepo.observarTodasAsistencias() }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val asistenciasDelDia: StateFlow<List<Asistencia>> =
        combine(_simulatedFecha, todasAsistencias) { fecha, asistencias ->
            asistencias.filter { it.fecha == fecha.toString() }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Día del ciclo que le toca a cada cliente en la fecha simulada. */
    val diaQueTocaPorCliente: StateFlow<Map<String, Int>> =
        combine(clientes, todasAsistencias, _simulatedFecha) { lista, asistencias, fecha ->
            val porCliente = asistencias.groupBy { it.clienteId }
            lista.associate { cliente ->
                cliente.id to RutinaProgressCalculator.diaQueToca(
                    cliente, porCliente[cliente.id].orEmpty(), fecha.toString()
                )
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    fun marcar(cliente: Cliente, asistio: Boolean) {
        viewModelScope.launch {
            val fecha = _simulatedFecha.value.toString()
            asistenciaRepository.registrarAsistencia(
                clienteId = cliente.id,
                fecha = fecha,
                asistio = asistio,
                diaRutinaRealizado = if (asistio) diaQueTocaDe(cliente) else null,
                nota = ""
            )
        }
    }

    private fun diaQueTocaDe(cliente: Cliente): Int = RutinaProgressCalculator.diaQueToca(
        cliente,
        asistenciasDeCliente(cliente.id),
        _simulatedFecha.value.toString()
    )

    private fun asistenciasDeCliente(clienteId: String): List<Asistencia> =
        todasAsistencias.value.filter { it.clienteId == clienteId }

    fun iniciarTiempo(cliente: Cliente) {
        viewModelScope.launch {
            asistenciaRepository.iniciarTiempo(
                clienteId = cliente.id,
                fecha = _simulatedFecha.value.toString(),
                diaRutinaRealizado = diaQueTocaDe(cliente)
            )
        }
    }

    /** Mismo camino que el botón "Asignar día" en Clientes, contra la fecha simulada. */
    fun asignarDiaActual(cliente: Cliente, diaIndex: Int) {
        viewModelScope.launch {
            AsignarDiaManual.ejecutar(
                clienteRepository = clienteRepository,
                asistenciaRepository = asistenciaRepository,
                clienteId = cliente.id,
                diaIndex = diaIndex,
                hoy = _simulatedFecha.value.toString()
            )
        }
    }

    fun pasarDia() {
        // Solo mueve la fecha simulada; no toca ningún dato guardado. Así se puede observar
        // cómo RutinaProgressCalculator.diaEfectivo reevalúa el día pendiente contra el nuevo "hoy".
        _simulatedFecha.value = _simulatedFecha.value.plusDays(1)
    }

    fun reiniciarSandbox() {
        _repos.value = FakeClienteRepository() to FakeAsistenciaRepository()
        _simulatedFecha.value = LocalDate.now()
    }
}
