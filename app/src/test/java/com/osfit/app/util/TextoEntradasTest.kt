package com.osfit.app.util

import java.time.Instant
import java.time.ZoneId
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

    @Test
    fun `revocado dice la fecha en la zona del gimnasio`() {
        val momento = Instant.parse("2026-10-11T03:00:00Z") // 10 de octubre, 8 pm en Mazatlán
        assertEquals(
            "Acceso revocado el 10 de octubre de 2026",
            TextoEntradas.revocado(momento, ZoneId.of("America/Mazatlan"))
        )
    }

    private val mazatlan = ZoneId.of("America/Mazatlan")

    @Test
    fun `entrada con hora de la tarde en iPhone`() {
        // 02:42 UTC del 11 = 7:42 pm del 10 en Mazatlán (UTC-7).
        val cuando = Instant.parse("2026-10-11T02:42:00Z")
        assertEquals("10 oct, 7:42 pm · iPhone", TextoEntradas.entrada(cuando, "ios", mazatlan))
    }

    @Test
    fun `entrada de la mañana en Android, con minutos de un dígito`() {
        val cuando = Instant.parse("2026-10-09T16:05:00Z") // 9:05 am en Mazatlán
        assertEquals("9 oct, 9:05 am · Android", TextoEntradas.entrada(cuando, "android", mazatlan))
    }

    @Test
    fun `mediodía y medianoche en formato de 12 horas`() {
        assertEquals(
            "10 oct, 12:00 pm · iPhone",
            TextoEntradas.entrada(Instant.parse("2026-10-10T19:00:00Z"), "ios", mazatlan)
        )
        assertEquals(
            "10 oct, 12:30 am · iPhone",
            TextoEntradas.entrada(Instant.parse("2026-10-10T07:30:00Z"), "ios", mazatlan)
        )
    }

    @Test
    fun `una computadora u otra cosa es otro dispositivo`() {
        val cuando = Instant.parse("2026-10-11T02:42:00Z")
        assertEquals(
            "10 oct, 7:42 pm · Otro dispositivo",
            TextoEntradas.entrada(cuando, "otro", mazatlan)
        )
    }

    @Test
    fun `sin hora no se inventa una`() {
        assertEquals("Sin hora · iPhone", TextoEntradas.entrada(null, "ios", mazatlan))
    }
}
