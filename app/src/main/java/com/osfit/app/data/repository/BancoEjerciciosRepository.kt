package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.osfit.app.data.model.EjercicioBanco
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * El banco de ejercicios y la configuración de los grupos del grid de Registro de la web.
 * Ver [com.osfit.app.domain.GruposEjercicio].
 */
class BancoEjerciciosRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val ejercicios = db.collection("ejercicios")
    private val config = db.collection("configEjercicios").document("grupos")

    fun observarBanco(): Flow<List<EjercicioBanco>> = callbackFlow {
        val registro = ejercicios.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            trySend(snapshot?.documents.orEmpty().mapNotNull { doc ->
                doc.toObject(EjercicioBanco::class.java)?.copy(id = doc.id)
            })
        }
        awaitClose { registro.remove() }
    }

    /** grupo → ids en orden. Null si todavía no se configura ningún grupo. */
    fun observarConfig(): Flow<Map<String, List<String>>?> = callbackFlow {
        val registro = config.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val porGrupo = snapshot?.get("porGrupo") as? Map<*, *>
            trySend(porGrupo?.entries?.associate { (grupo, ids) ->
                grupo.toString() to (ids as? List<*>).orEmpty().map { it.toString() }
            })
        }
        awaitClose { registro.remove() }
    }

    /**
     * Guarda la lista de UN grupo. Con `merge` sobre el mapa anidado solo se reemplaza la llave
     * de ese grupo: los demás se quedan como estaban (configurados o usando el banco).
     */
    suspend fun guardarGrupo(grupo: String, ids: List<String>) {
        config.set(mapOf("porGrupo" to mapOf(grupo to ids)), SetOptions.merge()).await()
    }

    /** Vuelve el grupo a "los del banco": borra su llave en vez de guardar una lista. */
    suspend fun restablecerGrupo(grupo: String) {
        config.update("porGrupo.$grupo", com.google.firebase.firestore.FieldValue.delete()).await()
    }
}
