package com.osfit.app.util

import java.time.Instant
import java.time.temporal.ChronoUnit
import org.junit.Assert.assertEquals
import org.junit.Test

class TextoEntradasTest {

    private val ahora: Instant = Instant.parse("2026-09-16T18:00:00Z")

    @Test
    fun `sin entradas lo dice con palabras, no con un cero`() {
        assertEquals("Todavía no ha abierto su página", TextoEntradas.resumen(0, null, ahora))
    }

    @Test
    fun `una entrada va en singular`() {
        assertEquals("1 entrada · hoy", TextoEntradas.resumen(1, ahora, ahora))
    }

    @Test
    fun `varias entradas, con la ultima de hoy`() {
        val haceUnRato = ahora.minus(3, ChronoUnit.HOURS)
        assertEquals("14 entradas · hoy", TextoEntradas.resumen(14, haceUnRato, ahora))
    }

    @Test
    fun `ayer se dice ayer`() {
        val ayer = ahora.minus(1, ChronoUnit.DAYS)
        assertEquals("5 entradas · ayer", TextoEntradas.resumen(5, ayer, ahora))
    }

    @Test
    fun `mas atras se cuenta en dias`() {
        val haceDias = ahora.minus(9, ChronoUnit.DAYS)
        assertEquals("5 entradas · hace 9 días", TextoEntradas.resumen(5, haceDias, ahora))
    }

    /**
     * Los accesos creados antes de que existiera el contador llegan sin la marca. El número
     * sigue siendo cierto; lo que no sabemos es cuándo fue la última, y decir "hoy" por
     * defecto sería inventarlo.
     */
    @Test
    fun `con entradas pero sin marca, no se inventa la fecha`() {
        assertEquals("3 entradas", TextoEntradas.resumen(3, null, ahora))
    }
}
