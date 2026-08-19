package com.osfit.app.ui.calendario

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente

private val VerdeAsistio = Color(0xFF048751)
private val RojoFalto = Color(0xFFC23636)

@Composable
fun TomarAsistenciaScreen(fecha: String) {
    val viewModel: TomarAsistenciaViewModel = viewModel(
        factory = viewModelFactory { initializer { TomarAsistenciaViewModel(fecha) } }
    )
    val clientes by viewModel.clientesActivos.collectAsState()
    val asistencias by viewModel.asistenciasDelDia.collectAsState()

    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Text(
                "Asistencia — $fecha",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(16.dp)
            )
            if (clientes.isEmpty()) {
                Text("No hay clientes activos.", modifier = Modifier.padding(horizontal = 16.dp))
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
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
            val yaFalto = asistenciaExistente?.asistio == false
            val yaAsistio = asistenciaExistente?.asistio == true

            if (yaFalto) {
                Button(
                    onClick = onFalto,
                    colors = ButtonDefaults.buttonColors(containerColor = RojoFalto, contentColor = Color.White)
                ) { Text("Faltó") }
            } else {
                OutlinedButton(onClick = onFalto) { Text("Faltó") }
            }

            if (yaAsistio) {
                Button(
                    onClick = { mostrarSelectorDia = true },
                    enabled = tieneRutina,
                    colors = ButtonDefaults.buttonColors(containerColor = VerdeAsistio, contentColor = Color.White)
                ) { Text("Asistió") }
            } else {
                OutlinedButton(onClick = { mostrarSelectorDia = true }, enabled = tieneRutina) { Text("Asistió") }
            }
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
                        RadioButton(selected = seleccionado == indice, onClick = { seleccionado = indice })
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
