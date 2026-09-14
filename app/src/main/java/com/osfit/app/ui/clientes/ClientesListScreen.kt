package com.osfit.app.ui.clientes

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.osfit.app.data.model.Cliente
import com.osfit.app.domain.PagoCalculator
import com.osfit.app.domain.RutinaProgressCalculator
import com.osfit.app.ui.common.TextoMaquinaEscribir
import com.osfit.app.ui.common.rememberFechaActual
import com.osfit.app.ui.theme.ColoresAvatar
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun ClientesListScreen(
    onClienteClick: (String) -> Unit,
    viewModel: ClientesListViewModel = viewModel()
) {
    val clientes by viewModel.clientes.collectAsState()
    val diaQueTocaPorCliente by viewModel.diaQueTocaPorCliente.collectAsState()
    val errorValidacion by viewModel.errorValidacion.collectAsState()
    val avisaronQueNoVienen by viewModel.avisaronQueNoVienen.collectAsState()
    val hoy by rememberFechaActual()

    // `rememberFechaActual()` despierta sola a medianoche; el ViewModel se entera por aquí y
    // vuelve a consultar los avisos del día nuevo.
    LaunchedEffect(hoy) { viewModel.fijarFecha(hoy.toString()) }
    var mostrarDialogo by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { mostrarDialogo = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Nuevo cliente")
            }
        }
    ) { padding ->
        if (clientes.isEmpty()) {
            Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                EncabezadoSaludo()
                Text("Aún no hay clientes. Toca + para agregar uno.", modifier = Modifier.padding(top = 16.dp))
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 12.dp),
                contentPadding = PaddingValues(top = 12.dp, bottom = 88.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item { EncabezadoSaludo() }
                items(clientes, key = { it.id }) { cliente ->
                    ClienteItem(
                        cliente = cliente,
                        diaQueToca = diaQueTocaPorCliente[cliente.id] ?: 0,
                        avisoNoViene = cliente.id in avisaronQueNoVienen,
                        onClick = { onClienteClick(cliente.id) }
                    )
                }
            }
        }
    }

    if (mostrarDialogo) {
        NuevoClienteDialog(
            errorValidacion = errorValidacion,
            onConfirmar = { nombre, telefono ->
                viewModel.crearCliente(nombre, telefono)
                if (nombre.isNotBlank()) mostrarDialogo = false
            },
            onCancelar = {
                viewModel.limpiarError()
                mostrarDialogo = false
            }
        )
    }
}

@Composable
private fun EncabezadoSaludo() {
    val fecha = remember {
        java.time.LocalDate.now()
            .format(DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM", Locale("es")))
            .replaceFirstChar { it.uppercase() }
    }
    var saludoListo by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom
    ) {
        TextoMaquinaEscribir(
            texto = "Hola, Oscar",
            style = MaterialTheme.typography.headlineMedium,
            empezar = true,
            onTerminar = { saludoListo = true }
        )
        Box(contentAlignment = Alignment.CenterStart) {
            // Reserva el ancho final para que el texto no se desplace mientras se "escribe".
            Text(fecha, style = MaterialTheme.typography.titleSmall, color = Color.Transparent)
            TextoMaquinaEscribir(
                texto = fecha,
                style = MaterialTheme.typography.titleSmall,
                empezar = saludoListo
            )
        }
    }
}

private val GrisInactivo = Color(0xFF5A5A5A)

/**
 * El amarillo de "avisó que no viene". Es el mismo tono que los días de asistencia media en
 * el calendario: la app ya tiene un amarillo y no le hace falta un segundo.
 */
private val AmarilloAviso = Color(0xFFDBD74B)

@Composable
private fun ClienteItem(
    cliente: Cliente,
    diaQueToca: Int,
    avisoNoViene: Boolean,
    onClick: () -> Unit
) {
    val nombreDia = cliente.rutinaAsignada?.dias?.getOrNull(diaQueToca)?.nombreDia
        ?: "Sin rutina asignada"
    val diasParaPago = PagoCalculator.diasParaProximoPago(cliente)
    val pagoProximo = diasParaPago != null && diasParaPago < 3
    val colorTexto = when {
        !cliente.activo -> GrisInactivo
        // El aviso gana al rojo del pago porque habla de hoy y porque la tarjeta ya está
        // amarilla: un nombre rojo encima de un fondo amarillo no se lee como advertencia,
        // se lee como un error de pintado. El pago sigue avisando al abrir la ficha.
        avisoNoViene -> AmarilloAviso
        pagoProximo -> lerp(MaterialTheme.colorScheme.onSurface, MaterialTheme.colorScheme.error, 0.55f)
        else -> Color.Unspecified
    }
    // Alpha baja y no el amarillo puro: la tarjeta tiene que cantar entre las demás sin
    // deslumbrar en un tema oscuro, igual que el rojo y el verde de Tomar Asistencia.
    //
    // Sin aviso se pasan los colores por defecto tal cual, en vez de un `Color.Unspecified`
    // como containerColor: según la versión de Material 3 eso deja la tarjeta transparente.
    val colores = if (avisoNoViene) {
        CardDefaults.cardColors(containerColor = AmarilloAviso.copy(alpha = 0.20f))
    } else {
        CardDefaults.cardColors()
    }
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), colors = colores) {
        Box(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 20.dp)
        ) {
            // Se dibuja primero para que, si el nombre es muy largo, la fila de avatar+nombre
            // (compuesta después) quede encima y lo tape, en vez de truncar el nombre.
            Text(
                nombreDia,
                style = MaterialTheme.typography.bodyMedium,
                color = colorTexto,
                textAlign = TextAlign.End,
                modifier = Modifier.align(Alignment.CenterEnd).fillMaxWidth(0.45f)
            )
            Row(
                modifier = Modifier.align(Alignment.CenterStart),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AvatarCliente(nombre = cliente.nombre, activo = cliente.activo)
                Column(modifier = Modifier.padding(start = 12.dp)) {
                    Text(
                        cliente.nombre,
                        style = MaterialTheme.typography.titleMedium,
                        color = colorTexto,
                        textDecoration = if (cliente.activo) null else TextDecoration.LineThrough,
                        maxLines = 1
                    )
                }
            }
        }
    }
}

@Composable
private fun AvatarCliente(nombre: String, activo: Boolean) {
    val color = if (!activo) {
        GrisInactivo
    } else {
        ColoresAvatar[(nombre.hashCode().let { if (it < 0) -it else it }) % ColoresAvatar.size]
    }
    Box(
        modifier = Modifier.size(44.dp).background(color, CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text(
            nombre.firstOrNull()?.uppercaseChar()?.toString() ?: "?",
            style = MaterialTheme.typography.titleMedium,
            color = Color.White
        )
    }
}

@Composable
private fun NuevoClienteDialog(
    errorValidacion: String?,
    onConfirmar: (nombre: String, telefono: String) -> Unit,
    onCancelar: () -> Unit
) {
    var nombre by remember { mutableStateOf("") }
    var telefono by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Nuevo cliente") },
        text = {
            Column {
                OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre") }, modifier = Modifier.fillMaxWidth(), isError = errorValidacion != null)
                if (errorValidacion != null) {
                    Text(errorValidacion, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                OutlinedTextField(value = telefono, onValueChange = { telefono = it }, label = { Text("Teléfono (opcional)") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirmar(nombre, telefono) }) { Text("Guardar") }
        },
        dismissButton = {
            TextButton(onClick = onCancelar) { Text("Cancelar") }
        }
    )
}
