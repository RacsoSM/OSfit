package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.AvisoFaltaWeb
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/** Solo lectura: quien escribe `avisosFalta` es la función `avisarFalta`, nunca la app. */
class AvisoFaltaWebRepository(
    db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("avisosFalta")

    fun observarPorFecha(fecha: String): Flow<List<AvisoFaltaWeb>> = callbackFlow {
        val registro = coleccion.whereEqualTo("fecha", fecha)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(
                    snapshot?.documents?.mapNotNull { it.toObject(AvisoFaltaWeb::class.java) }
                        ?: emptyList()
                )
            }
        awaitClose { registro.remove() }
    }
}
