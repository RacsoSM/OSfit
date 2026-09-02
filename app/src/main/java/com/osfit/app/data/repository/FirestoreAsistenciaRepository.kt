package com.osfit.app.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.Asistencia
import com.osfit.app.domain.RutinaProgressCalculator
import com.osfit.app.domain.TiempoGymCalculator
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class FirestoreAsistenciaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) : AsistenciaRepository {
    private val coleccion = db.collection("asistencias")
    private val clientesCollection = db.collection("clientes")

    override fun observarAsistenciasPorFecha(fecha: String): Flow<List<Asistencia>> = callbackFlow {
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

    override fun observarAsistenciasPorRango(fechaInicio: String, fechaFin: String): Flow<List<Asistencia>> = callbackFlow {
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

    override fun observarTodasAsistencias(): Flow<List<Asistencia>> = callbackFlow {
        val registro = coleccion.addSnapshotListener { snapshot, error ->
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

    override fun observarAsistenciasPorCliente(clienteId: String): Flow<List<Asistencia>> = callbackFlow {
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

    private suspend fun obtenerAsistencia(clienteId: String, fecha: String): Pair<DocumentReference, Asistencia?> {
        val existente = coleccion
            .whereEqualTo("clienteId", clienteId)
            .whereEqualTo("fecha", fecha)
            .limit(1)
            .get()
            .await()
        val doc = existente.documents.firstOrNull()
        val ref = doc?.reference ?: coleccion.document()
        return ref to doc?.toObject(Asistencia::class.java)
    }

    override suspend fun registrarAsistencia(
        clienteId: String,
        fecha: String,
        asistio: Boolean,
        diaActualIndexPrevio: Int,
        diaRutinaRealizado: Int?,
        totalDiasRutina: Int,
        diaPendienteFechaActual: String?,
        nota: String
    ) {
        val siguienteDiaActualIndex = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = asistio,
            diaActualIndexPrevio = diaActualIndexPrevio,
            diaRutinaRealizado = diaRutinaRealizado,
            totalDias = totalDiasRutina
        )

        val (asistenciaRef, existente) = obtenerAsistencia(clienteId, fecha)

        // Preserva el cronómetro (horaLlegada/horaSalida/duracionMinutos) ya guardado:
        // este método hace un set() completo del documento y no debe pisar un tiempo
        // que ya se haya iniciado o detenido por separado.
        val asistencia = Asistencia(
            clienteId = clienteId,
            fecha = fecha,
            asistio = asistio,
            diaRutinaRealizado = if (asistio) diaRutinaRealizado else null,
            nota = nota,
            horaLlegada = existente?.horaLlegada,
            horaSalida = existente?.horaSalida,
            duracionMinutos = existente?.duracionMinutos
        )

        val batch = db.batch()
        batch.set(asistenciaRef, asistencia.copy(id = ""))
        // El día de rutina no se aplica de inmediato: queda pendiente hasta el día siguiente
        // (calendario), para que la lista de Clientes no cambie mientras se sigue tomando asistencia.
        if (asistio) {
            batch.update(
                clientesCollection.document(clienteId),
                mapOf("diaPendienteIndex" to siguienteDiaActualIndex, "diaPendienteFecha" to fecha)
            )
        } else if (diaPendienteFechaActual == fecha) {
            batch.update(
                clientesCollection.document(clienteId),
                mapOf("diaPendienteIndex" to null, "diaPendienteFecha" to null)
            )
        }
        batch.commit().await()
    }

    override suspend fun iniciarTiempo(
        clienteId: String,
        fecha: String,
        diaActualIndexPrevio: Int,
        totalDiasRutina: Int
    ) {
        val (ref, existente) = obtenerAsistencia(clienteId, fecha)

        // Iniciar el cronómetro equivale a marcar la asistencia: si todavía no se
        // había registrado el día de rutina para esta fecha, se asigna aquí el día
        // efectivo del cliente, igual que hace registrarAsistencia al marcar "Asistió".
        val diaRutinaRealizado = existente?.diaRutinaRealizado ?: diaActualIndexPrevio

        val asistencia = (existente ?: Asistencia(clienteId = clienteId, fecha = fecha)).copy(
            id = "",
            asistio = true,
            diaRutinaRealizado = diaRutinaRealizado,
            horaLlegada = Timestamp.now(),
            horaSalida = null,
            duracionMinutos = null
        )

        val batch = db.batch()
        batch.set(ref, asistencia)
        if (existente?.diaRutinaRealizado == null) {
            val siguienteDiaActualIndex = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
                asistio = true,
                diaActualIndexPrevio = diaActualIndexPrevio,
                diaRutinaRealizado = diaRutinaRealizado,
                totalDias = totalDiasRutina
            )
            batch.update(
                clientesCollection.document(clienteId),
                mapOf("diaPendienteIndex" to siguienteDiaActualIndex, "diaPendienteFecha" to fecha)
            )
        }
        batch.commit().await()
    }

    override suspend fun detenerTiempo(clienteId: String, fecha: String) {
        val (ref, existente) = obtenerAsistencia(clienteId, fecha)
        val horaLlegada = existente?.horaLlegada ?: return
        val ahora = Timestamp.now()
        val duracion = TiempoGymCalculator.calcularDuracionMinutos(
            inicioMillis = horaLlegada.toDate().time,
            finMillis = ahora.toDate().time
        )
        ref.update(
            mapOf(
                "horaSalida" to ahora,
                "duracionMinutos" to duracion
            )
        ).await()
    }

    override suspend fun reiniciarDia(fecha: String, clienteIdsConPendiente: List<String>) {
        val existentes = coleccion.whereEqualTo("fecha", fecha).get().await()
        val batch = db.batch()
        existentes.documents.forEach { doc -> batch.delete(doc.reference) }
        // Deshace el avance de rutina que esta fecha haya dejado pendiente en cada cliente,
        // igual que el "faltó" normal en registrarAsistencia.
        clienteIdsConPendiente.forEach { clienteId ->
            batch.update(
                clientesCollection.document(clienteId),
                mapOf("diaPendienteIndex" to null, "diaPendienteFecha" to null)
            )
        }
        batch.commit().await()
    }

    override suspend fun actualizarDiaRealizado(clienteId: String, fecha: String, nuevoDia: Int) {
        val asistenciaExistente = coleccion
            .whereEqualTo("clienteId", clienteId)
            .whereEqualTo("fecha", fecha)
            .limit(1)
            .get()
            .await()
        val ref = asistenciaExistente.documents.firstOrNull()?.reference ?: return
        ref.update("diaRutinaRealizado", nuevoDia).await()
    }
}
