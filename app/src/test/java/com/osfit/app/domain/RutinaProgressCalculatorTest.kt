package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Rutina
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.LocalDate

/** Unidad: la regla que deduce el día del ciclo a partir del historial de asistencias. */
class RutinaProgressCalculatorTest {

    private val corte = RutinaProgressCalculator.FECHA_CORTE
    private val despuesDelCorte = LocalDate.parse(corte).plusDays(1).toString()

    private fun rutina(dias: Int) = Rutina(
        id = "r",
        nombre = "r",
        dias = (0 until dias).map { DiaRutina(nombreDia = "Día ${it + 1}") }
    )

    private fun cliente(
        diaAncla: Int = 0,
        anclaFecha: String? = corte,
        totalDias: Int = 4,
        pendienteIndex: Int? = null,
        pendienteFecha: String? = null
    ) = Cliente(
        id = "c",
        rutinaAsignada = rutina(totalDias),
        diaActualIndex = diaAncla,
        diaAnclaFecha = anclaFecha,
        diaPendienteIndex = pendienteIndex,
        diaPendienteFecha = pendienteFecha
    )

    private fun asistio(fecha: String, dia: Int) =
        Asistencia(clienteId = "c", fecha = fecha, asistio = true, diaRutinaRealizado = dia)

    private fun falto(fecha: String) =
        Asistencia(clienteId = "c", fecha = fecha, asistio = false, diaRutinaRealizado = null)

    // ---- Sin historial: manda el ancla ----

