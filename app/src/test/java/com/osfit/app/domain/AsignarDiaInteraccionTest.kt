package com.osfit.app.domain

import com.osfit.app.domain.EscenarioRutina.Companion.ANA
import com.osfit.app.domain.EscenarioRutina.Companion.BETO
import com.osfit.app.domain.EscenarioRutina.Companion.DIA1
import com.osfit.app.domain.EscenarioRutina.Companion.DIA2
import com.osfit.app.domain.EscenarioRutina.Companion.DIA3
import com.osfit.app.domain.EscenarioRutina.Companion.DIA4
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * "Asignar día" es una corrección manual: cambia el día que le toca al cliente de aquí
 * en adelante, pero no toca Calendario-Rutina. El historial retoma el mando en cuanto
 * el cliente tenga una asistencia posterior al ancla.
 */
class AsignarDiaInteraccionTest {

    @Test
    fun `asignar dia fija el dia y no avanza aunque pasen los dias`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ANA, dia = 3, fecha = DIA1)

        assertEquals(3, e.diaQueToca(ANA, DIA1))
        assertEquals("sin asistencias no avanza", 3, e.diaQueToca(ANA, DIA2))
        assertEquals(3, e.diaQueToca(ANA, DIA3))
    }

    @Test
    fun `asignar dia NO cambia Calendario-Rutina`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true) // Calendario-Rutina registra el día 1

        e.asignarDia(ANA, dia = 3, fecha = DIA1)

        assertEquals(
            "el registro de asistencia se queda como estaba",
            1,
            e.registro(ANA, DIA1)?.diaRutinaRealizado
        )
        assertEquals("pero al cliente ya le toca el día asignado", 3, e.diaQueToca(ANA, DIA1))
    }

    @Test
    fun `el dia asignado se mantiene hasta que el cliente tenga asistencia`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.asignarDia(ANA, dia = 3, fecha = DIA1)

        // Pasan días sin que venga: el día asignado aguanta.
        assertEquals(3, e.diaQueToca(ANA, DIA2))
        assertEquals(3, e.diaQueToca(ANA, DIA3))

        // Viene y se le marca: el registro se crea con el día asignado.
        e.marcar(ANA, DIA3, asistio = true)
        assertEquals("Calendario-Rutina recibe el día asignado", 3, e.registro(ANA, DIA3)?.diaRutinaRealizado)

        // Y a partir de ahí manda otra vez el historial (3 es el último de 4 -> vuelve al 0).
        assertEquals(3, e.diaQueToca(ANA, DIA3))
        assertEquals("el historial retoma el mando", 0, e.diaQueToca(ANA, DIA4))
    }

    @Test
    fun `asignar dia y luego asistir avanza desde el dia asignado`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ANA, dia = 2, fecha = DIA1)
        e.marcar(ANA, DIA2, asistio = true)

        assertEquals(2, e.registro(ANA, DIA2)?.diaRutinaRealizado)
        assertEquals(2, e.diaQueToca(ANA, DIA2))
        assertEquals(3, e.diaQueToca(ANA, DIA3))
    }

    @Test
    fun `asignar el ultimo dia del ciclo y asistir da la vuelta`() = runBlocking {
        val e = EscenarioRutina()
        val ultimo = e.totalDias(BETO) - 1
        e.asignarDia(BETO, dia = ultimo, fecha = DIA1)
        e.marcar(BETO, DIA2, asistio = true)

        assertEquals(ultimo, e.diaQueToca(BETO, DIA2))
        assertEquals("vuelve al primer día", 0, e.diaQueToca(BETO, DIA3))
    }

    @Test
    fun `un registro anterior al ancla ya no pisa la asignacion manual`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.asignarDia(ANA, dia = 1, fecha = DIA2)
        assertEquals(1, e.diaQueToca(ANA, DIA3))

        // Corregir el registro viejo ya no puede mover al cliente: es anterior al ancla.
        e.corregirDiaEnCalendario(ANA, DIA1, dia = 3)

        assertEquals("el registro sí se corrige", 3, e.registro(ANA, DIA1)?.diaRutinaRealizado)
        assertEquals("pero la asignación manual sigue mandando", 1, e.diaQueToca(ANA, DIA3))
    }

    @Test
    fun `asignar dia despues de faltar mantiene el dia asignado`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = false)
        e.asignarDia(ANA, dia = 2, fecha = DIA1)

        assertEquals(2, e.diaQueToca(ANA, DIA2))
        assertNull("faltar no registra día", e.registro(ANA, DIA1)?.diaRutinaRealizado)
    }

    @Test
    fun `reasignar el dia sustituye al ancla anterior`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ANA, dia = 3, fecha = DIA1)
        e.asignarDia(ANA, dia = 0, fecha = DIA2)

        assertEquals(0, e.diaQueToca(ANA, DIA2))
        assertEquals(0, e.diaQueToca(ANA, DIA3))
    }

    @Test
    fun `asignar dia no borra el historial de asistencias`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.asignarDia(ANA, dia = 0, fecha = DIA2)

        assertEquals("la asistencia del día 1 sigue ahí", true, e.registro(ANA, DIA1)?.asistio)
        assertEquals(1, e.registro(ANA, DIA1)?.diaRutinaRealizado)
    }
}
