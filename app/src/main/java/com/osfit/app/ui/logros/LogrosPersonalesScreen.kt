package com.osfit.app.ui.logros

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
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.util.LogroPersonalImagenUtil
import java.util.UUID

@Composable
fun LogrosPersonalesScreen(viewModel: LogrosPersonalesViewModel = viewModel()) {
    val logros by viewModel.logros.collectAsState()
    var logroEnEdicion by remember { mutableStateOf<LogroPersonalCatalogo?>(null) }
    var mostrarNuevo by remember { mutableStateOf(false) }
    var logroAEliminar by remember { mutableStateOf<LogroPersonalCatalogo?>(null) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { mostrarNuevo = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Nuevo logro")
            }
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(logros, key = { it.id }) { logro ->
                LogroItem(
                    logro = logro,
                    onClick = { logroEnEdicion = logro },
                    onEliminar = { logroAEliminar = logro }
                )
            }
        }
    }

    logroEnEdicion?.let { logro ->
        EditarLogroDialog(
            logro = logro,
            onGuardar = { actualizado -> viewModel.guardar(actualizado); logroEnEdicion = null },
            onCancelar = { logroEnEdicion = null }
        )
    }
    if (mostrarNuevo) {
        // Id generado acá (no en Firestore) para que la imagen se pueda copiar a
        // filesDir/logrosPersonales/<id> antes de guardar el documento; ver
        // LogroPersonalRepository.guardarLogro.
        EditarLogroDialog(
            logro = LogroPersonalCatalogo(id = UUID.randomUUID().toString()),
            onGuardar = { nuevo -> viewModel.guardar(nuevo); mostrarNuevo = false },
            onCancelar = { mostrarNuevo = false }
        )
    }
    logroAEliminar?.let { logro ->
        val context = LocalContext.current
        AlertDialog(
            onDismissRequest = { logroAEliminar = null },
            title = { Text("¿Borrar \"${logro.nombre}\"?") },
            text = { Text("Esta acción no se puede deshacer.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        logro.imagenArchivo?.let { LogroPersonalImagenUtil.eliminarImagen(context, it) }
                        viewModel.eliminar(logro)
                        logroAEliminar = null
                    }
                ) {
                    Text("Borrar", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { logroAEliminar = null }) { Text("Cancelar") } }
        )
    }
}

@Composable
private fun LogroItem(logro: LogroPersonalCatalogo, onClick: () -> Unit, onEliminar: () -> Unit) {
    val context = LocalContext.current
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            val bitmap = remember(logro.imagenArchivo) { LogroPersonalImagenUtil.cargarBitmapPropio(context, logro) }
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
                Text(logro.nombre, style = MaterialTheme.typography.titleMedium)
                if (logro.mensaje.isNotBlank()) {
                    Text(
                        logro.mensaje,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1
                    )
                }
            }
            IconButton(onClick = onEliminar) {
                Icon(Icons.Filled.Delete, contentDescription = "Eliminar")
            }
        }
    }
}

@Composable
private fun EditarLogroDialog(
    logro: LogroPersonalCatalogo,
    onGuardar: (LogroPersonalCatalogo) -> Unit,
    onCancelar: () -> Unit
) {
    val context = LocalContext.current
    var nombre by remember { mutableStateOf(logro.nombre) }
    var imagenArchivo by remember { mutableStateOf(logro.imagenArchivo) }
    var mensaje by remember { mutableStateOf(logro.mensaje) }

    val selectorImagen = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            val nuevoArchivo = LogroPersonalImagenUtil.copiarImagen(context, uri, logro.id)
            if (nuevoArchivo != null) imagenArchivo = nuevoArchivo
        }
    }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text(if (logro.nombre.isBlank()) "Nuevo logro" else "Editar logro") },
        text = {
            Column {
                OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre") })
                OutlinedTextField(
                    value = mensaje,
                    onValueChange = { mensaje = it },
                    label = { Text("Mensaje al otorgarlo (opcional)") },
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
                onClick = { onGuardar(logro.copy(nombre = nombre.trim(), imagenArchivo = imagenArchivo, mensaje = mensaje.trim())) }
            ) { Text("Guardar") }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } }
    )
}
