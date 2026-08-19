package com.osfit.app.ui.clientes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.Timestamp
import com.osfit.app.data.model.Cliente
import java.util.Date

@Composable
fun ClientesListScreen(
    onClienteClick: (String) -> Unit,
    viewModel: ClientesListViewModel = viewModel()
) {
    val clientes by viewModel.clientes.collectAsState()
    val errorValidacion by viewModel.errorValidacion.collectAsState()
    var mostrarDialogo by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { mostrarDialogo = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Nuevo cliente")
            }
        }
    ) { padding ->
        if (clientes.isEmpty()) {
            Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                Text("Aún no hay clientes. Toca + para agregar uno.")
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(clientes, key = { it.id }) { cliente ->
                    ClienteItem(cliente = cliente, onClick = { onClienteClick(cliente.id) })
                }
            }
        }
    }

    if (mostrarDialogo) {
        NuevoClienteDialog(
            errorValidacion = errorValidacion,
            onConfirmar = { nombre, telefono ->
                viewModel.crearCliente(nombre, telefono)
                if (nombre.isNotBlank()) mostrarDialogo = false
            },
            onCancelar = {
                viewModel.limpiarError()
                mostrarDialogo = false
            }
        )
    }
}

@Composable
private fun ClienteItem(cliente: Cliente, onClick: () -> Unit) {
    val (etiqueta, color) = estadoPago(cliente.fechaProximoPago)
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        androidx.compose.foundation.layout.Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(cliente.nombre, style = MaterialTheme.typography.titleMedium)
            Text(etiqueta, color = color, style = MaterialTheme.typography.labelLarge)
        }
    }
}

private fun estadoPago(fechaProximoPago: Timestamp?): Pair<String, Color> {
    if (fechaProximoPago == null) return "Sin pago registrado" to Color(0xFF9E9E9E)
    return if (fechaProximoPago.toDate().before(Date())) {
        "Atrasado" to Color(0xFFD32F2F)
    } else {
        "Al día" to Color(0xFF2E7D32)
    }
}

@Composable
private fun NuevoClienteDialog(
    errorValidacion: String?,
    onConfirmar: (nombre: String, telefono: String) -> Unit,
    onCancelar: () -> Unit
) {
    var nombre by remember { mutableStateOf("") }
    var telefono by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Nuevo cliente") },
        text = {
            Column {
                OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre") }, modifier = Modifier.fillMaxWidth(), isError = errorValidacion != null)
                if (errorValidacion != null) {
                    Text(errorValidacion, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                OutlinedTextField(value = telefono, onValueChange = { telefono = it }, label = { Text("Teléfono (opcional)") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(nombre, telefono) }) { Text("Guardar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
