package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * 2026-09-07 es lunes; 2026-09-12, sábado. Las fechas de estos tests se eligieron para que
 * la semana caiga entera de lunes a viernes y los fines de semana se vean aparte.
 */
class FaltaQueRompioLaRachaTest {

    private fun vino(fecha: String) =
        Asistencia(clienteId = "ana", fecha = fecha, asistio = true)

    private fun falto(fecha: String, justificada: Boolean = false) =
        Asistencia(clienteId = "ana", fecha = fecha, asistio = false, justificada = justificada)

    @Test
    fun `encuentra la falta que rompio la racha`() {
        val asistencias = listOf(
            vino("2026-09-07"),
            falto("2026-09-08"),
            vino("2026-09-09"),
            vino("2026-09-10")
        )
        // Vino el 9 y el 10, así que la racha viva arranca el 9; la falta del 8 es la que la
        // cortó y es la única reparable.
        assertEquals("2026-09-08", FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `devuelve null si la racha esta viva`() {
        val asistencias = listOf(vino("2026-09-09"), vino("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `ignora las faltas ya justificadas`() {
        val asistencias = listOf(
            vino("2026-09-07"),
            falto("2026-09-08", justificada = true),
            vino("2026-09-09")
        )
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-10"))
    }

    @Test
    fun `ignora los fines de semana`() {
        // 2026-09-12 y 13 son sábado y domingo: no hay registro y no rompen nada.
        val asistencias = listOf(vino("2026-09-11"), vino("2026-09-14"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-15"))
    }

    @Test
    fun `un dia habil sin registro alguno cuenta como falta`() {
        // No venir y que nadie lo registre es faltar igual: la racha se rompe sola.
        val asistencias = listOf(vino("2026-09-07"), vino("2026-09-10"))
        assertEquals("2026-09-09", FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `nunca devuelve hoy`() {
        // Hoy se justifica por el otro camino ("hoy no voy a poder ir"), no por este.
        val asistencias = listOf(vino("2026-09-09"), falto("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-10"))
    }

    @Test
    fun `sin historial no hay nada que reparar`() {
        assertNull(FaltaQueRompioLaRacha.calcular(emptyList(), "2026-09-11"))
    }
}
