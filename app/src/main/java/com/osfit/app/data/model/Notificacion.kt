package com.osfit.app.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.ServerTimestamp

/**
 * Un aviso a las clientas, en `notificaciones/{id}`. La app lo crea en "pendiente" y la
 * función `enviarNotificacion` lo manda y anota `estado`, `enviadas` y `fallidas`: el mismo
 * documento es la cola y el historial.
 *
 * `enviadas` y `fallidas` cuentan **dispositivos**, no clientas: una clienta con teléfono y
 * tablet suma dos.
 */
data class Notificacion(
    val id: String = "",
    val titulo: String = "OSfit",
    val texto: String = "",
    val destino: String = DESTINO_TODAS,
    val clientesElegidos: List<String> = emptyList(),
    @ServerTimestamp val creada: Timestamp? = null,
    val estado: String = ESTADO_PENDIENTE,
    val enviadas: Int = 0,
    val fallidas: Int = 0
) {
    companion object {
        const val DESTINO_TODAS = "todas"
        const val DESTINO_ELEGIDAS = "elegidas"
        const val ESTADO_PENDIENTE = "pendiente"
        const val ESTADO_ENVIANDO = "enviando"
        const val ESTADO_ENVIADA = "enviada"
        const val ESTADO_ERROR = "error"
    }
}
