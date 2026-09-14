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
        val referencia = referencia(clienteId, rangoInicio)
        referencia.putFile(Uri.fromFile(archivo)).await()
        return referencia.path
    }

    /** Borra el blob del resumen; el documento en Firestore se borra aparte, en `VideoPublicadoRepository`. */
    suspend fun borrar(clienteId: String, rangoInicio: String) {
        referencia(clienteId, rangoInicio).delete().await()
    }

    private fun referencia(clienteId: String, rangoInicio: String) =
        storage.reference.child("resumenes/$clienteId/$rangoInicio.mp4")
}
