package com.osfit.app.video

/**
 * Paleta de color de un video de resumen: los tres matices del fondo y el color del dato
 * destacado. Los presets son código, no datos — en Firestore sólo se guarda qué [id] usa
 * cada periodo (ver ConfigVideoRepository).
 *
 * Los colores de blob llevan su alfa incluida (~70%): la transparencia parcial es lo que los
 * mantiene como fondo y no como protagonistas, así que es propiedad del color, no del
 * renderer. El [destacado], en cambio, va opaco: es el dato que el cliente tiene que leer.
 *
 * Son tres matices y no cuatro aunque haya cuatro blobs en pantalla: el primero y el cuarto
 * comparten matiz (ver BlobsGeometria), y esa repetición es parte de la composición.
 */
data class PaletaVideo(
    val id: String,
    val nombre: String,
    val blobA: Int,
    val blobB: Int,
    val blobC: Int,
    val destacado: Int
)

object PaletasVideo {

    /** Los colores originales del video, antes de que las paletas existieran. Es la paleta que
     *  usa todo periodo sin configurar, así que la app sin tocar nada se ve igual que siempre. */
    private val AQUA_NOCHE = PaletaVideo(
        id = "aqua_noche",
        nombre = "Aqua noche",
        blobA = 0xB37B1575.toInt(),
        blobB = 0xB3157B7B.toInt(),
        blobC = 0xB34C157B.toInt(),
        destacado = 0xFF00E6A8.toInt()
    )

    private val ATARDECER = PaletaVideo(
        id = "atardecer",
        nombre = "Atardecer",
        blobA = 0xB3B35A15.toInt(),
        blobB = 0xB3B33A2E.toInt(),
        blobC = 0xB37B1F3A.toInt(),
        destacado = 0xFFFFC24D.toInt()
    )

    private val BOSQUE = PaletaVideo(
        id = "bosque",
        nombre = "Bosque",
        blobA = 0xB3156B3A.toInt(),
        blobB = 0xB3556B15.toInt(),
        blobC = 0xB3157B6B.toInt(),
        destacado = 0xFFB6E62E.toInt()
    )

    private val ULTRAVIOLETA = PaletaVideo(
        id = "ultravioleta",
        nombre = "Ultravioleta",
        blobA = 0xB32E1F8A.toInt(),
        blobB = 0xB35E15A0.toInt(),
        blobC = 0xB3A0157B.toInt(),
        destacado = 0xFF3DE0FF.toInt()
    )

    private val BRASA = PaletaVideo(
        id = "brasa",
        nombre = "Brasa",
        blobA = 0xB38A1F15.toInt(),
        blobB = 0xB3B36A15.toInt(),
        blobC = 0xB35A2A15.toInt(),
        destacado = 0xFFFFD93D.toInt()
    )

    val disponibles: List<PaletaVideo> = listOf(AQUA_NOCHE, ATARDECER, BOSQUE, ULTRAVIOLETA, BRASA)

    val porDefecto: PaletaVideo = AQUA_NOCHE

    /** Tolera ids nulos, vacíos y desconocidos: un periodo puede no estar configurado, o tener
     *  guardado un preset que después se quitó del código. */
    fun porId(id: String?): PaletaVideo =
        disponibles.firstOrNull { it.id == id } ?: porDefecto
}
