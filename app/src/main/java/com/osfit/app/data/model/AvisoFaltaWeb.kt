package com.osfit.app.data.model

import com.google.firebase.Timestamp

/**
 * "Hoy no voy a poder ir" enviado por el cliente desde la web. Alimenta el indicador del
 * entrenador en Tomar Asistencia.
 *
 * Existe como colección aparte porque avisar **no** es justificar: no gasta revive y no toca
 * `asistencias`, así que no hay ningún registro de asistencia donde anotarlo. Hasta el
 * 2026-09-12 el aviso se deducía de `justificadaPorCliente`, y eso obligaba a que avisar
 * costara uno de los 3 revives del mes.
 *
 * Doc id: "<clienteId>_<fecha>" — un solo aviso por cliente y día. Como el id se deriva de
 * los campos, no hace falta guardarlo dentro del documento.
 */
data class AvisoFaltaWeb(
    val clienteId: String = "",
    val fecha: String = "",
    val creado: Timestamp = Timestamp.now()
)
