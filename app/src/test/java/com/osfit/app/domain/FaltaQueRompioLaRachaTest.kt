package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * 2026-09-07 es lunes; 2026-09-12, sábado. Las fechas de estos tests se eligieron para que la
 * semana caiga entera de lunes a viernes y los fines de semana se vean aparte.
 *
 * La ventana de reparación son los 2 días hábiles anteriores a hoy: una rotura más vieja deja
 * de ofrecerse.
 */
class FaltaQueRompioLaRachaTest {

    private fun vino(fecha: String) =
        Asistencia(clienteId = "ana", fecha = fecha, asistio = true)

    private fun falto(fecha: String, justificada: Boolean = false) =
        Asistencia(clienteId = "ana", fecha = fecha, asistio = false, justificada = justificada)

    @Test
    fun `encuentra la falta de ayer`() {
        val asistencias = listOf(vino("2026-09-08"), vino("2026-09-09"), falto("2026-09-10"))
        assertEquals("2026-09-10", FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `encuentra la falta de hace dos dias habiles`() {
        // Límite de la ventana, inclusive: faltó el 9, volvió el 10, hoy es 11.
        val asistencias = listOf(vino("2026-09-08"), falto("2026-09-09"), vino("2026-09-10"))
        assertEquals("2026-09-09", FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `no ofrece una rotura de hace tres dias habiles`() {
        // Faltó el 8 y volvió el 9 y el 10: la rotura ya quedó fuera de la ventana. Antes de
        // la regla de los 2 días hábiles esto devolvía 2026-09-08.
        val asistencias = listOf(vino("2026-09-07"), falto("2026-09-08"), vino("2026-09-09"), vino("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `el lunes todavia repara la falta del viernes`() {
        // Es la razón de contar días hábiles y no 48 horas de reloj: el sábado y el domingo la
        // página no dibuja acciones, así que con horas el viernes vencería sin que el cliente
        // hubiera tenido nunca un botón que tocar.
        val asistencias = listOf(vino("2026-09-09"), vino("2026-09-10"), falto("2026-09-11"))
        assertEquals("2026-09-11", FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-14"))
    }

    @Test
    fun `devuelve null si la racha esta viva`() {
        val asistencias = listOf(vino("2026-09-09"), vino("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `ignora las faltas ya justificadas`() {
        val asistencias = listOf(vino("2026-09-08"), falto("2026-09-09", justificada = true), vino("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `ignora los fines de semana`() {
        // 2026-09-12 y 13 son sábado y domingo: no hay registro y no rompen nada.
        val asistencias = listOf(vino("2026-09-10"), vino("2026-09-11"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-14"))
    }

    @Test
    fun `un dia habil sin registro alguno cuenta como falta`() {
        // No venir y que nadie lo registre es faltar igual: la racha se rompe sola.
        val asistencias = listOf(vino("2026-09-08"), vino("2026-09-09"))
        assertEquals("2026-09-10", FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }

    @Test
    fun `nunca devuelve hoy`() {
        // Hoy se justifica por el otro camino ("hoy no voy a poder ir"), no por este.
        val asistencias = listOf(vino("2026-09-08"), vino("2026-09-09"), falto("2026-09-10"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-10"))
    }

    @Test
    fun `sin historial no hay nada que reparar`() {
        assertNull(FaltaQueRompioLaRacha.calcular(emptyList(), "2026-09-11"))
    }

    @Test
    fun `un cliente recien dado de alta no tiene faltas anteriores a su alta`() {
        // Su único registro es de hoy: los días hábiles de antes no son faltas suyas.
        val asistencias = listOf(vino("2026-09-11"))
        assertNull(FaltaQueRompioLaRacha.calcular(asistencias, "2026-09-11"))
    }
}
