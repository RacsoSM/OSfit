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

    // GEMELO de los casos de `cupo.test.ts`. Los mismos números, para que los dos lados no
    // se separen sin que nadie lo note.
    @Test
    fun `el castigo baja el maximo del mes a 2`() {
        assertEquals(2, CupoRevivesCalculator.disponiblesEnElMes(emptyList(), "2026-09", 1))
    }

    @Test
    fun `sin castigo el maximo sigue siendo 3`() {
        assertEquals(3, CupoRevivesCalculator.disponiblesEnElMes(emptyList(), "2026-09", 0))
    }

    @Test
    fun `con castigo y dos gastadas quedan 0`() {
        val asistencias = listOf(
            falta("2026-09-01", porCliente = true),
            falta("2026-09-02", porCliente = true)
        )
        assertEquals(0, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09", 1))
    }

    @Test
    fun `sin tercer parametro se comporta como antes`() {
        val asistencias = listOf(
            falta("2026-09-01", porCliente = true)
        )
        assertEquals(2, CupoRevivesCalculator.disponiblesEnElMes(asistencias, "2026-09"))
    }

    /** [dias] asistencias seguidas (todos los días) desde [desde]. */
    private fun corrida(desde: String, dias: Int): List<Asistencia> =
        (0 until dias).map {
            Asistencia(
                clienteId = "ana",
                fecha = java.time.LocalDate.parse(desde).plusDays(it.toLong()).toString(),
                asistio = true
            )
        }

    // Revive extra por racha de 30 (entrenador, 2026-10-17). Mismos casos que `cupo.test.ts`
    // en la web y `maximoDeRevives` en `functions/src/jugarRuleta.test.ts`.
    @Test
    fun `con 29 son 3 y con 30 son 4`() {
        assertEquals(3, CupoRevivesCalculator.maximoPorMes(corrida("2026-08-03", 29)))
        assertEquals(4, CupoRevivesCalculator.maximoPorMes(corrida("2026-08-03", 30)))
    }

    @Test
    fun `el revive extra se conserva aunque la racha se rompa`() {
        val historial = corrida("2026-08-03", 30) + corrida("2026-09-03", 2)
        assertEquals(4, CupoRevivesCalculator.maximoPorMes(historial))
    }

    @Test
    fun `el entrenador lo puede dar a mano aunque no haya llegado a 30`() {
        assertEquals(4, CupoRevivesCalculator.maximoPorMes(corrida("2026-08-03", 5), otorgado = true))
        assertEquals(3, CupoRevivesCalculator.disponiblesEnElMes(corrida("2026-08-03", 5), "2026-10", castigo = 1, otorgado = true))
    }

    @Test
    fun `el castigo de la ruleta se le resta al 4`() {
        val historial = corrida("2026-08-03", 30) + falta("2026-10-06", porCliente = true)
        assertEquals(3, CupoRevivesCalculator.disponiblesEnElMes(historial, "2026-10"))
        assertEquals(2, CupoRevivesCalculator.disponiblesEnElMes(historial, "2026-10", castigo = 1))
    }
}
