package com.osfit.app.data.repository

import android.net.Uri
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await
import java.io.File

/**
 * Sube las insignias del catálogo a Storage, bajo `insignias/<carpeta>/<id>.png`.
 * `carpeta` es "medallas" o "logrosPersonales".
 */
class InsigniaStorageRepository(
    private val storage: FirebaseStorage = FirebaseStorage.getInstance()
) {
    /**
     * Devuelve la URL de descarga y no la ruta porque la página pinta las insignias con un
     * `<img src>` pelado, sin cargar el SDK de Storage. Que esa URL lleve el token dentro y
     * funcione sin sesión no molesta: el catálogo de insignias no es dato personal. Con los
     * videos se hace al revés —se guarda la ruta y la web la resuelve— justamente porque ahí
     * un enlace permanente dentro del documento sí expondría el video de alguien.
     */
    suspend fun subir(carpeta: String, id: String, archivo: File): String {
        val referencia = storage.reference.child("insignias/$carpeta/$id.png")
        referencia.putFile(Uri.fromFile(archivo)).await()
        return referencia.downloadUrl.await().toString()
    }
}
