package com.osfit.app.video

import kotlin.math.abs
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
    private fun opacidad(ms: Long) = ResumenFrameRenderer.opacidadEntrada(ms)
    private fun rotacion(ms: Long) = ResumenFrameRenderer.rotacionEntrada(ms)
    private fun onda(ms: Long) = ResumenFrameRenderer.ondaExpansiva(ms)

    private val aterrizaje = MEDALLA_INICIO_GRUPAL_MS + MEDALLA_FADE_MS

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

    @Test
    fun `la medalla ya es opaca mientras todavia esta creciendo`() {
        // Éste es el test del fallo real de la primera pasada: la opacidad y la escala
        // compartían los mismos 600ms, así que la medalla hacía casi todo su crecimiento
        // siendo transparente. Se animaba, pero no se veía animarse.
        assertEquals(0f, opacidad(MEDALLA_INICIO_GRUPAL_MS), 0.001f)
        val instanteOpaca = (MEDALLA_INICIO_GRUPAL_MS..aterrizaje).first { opacidad(it) >= 1f }
        assertTrue("la medalla tiene que ser opaca antes de aterrizar", instanteOpaca < aterrizaje)

        val crecimientoQueQuedaVisible = ESCALA_SOBREPASO - escala(instanteOpaca)
        assertTrue(
            "cuando se vuelve opaca ya casi terminó de crecer: quedan $crecimientoQueQuedaVisible",
            crecimientoQueQuedaVisible > 0.30f
        )
    }

    @Test
    fun `entra desde un tamano mucho menor del que aterriza`() {
        assertTrue(
            "si arranca cerca de 1x no hay entrada que ver",
            ESCALA_SOBREPASO - ESCALA_ENTRADA_INICIAL > 1f
        )
    }

    @Test
    fun `la rotacion arranca torcida y se endereza en cero exacto`() {
        assertTrue("sin inclinación inicial no hay gesto", abs(rotacion(MEDALLA_INICIO_GRUPAL_MS)) > 5f)
        val finAsentamiento = aterrizaje + ASENTAMIENTO_MS
        assertEquals(0f, rotacion(finAsentamiento), 0.0001f)
        assertEquals(0f, rotacion(MENSAJE_MEDALLA_INICIO_MS), 0.0001f)
        assertEquals(0f, rotacion(MENSAJE_MEDALLA_INICIO_MS + 10_000), 0.0001f)
    }

    @Test
    fun `la onda expansiva sale en el aterrizaje y se apaga antes del mensaje`() {
        assertEquals("no hay onda antes del golpe", 0f, onda(aterrizaje - 1), 0.0001f)
        assertTrue("tiene que haber onda justo después del golpe", onda(aterrizaje + 100) > 0f)
        assertEquals("y tiene que apagarse", 0f, onda(aterrizaje + ONDA_MS), 0.0001f)
        assertTrue(
            "la onda no puede seguir viva cuando arranca el mensaje",
            aterrizaje + ONDA_MS < MENSAJE_MEDALLA_INICIO_MS
        )
    }
}
