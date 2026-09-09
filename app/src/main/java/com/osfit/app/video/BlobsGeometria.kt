package com.osfit.app.video

data class Punto(val x: Float, val y: Float)

/**
 * [centroBaseX]/[centroBaseY]/[amplitudX]/[amplitudY]/[radio] son fracciones del ancho/alto
 * del canvas (0f..1f), no píxeles, para que el mismo blob se vea igual sin importar la
 * resolución exacta del frame.
 */
data class BlobSpec(
    val colorArgb: Int,
    val radio: Float,
    val centroBaseX: Float,
    val centroBaseY: Float,
    val amplitudX: Float,
    val amplitudY: Float,
    val periodoMs: Long,
    val faseMs: Long
)

/** Geometría pura y determinística de los blobs de fondo: sin Random, sin Android. */
object BlobsGeometria {
    /**
     * Geometría fija de los cuatro blobs; los colores los pone [paleta]. El primero y el
     * cuarto comparten matiz a propósito: repetir un tono ata la composición.
     *
     * Los radios son deliberadamente chicos (~0.17..0.24 del ancho): junto con el blur más
     * corto de [FondoBlobRenderer], es lo que hace que el fondo se lea como formas y no como
     * una nube difusa.
     */
    fun blobs(paleta: PaletaVideo): List<BlobSpec> = listOf(
        BlobSpec(colorArgb = paleta.blobA, radio = 0.23f, centroBaseX = 0.28f, centroBaseY = 0.22f, amplitudX = 0.10f, amplitudY = 0.07f, periodoMs = 11_000L, faseMs = 0L),
        BlobSpec(colorArgb = paleta.blobB, radio = 0.21f, centroBaseX = 0.74f, centroBaseY = 0.40f, amplitudX = 0.08f, amplitudY = 0.12f, periodoMs = 13_500L, faseMs = 2_500L),
        BlobSpec(colorArgb = paleta.blobC, radio = 0.24f, centroBaseX = 0.42f, centroBaseY = 0.72f, amplitudX = 0.12f, amplitudY = 0.09f, periodoMs = 9_500L, faseMs = 5_000L),
        BlobSpec(colorArgb = paleta.blobA, radio = 0.17f, centroBaseX = 0.80f, centroBaseY = 0.85f, amplitudX = 0.09f, amplitudY = 0.10f, periodoMs = 15_000L, faseMs = 8_000L)
    )

    /** Centro del blob (fracción del canvas) en el instante [tiempoGlobalMs]. */
    fun posicionEn(blob: BlobSpec, tiempoGlobalMs: Long): Punto {
        val angulo = 2.0 * Math.PI * (tiempoGlobalMs + blob.faseMs) / blob.periodoMs
        val x = blob.centroBaseX + blob.amplitudX * kotlin.math.sin(angulo)
        val y = blob.centroBaseY + blob.amplitudY * kotlin.math.cos(angulo)
        return Punto(x.toFloat(), y.toFloat())
    }
}
