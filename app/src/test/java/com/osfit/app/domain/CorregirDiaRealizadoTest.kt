package com.osfit.app.domain

import com.osfit.app.domain.EscenarioRutina.Companion.ANA
import com.osfit.app.domain.EscenarioRutina.Companion.DIA1
import com.osfit.app.domain.EscenarioRutina.Companion.DIA2
import com.osfit.app.domain.EscenarioRutina.Companion.DIA3
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Corregir el día desde Calendario-Rutina. Al ser la fuente de verdad, la corrección se
 * refleja sola en la pestaña de Cliente: no hay un segundo sitio que actualizar.
 */
class CorregirDiaRealizadoTest {

    @Test
    fun `corregir el dia en Calendario cambia el dia del cliente`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        assertEquals("antes de corregir, mañana tocaba el 2", 2, e.diaQueToca(ANA, DIA2))

        e.corregirDiaEnCalendario(ANA, DIA1, dia = 3)

        assertEquals(3, e.registro(ANA, DIA1)?.diaRutinaRealizado)
        assertEquals("hoy pasa a ser el día corregido", 3, e.diaQueToca(ANA, DIA1))
        assertEquals("y mañana el siguiente, dando la vuelta", 0, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `corregir dos veces deja el ultimo valor`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)

        e.corregirDiaEnCalendario(ANA, DIA1, dia = 3)
        e.corregirDiaEnCalendario(ANA, DIA1, dia = 2)

        assertEquals(2, e.registro(ANA, DIA1)?.diaRutinaRealizado)
        assertEquals(3, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `corregir una fecha vieja no pisa una asistencia mas reciente`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.marcar(ANA, DIA2, asistio = true)
        assertEquals(3, e.diaQueToca(ANA, DIA3))

        e.corregirDiaEnCalendario(ANA, DIA1, dia = 0)

        assertEquals("el registro viejo sí cambia", 0, e.registro(ANA, DIA1)?.diaRutinaRealizado)
        assertEquals("pero manda la asistencia más reciente", 3, e.diaQueToca(ANA, DIA3))
    }

    @Test
    fun `corregir sin asistencia guardada no hace nada`() = runBlocking {
        val e = EscenarioRutina()
        val antes = e.diaQueToca(ANA, DIA2)

        e.corregirDiaEnCalendario(ANA, DIA1, dia = 3)

        assertNull("no se inventa un registro", e.registro(ANA, DIA1))
        assertEquals(antes, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `tras corregir, el dia de mañana siempre es el siguiente al registro`() = runBlocking {
        val total = EscenarioRutina().totalDias(ANA)

        for (diaCorregido in 0 until total) {
            val e = EscenarioRutina()
            e.marcar(ANA, DIA1, asistio = true)
            e.corregirDiaEnCalendario(ANA, DIA1, dia = diaCorregido)

            assertEquals(
                "registro tras corregir a $diaCorregido",
                diaCorregido,
                e.registro(ANA, DIA1)?.diaRutinaRealizado
            )
            assertEquals(
                "mañana tras corregir a $diaCorregido",
                RutinaProgressCalculator.siguienteDia(diaCorregido, total),
                e.diaQueToca(ANA, DIA2)
            )
        }
    }
}
