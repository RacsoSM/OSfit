package com.osfit.app.video

import android.content.Context
import com.osfit.app.paletas.Paleta

internal object FabricaRendererVideo {
    fun crear(estilo: EstiloVideo, paleta: Paleta, context: Context): RendererVideo = when (estilo.id) {
        EstilosVideo.MANCU.id -> RendererMancu(context)
        else -> RendererBlobs(paleta)
    }
}
