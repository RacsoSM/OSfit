package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.Rutina
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class RutinaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("rutinas")

    fun observarRutinas(): Flow<List<Rutina>> = callbackFlow {
        val registro = coleccion.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val rutinas = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(Rutina::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(rutinas)
        }
        awaitClose { registro.remove() }
    }

    suspend fun obtenerRutina(rutinaId: String): Rutina? {
        val doc = coleccion.document(rutinaId).get().await()
        return doc.toObject(Rutina::class.java)?.copy(id = doc.id)
    }

    suspend fun guardarRutina(rutina: Rutina): String {
        return if (rutina.id.isBlank()) {
            val ref = coleccion.add(rutina.copy(id = "")).await()
            ref.id
        } else {
            coleccion.document(rutina.id).set(rutina.copy(id = "")).await()
            rutina.id
        }
    }

    suspend fun eliminarRutina(rutinaId: String) {
        coleccion.document(rutinaId).delete().await()
    }
}
