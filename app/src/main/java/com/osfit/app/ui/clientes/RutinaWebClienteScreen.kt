package com.osfit.app.ui.clientes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.model.VariacionDia
import com.osfit.app.domain.claveEjercicio
import com.osfit.app.domain.conPesosPropios
import com.osfit.app.domain.conVariacionNueva
import com.osfit.app.domain.etiquetaVariacion
import com.osfit.app.domain.sinLaUltimaVariacion
import com.osfit.app.ui.common.EjercicioRow

/**
 * La rutina que ve la clienta en su página, y su edición.
 *
 * Vive detrás del botón **Web** y no en la ficha porque el criterio de esa pantalla es *todo lo
 * que el entrenador administra de la página de la clienta*, y desde el 2026-09-15 la página
 * lista los ejercicios del día (spec `2026-09-15-rutinas-en-la-web-design.md`). Es la misma
 * puerta por la que entraron los videos y la paleta.
 *
 * No duplica la tarjeta "Rutina asignada" de la ficha: aquélla responde qué rutina tiene y qué
 * día le toca —y manda la rutina por WhatsApp—, ésta responde qué ejercicios ve la clienta.
 */
@Composable
fun RutinaWebClienteScreen(clienteId: String) {
    val viewModel: ClienteDetailViewModel = viewModel(
        key = "rutina-web-$clienteId",
        factory = viewModelFactory { initializer { ClienteDetailViewModel(clienteId) } }
    )
    val cliente by viewModel.cliente.collectAsState()
    val plantillas by viewModel.plantillasDisponibles.collectAsState()
    val diaQueToca by viewModel.diaQueToca.collectAsState()
    val variacionPorDia by viewModel.variacionQueTocaPorDia.collectAsState()

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Rutina en la web", style = MaterialTheme.typography.headlineSmall)
            val clienteActual = cliente
            if (clienteActual == null) {
                Text("Cargando…", style = MaterialTheme.typography.bodyMedium)
                return@Column
            }
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    SeccionRutinaWeb(
                        origen = origenRutinaDe(clienteActual, plantillas),
                        dias = diasQueVeLaClienta(clienteActual, plantillas),
                        diaQueToca = diaQueToca,
                        variacionPorDia = variacionPorDia,
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
                                ?.let { viewModel.convertirEnRutinaPropia(it) }
                        },
                        pesosPropios = clienteActual.pesoPorEjercicio,
                        onGuardarPesos = viewModel::guardarPesosPropios
                    )
                }
            }
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
    variacionPorDia: Map<Int, Int>,
    nombreCliente: String,
    onGuardarDia: (Int, DiaRutina) -> Unit,
    onConvertirEnPropia: () -> Unit,
    pesosPropios: Map<String, String>,
    onGuardarPesos: (Map<String, String>) -> Unit
) {
    // Qué se está editando: el día, y dentro de él la variación (null = la lista base, que es
    // la que manda cuando el día no tiene variaciones).
    // El editor completo (rutina propia) y el de sólo pesos (mientras sigue una plantilla) son
    // dos cosas distintas y llevan estado separado: el segundo no desprende a nadie.
    var diaEnEdicion by remember { mutableStateOf<Int?>(null) }
    var variacionEnEdicion by remember { mutableStateOf<Int?>(null) }
    var diaEnPesos by remember { mutableStateOf<Int?>(null) }
    var variacionEnPesos by remember { mutableStateOf<Int?>(null) }
    var soltandoPlantilla by remember { mutableStateOf(false) }

    Text("Rutina", style = MaterialTheme.typography.titleSmall)
    when (origen) {
        OrigenRutina.Propia -> Text(
            "Rutina propia",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(top = 4.dp)
        )
        is OrigenRutina.SiguePlantilla -> {
            Text(
                "Sigue la plantilla «${origen.nombre}»",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp)
            )
            Text(
                "Los ejercicios y las variaciones se editan en la pestaña Rutinas y los comparten " +
                    "todas las que siguen esta plantilla. Los pesos y notas sí son suyos: " +
                    "edítalos con «Editar pesos», sin sacarla de la plantilla.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp)
            )
            TextButton(onClick = { soltandoPlantilla = true }) {
                Text("Convertir en rutina propia")
            }
        }
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
            // Las variaciones de una plantilla existen y se ven acá, pero se editan donde vive la
            // plantilla: en la pestaña Rutinas. Tocarlas desde la ficha de una clienta la
            // desprendería, que es justo lo contrario de lo que quiere quien las comparte.
            esRutinaPropia = origen == OrigenRutina.Propia,
            variacionQueToca = variacionPorDia[indice] ?: 0,
            // Mientras siga una plantilla se muestran sus pesos, no los del grupo: es lo que ve
            // en su página, y el entrenador tiene que ver lo mismo.
            pesosPropios = if (origen is OrigenRutina.SiguePlantilla) pesosPropios else emptyMap(),
            onEditar = { variacion ->
                if (origen is OrigenRutina.SiguePlantilla) {
                    diaEnPesos = indice
                    variacionEnPesos = variacion
                } else {
                    diaEnEdicion = indice
                    variacionEnEdicion = variacion
                }
            },
            onAgregarVariacion = { onGuardarDia(indice, conVariacionNueva(dia)) },
            onQuitarVariacion = { onGuardarDia(indice, sinLaUltimaVariacion(dia)) }
        )
    }

    val plantillaASoltar = (origen as? OrigenRutina.SiguePlantilla)?.nombre
    if (soltandoPlantilla && plantillaASoltar != null) {
        SoltarPlantillaDialog(
            nombreCliente = nombreCliente,
            nombrePlantilla = plantillaASoltar,
            onAceptar = {
                onConvertirEnPropia()
                soltandoPlantilla = false
            },
            onCancelar = { soltandoPlantilla = false }
        )
    }

    val indiceEnPesos = diaEnPesos
    val diaDePesos = indiceEnPesos?.let { dias.getOrNull(it) }
    if (indiceEnPesos != null && diaDePesos != null) {
        EditarPesosDialog(
            indice = indiceEnPesos,
            dia = diaDePesos,
            variacion = variacionEnPesos,
            nombreCliente = nombreCliente,
            pesosPropios = pesosPropios,
            onGuardar = { cambios ->
                onGuardarPesos(cambios)
                diaEnPesos = null
                variacionEnPesos = null
            },
            onCancelar = {
                diaEnPesos = null
                variacionEnPesos = null
            }
        )
    }

    val indiceEnEdicion = diaEnEdicion
    val diaEditado = indiceEnEdicion?.let { dias.getOrNull(it) }
    if (indiceEnEdicion != null && diaEditado != null) {
        EditarDiaDialog(
            indice = indiceEnEdicion,
            dia = diaEditado,
            variacion = variacionEnEdicion,
            onGuardar = { editado ->
                onGuardarDia(indiceEnEdicion, editado)
                diaEnEdicion = null
                variacionEnEdicion = null
            },
            onCancelar = {
                diaEnEdicion = null
                variacionEnEdicion = null
            }
        )
    }
}

