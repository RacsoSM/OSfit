package com.osfit.app.ui.rutinas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.compose.material3.MaterialTheme
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import com.osfit.app.domain.etiquetaVariacion
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
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Reiniciar el ciclo cada lunes",
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Text(
                            "El último día solo se hace si viene la semana completa. " +
                                "Úsalo cuando el primer día y el último trabajan lo mismo.",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Switch(
                        checked = rutina.reinicioSemanal,
                        onCheckedChange = viewModel::cambiarReinicioSemanal
                    )
                }
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
                        if (dia.variaciones.isEmpty()) {
                            EjerciciosEditables(
                                ejercicios = dia.ejercicios,
                                indiceDia = indiceDia,
                                variacion = null,
                                viewModel = viewModel
                            )
                        } else {
                            dia.variaciones.forEachIndexed { posicion, variacion ->
                                Text(
                                    "Variación ${etiquetaVariacion(posicion)}",
                                    style = MaterialTheme.typography.labelMedium,
                                    modifier = Modifier.padding(top = 8.dp)
                                )
                                EjerciciosEditables(
                                    ejercicios = variacion.ejercicios,
                                    indiceDia = indiceDia,
                                    variacion = posicion,
                                    viewModel = viewModel
                                )
                            }
                        }
                        VariacionesDelDia(dia = dia, indiceDia = indiceDia, viewModel = viewModel)
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

@Composable
private fun EjerciciosEditables(
    ejercicios: List<Ejercicio>,
    indiceDia: Int,
    variacion: Int?,
    viewModel: RutinaEditorViewModel
) {
    ejercicios.forEachIndexed { indiceEjercicio, ejercicio ->
        EjercicioRow(
            ejercicio = ejercicio,
            onChange = { viewModel.actualizarEjercicio(indiceDia, indiceEjercicio, it, variacion) },
            onEliminar = { viewModel.eliminarEjercicio(indiceDia, indiceEjercicio, variacion) },
            // La clienta ve `pesoONota` en su página desde el 2026-09-15, así que también se
            // escribe acá y no sólo en la rutina propia de cada una.
            mostrarPesoONota = true,
            onSubir = if (indiceEjercicio == 0) {
                null
            } else {
                { viewModel.moverEjercicio(indiceDia, indiceEjercicio, -1, variacion) }
            },
            onBajar = if (indiceEjercicio == ejercicios.lastIndex) {
                null
            } else {
                { viewModel.moverEjercicio(indiceDia, indiceEjercicio, 1, variacion) }
            }
        )
    }
    Button(onClick = { viewModel.agregarEjercicio(indiceDia, variacion) }) {
        Icon(Icons.Filled.Add, contentDescription = null)
        Text("Agregar ejercicio")
    }
}

/**
 * Los dos botones que manejan el invariante de [DiaRutina]. Llaman a las funciones de `domain/`,
 * las mismas que usa el editor de la rutina propia de una clienta.
 */
@Composable
private fun VariacionesDelDia(dia: DiaRutina, indiceDia: Int, viewModel: RutinaEditorViewModel) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Button(onClick = { viewModel.agregarVariacion(indiceDia) }) { Text("Agregar variación") }
        if (dia.variaciones.isNotEmpty()) {
            Button(onClick = { viewModel.quitarVariacion(indiceDia) }) { Text("Quitar variación") }
        }
    }
}
