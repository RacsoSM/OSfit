package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.Notificacion
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class NotificacionRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("notificaciones")

    fun observarHistorial(limite: Long = 30): Flow<List<Notificacion>> = callbackFlow {
        val registro = coleccion.orderBy("creada", Query.Direction.DESCENDING).limit(limite)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(
                    snapshot?.documents.orEmpty().mapNotNull { doc ->
                        doc.toObject(Notificacion::class.java)?.copy(id = doc.id)
                    }
                )
            }
        awaitClose { registro.remove() }
    }

    /**
     * Sin `await` a propósito: sin señal, la escritura espera en la cola local de Firestore y
     * sale sola al volver la red. Esperarla dejaría la pantalla en "enviando" hasta entonces;
     * el historial ya muestra el aviso como pendiente desde el caché local.
     */
    fun enviar(aviso: Notificacion) {
        coleccion.add(aviso.copy(id = "", estado = Notificacion.ESTADO_PENDIENTE))
    }
}
