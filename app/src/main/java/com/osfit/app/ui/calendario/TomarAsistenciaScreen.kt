package com.osfit.app.ui.calendario

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
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
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente

private val VerdeAsistio = Color(0xFF048751)
private val RojoFalto = Color(0xFFC23636)
private val GrisDeshabilitado = Color(0xFF5A5A5A)

@Composable
fun TomarAsistenciaScreen(fecha: String, onGuardado: () -> Unit = {}) {
    val viewModel: TomarAsistenciaViewModel = viewModel(
        factory = viewModelFactory { initializer { TomarAsistenciaViewModel(fecha) } }
    )
    val clientes by viewModel.clientesActivos.collectAsState()
    val estadoPorCliente by viewModel.estadoPorCliente.collectAsState()
    val asistenciasDelDia by viewModel.asistenciasDelDia.collectAsState()
    val guardando by viewModel.guardando.collectAsState()
    var tabSeleccionada by remember { mutableStateOf(0) }

    Scaffold(
        bottomBar = {
            if (tabSeleccionada == 0) {
                Button(
                    onClick = { viewModel.guardarTodo(onGuardado) },
                    enabled = !guardando && clientes.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().padding(16.dp)
                ) {
                    Text(if (guardando) "Guardando..." else "Guardar")
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Text(
                "Asistencia — $fecha",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(16.dp)
            )
            TabRow(selectedTabIndex = tabSeleccionada) {
                Tab(
                    selected = tabSeleccionada == 0,
                    onClick = { tabSeleccionada = 0 },
                    text = { Text("Asistencia") }
                )
                Tab(
                    selected = tabSeleccionada == 1,
                    onClick = { tabSeleccionada = 1 },
                    text = { Text("Rutina") }
                )
            }
            if (clientes.isEmpty()) {
                Text("No hay clientes activos.", modifier = Modifier.padding(16.dp))
            } else if (tabSeleccionada == 0) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                    contentPadding = PaddingValues(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(clientes, key = { it.id }) { cliente ->
                        val tieneRutina = cliente.rutinaAsignada != null
                        val asistio = estadoPorCliente[cliente.id] ?: false
                        ClienteAsistenciaRow(
                            cliente = cliente,
                            asistio = asistio,
                            tieneRutina = tieneRutina,
                            onMarcar = { valor -> viewModel.marcar(cliente, valor) }
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                    contentPadding = PaddingValues(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(clientes, key = { it.id }) { cliente ->
                        val asistencia = asistenciasDelDia.find { it.clienteId == cliente.id }
                        ClienteRutinaRow(cliente = cliente, asistencia = asistencia)
                    }
                }
            }
        }
    }
}

@Composable
private fun ClienteAsistenciaRow(
    cliente: Cliente,
    asistio: Boolean,
    tieneRutina: Boolean,
    onMarcar: (Boolean) -> Unit
) {
    Card(
        onClick = { onMarcar(!asistio) },
        enabled = tieneRutina,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(cliente.nombre, style = MaterialTheme.typography.titleMedium)
                val estado = when {
                    !tieneRutina -> "Sin rutina asignada"
                    asistio -> "Asistió"
                    else -> "Faltó"
                }
                Text(estado, style = MaterialTheme.typography.bodyMedium)
            }
            SegmentoAsistencia(checked = asistio, enabled = tieneRutina)
        }
    }
}

@Composable
private fun ClienteRutinaRow(cliente: Cliente, asistencia: Asistencia?) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(cliente.nombre, style = MaterialTheme.typography.titleMedium)
            val texto = when {
                asistencia == null -> "Sin registrar"
                !asistencia.asistio -> "Faltó"
                else -> {
                    val indice = asistencia.diaRutinaRealizado
                    val nombreDia = indice?.let { cliente.rutinaAsignada?.dias?.getOrNull(it)?.nombreDia }
                    if (indice != null && nombreDia != null) "Día ${indice + 1}: $nombreDia" else "Asistió"
                }
            }
            Text(texto, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private val anchoSegmento = 56.dp
private val altoSegmento = 48.dp

@Composable
private fun SegmentoAsistencia(checked: Boolean, enabled: Boolean) {
    val colorPildora by animateColorAsState(
        targetValue = if (!enabled) GrisDeshabilitado else if (checked) VerdeAsistio else RojoFalto,
        label = "colorPildora"
    )
    val offsetX by animateDpAsState(
        targetValue = if (checked) anchoSegmento + 4.dp else 4.dp,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        label = "offsetX"
    )

    Box(
        modifier = Modifier
            .width(anchoSegmento * 2)
            .height(altoSegmento)
            .clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Box(
            modifier = Modifier
                .offset(x = offsetX, y = 4.dp)
                .size(width = anchoSegmento - 8.dp, height = altoSegmento - 8.dp)
                .clip(RoundedCornerShape(50))
                .background(colorPildora)
        )
        Row(modifier = Modifier.matchParentSize()) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = "Faltó",
                tint = if (!checked && enabled) Color.White else Color.Gray,
                modifier = Modifier.weight(1f).fillMaxHeight().padding(12.dp)
            )
            Icon(
                imageVector = Icons.Filled.Check,
                contentDescription = "Asistió",
                tint = if (checked && enabled) Color.White else Color.Gray,
                modifier = Modifier.weight(1f).fillMaxHeight().padding(12.dp)
            )
        }
    }
}
