package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.CambioSemanaWeb
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/** Solo lectura: quien escribe `cambiosSemana` es la función `cambiarSemana`, nunca la app. */
class CambioSemanaWebRepository(
    db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("cambiosSemana")

    fun observarPorFecha(fecha: String): Flow<List<CambioSemanaWeb>> = callbackFlow {
        val registro = coleccion.whereEqualTo("fecha", fecha)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(
                    snapshot?.documents?.mapNotNull { it.toObject(CambioSemanaWeb::class.java) }
                        ?: emptyList()
                )
            }
        awaitClose { registro.remove() }
    }
}
