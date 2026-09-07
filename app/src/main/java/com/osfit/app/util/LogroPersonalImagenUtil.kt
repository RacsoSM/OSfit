package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
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

    fun cargarBitmapPropio(context: Context, logro: LogroPersonalCatalogo): Bitmap? =
        delegado.cargarBitmap(context, logro.imagenArchivo)
}

