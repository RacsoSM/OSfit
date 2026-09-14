package com.osfit.app.paletas

/**
 * Una paleta de color de OSfit, compartida por los videos de resumen y por la página web de
 * cada clienta. Los presets son código, no datos — en Firestore sólo se guarda qué [id] usa
 * cada periodo (ConfigVideoRepository) y cuál usa cada clienta (PaletaWebRepository).
 *
 * Los cuatro primeros colores son del video. Los de blob llevan su alfa incluida (~70%): la
 * transparencia parcial es lo que los mantiene como fondo y no como protagonistas, así que es
 * propiedad del color, no del renderer. El [destacado], en cambio, va opaco: es el dato que la
 * clienta tiene que leer. Son tres matices y no cuatro aunque haya cuatro blobs en pantalla:
 * el primero y el cuarto comparten matiz (ver BlobsGeometria), y esa repetición es parte de la
 * composición.
 *
 * Los cuatro `web*` son propios y no derivados de los de video. Los blobs están calculados
 * para verse difuminados al 70% sobre negro; sacados de ahí y puestos en un texto, varios
 * quedan turbios o sin contraste. Van opacos, y PaletasTest verifica que cada uno mantenga
 * 4.5:1 contra el fondo de la página.
 */
data class Paleta(
    val id: String,
    val nombre: String,
    val blobA: Int,
    val blobB: Int,
    val blobC: Int,
    val destacado: Int,
    val webPrimario: Int,
    val webPrimarioOscuro: Int,
    val webPrimarioClaro: Int,
    val webSobrePrimario: Int
)

object Paletas {

    /** Los colores originales del video, antes de que las paletas existieran. Es la paleta que
     *  usa todo periodo sin configurar, así que la app sin tocar nada se ve igual que siempre. */
    private val AQUA_NOCHE = Paleta(
        id = "aqua_noche",
        nombre = "Aqua noche",
        blobA = 0xB37B1575.toInt(),
        blobB = 0xB3157B7B.toInt(),
        blobC = 0xB34C157B.toInt(),
        destacado = 0xFF00E6A8.toInt(),
        webPrimario = 0xFF3FE0B8.toInt(),
        webPrimarioOscuro = 0xFF0E6B57.toInt(),
        webPrimarioClaro = 0xFFC8FFEE.toInt(),
        webSobrePrimario = 0xFF03251C.toInt()
    )

    private val ATARDECER = Paleta(
        id = "atardecer",
        nombre = "Atardecer",
        blobA = 0xB3B35A15.toInt(),
        blobB = 0xB3B33A2E.toInt(),
        blobC = 0xB37B1F3A.toInt(),
        destacado = 0xFFFFC24D.toInt(),
        webPrimario = 0xFFFFB347.toInt(),
        webPrimarioOscuro = 0xFF8A3B12.toInt(),
        webPrimarioClaro = 0xFFFFE3B0.toInt(),
        webSobrePrimario = 0xFF2E1403.toInt()
    )

    private val BOSQUE = Paleta(
        id = "bosque",
        nombre = "Bosque",
        blobA = 0xB3156B3A.toInt(),
        blobB = 0xB3556B15.toInt(),
        blobC = 0xB3157B6B.toInt(),
        destacado = 0xFFB6E62E.toInt(),
        webPrimario = 0xFFA8E05A.toInt(),
        webPrimarioOscuro = 0xFF2F6B1E.toInt(),
        webPrimarioClaro = 0xFFE4F7C4.toInt(),
        webSobrePrimario = 0xFF12240A.toInt()
    )

    private val ULTRAVIOLETA = Paleta(
        id = "ultravioleta",
        nombre = "Ultravioleta",
        blobA = 0xB32E1F8A.toInt(),
        blobB = 0xB35E15A0.toInt(),
        blobC = 0xB3A0157B.toInt(),
        destacado = 0xFF3DE0FF.toInt(),
        webPrimario = 0xFF6FD8FF.toInt(),
        webPrimarioOscuro = 0xFF1B4E8A.toInt(),
        webPrimarioClaro = 0xFFD6F2FF.toInt(),
        webSobrePrimario = 0xFF041A26.toInt()
    )

