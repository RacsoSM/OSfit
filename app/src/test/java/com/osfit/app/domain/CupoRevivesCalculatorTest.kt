package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * El cupo se cuenta, no se guarda: si el entrenador desmarca una justificada desde su app,
 * el cupo se le devuelve al cliente solo. Estos tests fijan esa forma de contar.
 */
class CupoRevivesCalculatorTest {

    private fun falta(fecha: String, porCliente: Boolean, justificada: Boolean = true) =
        Asistencia(
            clienteId = "ana",
            fecha = fecha,
            asistio = false,
            justificada = justificada,
            justificadaPorCliente = porCliente
        )

    @Test
    fun `cuenta solo las justificadas por el cliente`() {
        val asistencias = listOf(
            falta("2026-09-01", porCliente = true),
            falta("2026-09-02", porCliente = true),
            falta("2026-09-03", porCliente = false)
        )
        assertEquals(2, CupoRevivesCalculator.gastadosEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `el soborno del entrenador no gasta cupo del cliente`() {
        val asistencias = listOf(falta("2026-09-01", porCliente = false))
        assertEquals(0, CupoRevivesCalculator.gastadosEnElMes(asistencias, "2026-09"))
        assertEquals(3, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `ignora las de otros meses`() {
        val asistencias = listOf(
            falta("2026-08-31", porCliente = true),
            falta("2026-10-01", porCliente = true),
            falta("2026-09-15", porCliente = true)
        )
        assertEquals(1, CupoRevivesCalculator.gastadosEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `con tres gastadas quedan cero disponibles`() {
        val asistencias = listOf(
            falta("2026-09-01", porCliente = true),
            falta("2026-09-02", porCliente = true),
            falta("2026-09-03", porCliente = true)
        )
        assertEquals(0, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `nunca devuelve disponibles negativos`() {
        val asistencias = (1..5).map { falta("2026-09-0$it", porCliente = true) }
        assertEquals(0, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09"))
    }

    @Test
    fun `una justificada que el entrenador desmarco deja de contar`() {
        val asistencias = listOf(falta("2026-09-01", porCliente = true, justificada = false))
        assertEquals(0, CupoRevivesCalculator.gastadosEnElMes(asistencias, "2026-09"))
    }
}
