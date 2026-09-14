package com.osfit.app.domain

import java.io.File

/**
 * Baja a un archivo temporal y recién al terminar lo mueve al destino.
 *
 * El criterio del restaurador para saber si un archivo está es `File.exists()`. Si la
 * transferencia se corta a mitad y los bytes parciales quedaron en el destino, ese archivo
 * truncado cuenta como "restaurado" para siempre: no se vuelve a intentar en el siguiente
 * arranque y el video sale sin música (el encoder toma la rama `archivoMusica.exists()`, el
 * transcodificado revienta y el fallback empaquetado vive en el `else`). Con el temporal, el
 * destino sólo llega a existir cuando el archivo está completo.
 *
 * [transferir] entra como parámetro —y no se llama a Storage acá— para que esta regla, que es
 * la que de verdad tiene filo, se pruebe con JUnit sin Firebase ni dispositivo.
 */
object DescargaAtomica {

    private const val SUFIJO_PARCIAL = ".parcial"

    suspend fun aArchivo(destino: File, transferir: suspend (File) -> Unit) {
        destino.parentFile?.mkdirs()
        val temporal = File(destino.parentFile, destino.name + SUFIJO_PARCIAL)
        try {
            transferir(temporal)
            if (!temporal.renameTo(destino)) {
                // Algunos sistemas de archivos no renombran encima de un archivo existente.
                destino.delete()
                check(temporal.renameTo(destino)) {
                    "No se pudo mover ${temporal.name} a ${destino.name}"
                }
            }
        } finally {
            // Si el rename salió bien el temporal ya no está y esto no hace nada. Si falló
            // —o si falló la transferencia— se va el parcial y el destino sigue faltando,
            // que es lo que hace que el siguiente arranque lo reintente solo.
            temporal.delete()
        }
    }
}
