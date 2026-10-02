package com.osfit.app.video

/** La mascota queda arriba del premio para conservar intacto su tamaño y el espacio de lectura. */
internal object ComposicionPremiosMancu {
    data class Mascota(val x: Float, val y: Float, val lado: Float)
    private val juntoAlPremio = Mascota(800f, 650f, 180f)
    private val entrePremios = Mascota(450f, 610f, 180f)
    fun mascota(cantidad: Int): Mascota = if (cantidad >= 3) entrePremios else juntoAlPremio
}
