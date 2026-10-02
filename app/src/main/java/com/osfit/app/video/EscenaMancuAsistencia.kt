package com.osfit.app.video

internal class EscenaMancuAsistencia {
    private val hola = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)
    private val orgullo = PoseMancu(Brazos.ORGULLO, Ojos.FELIZ, Boca.ABIERTA)
    private val mirando = PoseMancu(Brazos.HOLA, Ojos.LADO, Boca.O)
    private val triste = PoseMancu(Brazos.ABAJO, Ojos.TRISTE, Boca.TRISTE)
    fun dibujar(ctx: ContextoEscenaMancu, escena: EscenaResumen.Asistencia) {
        ctx.textos.bloqueMaquina(ctx.canvas, escena.encabezadoRango, ctx.elapsedMs, 0, 400,
            540f, 140f, 44f)
        val prefijo = TextosEscena.asistenciaPrefijo(escena)
        val dias = TextosEscena.asistenciaDias(escena)
        val texto = prefijo + dias + TextosEscena.asistenciaSufijo(escena)
        val duracion = (texto.length * 2400.0 / 29.0).toLong()
        val t = ctx.elapsedMs
        val tDias = 400L + duracion * prefijo.length / texto.length
        val golpe = if (escena.dias == 0) Long.MIN_VALUE else tDias + 700L
        ctx.textos.bloqueMaquina(ctx.canvas, texto, ctx.elapsedMs, 400,
            duracion, 540f, 430f, 84f,
            esTitulo = true, color = PaletaMancu.TINTA,
            inicioRojo = prefijo.length, finRojo = prefijo.length + dias.length, golpeMs = golpe)
        val edad = t - tDias
        when {
            t < tDias -> ctx.actor.colocar(230f, 800f, 620f, mirando)
            escena.dias == 0 -> {
                val escala = 1f - 0.15f * MancuAnimacion.transicion(t, tDias, 400L)
                ctx.actor.colocar(230f, 800f, 620f, triste, escalaX = escala, escalaY = escala,
                    rotacion = MancuAnimacion.balanceoTriste(edad))
            }
            else -> {
                val primero = escena.ranking.puesto == 1
                // El primer saltito espera 1600 ms desde la reacción inicial, sin cortar su aterrizaje.
                val salto = if (primero && edad >= 1600L) edad % 1600L else edad
                val altura = if (primero) { if (edad < 1600L) 200f else 70f } else 160f
                val sy = MancuAnimacion.escalaYSalto(salto)
                val pose = if (primero) orgullo.copy(confeti = true)
                    else if (edad <= 900L) orgullo else hola.copy(ondeo = MancuAnimacion.ondeoBrazo(t))
                ctx.actor.colocar(230f, 800f - altura * MancuAnimacion.alturaSalto(salto), 620f,
                    pose, escalaX = 1f / sy, escalaY = sy)
            }
        }
    }
}
