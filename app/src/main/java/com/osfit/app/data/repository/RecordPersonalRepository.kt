package com.osfit.app.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.RecordPersonal
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class RecordPersonalRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private fun recordsCollection(clienteId: String) =
        db.collection("clientes").document(clienteId).collection("personal_records")

    fun observarRecords(clienteId: String): Flow<List<RecordPersonal>> = callbackFlow {
        val registro = recordsCollection(clienteId)
            .orderBy("fecha", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val records = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(RecordPersonal::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(records)
            }
        awaitClose { registro.remove() }
    }

    suspend fun registrarRecord(clienteId: String, ejercicio: String, marca: String, fecha: Timestamp) {
        val record = RecordPersonal(clienteId = clienteId, ejercicio = ejercicio, marca = marca, fecha = fecha)
        recordsCollection(clienteId).add(record.copy(id = "")).await()
    }

    suspend fun eliminarRecord(clienteId: String, recordId: String) {
        recordsCollection(clienteId).document(recordId).delete().await()
    }
}
