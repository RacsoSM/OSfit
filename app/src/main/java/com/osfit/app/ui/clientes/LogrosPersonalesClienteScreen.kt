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
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.LogroPersonalOtorgado

@Composable
fun LogrosPersonalesClienteScreen(clienteId: String) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val catalogo by viewModel.catalogoLogrosPersonales.collectAsState()
    val otorgados by viewModel.logrosPersonalesOtorgados.collectAsState()

    var mostrarOtorgar by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { mostrarOtorgar = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Otorgar logro")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { Text("Logros personales", style = MaterialTheme.typography.headlineSmall) }
            if (otorgados.isEmpty()) {
                item { Text("Todavía no tiene logros personales.", style = MaterialTheme.typography.bodyMedium) }
            } else {
                items(otorgados, key = { it.id }) { otorgado ->
                    LogroPersonalCard(otorgado = otorgado, onQuitar = { viewModel.quitarLogroPersonal(otorgado) })
                }
            }
        }
    }

    if (mostrarOtorgar) {
        OtorgarLogroPersonalDialog(
            catalogo = catalogo,
            onConfirmar = { logro ->
                viewModel.otorgarLogroPersonal(logro)
                mostrarOtorgar = false
            },
            onCancelar = { mostrarOtorgar = false }
        )
    }
}

@Composable
private fun LogroPersonalCard(otorgado: LogroPersonalOtorgado, onQuitar: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Filled.EmojiEvents, contentDescription = null)
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Text(otorgado.nombreLogro, style = MaterialTheme.typography.titleMedium)
                Text(otorgado.encabezadoRango, style = MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick = onQuitar) {
                Icon(Icons.Filled.Delete, contentDescription = "Quitar logro")
            }
        }
    }
}

@Composable
private fun OtorgarLogroPersonalDialog(
    catalogo: List<LogroPersonalCatalogo>,
    onConfirmar: (LogroPersonalCatalogo) -> Unit,
    onCancelar: () -> Unit
) {
    var seleccionado by remember { mutableStateOf(catalogo.firstOrNull()) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Otorgar logro personal") },
        text = {
            if (catalogo.isEmpty()) {
                Text("Todavía no hay logros en el catálogo.")
            } else {
                Column {
                    catalogo.forEach { logro ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { seleccionado = logro }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(selected = seleccionado?.id == logro.id, onClick = { seleccionado = logro })
                            Text(logro.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = seleccionado != null,
                onClick = { seleccionado?.let(onConfirmar) }
            ) { Text("Otorgar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
