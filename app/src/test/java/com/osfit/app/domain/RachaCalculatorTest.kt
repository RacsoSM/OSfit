package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RachaCalculatorTest {

    // Lunes 17 a viernes 21 de agosto 2026, sábado 22, domingo 23.

    @Test
    fun `racha actual cuenta dias habiles consecutivos asistidos`() {
        val fechas = setOf(
            LocalDate.parse("2026-08-17"),
            LocalDate.parse("2026-08-18"),
            LocalDate.parse("2026-08-19")
        )
        val racha = RachaCalculator.calcularRachaActual(fechas, hoy = LocalDate.parse("2026-08-19"))
        assertEquals(3, racha)
    }

    @Test
    fun `racha actual no se rompe ni suma por fin de semana`() {
        val fechas = setOf(
            LocalDate.parse("2026-08-21"), // viernes
            LocalDate.parse("2026-08-24")  // lunes siguiente
        )
        val racha = RachaCalculator.calcularRachaActual(fechas, hoy = LocalDate.parse("2026-08-24"))
        assertEquals(2, racha)
    }

    @Test
    fun `racha actual se rompe si falto un dia habil`() {
        val fechas = setOf(
            LocalDate.parse("2026-08-17"), // lunes
            // martes 18 falta
            LocalDate.parse("2026-08-19")  // miercoles, hoy
        )
        val racha = RachaCalculator.calcularRachaActual(fechas, hoy = LocalDate.parse("2026-08-19"))
        assertEquals(1, racha)
    }

    @Test
    fun `racha actual da dia de gracia si hoy es habil y aun no hay registro`() {
        val fechas = setOf(
            LocalDate.parse("2026-08-17"),
            LocalDate.parse("2026-08-18")
        )
        // hoy es miercoles 19 y todavia no se marco asistencia
        val racha = RachaCalculator.calcularRachaActual(fechas, hoy = LocalDate.parse("2026-08-19"))
        assertEquals(2, racha)
    }

    @Test
    fun `racha actual es cero sin asistencias`() {
        val racha = RachaCalculator.calcularRachaActual(emptySet(), hoy = LocalDate.parse("2026-08-19"))
        assertEquals(0, racha)
    }

    @Test
    fun `racha mas larga encuentra el tramo mas largo con huecos`() {
        val fechas = setOf(
            LocalDate.parse("2026-08-17"), // lunes
            LocalDate.parse("2026-08-18"), // martes
            // miercoles 19 falta - corta la racha
            LocalDate.parse("2026-08-20"), // jueves
            LocalDate.parse("2026-08-21"), // viernes
            LocalDate.parse("2026-08-24")  // lunes siguiente, fin de semana no rompe
        )
        val racha = RachaCalculator.calcularRachaMasLarga(fechas)
        assertEquals(3, racha)
    }

    @Test
    fun `racha mas larga es cero sin asistencias`() {
        assertEquals(0, RachaCalculator.calcularRachaMasLarga(emptySet()))
    }

    @Test
    fun `dias totales asistidos solo cuenta asistio true`() {
        val asistencias = listOf(
            Asistencia(fecha = "2026-08-17", asistio = true),
            Asistencia(fecha = "2026-08-18", asistio = false),
            Asistencia(fecha = "2026-08-19", asistio = true)
        )
        assertEquals(2, RachaCalculator.diasTotalesAsistidos(asistencias))
    }

    @Test
    fun `dia favorito es el diaRutinaRealizado mas frecuente`() {
        val asistencias = listOf(
            Asistencia(fecha = "2026-08-17", asistio = true, diaRutinaRealizado = 0),
            Asistencia(fecha = "2026-08-18", asistio = true, diaRutinaRealizado = 1),
            Asistencia(fecha = "2026-08-19", asistio = true, diaRutinaRealizado = 1)
        )
        assertEquals(1, RachaCalculator.diaFavorito(asistencias))
    }

    @Test
    fun `dia favorito es null sin asistencias con dia registrado`() {
        assertNull(RachaCalculator.diaFavorito(emptyList()))
    }

    @Test
    fun `racha mas larga en rango ignora asistencias fuera del rango`() {
        val fechas = setOf(
            LocalDate.parse("2026-07-31"), // viernes, mes anterior
            LocalDate.parse("2026-08-03"), // lunes
            LocalDate.parse("2026-08-04"), // martes
            LocalDate.parse("2026-08-05")  // miercoles
        )
        val racha = RachaCalculator.calcularRachaMasLargaEnRango(
            fechas,
            inicio = LocalDate.parse("2026-08-01"),
            fin = LocalDate.parse("2026-08-31")
        )
        assertEquals(3, racha)
    }

    @Test
    fun `racha mas larga en rango con fin futuro no cuenta dias sin asistencia`() {
        val fechas = setOf(
            LocalDate.parse("2026-08-17"),
            LocalDate.parse("2026-08-18"),
            LocalDate.parse("2026-08-19")
        )
        val racha = RachaCalculator.calcularRachaMasLargaEnRango(
            fechas,
            inicio = LocalDate.parse("2026-08-01"),
            fin = LocalDate.parse("2026-08-31")
        )
        assertEquals(3, racha)
    }

    @Test
    fun `dias desde ingreso cuenta dias de calendario sin importar fin de semana`() {
        val dias = RachaCalculator.diasDesdeIngreso(
            fechaIngreso = LocalDate.parse("2026-08-01"),
            hoy = LocalDate.parse("2026-08-21")
        )
        assertEquals(20, dias)
    }
}
