package com.osfit.app.domain

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PeriodosQuincenalesTest {

    @Test
    fun `la primera quincena de la lista es la siguiente a la actual`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 3)
        assertEquals(LocalDate.of(2026, 9, 16), periodos.first().inicio)
    }

    @Test
    fun `la segunda es la quincena actual`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 3)
        assertEquals(LocalDate.of(2026, 9, 1), periodos[1].inicio)
    }

    @Test
    fun `devuelve la siguiente mas las que se pidieron hacia atras`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 12)
        assertEquals(13, periodos.size)
    }

    @Test
    fun `las quincenas van de mas nueva a mas vieja, sin repetir`() {
        val inicios = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 12).map { it.inicio }
        assertEquals(inicios.sortedDescending(), inicios)
        assertEquals(inicios.size, inicios.toSet().size)
    }

    /** Cruzar el 1ro de enero hacia atrás tiene que caer en la 2da quincena de diciembre del
     *  año anterior, no en un mes 0. */
    @Test
    fun `cruza el cambio de ano hacia atras`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 1, 3), haciaAtras = 2)
        assertEquals(
            listOf(
                LocalDate.of(2026, 1, 16),
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2025, 12, 16)
            ),
            periodos.map { it.inicio }
        )
    }

    /** Partiendo de la 2da quincena, la siguiente es la 1ra del mes que viene. */
    @Test
    fun `cruza el cambio de mes hacia adelante`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 20), haciaAtras = 1)
        assertEquals(LocalDate.of(2026, 10, 1), periodos.first().inicio)
        assertEquals(LocalDate.of(2026, 9, 16), periodos[1].inicio)
    }

    @Test
    fun `cada periodo trae el encabezado que usa el resumen`() {
        val periodos = PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 1)
        assertEquals("2da quincena de septiembre", periodos.first().encabezado)
        assertEquals("1ra quincena de septiembre", periodos[1].encabezado)
    }

    @Test
    fun `todos los periodos son quincenales`() {
        PeriodosQuincenales.ultimos(LocalDate.of(2026, 9, 9), haciaAtras = 5).forEach {
            assertTrue(it.tipo == TipoResumen.QUINCENAL)
        }
    }
}
