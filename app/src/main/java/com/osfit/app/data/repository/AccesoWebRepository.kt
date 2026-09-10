package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.AccesoWeb
import java.security.SecureRandom
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class AccesoWebRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("accesosWeb")

    private companion object {
        // Sin caracteres ambiguos: el entrenador puede terminar dictando un link por teléfono.
        const val ALFABETO = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        const val LARGO_TOKEN = 32
    }

    /**
     * SecureRandom y no Random: este valor es la única credencial del cliente, así que tiene
     * que ser impredecible, no solo variado.
     */
    private fun generarToken(): String {
        val random = SecureRandom()
        return (1..LARGO_TOKEN)
            .map { ALFABETO[random.nextInt(ALFABETO.length)] }
            .joinToString("")
    }

    fun observarAcceso(clienteId: String): Flow<AccesoWeb?> = callbackFlow {
        val registro = coleccion.whereEqualTo("clienteId", clienteId).limit(1)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val doc = snapshot?.documents?.firstOrNull()
                trySend(doc?.toObject(AccesoWeb::class.java)?.copy(token = doc.id))
            }
        awaitClose { registro.remove() }
    }

    /** Crea el acceso si no existe y devuelve el token vigente. Idempotente. */
    suspend fun crearAcceso(clienteId: String): String {
        val existente = coleccion.whereEqualTo("clienteId", clienteId).limit(1).get().await()
        existente.documents.firstOrNull()?.let { return it.id }

        val token = generarToken()
        coleccion.document(token)
            .set(AccesoWeb(clienteId = clienteId).copy(token = ""))
            .await()
        return token
    }

    /** Revocar es borrar: no deja un secreto inerte que alguien pueda olvidar consultar. */
    suspend fun revocarAcceso(token: String) {
        coleccion.document(token).delete().await()
    }
}
