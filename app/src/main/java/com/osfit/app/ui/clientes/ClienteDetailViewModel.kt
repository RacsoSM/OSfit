package com.osfit.app.ui.clientes

import android.util.Log
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
import com.osfit.app.data.model.VideoPublicado
import com.osfit.app.data.repository.AccesoWebRepository
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.CancionStorageRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.LogroPersonalRepository
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.data.repository.PagoRepository
import com.osfit.app.data.repository.ResumenStorageRepository
import com.osfit.app.data.repository.RutinaRepository
import com.osfit.app.data.repository.VideoPublicadoRepository
import com.osfit.app.domain.AsignarDiaManual
import com.osfit.app.domain.CupoRevivesCalculator
import com.osfit.app.domain.RachaCalculator
import com.osfit.app.domain.RutinaProgressCalculator
import com.osfit.app.domain.VariacionCalculator
import com.osfit.app.domain.totalVariaciones
import java.io.File
import java.time.LocalDate
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
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
    private val accesoWebRepository: AccesoWebRepository = AppContainer.accesoWebRepository,
    private val videoPublicadoRepository: VideoPublicadoRepository = AppContainer.videoPublicadoRepository,
    private val resumenStorageRepository: ResumenStorageRepository = AppContainer.resumenStorageRepository,
    private val cancionStorageRepository: CancionStorageRepository = AppContainer.cancionStorageRepository
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

    /**
     * Índice del ciclo → variación que le toca hoy en ese día. Se calcula para todos los días,
     * no sólo el de hoy, porque la tarjeta Web los lista todos y el entrenador quiere ver cuál
     * le va a tocar en cada uno.
     *
     * Mira `rutinaAsignada` porque las variaciones sólo existen en rutina propia, y ahí esa
     * copia es la verdad. Quien sigue una plantilla no tiene ninguna y todo da 0.
     */
    val variacionQueTocaPorDia: StateFlow<Map<Int, Int>> =
        combine(cliente, asistenciasDelCliente) { c, asistencias ->
            val dias = c?.rutinaAsignada?.dias.orEmpty()
            val hoy = LocalDate.now().toString()
            dias.indices.associateWith { indice ->
                VariacionCalculator.variacionQueToca(
                    diaDelCiclo = indice,
                    asistenciasDelCliente = asistencias,
                    hoy = hoy,
                    totalVariaciones = totalVariaciones(dias[indice])
                )
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

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

    /**
     * Guardar los ejercicios de un día convierte al cliente a rutina propia. La pantalla ya
     * avisó y el entrenador ya aceptó: acá solo se persiste.
     *
     * No se refresca el día denormalizado, a diferencia de `asignarRutina`: la cantidad de días
     * no cambia al editar los ejercicios de uno, así que el día no puede quedar fuera de rango.
     */
    fun guardarRutinaPropia(rutina: Rutina) {
        viewModelScope.launch {
            clienteRepository.guardarRutinaPropia(clienteId, rutina)
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

    fun actualizarCancion(archivo: String?, ruta: String?, inicioSegundos: Int?) {
        viewModelScope.launch {
            clienteRepository.actualizarCancion(clienteId, archivo, ruta, inicioSegundos)
        }
    }

    /**
     * Ruta del último respaldo que terminó bien, para que la pantalla de edición la mande en
     * el guardado si el entrenador sigue ahí. Que valga null no significa "sin respaldo": es
     * "todavía no subió nada en esta sesión".
     */
    private val _cancionRutaRespaldada = MutableStateFlow<String?>(null)
    val cancionRutaRespaldada: StateFlow<String?> = _cancionRutaRespaldada.asStateFlow()

    /**
     * Sube la copia local a Storage y guarda la ruta.
     *
     * Corre en [viewModelScope] y no en el `rememberCoroutineScope` de la pantalla: allí,
     * guardar y salir cancelaba el alcance con la subida en vuelo, y esa subida podía llegar
     * igual a Storage mientras el documento quedaba con `cancionRuta` nula — un respaldo que
     * existe y que el restaurador nunca iría a buscar. Escribir la ruta desde acá deja de
     * depender de que la pantalla siga viva.
     *
     * Se escribe sólo `cancionRuta` porque es el único campo que este camino posee: el nombre
     * del archivo y el inicio son del botón Guardar, y esta escritura puede caer después.
     *
     * Si la subida falla se registra y ya: la copia local está y el video funciona. Esa
     * canción se queda sin respaldo hasta que se vuelva a elegir, que es lo que dice el spec.
     */
    fun respaldarCancion(archivo: File) {
        viewModelScope.launch {
            runCatching { cancionStorageRepository.subir(clienteId, archivo) }
                .onSuccess { ruta ->
                    _cancionRutaRespaldada.value = ruta
                    runCatching { clienteRepository.actualizarCancionRuta(clienteId, ruta) }
                        .onFailure { Log.w(TAG, "No se pudo guardar la ruta de la canción", it) }
                }
                .onFailure { Log.w(TAG, "No se pudo respaldar la canción de $clienteId", it) }
        }
    }

    fun asignarDiaActual(diaIndex: Int) {
        viewModelScope.launch {
            val hoy = LocalDate.now().toString()
            // La variación se calcula acá y se pasa: corregir el día deja la guardada apuntando
            // a la rotación del día viejo. El repositorio no conoce la rutina ni el historial.
            val clienteActual = cliente.value
            val variacion = clienteActual?.let { c ->
                VariacionCalculator.variacionQueToca(
                    diaDelCiclo = diaIndex,
                    asistenciasDelCliente = asistenciasDelCliente.first(),
                    hoy = hoy,
                    totalVariaciones = totalVariaciones(c.rutinaAsignada?.dias?.getOrNull(diaIndex))
                )
            }
            AsignarDiaManual.ejecutar(
                clienteRepository = clienteRepository,
                asistenciaRepository = asistenciaRepository,
                clienteId = clienteId,
                diaIndex = diaIndex,
                hoy = hoy,
                sincronizador = sincronizadorDiaWeb,
                variacionRealizada = variacion
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

    /** Lo que la clienta ve publicado en su página, ya ordenado de la quincena más reciente
     *  a la más vieja por el repositorio. */
    val videosPublicados: StateFlow<List<VideoPublicado>> =
        videoPublicadoRepository.observarDe(clienteId)
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /**
     * Borra primero el blob de Storage y recién después el documento de Firestore, igual que
     * la retención automática en `ResumenClienteViewModel.limpiarSobrantes`: el borrado no es
     * atómico entre los dos, así que hay que elegir cuál falla mejor. Al revés, si fallara el
     * blob quedaría un mp4 huérfano que nadie ve, nadie encuentra y se paga todos los meses.
     * En este orden, si falla el documento queda un registro apuntando a un archivo que no
     * está: eso se ve, la página lo resuelve como "video no disponible" y el próximo publicar
     * lo reintenta. Se prefiere el fallo visible.
     *
     * Se usa `video.rutaStorage` y no una ruta rearmada con `clienteId` + `rangoInicio`: eso
     * borraría la ruta que la convención dice hoy, no la que realmente se subió.
     */
    fun quitarVideoPublicado(video: VideoPublicado) {
        viewModelScope.launch {
            try {
                resumenStorageRepository.borrar(video.rutaStorage)
                videoPublicadoRepository.borrar(clienteId, video.rangoInicio)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                // Acá el fallo sí se le reporta al entrenador, al revés que en la retención de
                // `ResumenClienteViewModel.limpiarSobrantes`: allí limpiar es secundario a
                // publicar, acá quitar es justo lo que pidió.
                Log.w(TAG, "No se pudo quitar el video ${video.rangoInicio}", e)
                _errorVideo.value = "No se pudo quitar el video de la web"
            }
        }
    }

    private val _errorVideo = MutableStateFlow<String?>(null)
    val errorVideo: StateFlow<String?> = _errorVideo.asStateFlow()

    fun limpiarErrorVideo() {
        _errorVideo.value = null
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

    private companion object {
        const val TAG = "ClienteDetailViewModel"
    }
}
