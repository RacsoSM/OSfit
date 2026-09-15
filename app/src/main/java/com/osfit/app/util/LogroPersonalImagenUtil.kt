package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import com.osfit.app.R
import com.osfit.app.data.model.LogroPersonalCatalogo
import java.io.File

/** Fachada sobre [InsigniaImagenUtil] para la carpeta de logros personales. */
object LogroPersonalImagenUtil {

    private val delegado = InsigniaImagenUtil("logrosPersonales")

    fun carpetaLogros(context: Context): File = delegado.carpetaImagenes(context)

    fun archivoImagen(context: Context, nombreArchivo: String): File =
        delegado.archivoImagen(context, nombreArchivo)

    fun copiarImagen(context: Context, uri: Uri, logroId: String): String? =
        delegado.copiarImagen(context, uri, logroId)

    fun eliminarImagen(context: Context, nombreArchivo: String) =
        delegado.eliminarImagen(context, nombreArchivo)

    /**
     * Imagen del logro: la que subió el trainer y, si no tiene una (o su archivo ya no está),
     * la de por defecto empaquetada en el APK. Sólo devuelve null si ni siquiera esa se pudo
     * decodificar, caso en el que quien llama dibuja su ícono de respaldo.
     */
    fun cargarBitmapPropio(context: Context, logro: LogroPersonalCatalogo): Bitmap? =
        delegado.cargarBitmap(context, logro.imagenArchivo)
            ?: delegado.cargarBitmapDeRecurso(context, R.drawable.logro_personal_default)
}

