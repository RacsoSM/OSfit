package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.osfit.app.data.AppContainer
import com.osfit.app.data.SincronizadorDiaWeb
import com.osfit.app.data.model.AccesoWeb
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.LogroPersonalOtorgado
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.model.MedallaOtorgada
import com.osfit.app.data.model.Pago
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.AccesoWebRepository
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.LogroPersonalRepository
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.RutinaRepository
import com.osfit.app.domain.AsignarDiaManual
import com.osfit.app.domain.CupoRevivesCalculator
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
    private val medallaRepository: MedallaRepository = AppContainer.medallaRepository,
    private val logroPersonalRepository: LogroPersonalRepository = AppContainer.logroPersonalRepository,
    private val sincronizadorDiaWeb: SincronizadorDiaWeb = AppContainer.sincronizadorDiaWeb,
    private val accesoWebRepository: AccesoWebRepository = AppContainer.accesoWebRepository
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

    val catalogoLogrosPersonales: StateFlow<List<LogroPersonalCatalogo>> =
        logroPersonalRepository.observarCatalogo()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val logrosPersonalesOtorgados: StateFlow<List<LogroPersonalOtorgado>> =
        logroPersonalRepository.observarOtorgados(clienteId)
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

    /**
     * Revives que le quedan al cliente este mes. El mes sale de la zona del gimnasio y no del
     * dispositivo: la Cloud Function cuenta el cupo en esa zona, y si el entrenador contara en
     * otro mes vería un número distinto al de la página del cliente — justo la discusión que
     * este dato existe para zanjar.
     */
    val revivesDisponibles: StateFlow<Int> = asistenciasDelCliente
        .map { asistencias ->
            CupoRevivesCalculator.disponiblesEnElMes(asistencias, SincronizadorDiaWeb.hoy().substring(0, 7))
        }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5000),
            CupoRevivesCalculator.MAXIMO_POR_MES
        )

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
            // Cambiar de rutina cambia la cantidad de días, así que el día denormalizado
            // puede quedar fuera de rango.
            sincronizadorDiaWeb.refrescar(clienteId)
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
                hoy = LocalDate.now().toString(),
                sincronizador = sincronizadorDiaWeb
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
                    imagenUrl = medalla.imagenUrl,
                    encabezadoRango = "Otorgada manualmente el ${LocalDate.now()}",
                    fueAjustadaManualmente = true
                )
            )
        }
    }

    fun quitarMedalla(otorgada: MedallaOtorgada) {
        viewModelScope.launch { medallaRepository.quitarMedalla(clienteId, otorgada.rangoInicio) }
    }

    /** Otorga un logro personal fuera del flujo del resumen quincenal. Usa un rangoInicio
     *  sintético por timestamp para que el doc id compuesto no choque con los de una quincena
     *  real — mismo recurso que [otorgarMedalla]. */
    fun otorgarLogroPersonal(logro: LogroPersonalCatalogo) {
        viewModelScope.launch {
            val rangoInicio = "manual_${System.currentTimeMillis()}"
            logroPersonalRepository.otorgarLogros(
                clienteId,
                rangoInicio,
                listOf(
                    LogroPersonalOtorgado(
                        id = "${rangoInicio}_${logro.id}",
                        rangoInicio = rangoInicio,
                        logroId = logro.id,
                        nombreLogro = logro.nombre,
                        imagenUrl = logro.imagenUrl,
                        mensaje = logro.mensaje,
                        encabezadoRango = "Otorgado manualmente el ${LocalDate.now()}",
                        orden = 0
                    )
                )
            )
        }
    }

    fun quitarLogroPersonal(otorgado: LogroPersonalOtorgado) {
        viewModelScope.launch { logroPersonalRepository.quitarLogro(clienteId, otorgado.id) }
    }

    val accesoWeb: StateFlow<AccesoWeb?> = accesoWebRepository.observarAcceso(clienteId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** Crea el acceso si hace falta y devuelve el token para compartirlo. Idempotente. */
    suspend fun asegurarAccesoWeb(): String {
        // Antes de nada, garantizar que el día denormalizado exista: un cliente dado de alta
        // antes de esta función no tiene los campos escritos, y la web no los puede calcular.
        // Compartir es justo el momento en que hacen falta, y refrescar es idempotente.
        sincronizadorDiaWeb.refrescar(clienteId)
        val token = accesoWebRepository.crearAcceso(clienteId)
        clienteRepository.actualizarTieneAccesoWeb(clienteId, true)
        return token
    }

    fun revocarAccesoWeb() {
        viewModelScope.launch {
            accesoWeb.value?.let { accesoWebRepository.revocarAcceso(it.token) }
            clienteRepository.actualizarTieneAccesoWeb(clienteId, false)
        }
    }
}
