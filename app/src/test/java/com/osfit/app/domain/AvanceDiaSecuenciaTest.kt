package com.osfit.app.domain

import com.osfit.app.domain.EscenarioRutina.Companion.ANA
import com.osfit.app.domain.EscenarioRutina.Companion.BETO
import com.osfit.app.domain.EscenarioRutina.Companion.CARLA
import com.osfit.app.domain.EscenarioRutina.Companion.DIA1
import com.osfit.app.domain.EscenarioRutina.Companion.DIA2
import com.osfit.app.domain.EscenarioRutina.Companion.DIA3
import com.osfit.app.domain.EscenarioRutina.Companion.DIA4
import com.osfit.app.domain.EscenarioRutina.Companion.DIEGO
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Secuencias día a día sobre los repositorios en memoria.
 *
 * Todo lo de aquí es el **ciclo rodante**, el modo por defecto. El modo de reinicio semanal
 * vive en `ReinicioSemanalTest`.
 */
class AvanceDiaSecuenciaTest {

    @Test
    fun `asistir avanza un dia y solo a partir del dia siguiente`() = runBlocking {
        val e = EscenarioRutina()
        assertEquals("de inicio le toca el día del ancla", 1, e.diaQueToca(ANA, DIA1))

        e.marcar(ANA, DIA1, asistio = true)

        assertEquals("hoy sigue haciendo el día 1", 1, e.diaQueToca(ANA, DIA1))
        assertEquals("mañana le toca el 2", 2, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `iniciar tiempo cuenta igual que marcar asistencia`() = runBlocking {
        val e = EscenarioRutina()
        e.iniciarTiempo(ANA, DIA1)

        assertEquals("queda registrado el día que tocaba", 1, e.registro(ANA, DIA1)?.diaRutinaRealizado)
        assertEquals(true, e.registro(ANA, DIA1)?.asistio)
        assertEquals(1, e.diaQueToca(ANA, DIA1))
        assertEquals(2, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `iniciar tiempo al dia siguiente no regresa el dia al valor anterior`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        assertEquals(2, e.diaQueToca(ANA, DIA2))

        e.iniciarTiempo(ANA, DIA2)

        assertEquals("el día de hoy no retrocede", 2, e.diaQueToca(ANA, DIA2))
        assertEquals(3, e.diaQueToca(ANA, DIA3))
    }

    @Test
    fun `sin reinicio semanal los dias seguidos recorren el ciclo y dan la vuelta`() = runBlocking {
        val e = EscenarioRutina()
        // Beto arranca en el día 2, último de un ciclo de 3.
        val fechas = listOf(DIA1, DIA2, DIA3, DIA4)
        val esperados = listOf(2, 0, 1, 2)

        fechas.forEachIndexed { indice, fecha ->
            assertEquals("día efectivo en $fecha", esperados[indice], e.diaQueToca(BETO, fecha))
            e.iniciarTiempo(BETO, fecha)
            assertEquals(
                "iniciar tiempo no mueve el día de $fecha",
                esperados[indice],
                e.diaQueToca(BETO, fecha)
            )
        }
    }

    @Test
    fun `faltar no avanza el ciclo`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        assertEquals(2, e.diaQueToca(ANA, DIA2))

        e.marcar(ANA, DIA2, asistio = false)
        e.marcar(ANA, DIA3, asistio = false)

        assertEquals("sigue debiendo el día 2", 2, e.diaQueToca(ANA, DIA3))
        assertEquals(2, e.diaQueToca(ANA, DIA4))
        assertNull("una falta no registra día", e.registro(ANA, DIA2)?.diaRutinaRealizado)
    }

    @Test
    fun `marcar dos veces el mismo dia es idempotente`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.marcar(ANA, DIA1, asistio = true)

        assertEquals(1, e.diaQueToca(ANA, DIA1))
        assertEquals("no avanza dos veces", 2, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `marcar y luego iniciar tiempo el mismo dia no avanza dos veces`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.iniciarTiempo(ANA, DIA1)

        assertEquals(1, e.diaQueToca(ANA, DIA1))
        assertEquals(2, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `deshacer con Falto devuelve el dia a donde estaba`() = runBlocking {
        val e = EscenarioRutina()
        e.iniciarTiempo(ANA, DIA1)
        assertEquals(2, e.diaQueToca(ANA, DIA2))

        e.marcar(ANA, DIA1, asistio = false)

        assertEquals("vuelve a deber el día 1", 1, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `reiniciar el dia deja al cliente como si no se hubiera tocado`() = runBlocking {
        val e = EscenarioRutina()
        val antes = e.diaQueToca(ANA, DIA1)
        e.marcar(ANA, DIA1, asistio = true)

        e.reiniciarDia(DIA1)

        assertNull("no queda registro", e.registro(ANA, DIA1))
        assertEquals(antes, e.diaQueToca(ANA, DIA1))
        assertEquals("y no avanza al día siguiente", antes, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `reiniciar un dia conserva el avance de los dias anteriores`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.marcar(ANA, DIA2, asistio = true)
        assertEquals(3, e.diaQueToca(ANA, DIA3))

        e.reiniciarDia(DIA2)

        assertEquals("se conserva lo ganado el día 1", 2, e.diaQueToca(ANA, DIA3))
    }

    @Test
    fun `cliente sin rutina no rompe al iniciar tiempo`() = runBlocking {
        val e = EscenarioRutina()
        e.iniciarTiempo(DIEGO, DIA1)

        assertEquals(0, e.diaQueToca(DIEGO, DIA1))
        assertEquals(0, e.diaQueToca(DIEGO, DIA2))
        assertEquals(true, e.registro(DIEGO, DIA1)?.asistio)
    }

    @Test
    fun `cliente anterior al cambio arranca en su dia congelado y avanza normal`() = runBlocking {
        val e = EscenarioRutina()
        // Carla no tiene ancla: su pendiente vencido la deja en el día 1.
        assertEquals("día congelado por la migración", 1, e.diaQueToca(CARLA, DIA1))

        e.marcar(CARLA, DIA1, asistio = true)

        assertEquals(1, e.diaQueToca(CARLA, DIA1))
        assertEquals("desde aquí manda el historial", 2, e.diaQueToca(CARLA, DIA2))
    }
}
