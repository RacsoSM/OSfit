package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import com.osfit.app.data.model.MedallaCatalogo
import java.io.File

/**
 * Copia la imagen elegida por el trainer a almacenamiento interno de la app (mismo motivo que
 * [CancionUtil]: un content:// puede perder su permiso de lectura al reiniciar el proceso o si
 * el trainer borra el archivo de su galería).
 */
object MedallaImagenUtil {

    private const val CARPETA = "medallas"

    fun carpetaMedallas(context: Context): File =
        File(context.filesDir, CARPETA).apply { mkdirs() }

    fun archivoImagen(context: Context, nombreArchivo: String): File =
        File(carpetaMedallas(context), nombreArchivo)

    /** Copia el contenido de [uri] a `filesDir/medallas/<medallaId>.<ext>` y devuelve el
     *  nombre de archivo resultante, o null si no se pudo leer/copiar. */
    fun copiarImagen(context: Context, uri: Uri, medallaId: String): String? {
        val extension = extensionDe(context, uri) ?: "jpg"
        val destino = File(carpetaMedallas(context), "$medallaId.$extension")
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

    /** Bitmap de la imagen propia de [medalla], o null si no tiene una (medalla automática
     *  sin imagen personalizada, o subjetiva sin imagen): en ese caso quien llama dibuja una
     *  insignia/ícono por defecto en su lugar (ver ResumenFrameRenderer, Task 7). */
    fun cargarBitmapPropio(context: Context, medalla: MedallaCatalogo): Bitmap? {
        val archivo = medalla.imagenArchivo ?: return null
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
