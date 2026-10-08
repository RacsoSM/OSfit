package com.osfit.app.ui.avisos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Notificacion
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.NotificacionRepository
import com.osfit.app.domain.Avisos
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class AvisosViewModel(
    clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val notificacionRepository: NotificacionRepository = AppContainer.notificacionRepository
) : ViewModel() {

    val texto = MutableStateFlow("")
    /** `null` = todas las habilitadas; un conjunto = las que eligió. */
    val elegidos = MutableStateFlow<Set<String>?>(null)

    /** Solo las habilitadas y activas: son las únicas que se pueden elegir. */
    val habilitadas: StateFlow<List<Cliente>> = clienteRepository.observarClientes()
        .map { Avisos.destinatarias(it, null).sortedBy { c -> c.nombre.lowercase() } }
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val destinatarias: StateFlow<Int> = combine(habilitadas, elegidos) { h, e ->
        Avisos.destinatarias(h, e).size
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    val historial: StateFlow<List<Notificacion>> = notificacionRepository.observarHistorial()
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun usarRapido(rapido: String) { texto.value = rapido }

    fun cambiarTexto(nuevo: String) { texto.value = nuevo.take(Avisos.LARGO_MAXIMO) }

    fun elegirTodas() { elegidos.value = null }

    fun alternar(clienteId: String) {
        val actual = elegidos.value ?: emptySet()
        elegidos.value = if (clienteId in actual) actual - clienteId else actual + clienteId
    }

    fun puedeEnviar(): Boolean = texto.value.isNotBlank() && destinatarias.value > 0

    fun enviar() {
        if (!puedeEnviar()) return
        val e = elegidos.value
        notificacionRepository.enviar(
            Notificacion(
                texto = texto.value.trim(),
                destino = if (e == null) Notificacion.DESTINO_TODAS else Notificacion.DESTINO_ELEGIDAS,
                clientesElegidos = e?.toList().orEmpty()
            )
        )
        texto.value = ""
        elegidos.value = null
    }
}
