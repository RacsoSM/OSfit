package com.osfit.app.ui.sandbox

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.Cliente
import com.osfit.app.domain.RutinaProgressCalculator
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val VerdeAsistio = Color(0xFF048751)
private val RojoFalto = Color(0xFFC23636)
private val AmbarAdvertencia = Color(0xFFB8860B)

/**
 * Pantalla de desarrollo (solo debug) para probar el avance de día de rutina simulando
 * el paso del tiempo, sin escribir nunca en Firebase: usa FakeClienteRepository y
 * FakeAsistenciaRepository, ambos en memoria.
 */
@Composable
fun SandboxScreen() {
    val viewModel: SandboxViewModel = viewModel()
    val simulatedFecha by viewModel.simulatedFecha.collectAsState()
    val clientes by viewModel.clientes.collectAsState()
    val asistenciasDelDia by viewModel.asistenciasDelDia.collectAsState()

    val asistenciaPorCliente = remember(asistenciasDelDia) {
        asistenciasDelDia.associateBy { it.clienteId }
    }

    val fechaFormateada = remember(simulatedFecha) {
        simulatedFecha.format(DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM 'del' yyyy", Locale("es")))
            .replaceFirstChar { it.uppercase() }
    }

    Scaffold(
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(AmbarAdvertencia.copy(alpha = 0.25f))
                    .padding(12.dp)
            ) {
                Text(
                    "MODO PRUEBA — no toca Firebase",
                    style = MaterialTheme.typography.titleSmall,
                    color = AmbarAdvertencia
                )
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Fecha simulada", style = MaterialTheme.typography.labelMedium)
                Text(fechaFormateada, style = MaterialTheme.typography.titleMedium)
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(onClick = { viewModel.pasarDia() }, modifier = Modifier.weight(1f)) {
                        Text("Pasar día")
                    }
                    OutlinedButton(onClick = { viewModel.reiniciarSandbox() }, modifier = Modifier.weight(1f)) {
                        Text("Reiniciar datos")
                    }
                }
            }

            if (clientes.isEmpty()) {
                Text("No hay clientes de prueba.", modifier = Modifier.padding(16.dp))
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                    contentPadding = PaddingValues(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(clientes, key = { it.id }) { cliente ->
                        val asistio = asistenciaPorCliente[cliente.id]?.asistio ?: false
                        SandboxClienteCard(
                            cliente = cliente,
                            simulatedFecha = simulatedFecha,
                            asistioHoy = asistio,
                            onAsistio = { viewModel.marcar(cliente, true) },
                            onFalto = { viewModel.marcar(cliente, false) },
                            onIniciarTiempo = { viewModel.iniciarTiempo(cliente) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SandboxClienteCard(
    cliente: Cliente,
    simulatedFecha: LocalDate,
    asistioHoy: Boolean,
    onAsistio: () -> Unit,
    onFalto: () -> Unit,
    onIniciarTiempo: () -> Unit
) {
    val diaEfectivo = RutinaProgressCalculator.diaEfectivo(
        cliente.diaActualIndex,
        cliente.diaPendienteIndex,
        cliente.diaPendienteFecha,
        simulatedFecha.toString()
    )
    val nombreDiaEfectivo = cliente.rutinaAsignada?.dias?.getOrNull(diaEfectivo)?.nombreDia

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text(cliente.nombre, style = MaterialTheme.typography.titleMedium)
            Text(
                if (nombreDiaEfectivo != null) "Día efectivo: $nombreDiaEfectivo" else "Sin rutina asignada",
                style = MaterialTheme.typography.bodyMedium
            )

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    "Guardado: actual=${cliente.diaActualIndex} pendiente=${cliente.diaPendienteIndex ?: "-"} (${cliente.diaPendienteFecha ?: "-"})",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Text(
                "Calculado (diaEfectivo): $diaEfectivo",
                style = MaterialTheme.typography.bodySmall
            )

            Text(
                if (asistioHoy) "Asistió hoy" else "No marcado hoy",
                style = MaterialTheme.typography.bodySmall,
                color = if (asistioHoy) VerdeAsistio else RojoFalto,
                modifier = Modifier.padding(top = 4.dp)
            )

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(onClick = onAsistio) { Text("Asistió") }
                Button(onClick = onFalto) { Text("Faltó") }
                TextButton(onClick = onIniciarTiempo) { Text("Iniciar tiempo") }
            }
        }
    }
}
