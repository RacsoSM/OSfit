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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
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
import androidx.compose.material3.HorizontalDivider
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
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.model.Rutina
import com.osfit.app.domain.CupoRevivesCalculator
import com.osfit.app.domain.RangoResumen
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.domain.RutinaProgressCalculator
import com.osfit.app.domain.TipoResumen
import com.osfit.app.ui.common.AccionCard
import com.osfit.app.ui.common.AsignarDiaDialog
import com.osfit.app.ui.common.EjercicioRow
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
                                            dia = diaRutinaActual
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
                            "Revives: $revivesDisponibles de ${CupoRevivesCalculator.MAXIMO_POR_MES} disponibles este mes",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
                        SeccionRutinaWeb(
                            origen = origenRutinaDe(clienteActual, plantillas),
                            dias = diasQueVeLaClienta(clienteActual, plantillas),
                            diaQueToca = diaQueToca,
                            nombreCliente = clienteActual.nombre,
                            onGuardarDia = { indice, diaEditado ->
                                val base = rutinaQueVeLaClienta(clienteActual, plantillas)
                                if (base != null) {
                                    val diasNuevos = base.dias.toMutableList()
                                    diasNuevos[indice] = diaEditado
                                    viewModel.guardarRutinaPropia(base.copy(dias = diasNuevos))
                                }
                            },
                            onConvertirEnPropia = {
                                rutinaQueVeLaClienta(clienteActual, plantillas)
                                    ?.let { viewModel.guardarRutinaPropia(it) }
                            }
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

/**
 * De dónde sale la rutina que la clienta ve en su página. No hay campo de modo:
 * `plantillaOrigenId` es lo único que lo discrimina, y sus dos casos "sin plantilla viva"
 * hasta ahora se veían iguales —rutina propia y plantilla borrada—. Acá se separan porque uno
 * es normal y el otro es un aviso.
 */
private sealed interface OrigenRutina {
    object Propia : OrigenRutina
    data class SiguePlantilla(val nombre: String) : OrigenRutina
    object PlantillaBorrada : OrigenRutina
}

private fun origenRutinaDe(cliente: Cliente, plantillas: List<Rutina>): OrigenRutina = when {
    cliente.plantillaOrigenId.isBlank() -> OrigenRutina.Propia
    else -> plantillas.firstOrNull { it.id == cliente.plantillaOrigenId }
        ?.let { OrigenRutina.SiguePlantilla(it.nombre) }
        ?: OrigenRutina.PlantillaBorrada
}

/**
 * La rutina que realmente ve la clienta: la plantilla viva si todavía existe, y si no la copia
 * congelada en el cliente. Es el mismo `?:` que usa la tarjeta "Rutina asignada", para que las
 * dos muestren lo mismo.
 *
 * Es también la que hay que congelar al desprenderse: **la viva, no la copia guardada**, que
 * puede tener meses de atraso respecto de la plantilla.
 */
private fun rutinaQueVeLaClienta(cliente: Cliente, plantillas: List<Rutina>): Rutina? =
    plantillas.firstOrNull { it.id == cliente.plantillaOrigenId } ?: cliente.rutinaAsignada

private fun diasQueVeLaClienta(cliente: Cliente, plantillas: List<Rutina>): List<DiaRutina> =
    rutinaQueVeLaClienta(cliente, plantillas)?.dias.orEmpty()

/**
 * La rutina dentro de la tarjeta "Acceso web". Va ahí y no en una tarjeta propia porque el
 * criterio de esa tarjeta es *todo lo que la clienta ve en su página*, y desde el 2026-09-15 la
 * página lista los ejercicios del día (spec `2026-09-15-rutinas-en-la-web-design.md`).
 *
 * No duplica la tarjeta "Rutina asignada": aquélla responde qué rutina tiene y qué día le toca,
 * ésta responde qué ejercicios ve la clienta.
 */
@Composable
private fun SeccionRutinaWeb(
    origen: OrigenRutina,
    dias: List<DiaRutina>,
    diaQueToca: Int,
    nombreCliente: String,
    onGuardarDia: (Int, DiaRutina) -> Unit,
    onConvertirEnPropia: () -> Unit
) {
    var diaEnEdicion by remember { mutableStateOf<Int?>(null) }
    // Qué día quiso editar el entrenador mientras el cliente todavía sigue una plantilla. Se
    // guarda aparte de `diaEnEdicion` para que el editor abra recién después de que acepte
    // desprenderse, y no detrás de un diálogo que todavía puede cancelar.
    var diaQueEsperaSoltar by remember { mutableStateOf<Int?>(null) }

    Text("Rutina", style = MaterialTheme.typography.titleSmall)
    when (origen) {
        OrigenRutina.Propia -> Text(
            "Rutina propia",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(top = 4.dp)
        )
        is OrigenRutina.SiguePlantilla -> Text(
            "Sigue la plantilla «${origen.nombre}»",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(top = 4.dp)
        )
        OrigenRutina.PlantillaBorrada -> {
            Text(
                "⚠ La plantilla que seguía ya no existe. Está usando la última copia.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 4.dp)
            )
            // Sin diálogo de por medio: no hay nada que perder, la plantilla ya no existe y sus
            // cambios no podían llegarle. Sólo quita el aviso y deja el estado consistente.
            TextButton(onClick = onConvertirEnPropia) { Text("Convertir en rutina propia") }
        }
    }
    if (dias.isEmpty()) {
        Text(
            "Todavía no tiene rutina: su página no muestra ejercicios.",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(top = 8.dp)
        )
        return
    }
    dias.forEachIndexed { indice, dia ->
        DiaRutinaPlegable(
            indice = indice,
            dia = dia,
            esElDeHoy = indice == diaQueToca,
            onEditar = {
                if (origen is OrigenRutina.SiguePlantilla) {
                    diaQueEsperaSoltar = indice
                } else {
                    diaEnEdicion = indice
                }
            }
        )
    }

    val plantillaASoltar = (origen as? OrigenRutina.SiguePlantilla)?.nombre
    if (diaQueEsperaSoltar != null && plantillaASoltar != null) {
        SoltarPlantillaDialog(
            nombreCliente = nombreCliente,
            nombrePlantilla = plantillaASoltar,
            onAceptar = {
                diaEnEdicion = diaQueEsperaSoltar
                diaQueEsperaSoltar = null
            },
            onCancelar = { diaQueEsperaSoltar = null }
        )
    }

    val indiceEnEdicion = diaEnEdicion
    val diaEditado = indiceEnEdicion?.let { dias.getOrNull(it) }
    if (indiceEnEdicion != null && diaEditado != null) {
        EditarDiaDialog(
            indice = indiceEnEdicion,
            dia = diaEditado,
            onGuardar = { editado ->
                onGuardarDia(indiceEnEdicion, editado)
                diaEnEdicion = null
            },
            onCancelar = { diaEnEdicion = null }
        )
    }
}

/**
 * El aviso antes de desprenderse. Va **antes** de la primera edición y no callado porque el
 * efecto no se nota hasta semanas después, cuando el entrenador edite la plantilla y se
 * pregunte por qué a esta clienta no le llegó.
 */
@Composable
private fun SoltarPlantillaDialog(
    nombreCliente: String,
    nombrePlantilla: String,
    onAceptar: () -> Unit,
    onCancelar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Dejar de seguir la plantilla") },
        text = {
            Text(
                "$nombreCliente va a dejar de seguir la plantilla «$nombrePlantilla». " +
                    "Los cambios que le hagas a la plantilla ya no le van a llegar."
            )
        },
        confirmButton = { TextButton(onClick = onAceptar) { Text("Entiendo") } },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } }
    )
}

