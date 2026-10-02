package com.osfit.app.video

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.max

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
        // El dedo extendido y el ondeo pueden sobresalir del espacio base del disco.
        if (alpha < 1f) canvas.saveLayerAlpha(-40f, -40f, 240f, 220f, (alpha * 255f).toInt())
        elipse(canvas, 100f, 192f, if (pose.salto) 30f else 56f, 5f, tinta, opacidad = 0.18f)
        val avance = sin(2.0 * PI * pose.fasePaso).toFloat()
        val subidaPaso = if (pose.fasePaso >= 0f) 4f * abs(avance) else 0f
        canvas.translate(0f, MancuAnimacion.reboteY(tMs) * 5f - subidaPaso + if (pose.salto) -12f else 0f)
        val respiracion = MancuAnimacion.respiracionEscalaY(tMs)
        canvas.scale(1f / respiracion, respiracion, 100f, 192f)
        piernas(canvas, pose)
        if (pose.brazos != Brazos.LIBRE) brazos(canvas, pose)
        disco(canvas)
        // Los brazos al frente deben quedar visibles sobre el disco durante el aplauso.
        if (pose.brazos == Brazos.LIBRE) brazos(canvas, pose)
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
            pose.fasePaso >= 0f -> {
                val avance = sin(2.0 * PI * pose.fasePaso).toFloat()
                piernaPaso(canvas, 84f, 76f, avance)
                piernaPaso(canvas, 116f, 124f, -avance)
            }
            pose.piernasAbiertas > 0f -> {
                val apertura = pose.piernasAbiertas.coerceIn(0f, 1f)
                piernaAbierta(canvas, 84f, 76f - 26f * apertura, -12f * apertura)
                piernaAbierta(canvas, 116f, 124f + 26f * apertura, 12f * apertura)
            }
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

    private fun piernaAbierta(canvas: Canvas, caderaX: Float, pieX: Float, giro: Float) {
        curva(canvas, caderaX, 148f, (caderaX + pieX) / 2f, 168f, pieX, 182f)
        val guardado = canvas.save()
        canvas.rotate(giro, pieX, 186f)
        zapato(canvas, pieX, 186f)
        canvas.restoreToCount(guardado)
    }

    private fun guante(canvas: Canvas, x: Float, y: Float, tipo: Guante) {
        guante(canvas, x, y)
        if (tipo == Guante.ABIERTO) return
        prepararTrazo(tinta, 2f)
        canvas.drawLine(x - 3f, y - 3f, x + 2f, y - 3f, trazo)
        canvas.drawLine(x - 3f, y + 1f, x + 2f, y + 1f, trazo)
        if (tipo == Guante.PULGAR) elipse(canvas, x + 6f, y - 10f, 4f, 8f, blanco, 3f)
    }

    private fun brazoLibre(canvas: Canvas, hombroX: Float, angulo: Float, codo: Float,
                           tipo: Guante, reloj: Boolean) {
        val radianes = angulo * PI / 180.0
        val dx = cos(radianes).toFloat()
        val dy = sin(radianes).toFloat()
        val desvio = 22f * codo.coerceIn(-1f, 1f)
        val qx = hombroX + 26f * dx - desvio * dy
        val qy = 88f + 26f * dy + desvio * dx
        val manoX = hombroX + 52f * dx
        val manoY = 88f + 52f * dy
        curva(canvas, hombroX, 88f, qx, qy, manoX, manoY)
        guante(canvas, manoX, manoY, tipo)
        if (reloj) {
            // Evaluar la misma Bézier en 42/52 mantiene el reloj sobre la manguera curva.
            val u = 42f / 52f
            val v = 1f - u
            val wx = v * v * hombroX + 2f * v * u * qx + u * u * manoX
            val wy = v * v * 88f + 2f * v * u * qy + u * u * manoY
            prepararTrazo(rojo, 8f)
            canvas.drawLine(wx + 7f * dy, wy - 7f * dx, wx - 7f * dy, wy + 7f * dx, trazo)
            elipse(canvas, wx, wy, 6f, 6f, blanco, 2f)
            prepararTrazo(tinta, 1.5f)
            canvas.drawLine(wx, wy, wx, wy - 4f, trazo)
            canvas.drawLine(wx, wy, wx + 3f, wy + 1f, trazo)
        }
    }

    private fun piernaPaso(canvas: Canvas, caderaX: Float, pieBaseX: Float, avance: Float) {
        val pieX = pieBaseX + 16f * avance
        val pieY = 186f - 10f * max(0f, avance)
        curva(canvas, caderaX, 148f, (caderaX + pieX) / 2f, 168f, pieX, pieY - 4f)
        val guardado = canvas.save()
        canvas.rotate(15f * avance, pieX, pieY)
        zapato(canvas, pieX, pieY)
        canvas.restoreToCount(guardado)
    }

    private fun brazos(canvas: Canvas, pose: PoseMancu) {
        when (pose.brazos) {
            Brazos.LIBRE -> {
                brazoLibre(canvas, 40f, pose.anguloBrazoIzq, pose.codoIzq, pose.guanteIzq, pose.reloj)
                brazoLibre(canvas, 160f, pose.anguloBrazoDer, pose.codoDer, pose.guanteDer, false)
                if (pose.impacto > 0f) {
                    val izq = pose.anguloBrazoIzq * PI / 180.0
                    val der = pose.anguloBrazoDer * PI / 180.0
                    val cx = 100f + 26f * (cos(izq) + cos(der)).toFloat()
                    val cy = 88f + 26f * (sin(izq) + sin(der)).toFloat()
                    prepararTrazo(tinta, 3f, pose.impacto.coerceIn(0f, 1f))
                    canvas.drawLine(cx - 12f, cy - 12f, cx - 7f, cy - 7f, trazo)
                    canvas.drawLine(cx, cy - 19f, cx, cy - 11f, trazo)
                    canvas.drawLine(cx + 12f, cy - 12f, cx + 7f, cy - 7f, trazo)
                }
            }
            Brazos.MUSCULO -> {
                curva(canvas, 40f, 88f, 14f, 110f, 14f, 96f)
                curva(canvas, 14f, 96f, 14f, 72f, 24f, 52f)
                guante(canvas, 24f, 52f, Guante.PUNO)
                curva(canvas, 160f, 88f, 186f, 110f, 186f, 96f)
                curva(canvas, 186f, 96f, 186f, 72f, 176f, 52f)
                guante(canvas, 176f, 52f, Guante.PUNO)
                prepararTrazo(tinta, 3f)
                canvas.drawLine(2f, 66f, 7f, 62f, trazo)
                canvas.drawLine(0f, 78f, 6f, 78f, trazo)
                canvas.drawLine(198f, 66f, 193f, 62f, trazo)
                canvas.drawLine(200f, 78f, 194f, 78f, trazo)
            }
            Brazos.HOLA -> {
                curva(canvas, 40f, 92f, 20f, 96f, 14f, 116f)
                guante(canvas, 14f, 118f)
                val guardado = canvas.save()
                canvas.rotate(pose.ondeo, 160f, 84f)
                curva(canvas, 160f, 84f, 184f, 74f, 188f, 46f)
                guante(canvas, 188f, 42f)
                canvas.restoreToCount(guardado)
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
            Brazos.ABAJO -> {
                curva(canvas, 40f, 94f, 28f, 114f, 30f, 140f)
                guante(canvas, 30f, 140f)
                curva(canvas, 160f, 94f, 172f, 114f, 170f, 140f)
                guante(canvas, 170f, 140f)
            }
            Brazos.SENALA -> {
                val radianes = pose.anguloSenala * PI / 180.0
                val dx = cos(radianes).toFloat()
                val dy = sin(radianes).toFloat()
                // Elegir el hombro según la dirección evita cruzar el disco con el brazo.
                val izquierda = dx < 0f
                val lado = if (izquierda) -1f else 1f
                val hombroX = if (izquierda) 40f else 160f
                val manoX = hombroX + 52f * dx
                val manoY = 86f + 52f * dy
                curva(canvas, hombroX, 86f, hombroX + 26f * dx - 5f * dy * lado,
                    86f + 26f * dy + 5f * dx * lado, manoX, manoY)
                val guardado = canvas.save()
                canvas.rotate(pose.anguloSenala, manoX, manoY)
                elipse(canvas, manoX + 9f, manoY, 9f, 3.5f, blanco, 3f)
                guante(canvas, manoX, manoY)
                canvas.restoreToCount(guardado)
                if (izquierda) {
                    curva(canvas, 160f, 86f, 190f, 105f, 170f, 120f)
                    guante(canvas, 170f, 120f)
                } else {
                    curva(canvas, 40f, 86f, 10f, 105f, 30f, 120f)
                    guante(canvas, 30f, 120f)
                }
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
        if (ojos == Ojos.TRISTE) {
            curva(canvas, 65f, 53f, 76f, 49f, 88f, 45f, 4.5f * s)
            curva(canvas, 112f, 45f, 124f, 49f, 135f, 53f, 4.5f * s)
        }
        ojo(canvas, 78f, if (ojos == Ojos.GUINO) Ojos.NORMAL else ojos, parpadeo)
        ojo(canvas, 122f, if (ojos == Ojos.GUINO) Ojos.FELIZ else ojos, parpadeo)
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
                if (ojos == Ojos.TRISTE) {
                    ovalo.set(-11f * s, -13f * s, 11f * s, 13f * s)
                    camino.reset()
                    camino.arcTo(ovalo, 180f, 180f)
                    camino.close()
                    relleno.color = 0xff8f9298.toInt()
                    canvas.drawPath(camino, relleno)
                    prepararTrazo(tinta, 3.5f * s)
                    canvas.drawPath(camino, trazo)
                }
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
            Boca.TRISTE -> curva(canvas, 87f, 108f, 100f, 96f, 113f, 108f, 4.5f)
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
