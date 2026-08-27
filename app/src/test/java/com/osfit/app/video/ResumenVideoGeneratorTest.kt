package com.osfit.app.video

import com.osfit.app.data.model.Cliente
import com.osfit.app.domain.RangoResumen
import com.osfit.app.domain.RankingResultado
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.domain.ResumenClienteData
import java.time.LocalDate
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ResumenVideoGeneratorTest {

    private val ranking = RankingResultado(puesto = 1, nombresPorEncima = emptyList())

    private fun resumen(rango: RangoResumen, racha: Int? = null): ResumenClienteData = ResumenClienteData(
        cliente = Cliente(id = "c1", nombre = "Ana"),
        rango = rango,
        diasAsistidos = 3,
        rankingAsistencia = ranking,
        minutosEnGym = 125,
        rankingTiempo = ranking,
        diaFavoritoNombre = "Lunes",
        rachaMasLarga = racha,
        rankingRacha = if (racha != null) ranking else null
    )

    @Test
    fun `el resumen semanal arma Saludo, Asistencia, Tiempo y DiaFavorito, sin RachaMasLarga`() {
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango))

        assertEquals(4, escenas.size)
        assertTrue(escenas[0] is EscenaResumen.Saludo)
        assertTrue(escenas[1] is EscenaResumen.Asistencia)
        assertTrue(escenas[2] is EscenaResumen.Tiempo)
        assertTrue(escenas[3] is EscenaResumen.DiaFavorito)
    }

    @Test
    fun `el resumen mensual agrega RachaMasLarga al final cuando hay racha`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, racha = 5))

        assertEquals(5, escenas.size)
        assertTrue(escenas[4] is EscenaResumen.RachaMasLarga)
        assertEquals(5, (escenas[4] as EscenaResumen.RachaMasLarga).dias)
    }

    @Test
    fun `el resumen mensual sin racha no agrega la quinta escena`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, racha = null))

        assertEquals(4, escenas.size)
    }

    @Test
    fun `el encabezado de rango semanal usa el formato del al`() {
        // 20 de marzo 2024 es miércoles, su semana va del lunes 18 al viernes 22
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango))
        val asistencia = escenas[1] as EscenaResumen.Asistencia

        assertEquals("Semana del 18 de marzo al 22 de marzo", asistencia.encabezadoRango)
    }

    @Test
    fun `el encabezado de rango mensual reusa el encabezado de RangoResumen`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango))
        val asistencia = escenas[1] as EscenaResumen.Asistencia

        assertEquals("Mes de marzo", asistencia.encabezadoRango)
    }
}
