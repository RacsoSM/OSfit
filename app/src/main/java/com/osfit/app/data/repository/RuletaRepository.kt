package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * La tirada de ruleta de un cliente en un mes, si jugó.
 *
 * GEMELO: `observarTirada` en `web/src/datos.ts`.
 *
 * El entrenador solo la lee: quien escribe es la Cloud Function `jugarRuleta`. Si la app
 * pudiera escribir acá, el castigo del cliente dependería de qué pantalla se abrió primero.
 */
data class Tirada(
    val mes: String = "",
    val color: String = "",
    val gano: Boolean = false,
    val fecha: String = ""
)

class RuletaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    fun observarTirada(clienteId: String, mes: String): Flow<Tirada?> = callbackFlow {
        val registro = db.collection("ruletas").document("${clienteId}_$mes")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.toObject(Tirada::class.java))
            }
        awaitClose { registro.remove() }
    }
}
