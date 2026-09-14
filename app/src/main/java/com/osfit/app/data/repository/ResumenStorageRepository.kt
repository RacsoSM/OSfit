package com.osfit.app.data.repository

import android.net.Uri
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await
import java.io.File

/** Sube y borra los videos quincenales en Storage, bajo `resumenes/<clienteId>/<rangoInicio>.mp4`. */
class ResumenStorageRepository(
    private val storage: FirebaseStorage = FirebaseStorage.getInstance()
) {
    /**
     * Sube el video del resumen y devuelve su ruta en Storage (no la URL de descarga): la web
     * resuelve esa ruta bajo sesión del cliente, para no dejar un enlace permanente y sin
     * autenticación a un video de alguien dando vueltas en el documento.
     */
    suspend fun subir(clienteId: String, rangoInicio: String, archivo: File): String {
        val ruta = ruta(clienteId, rangoInicio)
        storage.reference.child(ruta).putFile(Uri.fromFile(archivo)).await()
        // Se devuelve la ruta armada acá y no `referencia.path`: el SDK puede anteponerle un
        // slash ("/resumenes/...") y la web hace `ref(storage, rutaStorage)` con este string
        // tal cual, que con slash inicial no resuelve el mismo objeto.
        return ruta
    }

    /** Borra el blob del resumen; el documento en Firestore se borra aparte, en `VideoPublicadoRepository`. */
    suspend fun borrar(clienteId: String, rangoInicio: String) {
        storage.reference.child(ruta(clienteId, rangoInicio)).delete().await()
    }

    private fun ruta(clienteId: String, rangoInicio: String) = "resumenes/$clienteId/$rangoInicio.mp4"
}
