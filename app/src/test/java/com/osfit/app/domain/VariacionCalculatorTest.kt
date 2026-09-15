package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import org.junit.Assert.assertEquals
import org.junit.Test

/** Unidad: la regla que deduce qué variación de un día del ciclo toca hoy. */
class VariacionCalculatorTest {

    private val hoy = "2026-09-15"

    private fun asistio(fecha: String, dia: Int, variacion: Int?) = Asistencia(
        clienteId = "c",
        fecha = fecha,
        asistio = true,
        diaRutinaRealizado = dia,
        variacionRealizada = variacion
    )

    private fun falto(fecha: String) =
        Asistencia(clienteId = "c", fecha = fecha, asistio = false, diaRutinaRealizado = null)

    private fun toca(dia: Int, asistencias: List<Asistencia>, total: Int, fecha: String = hoy) =
        VariacionCalculator.variacionQueToca(dia, asistencias, fecha, total)

    @Test
    fun `sin asistencias previas toca la primera variacion`() {
        assertEquals(0, toca(dia = 0, asistencias = emptyList(), total = 3))
    }

    @Test
    fun `la siguiente vuelta avanza una posicion`() {
        val previas = listOf(asistio("2026-09-08", dia = 0, variacion = 0))
        assertEquals(1, toca(dia = 0, asistencias = previas, total = 3))
    }

    @Test
    fun `despues de la ultima vuelve a la primera`() {
        val previas = listOf(asistio("2026-09-08", dia = 0, variacion = 2))
        assertEquals(0, toca(dia = 0, asistencias = previas, total = 3))
    }

    @Test
    fun `si ya entreno hoy se queda en la variacion que hizo`() {
        // La clienta abre su página en la mañana, el entrenador le marca asistencia, y los
        // ejercicios no deben cambiarle mientras entrena.
        val previas = listOf(
            asistio("2026-09-08", dia = 0, variacion = 0),
            asistio(hoy, dia = 0, variacion = 1)
        )
        assertEquals(1, toca(dia = 0, asistencias = previas, total = 3))
    }

    @Test
    fun `una falta no avanza la variacion`() {
        val previas = listOf(
            asistio("2026-09-08", dia = 0, variacion = 0),
            falto("2026-09-11")
        )
        assertEquals(1, toca(dia = 0, asistencias = previas, total = 3))
    }

    @Test
    fun `una asistencia sin variacionRealizada cuenta como la primera`() {
        val previas = listOf(asistio("2026-09-08", dia = 0, variacion = null))
        assertEquals(1, toca(dia = 0, asistencias = previas, total = 3))
    }

    @Test
    fun `cada dia del ciclo rota por su cuenta`() {
        val previas = listOf(
            asistio("2026-09-08", dia = 0, variacion = 1),
            asistio("2026-09-09", dia = 1, variacion = 0)
        )
        assertEquals(2, toca(dia = 0, asistencias = previas, total = 3))
        assertEquals(1, toca(dia = 1, asistencias = previas, total = 2))
    }

    @Test
    fun `si se quitan variaciones el indice se acota`() {
        // El documento puede quedar con menos variaciones de las que tenía al calcularse.
        val previas = listOf(asistio("2026-09-08", dia = 0, variacion = 7))
        assertEquals(0, toca(dia = 0, asistencias = previas, total = 2))
    }

    @Test
    fun `un dia sin variaciones siempre es la cero`() {
        val previas = listOf(asistio("2026-09-08", dia = 0, variacion = 3))
        assertEquals(0, toca(dia = 0, asistencias = previas, total = 1))
        assertEquals(0, toca(dia = 0, asistencias = previas, total = 0))
    }

    @Test
    fun `las asistencias futuras no cuentan`() {
        val previas = listOf(
            asistio("2026-09-08", dia = 0, variacion = 0),
            asistio("2026-09-30", dia = 0, variacion = 2)
        )
        assertEquals(1, toca(dia = 0, asistencias = previas, total = 3))
    }
}
