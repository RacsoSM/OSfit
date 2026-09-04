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
import com.osfit.app.data.model.MedallaCatalogo

/**
 * "Sin medalla" se modela como `null` en la selección (no hay fila de catálogo para eso).
 * Preselecciona [sugerencia] si la hay, si no queda en "Sin medalla".
 */
@Composable
fun ConfirmarMedallaDialog(
    sugerencia: MedallaCatalogo?,
    catalogo: List<MedallaCatalogo>,
    onConfirmar: (MedallaCatalogo?) -> Unit,
    onCancelar: () -> Unit
) {
    var seleccionada by remember { mutableStateOf(sugerencia) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Medalla de la quincena") },
        text = {
            Column {
                Text(
                    if (sugerencia != null) "Sugerencia: ${sugerencia.nombre}" else "No hay una sugerencia automática esta quincena.",
                    modifier = Modifier.padding(bottom = 12.dp)
                )
                LazyColumn(modifier = Modifier.height(320.dp)) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { seleccionada = null }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(selected = seleccionada == null, onClick = { seleccionada = null })
                            Text("Sin medalla")
                        }
                    }
                    items(catalogo, key = { it.id }) { medalla ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { seleccionada = medalla }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(selected = seleccionada?.id == medalla.id, onClick = { seleccionada = medalla })
                            Text(medalla.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(seleccionada) }) { Text("Generar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
