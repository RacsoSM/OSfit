package com.osfit.app.ui.clientes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.EditCalendar
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import com.osfit.app.data.model.Rutina
import com.osfit.app.domain.PagoCalculator
import com.osfit.app.ui.common.TextoMaquinaEscribir
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Calendar
import java.util.Date
import java.util.Locale

@Composable
fun ClienteDetailScreen(clienteId: String, onVerAsistencias: (String) -> Unit, onEliminado: () -> Unit) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val pagos by viewModel.pagos.collectAsState()
    val plantillas by viewModel.plantillasDisponibles.collectAsState()
    val errorPago by viewModel.errorPago.collectAsState()
    val eliminado by viewModel.eliminado.collectAsState()

    var mostrarDialogoPago by remember { mutableStateOf(false) }
    var mostrarDialogoRutina by remember { mutableStateOf(false) }
    var mostrarDialogoAsignarDia by remember { mutableStateOf(false) }
    var mostrarDialogoProximoPago by remember { mutableStateOf(false) }
    var mostrarConfirmacionActivo by remember { mutableStateOf(false) }
    var mostrarConfirmacionEliminar by remember { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(eliminado) {
        if (eliminado) onEliminado()
    }

    if (eliminado) return

    val clienteActual = cliente ?: return

    Scaffold { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                TextoMaquinaEscribir(
                    texto = clienteActual.nombre,
                    style = MaterialTheme.typography.headlineSmall,
                    empezar = true
                )
                if (clienteActual.telefono.isNotBlank()) {
                    Text(clienteActual.telefono, style = MaterialTheme.typography.bodyMedium)
                }
                if (!clienteActual.activo) {
                    Text("Inactivo", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelLarge)
                }
            }
            item {
                var expandidaRutina by remember { mutableStateOf(false) }
                val nombreDiaActual = clienteActual.rutinaAsignada?.dias?.getOrNull(clienteActual.diaActualIndex)?.nombreDia
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { expandidaRutina = !expandidaRutina },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Rutina asignada", style = MaterialTheme.typography.titleSmall)
                            Icon(
                                if (expandidaRutina) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                                contentDescription = if (expandidaRutina) "Ocultar" else "Mostrar"
                            )
                        }
                        if (expandidaRutina) {
                            Text(
                                clienteActual.rutinaAsignada?.nombre ?: "Sin rutina asignada",
                                modifier = Modifier.padding(top = 8.dp)
                            )
                            clienteActual.rutinaAsignada?.dias?.forEachIndexed { indice, dia ->
                                Text(
                                    "Día ${indice + 1}: ${dia.nombreDia}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                            if (nombreDiaActual != null) {
                                Text(
                                    "Día Actual",
                                    style = MaterialTheme.typography.titleSmall,
                                    modifier = Modifier.padding(top = 12.dp)
                                )
                                Text(nombreDiaActual, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.FitnessCenter,
                        texto = if (clienteActual.rutinaAsignada == null) "Asignar rutina" else "Cambiar rutina",
                        modifier = Modifier.weight(1f),
                        onClick = { mostrarDialogoRutina = true }
                    )
                    if (clienteActual.rutinaAsignada != null) {
                        AccionCard(
                            icono = Icons.Filled.EditCalendar,
                            texto = "Asignar día",
                            modifier = Modifier.weight(1f),
                            onClick = { mostrarDialogoAsignarDia = true }
                        )
                    }
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.Payments,
                        texto = "Registrar pago",
                        modifier = Modifier.weight(1f),
                        onClick = { mostrarDialogoPago = true }
                    )
                    AccionCard(
                        icono = Icons.Filled.CalendarMonth,
                        texto = "Asistencia",
                        modifier = Modifier.weight(1f),
                        onClick = { onVerAsistencias(clienteId) }
                    )
                }
            }
            item {
                var expandido by remember { mutableStateOf(false) }
                val diasParaPago = PagoCalculator.diasParaProximoPago(clienteActual)
                val formato = remember { SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()) }
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { expandido = !expandido },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Próximo pago", style = MaterialTheme.typography.titleSmall)
                            Icon(
                                if (expandido) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                                contentDescription = if (expandido) "Ocultar" else "Mostrar"
                            )
                        }
                        if (expandido) {
                            Text(
                                when {
                                    clienteActual.fechaProximoPago == null -> "Sin pago registrado"
                                    diasParaPago == 0L -> "Hoy (${formato.format(clienteActual.fechaProximoPago.toDate())})"
                                    else -> "${formato.format(clienteActual.fechaProximoPago.toDate())} (${if (diasParaPago!! >= 0) "faltan $diasParaPago días" else "hace ${-diasParaPago} días"})"
                                },
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                            OutlinedButton(
                                onClick = { mostrarDialogoProximoPago = true },
                                modifier = Modifier.padding(top = 8.dp)
                            ) {
                                Text("Asignar fecha")
                            }
                        }
                    }
                }
            }
            item {
                var expandidoHistorial by remember { mutableStateOf(false) }
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { expandidoHistorial = !expandidoHistorial },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Historial de pagos", style = MaterialTheme.typography.titleSmall)
                            Icon(
                                if (expandidoHistorial) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                                contentDescription = if (expandidoHistorial) "Ocultar" else "Mostrar"
                            )
                        }
                        if (expandidoHistorial) {
                            if (pagos.isEmpty()) {
                                Text(
                                    "Sin pagos registrados todavía.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(top = 8.dp)
                                )
                            } else {
                                Column(
                                    modifier = Modifier.padding(top = 8.dp),
                                    verticalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    pagos.forEach { pago -> ContenidoPago(pago) }
                                }
                            }
                        }
                    }
                }
            }
            item {
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = { mostrarConfirmacionActivo = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(if (clienteActual.activo) "Marcar cliente como inactivo" else "Reactivar cliente")
                }
            }
            item {
                TextButton(
                    onClick = { mostrarConfirmacionEliminar = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Eliminar cliente", color = MaterialTheme.colorScheme.error)
                }
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

    if (mostrarDialogoAsignarDia && clienteActual.rutinaAsignada != null) {
        AsignarDiaDialog(
            dias = clienteActual.rutinaAsignada.dias.map { it.nombreDia },
            diaActual = clienteActual.diaActualIndex,
            onConfirmar = { diaElegido ->
                viewModel.asignarDiaActual(diaElegido)
                mostrarDialogoAsignarDia = false
            },
            onCancelar = { mostrarDialogoAsignarDia = false }
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

    if (mostrarConfirmacionActivo) {
        ConfirmarActivoDialog(
            activo = clienteActual.activo,
            nombreCliente = clienteActual.nombre,
            onConfirmar = {
                viewModel.actualizarActivo(!clienteActual.activo)
                mostrarConfirmacionActivo = false
            },
            onCancelar = { mostrarConfirmacionActivo = false }
        )
    }

    if (mostrarConfirmacionEliminar) {
        ConfirmarEliminarDialog(
            nombreCliente = clienteActual.nombre,
            onConfirmar = {
                viewModel.eliminarCliente()
                mostrarConfirmacionEliminar = false
            },
            onCancelar = { mostrarConfirmacionEliminar = false }
        )
    }
}

@Composable
private fun AccionCard(
    icono: androidx.compose.ui.graphics.vector.ImageVector,
    texto: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(onClick = onClick, modifier = modifier) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icono, contentDescription = texto, tint = MaterialTheme.colorScheme.secondary)
            Spacer(modifier = Modifier.height(6.dp))
            Text(texto, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun ContenidoPago(pago: Pago) {
    val formato = remember { SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()) }
    Column {
        Text("$${pago.monto}", style = MaterialTheme.typography.titleMedium)
        Text("Fecha: ${formato.format(pago.fecha.toDate())}", style = MaterialTheme.typography.bodySmall)
        Text("Próximo pago: ${formato.format(pago.fechaProximoPagoGenerada.toDate())}", style = MaterialTheme.typography.bodySmall)
        if (pago.nota.isNotBlank()) {
            Text(pago.nota, style = MaterialTheme.typography.bodySmall)
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

@Composable
private fun ConfirmarActivoDialog(
    activo: Boolean,
    nombreCliente: String,
    onConfirmar: () -> Unit,
    onCancelar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text(if (activo) "¿Marcar como inactivo?" else "¿Reactivar cliente?") },
        text = {
            Text(
                if (activo) {
                    "$nombreCliente dejará de aparecer en la lista de clientes activos del Calendario. Podrás reactivarlo cuando quieras."
                } else {
                    "$nombreCliente volverá a aparecer en la lista de clientes activos del Calendario."
                }
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirmar) { Text("Confirmar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}

@Composable
private fun AsignarDiaDialog(
    dias: List<String>,
    diaActual: Int,
    onConfirmar: (Int) -> Unit,
    onCancelar: () -> Unit
) {
    var seleccionado by remember { mutableStateOf(diaActual.coerceIn(0, dias.lastIndex)) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Asignar día del ciclo") },
        text = {
            Column {
                Text(
                    "Útil si el cliente se salió de lo que le tocaba y quieres corregir manualmente en qué día del ciclo está, sin marcar una asistencia.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                dias.forEachIndexed { indice, nombreDia ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { seleccionado = indice }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(selected = seleccionado == indice, onClick = { seleccionado = indice })
                        Text(nombreDia + if (indice == diaActual) " (actual)" else "")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(seleccionado) }) { Text("Confirmar") }
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

@Composable
private fun ConfirmarEliminarDialog(
    nombreCliente: String,
    onConfirmar: () -> Unit,
    onCancelar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("¿Eliminar cliente?") },
        text = {
            Text(
                "Se eliminará a $nombreCliente permanentemente. Esta acción no se puede deshacer. " +
                    "Su historial de pagos y asistencias dejará de ser accesible desde la app."
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirmar) {
                Text("Eliminar", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
