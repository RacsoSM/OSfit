package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.LogroPersonalOtorgado
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class LogroPersonalRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val catalogo = db.collection("logrosPersonales")
    private fun otorgadosCollection(clienteId: String) =
        db.collection("clientes").document(clienteId).collection("logrosPersonales")

    fun observarCatalogo(): Flow<List<LogroPersonalCatalogo>> = callbackFlow {
        val registro = catalogo.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val logros = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(LogroPersonalCatalogo::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(logros.sortedBy { it.nombre.lowercase() })
        }
        awaitClose { registro.remove() }
    }

    /** [logro.id] no puede estar vacío: quien llama lo genera con UUID antes de copiar la
     *  imagen a filesDir/logrosPersonales/<id>, mismo criterio que MedallaRepository. */
    suspend fun guardarLogro(logro: LogroPersonalCatalogo) {
        require(logro.id.isNotBlank()) { "LogroPersonalCatalogo.id no puede estar vacío al guardar" }
        catalogo.document(logro.id).set(logro.copy(id = "")).await()
    }

    /** Todos los logros personales son borrables: no hay categorías fijas como en medallas. */
    suspend fun eliminarLogro(logroId: String) {
        catalogo.document(logroId).delete().await()
    }

    /**
     * Ordena por `rangoInicio` descendente en Firestore y por `orden` ascendente **en memoria**:
     * encadenar dos `orderBy` obligaría a crear un índice compuesto en la consola de Firebase,
     * y la lista de logros de un cliente es chica de sobra para ordenarla acá.
     */
    fun observarOtorgados(clienteId: String): Flow<List<LogroPersonalOtorgado>> = callbackFlow {
        val registro = otorgadosCollection(clienteId)
            .orderBy("rangoInicio", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val otorgados = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(LogroPersonalOtorgado::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                // El comparador lleva las DOS claves: ordenar sólo por `orden` mezclaría
                // períodos (todos los orden=0 juntos, después todos los orden=1).
                trySend(
                    otorgados.sortedWith(
                        compareByDescending<LogroPersonalOtorgado> { it.rangoInicio }.thenBy { it.orden }
                    )
                )
            }
        awaitClose { registro.remove() }
    }

    /**
     * Reemplaza por completo los logros de [rangoInicio] para este cliente: primero borra los
     * que ya había en ese período, después escribe [logros], todo en un batch.
     *
     * El borrado previo es lo que hace la operación idempotente por quincena. MedallaRepository
     * consigue lo mismo gratis porque usa `rangoInicio` como doc id (un `set` pisa el anterior);
     * acá, con varios documentos por período, hay que limpiar a mano — si no, regenerar el video
     * de la misma quincena con otra selección dejaría huérfanos los logros de la anterior.
     *
     * Con [logros] vacío la operación se reduce a limpiar el período, que es el comportamiento
     * correcto para "esta quincena no le toca ningún logro".
     */
    suspend fun otorgarLogros(
        clienteId: String,
        rangoInicio: String,
        logros: List<LogroPersonalOtorgado>
    ) {
        val coleccion = otorgadosCollection(clienteId)
        val previos = coleccion.whereEqualTo("rangoInicio", rangoInicio).get().await()
        val batch = db.batch()
        previos.documents.forEach { batch.delete(it.reference) }
        logros.forEach { logro -> batch.set(coleccion.document(logro.id), logro.copy(id = "")) }
        batch.commit().await()
    }

    /** Quita un logro ya otorgado (p. ej. desde la pantalla del cliente, fuera del resumen). */
    suspend fun quitarLogro(clienteId: String, id: String) {
        otorgadosCollection(clienteId).document(id).delete().await()
    }
}
