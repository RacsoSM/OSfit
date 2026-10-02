package com.osfit.app.video

internal class EscenaMancuRacha {
    private val pose = PoseMancu(Brazos.ESFUERZO, Ojos.FUERZA, Boca.DIENTES, sudor = true)
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.RachaMasLarga) {
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.RACHA_PREFIJO, ctx.elapsedMs, 0, 300,
            540f, 360f, 56f, esTitulo = true, color = PaletaMancu.TINTA)
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.rachaDias(escena.dias), ctx.elapsedMs, 300, 1900,
            540f, 490f, 100f, esTitulo = true, color = PaletaMancu.ROJO)
        val guardado = ctx.canvas.save()
        ctx.canvas.translate(540f, 1420f)
        val profundidad = GeometriaMancu.sentadilla(ctx.elapsedMs)
        val sy = 1f - 0.18f * profundidad
        ctx.canvas.scale(1f / sy, sy)
        ctx.mancu.dibujar(ctx.canvas, -310f, -620f, 620f, pose, ctx.elapsedMs)
        ctx.canvas.restoreToCount(guardado)
        ctx.textos.bloqueMaquina(ctx.canvas,
            TextosEscena.comparacion(escena.ranking, TextosEscena.RACHA_PRIMERO, TextosEscena.RACHA_LUGAR),
            ctx.elapsedMs, 2600, 600, 540f, 1500f, 48f)
    }
}
