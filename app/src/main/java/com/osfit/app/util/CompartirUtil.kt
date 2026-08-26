package com.osfit.app.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File

object CompartirUtil {

    private const val AUTORIDAD_FILE_PROVIDER = "com.osfit.app.fileprovider"

    /** Comparte un video mp4 apuntando a WhatsApp; si no está instalado, cae al selector genérico. */
    fun compartirVideo(context: Context, video: File) {
        val uri = FileProvider.getUriForFile(context, AUTORIDAD_FILE_PROVIDER, video)
        val intentBase = Intent(Intent.ACTION_SEND).apply {
            type = "video/mp4"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            context.startActivity(Intent(intentBase).setPackage("com.whatsapp"))
        } catch (e: ActivityNotFoundException) {
            context.startActivity(Intent.createChooser(intentBase, "Compartir resumen"))
        }
    }
}
