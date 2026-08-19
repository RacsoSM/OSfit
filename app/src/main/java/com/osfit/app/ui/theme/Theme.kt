package com.osfit.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val AzulOscuro = Color(0xFF1B5E20)
private val AzulClaro = Color(0xFF4CAF50)

private val EsquemaOscuro = darkColorScheme(primary = AzulClaro)
private val EsquemaClaro = lightColorScheme(primary = AzulOscuro)

@Composable
fun OSfitTheme(content: @Composable () -> Unit) {
    val colorScheme = if (isSystemInDarkTheme()) EsquemaOscuro else EsquemaClaro
    MaterialTheme(colorScheme = colorScheme, content = content)
}
