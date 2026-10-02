package com.osfit.app.video

import android.content.Context
import android.graphics.Canvas

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
            dibujarEscena(canvas, visible.escena, timeline.elapsedEnTramo(visible, tiempoMs))
            nube.dibujar(canvas, ancho, alto, MancuAnimacion.progresoNube(alphaEntrante))
        } else {
            dibujarEscena(canvas, activo.escena, timeline.elapsedEnTramo(activo, tiempoMs))
        }
    }

    private fun dibujarEscena(canvas: Canvas, escena: EscenaResumen, elapsedMs: Long) {
        val guardado = canvas.save()
        val ctx = ContextoEscenaMancu(canvas, ancho, alto, elapsedMs, mancu, tipografias, textos)
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
