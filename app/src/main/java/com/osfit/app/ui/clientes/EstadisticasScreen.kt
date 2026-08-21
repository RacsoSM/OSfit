package com.osfit.app.ui.clientes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.google.firebase.Timestamp
import com.osfit.app.data.model.RecordPersonal
import com.osfit.app.ui.common.TextoMaquinaEscribir
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Date
import java.util.Locale

@Composable
fun EstadisticasScreen(clienteId: String) {
    val viewModel: EstadisticasViewModel = viewModel(
        factory = viewModelFactory { initializer { EstadisticasViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    val records by viewModel.records.collectAsState()

    var mostrarDialogoIngreso by remember { mutableStateOf(false) }
    var mostrarDialogoDiaFavorito by remember { mutableStateOf(false) }
    var mostrarDialogoEjercicioFavorito by remember { mutableStateOf(false) }
    var mostrarDialogoRecord by remember { mutableStateOf(false) }

    val clienteActual = cliente ?: return

    Scaffold { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                TextoMaquinaEscribir(
                    texto = "Estadísticas",
                    style = MaterialTheme.typography.headlineSmall,
                    empezar = true
                )
            }

            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("Racha", style = MaterialTheme.typography.titleSmall)
                        Text(
                            "${uiState.rachaActual} días",
                            style = MaterialTheme.typography.headlineMedium
                        )
                        Text(
                            "Racha más larga: ${uiState.rachaMasLarga} días",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }

            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard(
                        titulo = "Asistencias totales",
                        valor = "${uiState.diasTotalesAsistidos}",
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        titulo = "Días totales",
                        valor = uiState.diasDesdeIngreso?.let { "$it" } ?: "Sin definir",
                        onEditar = { mostrarDialogoIngreso = true },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard(
                        titulo = "Día favorito",
                        valor = uiState.diaFavoritoNombre ?: "Sin definir",
                        onEditar = { mostrarDialogoDiaFavorito = true },
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        titulo = "Ejercicio favorito",
                        valor = uiState.ejercicioFavorito ?: "Sin definir",
                        onEditar = { mostrarDialogoEjercicioFavorito = true },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Récords personales (PRs)", style = MaterialTheme.typography.titleSmall)
                    OutlinedButton(onClick = { mostrarDialogoRecord = true }) {
                        Text("Agregar")
                    }
                }
            }
            if (records.isEmpty()) {
                item { Text("Sin PRs registrados todavía.", style = MaterialTheme.typography.bodyMedium) }
            } else {
                items(records, key = { it.id }) { record ->
                    RecordCard(record = record, onEliminar = { viewModel.eliminarRecord(record.id) })
                }
            }
        }
    }

    if (mostrarDialogoIngreso) {
        SeleccionarFechaDialog(
            fechaActual = clienteActual.fechaIngreso,
            onConfirmar = { fecha ->
                viewModel.actualizarFechaIngreso(fecha)
                mostrarDialogoIngreso = false
            },
            onCancelar = { mostrarDialogoIngreso = false }
        )
    }

    if (mostrarDialogoDiaFavorito) {
        val dias = clienteActual.rutinaAsignada?.dias.orEmpty()
        SeleccionarDiaFavoritoDialog(
            dias = dias.map { it.nombreDia },
            diaActual = uiState.diaFavoritoIndex,
            onConfirmar = { indice ->
                viewModel.cambiarDiaFavorito(indice)
                mostrarDialogoDiaFavorito = false
            },
            onCancelar = { mostrarDialogoDiaFavorito = false }
        )
    }

    if (mostrarDialogoEjercicioFavorito && uiState.diaFavoritoIndex != null) {
        val diaIndice = uiState.diaFavoritoIndex!!
        EditarEjercicioFavoritoDialog(
            nombreDia = uiState.diaFavoritoNombre ?: "",
            valorActual = uiState.ejercicioFavorito ?: "",
            onConfirmar = { texto ->
                viewModel.guardarEjercicioFavorito(diaIndice, texto)
                mostrarDialogoEjercicioFavorito = false
            },
            onCancelar = { mostrarDialogoEjercicioFavorito = false }
        )
    }

    if (mostrarDialogoRecord) {
        RegistrarRecordDialog(
            onConfirmar = { ejercicio, marca, fecha ->
                viewModel.registrarRecord(ejercicio, marca, fecha)
                mostrarDialogoRecord = false
            },
            onCancelar = { mostrarDialogoRecord = false }
        )
    }
}

@Composable
private fun StatCard(
    titulo: String,
    valor: String,
    modifier: Modifier = Modifier,
    onEditar: (() -> Unit)? = null
) {
    Card(modifier = modifier.height(130.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(titulo, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                if (onEditar != null) {
                    Icon(
                        Icons.Filled.Edit,
                        contentDescription = "Editar $titulo",
                        modifier = Modifier
                            .size(18.dp)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                onClick = onEditar
                            )
                    )
                }
            }
            Text(
                valor,
                style = MaterialTheme.typography.headlineSmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
private fun RecordCard(record: RecordPersonal, onEliminar: () -> Unit) {
    val formato = remember { SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()) }
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(record.ejercicio, style = MaterialTheme.typography.titleMedium)
                Text(record.marca, style = MaterialTheme.typography.bodyMedium)
                Text(formato.format(record.fecha.toDate()), style = MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick = onEliminar) {
                Icon(Icons.Filled.Delete, contentDescription = "Eliminar PR")
            }
        }
    }
}

@Composable
private fun SeleccionarDiaFavoritoDialog(
    dias: List<String>,
    diaActual: Int?,
    onConfirmar: (Int) -> Unit,
    onCancelar: () -> Unit
) {
    if (dias.isEmpty()) {
        AlertDialog(
            onDismissRequest = onCancelar,
            title = { Text("Día favorito") },
            text = { Text("Este cliente no tiene una rutina asignada todavía.") },
            confirmButton = {},
            dismissButton = { TextButton(onClick = onCancelar) { Text("Cerrar") } }
        )
        return
    }

    var seleccionado by remember { mutableStateOf(diaActual?.coerceIn(0, dias.lastIndex) ?: 0) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Elegir día favorito") },
        text = {
            Column {
                dias.forEachIndexed { indice, nombreDia ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(selected = seleccionado == indice, onClick = { seleccionado = indice })
                        Text(nombreDia)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(seleccionado) }) { Text("Guardar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}

@Composable
private fun EditarEjercicioFavoritoDialog(
    nombreDia: String,
    valorActual: String,
    onConfirmar: (String) -> Unit,
    onCancelar: () -> Unit
) {
    var texto by remember { mutableStateOf(valorActual) }
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Ejercicio favorito: $nombreDia") },
        text = {
            OutlinedTextField(
                value = texto,
                onValueChange = { texto = it },
                label = { Text("Ejercicio") },
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(texto.trim()) }) { Text("Guardar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}

@Composable
private fun RegistrarRecordDialog(
    onConfirmar: (ejercicio: String, marca: String, fecha: Timestamp) -> Unit,
    onCancelar: () -> Unit
) {
    var ejercicio by remember { mutableStateOf("") }
    var marca by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Nuevo PR") },
        text = {
            Column {
                OutlinedTextField(
                    value = ejercicio,
                    onValueChange = { ejercicio = it },
                    label = { Text("Ejercicio") },
                    isError = error != null,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = marca,
                    onValueChange = { marca = it },
                    label = { Text("Marca (ej. 80kg x5)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                )
                if (error != null) {
                    Text(error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (ejercicio.isBlank()) {
                    error = "El ejercicio es obligatorio"
                } else {
                    onConfirmar(ejercicio.trim(), marca.trim(), Timestamp.now())
                }
            }) { Text("Guardar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SeleccionarFechaDialog(
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
