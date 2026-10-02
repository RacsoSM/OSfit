package com.osfit.app.video

internal class EscenaMancuLogros {
    private val pose = PoseMancu(Brazos.ABAJO, Ojos.NORMAL, Boca.SONRISA)
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
        val t = ctx.elapsedMs
        var actual = -1
        for (i in 0 until cantidad) {
            if (t >= CascadaLogrosMancu.inicio(cantidad, i) - 180L) actual = i
        }
        val inicioCelebracion = CascadaLogrosMancu.inicio(cantidad, cantidad - 1) + 1000L
        val celebrando = t >= inicioCelebracion
        // La cascada se solapa cada 500 ms: la insignia más reciente toma la atención y el salto.
        val salto = when {
            actual >= 0 -> t - CascadaLogrosMancu.inicio(cantidad, actual) + 180L
            else -> -1L
        }
        val sy = MancuAnimacion.escalaYSalto(salto)
        val y = mascota.y - 90f * MancuAnimacion.alturaSalto(salto)
        val actuacion = when {
            actual >= 0 && t >= CascadaLogrosMancu.inicio(cantidad, actual) -> {
                val pos = posiciones[actual]
                // Hombro derecho (160,86) del dibujo 200×200, en coordenadas de pantalla.
                pose.copy(brazos = Brazos.SENALA,
                    anguloSenala = MancuAnimacion.anguloHacia(mascota.x + mascota.lado * 160f / 200f,
                        y + mascota.lado * 86f / 200f, pos.cx, pos.cy))
            }
            else -> pose
        }
        if (celebrando) {
            val edad = t - inicioCelebracion
            // La paridad mantiene la alternancia sin depender de estado entre escenas.
            val accion = if (edad < 900L) AccionMancu.VOLTERETA
                else if (cantidad % 2 == 1) AccionMancu.BAILAR else AccionMancu.APLAUDIR
            val inicio = inicioCelebracion + if (edad < 900L) 0L else 900L
            ctx.actor.actuar(mascota.x, mascota.y, mascota.lado, accion, t - inicio, pose)
        } else ctx.actor.colocar(mascota.x, y, mascota.lado, actuacion, escalaX = 1f / sy, escalaY = sy)
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
                esTitulo = true, color = PaletaMancu.ROJO, altoMaximo = 100f,
                golpeMs = CascadaLogrosMancu.inicio(cantidad, indice) + 520L)
            // Con varios premios se conserva todo el espacio para sus nombres, como pide el modelo.
            if (unico && logro.mensaje.isNotBlank()) ctx.textos.bloqueMaquina(c, logro.mensaje,
                ctx.elapsedMs, CascadaLogrosMancu.inicio(cantidad, indice), 0,
                pos.cx, yNombre + 95f, 38f, ancho = pos.anchoTexto, altoMaximo = 1840f - yNombre - 95f)
            c.restoreToCount(guardado)
        }
    }
}
