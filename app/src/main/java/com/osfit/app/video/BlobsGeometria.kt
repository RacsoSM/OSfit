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
    // Tonos apagados y semitransparentes a propósito: los blobs son fondo, no protagonistas.
    // Se conservan los tres matices originales (magenta / cian / púrpura) pero bajados de
    // brillo (~55%) y con alfa parcial, para que el texto blanco y el dato en verde sigan
    // siendo lo que más resalta en pantalla.
    private const val MAGENTA = 0xB37B1575.toInt()
    private const val CIAN = 0xB3157B7B.toInt()
    private const val PURPURA = 0xB34C157B.toInt()

    val blobs: List<BlobSpec> = listOf(
        BlobSpec(colorArgb = MAGENTA, radio = 0.32f, centroBaseX = 0.28f, centroBaseY = 0.22f, amplitudX = 0.10f, amplitudY = 0.07f, periodoMs = 11_000L, faseMs = 0L),
        BlobSpec(colorArgb = CIAN, radio = 0.30f, centroBaseX = 0.74f, centroBaseY = 0.40f, amplitudX = 0.08f, amplitudY = 0.12f, periodoMs = 13_500L, faseMs = 2_500L),
        BlobSpec(colorArgb = PURPURA, radio = 0.34f, centroBaseX = 0.42f, centroBaseY = 0.72f, amplitudX = 0.12f, amplitudY = 0.09f, periodoMs = 9_500L, faseMs = 5_000L),
        BlobSpec(colorArgb = MAGENTA, radio = 0.24f, centroBaseX = 0.80f, centroBaseY = 0.85f, amplitudX = 0.09f, amplitudY = 0.10f, periodoMs = 15_000L, faseMs = 8_000L)
    )

    /** Centro del blob (fracción del canvas) en el instante [tiempoGlobalMs]. */
    fun posicionEn(blob: BlobSpec, tiempoGlobalMs: Long): Punto {
        val angulo = 2.0 * Math.PI * (tiempoGlobalMs + blob.faseMs) / blob.periodoMs
        val x = blob.centroBaseX + blob.amplitudX * kotlin.math.sin(angulo)
        val y = blob.centroBaseY + blob.amplitudY * kotlin.math.cos(angulo)
        return Punto(x.toFloat(), y.toFloat())
    }
}
