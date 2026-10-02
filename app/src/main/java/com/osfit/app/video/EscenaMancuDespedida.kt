package com.osfit.app.video

import kotlin.math.abs
import kotlin.math.sin

internal class EscenaMancuDespedida {
    private val pose = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)
    @Suppress("UNUSED_PARAMETER")
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Despedida) {
        val texto = TextosEscena.DESPEDIDA
        ctx.textos.bloqueMaquina(ctx.canvas, texto, ctx.elapsedMs, 0,
            (texto.length * 2000.0 / 13.0).toLong(), 540f, 400f, 100f,
            esTitulo = true, color = PaletaMancu.TINTA)
        val salida = GeometriaMancu.salida(ctx.elapsedMs)
        val paso = if (salida > 0f) abs(sin((ctx.elapsedMs - 4500) * Math.PI / 180)).toFloat() * 28f else 0f
        ctx.actor.colocar(230f + 1200f * salida, 800f - paso, 620f, pose)
    }
}
