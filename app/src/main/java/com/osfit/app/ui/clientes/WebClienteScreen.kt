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
 * Hoy contiene una sola tarjeta, y ésa es la intención: la ficha de la clienta ya tiene una
 * rejilla larga de acciones, así que lo de la web entra por aquí y no por ahí. Cuando haya
 * que administrar algo más de la web, se agrega un elemento a [seccionesWeb] y la ficha no
 * se toca. Por eso este nivel intermedio no sobra aunque ahora parezca un paso de más.
 */
@Composable
fun WebClienteScreen(
    clienteId: String,
    onVerVideosWeb: (String) -> Unit
) {
    val secciones = seccionesWeb(onVerVideosWeb = onVerVideosWeb)
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

private fun seccionesWeb(onVerVideosWeb: (String) -> Unit) = listOf(
    SeccionWeb(
        icono = Icons.Filled.VideoLibrary,
        texto = "Videos en la web",
        alAbrir = onVerVideosWeb
    )
)
