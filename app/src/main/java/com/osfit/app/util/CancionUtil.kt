package com.osfit.app.util

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import java.io.File

/**
 * Copia la canción elegida por el trainer a almacenamiento interno de la app, en vez de
 * quedarse solo con la URI original: un content:// puede perder su permiso de lectura al
 * reiniciar el proceso o si el trainer borra el archivo de su galería, y el video generado
 * después dejaría de tener música.
 */
object CancionUtil {

    private const val CARPETA = "canciones"

    fun carpetaCanciones(context: Context): File =
        File(context.filesDir, CARPETA).apply { mkdirs() }

    fun archivoCancion(context: Context, nombreArchivo: String): File =
        File(carpetaCanciones(context), nombreArchivo)

    /** Copia el contenido de [uri] a `filesDir/canciones/<clienteId>.<ext>` y devuelve el
     *  nombre de archivo resultante, o null si no se pudo leer/copiar. */
    fun copiarCancion(context: Context, uri: Uri, clienteId: String): String? {
        val extension = extensionDe(context, uri) ?: "mp3"
        val destino = File(carpetaCanciones(context), "$clienteId.$extension")
        return runCatching {
            context.contentResolver.openInputStream(uri)?.use { entrada ->
                destino.outputStream().use { salida -> entrada.copyTo(salida) }
            } ?: return null
            destino.name
        }.getOrNull()
    }

    fun eliminarCancion(context: Context, nombreArchivo: String) {
        runCatching { archivoCancion(context, nombreArchivo).delete() }
    }

    private fun extensionDe(context: Context, uri: Uri): String? {
        val tipoMime = context.contentResolver.getType(uri)
        val porMime = tipoMime?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
        if (porMime != null) return porMime

        val nombre = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val indice = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (indice >= 0 && cursor.moveToFirst()) cursor.getString(indice) else null
        }
        return nombre?.substringAfterLast('.', missingDelimiterValue = "")?.takeIf { it.isNotBlank() }
    }
}
