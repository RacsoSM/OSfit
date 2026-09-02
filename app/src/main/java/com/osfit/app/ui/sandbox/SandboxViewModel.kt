package com.osfit.app.ui.sandbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.fake.FakeAsistenciaRepository
import com.osfit.app.data.fake.FakeClienteRepository
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
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
    private val _repos = MutableStateFlow(FakeClienteRepository().let { cliente ->
        cliente to FakeAsistenciaRepository(cliente)
    })
    private val clienteRepository: FakeClienteRepository get() = _repos.value.first
    private val asistenciaRepository: FakeAsistenciaRepository get() = _repos.value.second

    private val _simulatedFecha = MutableStateFlow(LocalDate.now())
    val simulatedFecha: StateFlow<LocalDate> = _simulatedFecha

    @OptIn(ExperimentalCoroutinesApi::class)
    val clientes: StateFlow<List<Cliente>> = _repos
        .flatMapLatest { (clienteRepo, _) -> clienteRepo.observarClientes() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val asistenciasDelDia: StateFlow<List<Asistencia>> =
        combine(
            _simulatedFecha,
            _repos.flatMapLatest { (_, asistenciaRepo) -> asistenciaRepo.observarTodasAsistencias() }
        ) { fecha, asistencias ->
            asistencias.filter { it.fecha == fecha.toString() }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun marcar(cliente: Cliente, asistio: Boolean) {
        viewModelScope.launch {
            val fecha = _simulatedFecha.value.toString()
            val diaEfectivo = RutinaProgressCalculator.diaEfectivo(
                cliente.diaActualIndex,
                cliente.diaPendienteIndex,
                cliente.diaPendienteFecha,
                fecha
            )
            asistenciaRepository.registrarAsistencia(
                clienteId = cliente.id,
                fecha = fecha,
                asistio = asistio,
                diaActualIndexPrevio = diaEfectivo,
                diaRutinaRealizado = if (asistio) diaEfectivo else null,
                totalDiasRutina = cliente.rutinaAsignada?.dias?.size ?: 1,
                diaPendienteFechaActual = cliente.diaPendienteFecha,
                nota = ""
            )
        }
    }

    fun iniciarTiempo(cliente: Cliente) {
        viewModelScope.launch {
            val fecha = _simulatedFecha.value.toString()
            val diaEfectivo = RutinaProgressCalculator.diaEfectivo(
                cliente.diaActualIndex,
                cliente.diaPendienteIndex,
                cliente.diaPendienteFecha,
                fecha
            )
            asistenciaRepository.iniciarTiempo(
                clienteId = cliente.id,
                fecha = fecha,
                diaActualIndexPrevio = diaEfectivo,
                totalDiasRutina = cliente.rutinaAsignada?.dias?.size ?: 1
            )
        }
    }

    fun pasarDia() {
        // Solo mueve la fecha simulada; no toca ningún dato guardado. Así se puede observar
        // cómo RutinaProgressCalculator.diaEfectivo reevalúa el día pendiente contra el nuevo "hoy".
        _simulatedFecha.value = _simulatedFecha.value.plusDays(1)
    }

    fun reiniciarSandbox() {
        val clienteRepoNuevo = FakeClienteRepository()
        _repos.value = clienteRepoNuevo to FakeAsistenciaRepository(clienteRepoNuevo)
        _simulatedFecha.value = LocalDate.now()
    }
}
