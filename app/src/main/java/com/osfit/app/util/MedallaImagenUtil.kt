package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import com.osfit.app.data.model.MedallaCatalogo
import java.io.File

/** Fachada sobre [InsigniaImagenUtil] para la carpeta de medallas. Su API pública no cambió
 *  al extraerse el cuerpo: los llamadores existentes siguen igual. */
object MedallaImagenUtil {

    private val delegado = InsigniaImagenUtil("medallas")

    fun carpetaMedallas(context: Context): File = delegado.carpetaImagenes(context)

    fun archivoImagen(context: Context, nombreArchivo: String): File =
        delegado.archivoImagen(context, nombreArchivo)

    fun copiarImagen(context: Context, uri: Uri, medallaId: String): String? =
        delegado.copiarImagen(context, uri, medallaId)

    fun eliminarImagen(context: Context, nombreArchivo: String) =
        delegado.eliminarImagen(context, nombreArchivo)

    fun cargarBitmapPropio(context: Context, medalla: MedallaCatalogo): Bitmap? =
        delegado.cargarBitmap(context, medalla.imagenArchivo)
}
