package com.osfit.app.video

/** Ritmo propio del estilo, sin alterar las duraciones base del contenido. */
data class RitmoVideo(
    val ventanaTransicionMs: Long = 600L,
    val extraMs: (EscenaResumen) -> Long = { 0L }
) {
    companion object { val ESTANDAR = RitmoVideo() }
}

object RitmosVideo {
    val MANCU = RitmoVideo(ventanaTransicionMs = 1000L, extraMs = { escena ->
        when (escena) {
            is EscenaResumen.Despedida -> 1500L
            else -> 1000L
        }
    })
}