/**
 * Edita **sólo** el peso o la nota de cada ejercicio, para una clienta que sigue una plantilla.
 *
 * No la desprende, que es el punto: los ejercicios son del grupo y siguen llegándole, pero el
 * peso es suyo. Lo que se escriba se guarda en su documento indexado por nombre de ejercicio
 * (ver `domain/PesosPropios.kt`), no dentro de la plantilla.
 *
 * Dejar un campo vacío no borra nada: vuelve a mostrar el de la plantilla, que aparece como
 * marca de agua para que se vea cuál se estaría heredando.
 */
@Composable
private fun EditarPesosDialog(
    indice: Int,
    dia: DiaRutina,
    variacion: Int?,
    nombreCliente: String,
    pesosPropios: Map<String, String>,
    onGuardar: (Map<String, String>) -> Unit,
    onCancelar: () -> Unit
) {
    val ejercicios = if (variacion == null) {
        dia.ejercicios
    } else {
        dia.variaciones.getOrNull(variacion)?.ejercicios.orEmpty()
    }
    // Sólo lo tecleado en este diálogo. Lo que no se toca no entra en el lote y se queda como
    // estaba, así que abrir y cancelar no puede borrarle nada.
    var cambios by remember(dia, variacion) { mutableStateOf(mapOf<String, String>()) }
    AlertDialog(
        onDismissRequest = onCancelar,
        title = {
            Text(
                if (variacion == null) {
                    "Pesos de $nombreCliente · Día ${indice + 1}"
                } else {
                    "Pesos de $nombreCliente · Día ${indice + 1} variación ${etiquetaVariacion(variacion)}"
                }
            )
        },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                if (ejercicios.isEmpty()) {
                    Text("Este día no tiene ejercicios cargados en la plantilla.")
                }
                ejercicios.forEach { ejercicio ->
                    val propio = pesosPropios[claveEjercicio(ejercicio.nombre)].orEmpty()
                    OutlinedTextField(
                        value = cambios[ejercicio.nombre] ?: propio,
                        onValueChange = { cambios = cambios + (ejercicio.nombre to it) },
                        label = { Text(ejercicio.nombre) },
                        placeholder = {
                            Text(
                                if (ejercicio.pesoONota.isBlank()) {
                                    "Sin peso en la plantilla"
                                } else {
                                    "De la plantilla: ${ejercicio.pesoONota}"
                                }
                            )
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = { onGuardar(cambios) }) { Text("Guardar") } },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } }
    )
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
    variacion: Int?,
    onGuardar: (DiaRutina) -> Unit,
    onCancelar: () -> Unit
) {
    // `variacion` nulo edita la lista base; con valor, esa variación. Es el mismo invariante de
    // `DiaRutina` visto desde el editor: sólo una de las dos listas está viva a la vez.
    val original = if (variacion == null) {
        dia.ejercicios
    } else {
        dia.variaciones.getOrNull(variacion)?.ejercicios.orEmpty()
    }
    var ejercicios by remember(dia, variacion) { mutableStateOf(original) }
    AlertDialog(
        onDismissRequest = onCancelar,
        title = {
            Text(
                if (variacion == null) {
                    "Día ${indice + 1}: ${dia.nombreDia}"
                } else {
                    "Día ${indice + 1}: ${dia.nombreDia} · variación ${etiquetaVariacion(variacion)}"
                }
            )
        },
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
            TextButton(
                onClick = {
                    val editado = if (variacion == null) {
                        dia.copy(ejercicios = ejercicios)
                    } else {
                        dia.copy(
                            variaciones = dia.variaciones.toMutableList().also {
                                it[variacion] = VariacionDia(ejercicios)
                            }
                        )
                    }
                    onGuardar(editado)
                }
            ) {
                Text("Guardar")
            }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } }
    )
}

