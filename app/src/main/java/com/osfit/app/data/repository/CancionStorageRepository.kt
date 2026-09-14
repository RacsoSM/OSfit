package com.osfit.app.data.repository

import android.net.Uri
import com.google.firebase.storage.FirebaseStorage
import com.osfit.app.domain.DescargaAtomica
import java.io.File
import kotlinx.coroutines.tasks.await

/**
 * Respaldo de las canciones en `canciones/<nombreArchivo>`, donde el nombre ya es
 * `<clienteId>.<ext>`.
 *
 * Devuelve la RUTA y no la URL de descarga, al revés que las insignias. El motivo es el mismo
 * que con los resúmenes: la URL de descarga lleva su token dentro y vale sin sesión, así que
 * guardarla en el documento de la clienta la dejaría accesible a cualquiera que lo lea. La
 * ruta obliga a pasar por las reglas de Storage.
 */
class CancionStorageRepository(
    private val storage: FirebaseStorage = FirebaseStorage.getInstance()
) {
    /**
     * [clienteId] entra aunque el nombre del archivo ya lo contenga: deja la llamada legible
     * en el sitio donde se usa y hace evidente de quién es la canción que se sube.
     */
    suspend fun subir(clienteId: String, archivo: File): String {
        val ruta = "canciones/${archivo.name}"
        storage.reference.child(ruta).putFile(Uri.fromFile(archivo)).await()
        return ruta
    }

    /**
     * Baja la canción a [destino] pasando por un temporal (ver [DescargaAtomica]): una bajada
     * cortada no debe dejar un archivo truncado en la ruta buena, porque el restaurador lo
     * daría por restaurado para siempre.
     */
    suspend fun bajar(ruta: String, destino: File) {
        DescargaAtomica.aArchivo(destino) { temporal ->
            storage.reference.child(ruta).getFile(temporal).await()
        }
    }
}
