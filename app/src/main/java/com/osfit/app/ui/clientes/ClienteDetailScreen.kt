package com.osfit.app.ui.clientes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.google.firebase.Timestamp
import com.osfit.app.data.model.Pago
import com.osfit.app.data.model.Rutina
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@Composable
fun ClienteDetailScreen(clienteId: String) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val pagos by viewModel.pagos.collectAsState()
    val plantillas by viewModel.plantillasDisponibles.collectAsState()
    val errorPago by viewModel.errorPago.collectAsState()

    var mostrarDialogoPago by remember { mutableStateOf(false) }
    var mostrarDialogoRutina by remember { mutableStateOf(false) }

    val clienteActual = cliente ?: return

    Scaffold { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text(clienteActual.nombre, style = MaterialTheme.typography.headlineSmall)
                if (clienteActual.telefono.isNotBlank()) {
                    Text(clienteActual.telefono, style = MaterialTheme.typography.bodyMedium)
                }
            }
            item {
                val nombreDiaActual = clienteActual.rutinaAsignada?.dias?.getOrNull(clienteActual.diaActualIndex)?.nombreDia
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("Rutina asignada", style = MaterialTheme.typography.titleSmall)
                        Text(clienteActual.rutinaAsignada?.nombre ?: "Sin rutina asignada")
                        if (nombreDiaActual != null) {
                            Text("Próximo día: $nombreDiaActual", style = MaterialTheme.typography.bodyMedium)
                        }
                        Button(onClick = { mostrarDialogoRutina = true }, modifier = Modifier.padding(top = 8.dp)) {
                            Text(if (clienteActual.rutinaAsignada == null) "Asignar rutina" else "Cambiar rutina")
                        }
                    }
                }
            }
            item {
                Button(onClick = { mostrarDialogoPago = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("Registrar pago")
                }
            }
            item {
                Text("Historial de pagos", style = MaterialTheme.typography.titleSmall)
            }
            if (pagos.isEmpty()) {
                item { Text("Sin pagos registrados todavía.") }
            } else {
                items(pagos, key = { it.id }) { pago -> PagoItem(pago) }
            }
        }
    }

    if (mostrarDialogoPago) {
        RegistrarPagoDialog(
            errorValidacion = errorPago,
            onConfirmar = { monto, fecha, fechaProximoPago, nota ->
                viewModel.registrarPago(monto, fecha, fechaProximoPago, nota)
                if (monto > 0.0) mostrarDialogoPago = false
            },
            onCancelar = {
                viewModel.limpiarErrorPago()
                mostrarDialogoPago = false
            }
        )
    }

    if (mostrarDialogoRutina) {
        AsignarRutinaDialog(
            plantillas = plantillas,
            onSeleccionar = { rutina ->
                viewModel.asignarRutina(rutina)
                mostrarDialogoRutina = false
            },
            onCancelar = { mostrarDialogoRutina = false }
        )
    }
}

@Composable
private fun PagoItem(pago: Pago) {
    val formato = remember { SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()) }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("$${pago.monto}", style = MaterialTheme.typography.titleMedium)
            Text("Fecha: ${formato.format(pago.fecha.toDate())}", style = MaterialTheme.typography.bodySmall)
            Text("Próximo pago: ${formato.format(pago.fechaProximoPagoGenerada.toDate())}", style = MaterialTheme.typography.bodySmall)
            if (pago.nota.isNotBlank()) {
                Text(pago.nota, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun RegistrarPagoDialog(
    errorValidacion: String?,
    onConfirmar: (monto: Double, fecha: Timestamp, fechaProximoPago: Timestamp, nota: String) -> Unit,
    onCancelar: () -> Unit
) {
    var montoTexto by remember { mutableStateOf("") }
    var nota by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Registrar pago") },
        text = {
            Column {
                OutlinedTextField(
                    value = montoTexto,
                    onValueChange = { montoTexto = it },
                    label = { Text("Monto") },
                    isError = errorValidacion != null,
                    modifier = Modifier.fillMaxWidth()
                )
                if (errorValidacion != null) {
                    Text(errorValidacion, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                OutlinedTextField(
                    value = nota,
                    onValueChange = { nota = it },
                    label = { Text("Nota (opcional)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                )
                Text(
                    "Fecha de pago: hoy. Próximo pago sugerido: hoy + 30 días.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val monto = montoTexto.toDoubleOrNull() ?: -1.0
                val hoy = Timestamp.now()
                val calendario = Calendar.getInstance().apply {
                    time = hoy.toDate()
                    add(Calendar.DAY_OF_MONTH, 30)
                }
                val proximoPago = Timestamp(calendario.time)
                onConfirmar(monto, hoy, proximoPago, nota)
            }) { Text("Guardar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}

@Composable
private fun AsignarRutinaDialog(
    plantillas: List<Rutina>,
    onSeleccionar: (Rutina) -> Unit,
    onCancelar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Elegir plantilla") },
        text = {
            if (plantillas.isEmpty()) {
                Text("No hay plantillas creadas todavía. Crea una en la pestaña Rutinas.")
            } else {
                Column {
                    plantillas.forEach { rutina ->
                        TextButton(onClick = { onSeleccionar(rutina) }, modifier = Modifier.fillMaxWidth()) {
                            Text(rutina.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
