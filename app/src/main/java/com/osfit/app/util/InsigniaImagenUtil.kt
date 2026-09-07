package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import java.io.File

/**
 * Copia la imagen elegida por el trainer a almacenamiento interno de la app (mismo motivo que
 * [CancionUtil]: un content:// puede perder su permiso de lectura al reiniciar el proceso o si
 * el trainer borra el archivo de su galería).
 *
 * Parametrizado por [carpeta] para que medallas y logros personales compartan el código sin
 * pisarse los archivos: cada uno vive en su propio subdirectorio de filesDir.
 */
class InsigniaImagenUtil(private val carpeta: String) {

    fun carpetaImagenes(context: Context): File =
        File(context.filesDir, carpeta).apply { mkdirs() }

    fun archivoImagen(context: Context, nombreArchivo: String): File =
        File(carpetaImagenes(context), nombreArchivo)

    /** Copia el contenido de [uri] a `filesDir/<carpeta>/<insigniaId>.<ext>` y devuelve el
     *  nombre de archivo resultante, o null si no se pudo leer/copiar. */
    fun copiarImagen(context: Context, uri: Uri, insigniaId: String): String? {
        val extension = extensionDe(context, uri) ?: "jpg"
        val destino = File(carpetaImagenes(context), "$insigniaId.$extension")
        return runCatching {
            context.contentResolver.openInputStream(uri)?.use { entrada ->
                destino.outputStream().use { salida -> entrada.copyTo(salida) }
            } ?: return null
            destino.name
        }.getOrNull()
    }

    fun eliminarImagen(context: Context, nombreArchivo: String) {
        runCatching { archivoImagen(context, nombreArchivo).delete() }
    }

    /** Bitmap del archivo propio de la insignia, o null si no tiene uno: en ese caso quien
     *  llama dibuja una insignia/ícono por defecto en su lugar. */
    fun cargarBitmap(context: Context, imagenArchivo: String?): Bitmap? {
        val archivo = imagenArchivo ?: return null
        return runCatching { BitmapFactory.decodeFile(archivoImagen(context, archivo).absolutePath) }.getOrNull()
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

