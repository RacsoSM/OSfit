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
    private var pivoteRotacionY: Float? = null
    var fasePasoForzada = -1f
        private set

    fun limpiar() {
        presente = false
        fasePasoForzada = -1f
    }

    fun colocar(x: Float, y: Float, tamano: Float, pose: PoseMancu,
                escalaX: Float = 1f, escalaY: Float = 1f,
                rotacion: Float = 0f, alpha: Float = 1f,
                pivoteRotacionY: Float? = null) {
        presente = true
        this.x = x; this.y = y; this.tamano = tamano; this.pose = pose
        this.escalaX = escalaX; this.escalaY = escalaY
        this.rotacion = rotacion; this.alpha = alpha
        this.pivoteRotacionY = pivoteRotacionY
    }

    fun actuar(x: Float, y: Float, tamano: Float, accion: AccionMancu, tMs: Long,
               base: PoseMancu? = null) {
        val cuadro = AccionesMancu.cuadro(accion, tMs)
        val pose = (base ?: PoseMancu(cuadro.brazos, cuadro.ojos, cuadro.boca)).copy(
            brazos = cuadro.brazos, ojos = cuadro.ojos, boca = cuadro.boca,
            ondeo = cuadro.ondeo, fasePaso = cuadro.fasePaso,
            anguloBrazoIzq = cuadro.anguloBrazoIzq, anguloBrazoDer = cuadro.anguloBrazoDer,
            codoIzq = cuadro.codoIzq, codoDer = cuadro.codoDer,
            guanteIzq = cuadro.guanteIzq, guanteDer = cuadro.guanteDer,
            reloj = cuadro.reloj, piernasAbiertas = cuadro.piernasAbiertas,
            impacto = cuadro.impacto, sudor = cuadro.sudor || base?.sudor == true,
            confeti = cuadro.confeti || base?.confeti == true)
        this.tMs = tMs
        colocar(x, y - cuadro.alturaPx, tamano, pose, escalaX = 1f / cuadro.escalaY,
            escalaY = cuadro.escalaY, rotacion = cuadro.rotacion,
            pivoteRotacionY = if (accion == AccionMancu.VOLTERETA) 0.44f else null)
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
        // La voltereta gira en el centro del disco (88/200); las poses previas usan los pies.
        val pivoteY = if (pivoteRotacionY != null) y + tamano * pivoteRotacionY!! else pieY
        canvas.rotate(rotacion + inclinacionExtra, pieX, pivoteY)
        canvas.scale(escalaX / escalaYExtra, escalaY * escalaYExtra, pieX, pivoteY)
        val poseDibujo = if (fasePasoForzada >= 0f) pose.copy(fasePaso = fasePasoForzada) else pose
        mancu.dibujar(canvas, x, y, tamano, poseDibujo, tMs, alpha)
        canvas.restoreToCount(guardado)
    }
}
