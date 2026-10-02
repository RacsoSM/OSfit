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
        val guardado = ctx.canvas.save()
        // Escalar desde los pies evita que el aplastamiento desplace el punto de aterrizaje.
        ctx.canvas.translate(ctx.ancho / 2f, 800f + tamano + desplazamiento)
        ctx.canvas.scale(escalaX, escalaY)
        ctx.mancu.dibujar(ctx.canvas, -tamano / 2f, -tamano, tamano, pose, ctx.elapsedMs)
        ctx.canvas.restoreToCount(guardado)
    }
}
