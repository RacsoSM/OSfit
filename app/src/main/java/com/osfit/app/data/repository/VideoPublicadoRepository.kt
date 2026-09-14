package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.VideoPublicado
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Solo Firestore, en `clientes/{clienteId}/videos`: subir y borrar el mp4 en Storage vive
 * aparte, en `ResumenStorageRepository`, porque el documento y el blob tienen ciclos de vida
 * distintos (p. ej. borrar el registro después de que el blob ya se borró, o un test que
 * ejercita solo el listado sin necesitar Storage).
 */
class VideoPublicadoRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private fun videosCollection(clienteId: String) =
        db.collection("clientes").document(clienteId).collection("videos")

    fun observarDe(clienteId: String): Flow<List<VideoPublicado>> = callbackFlow {
        val registro = videosCollection(clienteId)
            .orderBy("rangoInicio", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val videos = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(VideoPublicado::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(videos)
            }
        awaitClose { registro.remove() }
    }

    /**
     * El id del documento es `rangoInicio` en vez de uno autogenerado: así republicar la
     * misma quincena pisa el registro anterior en lugar de duplicarlo, de ahí que esto sea
     * un `.set()` (upsert) y no un `.add()`.
     */
    suspend fun publicar(clienteId: String, video: VideoPublicado) {
        videosCollection(clienteId).document(video.rangoInicio).set(video.copy(id = "")).await()
    }

    suspend fun borrar(clienteId: String, rangoInicio: String) {
        videosCollection(clienteId).document(rangoInicio).delete().await()
    }
}
