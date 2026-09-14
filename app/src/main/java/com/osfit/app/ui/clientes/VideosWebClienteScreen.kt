package com.osfit.app.ui.clientes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.model.VideoPublicado

@Composable
fun VideosWebClienteScreen(clienteId: String) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val videos by viewModel.videosPublicados.collectAsState()
    val error by viewModel.errorVideo.collectAsState()

    var porQuitar by remember { mutableStateOf<VideoPublicado?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(error) {
        error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.limpiarErrorVideo()
        }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { Text("Videos en la web", style = MaterialTheme.typography.headlineSmall) }
            if (videos.isEmpty()) {
                item { Text("Todavía no tiene videos publicados.", style = MaterialTheme.typography.bodyMedium) }
            } else {
                items(videos, key = { it.rangoInicio }) { video ->
                    VideoPublicadoCard(video = video, onQuitar = { porQuitar = video })
                }
            }
        }
    }

    porQuitar?.let { video ->
        AlertDialog(
            onDismissRequest = { porQuitar = null },
            title = { Text("Quitar el video de la web") },
            // Se avisa lo que cuesta deshacerlo: el mp4 original se borra del caché del
            // teléfono al cabo de una hora, así que volver a publicarlo obliga a regenerar el
            // video entero (más de un minuto de trabajo del teléfono).
            text = {
                Text(
                    "\"${video.encabezadoRango}\" dejará de verse en su página. Para volver a " +
                        "publicarlo hay que generar el video otra vez."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.quitarVideoPublicado(video)
                    porQuitar = null
                }) { Text("Quitar") }
            },
            dismissButton = {
                TextButton(onClick = { porQuitar = null }) { Text("Cancelar") }
            }
        )
    }
}

@Composable
private fun VideoPublicadoCard(video: VideoPublicado, onQuitar: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Filled.Videocam, contentDescription = null)
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Text(video.encabezadoRango, style = MaterialTheme.typography.titleMedium)
                Text(duracionEnMinutosYSegundos(video.duracionSegundos), style = MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick = onQuitar) {
                Icon(Icons.Filled.Delete, contentDescription = "Quitar video de la web")
            }
        }
    }
}

private fun duracionEnMinutosYSegundos(segundos: Int) =
    "%d:%02d".format(segundos / 60, segundos % 60)
