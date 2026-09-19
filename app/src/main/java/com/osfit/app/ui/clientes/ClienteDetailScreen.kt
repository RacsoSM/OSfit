package com.osfit.app.ui.clientes

import android.content.ActivityNotFoundException
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.EditCalendar
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Handshake
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.QueryStats
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.model.Rutina
import com.osfit.app.domain.RangoResumen
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.domain.RutinaProgressCalculator
import com.osfit.app.domain.conPesosPropios
import com.osfit.app.domain.ejerciciosDe
import com.osfit.app.domain.TipoResumen
import com.osfit.app.ui.common.AccionCard
import com.osfit.app.ui.common.AsignarDiaDialog
import com.osfit.app.ui.common.RachaBadge
import com.osfit.app.ui.common.TextoMaquinaEscribir
import com.osfit.app.ui.common.rememberFechaActual
import com.osfit.app.util.WhatsAppUtil
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.launch

@Composable
fun ClienteDetailScreen(
    clienteId: String,
    onVerAsistencias: (String) -> Unit,
    onVerPagos: (String) -> Unit,
    onVerEstadisticas: (String) -> Unit,
    onVerMedallas: (String) -> Unit,
    onVerWeb: (String) -> Unit,
    onVerLogrosPersonales: (String) -> Unit,
    onEditarCliente: (String) -> Unit,
    onEliminado: () -> Unit
) {
    val viewModel: ClienteDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val plantillas by viewModel.plantillasDisponibles.collectAsState()
    val eliminado by viewModel.eliminado.collectAsState()
    val rachaActual by viewModel.rachaActual.collectAsState()
    val diaQueToca by viewModel.diaQueToca.collectAsState()
    val faltas by viewModel.faltas.collectAsState()
    val resumenViewModel: ResumenClienteViewModel = viewModel(
        factory = viewModelFactory { initializer { ResumenClienteViewModel(clienteId) } }
    )
    // El estado de generación vive en el ViewModel (viewModelScope): sobrevive a la rotación,
    // así el botón sigue mostrando "Generando..." y no se puede disparar una segunda corrida.
    val generandoResumen by resumenViewModel.generando.collectAsState()
    val progresoResumen by resumenViewModel.progreso.collectAsState()
    val mensajeResumen by resumenViewModel.mensaje.collectAsState()
    // Sólo hay algo que publicar después de generar un resumen quincenal: publicar reusa ese
    // mp4 y no vuelve a codificarlo.
    val videoListo by resumenViewModel.videoListo.collectAsState()
    val publicandoVideo by resumenViewModel.publicando.collectAsState()
    val hoy by rememberFechaActual()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var mostrarDialogoRutina by remember { mutableStateOf(false) }

    // La plantilla que el entrenador eligió y todavía no confirmó, cuando el cliente
    // tiene rutina propia y asignarla le borraría lo suyo.
    var plantillaPorConfirmar by remember { mutableStateOf<Rutina?>(null) }
    var mostrarDialogoAsignarDia by remember { mutableStateOf(false) }
    var mostrarDialogoSoborno by remember { mutableStateOf(false) }
    var mostrarConfirmacionActivo by remember { mutableStateOf(false) }
    var mostrarConfirmacionEliminar by remember { mutableStateOf(false) }
    // Qué tipo de resumen se está por generar, mientras el trainer elige la fecha del rango
    // en SeleccionarRangoResumenDialog; null = el diálogo está cerrado.
    var tipoResumenParaFecha by remember { mutableStateOf<TipoResumen?>(null) }
    var cargandoMedalla by remember { mutableStateOf(false) }
    var preparacionQuincenal by remember {
        mutableStateOf<ResumenClienteViewModel.PreparacionResumenQuincenal?>(null)
    }
    // Elección del primer diálogo, retenida mientras se muestra el segundo.
    var medallaConfirmada by remember { mutableStateOf<MedallaCatalogo?>(null) }
    var eligiendoLogros by remember { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(eliminado) {
        if (eliminado) onEliminado()
    }

    // El mensaje se emite desde el ViewModel (que sobrevive a la rotación) y la pantalla
    // lo consume: si la Activity se recreó a media generación, el aviso igual se muestra.
    androidx.compose.runtime.LaunchedEffect(mensajeResumen) {
        val mensaje = mensajeResumen ?: return@LaunchedEffect
        Toast.makeText(context, mensaje, Toast.LENGTH_LONG).show()
        resumenViewModel.limpiarMensaje()
    }

    if (eliminado) return

    val clienteActual = cliente ?: return

    Scaffold { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                var nombreListo by remember(clienteId) { mutableStateOf(false) }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextoMaquinaEscribir(
                            texto = clienteActual.nombre,
                            style = MaterialTheme.typography.headlineSmall,
                            empezar = true,
                            onTerminar = { nombreListo = true }
                        )
                        if (nombreListo && rachaActual > 0) {
                            RachaBadge(
                                racha = rachaActual,
                                iconSize = 28.sp,
                                textStyle = MaterialTheme.typography.headlineSmall
                            )
                        }
                    }
                    IconButton(onClick = { onEditarCliente(clienteId) }) {
                        Icon(Icons.Filled.Settings, contentDescription = "Editar cliente")
                    }
                }
                if (clienteActual.telefono.isNotBlank()) {
                    Text(clienteActual.telefono, style = MaterialTheme.typography.bodyMedium)
                }
                if (!clienteActual.activo) {
                    Text("Inactivo", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelLarge)
                }
            }
            item {
                var expandidaRutina by remember { mutableStateOf(false) }
                val diaActualEfectivo = diaQueToca
                // La plantilla puede haber cambiado (ej. se le agregaron ejercicios) después de
                // asignarla: se usa la versión viva de la plantilla si todavía existe, en vez de
                // la copia congelada que quedó guardada en el cliente al momento de asignarla.
                val rutinaViva = plantillas.firstOrNull { it.id == clienteActual.plantillaOrigenId }
                val diaRutinaActual = (rutinaViva?.dias ?: clienteActual.rutinaAsignada?.dias)?.getOrNull(diaActualEfectivo)
                val nombreDiaActual = diaRutinaActual?.nombreDia
                // Lo que se manda por WhatsApp tiene que ser lo mismo que ella ve en su página:
                // la variación que le toca hoy, con sus pesos propios si sigue una plantilla.
                val variacionPorDia by viewModel.variacionQueTocaPorDia.collectAsState()
                val ejerciciosDeHoy = diaRutinaActual?.let { dia ->
                    conPesosPropios(
                        ejerciciosDe(dia, variacionPorDia[diaActualEfectivo] ?: 0),
                        if (clienteActual.plantillaOrigenId.isBlank()) {
                            emptyMap()
                        } else {
                            clienteActual.pesoPorEjercicio
                        }
                    )
                }.orEmpty()
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { expandidaRutina = !expandidaRutina },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Rutina asignada", style = MaterialTheme.typography.titleSmall)
                            Icon(
                                if (expandidaRutina) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                                contentDescription = if (expandidaRutina) "Ocultar" else "Mostrar"
                            )
                        }
                        if (expandidaRutina) {
                            Text(
                                clienteActual.rutinaAsignada?.nombre ?: "Sin rutina asignada",
                                modifier = Modifier.padding(top = 8.dp)
                            )
                            clienteActual.rutinaAsignada?.dias?.forEachIndexed { indice, dia ->
                                Text(
                                    "Día ${indice + 1}: ${dia.nombreDia}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                            if (nombreDiaActual != null) {
                                Text(
                                    "Día Actual",
                                    style = MaterialTheme.typography.titleSmall,
                                    modifier = Modifier.padding(top = 12.dp)
                                )
                                Text(nombreDiaActual, style = MaterialTheme.typography.bodyMedium)
                            }
                            if (diaRutinaActual != null && clienteActual.telefono.isNotBlank()) {
                                Button(
                                    onClick = {
                                        val uri = WhatsAppUtil.crearUriEnviarRutinaDelDia(
                                            telefono = clienteActual.telefono,
                                            nombreCliente = clienteActual.nombre,
                                            dia = diaRutinaActual,
                                            ejercicios = ejerciciosDeHoy
                                        )
                                        try {
                                            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                        } catch (e: ActivityNotFoundException) {
                                            Toast.makeText(context, "No se encontró una app para abrir WhatsApp", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
                                ) {
                                    Icon(Icons.Filled.Chat, contentDescription = null)
                                    Text("Enviar rutina de hoy por WhatsApp", modifier = Modifier.padding(start = 8.dp))
                                }
                            }
                        }
                    }
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.FitnessCenter,
                        texto = if (clienteActual.rutinaAsignada == null) "Asignar rutina" else "Cambiar rutina",
                        modifier = Modifier.weight(1f),
                        onClick = { mostrarDialogoRutina = true }
                    )
                    if (clienteActual.rutinaAsignada != null) {
                        AccionCard(
                            icono = Icons.Filled.EditCalendar,
                            texto = "Asignar día",
                            modifier = Modifier.weight(1f),
                            onClick = { mostrarDialogoAsignarDia = true }
                        )
                    }
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.Payments,
                        texto = "Pagos",
                        modifier = Modifier.weight(1f),
                        onClick = { onVerPagos(clienteId) }
                    )
                    AccionCard(
                        icono = Icons.Filled.CalendarMonth,
                        texto = "Asistencia",
                        modifier = Modifier.weight(1f),
                        onClick = { onVerAsistencias(clienteId) }
                    )
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.QueryStats,
                        texto = "Estadísticas",
                        modifier = Modifier.weight(1f),
                        onClick = { onVerEstadisticas(clienteId) }
                    )
                    if (clienteActual.telefono.isNotBlank()) {
                        AccionCard(
                            icono = Icons.Filled.Chat,
                            texto = "Confirmar Asistencia",
                            modifier = Modifier.weight(1f),
                            onClick = {
                                val uri = WhatsAppUtil.crearUriConfirmarAsistencia(
                                    telefono = clienteActual.telefono,
                                    nombreCliente = clienteActual.nombre
                                )
                                try {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                } catch (e: ActivityNotFoundException) {
                                    Toast.makeText(context, "No se encontró una app para abrir WhatsApp", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    }
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.Handshake,
                        texto = "Soborno",
                        modifier = Modifier.weight(1f),
                        onClick = { mostrarDialogoSoborno = true }
                    )
                    AccionCard(
                        icono = Icons.Filled.EmojiEvents,
                        texto = "Logros personales",
                        modifier = Modifier.weight(1f),
                        onClick = { onVerLogrosPersonales(clienteId) }
                    )
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.EmojiEvents,
                        texto = "Medallas",
                        modifier = Modifier.weight(1f),
                        onClick = { onVerMedallas(clienteId) }
                    )
                    AccionCard(
                        icono = Icons.Filled.Language,
                        texto = "Web",
                        modifier = Modifier.weight(1f),
                        onClick = { onVerWeb(clienteId) }
                    )
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccionCard(
                        icono = Icons.Filled.Videocam,
                        texto = when {
                            generandoResumen -> "Generando... ${(progresoResumen * 100).toInt()}%"
                            cargandoMedalla -> "Calculando..."
                            else -> "Resumen quincenal"
                        },
                        modifier = Modifier.weight(1f),
                        onClick = { tipoResumenParaFecha = TipoResumen.QUINCENAL }
                    )
                }
            }
            videoListo?.let { listo ->
                item {
                    // Acción aparte de compartir, no un reemplazo: compartir por WhatsApp sigue
                    // pasando siempre al terminar de generar.
                    AccionCard(
                        icono = Icons.Filled.CloudUpload,
                        texto = if (publicandoVideo) {
                            "Publicando..."
                        } else {
                            "Publicar en la web (${listo.encabezadoRango})"
                        },
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { resumenViewModel.publicarEnLaWeb() }
                    )
                }
            }
            item {
                val acceso by viewModel.accesoWeb.collectAsState()
                val revivesDisponibles by viewModel.revivesDisponibles.collectAsState()
                val revivesMaximo by viewModel.revivesMaximo.collectAsState()
                val mesPerdio by viewModel.mesQuePerdioLaRuleta.collectAsState()
                val alcance = rememberCoroutineScope()
                Spacer(modifier = Modifier.height(12.dp))
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Acceso web", style = MaterialTheme.typography.titleMedium)
                        Text(
                            if (acceso == null) {
                                "Todavía no le compartiste su página personal."
                            } else {
                                WhatsAppUtil.urlAccesoWeb(acceso!!.token)
                            },
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        Text(
                            buildString {
                                append("Revives: $revivesDisponibles de $revivesMaximo disponibles este mes")
                                // Decir POR QUÉ: si la app del entrenador y la del cliente
                                // muestran números distintos sin explicación, el reclamo por
                                // WhatsApp le llega a él.
                                mesPerdio?.let { append(" (perdió la ruleta en $it)") }
                            },
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                        if (clienteActual.telefono.isNotBlank()) {
                            Button(
                                onClick = {
                                    alcance.launch {
                                        val token = viewModel.asegurarAccesoWeb()
                                        val uri = WhatsAppUtil.crearUriAccesoWeb(
                                            telefono = clienteActual.telefono,
                                            nombreCliente = clienteActual.nombre,
                                            token = token
                                        )
                                        try {
                                            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                        } catch (e: ActivityNotFoundException) {
                                            Toast.makeText(context, "No se encontró una app para abrir WhatsApp", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
                            ) {
                                Icon(Icons.Filled.Chat, contentDescription = null)
                                Text(
                                    if (acceso == null) "Compartir acceso web" else "Volver a compartir",
                                    modifier = Modifier.padding(start = 8.dp)
                                )
                            }
                        }
                        if (acceso != null) {
                            TextButton(
                                onClick = { viewModel.revocarAccesoWeb() },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Revocar acceso", color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }
            item {
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = { mostrarConfirmacionActivo = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(if (clienteActual.activo) "Marcar cliente como inactivo" else "Reactivar cliente")
                }
            }
            item {
                TextButton(
                    onClick = { mostrarConfirmacionEliminar = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Eliminar cliente", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }

    if (mostrarDialogoRutina) {
        AsignarRutinaDialog(
            plantillas = plantillas,
            onSeleccionar = { rutina ->
                // Asignar una plantilla sobreescribe `rutinaAsignada` entero: a quien tiene
                // rutina propia le borra sus ejercicios personalizados y sus variaciones, sin
                // vuelta atrás. Se confirma sólo en ese caso; a quien ya sigue una plantilla no
                // hay nada que quitarle y no se le agrega fricción.
                if (clienteActual.plantillaOrigenId.isBlank() &&
                    clienteActual.rutinaAsignada != null
                ) {
                    plantillaPorConfirmar = rutina
                } else {
                    viewModel.asignarRutina(rutina)
                }
                mostrarDialogoRutina = false
            },
            onCancelar = { mostrarDialogoRutina = false }
        )
    }

    val plantillaElegida = plantillaPorConfirmar
    if (plantillaElegida != null) {
        AlertDialog(
            onDismissRequest = { plantillaPorConfirmar = null },
            title = { Text("Reemplazar la rutina propia") },
            text = {
                Text(
                    "${clienteActual.nombre} tiene rutina propia. Asignarle la plantilla " +
                        "«${plantillaElegida.nombre}» borra los ejercicios y las variaciones que " +
                        "le hayas puesto, y no se pueden recuperar."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.asignarRutina(plantillaElegida)
                        plantillaPorConfirmar = null
                    }
                ) {
                    Text("Reemplazar")
                }
            },
            dismissButton = {
                TextButton(onClick = { plantillaPorConfirmar = null }) { Text("Cancelar") }
            }
        )
    }

    if (mostrarDialogoAsignarDia && clienteActual.rutinaAsignada != null) {
        AsignarDiaDialog(
            dias = clienteActual.rutinaAsignada.dias.map { it.nombreDia },
            diaActual = diaQueToca,
            onConfirmar = { diaElegido ->
                viewModel.asignarDiaActual(diaElegido)
                mostrarDialogoAsignarDia = false
            },
            onCancelar = { mostrarDialogoAsignarDia = false }
        )
    }

    if (mostrarDialogoSoborno) {
        SobornoDialog(
            faltas = faltas,
            onAlternar = { viewModel.alternarSoborno(it) },
            onCerrar = { mostrarDialogoSoborno = false }
        )
    }

    if (mostrarConfirmacionActivo) {
        ConfirmarActivoDialog(
            activo = clienteActual.activo,
            nombreCliente = clienteActual.nombre,
            onConfirmar = {
                viewModel.actualizarActivo(!clienteActual.activo)
                mostrarConfirmacionActivo = false
            },
            onCancelar = { mostrarConfirmacionActivo = false }
        )
    }

    if (mostrarConfirmacionEliminar) {
        ConfirmarEliminarDialog(
            nombreCliente = clienteActual.nombre,
            onConfirmar = {
                viewModel.eliminarCliente()
                mostrarConfirmacionEliminar = false
            },
            onCancelar = { mostrarConfirmacionEliminar = false }
        )
    }

    tipoResumenParaFecha?.let { tipo ->
        SeleccionarRangoResumenDialog(
            tipo = tipo,
            onConfirmar = { fecha ->
                tipoResumenParaFecha = null
                when (tipo) {
                    TipoResumen.SEMANAL -> resumenViewModel.generarResumenSemanal(context, fecha)
                    TipoResumen.QUINCENAL -> {
                        cargandoMedalla = true
                        scope.launch {
                            preparacionQuincenal = resumenViewModel.prepararConfirmacionQuincenal(fecha)
                            cargandoMedalla = false
                        }
                    }
                    TipoResumen.MENSUAL -> resumenViewModel.generarResumenMensual(context, YearMonth.from(fecha))
                }
            },
            onCancelar = { tipoResumenParaFecha = null }
        )
    }

    preparacionQuincenal?.let { prep ->
        if (!eligiendoLogros) {
            ConfirmarMedallaDialog(
                sugerencia = prep.sugerencia,
                catalogo = prep.catalogo,
                onConfirmar = { elegida ->
                    medallaConfirmada = elegida
                    if (prep.catalogoLogros.isEmpty()) {
                        // Sin catálogo de logros no tiene sentido un diálogo sin opciones.
                        resumenViewModel.confirmarYGenerarQuincenal(context, prep, elegida, emptyList())
                        preparacionQuincenal = null
                        medallaConfirmada = null
                    } else {
                        eligiendoLogros = true
                    }
                },
                onCancelar = {
                    preparacionQuincenal = null
                    medallaConfirmada = null
                }
            )
        } else {
            ConfirmarLogrosDialog(
                catalogo = prep.catalogoLogros,
                onConfirmar = { logros ->
                    resumenViewModel.confirmarYGenerarQuincenal(context, prep, medallaConfirmada, logros)
                    preparacionQuincenal = null
                    medallaConfirmada = null
                    eligiendoLogros = false
                },
                // Cancelar acá aborta toda la generación: tampoco se otorga la medalla, así
                // que el entrenador vuelve al perfil sin efectos secundarios.
                onCancelar = {
                    preparacionQuincenal = null
                    medallaConfirmada = null
                    eligiendoLogros = false
                }
            )
        }
    }
}


@Composable
private fun AsignarRutinaDialog(
    plantillas: List<Rutina>,
    onSeleccionar: (Rutina) -> Unit,
    onCancelar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Elegir plantilla") },
        text = {
            if (plantillas.isEmpty()) {
                Text("No hay plantillas creadas todavía. Crea una en la pestaña Rutinas.")
            } else {
                Column {
                    plantillas.forEach { rutina ->
                        TextButton(onClick = { onSeleccionar(rutina) }, modifier = Modifier.fillMaxWidth()) {
                            Text(rutina.nombre)
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}

/**
 * Elige cualquier fecha dentro del período que se quiere resumir (no el rango completo:
 * [ResumenClienteCalculator] deriva semana/quincena/mes a partir de una sola fecha de
 * referencia). Se abre siempre en "hoy", así que confirmar sin tocar nada genera el período
 * más reciente — igual que el comportamiento anterior sin selector.
 */
private data class OpcionPeriodoResumen(val etiqueta: String, val fechaReferencia: LocalDate)

/** Cuántos períodos hacia atrás se ofrecen en la lista (12 semanas ~3 meses, 12 quincenas
 *  ~6 meses, 12 meses ~1 año). */
private const val PERIODOS_HACIA_ATRAS = 12

/**
 * En vez de un selector de día suelto (que permitía elegir cualquier fecha, incluso una que
 * cayera a mitad de semana sin que fuera obvio a cuál pertenece), lista los períodos reales
 * -las mismas semanas/quincenas/meses que arma [ResumenClienteCalculator]- para que el
 * trainer elija entre ellos por nombre. La primera opción es siempre el período más reciente,
 * así que confirmar sin cambiar nada reproduce el comportamiento de antes del selector.
 */
@Composable
private fun SeleccionarRangoResumenDialog(
    tipo: TipoResumen,
    onConfirmar: (LocalDate) -> Unit,
    onCancelar: () -> Unit
) {
    val opciones = remember(tipo) { opcionesPeriodo(tipo) }
    var seleccionado by remember(tipo) { mutableStateOf(opciones.first()) }

    val titulo = when (tipo) {
        TipoResumen.SEMANAL -> "Elige la semana"
        TipoResumen.QUINCENAL -> "Elige la quincena"
        TipoResumen.MENSUAL -> "Elige el mes"
    }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text(titulo) },
        text = {
            LazyColumn(modifier = Modifier.height(320.dp)) {
                items(opciones) { opcion ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { seleccionado = opcion }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(selected = opcion == seleccionado, onClick = { seleccionado = opcion })
                        Text(opcion.etiqueta)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(seleccionado.fechaReferencia) }) { Text("Generar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}

private fun opcionesPeriodo(tipo: TipoResumen): List<OpcionPeriodoResumen> {
    val hoy = LocalDate.now()
    return when (tipo) {
        TipoResumen.SEMANAL -> {
            val opciones = mutableListOf<OpcionPeriodoResumen>()
            var fechaReferencia = hoy
            repeat(PERIODOS_HACIA_ATRAS) {
                val rango = ResumenClienteCalculator.rangoSemanal(fechaReferencia)
                opciones += OpcionPeriodoResumen(etiquetaRangoSemanal(rango), fechaReferencia)
                fechaReferencia = rango.inicio.minusDays(1)
            }
            opciones
        }
        TipoResumen.QUINCENAL -> {
            val opciones = mutableListOf<OpcionPeriodoResumen>()
            var fechaReferencia = hoy
            repeat(PERIODOS_HACIA_ATRAS) {
                val rango = ResumenClienteCalculator.rangoQuincenal(fechaReferencia)
                opciones += OpcionPeriodoResumen(capitalizar(rango.encabezado), fechaReferencia)
                fechaReferencia = rango.inicio.minusDays(1)
            }
            opciones
        }
        TipoResumen.MENSUAL -> {
            val opciones = mutableListOf<OpcionPeriodoResumen>()
            var mes = YearMonth.from(hoy)
            repeat(PERIODOS_HACIA_ATRAS) {
                opciones += OpcionPeriodoResumen(etiquetaMes(mes), mes.atDay(1))
                mes = mes.minusMonths(1)
            }
            opciones
        }
    }
}

/** "Semana del 18 al 22 de marzo", o con ambos meses si la semana cruza de uno a otro. */
private fun etiquetaRangoSemanal(rango: RangoResumen): String {
    val formatoDia = DateTimeFormatter.ofPattern("d")
    val formatoDiaYMes = DateTimeFormatter.ofPattern("d 'de' MMMM", Locale("es"))
    val inicio = if (rango.inicio.month == rango.fin.month) {
        rango.inicio.format(formatoDia)
    } else {
        rango.inicio.format(formatoDiaYMes)
    }
    return "Semana del $inicio al ${rango.fin.format(formatoDiaYMes)}"
}

private fun etiquetaMes(mes: YearMonth): String {
    val nombre = mes.month.getDisplayName(java.time.format.TextStyle.FULL, Locale("es"))
    return "${capitalizar(nombre)} ${mes.year}"
}

private fun capitalizar(texto: String): String = texto.replaceFirstChar { it.uppercase() }

@Composable
private fun ConfirmarActivoDialog(
    activo: Boolean,
    nombreCliente: String,
    onConfirmar: () -> Unit,
    onCancelar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text(if (activo) "¿Marcar como inactivo?" else "¿Reactivar cliente?") },
        text = {
            Text(
                if (activo) {
                    "$nombreCliente dejará de aparecer en la lista de clientes activos del Calendario. Podrás reactivarlo cuando quieras."
                } else {
                    "$nombreCliente volverá a aparecer en la lista de clientes activos del Calendario."
                }
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirmar) { Text("Confirmar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}

@Composable
private fun ConfirmarEliminarDialog(
    nombreCliente: String,
    onConfirmar: () -> Unit,
    onCancelar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("¿Eliminar cliente?") },
        text = {
            Text(
                "Se eliminará a $nombreCliente permanentemente. Esta acción no se puede deshacer. " +
                    "Su historial de pagos y asistencias dejará de ser accesible desde la app."
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirmar) {
                Text("Eliminar", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
