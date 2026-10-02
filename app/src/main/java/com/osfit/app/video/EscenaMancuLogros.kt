package com.osfit.app.video

internal class EscenaMancuLogros {
    private val pose = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)
    private val insignia = InsigniaMancu()
    private var cantidadAnterior = 0
    private var anchoAnterior = 0
    private var posiciones = emptyList<ResumenFrameRenderer.PosicionLogro>()
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.LogrosPersonales) {
        val c = ctx.canvas
        val cantidad = escena.logros.size
        if (cantidad == 0) return
        if (cantidad != cantidadAnterior || ctx.ancho.toInt() != anchoAnterior) {
            cantidadAnterior = cantidad
            anchoAnterior = ctx.ancho.toInt()
            posiciones = ResumenFrameRenderer.posicionesLogros(cantidad, anchoAnterior)
        }
        ctx.textos.bloqueMaquina(c, TextosEscena.TITULO_PERSONAL, ctx.elapsedMs, 0, 900,
            ctx.ancho / 2f, 320f, 72f, esTitulo = true, color = PaletaMancu.ROJO, altoMaximo = 130f)
        ctx.textos.bloqueMaquina(c, TextosEscena.LOGROS_PREFIJO, ctx.elapsedMs,
            ResumenFrameRenderer.LOGROS_RETRASO_MS, 1800, ctx.ancho / 2f, 510f, 56f,
            esTitulo = true, color = PaletaMancu.TINTA, altoMaximo = 90f)
        val mascota = ComposicionPremiosMancu.mascota(cantidad)
        ctx.mancu.dibujar(c, mascota.x, mascota.y, mascota.lado, pose, ctx.elapsedMs)
        escena.logros.forEachIndexed { indice, logro ->
            val alpha = CascadaLogrosMancu.opacidad(cantidad, indice, ctx.elapsedMs)
            if (alpha <= 0f) return@forEachIndexed
            val pos = posiciones[indice]
            insignia.halo(c, pos.cx, pos.cy, pos.radio, ResumenFrameRenderer.HALO_FACTOR_LOGRO,
                ResumenFrameRenderer.HALO_ALPHA_LOGRO, 1f, alpha)
            insignia.dibujar(c, logro.imagen, pos.cx, pos.cy, pos.radio,
                ResumenFrameRenderer.DONA_PALETA_PASTEL[indice], "★", alpha)
            val unico = cantidad == 1
            // Las columnas oscuras llegan a x=50; el papel requiere 80 px más el contorno y la sombra.
            val anchoNombre = minOf(pos.anchoTexto,
                (2f * (pos.cx - 90f)).toInt(), (2f * (ctx.ancho - 90f - pos.cx)).toInt())
            val yNombre = pos.cy + pos.radio + if (unico) 90f else 60f
            val guardado = c.saveLayerAlpha(80f, yNombre - 30f, ctx.ancho - 80f, 1840f,
                (alpha * 255).toInt())
            ctx.textos.bloqueMaquina(c, logro.nombre, ctx.elapsedMs,
                CascadaLogrosMancu.inicio(cantidad, indice), 0, pos.cx, yNombre - 25f,
                if (unico) 44f else 30f, ancho = anchoNombre,
                esTitulo = true, color = PaletaMancu.ROJO, altoMaximo = 100f)
            // Con varios premios se conserva todo el espacio para sus nombres, como pide el modelo.
            if (unico && logro.mensaje.isNotBlank()) ctx.textos.bloqueMaquina(c, logro.mensaje,
                ctx.elapsedMs, CascadaLogrosMancu.inicio(cantidad, indice), 0,
                pos.cx, yNombre + 95f, 38f, ancho = pos.anchoTexto, altoMaximo = 1840f - yNombre - 95f)
            c.restoreToCount(guardado)
        }
    }
}
