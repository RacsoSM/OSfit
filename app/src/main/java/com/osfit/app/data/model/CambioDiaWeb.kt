package com.osfit.app.data.model

import com.google.firebase.Timestamp

/**
 * Cambio de día pedido por el cliente desde la web. Alimenta el indicador del entrenador en
 * el calendario.
 *
 * Existe como colección aparte porque si el cliente cambia su día **antes** de venir todavía
 * no hay ningún registro de asistencia donde anotarlo.
 *
 * Doc id: "<clienteId>_<fecha>" — un solo cambio vigente por cliente y día; si el cliente
 * cambia dos veces, la segunda pisa a la primera y el indicador muestra la última. Como el id
 * se deriva de los campos, no hace falta guardarlo dentro del documento.
 */
data class CambioDiaWeb(
    val clienteId: String = "",
    val fecha: String = "",
    val diaIndex: Int = 0,
    val motivo: String = "",
    val creado: Timestamp = Timestamp.now()
)
