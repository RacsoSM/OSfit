package com.osfit.app.ui.common

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import kotlinx.coroutines.delay

@Composable
fun TextoMaquinaEscribir(
    texto: String,
    style: TextStyle,
    empezar: Boolean,
    modifier: Modifier = Modifier,
    onTerminar: () -> Unit = {}
) {
    var visible by remember(texto) { mutableStateOf("") }
    LaunchedEffect(texto, empezar) {
        if (empezar) {
            visible = ""
            for (i in 1..texto.length) {
                visible = texto.substring(0, i)
                delay(73)
            }
            onTerminar()
        }
    }
    Text(visible, style = style, modifier = modifier)
}
