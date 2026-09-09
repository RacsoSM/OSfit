package com.osfit.app.ui.configvideo

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.video.PaletaVideo
import com.osfit.app.video.PaletasVideo

@Composable
fun ConfigVideoScreen(viewModel: ConfigVideoViewModel = viewModel()) {
    val periodos by viewModel.periodos.collectAsState()
    var periodoEnEdicion by remember { mutableStateOf<PeriodoConPaleta?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Text(
                "La paleta aplica a todos los videos de esa quincena. La música sigue siendo de cada cliente.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }
        items(periodos, key = { it.rangoInicio }) { periodo ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { periodoEnEdicion = periodo }
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
                        Text(periodo.paleta.nombre, style = MaterialTheme.typography.bodySmall)
                    }
                    MuestrasPaleta(periodo.paleta)
                }
            }
        }
    }

    periodoEnEdicion?.let { periodo ->
        AlertDialog(
            onDismissRequest = { periodoEnEdicion = null },
            title = { Text(periodo.encabezado) },
            text = {
                Column {
                    PaletasVideo.disponibles.forEach { paleta ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    viewModel.asignar(periodo.rangoInicio, paleta.id)
                                    periodoEnEdicion = null
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = paleta.id == periodo.paleta.id,
                                onClick = {
                                    viewModel.asignar(periodo.rangoInicio, paleta.id)
                                    periodoEnEdicion = null
                                }
                            )
                            Text(paleta.nombre, modifier = Modifier.weight(1f))
                            MuestrasPaleta(paleta)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { periodoEnEdicion = null }) { Text("Cerrar") }
            }
        )
    }
}

/** Los tres blobs y el destacado, para poder comparar paletas de un vistazo. */
@Composable
private fun MuestrasPaleta(paleta: PaletaVideo) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        listOf(paleta.blobA, paleta.blobB, paleta.blobC, paleta.destacado).forEach { color ->
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(Color(color))
            )
        }
    }
}
