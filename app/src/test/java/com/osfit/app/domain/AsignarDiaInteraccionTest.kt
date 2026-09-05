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
 * en adelante. Si el cliente ya tiene asistencia de hoy, también alinea ese registro,
 * porque Calendario-Rutina es la fuente de verdad y a partir de mañana manda él: el día
 * asignado tiene que avanzar al siguiente del ciclo, no quedarse trabado.
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
    fun `asignar dia alinea el registro de hoy en Calendario-Rutina`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true) // Calendario-Rutina registra el día 1

        e.asignarDia(ANA, dia = 3, fecha = DIA1)

        assertEquals(
            "el registro del día se corrige a lo asignado",
            3,
            e.registro(ANA, DIA1)?.diaRutinaRealizado
        )
        assertEquals("al cliente le toca el día asignado", 3, e.diaQueToca(ANA, DIA1))
        assertEquals("y mañana el ciclo avanza (3 es el último de 4)", 0, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `el dia asignado se mantiene hasta que el cliente tenga asistencia`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ANA, dia = 3, fecha = DIA1) // ese día no vino, solo se le dejó el día listo

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
    fun `una asistencia del dia asignado si consume el dia y manana avanza`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.asignarDia(ANA, dia = 3, fecha = DIA1)

        // Vino y (tras la corrección) hizo el día 3: aunque no vuelva, ya le toca el siguiente.
        assertEquals("3 es el último de 4 -> vuelve al 0", 0, e.diaQueToca(ANA, DIA2))
        assertEquals(0, e.diaQueToca(ANA, DIA3))
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

    /**
     * El caso que se rompía: el cliente llega, la app dice un día, se le cambia con
     * "Asignar día" y enseguida se le marca la asistencia. Al pasar la medianoche el día
     * se quedaba trabado en el asignado en vez de avanzar.
     */
    @Test
    fun `asignar dia y marcar asistencia el mismo dia no deja el dia trabado`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ANA, dia = 2, fecha = DIA1)
        e.marcar(ANA, DIA1, asistio = true)

        assertEquals("la asistencia se registra con el día asignado", 2, e.registro(ANA, DIA1)?.diaRutinaRealizado)
        assertEquals("hoy sigue siendo el día asignado", 2, e.diaQueToca(ANA, DIA1))
        assertEquals("al pasar las 12 le toca el siguiente", 3, e.diaQueToca(ANA, DIA2))
        assertEquals("y ahí se queda hasta que vuelva a venir", 3, e.diaQueToca(ANA, DIA3))
    }

    @Test
    fun `marcar asistencia y luego asignar el dia tampoco lo deja trabado`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.asignarDia(ANA, dia = 2, fecha = DIA1)

        assertEquals(2, e.registro(ANA, DIA1)?.diaRutinaRealizado)
        assertEquals(2, e.diaQueToca(ANA, DIA1))
        assertEquals("el orden no cambia el resultado", 3, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `asignar dia con el cronometro ya iniciado hoy tambien avanza manana`() = runBlocking {
        val e = EscenarioRutina()
        e.iniciarTiempo(ANA, DIA1)
        e.asignarDia(ANA, dia = 0, fecha = DIA1)

        assertEquals(0, e.registro(ANA, DIA1)?.diaRutinaRealizado)
        assertEquals(0, e.diaQueToca(ANA, DIA1))
        assertEquals(1, e.diaQueToca(ANA, DIA2))
    }

    @Test
    fun `asignar el ultimo dia y asistir el mismo dia da la vuelta manana`() = runBlocking {
        val e = EscenarioRutina()
        val ultimo = e.totalDias(BETO) - 1
        e.asignarDia(BETO, dia = ultimo, fecha = DIA1)
        e.marcar(BETO, DIA1, asistio = true)

        assertEquals(ultimo, e.diaQueToca(BETO, DIA1))
        assertEquals("vuelve al primer día", 0, e.diaQueToca(BETO, DIA2))
    }

    @Test
    fun `asignar dia sobre una falta no le pone dia realizado a la falta`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = false)
        e.asignarDia(ANA, dia = 2, fecha = DIA1)

        assertNull("la falta sigue sin día realizado", e.registro(ANA, DIA1)?.diaRutinaRealizado)
        assertEquals("y el día asignado aguanta porque no hubo asistencia", 2, e.diaQueToca(ANA, DIA2))
    }
}
