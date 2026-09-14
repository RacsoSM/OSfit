package com.osfit.app.ui.clientes

import android.content.Context
import android.media.MediaPlayer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.util.CancionUtil
import java.io.File
import kotlinx.coroutines.delay

/** Cuánto suena la canción al tocar reproducir en el preview: suficiente para ubicar el
 *  fragmento por oído sin tener que escuchar la canción completa. */
private const val DURACION_PREVIEW_MS = 8_000L

@Composable
fun ClienteEditarScreen(
    clienteId: String,
    onGuardado: () -> Unit
) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val clienteActual = cliente ?: return
    val context = LocalContext.current

    var nombre by remember { mutableStateOf(clienteActual.nombre) }
    var telefono by remember { mutableStateOf(clienteActual.telefono) }
    var peso by remember { mutableStateOf(clienteActual.peso?.toString() ?: "") }
    var altura by remember { mutableStateOf(clienteActual.altura?.toString() ?: "") }
    var edad by remember { mutableStateOf(clienteActual.edad?.toString() ?: "") }
    var segundosPorEjercicio by remember { mutableStateOf(clienteActual.segundosPorEjercicio?.toString() ?: "") }
    var minutosDescanso by remember { mutableStateOf(clienteActual.minutosDescanso?.toString() ?: "") }
    var cancionArchivo by remember { mutableStateOf(clienteActual.cancionArchivo) }
    var cancionRuta by remember { mutableStateOf(clienteActual.cancionRuta) }
    var inicioSegundos by remember { mutableStateOf(clienteActual.cancionInicioSegundos ?: 0) }

    // La subida vive en el ViewModel y escribe `cancionRuta` sola. Acá se recoge nada más para
    // que el guardado mande la ruta nueva y no la nula que quedó al elegir la canción: si no,
    // Guardar pisaría con null un respaldo que ya existe.
    val rutaRespaldada by viewModel.cancionRutaRespaldada.collectAsState()
    LaunchedEffect(rutaRespaldada) {
        rutaRespaldada?.let { cancionRuta = it }
    }

    val selectorCancion = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val archivoAnterior = cancionArchivo
            val nuevoArchivo = CancionUtil.copiarCancion(context, uri, clienteId)
            if (nuevoArchivo != null) {
                // El nombre siempre es "<clienteId>.<ext>": si cambia la extensión, el archivo
                // viejo con otra extensión se queda huérfano y hay que borrarlo aparte.
                if (archivoAnterior != null && archivoAnterior != nuevoArchivo) {
                    CancionUtil.eliminarCancion(context, archivoAnterior)
                }
                cancionArchivo = nuevoArchivo
                inicioSegundos = 0
                // La copia local ya está hecha y el video funciona con ella. La ruta vieja se
                // invalida acá y no se deduce del nombre: con la misma extensión, el nombre es
                // el mismo y apuntaría a los bytes de la canción anterior.
                cancionRuta = null
                // El respaldo se intenta después, desde el ViewModel, que sobrevive a que esta
                // pantalla se vaya: si falla, la ruta se queda nula y esta canción se reintenta
                // la próxima vez que se elija. Nada más se rompe mientras tanto.
                viewModel.respaldarCancion(CancionUtil.archivoCancion(context, nuevoArchivo))
            }
        }
    }

    val nombreValido = nombre.isNotBlank()

    Scaffold(
        bottomBar = {
            Button(
                onClick = {
                    viewModel.actualizarDatosPersonales(
                        nombre = nombre.trim(),
                        telefono = telefono.trim(),
                        peso = peso.toDoubleOrNull(),
                        altura = altura.toDoubleOrNull(),
                        edad = edad.toIntOrNull(),
                        segundosPorEjercicio = segundosPorEjercicio.toIntOrNull(),
                        minutosDescanso = minutosDescanso.toDoubleOrNull()
                    )
                    viewModel.actualizarCancion(
                        archivo = cancionArchivo,
                        ruta = cancionArchivo?.let { cancionRuta },
                        inicioSegundos = cancionArchivo?.let { inicioSegundos }
                    )
                    onGuardado()
                },
                enabled = nombreValido,
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            ) {
                Text("Guardar")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Editar cliente", style = MaterialTheme.typography.headlineSmall)
            OutlinedTextField(
                value = nombre,
                onValueChange = { nombre = it },
                label = { Text("Nombre") },
                isError = !nombreValido,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = telefono,
                onValueChange = { telefono = it },
                label = { Text("Teléfono") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = peso,
                onValueChange = { peso = it },
                label = { Text("Peso (kg)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = altura,
                onValueChange = { altura = it },
                label = { Text("Altura (cm)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = edad,
                onValueChange = { edad = it },
                label = { Text("Edad") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = segundosPorEjercicio,
                onValueChange = { segundosPorEjercicio = it },
                label = { Text("Segundos por ejercicio") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = minutosDescanso,
                onValueChange = { minutosDescanso = it },
                label = { Text("Minutos de descanso") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth()
            )

            Text("Canción personalizada", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = { selectorCancion.launch(arrayOf("audio/*")) }) {
                    Text(if (cancionArchivo == null) "Elegir canción" else "Cambiar canción")
                }
                if (cancionArchivo != null) {
                    OutlinedButton(
                        onClick = {
                            cancionArchivo?.let { CancionUtil.eliminarCancion(context, it) }
                            cancionArchivo = null
                            inicioSegundos = 0
                        }
                    ) {
                        Text("Quitar")
                    }
                }
            }
            cancionArchivo?.let { archivo ->
                ReproductorCancionPreview(
                    context = context,
                    archivo = CancionUtil.archivoCancion(context, archivo),
                    inicioSegundos = inicioSegundos,
                    onInicioSegundosChange = { inicioSegundos = it }
                )
            }
        }
    }
}

/**
 * Play/pause + slider para que el trainer ubique por oído el fragmento de la canción que
 * quiere de fondo en el video, sin tener que escucharla completa desde otra app.
 */
@Composable
private fun ReproductorCancionPreview(
    context: Context,
    archivo: File,
    inicioSegundos: Int,
    onInicioSegundosChange: (Int) -> Unit
) {
    var mediaPlayer by remember(archivo) { mutableStateOf<MediaPlayer?>(null) }
    var duracionMs by remember(archivo) { mutableStateOf(0) }
    var reproduciendo by remember(archivo) { mutableStateOf(false) }

    DisposableEffect(archivo) {
        val player = MediaPlayer()
        val preparado = runCatching {
            player.setDataSource(archivo.absolutePath)
            player.prepare()
        }.isSuccess
        if (preparado) {
            // seekTo() es asíncrono: si se llama start() justo después sin esperar a que
            // termine, la reproducción arranca desde donde iba antes del seek (0 al preparar),
            // no desde la posición pedida. Por eso el "inicio del fragmento" nunca se movía.
            player.setOnSeekCompleteListener { it.start() }
        }
        mediaPlayer = if (preparado) player else null
        duracionMs = if (preparado) player.duration else 0
        onDispose {
            player.release()
            mediaPlayer = null
        }
    }

    // Auto-pausa el preview tras unos segundos: es solo para ubicar el fragmento, no para
    // escuchar la canción completa.
    LaunchedEffect(reproduciendo) {
        if (reproduciendo) {
            delay(DURACION_PREVIEW_MS)
            mediaPlayer?.pause()
            reproduciendo = false
        }
    }

    val duracionSegundos = (duracionMs / 1000).coerceAtLeast(0)

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(
                onClick = {
                    val player = mediaPlayer ?: return@IconButton
                    if (reproduciendo) {
                        player.pause()
                        reproduciendo = false
                    } else {
                        // start() se dispara desde el OnSeekCompleteListener una vez que el
                        // seek de verdad terminó (ver DisposableEffect de más arriba).
                        player.seekTo(inicioSegundos * 1000)
                        reproduciendo = true
                    }
                },
                enabled = mediaPlayer != null
            ) {
                Icon(
                    if (reproduciendo) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = if (reproduciendo) "Pausar preview" else "Reproducir preview"
                )
            }
            Text(
                "Inicio del fragmento: ${formatoMmSs(inicioSegundos)}" +
                    if (duracionSegundos > 0) " / ${formatoMmSs(duracionSegundos)}" else ""
            )
        }
        if (duracionSegundos > 0) {
            Slider(
                value = inicioSegundos.toFloat().coerceAtMost(duracionSegundos.toFloat()),
                onValueChange = { nuevoValor ->
                    mediaPlayer?.pause()
                    reproduciendo = false
                    onInicioSegundosChange(nuevoValor.toInt())
                },
                valueRange = 0f..duracionSegundos.toFloat()
            )
        }
    }
}

private fun formatoMmSs(totalSegundos: Int): String {
    val minutos = totalSegundos / 60
    val segundos = totalSegundos % 60
    return "%d:%02d".format(minutos, segundos)
}