    private val BRASA = Paleta(
        id = "brasa",
        nombre = "Brasa",
        blobA = 0xB38A1F15.toInt(),
        blobB = 0xB3B36A15.toInt(),
        blobC = 0xB35A2A15.toInt(),
        destacado = 0xFFFFD93D.toInt(),
        webPrimario = 0xFFFF8A5C.toInt(),
        webPrimarioOscuro = 0xFF8A2B15.toInt(),
        webPrimarioClaro = 0xFFFFD9C7.toInt(),
        webSobrePrimario = 0xFF2B0C04.toInt()
    )

    /** Los colores que la web tuvo siempre, ahora elegibles como cualquier otra paleta. Es el
     *  por defecto de la web: mientras lo sea, una clienta sin configurar se ve igual que
     *  antes de que esta pantalla existiera. */
    private val MORADO_OSFIT = Paleta(
        id = "morado_osfit",
        nombre = "Morado OSfit",
        blobA = 0xB36A1B9A.toInt(),
        blobB = 0xB34527A0.toInt(),
        blobC = 0xB38E24AA.toInt(),
        destacado = 0xFFC9A7FF.toInt(),
        webPrimario = 0xFFB388FF.toInt(),
        webPrimarioOscuro = 0xFF6A1B9A.toInt(),
        webPrimarioClaro = 0xFFE3D2FF.toInt(),
        webSobrePrimario = 0xFF2A0064.toInt()
    )

    private val CEREZA = Paleta(
        id = "cereza",
        nombre = "Cereza",
        blobA = 0xB38A1538.toInt(),
        blobB = 0xB3B31550.toInt(),
        blobC = 0xB35A1560.toInt(),
        destacado = 0xFFFF4D7E.toInt(),
        webPrimario = 0xFFFF6E9C.toInt(),
        webPrimarioOscuro = 0xFF8A123F.toInt(),
        webPrimarioClaro = 0xFFFFD1E0.toInt(),
        webSobrePrimario = 0xFF2B0413.toInt()
    )

    private val MENTA_FRIA = Paleta(
        id = "menta_fria",
        nombre = "Menta fría",
        blobA = 0xB315706B.toInt(),
        blobB = 0xB31F5A7B.toInt(),
        blobC = 0xB315805A.toInt(),
        destacado = 0xFF4DFFD2.toInt(),
        webPrimario = 0xFF5FE6C4.toInt(),
        webPrimarioOscuro = 0xFF0F5C50.toInt(),
        webPrimarioClaro = 0xFFCFFFF2.toInt(),
        webSobrePrimario = 0xFF04231D.toInt()
    )

    private val OCEANO = Paleta(
        id = "oceano",
        nombre = "Océano",
        blobA = 0xB3153A7B.toInt(),
        blobB = 0xB315588A.toInt(),
        blobC = 0xB31F2A6B.toInt(),
        destacado = 0xFF4DA8FF.toInt(),
        webPrimario = 0xFF6BB6FF.toInt(),
        webPrimarioOscuro = 0xFF123A75.toInt(),
        webPrimarioClaro = 0xFFD2E8FF.toInt(),
        webSobrePrimario = 0xFF04162B.toInt()
    )

    private val ARENA = Paleta(
        id = "arena",
        nombre = "Arena",
        blobA = 0xB38A6A2E.toInt(),
        blobB = 0xB37B5A15.toInt(),
        blobC = 0xB36B4A2E.toInt(),
        destacado = 0xFFFFD9A0.toInt(),
        webPrimario = 0xFFE8C28A.toInt(),
        webPrimarioOscuro = 0xFF6B4A1E.toInt(),
        webPrimarioClaro = 0xFFFAEBD4.toInt(),
        webSobrePrimario = 0xFF2B1D06.toInt()
    )

