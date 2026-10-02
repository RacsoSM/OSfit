package com.osfit.app.video

internal class EscenaMancuSaludo {
    private val pose = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)
    private val celebracion = PoseMancu(Brazos.ORGULLO, Ojos.FELIZ, Boca.ABIERTA)

    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Saludo) {
        val texto = TextosEscena.SALUDO_PREFIJO + escena.nombreCliente
        val visible = MaquinaEscribir.textoVisible(texto, ctx.elapsedMs, 2_000L)
        ctx.textos.maquinaEscribir(ctx.canvas, visible, texto, ctx.ancho / 2f, 520f,
            120f, ctx.ancho - 120f, TextosEscena.SALUDO_PREFIJO.length,
            elapsedMs = ctx.elapsedMs, duracionMs = 2_000L, golpeMs = 3_000L)

        val tamano = 620f
        val t = ctx.elapsedMs
        if (t >= 3200L) {
            ctx.actor.actuar(ctx.ancho / 2f - tamano / 2f, 800f, tamano,
                AccionMancu.PULGAR, t - 3200L, pose)
            return
        }
        val salto = t - 2_300L
        val celebrando = salto in 0L..900L
        val desplazamiento = if (t < 900L) -1_500f * MancuAnimacion.saltoEntrada(t)
            else -160f * MancuAnimacion.alturaSalto(salto)
        val escalaY = if (t < 900L) MancuAnimacion.squash(t).second
            else MancuAnimacion.escalaYSalto(salto)
        val escalaX = 1f / escalaY
        // Compensa el antiguo pivote al borde inferior para conservar el aterrizaje.
        val y = 800f + desplazamiento + if (t < 900L) tamano * 0.04f * (1f - escalaY) else 0f
        val actuacion = if (celebrando) celebracion.copy(confeti = salto in 180L until 700L)
            else pose.copy(ondeo = if (t >= 900L) MancuAnimacion.ondeoBrazo(t) else 0f)
        ctx.actor.colocar(ctx.ancho / 2f - tamano / 2f, y, tamano, actuacion,
            escalaX = escalaX, escalaY = escalaY)
    }
}
