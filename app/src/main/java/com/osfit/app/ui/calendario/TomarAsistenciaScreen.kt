package com.osfit.app.ui.calendario

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.domain.DiaQueToca
import com.osfit.app.domain.TiempoGymCalculator
import com.osfit.app.ui.common.TextoMaquinaEscribir
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

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
    val diaRealizadoPorCliente by viewModel.diaRealizadoPorCliente.collectAsState()
    val diaQueTocaPorCliente by viewModel.diaQueTocaPorCliente.collectAsState()
    val asistenciasDelDia by viewModel.asistenciasDelDia.collectAsState()
    val cambioDiaPorCliente by viewModel.cambioDiaPorCliente.collectAsState()
    val avisoAusenciaPorCliente by viewModel.avisoAusenciaPorCliente.collectAsState()
    val guardando by viewModel.guardando.collectAsState()
    val guardandoDia by viewModel.guardandoDia.collectAsState()
    val reiniciando by viewModel.reiniciando.collectAsState()
    val tiempoPorCliente = remember(asistenciasDelDia) {
        asistenciasDelDia.associateBy { it.clienteId }
    }
    var tabSeleccionada by remember { mutableStateOf(0) }
    var mostrarConfirmacionReinicio by remember { mutableStateOf(false) }

    val fechaFormateada = remember(fecha) {
        LocalDate.parse(fecha)
            .format(DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM 'del' yyyy", Locale("es")))
            .replaceFirstChar { it.uppercase() }
    }

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
            } else {
                Button(
                    onClick = { viewModel.guardarCambiosDia(onGuardado) },
                    enabled = !guardandoDia && clientes.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().padding(16.dp)
                ) {
                    Text(if (guardandoDia) "Guardando..." else "Guardar")
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            TextoMaquinaEscribir(
                texto = fechaFormateada,
                style = MaterialTheme.typography.titleMedium,
                empezar = true,
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
                            onMarcar = { valor -> viewModel.marcar(cliente, valor) },
                            mostrarCronometro = viewModel.esHoy,
                            asistencia = tiempoPorCliente[cliente.id],
                            onIniciarTiempo = { viewModel.iniciarTiempo(cliente) },
                            onDetenerTiempo = { viewModel.detenerTiempo(cliente) },
                            avisoAusencia = cliente.id in avisoAusenciaPorCliente,
                            motivoCambioDia = cambioDiaPorCliente[cliente.id]
                        )
                    }
                    item {
                        TextButton(
                            onClick = { mostrarConfirmacionReinicio = true },
                            enabled = !reiniciando,
                            colors = ButtonDefaults.textButtonColors(contentColor = RojoFalto),
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                        ) {
                            Text(if (reiniciando) "Reiniciando..." else "Reiniciar día")
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                    contentPadding = PaddingValues(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(clientes, key = { it.id }) { cliente ->
                        val asistio = estadoPorCliente[cliente.id] ?: false
                        val diaRealizado = diaRealizadoPorCliente[cliente.id]
                        ClienteRutinaRow(
                            cliente = cliente,
                            asistio = asistio,
                            diaRealizado = diaRealizado,
                            semanaCompleta = diaQueTocaPorCliente[cliente.id] == DiaQueToca.Descanso,
                            onElegirDia = { diaElegido -> viewModel.marcarDiaRealizado(cliente, diaElegido) }
                        )
                    }
                }
            }
        }
    }

    if (mostrarConfirmacionReinicio) {
        AlertDialog(
            onDismissRequest = { mostrarConfirmacionReinicio = false },
            title = { Text("¿Reiniciar el día?") },
            text = { Text("Se borra toda la asistencia y los cronómetros de este día, como si no se hubiera tocado nada. No se puede deshacer.") },
            confirmButton = {
                TextButton(onClick = {
                    mostrarConfirmacionReinicio = false
                    viewModel.reiniciarDia {}
                }) { Text("Reiniciar") }
            },
            dismissButton = {
                TextButton(onClick = { mostrarConfirmacionReinicio = false }) { Text("Cancelar") }
            }
        )
    }
}