/**
 * Edita los ejercicios de un día. Trabaja sobre una copia en memoria y sólo la entrega al
 * guardar: cancelar tiene que dejar la rutina como estaba, y guardar campo por campo escribiría
 * en Firestore con cada tecla.
 */
@Composable
private fun EditarDiaDialog(
    indice: Int,
    dia: DiaRutina,
    onGuardar: (DiaRutina) -> Unit,
    onCancelar: () -> Unit
) {
    var ejercicios by remember(dia) { mutableStateOf(dia.ejercicios) }
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Día ${indice + 1}: ${dia.nombreDia}") },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                ejercicios.forEachIndexed { posicion, ejercicio ->
                    EjercicioRow(
                        ejercicio = ejercicio,
                        onChange = { cambiado ->
                            ejercicios = ejercicios.toMutableList().also { it[posicion] = cambiado }
                        },
                        onEliminar = {
                            ejercicios = ejercicios.toMutableList().also { it.removeAt(posicion) }
                        },
                        mostrarPesoONota = true,
                        onSubir = if (posicion == 0) null else {
                            {
                                ejercicios = ejercicios.toMutableList()
                                    .also { it.add(posicion - 1, it.removeAt(posicion)) }
                            }
                        },
                        onBajar = if (posicion == ejercicios.lastIndex) null else {
                            {
                                ejercicios = ejercicios.toMutableList()
                                    .also { it.add(posicion + 1, it.removeAt(posicion)) }
                            }
                        }
                    )
                }
                TextButton(onClick = { ejercicios = ejercicios + Ejercicio() }) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    Text("Agregar ejercicio")
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onGuardar(dia.copy(ejercicios = ejercicios)) }) { Text("Guardar") }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } }
    )
}

