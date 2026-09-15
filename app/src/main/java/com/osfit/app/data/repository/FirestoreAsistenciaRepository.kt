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
        diaRutinaRealizado: Int?,
        nota: String,
        variacionRealizada: Int?
    ) {
        val (asistenciaRef, existente) = obtenerAsistencia(clienteId, fecha)

        // Preserva el cronómetro (horaLlegada/horaSalida/duracionMinutos) ya guardado:
        // este método hace un set() completo del documento y no debe pisar un tiempo
        // que ya se haya iniciado o detenido por separado.
        val asistencia = Asistencia(
            clienteId = clienteId,
            fecha = fecha,
            asistio = asistio,
            // Al marcar asistencia deja de haber falta que justificar; al remarcar una
            // falta se conserva el soborno que ya se le haya dado.
            justificada = !asistio && existente?.justificada == true,
            // Misma razón que la línea de arriba: este set() borra lo que no se nombre, y
            // perder esta bandera le regalaría al cliente el revive que ya gastó.
            justificadaPorCliente = !asistio && existente?.justificadaPorCliente == true,
            diaRutinaRealizado = if (asistio) diaRutinaRealizado else null,
            // Tercera vez que hace falta la misma precaución: este set() borra lo que no se
            // nombre. Se respeta la variación ya guardada y el parámetro sólo entra si no había
            // ninguna — si no, remarcar la asistencia del día reiniciaría la rotación sola.
            variacionRealizada = if (asistio) {
                existente?.variacionRealizada ?: variacionRealizada
            } else {
                null
            },
            nota = nota,
            horaLlegada = existente?.horaLlegada,
            horaSalida = existente?.horaSalida,
            duracionMinutos = existente?.duracionMinutos
        )

        // Solo se escribe el registro: el día que le toca al cliente se deduce de estos
        // registros (Calendario-Rutina es la fuente de verdad), así que ya no hay que
        // tocar la colección de clientes ni mantener un caché que pueda quedar viejo.
        asistenciaRef.set(asistencia.copy(id = "")).await()
    }

    override suspend fun iniciarTiempo(
        clienteId: String,
        fecha: String,
        diaRutinaRealizado: Int,
        variacionRealizada: Int?
    ) {
        val (ref, existente) = obtenerAsistencia(clienteId, fecha)

        // Iniciar el cronómetro equivale a marcar la asistencia. Si ya había un día
        // registrado para esta fecha se respeta, para no pisar una corrección manual
        // hecha desde la pestaña Rutina.
        val dia = existente?.diaRutinaRealizado ?: diaRutinaRealizado
        // Misma regla que el día: lo ya guardado manda, y el parámetro sólo sirve al crear.
        val variacion = existente?.variacionRealizada ?: variacionRealizada

        val asistencia = (existente ?: Asistencia(clienteId = clienteId, fecha = fecha)).copy(
            id = "",
            asistio = true,
            justificada = false,
            justificadaPorCliente = false,
            diaRutinaRealizado = dia,
            variacionRealizada = variacion,
            horaLlegada = Timestamp.now(),
            horaSalida = null,
            duracionMinutos = null
        )
        ref.set(asistencia).await()
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

    override suspend fun reiniciarDia(fecha: String) {
        // Basta con borrar los registros del día: al desaparecer, el día de cada cliente
        // vuelve solo a lo que dictaba el registro anterior.
        val existentes = coleccion.whereEqualTo("fecha", fecha).get().await()
        val batch = db.batch()
        existentes.documents.forEach { doc -> batch.delete(doc.reference) }
        batch.commit().await()
    }

    override suspend fun actualizarDiaRealizado(
        clienteId: String,
        fecha: String,
        nuevoDia: Int,
        variacionRealizada: Int?
    ) {
        val (ref, existente) = obtenerAsistencia(clienteId, fecha)
        // Solo tiene sentido corregir el día de una asistencia ya registrada.
        if (existente == null || !existente.asistio) return
        // La variación guardada pertenecía al día VIEJO: dejarla ahí desacomoda la rotación de
        // los dos días. El llamador la recalcula para el día nuevo y la pasa; se escribe siempre,
        // incluso nula, que es lo correcto para un día sin variaciones.
        ref.update(
            mapOf(
                "diaRutinaRealizado" to nuevoDia,
                "variacionRealizada" to variacionRealizada
            )
        ).await()
    }

    override suspend fun justificarFalta(clienteId: String, fecha: String, justificada: Boolean) {
        val (ref, existente) = obtenerAsistencia(clienteId, fecha)
        // Solo tiene sentido justificar una falta ya registrada.
        if (existente == null || existente.asistio) return
        ref.update("justificada", justificada).await()
    }
}
