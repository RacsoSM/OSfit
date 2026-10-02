package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.osfit.app.paletas.Paleta
import com.osfit.app.paletas.Paletas
import com.osfit.app.video.EstiloVideo
import com.osfit.app.video.EstilosVideo
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

data class ConfigVideoGuardada(val paletaId: String?, val estiloId: String?)

data class ConfigVideoResuelta(val paleta: Paleta, val estilo: EstiloVideo) {
    companion object {
        fun desde(guardada: ConfigVideoGuardada?) = ConfigVideoResuelta(
            paleta = Paletas.porIdVideo(guardada?.paletaId),
            estilo = EstilosVideo.porId(guardada?.estiloId)
        )
    }
}

class ConfigVideoRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val configs = db.collection("configVideo")

    /** rangoInicio -> configuración, de todos los periodos configurados. Lo consume la pantalla de
     *  configuración, que muestra muchos periodos a la vez. */
    fun observarTodas(): Flow<Map<String, ConfigVideoGuardada>> = callbackFlow {
        val registro = configs.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val porPeriodo = snapshot?.documents.orEmpty().associate { doc ->
                doc.id to ConfigVideoGuardada(doc.getString("paletaId"), doc.getString("estiloId"))
            }
            trySend(porPeriodo)
        }
        awaitClose { registro.remove() }
    }

    /**
     * Lectura puntual para generar un video. Nunca falla: un periodo sin configurar —o con un
     * preset que ya no existe en el código— cae en los valores originales del video.
     */
    suspend fun configDe(rangoInicio: String): ConfigVideoResuelta {
        val guardada = runCatching {
            val doc = configs.document(rangoInicio).get().await()
            ConfigVideoGuardada(doc.getString("paletaId"), doc.getString("estiloId"))
        }.getOrNull()
        return ConfigVideoResuelta.desde(guardada)
    }

    // Merge conserva la otra elección: cambiar paleta no debe borrar el estilo ni viceversa.
    suspend fun guardarPaleta(rangoInicio: String, paletaId: String) {
        configs.document(rangoInicio).set(mapOf("paletaId" to paletaId), SetOptions.merge()).await()
    }

    suspend fun guardarEstilo(rangoInicio: String, estiloId: String) {
        configs.document(rangoInicio).set(mapOf("estiloId" to estiloId), SetOptions.merge()).await()
    }
}
