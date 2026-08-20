package com.osfit.app.ui.clientes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EditCalendar
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
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
import com.google.firebase.Timestamp
import com.osfit.app.data.model.Pago
import com.osfit.app.domain.PagoCalculator
import com.osfit.app.ui.common.AccionCard
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Calendar
import java.util.Date
import java.util.Locale

@Composable
fun ClientePagosScreen(clienteId: String) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val pagos by viewModel.pagos.collectAsState()
    val errorPago by viewModel.errorPago.collectAsState()

    var mostrarDialogoPago by remember { mutableStateOf(false) }
    var mostrarDialogoProximoPago by remember { mutableStateOf(false) }

    val clienteActual = cliente ?: return
    val formato = remember { SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()) }
    val diasParaPago = PagoCalculator.diasParaProximoPago(clienteActual)

    Scaffold { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { Text("Pagos", style = MaterialTheme.typography.headlineSmall) }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.Payments,
                        texto = "Registrar pago",
                        modifier = Modifier.weight(1f),
                        onClick = { mostrarDialogoPago = true }
                    )
                    AccionCard(
                        icono = Icons.Filled.EditCalendar,
                        texto = "Asignar fecha de pago",
                        modifier = Modifier.weight(1f),
                        onClick = { mostrarDialogoProximoPago = true }
                    )
                }
            }
            item {
                Text(
                    when {
                        clienteActual.fechaProximoPago == null -> "Próximo pago: sin pago registrado"
                        diasParaPago == 0L -> "Próximo pago: hoy (${formato.format(clienteActual.fechaProximoPago.toDate())})"
                        else -> "Próximo pago: ${formato.format(clienteActual.fechaProximoPago.toDate())} " +
                            "(${if (diasParaPago!! >= 0) "faltan $diasParaPago días" else "hace ${-diasParaPago} días"})"
                    },
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            item {
                Text("Historial de pagos", style = MaterialTheme.typography.titleSmall)
            }
            if (pagos.isEmpty()) {
                item { Text("Sin pagos registrados todavía.", style = MaterialTheme.typography.bodyMedium) }
            } else {
                items(pagos, key = { it.id }) { pago -> PagoCard(pago) }
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

    if (mostrarDialogoProximoPago) {
        AsignarProximoPagoDialog(
            fechaActual = clienteActual.fechaProximoPago,
            onConfirmar = { fecha ->
                viewModel.asignarProximoPago(fecha)
                mostrarDialogoProximoPago = false
            },
            onCancelar = { mostrarDialogoProximoPago = false }
        )
    }
}

@Composable
private fun PagoCard(pago: Pago) {
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

private const val DIAS_CICLO_SEMANAL = 7
private const val DIAS_CICLO_MENSUAL = 30

@Composable
private fun RegistrarPagoDialog(
    errorValidacion: String?,
    onConfirmar: (monto: Double, fecha: Timestamp, fechaProximoPago: Timestamp, nota: String) -> Unit,
    onCancelar: () -> Unit
) {
    var montoTexto by remember { mutableStateOf("") }
    var nota by remember { mutableStateOf("") }
    var cicloDias by remember { mutableStateOf(DIAS_CICLO_MENSUAL) }

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
                Text("Ciclo de pago", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = cicloDias == DIAS_CICLO_SEMANAL, onClick = { cicloDias = DIAS_CICLO_SEMANAL })
                    Text("Semanal")
                    Spacer(modifier = Modifier.width(16.dp))
                    RadioButton(selected = cicloDias == DIAS_CICLO_MENSUAL, onClick = { cicloDias = DIAS_CICLO_MENSUAL })
                    Text("Mensual")
                }
                Text(
                    "Fecha de pago: hoy. Próximo pago sugerido: hoy + $cicloDias días.",
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
                    add(Calendar.DAY_OF_MONTH, cicloDias)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AsignarProximoPagoDialog(
    fechaActual: Timestamp?,
    onConfirmar: (Timestamp) -> Unit,
    onCancelar: () -> Unit
) {
    val estadoSelector = rememberDatePickerState(
        initialSelectedDateMillis = (fechaActual ?: Timestamp.now()).toDate().toInstant()
            .atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    )

    DatePickerDialog(
        onDismissRequest = onCancelar,
        confirmButton = {
            TextButton(onClick = {
                val millis = estadoSelector.selectedDateMillis ?: return@TextButton
                val localDate = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
                val instant = localDate.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant()
                onConfirmar(Timestamp(Date.from(instant)))
            }) { Text("Confirmar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    ) {
        DatePicker(state = estadoSelector)
    }
}
