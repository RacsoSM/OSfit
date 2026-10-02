package com.osfit.app.video

internal class EscenaMancuDespedida {
    private val pose = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)
    @Suppress("UNUSED_PARAMETER")
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Despedida) {
        val texto = TextosEscena.DESPEDIDA
        ctx.textos.bloqueMaquina(ctx.canvas, texto, ctx.elapsedMs, 0,
            (texto.length * 2000.0 / 13.0).toLong(), 540f, 400f, 100f,
            esTitulo = true, color = PaletaMancu.TINTA, cascada = true)
        val t = ctx.elapsedMs
        when {
            t < 2800L -> ctx.actor.colocar(230f, 800f, 620f,
                pose.copy(ondeo = MancuAnimacion.ondeoBrazo(t) * 1.5f))
            t < 3050L -> {
                val giro = MancuAnimacion.transicion(t, 2800L, 250L)
                ctx.actor.colocar(230f, 800f, 620f, pose,
                    escalaX = 1f - 2f * giro, escalaY = 1f - 0.1f * giro)
            }
            else -> {
                val x = 230f + (t - 3050L) * 260f / 1000f
                // Sigue caminando durante el último saludo para salir antes de 6500 ms.
                val inicioUltimoSaludo = 3050L + ((900f - 230f) * 1000f / 260f).toLong() + 1L
                val ultimoSaludo = t in inicioUltimoSaludo until inicioUltimoSaludo + 400L
                val sy = 0.9f + 0.1f * MancuAnimacion.transicion(t, 3050L, 180L)
                ctx.actor.colocar(x, 800f, 620f,
                    pose.copy(fasePaso = MancuAnimacion.fasePaso(t, 550L),
                        ondeo = MancuAnimacion.ondeoBrazo(if (ultimoSaludo) t * 2L else t) * 1.5f),
                    escalaX = if (ultimoSaludo) 1f else -1f, escalaY = sy)
            }
        }
    }
}
