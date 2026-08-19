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
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.Asistencia
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

private val VerdeBuenaAsistencia = Color(0xFF048751)
private val AmarilloAsistenciaMedia = Color(0xFFDBD74B)
private val RojoBajaAsistencia = Color(0xFFC23636)
private val GrisSinDatos = Color(0xFF5A5A5A)

@Composable
fun CalendarioScreen(
    onAbrirAsistencia: (fecha: String) -> Unit,
    viewModel: CalendarioViewModel = viewModel()
) {
    val mesVisible by viewModel.mesVisible.collectAsState()
    val clientesActivos by viewModel.clientesActivos.collectAsState()
    val asistenciasDelMes by viewModel.asistenciasDelMes.collectAsState()

    val colorPorFecha: Map<LocalDate, Color> = remember(asistenciasDelMes, clientesActivos, mesVisible) {
        calcularColoresPorFecha(asistenciasDelMes, clientesActivos.map { it.id }.toSet(), mesVisible)
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { onAbrirAsistencia(LocalDate.now().toString()) }) {
                Icon(Icons.Filled.EventAvailable, contentDescription = "Registrar asistencia de hoy")
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            CalendarHeader(
                mesVisible = mesVisible,
                onMesAnterior = { viewModel.cambiarMes(mesVisible.minusMonths(1)) },
                onMesSiguiente = { viewModel.cambiarMes(mesVisible.plusMonths(1)) }
            )
            CalendarGrid(
                mesVisible = mesVisible,
                colorPorFecha = colorPorFecha,
                onDiaClick = { fecha -> onAbrirAsistencia(fecha.toString()) }
            )
        }
    }
}

private fun calcularColoresPorFecha(
    asistencias: List<Asistencia>,
    idsClientesActivos: Set<String>,
    mesVisible: YearMonth
): Map<LocalDate, Color> {
    if (idsClientesActivos.isEmpty()) return emptyMap()
    val registrosPorFecha = asistencias
        .filter { it.clienteId in idsClientesActivos }
        .groupBy { it.fecha }

    val primerDiaDelMes = mesVisible.atDay(1)
    return (0 until mesVisible.lengthOfMonth()).associate { offset ->
        val fecha = primerDiaDelMes.plusDays(offset.toLong())
        val registrosDelDia = registrosPorFecha[fecha.toString()]
        val asistieron = registrosDelDia?.count { it.asistio } ?: 0
        val color = if (registrosDelDia.isNullOrEmpty() || asistieron == 0) {
            GrisSinDatos
        } else {
            val porcentaje = asistieron.toDouble() / idsClientesActivos.size
            when {
                porcentaje >= 0.65 -> VerdeBuenaAsistencia
                porcentaje >= 0.35 -> AmarilloAsistenciaMedia
                else -> RojoBajaAsistencia
            }
        }
        fecha to color
    }
}

@Composable
private fun CalendarHeader(mesVisible: YearMonth, onMesAnterior: () -> Unit, onMesSiguiente: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onMesAnterior) { Icon(Icons.Filled.ChevronLeft, contentDescription = "Mes anterior") }
        Text(
            "${mesVisible.month.getDisplayName(TextStyle.FULL, Locale("es"))} ${mesVisible.year}",
            style = MaterialTheme.typography.headlineSmall
        )
        IconButton(onClick = onMesSiguiente) { Icon(Icons.Filled.ChevronRight, contentDescription = "Mes siguiente") }
    }
}

@Composable
private fun CalendarGrid(
    mesVisible: YearMonth,
    colorPorFecha: Map<LocalDate, Color>,
    onDiaClick: (LocalDate) -> Unit
) {
    val primerDiaDelMes = mesVisible.atDay(1)
    val diasEnMes = mesVisible.lengthOfMonth()
    val offsetInicial = primerDiaDelMes.dayOfWeek.value % 7 // Domingo = 0
    val hoy = LocalDate.now()

    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            listOf("D", "L", "M", "M", "J", "V", "S").forEach { letra ->
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(letra, style = MaterialTheme.typography.titleSmall)
                }
            }
        }
        val totalCeldas = offsetInicial + diasEnMes
        val filas = (totalCeldas + 6) / 7
        for (fila in 0 until filas) {
            Row(modifier = Modifier.fillMaxWidth().weight(1f)) {
                for (columna in 0 until 7) {
                    val indiceDia = fila * 7 + columna - offsetInicial + 1
                    Box(
                        modifier = Modifier.weight(1f).fillMaxSize().padding(4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (indiceDia in 1..diasEnMes) {
                            val fecha = mesVisible.atDay(indiceDia)
                            val esHoy = fecha == hoy
                            val colorFondo = colorPorFecha[fecha] ?: Color.Transparent
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .aspectRatio(1f)
                                    .clip(CircleShape)
                                    .background(colorFondo)
                                    .then(
                                        if (esHoy) {
                                            Modifier.border(2.dp, MaterialTheme.colorScheme.primary, CircleShape)
                                        } else {
                                            Modifier
                                        }
                                    )
                                    .clickable { onDiaClick(fecha) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    indiceDia.toString(),
                                    style = MaterialTheme.typography.titleMedium,
                                    color = if (colorFondo != Color.Transparent) Color.White else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
