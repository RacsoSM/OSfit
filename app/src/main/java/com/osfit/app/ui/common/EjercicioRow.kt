package com.osfit.app.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.osfit.app.data.model.Ejercicio

/**
 * El editor de un ejercicio. Vivía privado dentro de `RutinaEditorScreen`; se extrajo acá el
 * 2026-09-15 porque la rutina propia por cliente necesita exactamente el mismo editor, y dos
 * copias se habrían separado con el tiempo.
 *
 * Los dos añadidos son opcionales y apagados por defecto para que la pestaña Rutinas siga
 * viéndose igual que antes de la extracción:
 *
 * - `mostrarPesoONota`: ese campo dejó de ser privado el 2026-09-15 (la clienta lo ve en su
 *   página), así que donde se edita la rutina de una persona concreta conviene poder escribirlo.
 * - `onSubir`/`onBajar`: nulos esconden los botones. Reordenar hace falta en la rutina propia
 *   —el orden es el orden en que la clienta hace los ejercicios— y no en la plantilla.
 */
@Composable
fun EjercicioRow(
    ejercicio: Ejercicio,
    onChange: (Ejercicio) -> Unit,
    onEliminar: () -> Unit,
    mostrarPesoONota: Boolean = false,
    onSubir: (() -> Unit)? = null,
    onBajar: (() -> Unit)? = null
) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            OutlinedTextField(
                value = ejercicio.nombre,
                onValueChange = { onChange(ejercicio.copy(nombre = it)) },
                label = { Text("Ejercicio") },
                modifier = Modifier.weight(2f)
            )
            OutlinedTextField(
                value = if (ejercicio.series == 0) "" else ejercicio.series.toString(),
                onValueChange = { onChange(ejercicio.copy(series = it.toIntOrNull() ?: 0)) },
                label = { Text("Series") },
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = ejercicio.repeticiones,
                onValueChange = { onChange(ejercicio.copy(repeticiones = it)) },
                label = { Text("Reps") },
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onEliminar) {
                Icon(Icons.Filled.Delete, contentDescription = "Eliminar ejercicio")
            }
        }
        if (mostrarPesoONota || onSubir != null || onBajar != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (mostrarPesoONota) {
                    OutlinedTextField(
                        value = ejercicio.pesoONota,
                        onValueChange = { onChange(ejercicio.copy(pesoONota = it)) },
                        label = { Text("Peso o nota (la clienta lo ve)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                } else {
                    Spacer(modifier = Modifier.weight(1f))
                }
                if (onSubir != null) {
                    IconButton(onClick = onSubir) {
                        Icon(Icons.Filled.ArrowUpward, contentDescription = "Subir ejercicio")
                    }
                }
                if (onBajar != null) {
                    IconButton(onClick = onBajar) {
                        Icon(Icons.Filled.ArrowDownward, contentDescription = "Bajar ejercicio")
                    }
                }
            }
        }
    }
}
