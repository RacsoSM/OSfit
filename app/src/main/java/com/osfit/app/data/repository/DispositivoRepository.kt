package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Los teléfonos donde la clienta activó las notificaciones. Los escribe la función
 * `registrarDispositivo`; la app solo los cuenta, para que el entrenador sepa si de verdad le
 * van a llegar los avisos.
 */
class DispositivoRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    fun contarDispositivos(clienteId: String): Flow<Int> = callbackFlow {
        val registro = db.collection("clientes").document(clienteId).collection("dispositivos")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.size() ?: 0)
            }
        awaitClose { registro.remove() }
    }
}
