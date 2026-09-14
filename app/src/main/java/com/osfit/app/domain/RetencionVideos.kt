package com.osfit.app.domain

import com.osfit.app.data.model.VideoPublicado

/**
 * Decide qué videos publicados sobran cuando se publica uno nuevo: la página de la clienta
 * muestra los últimos [MAXIMO] y el resto se borra.
 *
 * Vive acá y no dentro del ViewModel para que la regla sea una función pura y pueda cubrirse
 * con tests (el proyecto sólo corre tests Kotlin de `domain/` y `video/`).
 */
object RetencionVideos {

    /** Cuántos videos se conservan por clienta; es lo que muestra la página web. */
    const val MAXIMO = 6

    /**
     * Los videos que sobran, del más viejo al más nuevo. Ordena por `rangoInicio` descendente
     * acá mismo en vez de confiar en el orden que traiga la lista: publicar acaba de agregar
     * uno y quien llame puede pasar la lista con el nuevo pegado al final.
     */
    fun sobrantes(videos: List<VideoPublicado>): List<VideoPublicado> =
        videos.sortedByDescending { it.rangoInicio }.drop(MAXIMO)
}
