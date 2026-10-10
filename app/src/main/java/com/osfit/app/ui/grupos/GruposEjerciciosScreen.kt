package com.osfit.app.ui.grupos

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.EjercicioBanco
import java.text.Normalizer

/**
 * "Ejercicios por grupo": qué ejercicios ve la clienta en cada grupo del grid de Registro de la
 * web, y en qué orden. Una sola configuración para todas. Si a una clienta le toca
 * "Pecho, hombro y tríceps", su grid arranca con la lista de Pecho, luego la de Hombro, etc.
 */
@Composable
fun GruposEjerciciosScreen(viewModel: GruposEjerciciosViewModel = viewModel()) {
    val estado by viewModel.estado.collectAsState()
    var abierto by rememberSaveable { mutableStateOf<String?>(null) }

    when {
        estado.cargando -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        estado.error -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text("No se pudo cargar el banco de ejercicios. Revisa tu conexión.")
        }
        else -> {
            val fila = estado.grupos.firstOrNull { it.grupo.id == abierto }
            if (fila == null) {
                ListaGrupos(estado.grupos) { abierto = it }
            } else {
                BackHandler { abierto = null }
                DetalleGrupo(fila, estado.banco, viewModel, alVolver = { abierto = null })
            }
        }
    }
}

@Composable
private fun ListaGrupos(grupos: List<FilaGrupo>, alAbrir: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Text(
                "Lo que ve la clienta al registrar un ejercicio en la web: primero los grupos que le " +
                    "tocan ese día (según el nombre del día) y luego los demás. Toca un grupo para elegir sus ejercicios y su orden.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }
        items(grupos, key = { it.grupo.id }) { fila ->
            Card(modifier = Modifier.fillMaxWidth().clickable { alAbrir(fila.grupo.id) }) {
                Column(Modifier.padding(16.dp)) {
                    Text(fila.grupo.nombre, style = MaterialTheme.typography.titleMedium)
                    Text(
                        buildString {
                            append(if (fila.ejercicios.size == 1) "1 ejercicio" else "${fila.ejercicios.size} ejercicios")
                            append(if (fila.configurado) " · configurado" else " · los del banco")
                        },
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (fila.ejercicios.isNotEmpty()) {
                        Text(
                            fila.ejercicios.take(3).joinToString(", ") { it.nombre } +
                                if (fila.ejercicios.size > 3) "…" else "",
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DetalleGrupo(
    fila: FilaGrupo,
    banco: List<EjercicioBanco>,
    viewModel: GruposEjerciciosViewModel,
    alVolver: () -> Unit
) {
    var agregando by remember { mutableStateOf(false) }
    val grupo = fila.grupo.id

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = alVolver) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver")
                }
                Text(fila.grupo.nombre, style = MaterialTheme.typography.titleLarge)
            }
            Text(
                if (fila.configurado) "Así lo verán tus clientas, en este orden."
                else "Todavía no lo editas: salen los ejercicios del banco de este grupo. Al cambiar algo, queda tu lista.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }
        if (fila.ejercicios.isEmpty()) {
            item { Text("Sin ejercicios: este grupo no sale en la web.", style = MaterialTheme.typography.bodyMedium) }
        }
        itemsIndexed(fila.ejercicios, key = { _, e -> e.id }) { i, e ->
            Card(Modifier.fillMaxWidth()) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("${i + 1}.", modifier = Modifier.width(28.dp))
                    Text(e.nombre, modifier = Modifier.weight(1f))
                    IconButton(onClick = { viewModel.mover(grupo, i, i - 1) }, enabled = i > 0) {
                        Icon(Icons.Filled.ArrowUpward, contentDescription = "Subir ${e.nombre}")
                    }
                    IconButton(onClick = { viewModel.mover(grupo, i, i + 1) }, enabled = i < fila.ejercicios.lastIndex) {
                        Icon(Icons.Filled.ArrowDownward, contentDescription = "Bajar ${e.nombre}")
                    }
                    IconButton(onClick = { viewModel.quitar(grupo, e.id) }) {
                        Icon(Icons.Filled.Close, contentDescription = "Quitar ${e.nombre}")
                    }
                }
            }
        }
        item {
            Button(onClick = { agregando = true }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Text("Agregar ejercicios")
            }
            if (fila.configurado) {
                OutlinedButton(onClick = { viewModel.restablecer(grupo) }, modifier = Modifier.fillMaxWidth()) {
                    Text("Volver a los del banco")
                }
            }
        }
    }

    if (agregando) {
        SelectorEjercicios(
            titulo = fila.grupo.nombre,
            banco = banco,
            elegidos = fila.ejercicios.map { it.id }.toSet(),
            alCambiar = { id, marcado -> if (marcado) viewModel.agregar(grupo, id) else viewModel.quitar(grupo, id) },
            alCerrar = { agregando = false }
        )
    }
}

private fun sinAcentos(texto: String): String =
    Normalizer.normalize(texto, Normalizer.Form.NFD).replace(Regex("\\p{M}"), "").lowercase()

/** Todo el banco con casillas: marcar agrega al final del grupo, desmarcar lo quita. */
@Composable
private fun SelectorEjercicios(
    titulo: String,
    banco: List<EjercicioBanco>,
    elegidos: Set<String>,
    alCambiar: (String, Boolean) -> Unit,
    alCerrar: () -> Unit
) {
    var buscar by remember { mutableStateOf("") }
    val filtrados = remember(buscar, banco) {
        val q = sinAcentos(buscar.trim())
        if (q.isEmpty()) banco else banco.filter { sinAcentos(it.nombre).contains(q) }
    }
    AlertDialog(
        onDismissRequest = alCerrar,
        title = { Text("Ejercicios de $titulo") },
        text = {
            Column {
                OutlinedTextField(
                    value = buscar,
                    onValueChange = { buscar = it },
                    label = { Text("Buscar") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                LazyColumn(Modifier.heightIn(max = 380.dp).padding(top = 8.dp)) {
                    items(filtrados, key = { it.id }) { e ->
                        val marcado = e.id in elegidos
                        Row(
                            Modifier.fillMaxWidth().clickable { alCambiar(e.id, !marcado) },
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(checked = marcado, onCheckedChange = { alCambiar(e.id, it) })
                            Text(e.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = alCerrar) { Text("Listo") } }
    )
}
