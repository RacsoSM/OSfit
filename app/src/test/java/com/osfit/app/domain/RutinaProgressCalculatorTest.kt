package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RutinaProgressCalculatorTest {

    @Test
    fun `falta no cambia el diaActualIndex`() {
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = false,
            diaActualIndexPrevio = 2,
            diaRutinaRealizado = null,
            totalDias = 5
        )
        assertEquals(2, resultado)
    }

    @Test
    fun `asiste al dia que tocaba y avanza al siguiente`() {
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = 1,
            diaRutinaRealizado = 1,
            totalDias = 5
        )
        assertEquals(2, resultado)
    }

    @Test
    fun `asiste al ultimo dia del ciclo y vuelve al dia 1`() {
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = 4,
            diaRutinaRealizado = 4,
            totalDias = 5
        )
        assertEquals(0, resultado)
    }

    @Test
    fun `entrenador anula el dia sugerido y avanza segun el dia realizado, no el que tocaba`() {
        // Tocaba el día 1 (index 1), pero el cliente en realidad hizo el día 3 (index 3, pierna glúteo)
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = 1,
            diaRutinaRealizado = 3,
            totalDias = 5
        )
        assertEquals(4, resultado)
    }

    @Test
    fun `falto el dia 3, la siguiente vez que asista sigue tocando el dia 3`() {
        // Simula la secuencia completa del ejemplo del spec:
        // faltó cuando tocaba día 3 (index 2) -> index no cambia
        val trasFalta = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = false,
            diaActualIndexPrevio = 2,
            diaRutinaRealizado = null,
            totalDias = 5
        )
        assertEquals(2, trasFalta)
        // en su siguiente sesión asiste e hizo el día pendiente (index 2) -> avanza al 3
        val trasAsistir = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = trasFalta,
            diaRutinaRealizado = 2,
            totalDias = 5
        )
        assertEquals(3, trasAsistir)
    }

    @Test
    fun `ciclo de un solo dia siempre vuelve al dia 1`() {
        val resultado = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = true,
            diaActualIndexPrevio = 0,
            diaRutinaRealizado = 0,
            totalDias = 1
        )
        assertEquals(0, resultado)
    }

    @Test
    fun `lanza excepcion si asistio es true sin diaRutinaRealizado`() {
        assertThrows(IllegalArgumentException::class.java) {
            RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
                asistio = true,
                diaActualIndexPrevio = 0,
                diaRutinaRealizado = null,
                totalDias = 5
            )
        }
    }

    @Test
    fun `lanza excepcion si totalDias es cero o negativo`() {
        assertThrows(IllegalArgumentException::class.java) {
            RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
                asistio = false,
                diaActualIndexPrevio = 0,
                diaRutinaRealizado = null,
                totalDias = 0
            )
        }
    }

    @Test
    fun `lanza excepcion si diaRutinaRealizado esta fuera de rango`() {
        assertThrows(IllegalArgumentException::class.java) {
            RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
                asistio = true,
                diaActualIndexPrevio = 0,
                diaRutinaRealizado = 5,
                totalDias = 5
            )
        }
    }

    @Test
    fun `sin pendiente, el dia efectivo es el dia actual`() {
        val resultado = RutinaProgressCalculator.diaEfectivo(
            diaActualIndex = 2, diaPendienteIndex = null, diaPendienteFecha = null, hoy = "2026-08-19"
        )
        assertEquals(2, resultado)
    }

    @Test
    fun `pendiente del mismo dia que hoy, no se aplica todavia`() {
        val resultado = RutinaProgressCalculator.diaEfectivo(
            diaActualIndex = 2, diaPendienteIndex = 3, diaPendienteFecha = "2026-08-19", hoy = "2026-08-19"
        )
        assertEquals(2, resultado)
    }

    @Test
    fun `pendiente de un dia anterior a hoy, ya se aplica`() {
        val resultado = RutinaProgressCalculator.diaEfectivo(
            diaActualIndex = 2, diaPendienteIndex = 3, diaPendienteFecha = "2026-08-19", hoy = "2026-08-20"
        )
        assertEquals(3, resultado)
    }

    @Test
    fun `sin pendiente previo, corregir un dia pasado si actualiza el pendiente`() {
        val resultado = RutinaProgressCalculator.debeActualizarPendiente(
            fecha = "2026-08-10", diaPendienteFechaActual = null
        )
        assertEquals(true, resultado)
    }

    @Test
    fun `corregir una fecha mas vieja que el pendiente actual no lo pisa`() {
        // Se corrige el día realizado del 10 de agosto, pero ya hay un pendiente
        // generado por una asistencia más reciente (20 de agosto): no debe pisarse.
        val resultado = RutinaProgressCalculator.debeActualizarPendiente(
            fecha = "2026-08-10", diaPendienteFechaActual = "2026-08-20"
        )
        assertEquals(false, resultado)
    }

    @Test
    fun `corregir la misma fecha del pendiente actual si lo actualiza`() {
        val resultado = RutinaProgressCalculator.debeActualizarPendiente(
            fecha = "2026-08-20", diaPendienteFechaActual = "2026-08-20"
        )
        assertEquals(true, resultado)
    }

    @Test
    fun `corregir una fecha mas nueva que el pendiente actual si lo actualiza`() {
        val resultado = RutinaProgressCalculator.debeActualizarPendiente(
            fecha = "2026-08-21", diaPendienteFechaActual = "2026-08-20"
        )
        assertEquals(true, resultado)
    }

    @Test
    fun `al reiniciar el dia, solo se limpia el pendiente de clientes con esa fecha exacta`() {
        val clientes = listOf(
            Cliente(id = "a", diaPendienteFecha = "2026-08-20"),
            Cliente(id = "b", diaPendienteFecha = "2026-08-19"),
            Cliente(id = "c", diaPendienteFecha = null)
        )
        val resultado = RutinaProgressCalculator.clientesConPendienteEnFecha(clientes, "2026-08-20")
        assertEquals(listOf("a"), resultado)
    }

    @Test
    fun `al reiniciar el dia, si nadie tiene pendiente en esa fecha no devuelve nada`() {
        val clientes = listOf(
            Cliente(id = "a", diaPendienteFecha = "2026-08-19"),
            Cliente(id = "b", diaPendienteFecha = null)
        )
        val resultado = RutinaProgressCalculator.clientesConPendienteEnFecha(clientes, "2026-08-20")
        assertEquals(emptyList<String>(), resultado)
    }
}
