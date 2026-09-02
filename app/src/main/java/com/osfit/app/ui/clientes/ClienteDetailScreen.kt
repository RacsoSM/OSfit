package com.osfit.app.ui.clientes

import android.content.ActivityNotFoundException
import android.content.Intent
import android.widget.Toast
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
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.EditCalendar
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Handshake
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.QueryStats
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.model.Rutina
import com.osfit.app.domain.RutinaProgressCalculator
import com.osfit.app.ui.common.AccionCard
import com.osfit.app.ui.common.AsignarDiaDialog
import com.osfit.app.ui.common.RachaBadge
import com.osfit.app.ui.common.TextoMaquinaEscribir
import com.osfit.app.ui.common.rememberFechaActual
import com.osfit.app.util.WhatsAppUtil

@Composable
fun ClienteDetailScreen(
    clienteId: String,
    onVerAsistencias: (String) -> Unit,
    onVerPagos: (String) -> Unit,
    onVerEstadisticas: (String) -> Unit,
    onEditarCliente: (String) -> Unit,
    onEliminado: () -> Unit
) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val plantillas by viewModel.plantillasDisponibles.collectAsState()
    val eliminado by viewModel.eliminado.collectAsState()
    val rachaActual by viewModel.rachaActual.collectAsState()
    val diaQueToca by viewModel.diaQueToca.collectAsState()
    val faltas by viewModel.faltas.collectAsState()
    val resumenViewModel: ResumenClienteViewModel = viewModel(
        factory = viewModelFactory { initializer { ResumenClienteViewModel(clienteId) } }
    )
    // El estado de generación vive en el ViewModel (viewModelScope): sobrevive a la rotación,
    // así el botón sigue mostrando "Generando..." y no se puede disparar una segunda corrida.
    val generandoResumen by resumenViewModel.generando.collectAsState()
    val mensajeResumen by resumenViewModel.mensaje.collectAsState()
    val hoy by rememberFechaActual()
    val context = LocalContext.current

    var mostrarDialogoRutina by remember { mutableStateOf(false) }
    var mostrarDialogoAsignarDia by remember { mutableStateOf(false) }
    var mostrarDialogoSoborno by remember { mutableStateOf(false) }
    var mostrarConfirmacionActivo by remember { mutableStateOf(false) }
    var mostrarConfirmacionEliminar by remember { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(eliminado) {
        if (eliminado) onEliminado()
    }

    // El mensaje se emite desde el ViewModel (que sobrevive a la rotación) y la pantalla
    // lo consume: si la Activity se recreó a media generación, el aviso igual se muestra.
    androidx.compose.runtime.LaunchedEffect(mensajeResumen) {
        val mensaje = mensajeResumen ?: return@LaunchedEffect
        Toast.makeText(context, mensaje, Toast.LENGTH_LONG).show()
        resumenViewModel.limpiarMensaje()
    }

    if (eliminado) return

    val clienteActual = cliente ?: return

    Scaffold { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                var nombreListo by remember(clienteId) { mutableStateOf(false) }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextoMaquinaEscribir(
                            texto = clienteActual.nombre,
                            style = MaterialTheme.typography.headlineSmall,
                            empezar = true,
                            onTerminar = { nombreListo = true }
                        )
                        if (nombreListo && rachaActual > 0) {
                            RachaBadge(
                                racha = rachaActual,
                                iconSize = 28.sp,
                                textStyle = MaterialTheme.typography.headlineSmall
                            )
                        }
                    }
                    IconButton(onClick = { onEditarCliente(clienteId) }) {
                        Icon(Icons.Filled.Settings, contentDescription = "Editar cliente")
                    }
                }
                if (clienteActual.telefono.isNotBlank()) {
                    Text(clienteActual.telefono, style = MaterialTheme.typography.bodyMedium)
                }
                if (!clienteActual.activo) {
                    Text("Inactivo", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelLarge)
                }
            }
            item {
                var expandidaRutina by remember { mutableStateOf(false) }
                val diaActualEfectivo = diaQueToca
                // La plantilla puede haber cambiado (ej. se le agregaron ejercicios) después de
                // asignarla: se usa la versión viva de la plantilla si todavía existe, en vez de
                // la copia congelada que quedó guardada en el cliente al momento de asignarla.
                val rutinaViva = plantillas.firstOrNull { it.id == clienteActual.plantillaOrigenId }
                val diaRutinaActual = (rutinaViva?.dias ?: clienteActual.rutinaAsignada?.dias)?.getOrNull(diaActualEfectivo)
                val nombreDiaActual = diaRutinaActual?.nombreDia
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
                            if (diaRutinaActual != null && clienteActual.telefono.isNotBlank()) {
                                Button(
                                    onClick = {
                                        val uri = WhatsAppUtil.crearUriEnviarRutinaDelDia(
                                            telefono = clienteActual.telefono,
                                            nombreCliente = clienteActual.nombre,
                                            dia = diaRutinaActual
                                        )
                                        try {
                                            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                        } catch (e: ActivityNotFoundException) {
                                            Toast.makeText(context, "No se encontró una app para abrir WhatsApp", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
                                ) {
                                    Icon(Icons.Filled.Chat, contentDescription = null)
                                    Text("Enviar rutina de hoy por WhatsApp", modifier = Modifier.padding(start = 8.dp))
                                }
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
                        texto = "Pagos",
                        modifier = Modifier.weight(1f),
                        onClick = { onVerPagos(clienteId) }
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
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.QueryStats,
                        texto = "Estadísticas",
                        modifier = Modifier.weight(1f),
                        onClick = { onVerEstadisticas(clienteId) }
                    )
                    if (clienteActual.telefono.isNotBlank()) {
                        AccionCard(
                            icono = Icons.Filled.Chat,
                            texto = "Confirmar Asistencia",
                            modifier = Modifier.weight(1f),
                            onClick = {
                                val uri = WhatsAppUtil.crearUriConfirmarAsistencia(
                                    telefono = clienteActual.telefono,
                                    nombreCliente = clienteActual.nombre
                                )
                                try {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                } catch (e: ActivityNotFoundException) {
                                    Toast.makeText(context, "No se encontró una app para abrir WhatsApp", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    }
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.Handshake,
                        texto = "Soborno",
                        modifier = Modifier.weight(1f),
                        onClick = { mostrarDialogoSoborno = true }
                    )
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.Videocam,
                        texto = if (generandoResumen) "Generando..." else "Resumen semanal",
                        modifier = Modifier.weight(1f),
                        onClick = { resumenViewModel.generarResumenSemanal(context) }
                    )
                    AccionCard(
                        icono = Icons.Filled.Videocam,
                        texto = if (generandoResumen) "Generando..." else "Resumen mensual",
                        modifier = Modifier.weight(1f),
                        onClick = { resumenViewModel.generarResumenMensual(context) }
                    )
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
            diaActual = diaQueToca,
            onConfirmar = { diaElegido ->
                viewModel.asignarDiaActual(diaElegido)
                mostrarDialogoAsignarDia = false
            },
            onCancelar = { mostrarDialogoAsignarDia = false }
        )
    }

    if (mostrarDialogoSoborno) {
        SobornoDialog(
            faltas = faltas,
            onAlternar = { viewModel.alternarSoborno(it) },
            onCerrar = { mostrarDialogoSoborno = false }
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
