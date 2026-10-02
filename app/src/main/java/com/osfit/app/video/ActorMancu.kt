package com.osfit.app.video

import android.graphics.Canvas

/** Una sola instancia por renderer permite separar la escena del personaje que cruza la nube. */
internal class ActorMancu {
    var presente = false
    var x = 0f
    var y = 0f
    var tamano = 0f
    var pose = PoseMancu(Brazos.HOLA, Ojos.NORMAL, Boca.SONRISA)
    var escalaX = 1f
    var escalaY = 1f
    var rotacion = 0f
    var alpha = 1f
    var tMs = 0L
    var fasePasoForzada = -1f
        private set

    fun limpiar() {
        presente = false
        fasePasoForzada = -1f
    }

    fun colocar(x: Float, y: Float, tamano: Float, pose: PoseMancu,
                escalaX: Float = 1f, escalaY: Float = 1f,
                rotacion: Float = 0f, alpha: Float = 1f) {
        presente = true
        this.x = x; this.y = y; this.tamano = tamano; this.pose = pose
        this.escalaX = escalaX; this.escalaY = escalaY
        this.rotacion = rotacion; this.alpha = alpha
    }

    fun dibujar(canvas: Canvas, mancu: MancuDibujo, desplazamientoX: Float = 0f,
                inclinacionExtra: Float = 0f, escalaYExtra: Float = 1f,
                fasePasoForzada: Float = -1f, desplazamientoY: Float = 0f) {
        this.fasePasoForzada = fasePasoForzada
        if (!presente) return
        val guardado = canvas.save()
        canvas.translate(desplazamientoX, desplazamientoY)
        val pieX = x + tamano / 2f
        val pieY = y + tamano * 0.96f
        canvas.rotate(rotacion + inclinacionExtra, pieX, pieY)
        canvas.scale(escalaX / escalaYExtra, escalaY * escalaYExtra, pieX, pieY)
        val poseDibujo = if (fasePasoForzada >= 0f) pose.copy(fasePaso = fasePasoForzada) else pose
        mancu.dibujar(canvas, x, y, tamano, poseDibujo, tMs, alpha)
        canvas.restoreToCount(guardado)
    }
}
