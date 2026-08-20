package com.osfit.app.ui.rutinas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.Rutina
import com.osfit.app.ui.common.TextoMaquinaEscribir

@Composable
fun RutinasListScreen(
    onCrearRutina: () -> Unit,
    onEditarRutina: (String) -> Unit,
    viewModel: RutinasViewModel = viewModel()
) {
    val rutinas by viewModel.rutinas.collectAsState()

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = onCrearRutina) {
                Icon(Icons.Filled.Add, contentDescription = "Nueva rutina")
            }
        }
    ) { padding ->
        if (rutinas.isEmpty()) {
            Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                TextoMaquinaEscribir(
                    texto = "Rutinas",
                    style = MaterialTheme.typography.headlineMedium,
                    empezar = true,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                Text("Aún no hay plantillas de rutina. Toca + para crear una.")
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    TextoMaquinaEscribir(
                        texto = "Rutinas",
                        style = MaterialTheme.typography.headlineMedium,
                        empezar = true,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )
                }
                items(rutinas, key = { it.id }) { rutina ->
                    RutinaItem(rutina = rutina, onClick = { onEditarRutina(rutina.id) }, onEliminar = { viewModel.eliminarRutina(rutina.id) })
                }
            }
        }
    }
}

@Composable
private fun RutinaItem(rutina: Rutina, onClick: () -> Unit, onEliminar: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        androidx.compose.foundation.layout.Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                Text(rutina.nombre, style = MaterialTheme.typography.titleMedium)
                Text("${rutina.dias.size} día(s)", style = MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick = onEliminar) {
                Icon(Icons.Filled.Delete, contentDescription = "Eliminar")
            }
        }
    }
}
