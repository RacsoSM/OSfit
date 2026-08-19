package com.osfit.app.ui.clientes

import androidx.compose.foundation.background
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
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
import com.osfit.app.ui.common.MonthCalendarHeader
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeParseException

private val VerdeAsistio = Color(0xFF2E7D32)
private val RojoFalto = Color(0xFFD32F2F)

@Composable
fun ClienteAsistenciaScreen(clienteId: String) {
    val viewModel: ClienteAsistenciaViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteAsistenciaViewModel(clienteId) } }
    )
    val asistencias by viewModel.asistencias.collectAsState()
    var mesVisible by remember { mutableStateOf(YearMonth.now()) }

    val estadoPorFecha: Map<LocalDate, Boolean> = remember(asistencias) {
        asistencias.mapNotNull { asistencia ->
            try {
                LocalDate.parse(asistencia.fecha) to asistencia.asistio
            } catch (e: DateTimeParseException) {
                null
            }
        }.toMap()
    }

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
            HistorialCalendarGrid(mesVisible = mesVisible, estadoPorFecha = estadoPorFecha)
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Leyenda(color = VerdeAsistio, texto = "Asistió")
                Leyenda(color = RojoFalto, texto = "Faltó")
            }
        }
    }
}

@Composable
private fun Leyenda(color: Color, texto: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(modifier = Modifier.size(14.dp).clip(CircleShape).background(color))
        Text(texto, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun HistorialCalendarGrid(mesVisible: YearMonth, estadoPorFecha: Map<LocalDate, Boolean>) {
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
                            val asistio = estadoPorFecha[fecha]
                            val colorFondo = when (asistio) {
                                true -> VerdeAsistio
                                false -> RojoFalto
                                null -> Color.Transparent
                            }
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape)
                                    .background(colorFondo),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    indiceDia.toString(),
                                    color = if (asistio != null) Color.White else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
