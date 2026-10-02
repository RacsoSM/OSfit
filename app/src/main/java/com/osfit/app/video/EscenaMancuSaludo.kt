package com.osfit.app.video

internal class EscenaMancuSaludo {
    private val pose = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)

    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Saludo) {
        val texto = TextosEscena.SALUDO_PREFIJO + escena.nombreCliente
        val visible = MaquinaEscribir.textoVisible(texto, ctx.elapsedMs, 2_000L)
        ctx.textos.maquinaEscribir(ctx.canvas, visible, texto, ctx.ancho / 2f, 520f,
            120f, ctx.ancho - 120f, TextosEscena.SALUDO_PREFIJO.length)

        val tamano = 620f
        val desplazamiento = -1_500f * MancuAnimacion.saltoEntrada(ctx.elapsedMs)
        val (escalaX, escalaY) = MancuAnimacion.squash(ctx.elapsedMs)
        // Compensa el antiguo pivote al borde inferior para conservar el aterrizaje.
        val y = 800f + desplazamiento + tamano * 0.04f * (1f - escalaY)
        ctx.actor.colocar(ctx.ancho / 2f - tamano / 2f, y, tamano, pose,
            escalaX = escalaX, escalaY = escalaY)
    }
}
