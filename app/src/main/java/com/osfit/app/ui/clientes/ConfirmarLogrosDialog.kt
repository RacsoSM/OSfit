package com.osfit.app.ui.clientes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.osfit.app.data.model.LogroPersonalCatalogo

/**
 * Selección múltiple de logros personales para la quincena. A diferencia de
 * [ConfirmarMedallaDialog] no hay sugerencia que preseleccionar: arranca vacío y el entrenador
 * marca los que quiera (o ninguno).
 *
 * El orden de marcado es el orden en que salen en el video, y define cómo se agrupan de a 3:
 * por eso la selección se guarda en una lista y no en un set.
 */
@Composable
fun ConfirmarLogrosDialog(
    catalogo: List<LogroPersonalCatalogo>,
    onConfirmar: (List<LogroPersonalCatalogo>) -> Unit,
    onCancelar: () -> Unit
) {
    val seleccionados = remember { mutableStateListOf<LogroPersonalCatalogo>() }
    val escenas = if (seleccionados.isEmpty()) 0 else (seleccionados.size + 2) / 3

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Logros personales de la quincena") },
        text = {
            Column {
                Text(
                    when {
                        seleccionados.isEmpty() -> "Ninguno seleccionado: no se agrega escena al video."
                        escenas == 1 -> "${seleccionados.size} logro(s) — salen en 1 escena."
                        else -> "${seleccionados.size} logros — salen en $escenas escenas."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 12.dp)
                )
                LazyColumn(modifier = Modifier.height(320.dp)) {
                    items(catalogo, key = { it.id }) { logro ->
                        val marcado = seleccionados.any { it.id == logro.id }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (marcado) seleccionados.removeAll { it.id == logro.id }
                                    else seleccionados.add(logro)
                                }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = marcado,
                                onCheckedChange = {
                                    if (marcado) seleccionados.removeAll { it.id == logro.id }
                                    else seleccionados.add(logro)
                                }
                            )
                            Text(logro.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(seleccionados.toList()) }) { Text("Generar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
