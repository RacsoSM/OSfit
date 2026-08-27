package com.osfit.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class TiempoGymCalculatorTest {

    @Test
    fun `duracion normal se calcula en minutos`() {
        val inicio = 0L
        val fin = 45 * 60_000L
        val resultado = TiempoGymCalculator.calcularDuracionMinutos(inicio, fin)
        assertEquals(45, resultado)
    }

    @Test
    fun `duracion que supera el tope se limita a 180 minutos`() {
        val inicio = 0L
        val fin = 5 * 60 * 60_000L // 5 horas, se olvidaron de detenerlo
        val resultado = TiempoGymCalculator.calcularDuracionMinutos(inicio, fin)
        assertEquals(180, resultado)
    }

    @Test
    fun `duracion exacta al tope no se recorta`() {
        val inicio = 0L
        val fin = 180 * 60_000L
        val resultado = TiempoGymCalculator.calcularDuracionMinutos(inicio, fin)
        assertEquals(180, resultado)
    }

    @Test
    fun `fin anterior a inicio nunca da duracion negativa`() {
        val inicio = 10 * 60_000L
        val fin = 5 * 60_000L
        val resultado = TiempoGymCalculator.calcularDuracionMinutos(inicio, fin)
        assertEquals(0, resultado)
    }

    @Test
    fun `tope personalizado se respeta`() {
        val inicio = 0L
        val fin = 60 * 60_000L
        val resultado = TiempoGymCalculator.calcularDuracionMinutos(inicio, fin, topeMinutos = 30)
        assertEquals(30, resultado)
    }
}
