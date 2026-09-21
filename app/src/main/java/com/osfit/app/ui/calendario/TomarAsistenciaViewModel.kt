package com.osfit.app.ui.calendario

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.SincronizadorDiaWeb
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.AvisoFaltaWebRepository
import com.osfit.app.data.repository.CambioDiaWebRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.domain.DiaQueToca
import com.osfit.app.domain.RutinaProgressCalculator
import com.osfit.app.domain.VariacionCalculator
import com.osfit.app.domain.totalVariaciones
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
    private val sincronizadorDiaWeb: SincronizadorDiaWeb = AppContainer.sincronizadorDiaWeb,
    private val cambioDiaWebRepository: CambioDiaWebRepository = AppContainer.cambioDiaWebRepository,
    private val avisoFaltaWebRepository: AvisoFaltaWebRepository = AppContainer.avisoFaltaWebRepository
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
    val diaQueTocaPorCliente: StateFlow<Map<String, DiaQueToca>> =
        combine(clientesActivos, todasAsistencias) { clientes, asistencias ->
            val porCliente = asistencias.groupBy { it.clienteId }
            clientes.associate { cliente ->
                cliente.id to RutinaProgressCalculator.diaQueToca(
                    cliente, porCliente[cliente.id].orEmpty(), fecha
                )
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    /** clienteId → motivo que eligió al cambiar su día hoy. */
    val cambioDiaPorCliente: StateFlow<Map<String, String>> =
        cambioDiaWebRepository.observarPorFecha(fecha)
            // El doc id es "<clienteId>_<fecha>", así que no puede haber dos por cliente;
            // aun así se asocia por clienteId para que la última lectura mande.
            .map { cambios -> cambios.associate { it.clienteId to it.motivo } }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    /**
     * clienteIds que avisaron que no vienen hoy.
     *
     * Son DOS fuentes unidas, y hacen falta las dos. `avisosFalta` es la de ahora: avisar es
     * gratis y se guarda ahí. La derivada de `justificadaPorCliente` es la de antes, cuando
     * el botón de avisar gastaba un revive, y se conserva para que los avisos ya registrados
     * de ese modo —y las faltas que el cliente justifique desde "Revivir mi racha"— sigan
     * apareciendo en la fila.
     */
    val avisoAusenciaPorCliente: StateFlow<Set<String>> = combine(
        asistenciasDelDia,
        avisoFaltaWebRepository.observarPorFecha(fecha)
    ) { asistencias, avisos ->
        asistencias.filter { it.justificadaPorCliente && !it.asistio }
            .map { it.clienteId }
            .toSet() + avisos.map { it.clienteId }.toSet()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptySet())

    private fun diaQueToca(cliente: Cliente): DiaQueToca = RutinaProgressCalculator.diaQueToca(
        cliente, todasAsistencias.value.filter { it.clienteId == cliente.id }, fecha
    )

    /** El índice a escribir, o null si hoy no hay día que registrar. */
    private fun indiceQueToca(cliente: Cliente): Int? =
        (diaQueToca(cliente) as? DiaQueToca.Dia)?.indice

    /**
     * La variación que se le está sirviendo al cliente en [diaDelCiclo]. Se calcula acá y no en
     * el repositorio: el repositorio no conoce la rutina ni el historial, y dárselos lo
     * convertiría en otra cosa.
     *
     * `rutinaAsignada` es la verdad para las dos fuentes: en rutina propia es la copia de la
     * clienta, y desde el 2026-09-15 —cuando las plantillas también llevan variaciones— es
     * además el reflejo de la plantilla viva, que `RutinaRepository.guardarRutina` copia a sus
     * seguidoras al guardar. Por eso no hace falta observar la colección de plantillas acá.
     */
    private fun variacionQueToca(cliente: Cliente, diaDelCiclo: Int): Int =
        VariacionCalculator.variacionQueToca(
            diaDelCiclo = diaDelCiclo,
            asistenciasDelCliente = todasAsistencias.value.filter { it.clienteId == cliente.id },
            hoy = fecha,
            totalVariaciones = totalVariaciones(
                cliente.rutinaAsignada?.dias?.getOrNull(diaDelCiclo)
            )
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
            val dia = indiceQueToca(cliente) ?: return@launch
            asistenciaRepository.iniciarTiempo(
                clienteId = cliente.id,
                fecha = fecha,
                diaRutinaRealizado = dia,
                variacionRealizada = variacionQueToca(cliente, dia)
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
                        val dia = if (asistio) indiceQueToca(cliente) else null
                        asistenciaRepository.registrarAsistencia(
                            clienteId = cliente.id,
                            fecha = fecha,
                            asistio = asistio,
                            diaRutinaRealizado = dia,
                            nota = "",
                            variacionRealizada = dia?.let { variacionQueToca(cliente, it) }
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
                        // que le toca al cliente se recalcula solo a partir de él. La variación
                        // guardada era del día viejo, así que se recalcula para el nuevo.
                        val cliente = clientesActivos.value.firstOrNull { it.id == clienteId }
                        asistenciaRepository.actualizarDiaRealizado(
                            clienteId = clienteId,
                            fecha = fecha,
                            nuevoDia = diaElegido,
                            variacionRealizada = cliente?.let { variacionQueToca(it, diaElegido) }
                        )
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
