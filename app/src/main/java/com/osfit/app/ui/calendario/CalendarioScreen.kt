package com.osfit.app.ui.calendario

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun CalendarioScreen(viewModel: CalendarioViewModel = viewModel()) {
    val fechaSeleccionada by viewModel.fechaSeleccionada.collectAsState()
    val clientes by viewModel.clientesActivos.collectAsState()
    val asistencias by viewModel.asistenciasDelDia.collectAsState()
    var mesVisible by remember { mutableStateOf(YearMonth.from(fechaSeleccionada)) }

    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            CalendarHeader(
                mesVisible = mesVisible,
                onMesAnterior = { mesVisible = mesVisible.minusMonths(1) },
                onMesSiguiente = { mesVisible = mesVisible.plusMonths(1) }
            )
            CalendarGrid(
                mesVisible = mesVisible,
                fechaSeleccionada = fechaSeleccionada,
                onDiaClick = { viewModel.seleccionarFecha(it) }
            )
            Text(
                "Clientes activos — $fechaSeleccionada",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(16.dp)
            )
            LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(clientes, key = { it.id }) { cliente ->
                    val asistenciaExistente = asistencias.find { it.clienteId == cliente.id }
                    ClienteAsistenciaRow(
                        cliente = cliente,
                        asistenciaExistente = asistenciaExistente,
                        onFalto = { viewModel.marcarFalto(cliente) },
                        onAsistio = { diaRealizado -> viewModel.marcarAsistio(cliente, diaRealizado) }
                    )
                }
            }
        }
    }
}

@Composable
private fun CalendarHeader(mesVisible: YearMonth, onMesAnterior: () -> Unit, onMesSiguiente: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onMesAnterior) { Icon(Icons.Filled.ChevronLeft, contentDescription = "Mes anterior") }
        Text(
            "${mesVisible.month.getDisplayName(TextStyle.FULL, Locale("es"))} ${mesVisible.year}",
            style = MaterialTheme.typography.titleMedium
        )
        IconButton(onClick = onMesSiguiente) { Icon(Icons.Filled.ChevronRight, contentDescription = "Mes siguiente") }
    }
}

@Composable
private fun CalendarGrid(mesVisible: YearMonth, fechaSeleccionada: LocalDate, onDiaClick: (LocalDate) -> Unit) {
    val primerDiaDelMes = mesVisible.atDay(1)
    val diasEnMes = mesVisible.lengthOfMonth()
    val offsetInicial = primerDiaDelMes.dayOfWeek.value % 7 // Domingo = 0

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            listOf("D", "L", "M", "M", "J", "V", "S").forEach { letra ->
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(letra, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        val totalCeldas = offsetInicial + diasEnMes
        val filas = (totalCeldas + 6) / 7
        for (fila in 0 until filas) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (columna in 0 until 7) {
                    val indiceDia = fila * 7 + columna - offsetInicial + 1
                    Box(
                        modifier = Modifier.weight(1f).aspectRatio(1f).padding(2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (indiceDia in 1..diasEnMes) {
                            val fecha = mesVisible.atDay(indiceDia)
                            val seleccionado = fecha == fechaSeleccionada
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape)
                                    .background(if (seleccionado) MaterialTheme.colorScheme.primary else Color.Transparent)
                                    .clickable { onDiaClick(fecha) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    indiceDia.toString(),
                                    color = if (seleccionado) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ClienteAsistenciaRow(
    cliente: Cliente,
    asistenciaExistente: Asistencia?,
    onFalto: () -> Unit,
    onAsistio: (diaRealizado: Int) -> Unit
) {
    var mostrarSelectorDia by remember { mutableStateOf(false) }
    val tieneRutina = cliente.rutinaAsignada != null

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(cliente.nombre, style = MaterialTheme.typography.titleSmall)
                val estado = when (asistenciaExistente?.asistio) {
                    true -> "Asistió"
                    false -> "Faltó"
                    null -> if (tieneRutina) "Sin marcar" else "Sin rutina asignada"
                }
                Text(estado, style = MaterialTheme.typography.bodySmall)
            }
            OutlinedButton(onClick = onFalto) { Text("Faltó") }
            Button(onClick = { mostrarSelectorDia = true }, enabled = tieneRutina) { Text("Asistió") }
        }
    }

    if (mostrarSelectorDia && cliente.rutinaAsignada != null) {
        SeleccionarDiaDialog(
            dias = cliente.rutinaAsignada.dias.map { it.nombreDia },
            diaSugerido = cliente.diaActualIndex,
            onConfirmar = { diaElegido ->
                onAsistio(diaElegido)
                mostrarSelectorDia = false
            },
            onCancelar = { mostrarSelectorDia = false }
        )
    }
}

@Composable
private fun SeleccionarDiaDialog(
    dias: List<String>,
    diaSugerido: Int,
    onConfirmar: (Int) -> Unit,
    onCancelar: () -> Unit
) {
    var seleccionado by remember { mutableStateOf(diaSugerido.coerceIn(0, dias.lastIndex)) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("¿Qué día hizo?") },
        text = {
            Column {
                dias.forEachIndexed { indice, nombreDia ->
                    Row(
                        modifier = Modifier.fillMaxWidth().clickable { seleccionado = indice }.padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        androidx.compose.material3.RadioButton(selected = seleccionado == indice, onClick = { seleccionado = indice })
                        Text(nombreDia + if (indice == diaSugerido) " (sugerido)" else "")
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
