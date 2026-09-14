package com.osfit.app.ui.clientes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.repository.PaletaWebRepository
import com.osfit.app.paletas.Paleta
import com.osfit.app.paletas.Paletas
import com.osfit.app.ui.common.MuestrasPaletaWeb
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class PaletaWebClienteViewModel(
    private val clienteId: String,
    private val repo: PaletaWebRepository = PaletaWebRepository()
) : ViewModel() {

    private val _seleccionada = MutableStateFlow(Paletas.porDefectoWeb)
    val seleccionada: StateFlow<Paleta> = _seleccionada

    init {
        viewModelScope.launch {
            // Un error de permisos o de red deja la selección en el morado por defecto, que es
            // lo que la clienta está viendo de todos modos: la pantalla se puede seguir usando.
            repo.observarPaletaId(clienteId)
                .catch { }
                .collect { id -> _seleccionada.value = Paletas.porIdWeb(id) }
        }
    }

    fun asignar(paleta: Paleta) {
        // Optimista: la marca se mueve al tocar, sin esperar a Firestore. El listener confirma
        // o corrige un instante después.
        _seleccionada.value = paleta
        viewModelScope.launch { runCatching { repo.guardar(clienteId, paleta) } }
    }
}

/**
 * Elige la paleta de la página web de una clienta. Guarda al tocar, sin botón de confirmar:
 * igual que Configuración de video, y por lo mismo — es una decisión reversible de un toque.
 */
@Composable
fun PaletaWebClienteScreen(clienteId: String) {
    val viewModel: PaletaWebClienteViewModel = viewModel(
        factory = viewModelFactory { initializer { PaletaWebClienteViewModel(clienteId) } }
    )
    val seleccionada by viewModel.seleccionada.collectAsState()

    Scaffold { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text("Paleta de colores", style = MaterialTheme.typography.headlineSmall)
            }
            item {
                Text(
                    "Cambia los colores de la página web de esta clienta. Ella lo ve al instante, sin recargar.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }
            items(Paletas.disponibles, key = { it.id }) { paleta ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.asignar(paleta) }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        RadioButton(
                            selected = paleta.id == seleccionada.id,
                            onClick = { viewModel.asignar(paleta) }
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(paleta.nombre, style = MaterialTheme.typography.titleMedium)
                        }
                        MuestrasPaletaWeb(paleta, modifier = Modifier.padding(end = 8.dp))
                    }
                }
            }
        }
    }
}
