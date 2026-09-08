package com.osfit.app.util

/**
 * Geometría pura del encaje de una insignia en su cuadrado de salida. Vive aparte de
 * [InsigniaImagenUtil] —y sin importar nada de Android— para poder testearse en JVM: el resto
 * del manejo de imágenes usa Bitmap/Canvas y sólo se verifica en dispositivo.
 */
object EncajeInsignia {

    /** Dónde va la imagen dentro del cuadrado de salida, en píxeles. */
    data class Encaje(val izquierda: Float, val arriba: Float, val ancho: Float, val alto: Float)

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
