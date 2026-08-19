package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.Asistencia
import com.osfit.app.domain.RutinaProgressCalculator
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class AsistenciaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("asistencias")
    private val clientesCollection = db.collection("clientes")

    fun observarAsistenciasPorFecha(fecha: String): Flow<List<Asistencia>> = callbackFlow {
        val registro = coleccion.whereEqualTo("fecha", fecha)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val asistencias = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Asistencia::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(asistencias)
            }
        awaitClose { registro.remove() }
    }

    fun observarAsistenciasPorRango(fechaInicio: String, fechaFin: String): Flow<List<Asistencia>> = callbackFlow {
        val registro = coleccion
            .whereGreaterThanOrEqualTo("fecha", fechaInicio)
            .whereLessThanOrEqualTo("fecha", fechaFin)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val asistencias = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Asistencia::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(asistencias)
            }
        awaitClose { registro.remove() }
    }

    fun observarAsistenciasPorCliente(clienteId: String): Flow<List<Asistencia>> = callbackFlow {
        val registro = coleccion.whereEqualTo("clienteId", clienteId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val asistencias = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Asistencia::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(asistencias)
            }
        awaitClose { registro.remove() }
    }

    suspend fun registrarAsistencia(
        clienteId: String,
        fecha: String,
        asistio: Boolean,
        diaActualIndexPrevio: Int,
        diaRutinaRealizado: Int?,
        totalDiasRutina: Int,
        nota: String = ""
    ) {
        val siguienteDiaActualIndex = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = asistio,
            diaActualIndexPrevio = diaActualIndexPrevio,
            diaRutinaRealizado = diaRutinaRealizado,
            totalDias = totalDiasRutina
        )

        val asistenciaExistente = coleccion
            .whereEqualTo("clienteId", clienteId)
            .whereEqualTo("fecha", fecha)
            .limit(1)
            .get()
            .await()

        val asistenciaRef = if (!asistenciaExistente.isEmpty) {
            asistenciaExistente.documents.first().reference
        } else {
            coleccion.document()
        }

        val asistencia = Asistencia(
            clienteId = clienteId,
            fecha = fecha,
            asistio = asistio,
            diaRutinaRealizado = if (asistio) diaRutinaRealizado else null,
            nota = nota
        )

        val batch = db.batch()
        batch.set(asistenciaRef, asistencia.copy(id = ""))
        if (asistio) {
            batch.update(clientesCollection.document(clienteId), "diaActualIndex", siguienteDiaActualIndex)
        }
        batch.commit().await()
    }
}
