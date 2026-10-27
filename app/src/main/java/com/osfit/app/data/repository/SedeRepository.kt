package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/** Un gimnasio de `sedes/{id}` (ver `docs/sedes/`): solo lo que la app enseña al escogerlo. */
data class Sede(val id: String, val nombre: String)

/**
 * Las sedes. Las escribe el script `functions/scripts/cargarSedes.mjs` con sus factores; la app
 * solo las lista para asignarle a cada cliente la suya.
 */
class SedeRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    fun observarSedes(): Flow<List<Sede>> = callbackFlow {
        val registro = db.collection("sedes").addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            trySend(
                snapshot?.documents.orEmpty()
                    .map { Sede(it.id, it.getString("nombre") ?: it.id) }
                    .sortedBy { it.nombre }
            )
        }
        awaitClose { registro.remove() }
    }
}
