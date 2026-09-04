package com.osfit.app.ui.medallas

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.util.MedallaImagenUtil
import java.util.UUID

@Composable
fun MedallasScreen(viewModel: MedallasViewModel = viewModel()) {
    val medallas by viewModel.medallas.collectAsState()
    var medallaEnEdicion by remember { mutableStateOf<MedallaCatalogo?>(null) }
    var mostrarNueva by remember { mutableStateOf(false) }
    var medallaAEliminar by remember { mutableStateOf<MedallaCatalogo?>(null) }

    // Automáticas primero en el orden fijo del enum, luego las subjetivas.
    val ordenadas = remember(medallas) {
        medallas.sortedWith(compareBy({ it.categoria == null }, { it.categoria?.ordinal ?: 0 }))
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { mostrarNueva = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Nueva medalla")
            }
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(ordenadas, key = { it.id }) { medalla ->
                MedallaItem(
                    medalla = medalla,
                    onClick = { medallaEnEdicion = medalla },
                    onEliminar = { medallaAEliminar = medalla }
                )
            }
        }
    }

    medallaEnEdicion?.let { medalla ->
        EditarMedallaDialog(
            medalla = medalla,
            onGuardar = { actualizada -> viewModel.guardar(actualizada); medallaEnEdicion = null },
            onCancelar = { medallaEnEdicion = null }
        )
    }
    if (mostrarNueva) {
        // Id generado acá (no en Firestore) para que la imagen se pueda copiar a
        // filesDir/medallas/<id> antes de guardar el documento; ver MedallaRepository.guardarMedalla.
        EditarMedallaDialog(
            medalla = MedallaCatalogo(id = UUID.randomUUID().toString()),
            onGuardar = { nueva -> viewModel.guardar(nueva); mostrarNueva = false },
            onCancelar = { mostrarNueva = false }
        )
    }
    medallaAEliminar?.let { medalla ->
        AlertDialog(
            onDismissRequest = { medallaAEliminar = null },
            title = { Text("¿Borrar \"${medalla.nombre}\"?") },
            text = { Text("Esta acción no se puede deshacer.") },
            confirmButton = {
                TextButton(onClick = { viewModel.eliminar(medalla); medallaAEliminar = null }) {
                    Text("Borrar", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { medallaAEliminar = null }) { Text("Cancelar") } }
        )
    }
}

@Composable
private fun MedallaItem(medalla: MedallaCatalogo, onClick: () -> Unit, onEliminar: () -> Unit) {
    val context = LocalContext.current
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            val bitmap = remember(medalla.imagenArchivo) { MedallaImagenUtil.cargarBitmapPropio(context, medalla) }
            if (bitmap != null) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = null,
                    modifier = Modifier.size(48.dp).clip(CircleShape)
                )
            } else {
                Icon(Icons.Filled.Star, contentDescription = null, modifier = Modifier.size(48.dp))
            }
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Text(medalla.nombre, style = MaterialTheme.typography.titleMedium)
                Text(
                    if (medalla.categoria != null) "Automática" else "Subjetiva",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            if (medalla.categoria == null) {
                IconButton(onClick = onEliminar) {
                    Icon(Icons.Filled.Delete, contentDescription = "Eliminar")
                }
            }
        }
    }
}

@Composable
private fun EditarMedallaDialog(
    medalla: MedallaCatalogo,
    onGuardar: (MedallaCatalogo) -> Unit,
    onCancelar: () -> Unit
) {
    val context = LocalContext.current
    var nombre by remember { mutableStateOf(medalla.nombre) }
    var imagenArchivo by remember { mutableStateOf(medalla.imagenArchivo) }
    var mensaje by remember { mutableStateOf(medalla.mensaje) }

    val selectorImagen = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            val nuevoArchivo = MedallaImagenUtil.copiarImagen(context, uri, medalla.id)
            if (nuevoArchivo != null) imagenArchivo = nuevoArchivo
        }
    }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text(if (medalla.categoria == null && medalla.nombre.isBlank()) "Nueva medalla" else "Editar medalla") },
        text = {
            Column {
                OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre") })
                OutlinedTextField(
                    value = mensaje,
                    onValueChange = { mensaje = it },
                    label = { Text("Mensaje al otorgarla (opcional)") },
                    placeholder = { Text("Usa \$nombrePersona para el nombre del cliente") },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
                )
                OutlinedButton(
                    onClick = { selectorImagen.launch(arrayOf("image/*")) },
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
                ) {
                    Text(if (imagenArchivo != null) "Cambiar imagen" else "Elegir imagen (opcional)")
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = nombre.isNotBlank(),
                onClick = { onGuardar(medalla.copy(nombre = nombre.trim(), imagenArchivo = imagenArchivo, mensaje = mensaje.trim())) }
            ) { Text("Guardar") }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } }
    )
}