    private val NEON = Paleta(
        id = "neon",
        nombre = "Neón",
        blobA = 0xB3A0158A.toInt(),
        blobB = 0xB315809E.toInt(),
        blobC = 0xB36B15A0.toInt(),
        destacado = 0xFFFF3DD1.toInt(),
        webPrimario = 0xFFFF6FE0.toInt(),
        webPrimarioOscuro = 0xFF7B1268.toInt(),
        webPrimarioClaro = 0xFFFFD4F5.toInt(),
        webSobrePrimario = 0xFF2B0424.toInt()
    )

    private val BRUMA = Paleta(
        id = "bruma",
        nombre = "Bruma",
        blobA = 0xB33A4A5A.toInt(),
        blobB = 0xB32E3A4A.toInt(),
        blobC = 0xB34A5A6B.toInt(),
        destacado = 0xFFA8C4E0.toInt(),
        webPrimario = 0xFFA9C6E3.toInt(),
        webPrimarioOscuro = 0xFF37506B.toInt(),
        webPrimarioClaro = 0xFFE2EDF7.toInt(),
        webSobrePrimario = 0xFF0C1722.toInt()
    )

    private val VINO = Paleta(
        id = "vino",
        nombre = "Vino",
        blobA = 0xB35A153A.toInt(),
        blobB = 0xB37B1F2E.toInt(),
        blobC = 0xB33A1550.toInt(),
        destacado = 0xFFE06B8A.toInt(),
        webPrimario = 0xFFE58BA4.toInt(),
        webPrimarioOscuro = 0xFF5E1230.toInt(),
        webPrimarioClaro = 0xFFFADCE4.toInt(),
        webSobrePrimario = 0xFF260610.toInt()
    )

    private val LIMA = Paleta(
        id = "lima",
        nombre = "Lima",
        blobA = 0xB35A7B15.toInt(),
        blobB = 0xB32E7B3A.toInt(),
        blobC = 0xB37B9E15.toInt(),
        destacado = 0xFFD9FF4D.toInt(),
        webPrimario = 0xFFC6F24F.toInt(),
        webPrimarioOscuro = 0xFF4A6B12.toInt(),
        webPrimarioClaro = 0xFFEDFBC6.toInt(),
        webSobrePrimario = 0xFF1A2604.toInt()
    )

    private val COBRE = Paleta(
        id = "cobre",
        nombre = "Cobre",
        blobA = 0xB38A3A15.toInt(),
        blobB = 0xB3A05A15.toInt(),
        blobC = 0xB36B2E1F.toInt(),
        destacado = 0xFFFF9E5C.toInt(),
        webPrimario = 0xFFF0A46B.toInt(),
        webPrimarioOscuro = 0xFF6B3312.toInt(),
        webPrimarioClaro = 0xFFFBE0CB.toInt(),
        webSobrePrimario = 0xFF2B1204.toInt()
    )

    /** AQUA_NOCHE va primero porque es el por defecto del video y hay una prueba que lo exige;
     *  el resto va en el orden en que se fueron añadiendo. */
    val disponibles: List<Paleta> = listOf(
        AQUA_NOCHE, ATARDECER, BOSQUE, ULTRAVIOLETA, BRASA,
        MORADO_OSFIT, CEREZA, MENTA_FRIA, OCEANO, ARENA,
        NEON, BRUMA, VINO, LIMA, COBRE
    )

    /** Los colores originales del video: un periodo sin configurar se ve como siempre. */
    val porDefectoVideo: Paleta = AQUA_NOCHE

    /** Los colores originales de la web: una clienta sin configurar se ve como siempre.
     *  Distinto del de video a propósito — cada lado conserva el aspecto que ya tenía. */
    val porDefectoWeb: Paleta = MORADO_OSFIT

    /** Tolera ids nulos, vacíos y desconocidos: un periodo puede no estar configurado, o tener
     *  guardado un preset que después se quitó del código. */
    fun porIdVideo(id: String?): Paleta =
        disponibles.firstOrNull { it.id == id } ?: porDefectoVideo

    /** Igual que [porIdVideo] pero cayendo en el morado: una clienta sin paleta asignada tiene
     *  que ver la página de siempre, no el aqua de los videos. */
    fun porIdWeb(id: String?): Paleta =
        disponibles.firstOrNull { it.id == id } ?: porDefectoWeb
}