@Composable
private fun DiaRutinaPlegable(
    indice: Int,
    dia: DiaRutina,
    esElDeHoy: Boolean,
    onEditar: () -> Unit
) {
    // El de hoy arranca abierto porque es el que el entrenador viene a mirar; se recuerda por
    // `esElDeHoy` para que al avanzar el día del ciclo se abra el nuevo y se cierre el viejo.
    var expandido by remember(esElDeHoy) { mutableStateOf(esElDeHoy) }
    Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable { expandido = !expandido },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                if (esElDeHoy) {
                    "Día ${indice + 1}: ${dia.nombreDia} · hoy"
                } else {
                    "Día ${indice + 1}: ${dia.nombreDia}"
                },
                style = MaterialTheme.typography.bodyMedium,
                color = if (esElDeHoy) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
                modifier = Modifier.weight(1f)
            )
            Icon(
                if (expandido) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                contentDescription = if (expandido) "Ocultar" else "Mostrar"
            )
        }
        if (expandido) {
            if (dia.ejercicios.isEmpty()) {
                Text(
                    "Sin ejercicios cargados: su página muestra sólo el nombre del día.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(start = 8.dp, top = 4.dp)
                )
            } else {
                dia.ejercicios.forEach { ejercicio ->
                    Text(
                        textoEjercicio(ejercicio),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(start = 8.dp, top = 4.dp)
                    )
                }
            }
            TextButton(onClick = onEditar, modifier = Modifier.padding(start = 4.dp)) {
                Text("Editar")
            }
        }
    }
}

/** Los mismos campos que lista la página de la clienta, para que el entrenador vea lo que ella
 *  ve — `pesoONota` incluido, que dejó de ser privado el 2026-09-15. */
private fun textoEjercicio(ejercicio: Ejercicio): String {
    val detalles = listOfNotNull(
        ejercicio.series.takeIf { it > 0 }?.let { "$it series" },
        ejercicio.repeticiones.takeIf { it.isNotBlank() }?.let { "$it reps" },
        ejercicio.pesoONota.takeIf { it.isNotBlank() }
    )
    return if (detalles.isEmpty()) {
        ejercicio.nombre
    } else {
        "${ejercicio.nombre} — ${detalles.joinToString(" · ")}"
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
