package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.model.MedallaOtorgada
import com.osfit.app.data.model.Pago
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.RutinaRepository
import com.osfit.app.domain.AsignarDiaManual
import com.osfit.app.domain.RachaCalculator
import com.osfit.app.domain.RutinaProgressCalculator
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ClienteDetailViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val pagoRepository: PagoRepository = AppContainer.pagoRepository,
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository,
    private val medallaRepository: MedallaRepository = AppContainer.medallaRepository
) : ViewModel() {

    init {
        viewModelScope.launch { medallaRepository.asegurarCategoriasAutomaticas() }
    }

    val cliente: StateFlow<Cliente?> = clienteRepository.observarCliente(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val catalogoMedallas: StateFlow<List<MedallaCatalogo>> = medallaRepository.observarCatalogo()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val medallasOtorgadas: StateFlow<List<MedallaOtorgada>> = medallaRepository.observarOtorgadas(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val pagos: StateFlow<List<Pago>> = pagoRepository.observarPagos(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val plantillasDisponibles: StateFlow<List<Rutina>> = rutinaRepository.observarRutinas()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val asistenciasDelCliente = asistenciaRepository.observarAsistenciasPorCliente(clienteId)

    /** Día del ciclo que le toca, deducido del historial de asistencias. */
    val diaQueToca: StateFlow<Int> = combine(cliente, asistenciasDelCliente) { c, asistencias ->
        if (c == null) 0 else RutinaProgressCalculator.diaQueToca(c, asistencias)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val rachaActual: StateFlow<Int> = asistenciaRepository.observarAsistenciasPorCliente(clienteId)
        .map { asistencias ->
            RachaCalculator.calcularRachaActual(RachaCalculator.fechasQueCuentan(asistencias), LocalDate.now())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    /** Faltas del cliente, de la más reciente a la más vieja: lo que se puede sobornar. */
    val faltas: StateFlow<List<Asistencia>> = asistenciasDelCliente
        .map { asistencias -> asistencias.filterNot { it.asistio }.sortedByDescending { it.fecha } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Soborno: marca o desmarca una falta como justificada. */
    fun alternarSoborno(asistencia: Asistencia) {
        viewModelScope.launch {
            asistenciaRepository.justificarFalta(clienteId, asistencia.fecha, !asistencia.justificada)
        }
    }

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

    fun actualizarDatosPersonales(
        nombre: String,
        telefono: String,
        peso: Double?,
        altura: Double?,
        edad: Int?,
        segundosPorEjercicio: Int?,
        minutosDescanso: Double?
    ) {
        viewModelScope.launch {
            clienteRepository.actualizarDatosPersonales(
                clienteId, nombre, telefono, peso, altura, edad, segundosPorEjercicio, minutosDescanso
            )
        }
    }

    fun actualizarActivo(activo: Boolean) {
        viewModelScope.launch {
            clienteRepository.actualizarActivo(clienteId, activo)
        }
    }

    fun actualizarCancion(archivo: String?, inicioSegundos: Int?) {
        viewModelScope.launch {
            clienteRepository.actualizarCancion(clienteId, archivo, inicioSegundos)
        }
    }

    fun asignarDiaActual(diaIndex: Int) {
        viewModelScope.launch {
            AsignarDiaManual.ejecutar(
                clienteRepository = clienteRepository,
                asistenciaRepository = asistenciaRepository,
                clienteId = clienteId,
                diaIndex = diaIndex,
                hoy = LocalDate.now().toString()
            )
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

    /** Otorga una insignia fuera del flujo de resumen quincenal (directo desde "Logros"). Como
     *  [MedallaOtorgada] usa `rangoInicio` como id de documento (pensado para upsert por
     *  quincena), acá se genera uno único por timestamp para no pisar otras otorgadas el mismo
     *  día. */
    fun otorgarMedalla(medalla: MedallaCatalogo) {
        viewModelScope.launch {
            medallaRepository.otorgarMedalla(
                clienteId,
                MedallaOtorgada(
                    rangoInicio = "manual_${System.currentTimeMillis()}",
                    medallaId = medalla.id,
                    nombreMedalla = medalla.nombre,
                    encabezadoRango = "Otorgada manualmente el ${LocalDate.now()}",
                    fueAjustadaManualmente = true
                )
            )
        }
    }

    fun quitarMedalla(otorgada: MedallaOtorgada) {
        viewModelScope.launch { medallaRepository.quitarMedalla(clienteId, otorgada.rangoInicio) }
    }
}
