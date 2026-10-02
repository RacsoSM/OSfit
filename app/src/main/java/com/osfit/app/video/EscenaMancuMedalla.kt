package com.osfit.app.video

internal class EscenaMancuMedalla {
    private val hola = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)
    private val orgullo = PoseMancu(Brazos.ORGULLO, Ojos.FELIZ, Boca.ABIERTA, confeti = true)
    private val insignia = InsigniaMancu()
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Medalla) {
        val c = ctx.canvas
        val centro = ctx.ancho / 2f
        val nombre = escena.nombre
        val t = ctx.elapsedMs
        if (nombre == null) {
            if (escena.mensaje.isNotBlank()) ctx.textos.bloqueMaquina(c, escena.mensaje,
                ctx.elapsedMs, 400, 0, centro, 780f, 48f, altoMaximo = 400f)
            // Este mensaje conserva duración cero: termina de escribirse al aparecer en 400 ms.
            val actuacion = if (t < 400L) hola.copy(ojos = Ojos.LADO)
                else hola.copy(ondeo = MancuAnimacion.ondeoBrazo(t))
            val sy = if (t < 400L) 1f else
                1f + (MancuAnimacion.squash((t - 400L) % 1400L).second - 1f) * 0.3f
            ctx.actor.colocar(centro - 240f, 1250f, 480f, actuacion,
                escalaX = 1f / sy, escalaY = sy)
            return
        }
        ctx.textos.bloqueMaquina(c, TextosEscena.TITULO_GRUPAL, ctx.elapsedMs, 0, 900,
            centro, 320f, 72f, esTitulo = true, color = PaletaMancu.ROJO, altoMaximo = 130f,
            golpeMs = MEDALLA_INICIO_GRUPAL_MS + 520L)
        ctx.textos.bloqueMaquina(c, TextosEscena.MEDALLA_PREFIJO, ctx.elapsedMs, 500, 1800,
            centro, 510f, 56f, esTitulo = true, color = PaletaMancu.TINTA, altoMaximo = 110f,
            golpeMs = MEDALLA_INICIO_GRUPAL_MS + 520L)
        val mascota = ComposicionPremiosMancu.mascota(1)
        val alpha = ResumenFrameRenderer.opacidadEntrada(ctx.elapsedMs)
        val inicioSalto = MEDALLA_INICIO_GRUPAL_MS - 180L
        val mensaje = t >= MENSAJE_MEDALLA_INICIO_MS
        val salto = if (mensaje) (t - MENSAJE_MEDALLA_INICIO_MS) % 1800L else t - inicioSalto
        val sy = MancuAnimacion.escalaYSalto(salto)
        val actuacion = when {
            mensaje -> hola.copy(ondeo = MancuAnimacion.ondeoBrazo(t))
            t >= inicioSalto -> orgullo
            else -> hola.copy(ojos = Ojos.LADO, boca = Boca.O)
        }
        ctx.actor.colocar(mascota.x,
            mascota.y - (if (mensaje) 50f else 140f) * MancuAnimacion.alturaSalto(salto),
            mascota.lado, actuacion, escalaX = 1f / sy, escalaY = sy,
            rotacion = if (t < inicioSalto) -6f else 0f)
        if (alpha > 0f) {
            val radio = 264f * ResumenFrameRenderer.escalaEntrada(ctx.elapsedMs)
            insignia.halo(c, centro, 1150f, radio, ResumenFrameRenderer.HALO_FACTOR_MEDALLA,
                ResumenFrameRenderer.HALO_ALPHA_MEDALLA,
                ResumenFrameRenderer.intensidadDestello(ctx.elapsedMs), alpha)
            insignia.onda(c, centro, 1150f, 264f, ResumenFrameRenderer.ondaExpansiva(ctx.elapsedMs))
            val guardado = c.save()
            c.rotate(ResumenFrameRenderer.rotacionEntrada(ctx.elapsedMs), centro, 1150f)
            insignia.dibujar(c, escena.imagenPersonalizada, centro, 1150f, radio,
                escena.categoria?.let { ResumenFrameRenderer.COLOR_INSIGNIA_MEDALLA[it] } ?: 0xFFB0B0B0.toInt(),
                escena.categoria?.name?.first()?.toString() ?: "★", alpha)
            c.restoreToCount(guardado)
            val texto = c.saveLayerAlpha(80f, 1450f, 1000f, 1600f, (alpha * 255).toInt())
            ctx.textos.bloqueMaquina(c, nombre, ctx.elapsedMs, MEDALLA_INICIO_GRUPAL_MS, 0,
                centro, 1480f, 44f, esTitulo = true, color = PaletaMancu.ROJO, altoMaximo = 110f)
            c.restoreToCount(texto)
        }
        if (escena.mensaje.isNotBlank()) ctx.textos.bloqueMaquina(c, escena.mensaje,
            ctx.elapsedMs, MENSAJE_MEDALLA_INICIO_MS, DURACION_ANIMACION_MENSAJE_MEDALLA_MS,
            centro, 1620f, 38f, altoMaximo = 220f)
    }
}
