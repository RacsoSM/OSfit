package com.osfit.app.video

import android.content.Context
import com.osfit.app.paletas.Paleta

internal object FabricaRendererVideo {
    @Suppress("UNUSED_PARAMETER")
    fun crear(estilo: EstiloVideo, paleta: Paleta, context: Context): RendererVideo = when (estilo.id) {
        // Un periodo configurado antes de terminar Mancu debe seguir pudiendo generar video.
        EstilosVideo.MANCU.id -> RendererBlobs(paleta)
        else -> RendererBlobs(paleta)
    }
}
