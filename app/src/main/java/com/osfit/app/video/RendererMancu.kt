package com.osfit.app.video

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint

class RendererMancu(context: Context) : RendererVideo {
    private val tipografias = TipografiasMancu(context)
    private val fondo = FondoPapelRenderer()
    private val nube = NubeTransicionMancu()
    private val mancu = MancuDibujo(tipografias)
    private val textos = TextoMancu(tipografias)
    private val saludo = EscenaMancuSaludo()
    private val asistencia = EscenaMancuAsistencia()
    private val tiempo = EscenaMancuTiempo()
    private val diaFavorito = EscenaMancuDiaFavorito()
    private val racha = EscenaMancuRacha()
    private val medalla = EscenaMancuMedalla()
    private val logros = EscenaMancuLogros()
    private val despedida = EscenaMancuDespedida()
    private val actor = ActorMancu()
    private val poseSprint = PoseMancu(Brazos.ORGULLO, Ojos.FELIZ, Boca.ABIERTA)
    private val tintaVelocidad = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = PaletaMancu.TINTA
        strokeWidth = 10f
        strokeCap = Paint.Cap.ROUND
    }
    private val ancho = 1080f
    private val alto = 1920f

    override fun dibujarFrame(canvas: Canvas, timeline: TimelineResumen, tiempoMs: Long) {
        canvas.drawColor(PaletaMancu.PAPEL)
        fondo.dibujar(canvas, ancho.toInt(), alto.toInt(), tiempoMs)
        val activo = timeline.tramoActivo(tiempoMs)
        val entrante = timeline.tramoEntrante(tiempoMs)
        if (entrante != null) {
            val alphaEntrante = timeline.alphaEntrante(tiempoMs)
            val visible = if (MancuAnimacion.escenaVisibleEsEntrante(alphaEntrante)) entrante else activo
            val reloj = if (visible === activo) activo.duracionMs - timeline.ritmo.ventanaTransicionMs / 2L
                else timeline.relojVisible(visible, tiempoMs)
            dibujarEscena(canvas, visible.escena, reloj)
            nube.dibujar(canvas, ancho, alto, MancuAnimacion.progresoNube(alphaEntrante))
            val corriendo = MancuAnimacion.viajeCorriendo(alphaEntrante)
            val desplazamiento = MancuAnimacion.viajeDesplazamiento(alphaEntrante) * ancho
            if (corriendo && actor.presente) {
                if (alphaEntrante < 0.5f) actor.pose = poseSprint
                dibujarVelocidad(canvas, alphaEntrante, desplazamiento)
            }
            actor.dibujar(canvas, mancu, desplazamiento,
                MancuAnimacion.viajeInclinacion(alphaEntrante),
                MancuAnimacion.viajeEscalaY(alphaEntrante),
                if (corriendo) MancuAnimacion.fasePaso(tiempoMs, 280L) else -1f)
        } else {
            dibujarEscena(canvas, activo.escena, timeline.relojVisible(activo, tiempoMs))
            actor.dibujar(canvas, mancu)
        }
    }

    private fun dibujarVelocidad(canvas: Canvas, a: Float, desplazamiento: Float) {
        // Ambos recorridos avanzan a la derecha: los trazos quedan detrás, hacia la izquierda.
        // Derivadas de las curvas respecto de su media ventana, normalizadas a su máximo.
        val velocidad = if (a < 0.5f) ((a * 2f - 0.3f) / 0.7f).coerceIn(0f, 1f)
            else (1f - (a - 0.5f) * 2f).let { it * it }
        val longitud = 180f * velocidad
        val borde = actor.x + desplazamiento
        for (i in 0..3) {
            val y = actor.y + actor.tamano * (0.3f + i * 0.13f)
            canvas.drawLine(borde - 30f - longitud * (1f - i * 0.12f), y,
                borde - 30f, y, tintaVelocidad)
        }
    }

    private fun dibujarEscena(canvas: Canvas, escena: EscenaResumen, elapsedMs: Long) {
        val guardado = canvas.save()
        actor.limpiar()
        actor.tMs = elapsedMs
        val ctx = ContextoEscenaMancu(canvas, ancho, alto, elapsedMs, actor, tipografias, textos)
        when (escena) {
            is EscenaResumen.Saludo -> saludo.dibujar(ctx, escena)
            is EscenaResumen.Asistencia -> asistencia.dibujar(ctx, escena)
            is EscenaResumen.Tiempo -> tiempo.dibujar(ctx, escena)
            is EscenaResumen.DiaFavorito -> diaFavorito.dibujar(ctx, escena)
            is EscenaResumen.RachaMasLarga -> racha.dibujar(ctx, escena)
            is EscenaResumen.Medalla -> medalla.dibujar(ctx, escena)
            is EscenaResumen.LogrosPersonales -> logros.dibujar(ctx, escena)
            is EscenaResumen.Despedida -> despedida.dibujar(ctx, escena)
        }
        canvas.restoreToCount(guardado)
    }
}
