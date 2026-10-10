package com.osfit.app.ui.avisos

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.AvisoAutomatico
import com.osfit.app.data.model.Notificacion
import com.osfit.app.domain.Avisos
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Etiquetas cortas de los botones rápidos, en el mismo orden que [Avisos.RAPIDOS]. */
private val EtiquetasRapidos = listOf("Ya llegamos", "Ya nos fuimos", "Llegaremos más tarde")

private val FormatoFecha = DateTimeFormatter.ofPattern("d MMM HH:mm", Locale("es"))

/**
 * Escribir y mandar un aviso a las clientas, y ver lo ya enviado.
 *
 * Los botones rápidos llenan el campo y no envían, y enviar pide confirmación: un aviso que
 * ya salió no se puede retirar, así que nada se manda por un toque accidental.
 */
@Composable
fun AvisosScreen(viewModel: AvisosViewModel = viewModel()) {
    val texto by viewModel.texto.collectAsState()
    val elegidos by viewModel.elegidos.collectAsState()
    val habilitadas by viewModel.habilitadas.collectAsState()
    val destinatarias by viewModel.destinatarias.collectAsState()
    val historial by viewModel.historial.collectAsState()
    var confirmando by remember { mutableStateOf(false) }

    Scaffold { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { Text("Avisos", style = MaterialTheme.typography.headlineSmall) }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(Avisos.RAPIDOS.zip(EtiquetasRapidos)) { (rapido, etiqueta) ->
                        AssistChip(onClick = { viewModel.usarRapido(rapido) }, label = { Text(etiqueta) })
                    }
                }
            }
            item {
                OutlinedTextField(
                    value = texto,
                    onValueChange = viewModel::cambiarTexto,
                    label = { Text("Texto del aviso") },
                    minLines = 3,
                    supportingText = { Text("${texto.length}/${Avisos.LARGO_MAXIMO}") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            if (habilitadas.isEmpty()) {
                item {
                    Text(
                        "Ninguna clienta tiene las notificaciones habilitadas. Actívalas en el apartado Web de cada una.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else {
                item {
                    Column {
                        FilaOpcion(
                            texto = "Todas las habilitadas (${habilitadas.size})",
                            elegida = elegidos == null,
                            onElegir = viewModel::elegirTodas
                        )
                        FilaOpcion(
                            texto = "Elegir…",
                            elegida = elegidos != null,
                            onElegir = { if (elegidos == null) viewModel.elegidos.value = emptySet() }
                        )
                    }
                }
                val seleccion = elegidos
                if (seleccion != null) {
                    items(habilitadas, key = { it.id }) { cliente ->
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable { viewModel.alternar(cliente.id) },
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = cliente.id in seleccion,
                                onCheckedChange = { viewModel.alternar(cliente.id) }
                            )
                            Text(cliente.nombre)
                        }
                    }
                }
            }
            item {
                Button(
                    onClick = { confirmando = true },
                    enabled = texto.isNotBlank() && destinatarias > 0,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Enviar") }
            }
            item { Text("Enviados", style = MaterialTheme.typography.titleMedium) }
            if (historial.isEmpty()) {
                item { Text("Todavía no has enviado avisos.", style = MaterialTheme.typography.bodySmall) }
            }
            items(historial, key = { it.id }) { FilaHistorial(it) }
        }
    }

    if (confirmando) {
        AlertDialog(
            onDismissRequest = { confirmando = false },
            title = { Text("¿Enviar aviso?") },
            text = {
                Text(
                    "“${texto.trim()}”\n\nLe llegará a $destinatarias " +
                        (if (destinatarias == 1) "clienta" else "clientas") +
                        " que tengan las notificaciones activadas en su teléfono. " +
                        "Un aviso enviado no se puede retirar."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.enviar()
                    confirmando = false
                }) { Text("Enviar") }
            },
            dismissButton = { TextButton(onClick = { confirmando = false }) { Text("Cancelar") } }
        )
    }
}

@Composable
private fun FilaOpcion(texto: String, elegida: Boolean, onElegir: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onElegir),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(selected = elegida, onClick = onElegir)
        Text(texto)
    }
}

@Composable
private fun FilaHistorial(aviso: Notificacion) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Recién escrito, `creada` es null hasta que el servidor pone la hora.
            val fecha = aviso.creada?.toDate()?.toInstant()?.atZone(ZoneId.systemDefault())
            Text(
                fecha?.format(FormatoFecha) ?: "Ahora",
                style = MaterialTheme.typography.labelSmall
            )
            AvisoAutomatico.deLlave(aviso.automatico)?.let {
                Text("Automático · ${it.titulo}", style = MaterialTheme.typography.labelSmall)
            }
            Text(aviso.texto, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(Avisos.resumen(aviso), style = MaterialTheme.typography.bodySmall)
        }
    }
}
