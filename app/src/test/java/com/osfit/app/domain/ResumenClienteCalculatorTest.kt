package com.osfit.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class ResumenClienteCalculatorTest {

    @Test
    fun `numeroSemanaDelMes cuenta los viernes transcurridos en el mes`() {
        assertEquals(1, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 1)))
        assertEquals(2, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 8)))
        assertEquals(3, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 15)))
        assertEquals(5, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 29)))
    }

    @Test
    fun `numeroSemanaDelMes con una fecha que no es viernes cuenta los viernes ya pasados`() {
        // 20 de marzo 2024 es miércoles; ya pasaron los viernes 1, 8 y 15 (3 viernes)
        assertEquals(3, ResumenClienteCalculator.numeroSemanaDelMes(LocalDate.of(2024, 3, 20)))
    }

    @Test
    fun `rangoSemanal arma el rango lunes-viernes de la semana de la fecha dada`() {
        // 20 de marzo 2024 es miércoles, su semana va del 18 (lunes) al 22 (viernes)
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        assertEquals(LocalDate.of(2024, 3, 18), rango.inicio)
        assertEquals(LocalDate.of(2024, 3, 22), rango.fin)
        assertEquals(TipoResumen.SEMANAL, rango.tipo)
        assertEquals("Semana 4 de marzo", rango.encabezado)
    }

    @Test
    fun `rangoMensual arma el rango del mes completo`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        assertEquals(LocalDate.of(2024, 3, 1), rango.inicio)
        assertEquals(LocalDate.of(2024, 3, 31), rango.fin)
        assertEquals(TipoResumen.MENSUAL, rango.tipo)
        assertEquals("Mes de marzo", rango.encabezado)
    }
}
