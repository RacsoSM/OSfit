package com.osfit.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Fechas de referencia: 2026-09-07 es lunes, 2026-09-11 viernes, 2026-09-12 sábado,
 * 2026-09-13 domingo y 2026-09-14 el lunes siguiente.
 */
class SemanaDeRutinaTest {

    @Test
    fun `el lunes es su propio lunes`() {
        assertEquals("2026-09-07", SemanaDeRutina.lunesDe("2026-09-07"))
    }

    @Test
    fun `entre semana devuelve el lunes de esa semana`() {
        assertEquals("2026-09-07", SemanaDeRutina.lunesDe("2026-09-11"))
    }

    @Test
    fun `el sabado sigue perteneciendo a la semana que empezo el lunes`() {
        assertEquals("2026-09-07", SemanaDeRutina.lunesDe("2026-09-12"))
    }

    @Test
    fun `el domingo cierra su semana y no abre la siguiente`() {
        assertEquals("2026-09-07", SemanaDeRutina.lunesDe("2026-09-13"))
    }

    @Test
    fun `el lunes siguiente ya es otra semana`() {
        assertEquals("2026-09-14", SemanaDeRutina.lunesDe("2026-09-14"))
    }

    @Test
    fun `el domingo anterior es el dia previo al lunes de la semana`() {
        assertEquals("2026-09-06", SemanaDeRutina.domingoAnterior("2026-09-07"))
        assertEquals("2026-09-06", SemanaDeRutina.domingoAnterior("2026-09-11"))
        assertEquals("2026-09-06", SemanaDeRutina.domingoAnterior("2026-09-13"))
        assertEquals("2026-09-13", SemanaDeRutina.domingoAnterior("2026-09-14"))
    }

    @Test
    fun `las semanas se comparan lexicograficamente igual que cronologicamente`() {
        val anterior = SemanaDeRutina.lunesDe("2026-09-11")
        val actual = SemanaDeRutina.lunesDe("2026-09-14")
        assertEquals(true, anterior < actual)
    }
}
