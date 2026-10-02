package com.osfit.app.video

import com.osfit.app.domain.TipoResumen

/** En Firestore solo se guarda el id: cada estilo y su renderer viven en el código. */
data class EstiloVideo(
    val id: String,
    val nombre: String,
    val descripcion: String,
    val usaPaleta: Boolean,
    val ritmo: RitmoVideo
)

object EstilosVideo {
    val BLOBS = EstiloVideo("blobs", "Blobs", "Fondo oscuro con blobs de color", usaPaleta = true, ritmo = RitmoVideo.ESTANDAR)
    val MANCU = EstiloVideo("mancu", "Mancu", "Papel crema y la mascota Mancu", usaPaleta = false, ritmo = RitmosVideo.MANCU)
    val disponibles: List<EstiloVideo> = listOf(BLOBS, MANCU)

    fun porId(id: String?): EstiloVideo = disponibles.firstOrNull { it.id == id } ?: BLOBS

    // El inicio mensual puede coincidir con una quincena: no debe heredar su estilo.
    fun paraResumen(tipo: TipoResumen, configurado: EstiloVideo): EstiloVideo =
        if (tipo == TipoResumen.QUINCENAL) configurado else BLOBS
}
