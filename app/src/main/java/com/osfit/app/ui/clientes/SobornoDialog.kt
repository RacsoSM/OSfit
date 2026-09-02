package com.osfit.app.ui.clientes

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.osfit.app.data.model.Asistencia
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

/** Azul de falta justificada, compartido con el calendario personal del cliente. */
internal val AzulJustificado = Color(0xFF1565C0)

private val FORMATO_FECHA_FALTA = DateTimeFormatter.ofPattern("EEEE d 'de' MMMM", Locale("es"))

/**
 * Soborno: lista las faltas del cliente para justificarlas (o quitarles la
 * justificación). Una falta justificada se pinta de azul en el calendario y cuenta
 * como asistencia para la racha.
 */
@Composable
fun SobornoDialog(
    faltas: List<Asistencia>,
    onAlternar: (Asistencia) -> Unit,
    onCerrar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCerrar,
        confirmButton = { TextButton(onClick = onCerrar) { Text("Cerrar") } },
        title = { Text("Soborno") },
        text = {
            if (faltas.isEmpty()) {
                Text("Este cliente no tiene faltas registradas.")
            } else {
                Column {
                    Text(
                        "Toca una falta para justificarla: no le romperá la racha.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    LazyColumn(modifier = Modifier.heightIn(max = 320.dp).padding(top = 8.dp)) {
                        items(faltas, key = { it.fecha }) { falta ->
                            FaltaRow(falta = falta, onClick = { onAlternar(falta) })
                        }
                    }
                }
            }
        }
    )
}

@Composable
private fun FaltaRow(falta: Asistencia, onClick: () -> Unit) {
    val fecha = try {
        LocalDate.parse(falta.fecha).format(FORMATO_FECHA_FALTA)
    } catch (e: DateTimeParseException) {
        falta.fecha
    }
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(14.dp)
                .clip(CircleShape)
                .background(if (falta.justificada) AzulJustificado else MaterialTheme.colorScheme.error)
        )
        Column {
            Text(fecha, style = MaterialTheme.typography.bodyMedium)
            Text(
                if (falta.justificada) "Falta justificada" else "Faltó",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
