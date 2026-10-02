package com.osfit.app.ui.configvideo

import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.paletas.Paletas
import com.osfit.app.ui.common.MuestrasPaletaVideo
import com.osfit.app.video.EstilosVideo

@Composable
fun ConfigVideoScreen(viewModel: ConfigVideoViewModel = viewModel()) {
    val periodos by viewModel.periodos.collectAsState()
    var rangoEnEdicion by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Text(
                "El estilo y la paleta aplican a todos los videos quincenales de esa quincena. La música sigue siendo de cada cliente.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }
        items(periodos, key = { it.rangoInicio }) { periodo ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { rangoEnEdicion = periodo.rangoInicio }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            if (periodo.esActual) "${periodo.encabezado} (actual)" else periodo.encabezado,
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(periodo.estilo.nombre, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            if (periodo.estilo.usaPaleta) periodo.paleta.nombre else "Colores propios del estilo",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    if (periodo.estilo.usaPaleta) MuestrasPaletaVideo(periodo.paleta)
                }
            }
        }
    }

    // El Flow actualiza las selecciones sin cerrar el diálogo ni conservar una copia vieja.
    periodos.firstOrNull { it.rangoInicio == rangoEnEdicion }?.let { periodo ->
        AlertDialog(
            onDismissRequest = { rangoEnEdicion = null },
            title = { Text(periodo.encabezado) },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text("Estilo", style = MaterialTheme.typography.titleSmall)
                    EstilosVideo.disponibles.forEach { estilo ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { viewModel.asignarEstilo(periodo.rangoInicio, estilo.id) }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = estilo.id == periodo.estilo.id,
                                onClick = { viewModel.asignarEstilo(periodo.rangoInicio, estilo.id) }
                            )
                            Column {
                                Text(estilo.nombre)
                                Text(estilo.descripcion, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                    if (periodo.estilo.usaPaleta) {
                        Text("Paleta", style = MaterialTheme.typography.titleSmall)
                        Paletas.disponibles.forEach { paleta ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        viewModel.asignarPaleta(periodo.rangoInicio, paleta.id)
                                    }
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = paleta.id == periodo.paleta.id,
                                    onClick = {
                                        viewModel.asignarPaleta(periodo.rangoInicio, paleta.id)
                                    }
                                )
                                Text(paleta.nombre, modifier = Modifier.weight(1f))
                                MuestrasPaletaVideo(paleta)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { rangoEnEdicion = null }) { Text("Cerrar") }
            }
        )
    }
}
