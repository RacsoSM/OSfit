package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.video.PaletaVideo
import com.osfit.app.video.PaletasVideo
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class ConfigVideoRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val configs = db.collection("configVideo")

    /** rangoInicio -> paletaId, de todos los periodos configurados. Lo consume la pantalla de
     *  configuración, que muestra muchos periodos a la vez. */
    fun observarTodas(): Flow<Map<String, String>> = callbackFlow {
        val registro = configs.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val porPeriodo = snapshot?.documents.orEmpty().mapNotNull { doc ->
                doc.getString("paletaId")?.let { doc.id to it }
            }.toMap()
            trySend(porPeriodo)
        }
        awaitClose { registro.remove() }
    }

    /**
     * Lectura puntual para generar un video. Nunca falla: un periodo sin configurar —o con un
     * preset que ya no existe en el código— cae en la paleta por defecto, que son los colores
     * originales del video.
     */
    suspend fun paletaDe(rangoInicio: String): PaletaVideo {
        val id = runCatching {
            configs.document(rangoInicio).get().await().getString("paletaId")
        }.getOrNull()
        return PaletasVideo.porId(id)
    }

    /** Upsert por periodo: el id del documento es el rangoInicio, así que reasignar la paleta
     *  de una quincena pisa la anterior en vez de acumular documentos. */
    suspend fun guardar(rangoInicio: String, paletaId: String) {
        configs.document(rangoInicio).set(mapOf("paletaId" to paletaId)).await()
    }
}
