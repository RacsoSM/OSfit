package com.osfit.app.ui.top

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.ui.common.MonthCalendarHeader
import kotlin.math.sin
import kotlin.random.Random
import kotlinx.coroutines.delay

private val ColorOro = Color(0xFFFFD54F)
private val ColorPlata = Color(0xFFB0BEC5)
private val ColorBronce = Color(0xFFD7935B)
private val Medallas = mapOf(1 to "🥇", 2 to "🥈", 3 to "🥉")
private const val SUSPENSO_MS = 1000L
private const val SUSPENSO_ORO_MS = 4000L
private const val EXHIBICION_MS = 2000L
private val ColoresConfeti = listOf(
    Color(0xFFFF5252), Color(0xFFFFD740), Color(0xFF69F0AE),
    Color(0xFF40C4FF), Color(0xFFE040FB), Color(0xFFFFFFFF)
)

private enum class CategoriaTop { RACHA, ASISTENCIA }

@Composable
fun TopScreen(viewModel: TopViewModel = viewModel()) {
    val mesVisible by viewModel.mesVisible.collectAsState()
    val topRacha by viewModel.topRacha.collectAsState()
    val topAsistencia by viewModel.topAsistencia.collectAsState()
    var categoria by remember { mutableStateOf<CategoriaTop?>(null) }

    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            if (categoria == null) {
                MonthCalendarHeader(
                    mesVisible = mesVisible,
                    onMesAnterior = { viewModel.cambiarMes(mesVisible.minusMonths(1)) },
                    onMesSiguiente = { viewModel.cambiarMes(mesVisible.plusMonths(1)) }
                )
                Spacer(modifier = Modifier.height(16.dp))
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    CardGigante(
                        texto = "Ver top de racha",
                        onClick = { categoria = CategoriaTop.RACHA },
                        modifier = Modifier.fillMaxWidth().fillMaxHeight(0.85f)
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    CardGigante(
                        texto = "Ver top de asistencia",
                        onClick = { categoria = CategoriaTop.ASISTENCIA },
                        modifier = Modifier.fillMaxWidth().fillMaxHeight(0.85f)
                    )
                }
            } else {
                val top = if (categoria == CategoriaTop.RACHA) topRacha else topAsistencia
                val titulo = if (categoria == CategoriaTop.RACHA) "Racha del mes" else "Asistencia del mes"
                val sufijo = if (categoria == CategoriaTop.RACHA) "días" else "asistencias"
                PodioReveal(
                    top = top,
                    titulo = titulo,
                    sufijo = sufijo,
                    onCerrar = { categoria = null }
                )
            }
        }
    }
}

@Composable
private fun CardGigante(texto: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(onClick = onClick, modifier = modifier) {
        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                Icons.Filled.EmojiEvents,
                contentDescription = null,
                modifier = Modifier.size(72.dp)
            )
            Text(
                texto,
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(top = 12.dp)
            )
        }
    }
}

@Composable
private fun PodioReveal(top: List<PuestoPodio>, titulo: String, sufijo: String, onCerrar: () -> Unit) {
    var revelado by remember(top, titulo) { mutableStateOf(setOf<Int>()) }
    var mostrarReflector by remember(top, titulo) { mutableStateOf(false) }
    var mostrarConfeti by remember(top, titulo) { mutableStateOf(false) }

    LaunchedEffect(top, titulo) {
        revelado = emptySet()
        mostrarReflector = false
        mostrarConfeti = false
        for (posicion in listOf(3, 2, 1)) {
            if (top.none { it.posicion == posicion }) continue
            if (posicion == 1) {
                mostrarReflector = true
                delay(SUSPENSO_ORO_MS)
                mostrarReflector = false
                revelado = revelado + posicion
                mostrarConfeti = true
                delay(EXHIBICION_MS)
            } else {
                delay(SUSPENSO_MS)
                revelado = revelado + posicion
                delay(EXHIBICION_MS)
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onCerrar) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = "Volver")
                }
                Text(titulo, style = MaterialTheme.typography.headlineSmall)
            }
            Spacer(modifier = Modifier.height(8.dp))
            if (top.isEmpty()) {
                Text("Sin datos este mes.", style = MaterialTheme.typography.bodyMedium)
            } else {
                val porPosicion = top.associateBy { it.posicion }
                Row(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    ColumnaPodio(
                        puesto = porPosicion[3],
                        posicion = 3,
                        color = ColorBronce,
                        fraccionAltura = 0.32f,
                        revelado = 3 in revelado,
                        sufijo = sufijo,
                        modifier = Modifier.weight(1f).fillMaxHeight()
                    )
                    ColumnaPodio(
                        puesto = porPosicion[1],
                        posicion = 1,
                        color = ColorOro,
                        fraccionAltura = 0.68f,
                        revelado = 1 in revelado,
                        sufijo = sufijo,
                        modifier = Modifier.weight(1f).fillMaxHeight()
                    )
                    ColumnaPodio(
                        puesto = porPosicion[2],
                        posicion = 2,
                        color = ColorPlata,
                        fraccionAltura = 0.48f,
                        revelado = 2 in revelado,
                        sufijo = sufijo,
                        modifier = Modifier.weight(1f).fillMaxHeight()
                    )
                }
            }
        }

        AnimatedVisibility(
            visible = mostrarReflector,
            enter = fadeIn(tween(400)),
            exit = fadeOut(tween(400)),
            modifier = Modifier.fillMaxSize()
        ) {
            Reflector()
        }

        if (mostrarConfeti) {
            ConfettiOverlay(modifier = Modifier.fillMaxSize())
        }
    }
}

