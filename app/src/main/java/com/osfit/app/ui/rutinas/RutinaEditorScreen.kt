package com.osfit.app.ui.rutinas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.ui.common.EjercicioRow

@Composable
fun RutinaEditorScreen(rutinaId: String?, onGuardado: () -> Unit) {
    val viewModel: RutinaEditorViewModel = viewModel(
        factory = viewModelFactory { initializer { RutinaEditorViewModel(rutinaId) } }
    )
    val rutina by viewModel.rutina.collectAsState()
    val guardado by viewModel.guardado.collectAsState()

    LaunchedEffect(guardado) {
        if (guardado) onGuardado()
    }

    Scaffold { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                OutlinedTextField(
                    value = rutina.nombre,
                    onValueChange = viewModel::cambiarNombre,
                    label = { Text("Nombre de la rutina") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            itemsIndexed(rutina.dias) { indiceDia, dia ->
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            OutlinedTextField(
                                value = dia.nombreDia,
                                onValueChange = { viewModel.cambiarNombreDia(indiceDia, it) },
                                label = { Text("Nombre del día") },
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(onClick = { viewModel.eliminarDia(indiceDia) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Eliminar día")
                            }
                        }
                        dia.ejercicios.forEachIndexed { indiceEjercicio, ejercicio ->
                            EjercicioRow(
                                ejercicio = ejercicio,
                                onChange = { viewModel.actualizarEjercicio(indiceDia, indiceEjercicio, it) },
                                onEliminar = { viewModel.eliminarEjercicio(indiceDia, indiceEjercicio) }
                            )
                        }
                        Button(onClick = { viewModel.agregarEjercicio(indiceDia) }) {
                            Icon(Icons.Filled.Add, contentDescription = null)
                            Text("Agregar ejercicio")
                        }
                    }
                }
            }
            item {
                Button(onClick = viewModel::agregarDia, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    Text("Agregar día")
                }
            }
            item {
                Button(
                    onClick = viewModel::guardar,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = rutina.nombre.isNotBlank() && rutina.dias.isNotEmpty()
                ) {
                    Text("Guardar rutina")
                }
            }
        }
    }
}
