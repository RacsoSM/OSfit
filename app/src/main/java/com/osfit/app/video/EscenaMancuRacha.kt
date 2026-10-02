package com.osfit.app.video

internal class EscenaMancuRacha {
    private val pose = PoseMancu(Brazos.ESFUERZO, Ojos.FUERZA, Boca.DIENTES, sudor = true)
    private val celebracion = PoseMancu(Brazos.ORGULLO, Ojos.FELIZ, Boca.ABIERTA, sudor = true)
    private val hola = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.RachaMasLarga) {
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.RACHA_PREFIJO, ctx.elapsedMs, 0, 300,
            540f, 360f, 56f, esTitulo = true, color = PaletaMancu.TINTA)
        val t = ctx.elapsedMs
        // El golpe de escritura (2200) tiene prioridad hasta el siguiente fondo (3000).
        val ultimoFondo = if (t < 600L) Long.MIN_VALUE else
            600L + ((minOf(t, 3499L) - 600L) / 1200L) * 1200L
        val golpe = if (t >= 2200L) maxOf(2200L, ultimoFondo) else ultimoFondo
        ctx.textos.bloqueMaquina(ctx.canvas, TextosEscena.rachaDias(escena.dias), t, 300, 1900,
            540f, 490f, 100f, esTitulo = true, color = PaletaMancu.ROJO, golpeMs = golpe)
        if (t < 3500L) {
            val sy = 1f - 0.18f * MancuAnimacion.sentadillaAnticipada(t)
            ctx.actor.colocar(230f, 800f, 620f, pose, escalaX = 1f / sy, escalaY = sy)
        } else {
            val salto = t - 3500L
            val sy = MancuAnimacion.escalaYSalto(salto)
            val actuacion = if (salto <= 900L) celebracion.copy(confeti = escena.ranking.puesto == 1)
                else hola.copy(ondeo = MancuAnimacion.ondeoBrazo(t))
            ctx.actor.colocar(230f, 800f - 220f * MancuAnimacion.alturaSalto(salto), 620f,
                actuacion, escalaX = 1f / sy, escalaY = sy)
        }
        ctx.textos.bloqueMaquina(ctx.canvas,
            TextosEscena.comparacion(escena.ranking, TextosEscena.RACHA_PRIMERO, TextosEscena.RACHA_LUGAR),
            ctx.elapsedMs, 2600, 600, 540f, 1500f, 48f)
    }
}
