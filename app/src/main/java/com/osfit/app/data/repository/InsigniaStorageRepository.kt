package com.osfit.app.data.repository

import android.net.Uri
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await
import java.io.File

/** Sube las insignias del catálogo a Storage, bajo `insignias/<carpeta>/<id>.png`. */
class InsigniaStorageRepository(
    private val storage: FirebaseStorage = FirebaseStorage.getInstance()
) {
    /** Sube la insignia de una medalla del catálogo y devuelve su URL de descarga. */
    suspend fun subirMedalla(id: String, archivo: File): String = subir("medallas", id, archivo)

    /** Sube la insignia de un logro personal del catálogo y devuelve su URL de descarga. */
    suspend fun subirLogro(id: String, archivo: File): String = subir("logrosPersonales", id, archivo)

    /**
     * Baja una insignia del catálogo a [destino]. La ruta la arma quien llama con el id y la
     * carpeta (ver `ArchivosQueFaltan.esperadosDe`), no se saca de `imagenUrl`.
     */
    suspend fun bajar(ruta: String, destino: File) {
        destino.parentFile?.mkdirs()
        storage.reference.child(ruta).getFile(destino).await()
    }

    /**
     * Devuelve la URL de descarga y no la ruta porque la página pinta las insignias con un
     * `<img src>` pelado, sin cargar el SDK de Storage. Que esa URL lleve el token dentro y
     * funcione sin sesión no molesta: el catálogo de insignias no es dato personal. Con los
     * videos se hace al revés —se guarda la ruta y la web la resuelve— justamente porque ahí
     * un enlace permanente dentro del documento sí expondría el video de alguien.
     *
     * Privada y con la carpeta fijada por los dos métodos de arriba: como texto libre, un typo
     * no daba error de compilación y dejaba el blob en una carpeta inventada.
     */
    private suspend fun subir(carpeta: String, id: String, archivo: File): String {
        val referencia = storage.reference.child("insignias/$carpeta/$id.png")
        referencia.putFile(Uri.fromFile(archivo)).await()
        return referencia.downloadUrl.await().toString()
    }
}
