package com.osfit.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.osfit.app.paletas.Paleta

/**
 * Las muestras de una paleta, para poder compararlas de un vistazo.
 *
 * Hay dos variantes porque cada pantalla enseña los colores que esa pantalla realmente cambia:
 * enseñar blobs en la pantalla de la web haría elegir a ciegas, ya que ninguno de esos tres
 * colores llega a la página. Vive en `common` para que una paleta nueva aparezca en ambas sin
 * editar ninguna de las dos.
 */
@Composable
fun MuestrasPaletaVideo(paleta: Paleta, modifier: Modifier = Modifier) {
    Muestras(listOf(paleta.blobA, paleta.blobB, paleta.blobC, paleta.destacado), modifier)
}

/** El primario y sus dos extremos. `webSobrePrimario` no se muestra: es color de texto, y como
 *  punto suelto no dice nada. */
@Composable
fun MuestrasPaletaWeb(paleta: Paleta, modifier: Modifier = Modifier) {
    Muestras(listOf(paleta.webPrimarioOscuro, paleta.webPrimario, paleta.webPrimarioClaro), modifier)
}

@Composable
private fun Muestras(colores: List<Int>, modifier: Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        colores.forEach { color ->
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(Color(color))
            )
        }
    }
}
