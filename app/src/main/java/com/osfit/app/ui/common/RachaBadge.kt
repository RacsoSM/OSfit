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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun RachaBadge(
    racha: Int,
    modifier: Modifier = Modifier,
    empezar: Boolean = true,
    iconSize: TextUnit = 20.sp,
    textStyle: TextStyle = MaterialTheme.typography.titleSmall
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
        Text("🔥", fontSize = iconSize, modifier = Modifier.padding(end = 2.dp))
        Text("$racha", style = textStyle, color = MaterialTheme.colorScheme.error)
    }
}
