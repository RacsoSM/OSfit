package com.osfit.app.ui.common

import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.keyframes
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.sin

/**
 * El azul de la racha de quien alguna vez llegó a 30 (entrenador, 2026-10-17). GEMELO del
 * `hue-rotate(190deg)` de `.llama-azul` en la web: aquí el número también va azul, porque el
 * rojo de `colorScheme.error` junto a una llama azul se leía como dos cosas distintas.
 */
private val AZUL_RACHA = Color(0xFF3FA3FF)

/** Rotación de tono, la misma matriz que el `hue-rotate()` de CSS (Filter Effects, W3C). */
private fun rotacionDeTono(grados: Float): ColorMatrix {
    val r = Math.toRadians(grados.toDouble())
    val c = cos(r).toFloat()
    val s = sin(r).toFloat()
    return ColorMatrix(
        floatArrayOf(
            0.213f + c * 0.787f - s * 0.213f, 0.715f - c * 0.715f - s * 0.715f, 0.072f - c * 0.072f + s * 0.928f, 0f, 0f,
            0.213f - c * 0.213f + s * 0.143f, 0.715f + c * 0.285f + s * 0.140f, 0.072f - c * 0.072f - s * 0.283f, 0f, 0f,
            0.213f - c * 0.213f - s * 0.787f, 0.715f - c * 0.715f + s * 0.715f, 0.072f + c * 0.928f + s * 0.072f, 0f, 0f,
            0f, 0f, 0f, 1f, 0f
        )
    )
}

/** El 🔥 pasado a azul: no hay emoji de llama azul, se rota el tono del de siempre. */
private val PINTURA_LLAMA_AZUL = Paint().apply { colorFilter = ColorFilter.colorMatrix(rotacionDeTono(190f)) }

@Composable
fun RachaBadge(
    racha: Int,
    modifier: Modifier = Modifier,
    empezar: Boolean = true,
    iconSize: TextUnit = 20.sp,
    textStyle: TextStyle = MaterialTheme.typography.titleSmall,
    /** Llama y número azules: alguna vez llegó a una racha de 30 (ver `AZUL_RACHA`). */
    azul: Boolean = false
) {
    var escalaObjetivo by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(empezar) { if (empezar) escalaObjetivo = 1f }
    val escala by animateFloatAsState(
        targetValue = escalaObjetivo,
        animationSpec = keyframes {
            durationMillis = 1500
            0f at 0 using LinearOutSlowInEasing
            1.3f at 750 using LinearOutSlowInEasing
            0.9f at 1100
            1.08f at 1300
            1f at 1500
        },
        label = "rachaBounce"
    )
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .padding(start = 6.dp)
            .graphicsLayer { scaleX = escala; scaleY = escala }
    ) {
        val llama = Modifier.padding(end = 2.dp)
        Text(
            "🔥",
            fontSize = iconSize,
            modifier = if (!azul) llama else llama.drawWithContent {
                drawIntoCanvas { canvas ->
                    canvas.saveLayer(Rect(0f, 0f, size.width, size.height), PINTURA_LLAMA_AZUL)
                    drawContent()
                    canvas.restore()
                }
            }
        )
        Text("$racha", style = textStyle, color = if (azul) AZUL_RACHA else MaterialTheme.colorScheme.error)
    }
}
