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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.model.MedallaOtorgada

@Composable
fun LogrosClienteScreen(clienteId: String) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val catalogo by viewModel.catalogoMedallas.collectAsState()
    val otorgadas by viewModel.medallasOtorgadas.collectAsState()

    var mostrarOtorgar by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { mostrarOtorgar = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Otorgar insignia")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { Text("Logros", style = MaterialTheme.typography.headlineSmall) }
            if (otorgadas.isEmpty()) {
                item { Text("Todavía no tiene insignias.", style = MaterialTheme.typography.bodyMedium) }
            } else {
                items(otorgadas, key = { it.rangoInicio }) { otorgada ->
                    LogroCard(otorgada = otorgada, onQuitar = { viewModel.quitarMedalla(otorgada) })
                }
            }
        }
    }

    if (mostrarOtorgar) {
        OtorgarMedallaDialog(
            catalogo = catalogo,
            onConfirmar = { medalla ->
                viewModel.otorgarMedalla(medalla)
                mostrarOtorgar = false
            },
            onCancelar = { mostrarOtorgar = false }
        )
    }
}

@Composable
private fun LogroCard(otorgada: MedallaOtorgada, onQuitar: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Filled.EmojiEvents, contentDescription = null)
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Text(otorgada.nombreMedalla, style = MaterialTheme.typography.titleMedium)
                Text(otorgada.encabezadoRango, style = MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick = onQuitar) {
                Icon(Icons.Filled.Delete, contentDescription = "Quitar insignia")
            }
        }
    }
}

@Composable
private fun OtorgarMedallaDialog(
    catalogo: List<MedallaCatalogo>,
    onConfirmar: (MedallaCatalogo) -> Unit,
    onCancelar: () -> Unit
) {
    var seleccionada by remember { mutableStateOf(catalogo.firstOrNull()) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Otorgar insignia") },
        text = {
            if (catalogo.isEmpty()) {
                Text("Todavía no hay insignias en el catálogo.")
            } else {
                Column {
                    catalogo.forEach { medalla ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { seleccionada = medalla }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(selected = seleccionada?.id == medalla.id, onClick = { seleccionada = medalla })
                            Text(medalla.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = seleccionada != null,
                onClick = { seleccionada?.let(onConfirmar) }
            ) { Text("Otorgar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
