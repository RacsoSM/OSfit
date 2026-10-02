package com.osfit.app.video

import org.junit.Assert.*
import org.junit.Test

class MancuGraficasAnimacionTest {
    @Test fun `el angulo usa derecha cero y arriba menos noventa`() {
        assertEquals(0f, MancuAnimacion.anguloHacia(10f, 20f, 30f, 20f), 0.001f)
        assertEquals(-90f, MancuAnimacion.anguloHacia(10f, 20f, 10f, 0f), 0.001f)
        assertEquals(90f, MancuAnimacion.anguloHacia(10f, 20f, 10f, 40f), 0.001f)
        assertEquals(180f, MancuAnimacion.anguloHacia(10f, 20f, 0f, 20f), 0.001f)
        assertEquals(0f, MancuAnimacion.anguloHacia(10f, 20f, 10f, 20f), 0.001f)
    }

    @Test fun `el barrido termina a los mil doscientos y desacelera`() {
        assertEquals(0f, MancuAnimacion.barridoDona(-1L), 0f)
        assertEquals(0f, MancuAnimacion.barridoDona(0L), 0f)
        assertEquals(315f, MancuAnimacion.barridoDona(600L), 0.001f)
        assertEquals(360f, MancuAnimacion.barridoDona(1200L), 0f)
        assertEquals(360f, MancuAnimacion.barridoDona(2000L), 0f)
    }

    @Test fun `cada etiqueta nace cuando se completa su rebanada`() {
        for (angulo in listOf(0f, 90f, 180f, 270f, 360f)) {
            val llegada = MancuAnimacion.llegadaBarrido(angulo)
            assertTrue(MancuAnimacion.barridoDona(llegada) + 0.001f >= angulo)
            if (llegada > 0) assertTrue(MancuAnimacion.barridoDona(llegada - 1) < angulo)
        }
    }

    @Test fun `la rebanada sale rebota y conserva los dieciocho pixeles`() {
        assertEquals(0f, MancuAnimacion.salidaRebanada(-1L), 0f)
        assertEquals(0f, MancuAnimacion.salidaRebanada(0L), 0f)
        assertTrue(MancuAnimacion.salidaRebanada(400L) > 18f)
        assertEquals(18f, MancuAnimacion.salidaRebanada(700L), 0f)
        assertEquals(18f, MancuAnimacion.salidaRebanada(9000L), 0f)
    }
}
