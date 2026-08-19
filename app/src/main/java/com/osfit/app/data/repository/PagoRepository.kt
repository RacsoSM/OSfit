package com.osfit.app.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.Pago
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class PagoRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private fun pagosCollection(clienteId: String) =
        db.collection("clientes").document(clienteId).collection("pagos")

    fun observarPagos(clienteId: String): Flow<List<Pago>> = callbackFlow {
        val registro = pagosCollection(clienteId)
            .orderBy("fecha", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val pagos = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Pago::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(pagos)
            }
        awaitClose { registro.remove() }
    }

    suspend fun registrarPago(
        clienteId: String,
        monto: Double,
        fecha: Timestamp,
        fechaProximoPago: Timestamp,
        nota: String
    ) {
        val batch = db.batch()
        val nuevoPagoRef = pagosCollection(clienteId).document()
        val pago = Pago(
            monto = monto,
            fecha = fecha,
            fechaProximoPagoGenerada = fechaProximoPago,
            nota = nota
        )
        batch.set(nuevoPagoRef, pago.copy(id = ""))

        val clienteRef = db.collection("clientes").document(clienteId)
        batch.update(clienteRef, "fechaProximoPago", fechaProximoPago)

        batch.commit().await()
    }
}