@Composable
private fun ColumnaPodio(
    puesto: PuestoPodio?,
    posicion: Int,
    color: Color,
    fraccionAltura: Float,
    revelado: Boolean,
    sufijo: String,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
        Box(contentAlignment = Alignment.BottomCenter, modifier = Modifier.padding(bottom = 8.dp)) {
            if (puesto != null && revelado) {
                BrilloPuesto(color = color, tamaño = if (posicion == 1) 220.dp else 140.dp)
            }
            AnimatedContent(
                targetState = revelado && puesto != null,
                transitionSpec = {
                    (fadeIn(tween(450)) + scaleIn(
                        initialScale = 0.4f,
                        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)
                    )) togetherWith (fadeOut(tween(200)) + scaleOut(targetScale = 0.9f))
                },
                label = "podioNombre"
            ) { yaRevelado ->
                if (yaRevelado && puesto != null) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        puesto.clientes.forEach { cliente ->
                            Text(
                                cliente.nombre,
                                style = if (posicion == 1) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleLarge,
                                textAlign = TextAlign.Center
                            )
                        }
                        Text(
                            "${puesto.valor} $sufijo",
                            style = MaterialTheme.typography.titleMedium,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                } else if (puesto != null) {
                    Text("❓", fontSize = 48.sp)
                }
            }
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(fraccionAltura)
                .background(
                    if (puesto != null) color else color.copy(alpha = 0.15f),
                    RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            if (puesto != null) {
                Text(Medallas[posicion] ?: "", fontSize = if (posicion == 1) 56.sp else 44.sp)
            }
        }
    }
}

@Composable
private fun BrilloPuesto(color: Color, tamaño: Dp) {
    val transicion = rememberInfiniteTransition(label = "brillo")
    val alpha by transicion.animateFloat(
        initialValue = 0.25f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(tween(900), repeatMode = RepeatMode.Reverse),
        label = "brilloAlpha"
    )
    Box(
        modifier = Modifier.size(tamaño).background(
            Brush.radialGradient(colors = listOf(color.copy(alpha = alpha), Color.Transparent))
        )
    )
}

@Composable
private fun Reflector() {
    // Oscurece toda la pantalla salvo un círculo central, como un reflector de teatro
    // enfocado justo donde va a aparecer el nombre del primer lugar.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .drawWithCache {
                val centro = Offset(size.width * 0.5f, size.height * 0.32f)
                val radio = size.minDimension * 0.55f
                onDrawBehind {
                    drawRect(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                Color.Transparent,
                                Color.Black.copy(alpha = 0.55f),
                                Color.Black.copy(alpha = 0.93f)
                            ),
                            center = centro,
                            radius = radio
                        )
                    )
                }
            }
    )
}

private data class Confeti(
    val x: Float,
    val retraso: Float,
    val velocidad: Float,
    val color: Color,
    val ancho: Float,
    val alto: Float,
    val amplitudDrift: Float,
    val velocidadGiro: Float
)

@Composable
private fun ConfettiOverlay(modifier: Modifier = Modifier) {
    val particulas = remember {
        List(70) {
            Confeti(
                x = Random.nextFloat(),
                retraso = Random.nextFloat() * 1.2f,
                velocidad = 0.35f + Random.nextFloat() * 0.35f,
                color = ColoresConfeti.random(),
                ancho = 6f + Random.nextFloat() * 6f,
                alto = 10f + Random.nextFloat() * 8f,
                amplitudDrift = 20f + Random.nextFloat() * 40f,
                velocidadGiro = (Random.nextFloat() - 0.5f) * 8f
            )
        }
    }
    var tiempo by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(Unit) {
        val inicio = withFrameNanos { it }
        while (true) {
            val ahora = withFrameNanos { it }
            tiempo = (ahora - inicio) / 1_000_000_000f
        }
    }
    Canvas(modifier = modifier) {
        val alto = size.height
        val ancho = size.width
        particulas.forEach { p ->
            val t = tiempo - p.retraso
            if (t <= 0f) return@forEach
            val ciclo = (t * p.velocidad) % 1.3f
            val y = ciclo * (alto + 120f) - 60f
            val x = (p.x * ancho + p.amplitudDrift * sin(tiempo * 2f + p.x * 10f)).coerceIn(0f, ancho)
            rotate(degrees = tiempo * p.velocidadGiro * 60f, pivot = Offset(x, y)) {
                drawRect(
                    color = p.color,
                    topLeft = Offset(x - p.ancho / 2f, y - p.alto / 2f),
                    size = Size(p.ancho, p.alto)
                )
            }
        }
    }
}