    @Test
    fun `sin asistencias, le toca el dia del ancla`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 2), emptyList(), "2026-09-10"
        )
        assertEquals(DiaQueToca.Dia(2), resultado)
    }

    @Test
    fun `sin rutina asignada, siempre dia 0`() {
        val sinRutina = Cliente(id = "c", rutinaAsignada = null, diaActualIndex = 3)
        assertEquals(
            DiaQueToca.SinRutina,
            RutinaProgressCalculator.diaQueToca(sinRutina, emptyList(), "2026-09-10")
        )
    }

    // ---- Con historial: manda Calendario-Rutina ----

    @Test
    fun `la asistencia de hoy dice el dia que se esta haciendo hoy`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 0), listOf(asistio("2026-09-05", 2)), "2026-09-05"
        )
        assertEquals(DiaQueToca.Dia(2), resultado)
    }

    @Test
    fun `tras una asistencia anterior, le toca el dia siguiente`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 0), listOf(asistio("2026-09-05", 2)), "2026-09-06"
        )
        assertEquals(DiaQueToca.Dia(3), resultado)
    }

    @Test
    fun `tras el ultimo dia del ciclo, vuelve al dia 1`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 0, totalDias = 4), listOf(asistio("2026-09-05", 3)), "2026-09-06"
        )
        assertEquals(DiaQueToca.Dia(0), resultado)
    }

    @Test
    fun `manda la asistencia mas reciente, no el orden de la lista`() {
        val desordenadas = listOf(
            asistio("2026-09-03", 0),
            asistio("2026-09-07", 2),
            asistio("2026-09-05", 1)
        )
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 0), desordenadas, "2026-09-08"
        )
        assertEquals("cuenta la del 07, que registró el día 2", DiaQueToca.Dia(3), resultado)
    }

    @Test
    fun `las faltas no avanzan el ciclo`() {
        val historial = listOf(asistio("2026-09-05", 1), falto("2026-09-06"), falto("2026-09-07"))
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 0), historial, "2026-09-08"
        )
        assertEquals("sigue tocando el siguiente al día 1", DiaQueToca.Dia(2), resultado)
    }

    @Test
    fun `las asistencias futuras no cuentan`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 0), listOf(asistio("2026-09-20", 3)), "2026-09-10"
        )
        assertEquals("una fecha posterior a hoy se ignora", DiaQueToca.Dia(0), resultado)
    }

    // ---- El ancla corta el historial ----

    @Test
    fun `las asistencias anteriores al ancla no cuentan`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 3, anclaFecha = "2026-09-10"),
            listOf(asistio("2026-09-05", 0)),
            "2026-09-12"
        )
        assertEquals("manda el ancla, no el registro viejo", DiaQueToca.Dia(3), resultado)
    }

    @Test
    fun `una asistencia del mismo dia del ancla no pisa la asignacion manual`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 3, anclaFecha = "2026-09-10"),
            listOf(asistio("2026-09-10", 0)),
            "2026-09-10"
        )
        assertEquals("el ancla manda en su propia fecha", DiaQueToca.Dia(3), resultado)
    }

    @Test
    fun `una asistencia posterior al ancla si manda`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 3, anclaFecha = "2026-09-10"),
            listOf(asistio("2026-09-11", 0)),
            "2026-09-12"
        )
        assertEquals("el historial retoma el mando", DiaQueToca.Dia(1), resultado)
    }

    // ---- Migración: clientes anteriores al cambio ----

    @Test
    fun `cliente viejo sin pendiente conserva su diaActualIndex`() {
        val viejo = cliente(diaAncla = 2, anclaFecha = null)
        assertEquals(DiaQueToca.Dia(2), RutinaProgressCalculator.diaQueToca(viejo, emptyList(), "2026-09-20"))
    }

    @Test
    fun `cliente viejo con pendiente ya vencido queda congelado en el pendiente`() {
        val viejo = cliente(
            diaAncla = 0,
            anclaFecha = null,
            pendienteIndex = 2,
            pendienteFecha = LocalDate.parse(corte).minusDays(3).toString()
        )
        assertEquals(
            "el pendiente venció antes del corte, así que va en el ancla",
            DiaQueToca.Dia(2),
            RutinaProgressCalculator.diaQueToca(viejo, emptyList(), "2026-09-20")
        )
    }

    @Test
    fun `el dia congelado de un cliente viejo no se mueve con el paso del tiempo`() {
        val viejo = cliente(
            diaAncla = 0,
            anclaFecha = null,
            pendienteIndex = 2,
            pendienteFecha = LocalDate.parse(corte).minusDays(3).toString()
        )
        val enSeptiembre = RutinaProgressCalculator.diaQueToca(viejo, emptyList(), "2026-09-20")
        val enDiciembre = RutinaProgressCalculator.diaQueToca(viejo, emptyList(), "2026-12-20")
        assertEquals("congelado significa congelado", enSeptiembre, enDiciembre)
    }

    @Test
    fun `un registro de un cliente viejo posterior al corte no se cuenta dos veces`() {
        // Pendiente que aún no había vencido en el corte: no entra en el ancla,
        // pero su registro sí pasa el filtro. Debe contarse exactamente una vez.
        val viejo = cliente(
            diaAncla = 1,
            anclaFecha = null,
            pendienteIndex = 2,
            pendienteFecha = despuesDelCorte
        )
        val resultado = RutinaProgressCalculator.diaQueToca(
            viejo, listOf(asistio(despuesDelCorte, 1)), LocalDate.parse(despuesDelCorte).plusDays(1).toString()
        )
        assertEquals("el día 1 quedó hecho, toca el 2", DiaQueToca.Dia(2), resultado)
    }

    // ---- siguienteDia ----

    @Test
    fun `siguienteDia avanza dentro del ciclo`() {
        assertEquals(2, RutinaProgressCalculator.siguienteDia(1, 5))
    }

    @Test
    fun `siguienteDia da la vuelta en el ultimo dia`() {
        assertEquals(0, RutinaProgressCalculator.siguienteDia(4, 5))
    }

    @Test
    fun `siguienteDia en un ciclo de un solo dia siempre vuelve al mismo`() {
        assertEquals(0, RutinaProgressCalculator.siguienteDia(0, 1))
    }

    @Test
    fun `siguienteDia lanza excepcion si totalDias no es positivo`() {
        assertThrows(IllegalArgumentException::class.java) {
            RutinaProgressCalculator.siguienteDia(0, 0)
        }
    }

    // ---- Robustez ante datos corruptos ----

    @Test
    fun `un dia registrado fuera de rango se recorta al ciclo`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 0, totalDias = 3), listOf(asistio("2026-09-05", 99)), "2026-09-05"
        )
        assertEquals("se recorta al último día válido", DiaQueToca.Dia(2), resultado)
    }

    @Test
    fun `un ancla fuera de rango se recorta al ciclo`() {
        val resultado = RutinaProgressCalculator.diaQueToca(
            cliente(diaAncla = 99, totalDias = 3), emptyList(), "2026-09-05"
        )
        assertEquals(DiaQueToca.Dia(2), resultado)
    }
}
