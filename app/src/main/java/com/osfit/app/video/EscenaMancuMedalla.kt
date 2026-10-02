package com.osfit.app.video

/**
 * PROVISIONAL: se reemplaza en la tarea correspondiente del plan
 */
internal class EscenaMancuMedalla {
    private val pose = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)

    @Suppress("UNUSED_PARAMETER")
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Medalla) {
        ctx.textos.tituloAjustado(ctx.canvas, "Medalla", ctx.ancho / 2f, 520f,
            120f, ctx.ancho - 120f)
        ctx.mancu.dibujar(ctx.canvas, (ctx.ancho - 620f) / 2f, 800f,
            620f, pose, ctx.elapsedMs)
    }
}
