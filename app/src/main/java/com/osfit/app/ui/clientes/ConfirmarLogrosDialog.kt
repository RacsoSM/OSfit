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

/** Máximo de logros personales otorgables en un mismo periodo: la escena del video los
 *  acomoda en triángulo (3), en pareja (2) o centrado (1) — no hay layout para más. */
private const val MAXIMO_LOGROS_PERSONALES = 3

/**
 * Selección múltiple de logros personales para la quincena, hasta [MAXIMO_LOGROS_PERSONALES].
 * A diferencia de [ConfirmarMedallaDialog] no hay sugerencia que preseleccionar: arranca vacío
 * y el entrenador marca los que quiera (o ninguno).
 */
@Composable
fun ConfirmarLogrosDialog(
    catalogo: List<LogroPersonalCatalogo>,
    onConfirmar: (List<LogroPersonalCatalogo>) -> Unit,
    onCancelar: () -> Unit
) {
    val seleccionados = remember { mutableStateListOf<LogroPersonalCatalogo>() }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Logros personales de la quincena") },
        text = {
            Column {
                Text(
                    if (seleccionados.isEmpty()) {
                        "Ninguno seleccionado: no se agrega escena al video."
                    } else {
                        "${seleccionados.size} de $MAXIMO_LOGROS_PERSONALES seleccionados."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 12.dp)
                )
                LazyColumn(modifier = Modifier.height(320.dp)) {
                    items(catalogo, key = { it.id }) { logro ->
                        val marcado = seleccionados.any { it.id == logro.id }
                        val puedeMarcar = marcado || seleccionados.size < MAXIMO_LOGROS_PERSONALES
                        fun alternar() {
                            if (marcado) seleccionados.removeAll { it.id == logro.id }
                            else if (puedeMarcar) seleccionados.add(logro)
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = puedeMarcar) { alternar() }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(checked = marcado, enabled = puedeMarcar, onCheckedChange = { alternar() })
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
