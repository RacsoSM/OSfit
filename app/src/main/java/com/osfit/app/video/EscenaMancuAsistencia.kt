package com.osfit.app.video

internal class EscenaMancuAsistencia {
    private val hola = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)
    private val orgullo = PoseMancu(Brazos.ORGULLO, Ojos.FELIZ, Boca.ABIERTA)
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Asistencia) {
        ctx.textos.bloqueMaquina(ctx.canvas, escena.encabezadoRango, ctx.elapsedMs, 0, 400,
            540f, 140f, 44f)
        val prefijo = TextosEscena.asistenciaPrefijo(escena)
        val dias = TextosEscena.asistenciaDias(escena)
        val texto = prefijo + dias + TextosEscena.asistenciaSufijo(escena)
        ctx.textos.bloqueMaquina(ctx.canvas, texto, ctx.elapsedMs, 400,
            (texto.length * 2400.0 / 29.0).toLong(), 540f, 430f, 84f,
            esTitulo = true, color = PaletaMancu.TINTA,
            inicioRojo = prefijo.length, finRojo = prefijo.length + dias.length)
        val guardado = ctx.canvas.save()
        ctx.canvas.translate(540f, 1420f)
        val (sx, sy) = MancuAnimacion.squash(ctx.elapsedMs - 400)
        ctx.canvas.scale(sx, sy)
        ctx.mancu.dibujar(ctx.canvas, -310f, -620f, 620f,
            if (escena.ranking.puesto == 1) orgullo else hola, ctx.elapsedMs)
        ctx.canvas.restoreToCount(guardado)
    }
}