@Composable
private fun ClienteAsistenciaRow(
    cliente: Cliente,
    asistio: Boolean,
    tieneRutina: Boolean,
    onMarcar: (Boolean) -> Unit,
    mostrarCronometro: Boolean,
    asistencia: Asistencia?,
    onIniciarTiempo: () -> Unit,
    onDetenerTiempo: () -> Unit,
    avisoAusencia: Boolean,
    motivoCambioDia: String?
) {
    // El color de fondo es solo indicativo (asistió/faltó); el toggle real vive en el
    // segmento de la derecha para no competir con el botón del cronómetro dentro del card.
    val colorFondo by animateColorAsState(
        targetValue = when {
            !tieneRutina -> MaterialTheme.colorScheme.surfaceVariant
            asistio -> VerdeAsistio.copy(alpha = 0.18f)
            else -> RojoFalto.copy(alpha = 0.18f)
        },
        label = "colorFondoCard"
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = colorFondo)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
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
                    if (avisoAusencia) {
                        // Solo dice *que* avisó: el motivo de una falta no se pide ni se muestra.
                        Text(
                            "🔔 Avisó que no viene",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (motivoCambioDia != null) {
                        // El motivo es texto libre del cliente en el caso "Otro": se muestra
                        // tal cual, recortado, para que no desarme la fila.
                        val texto = if (motivoCambioDia.isBlank()) {
                            "🔄 Cambió su día"
                        } else {
                            "🔄 Cambió su día: $motivoCambioDia"
                        }
                        Text(
                            texto,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                SegmentoAsistencia(
                    checked = asistio,
                    enabled = tieneRutina,
                    onClick = { onMarcar(!asistio) }
                )
            }
            if (mostrarCronometro && tieneRutina) {
                CronometroRow(
                    asistencia = asistencia,
                    onIniciar = onIniciarTiempo,
                    onDetener = onDetenerTiempo
                )
            } else if (asistio && asistencia?.duracionMinutos != null) {
                Text(
                    "Duración: ${asistencia.duracionMinutos} min",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }
    }
}

@Composable
private fun CronometroRow(
    asistencia: Asistencia?,
    onIniciar: () -> Unit,
    onDetener: () -> Unit
) {
    val horaLlegadaMillis = asistencia?.horaLlegada?.toDate()?.time
    val horaSalidaMillis = asistencia?.horaSalida?.toDate()?.time

    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        when {
            horaLlegadaMillis == null -> {
                Text("Sin iniciar", style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = onIniciar) { Text("Iniciar tiempo") }
            }
            horaSalidaMillis == null -> {
                var tiempoTexto by remember(horaLlegadaMillis) { mutableStateOf(formatearDuracion(0L)) }
                LaunchedEffect(horaLlegadaMillis) {
                    while (true) {
                        val transcurridoMs = (System.currentTimeMillis() - horaLlegadaMillis)
                            .coerceIn(0L, TiempoGymCalculator.TOPE_MINUTOS * 60_000L)
                        tiempoTexto = formatearDuracion(transcurridoMs)
                        delay(1000)
                    }
                }
                Text("⏱ $tiempoTexto", style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = onDetener) { Text("Detener") }
            }
            else -> {
                Text("Duración: ${asistencia?.duracionMinutos ?: 0} min", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

private fun formatearDuracion(ms: Long): String {
    val totalSegundos = ms / 1000
    val minutos = totalSegundos / 60
    val segundos = totalSegundos % 60
    return "%02d:%02d".format(minutos, segundos)
}

@Composable
private fun ClienteRutinaRow(
    cliente: Cliente,
    asistio: Boolean,
    diaRealizado: Int?,
    semanaCompleta: Boolean,
    onElegirDia: (Int) -> Unit
) {
    var mostrarSelector by remember { mutableStateOf(false) }
    val dias = cliente.rutinaAsignada?.dias
    val editable = asistio && dias != null

    Card(
        onClick = { mostrarSelector = true },
        enabled = editable,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(cliente.nombre, style = MaterialTheme.typography.titleMedium)
            val texto = when {
                !asistio -> "Faltó"
                // Vino con la semana ya completa: no hay día sugerido, pero el entrenador
                // puede tocar la fila y elegir cuál hizo.
                diaRealizado == null && semanaCompleta -> "Semana completa"
                diaRealizado == null -> "Sin registrar"
                else -> {
                    val nombreDia = dias?.getOrNull(diaRealizado)?.nombreDia
                    if (nombreDia != null) "Día ${diaRealizado + 1}: $nombreDia" else "Asistió"
                }
            }
            Text(texto, style = MaterialTheme.typography.bodyMedium)
        }
    }

    if (mostrarSelector && dias != null) {
        SeleccionarDiaRealizadoDialog(
            dias = dias.map { it.nombreDia },
            diaSugerido = diaRealizado ?: 0,
            onConfirmar = { diaElegido ->
                onElegirDia(diaElegido)
                mostrarSelector = false
            },
            onCancelar = { mostrarSelector = false }
        )
    }
}

@Composable
private fun SeleccionarDiaRealizadoDialog(
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
                        Text("Día ${indice + 1}: $nombreDia")
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

private val anchoSegmento = 56.dp
private val altoSegmento = 48.dp

@Composable
private fun SegmentoAsistencia(checked: Boolean, enabled: Boolean, onClick: () -> Unit) {
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
            .clickable(enabled = enabled) { onClick() }
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
