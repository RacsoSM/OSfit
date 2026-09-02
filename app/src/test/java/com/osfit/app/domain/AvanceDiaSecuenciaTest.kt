package com.osfit.app.domain

import com.osfit.app.data.fake.FakeAsistenciaRepository
import com.osfit.app.data.fake.FakeClienteRepository
import com.osfit.app.data.model.Cliente
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Reproduce la secuencia completa "asistencia -> pasa el día -> iniciar tiempo" sobre los
 * repositorios en memoria, para verificar que el día efectivo avanza de forma monótona y
 * no salta hacia atrás al registrar la asistencia del día siguiente.
 */
class AvanceDiaSecuenciaTest {

    private val dia1 = "2026-09-02"
    private val dia2 = "2026-09-03"
    private val dia3 = "2026-09-04"

    private suspend fun cliente(repo: FakeClienteRepository, id: String): Cliente =
        repo.observarClientes().first().first { it.id == id }

    private fun diaEfectivo(cliente: Cliente, hoy: String): Int =
        RutinaProgressCalculator.diaEfectivo(
            cliente.diaActualIndex, cliente.diaPendienteIndex, cliente.diaPendienteFecha, hoy
        )

    @Test
    fun `iniciar tiempo al dia siguiente no regresa el dia efectivo al valor anterior`() = runBlocking {
        val clientes = FakeClienteRepository()
        val asistencias = FakeAsistenciaRepository(clientes)
        // Ana: rutina de 4 días, diaActualIndex = 1, sin pendiente.
        val id = "1"

        val inicial = cliente(clientes, id)
        val total = inicial.rutinaAsignada!!.dias.size
        assertEquals("día efectivo inicial", 1, diaEfectivo(inicial, dia1))

        // Día 1: se marca la asistencia del día que tocaba (índice 1).
        asistencias.registrarAsistencia(
            clienteId = id,
            fecha = dia1,
            asistio = true,
            diaActualIndexPrevio = 1,
            diaRutinaRealizado = 1,
            totalDiasRutina = total,
            diaPendienteFechaActual = inicial.diaPendienteFecha,
            nota = ""
        )

        // Durante el mismo día 1 el día efectivo NO debe moverse todavía.
        assertEquals("mismo día, aún no avanza", 1, diaEfectivo(cliente(clientes, id), dia1))

        // Pasa el día: ahora sí aplica el pendiente -> toca el día 2 (índice 2).
        val trasPasarDia = cliente(clientes, id)
        assertEquals("al día siguiente ya avanzó", 2, diaEfectivo(trasPasarDia, dia2))

        // Día 2: se inicia el tiempo (equivale a marcar asistencia del día 2).
        asistencias.iniciarTiempo(
            clienteId = id,
            fecha = dia2,
            diaActualIndexPrevio = diaEfectivo(trasPasarDia, dia2),
            totalDiasRutina = total
        )

        // El día efectivo del día 2 debe SEGUIR siendo 2: se está haciendo ese día,
        // el avance al día 3 solo debe aplicarse cuando pase la fecha.
        assertEquals(
            "iniciar tiempo no debe regresar el día efectivo",
            2,
            diaEfectivo(cliente(clientes, id), dia2)
        )

        // Y al pasar el día debe tocar el día 3 (índice 3).
        assertEquals(
            "al día siguiente toca el día 3",
            3,
            diaEfectivo(cliente(clientes, id), dia3)
        )
    }

    @Test
    fun `iniciar tiempo varios dias seguidos avanza el ciclo y da la vuelta`() = runBlocking {
        val clientes = FakeClienteRepository()
        val asistencias = FakeAsistenciaRepository(clientes)
        // Beto: rutina de 3 días, diaActualIndex = 2 (último del ciclo).
        val id = "2"
        val total = cliente(clientes, id).rutinaAsignada!!.dias.size
        assertEquals(3, total)

        val fechas = listOf(dia1, dia2, dia3)
        // Día efectivo esperado en cada fecha: 2 -> 0 -> 1 (da la vuelta tras el último día).
        val esperados = listOf(2, 0, 1)

        fechas.forEachIndexed { indice, fecha ->
            val actual = cliente(clientes, id)
            val efectivo = diaEfectivo(actual, fecha)
            assertEquals("día efectivo en $fecha", esperados[indice], efectivo)

            asistencias.iniciarTiempo(
                clienteId = id,
                fecha = fecha,
                diaActualIndexPrevio = efectivo,
                totalDiasRutina = total
            )

            // Tras iniciar el tiempo, el día efectivo de ESA fecha no debe moverse.
            assertEquals(
                "iniciar tiempo no mueve el día efectivo de $fecha",
                esperados[indice],
                diaEfectivo(cliente(clientes, id), fecha)
            )
        }
    }

    @Test
    fun `faltar no avanza el ciclo y al dia siguiente sigue tocando el mismo dia`() = runBlocking {
        val clientes = FakeClienteRepository()
        val asistencias = FakeAsistenciaRepository(clientes)
        val id = "1"
        val inicial = cliente(clientes, id)
        val total = inicial.rutinaAsignada!!.dias.size

        // Día 1: asiste al día 1 -> deja pendiente el día 2.
        asistencias.registrarAsistencia(
            clienteId = id, fecha = dia1, asistio = true,
            diaActualIndexPrevio = 1, diaRutinaRealizado = 1, totalDiasRutina = total,
            diaPendienteFechaActual = inicial.diaPendienteFecha, nota = ""
        )
        assertEquals(2, diaEfectivo(cliente(clientes, id), dia2))

        // Día 2: falta. No debe avanzar el ciclo.
        val enDia2 = cliente(clientes, id)
        asistencias.registrarAsistencia(
            clienteId = id, fecha = dia2, asistio = false,
            diaActualIndexPrevio = diaEfectivo(enDia2, dia2), diaRutinaRealizado = null,
            totalDiasRutina = total, diaPendienteFechaActual = enDia2.diaPendienteFecha, nota = ""
        )

        assertEquals("faltar no mueve el día de hoy", 2, diaEfectivo(cliente(clientes, id), dia2))
        assertEquals("tras faltar sigue tocando el día 2", 2, diaEfectivo(cliente(clientes, id), dia3))
    }

    @Test
    fun `iniciar tiempo dos veces el mismo dia no avanza el ciclo dos veces`() = runBlocking {
        val clientes = FakeClienteRepository()
        val asistencias = FakeAsistenciaRepository(clientes)
        val id = "1"
        val total = cliente(clientes, id).rutinaAsignada!!.dias.size

        repeat(2) {
            val actual = cliente(clientes, id)
            asistencias.iniciarTiempo(
                clienteId = id,
                fecha = dia1,
                diaActualIndexPrevio = diaEfectivo(actual, dia1),
                totalDiasRutina = total
            )
        }

        assertEquals("hoy sigue siendo el día 1", 1, diaEfectivo(cliente(clientes, id), dia1))
        assertEquals("mañana toca el día 2, no el 3", 2, diaEfectivo(cliente(clientes, id), dia2))
    }
}
