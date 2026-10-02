package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import kotlin.math.PI

/**
 * Portado de clasico/cara/boca/piernas/brazos/disco del prototipo en coordenadas 200×200.
 * LADO y O son extensiones aprobadas: pupila x+6, ceja M110 80 Q122 72 134 80,
 * y óvalo de boca #8c2a1c con radios 7×9 y contorno 4, respectivamente.
 */
class MancuDibujo(tipografias: TipografiasMancu) {
    private val tinta = 0xff1b1512.toInt()
    private val rojo = 0xffd9412b.toInt()
    private val blanco = 0xffffffff.toInt()
    private val sol = 0xfff7d774.toInt()
    private val relleno = Paint(Paint.ANTI_ALIAS_FLAG)
    private val trazo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val texto = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = tipografias.titulo
        textSize = 15f
        letterSpacing = 2.5f / 15f
        color = 0xff4a4d52.toInt()
    }
    private val camino = Path()
    private val ovalo = RectF()
    private val arcoTexto = Path().apply { addArc(RectF(50f, 38f, 150f, 138f), 180f, -180f) }
    private val inicioTexto = (50f * PI.toFloat() - texto.measureText("20 KG")) / 2f

    /** Esquina superior izquierda (x,y), lado tamano; la sombra queda fija al respirar. */
    fun dibujar(canvas: Canvas, x: Float, y: Float, tamano: Float, pose: PoseMancu, tMs: Long, alpha: Float = 1f) {
        if (tamano <= 0f || alpha <= 0f) return
        val guardado = canvas.save()
        canvas.translate(x, y)
        canvas.scale(tamano / 200f, tamano / 200f)
        if (alpha < 1f) canvas.saveLayerAlpha(-4f, -16f, 204f, 204f, (alpha * 255f).toInt())
        elipse(canvas, 100f, 192f, if (pose.salto) 30f else 56f, 5f, tinta, opacidad = 0.18f)
        canvas.translate(0f, MancuAnimacion.reboteY(tMs) * 5f + if (pose.salto) -12f else 0f)
        piernas(canvas, pose)
        brazos(canvas, pose.brazos)
        disco(canvas)
        cara(canvas, pose.ojos, MancuAnimacion.factorParpadeo(tMs))
        boca(canvas, pose.boca)
        if (pose.sudor) sudor(canvas)
        if (pose.confeti) confeti(canvas)
        canvas.restoreToCount(guardado)
    }

    private fun elipse(canvas: Canvas, x: Float, y: Float, rx: Float, ry: Float, color: Int,
                       grosor: Float = 0f, opacidad: Float = 1f) {
        ovalo.set(x - rx, y - ry, x + rx, y + ry)
        relleno.color = color
        relleno.alpha = (255f * opacidad).toInt()
        canvas.drawOval(ovalo, relleno)
        if (grosor > 0f) {
            prepararTrazo(tinta, grosor)
            canvas.drawOval(ovalo, trazo)
        }
    }

    private fun prepararTrazo(color: Int, grosor: Float, opacidad: Float = 1f) {
        trazo.color = color
        trazo.alpha = (255f * opacidad).toInt()
        trazo.strokeWidth = grosor
    }

    private fun curva(canvas: Canvas, x: Float, y: Float, qx: Float, qy: Float, fx: Float, fy: Float,
                      grosor: Float = 7f, color: Int = tinta) {
        camino.reset()
        camino.moveTo(x, y)
        camino.quadTo(qx, qy, fx, fy)
        prepararTrazo(color, grosor)
        canvas.drawPath(camino, trazo)
    }

    private fun piernas(canvas: Canvas, pose: PoseMancu) {
        when {
            pose.salto -> {
                curva(canvas, 84f, 148f, 74f, 168f, 66f, 184f)
                curva(canvas, 116f, 148f, 126f, 168f, 134f, 184f)
                zapato(canvas, 60f, 188f)
                zapato(canvas, 140f, 188f)
            }
            pose.ojos == Ojos.FUERZA -> {
                curva(canvas, 80f, 148f, 66f, 166f, 60f, 182f)
                curva(canvas, 120f, 148f, 134f, 166f, 140f, 182f)
                zapato(canvas, 54f, 186f)
                zapato(canvas, 146f, 186f)
            }
            else -> {
                camino.reset()
                camino.moveTo(84f, 148f)
                camino.lineTo(82f, 182f)
                camino.moveTo(116f, 148f)
                camino.lineTo(118f, 182f)
                prepararTrazo(tinta, 7f)
                canvas.drawPath(camino, trazo)
                zapato(canvas, 76f, 186f)
                zapato(canvas, 124f, 186f)
            }
        }
    }

    private fun zapato(canvas: Canvas, x: Float, y: Float) = elipse(canvas, x, y, 14f, 7f, rojo, 4f)
    private fun guante(canvas: Canvas, x: Float, y: Float) = elipse(canvas, x, y, 8f, 8f, blanco, 4f)

    private fun brazos(canvas: Canvas, pose: Brazos) {
        when (pose) {
            Brazos.HOLA -> {
                curva(canvas, 40f, 92f, 20f, 96f, 14f, 116f)
                guante(canvas, 14f, 118f)
                curva(canvas, 160f, 84f, 184f, 74f, 188f, 46f)
                guante(canvas, 188f, 42f)
            }
            Brazos.ORGULLO -> {
                curva(canvas, 40f, 86f, 12f, 70f, 10f, 40f)
                guante(canvas, 10f, 36f)
                curva(canvas, 160f, 86f, 188f, 70f, 190f, 40f)
                guante(canvas, 190f, 36f)
            }
            Brazos.ESFUERZO -> {
                curva(canvas, 40f, 94f, 18f, 110f, 14f, 132f)
                guante(canvas, 14f, 134f)
                curva(canvas, 160f, 94f, 182f, 110f, 186f, 132f)
                guante(canvas, 186f, 134f)
            }
        }
    }

    private fun disco(canvas: Canvas) {
        elipse(canvas, 100f, 88f, 62f, 62f, 0xff8f9298.toInt(), 5f)
        prepararTrazo(0xff6d7076.toInt(), 4f)
        canvas.drawCircle(100f, 88f, 55f, trazo)
        prepararTrazo(0xffc9ccd1.toInt(), 2f, 0.7f)
        canvas.drawCircle(100f, 88f, 48f, trazo)
        curva(canvas, 52f, 66f, 60f, 42f, 76f, 36f, 5f, 0xffc9ccd1.toInt())
        canvas.drawTextOnPath("20 KG", arcoTexto, inicioTexto, 0f, texto)
    }

    private fun cara(canvas: Canvas, ojos: Ojos, parpadeo: Float) {
        val s = 1.05f
        elipse(canvas, 78f - 9f * s, 70f + 16f * s, 6f * s, 6f * s, rojo, opacidad = 0.75f)
        elipse(canvas, 122f + 9f * s, 70f + 16f * s, 6f * s, 6f * s, rojo, opacidad = 0.75f)
        if (ojos == Ojos.FUERZA) {
            camino.reset()
            camino.moveTo(78f - 12f * s, 70f - 15f * s)
            camino.lineTo(78f + 10f * s, 70f - 8f * s)
            camino.moveTo(122f + 12f * s, 70f - 15f * s)
            camino.lineTo(122f - 10f * s, 70f - 8f * s)
            prepararTrazo(tinta, 4.5f * s)
            canvas.drawPath(camino, trazo)
        }
        if (ojos == Ojos.LADO) curva(canvas, 110f, 80f, 122f, 72f, 134f, 80f, 4.5f * s)
        ojo(canvas, 78f, ojos, parpadeo)
        ojo(canvas, 122f, ojos, parpadeo)
    }

    private fun ojo(canvas: Canvas, x: Float, ojos: Ojos, parpadeo: Float) {
        val s = 1.05f
        when (ojos) {
            Ojos.FELIZ -> curva(canvas, x - 10f * s, 70f + 4f * s, x, 70f - 11f * s,
                x + 10f * s, 70f + 4f * s, 4.5f * s)
            Ojos.FUERZA -> {
                elipse(canvas, x, 70f, 10f * s, 8f * s, blanco, 3.5f * s)
                elipse(canvas, x, 70f + s, 4.5f * s, 4.5f * s, tinta)
            }
            else -> {
                // Escalar el grupo completo conserva la relación entre pupila, brillo y párpado del SVG.
                val guardado = canvas.save()
                canvas.translate(x, 70f)
                canvas.scale(1f, parpadeo)
                elipse(canvas, 0f, 0f, 11f * s, 13f * s, blanco, 3.5f * s)
                val pupilaX = if (ojos == Ojos.LADO) 6f else s
                elipse(canvas, pupilaX, 2f * s, 6f * s, 6f * s, tinta)
                elipse(canvas, pupilaX + 2f * s, -2f * s, 2f * s, 2f * s, blanco)
                canvas.restoreToCount(guardado)
            }
        }
    }

    private fun boca(canvas: Canvas, pose: Boca) {
        when (pose) {
            Boca.SONRISA -> curva(canvas, 87f, 100f, 100f, 113f, 113f, 100f, 4.5f)
            Boca.ABIERTA -> {
                camino.reset()
                camino.moveTo(85f, 98f)
                camino.quadTo(100f, 126f, 115f, 98f)
                camino.close()
                relleno.color = 0xff8c2a1c.toInt()
                canvas.drawPath(camino, relleno)
                prepararTrazo(tinta, 4f)
                canvas.drawPath(camino, trazo)
                elipse(canvas, 100f, 111f, 7f, 4f, 0xffe8796a.toInt())
            }
            Boca.DIENTES -> {
                ovalo.set(85f, 97f, 115f, 111f)
                relleno.color = blanco
                canvas.drawRoundRect(ovalo, 5f, 5f, relleno)
                prepararTrazo(tinta, 4f)
                canvas.drawRoundRect(ovalo, 5f, 5f, trazo)
                camino.reset()
                camino.moveTo(95f, 97f)
                camino.lineTo(95f, 111f)
                camino.moveTo(105f, 97f)
                camino.lineTo(105f, 111f)
                prepararTrazo(tinta, 2f)
                // El SVG no redondea los extremos de las divisiones de dientes.
                trazo.strokeCap = Paint.Cap.BUTT
                canvas.drawPath(camino, trazo)
                trazo.strokeCap = Paint.Cap.ROUND
            }
            Boca.O -> elipse(canvas, 100f, 100f, 7f, 9f, 0xff8c2a1c.toInt(), 4f)
        }
    }

    private fun sudor(canvas: Canvas) {
        camino.reset()
        camino.moveTo(166f, 34f)
        camino.quadTo(160f, 44f, 166f, 48f)
        camino.quadTo(172f, 44f, 166f, 34f)
        camino.close()
        camino.moveTo(30f, 44f)
        camino.quadTo(25f, 53f, 30f, 56f)
        camino.quadTo(35f, 53f, 30f, 44f)
        camino.close()
        relleno.color = 0xff6ec6e8.toInt()
        canvas.drawPath(camino, relleno)
        prepararTrazo(tinta, 3f)
        trazo.strokeJoin = Paint.Join.MITER
        canvas.drawPath(camino, trazo)
        trazo.strokeJoin = Paint.Join.ROUND
    }

    private fun confeti(canvas: Canvas) {
        rectanguloConfeti(canvas, 18f, 12f, 10f, 5f, sol, 30f, 23f, 14f)
        rectanguloConfeti(canvas, 170f, 8f, 10f, 5f, rojo, -20f, 175f, 10f)
        elipse(canvas, 100f, 6f, 4f, 4f, sol, 2f)
        rectanguloConfeti(canvas, 184f, 62f, 9f, 5f, sol, 0f, 0f, 0f)
        elipse(canvas, 10f, 60f, 4f, 4f, rojo, 2f)
    }

    private fun rectanguloConfeti(canvas: Canvas, x: Float, y: Float, ancho: Float, alto: Float,
                                  color: Int, giro: Float, pivoteX: Float, pivoteY: Float) {
        val guardado = canvas.save()
        canvas.rotate(giro, pivoteX, pivoteY)
        relleno.color = color
        canvas.drawRect(x, y, x + ancho, y + alto, relleno)
        prepararTrazo(tinta, 2f)
        trazo.strokeJoin = Paint.Join.MITER
        canvas.drawRect(x, y, x + ancho, y + alto, trazo)
        trazo.strokeJoin = Paint.Join.ROUND
        canvas.restoreToCount(guardado)
    }
}
