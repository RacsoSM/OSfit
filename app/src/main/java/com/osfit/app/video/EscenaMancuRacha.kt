package com.osfit.app.video

internal class EscenaMancuRacha {
    private val pose = PoseMancu(Brazos.ESFUERZO, Ojos.FUERZA, Boca.DIENTES, sudor = true)
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.RachaMasLarga) {
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.RACHA_PREFIJO, ctx.elapsedMs, 0, 300,
            540f, 360f, 56f, esTitulo = true, color = PaletaMancu.TINTA)
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.rachaDias(escena.dias), ctx.elapsedMs, 300, 1900,
            540f, 490f, 100f, esTitulo = true, color = PaletaMancu.ROJO)
        val profundidad = GeometriaMancu.sentadilla(ctx.elapsedMs)
        val sy = 1f - 0.18f * profundidad
        ctx.actor.colocar(230f, 800f + 24.8f * (1f - sy), 620f, pose,
            escalaX = 1f / sy, escalaY = sy)
        ctx.textos.bloqueMaquina(ctx.canvas,
            TextosEscena.comparacion(escena.ranking, TextosEscena.RACHA_PRIMERO, TextosEscena.RACHA_LUGAR),
            ctx.elapsedMs, 2600, 600, 540f, 1500f, 48f)
    }
}
