package com.osfit.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val EsquemaOscuro = darkColorScheme(
    primary = Color(0xFFB388FF),
    onPrimary = Color(0xFF2A0064),
    primaryContainer = Color(0xFF6A1B9A),
    onPrimaryContainer = Color(0xFFF3E5FF),
    secondary = Color(0xFFCE93D8),
    onSecondary = Color(0xFF3B0053),
    secondaryContainer = Color(0xFF7B1FA2),
    onSecondaryContainer = Color(0xFFF8E1FF),
    tertiary = Color(0xFF4DD0E1),
    background = Color(0xFF121212),
    onBackground = Color(0xFFE6E6E6),
    surface = Color(0xFF121212),
    onSurface = Color(0xFFE6E6E6),
    surfaceVariant = Color(0xFF2C2C2E),
    onSurfaceVariant = Color(0xFFC7C7C7),
    outline = Color(0xFF8A8A8A)
)

private val EsquemaClaro = lightColorScheme(
    primary = Color(0xFF6A1B9A),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE9D6FF),
    onPrimaryContainer = Color(0xFF2A0064),
    secondary = Color(0xFF9C27B0),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFF3E5FF),
    onSecondaryContainer = Color(0xFF3B0053),
    tertiary = Color(0xFF00838F),
    background = Color(0xFFFAFAFA),
    onBackground = Color(0xFF1B1B1B),
    surface = Color(0xFFFAFAFA),
    onSurface = Color(0xFF1B1B1B),
    surfaceVariant = Color(0xFFE0E0E0),
    onSurfaceVariant = Color(0xFF444444),
    outline = Color(0xFF767676)
)

private val FormasOSfit = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(28.dp),
    extraLarge = RoundedCornerShape(32.dp)
)

val ColoresAvatar = listOf(
    Color(0xFFEF5350), Color(0xFFFFB74D), Color(0xFFFFD54F),
    Color(0xFF66BB6A), Color(0xFF4DD0E1), Color(0xFF7986CB),
    Color(0xFFBA68C8), Color(0xFFF06292)
)

@Composable
fun OSfitTheme(content: @Composable () -> Unit) {
    val colorScheme = if (isSystemInDarkTheme()) EsquemaOscuro else EsquemaClaro
    MaterialTheme(colorScheme = colorScheme, shapes = FormasOSfit, content = content)
}
