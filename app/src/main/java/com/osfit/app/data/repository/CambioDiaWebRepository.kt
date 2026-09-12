package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.CambioDiaWeb
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/** Solo lectura: quien escribe `cambiosDia` es la función `cambiarDia`, nunca la app. */
class CambioDiaWebRepository(
    db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("cambiosDia")

    fun observarPorFecha(fecha: String): Flow<List<CambioDiaWeb>> = callbackFlow {
        val registro = coleccion.whereEqualTo("fecha", fecha)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(
                    snapshot?.documents?.mapNotNull { it.toObject(CambioDiaWeb::class.java) }
                        ?: emptyList()
                )
            }
        awaitClose { registro.remove() }
    }
}
