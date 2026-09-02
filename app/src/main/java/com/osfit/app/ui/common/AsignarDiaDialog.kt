package com.osfit.app.ui.common

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Diálogo para corregir manualmente en qué día del ciclo está un cliente.
 * Compartido entre Clientes (ClienteDetailScreen) y el sandbox de pruebas, para que
 * ambos ejerciten exactamente el mismo comportamiento.
 */
@Composable
fun AsignarDiaDialog(
    dias: List<String>,
    diaActual: Int,
    onConfirmar: (Int) -> Unit,
    onCancelar: () -> Unit
) {
    var seleccionado by remember { mutableStateOf(diaActual.coerceIn(0, dias.lastIndex)) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Asignar día del ciclo") },
        text = {
            Column {
                Text(
                    "Útil si el cliente se salió de lo que le tocaba y quieres corregir manualmente en qué día del ciclo está, sin marcar una asistencia.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                dias.forEachIndexed { indice, nombreDia ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { seleccionado = indice }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(selected = seleccionado == indice, onClick = { seleccionado = indice })
                        Text(nombreDia + if (indice == diaActual) " (actual)" else "")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(seleccionado) }) { Text("Confirmar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