@Composable
private fun DiaRutinaPlegable(
    indice: Int,
    dia: DiaRutina,
    esElDeHoy: Boolean,
    esRutinaPropia: Boolean,
    variacionQueToca: Int,
    pesosPropios: Map<String, String>,
    onEditar: (Int?) -> Unit,
    onAgregarVariacion: () -> Unit,
    onQuitarVariacion: () -> Unit
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
            val textoEditar = if (esRutinaPropia) "Editar" else "Editar pesos"
            if (dia.variaciones.isEmpty()) {
                ListaEjercicios(conPesosPropios(dia.ejercicios, pesosPropios))
                TextButton(onClick = { onEditar(null) }, modifier = Modifier.padding(start = 4.dp)) {
                    Text(textoEditar)
                }
            } else {
                dia.variaciones.forEachIndexed { posicion, variacion ->
                    Text(
                        if (posicion == variacionQueToca) {
                            "Variación ${etiquetaVariacion(posicion)} · le toca hoy"
                        } else {
                            "Variación ${etiquetaVariacion(posicion)}"
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = if (posicion == variacionQueToca) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                        modifier = Modifier.padding(start = 8.dp, top = 8.dp)
                    )
                    ListaEjercicios(conPesosPropios(variacion.ejercicios, pesosPropios))
                    TextButton(
                        onClick = { onEditar(posicion) },
                        modifier = Modifier.padding(start = 4.dp)
                    ) {
                        Text(textoEditar)
                    }
                }
            }
            if (esRutinaPropia) {
                Row(modifier = Modifier.padding(start = 4.dp)) {
                    TextButton(onClick = onAgregarVariacion) { Text("Agregar variación") }
                    if (dia.variaciones.isNotEmpty()) {
                        TextButton(onClick = onQuitarVariacion) { Text("Quitar variación") }
                    }
                }
            }
        }
    }
}

@Composable
private fun ListaEjercicios(ejercicios: List<Ejercicio>) {
    if (ejercicios.isEmpty()) {
        Text(
            "Sin ejercicios cargados: su página muestra sólo el nombre del día.",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(start = 8.dp, top = 4.dp)
        )
        return
    }
    ejercicios.forEach { ejercicio ->
        Text(
            textoEjercicio(ejercicio),
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(start = 8.dp, top = 4.dp)
        )
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
