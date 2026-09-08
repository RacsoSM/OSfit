package com.osfit.app.util

/**
 * Geometría pura del encaje de una insignia en su cuadrado de salida. Vive aparte de
 * [InsigniaImagenUtil] —y sin importar nada de Android— para poder testearse en JVM: el resto
 * del manejo de imágenes usa Bitmap/Canvas y sólo se verifica en dispositivo.
 */
object EncajeInsignia {

    /** Dónde va la imagen dentro del cuadrado de salida, en píxeles. */
    data class Encaje(val izquierda: Float, val arriba: Float, val ancho: Float, val alto: Float)

    /** Caja delimitadora de los píxeles visibles (no transparentes). */
    data class BoundingBox(val minX: Int, val minY: Int, val maxX: Int, val maxY: Int) {
        val ancho: Int get() = maxX - minX + 1
        val alto: Int get() = maxY - minY + 1
    }

    /**
     * Encuentra los límites (bounding box) de los píxeles con canal alfa superior a [umbralAlfa].
     * Si la imagen es completamente transparente, devuelve null.
     */
    fun calcularBoundingBox(pixels: IntArray, ancho: Int, alto: Int, umbralAlfa: Int = 15): BoundingBox? {
        var minX = ancho
        var maxX = -1
        var minY = alto
        var maxY = -1
        for (y in 0 until alto) {
            val offsetFila = y * ancho
            for (x in 0 until ancho) {
                val alpha = (pixels[offsetFila + x] ushr 24) and 0xFF
                if (alpha > umbralAlfa) {
                    if (x < minX) minX = x
                    if (x > maxX) maxX = x
                    if (y < minY) minY = y
                    if (y > maxY) maxY = y
                }
            }
        }
        return if (maxX >= 0) BoundingBox(minX, minY, maxX, maxY) else null
    }

    /**
     * Escala [anchoOrigen]x[altoOrigen] hasta que el lado más largo mide [lado], y centra el
     * resultado: la proporción queda intacta y lo que sobra son franjas transparentes. Se
     * agranda también cuando el origen es más chico, para que una imagen pequeña no salga
     * diminuta en el video.
     */
    fun calcular(anchoOrigen: Int, altoOrigen: Int, lado: Int): Encaje {
        val escala = lado.toFloat() / maxOf(anchoOrigen, altoOrigen)
        val ancho = anchoOrigen * escala
        val alto = altoOrigen * escala
        return Encaje(
            izquierda = (lado - ancho) / 2f,
            arriba = (lado - alto) / 2f,
            ancho = ancho,
            alto = alto
        )
    }
}
