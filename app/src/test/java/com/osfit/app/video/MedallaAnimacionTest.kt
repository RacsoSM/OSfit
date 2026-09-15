package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * La coreografía de la medalla es la única del video que celebra algo, y sus dos curvas
 * —escala y destello— son funciones puras del tiempo transcurrido dentro de la escena. Se
 * prueban acá porque dibujarlas requiere un Canvas y estos tests no lo necesitan: lo que
 * puede romperse es la forma de la curva, no el trazo.
 */
class MedallaAnimacionTest {

    /** Última escala que dibuja el frame anterior al del mensaje. Ver el test de asentamiento. */
    private fun escala(ms: Long) = ResumenFrameRenderer.escalaEntrada(ms)

    @Test
    fun `antes de que la medalla entre, la escala es la inicial`() {
        assertEquals(ESCALA_ENTRADA_INICIAL, escala(0), 0.001f)
        assertEquals(ESCALA_ENTRADA_INICIAL, escala(MEDALLA_INICIO_GRUPAL_MS), 0.001f)
    }

    @Test
    fun `al aterrizar sobrepasa el tamano final en vez de quedarse en el`() {
        val aterrizaje = MEDALLA_INICIO_GRUPAL_MS + MEDALLA_FADE_MS
        assertEquals(ESCALA_SOBREPASO, escala(aterrizaje), 0.001f)
        assertTrue("el sobrepaso tiene que pasarse de 1f", escala(aterrizaje) > 1f)
    }

    @Test
    fun `la entrada crece sin retroceder hasta el aterrizaje`() {
        val aterrizaje = MEDALLA_INICIO_GRUPAL_MS + MEDALLA_FADE_MS
        var previa = escala(MEDALLA_INICIO_GRUPAL_MS)
        for (ms in MEDALLA_INICIO_GRUPAL_MS..aterrizaje step 33) {
            val actual = escala(ms)
            assertTrue("la entrada no puede retroceder en $ms", actual >= previa - 0.001f)
            previa = actual
        }
    }

    @Test
    fun `despues del sobrepaso late por debajo del tamano final`() {
        val aterrizaje = MEDALLA_INICIO_GRUPAL_MS + MEDALLA_FADE_MS
        val minima = (aterrizaje..aterrizaje + ASENTAMIENTO_MS step 33).minOf { escala(it) }
        assertTrue("sin cruzar por debajo de 1f no hay rebote, solo decaimiento", minima < 0.99f)
    }

    @Test
    fun `se asienta en 1f exacto antes de que arranque el mensaje`() {
        val finAsentamiento = MEDALLA_INICIO_GRUPAL_MS + MEDALLA_FADE_MS + ASENTAMIENTO_MS
        assertTrue(
            "el latido tiene que morir antes del mensaje, o la medalla tiembla debajo de el",
            finAsentamiento < MENSAJE_MEDALLA_INICIO_MS
        )
        assertEquals(1f, escala(finAsentamiento), 0.0001f)
        assertEquals(1f, escala(MENSAJE_MEDALLA_INICIO_MS), 0.0001f)
        assertEquals(1f, escala(MENSAJE_MEDALLA_INICIO_MS + 10_000), 0.0001f)
    }

    @Test
    fun `el destello pica justo en el aterrizaje y despues se asienta`() {
        val aterrizaje = MEDALLA_INICIO_GRUPAL_MS + MEDALLA_FADE_MS
        assertEquals(DESTELLO_PICO, ResumenFrameRenderer.intensidadDestello(aterrizaje), 0.001f)
        assertEquals(1f, ResumenFrameRenderer.intensidadDestello(aterrizaje + DESTELLO_MS), 0.001f)
        assertEquals(1f, ResumenFrameRenderer.intensidadDestello(0), 0.001f)
    }

    @Test
    fun `el destello y el sobrepaso pican en el mismo instante`() {
        val aterrizaje = MEDALLA_INICIO_GRUPAL_MS + MEDALLA_FADE_MS
        val picoEscala = (MEDALLA_INICIO_GRUPAL_MS..MENSAJE_MEDALLA_INICIO_MS step 33)
            .maxBy { escala(it) }
        assertTrue(
            "el golpe de luz y el de escala tienen que caer juntos; escala pico en $picoEscala",
            kotlin.math.abs(picoEscala - aterrizaje) <= 33
        )
    }
}
