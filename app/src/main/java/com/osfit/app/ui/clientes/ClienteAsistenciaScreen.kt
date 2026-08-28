package com.osfit.app.ui.clientes

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
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
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.model.Asistencia
import com.osfit.app.ui.common.MonthCalendarHeader
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeParseException
import java.time.format.DateTimeFormatter
import java.util.Locale

private val VerdeAsistio = Color(0xFF2E7D32)
private val RojoFalto = Color(0xFFD32F2F)

@Composable
fun ClienteAsistenciaScreen(clienteId: String) {
    val viewModel: ClienteAsistenciaViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteAsistenciaViewModel(clienteId) } }
    )
    val asistencias by viewModel.asistencias.collectAsState()
    var mesVisible by remember { mutableStateOf(YearMonth.now()) }

    val estadoPorFecha: Map<LocalDate, Asistencia> = remember(asistencias) {
        asistencias.mapNotNull { asistencia ->
            try {
                LocalDate.parse(asistencia.fecha) to asistencia
            } catch (e: DateTimeParseException) {
                null
            }
        }.toMap()
    }
    var asistenciaSeleccionada by remember { mutableStateOf<Asistencia?>(null) }

    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Text(
                "Calendario de asistencia",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(16.dp)
            )
            MonthCalendarHeader(
                mesVisible = mesVisible,
                onMesAnterior = { mesVisible = mesVisible.minusMonths(1) },
                onMesSiguiente = { mesVisible = mesVisible.plusMonths(1) }
            )
            HistorialCalendarGrid(
                mesVisible = mesVisible,
                estadoPorFecha = estadoPorFecha,
                onDiaClick = { asistenciaSeleccionada = it }
            )
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Leyenda(color = VerdeAsistio, texto = "Asistió")
                Leyenda(color = RojoFalto, texto = "Faltó")
            }
        }
    }

    asistenciaSeleccionada?.let { asistencia ->
        DetalleAsistenciaDialog(asistencia = asistencia, onDismiss = { asistenciaSeleccionada = null })
    }
}

private val FORMATO_FECHA_DIALOG = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale("es"))

@Composable
private fun DetalleAsistenciaDialog(asistencia: Asistencia, onDismiss: () -> Unit) {
    val fecha = try {
        LocalDate.parse(asistencia.fecha).format(FORMATO_FECHA_DIALOG)
    } catch (e: DateTimeParseException) {
        asistencia.fecha
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cerrar") } },
        title = { Text(fecha) },
        text = {
            Column {
                Text(if (asistencia.asistio) "Asistió" else "Faltó")
                if (asistencia.asistio) {
                    Text("Duración: ${formatearDuracion(asistencia.duracionMinutos)}")
                }
            }
        }
    )
}

private fun formatearDuracion(duracionMinutos: Int?): String {
    if (duracionMinutos == null) return "No registrada"
    val horas = duracionMinutos / 60
    val minutos = duracionMinutos % 60
    return if (horas > 0) "${horas}h ${minutos}min" else "${minutos} min"
}

@Composable
private fun Leyenda(color: Color, texto: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(modifier = Modifier.size(14.dp).clip(CircleShape).background(color))
        Text(texto, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun HistorialCalendarGrid(
    mesVisible: YearMonth,
    estadoPorFecha: Map<LocalDate, Asistencia>,
    onDiaClick: (Asistencia) -> Unit
) {
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
                            val asistencia = estadoPorFecha[fecha]
                            val colorFondo = when (asistencia?.asistio) {
                                true -> VerdeAsistio
                                false -> RojoFalto
                                null -> Color.Transparent
                            }
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape)
                                    .background(colorFondo)
                                    .let {
                                        if (asistencia != null) it.clickable { onDiaClick(asistencia) } else it
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    indiceDia.toString(),
                                    color = if (asistencia != null) Color.White else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
