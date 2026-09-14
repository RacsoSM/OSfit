package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.osfit.app.paletas.Paleta
import com.osfit.app.paletas.camposFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * La paleta de la página web de una clienta, guardada en su propio documento.
 *
 * Va ahí y no en una colección aparte porque la web ya observa ese documento (`observarCliente`
 * en web/src/datos.ts): no hace falta un listener nuevo, ni una lectura extra, ni una regla de
 * Firestore — `clientes/{cid}` ya deja a la clienta leer lo suyo.
 */
class PaletaWebRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val clientes = db.collection("clientes")

    /** Sólo el id: es lo único que la pantalla necesita para marcar cuál está seleccionada.
     *  Los hex que viajan junto a él son para la web, no para la app. */
    fun observarPaletaId(clienteId: String): Flow<String?> = callbackFlow {
        val registro = clientes.document(clienteId).addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            @Suppress("UNCHECKED_CAST")
            val paleta = snapshot?.get("paletaWeb") as? Map<String, Any>
            trySend(paleta?.get("id") as? String)
        }
        awaitClose { registro.remove() }
    }

    /** `merge` y no `set` a secas: el documento de la clienta tiene todo lo demás —nombre,
     *  rutina, música— y un set completo lo borraría. */
    suspend fun guardar(clienteId: String, paleta: Paleta) {
        clientes.document(clienteId)
            .set(mapOf("paletaWeb" to camposFirestore(paleta)), SetOptions.merge())
            .await()
    }
}
