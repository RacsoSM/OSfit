package com.osfit.app.ui.clientes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.osfit.app.ui.common.AccionCard

/**
 * Agrupa todo lo que el entrenador administra de la página web de una clienta.
 *
 * La ficha de la clienta ya tiene una rejilla larga de acciones, así que lo de la web entra
 * por aquí y no por ahí. Cuando haya que administrar algo más de la web, se agrega un elemento
 * a [seccionesWeb] y la ficha no se toca — que es exactamente como entró la paleta.
 */
@Composable
fun WebClienteScreen(
    clienteId: String,
    onVerVideosWeb: (String) -> Unit,
    onVerPaletaWeb: (String) -> Unit,
    onVerRutinaWeb: (String) -> Unit
) {
    val secciones = seccionesWeb(
        onVerVideosWeb = onVerVideosWeb,
        onVerPaletaWeb = onVerPaletaWeb,
        onVerRutinaWeb = onVerRutinaWeb
    )
    Scaffold { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { Text("Web", style = MaterialTheme.typography.headlineSmall) }
            // De dos en dos para que la rejilla se vea igual que la de la ficha; el hueco
            // final mantiene el ancho de la tarjeta cuando el total es impar.
            items(secciones.chunked(2)) { fila ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    fila.forEach { seccion ->
                        AccionCard(
                            icono = seccion.icono,
                            texto = seccion.texto,
                            modifier = Modifier.weight(1f),
                            onClick = { seccion.alAbrir(clienteId) }
                        )
                    }
                    if (fila.size == 1) Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

private class SeccionWeb(
    val icono: ImageVector,
    val texto: String,
    val alAbrir: (String) -> Unit
)

private fun seccionesWeb(
    onVerVideosWeb: (String) -> Unit,
    onVerPaletaWeb: (String) -> Unit,
    onVerRutinaWeb: (String) -> Unit
) = listOf(
    // Primera de la lista: es lo que la clienta abre a diario, a diferencia de los videos
    // (quincenales) y de la paleta (se elige una vez).
    SeccionWeb(
        icono = Icons.Filled.FitnessCenter,
        texto = "Rutina y variaciones",
        alAbrir = onVerRutinaWeb
    ),
    SeccionWeb(
        icono = Icons.Filled.VideoLibrary,
        texto = "Videos en la web",
        alAbrir = onVerVideosWeb
    ),
    SeccionWeb(
        icono = Icons.Filled.Palette,
        texto = "Paleta de colores",
        alAbrir = onVerPaletaWeb
    )
)
