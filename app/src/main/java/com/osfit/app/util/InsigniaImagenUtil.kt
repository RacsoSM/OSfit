package com.osfit.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
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

    /**
     * Normaliza la imagen de [uri] a un PNG cuadrado de [LADO_PX] en
     * `filesDir/<carpeta>/<insigniaId>.png` y devuelve el nombre resultante, o null si no se
     * pudo leer/decodificar.
     *
     * La imagen se encaja entera y centrada (ver [EncajeInsignia]), así que lo que sobra queda
     * transparente en vez de deformarse: el renderer del video dibuja la insignia en un
     * cuadrado, y antes estiraba cualquier proporción para llenarlo.
     *
     * Siempre PNG, aunque el original sea JPEG: las franjas necesitan canal alfa. Y siempre a
     * [LADO_PX], que además evita quedarse con los varios MB del archivo original en disco y
     * en memoria — el video decodifica esta imagen en cada frame de su escena.
     */
    fun copiarImagen(context: Context, uri: Uri, insigniaId: String): String? {
        val destino = File(carpetaImagenes(context), "$insigniaId.png")
        return runCatching {
            val original = decodificarAcotado(context, uri) ?: return null
            val cuadrado = encajarEnCuadrado(original)
            original.recycle()
            destino.outputStream().use { salida ->
                cuadrado.compress(Bitmap.CompressFormat.PNG, 100, salida)
            }
            cuadrado.recycle()
            destino.name
        }.getOrNull()
    }

    /** Decodifica bajando la resolución de entrada con [BitmapFactory.Options.inSampleSize]:
     *  una foto de cámara entera son decenas de MB en RAM y sólo necesitamos [LADO_PX]. */
    private fun decodificarAcotado(context: Context, uri: Uri): Bitmap? {
        val medidas = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, medidas) }
        val mayor = maxOf(medidas.outWidth, medidas.outHeight)
        if (mayor <= 0) return null

        val opciones = BitmapFactory.Options().apply {
            var muestra = 1
            while (mayor / (muestra * 2) >= LADO_PX) muestra *= 2
            inSampleSize = muestra
        }
        return context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, opciones)
        }
    }

    private fun encajarEnCuadrado(origen: Bitmap): Bitmap {
        val salida = Bitmap.createBitmap(LADO_PX, LADO_PX, Bitmap.Config.ARGB_8888)
        val encaje = EncajeInsignia.calcular(origen.width, origen.height, LADO_PX)
        Canvas(salida).drawBitmap(
            origen,
            null,
            RectF(
                encaje.izquierda,
                encaje.arriba,
                encaje.izquierda + encaje.ancho,
                encaje.arriba + encaje.alto
            ),
            Paint().apply { isAntiAlias = true; isFilterBitmap = true }
        )
        return salida
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

    private companion object {
        /** Holgado contra los 528 px de diámetro que dibuja el video en su layout más grande. */
        const val LADO_PX = 512
    }
}

