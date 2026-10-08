package com.osfit.app.ui.clientes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.ui.common.AccionCard
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class WebClienteViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository
) : ViewModel() {

    private val _cliente = MutableStateFlow<Cliente?>(null)
    val cliente: StateFlow<Cliente?> = _cliente

    init {
        viewModelScope.launch {
            // Un error de red deja el interruptor apagado y deshabilitado (cliente null); el
            // resto de la pantalla, que solo navega, se sigue pudiendo usar.
            clienteRepository.observarCliente(clienteId)
                .catch { }
                .collect { _cliente.value = it }
        }
    }

    fun cambiarRecordatorioPago(activo: Boolean) {
        // Optimista, como la paleta: el interruptor se mueve al tocar y el listener confirma.
        _cliente.value = _cliente.value?.copy(recordatorioPago = activo)
        viewModelScope.launch {
            runCatching { clienteRepository.actualizarRecordatorioPago(clienteId, activo) }
        }
    }
}

/**
 * Agrupa todo lo que el entrenador administra de la página web de una clienta.
 *
 * La ficha de la clienta ya tiene una rejilla larga de acciones, así que lo de la web entra
 * por aquí y no por ahí. Cuando haya que administrar algo más de la web, se agrega un elemento
 * a [seccionesWeb] y la ficha no se toca — que es exactamente como entró la paleta.
 *
 * La excepción es el interruptor de recordatorio de pago: es un sí/no que se cambia ahí mismo y
 * no abre ninguna pantalla, así que va como fila aparte debajo de la rejilla.
 */
@Composable
fun WebClienteScreen(
    clienteId: String,
    onVerVideosWeb: (String) -> Unit,
    onVerPaletaWeb: (String) -> Unit,
    onVerRutinaWeb: (String) -> Unit
) {
    val viewModel: WebClienteViewModel = viewModel(
        factory = viewModelFactory { initializer { WebClienteViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val secciones = seccionesWeb(
        onVerVideosWeb = onVerVideosWeb,
        onVerPaletaWeb = onVerPaletaWeb,
        onVerRutinaWeb = onVerRutinaWeb
    )
    Scaffold { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { Text("Web", style = MaterialTheme.typography.headlineSmall) }
            // De dos en dos para que la rejilla se vea igual que la de la ficha; el hueco
            // final mantiene el ancho de la tarjeta cuando el total es impar.
            items(secciones.chunked(2)) { fila ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    fila.forEach { seccion ->
                        AccionCard(
                            icono = seccion.icono,
                            texto = seccion.texto,
                            modifier = Modifier.weight(1f),
                            onClick = { seccion.alAbrir(clienteId) }
                        )
                    }
                    if (fila.size == 1) Spacer(modifier = Modifier.weight(1f))
                }
            }
            // No es una sección de la rejilla: un sí/no no navega a ningún lado.
            item {
                FilaRecordatorioPago(
                    activo = cliente?.recordatorioPago == true,
                    tieneFechaPago = cliente?.fechaProximoPago != null,
                    habilitado = cliente != null,
                    onCambiar = viewModel::cambiarRecordatorioPago
                )
            }
        }
    }
}

private class SeccionWeb(
    val icono: ImageVector,
    val texto: String,
    val alAbrir: (String) -> Unit
)

private fun seccionesWeb(
    onVerVideosWeb: (String) -> Unit,
    onVerPaletaWeb: (String) -> Unit,
    onVerRutinaWeb: (String) -> Unit
) = listOf(
    // Primera de la lista: es lo que la clienta abre a diario, a diferencia de los videos
    // (quincenales) y de la paleta (se elige una vez).
    SeccionWeb(
        icono = Icons.Filled.FitnessCenter,
        texto = "Rutina y variaciones",
        alAbrir = onVerRutinaWeb
    ),
    SeccionWeb(
        icono = Icons.Filled.VideoLibrary,
        texto = "Videos en la web",
        alAbrir = onVerVideosWeb
    ),
    SeccionWeb(
        icono = Icons.Filled.Palette,
        texto = "Paleta de colores",
        alAbrir = onVerPaletaWeb
    )
)

@Composable
private fun FilaRecordatorioPago(
    activo: Boolean,
    tieneFechaPago: Boolean,
    habilitado: Boolean,
    onCambiar: (Boolean) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(Icons.Filled.Notifications, contentDescription = null)
            Column(modifier = Modifier.weight(1f)) {
                Text("Recordatorios de pago", style = MaterialTheme.typography.titleMedium)
                Text(
                    // Sin fecha, prenderlo no muestra nada; se dice para que no parezca roto.
                    if (tieneFechaPago) "Muestra en su inicio cuántos días le quedan cuando faltan 2 o menos."
                    else "Sin fecha de pago registrada: no se mostrará nada todavía.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Switch(checked = activo, onCheckedChange = onCambiar, enabled = habilitado)
        }
    }
}
