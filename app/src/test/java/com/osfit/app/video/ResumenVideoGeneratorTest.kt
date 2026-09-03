package com.osfit.app.video

import com.osfit.app.data.model.Cliente
import com.osfit.app.domain.DesgloseEsfuerzo
import com.osfit.app.domain.PuntoTiempoDiario
import com.osfit.app.domain.RangoResumen
import com.osfit.app.domain.RankingResultado
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.domain.ResumenClienteData
import java.time.LocalDate
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class ResumenVideoGeneratorTest {

    private val ranking = RankingResultado(puesto = 1, nombresPorEncima = emptyList())

    private fun resumen(
        rango: RangoResumen,
        racha: Int? = null,
        desgloseEsfuerzo: DesgloseEsfuerzo? = null,
        tiempoPorDia: List<PuntoTiempoDiario> = emptyList()
    ): ResumenClienteData = ResumenClienteData(
        cliente = Cliente(id = "c1", nombre = "Ana"),
        rango = rango,
        diasAsistidos = 3,
        rankingAsistencia = ranking,
        minutosEnGym = 125,
        rankingTiempo = ranking,
        diaFavoritoNombre = "Lunes",
        rachaMasLarga = racha,
        rankingRacha = if (racha != null) ranking else null,
        desgloseEsfuerzo = desgloseEsfuerzo,
        tiempoPorDia = tiempoPorDia
    )

    @Test
    fun `la escena Tiempo lleva el tiempoPorDia del resumen`() {
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val valores = listOf(45, 0, 60, 0, 30).mapIndexed { indice, minutos ->
            PuntoTiempoDiario(rango.inicio.plusDays(indice.toLong()), minutos)
        }
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, tiempoPorDia = valores))

        val tiempo = escenas[2] as EscenaResumen.Tiempo
        assertEquals(valores, tiempo.tiempoPorDia)
    }

    @Test
    fun `el resumen semanal arma Saludo, Asistencia, Tiempo y DiaFavorito, sin RachaMasLarga`() {
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango))

        assertEquals(5, escenas.size)
        assertTrue(escenas[0] is EscenaResumen.Saludo)
        assertTrue(escenas[1] is EscenaResumen.Asistencia)
        assertTrue(escenas[2] is EscenaResumen.Tiempo)
        assertTrue(escenas[3] is EscenaResumen.DiaFavorito)
        assertTrue(escenas[4] is EscenaResumen.Despedida)
    }

    @Test
    fun `el resumen mensual agrega RachaMasLarga al final cuando hay racha`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, racha = 5))

        assertEquals(6, escenas.size)
        assertTrue(escenas[4] is EscenaResumen.RachaMasLarga)
        assertEquals(5, (escenas[4] as EscenaResumen.RachaMasLarga).dias)
        assertTrue(escenas[5] is EscenaResumen.Despedida)
    }

    @Test
    fun `el resumen mensual sin racha no agrega la quinta escena`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, racha = null))

        assertEquals(5, escenas.size)
        assertTrue(escenas.none { it is EscenaResumen.RachaMasLarga })
    }

    @Test
    fun `el resumen semanal con desglose de esfuerzo agrega Esfuerzo justo despues de Tiempo`() {
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val desglose = DesgloseEsfuerzo(minutosEntrenando = 16, minutosDescansando = 71, porcentajeEntrenando = 18)
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, desgloseEsfuerzo = desglose))

        assertEquals(6, escenas.size)
        assertTrue(escenas[0] is EscenaResumen.Saludo)
        assertTrue(escenas[1] is EscenaResumen.Asistencia)
        assertTrue(escenas[2] is EscenaResumen.Tiempo)
        assertTrue(escenas[3] is EscenaResumen.Esfuerzo)
        assertTrue(escenas[4] is EscenaResumen.DiaFavorito)
        assertTrue(escenas[5] is EscenaResumen.Despedida)
    }

    @Test
    fun `el resumen sin desglose de esfuerzo no agrega la escena Esfuerzo`() {
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, desgloseEsfuerzo = null))

        assertEquals(5, escenas.size)
        assertTrue(escenas.none { it is EscenaResumen.Esfuerzo })
        assertTrue(escenas[0] is EscenaResumen.Saludo)
        assertTrue(escenas[1] is EscenaResumen.Asistencia)
        assertTrue(escenas[2] is EscenaResumen.Tiempo)
        assertTrue(escenas[3] is EscenaResumen.DiaFavorito)
        assertTrue(escenas[4] is EscenaResumen.Despedida)
    }

    @Test
    fun `la escena Esfuerzo lleva minutosEnGym como minutosTotales y el mismo DesgloseEsfuerzo`() {
        val rango = ResumenClienteCalculator.rangoSemanal(LocalDate.of(2024, 3, 20))
        val desglose = DesgloseEsfuerzo(minutosEntrenando = 16, minutosDescansando = 71, porcentajeEntrenando = 18)
        val datos = resumen(rango, desgloseEsfuerzo = desglose)
        val escenas = ResumenVideoGenerator.construirEscenas(datos)

        val esfuerzo = escenas[3] as EscenaResumen.Esfuerzo
        assertEquals(datos.minutosEnGym, esfuerzo.minutosTotales)
        assertSame(desglose, esfuerzo.desglose)
    }

    @Test
    fun `el resumen mensual con desglose y racha produce el orden completo`() {
        val rango = ResumenClienteCalculator.rangoMensual(YearMonth.of(2024, 3))
        val desglose = DesgloseEsfuerzo(minutosEntrenando = 16, minutosDescansando = 71, porcentajeEntrenando = 18)
        val escenas = ResumenVideoGenerator.construirEscenas(resumen(rango, racha = 5, desgloseEsfuerzo = desglose))

        assertEquals(7, escenas.size)
        assertTrue(escenas[0] is EscenaResumen.Saludo)
        assertTrue(escenas[1] is EscenaResumen.Asistencia)
        assertTrue(escenas[2] is EscenaResumen.Tiempo)
        assertTrue(escenas[3] is EscenaResumen.Esfuerzo)
        assertTrue(escenas[4] is EscenaResumen.DiaFavorito)
        assertTrue(escenas[5] is EscenaResumen.RachaMasLarga)
        assertTrue(escenas[6] is EscenaResumen.Despedida)
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
