package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import com.osfit.app.domain.AsistenciaCalendario.ClienteDelCalendario
import com.osfit.app.domain.AsistenciaCalendario.Nivel
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class AsistenciaCalendarioTest {

    private val mes = YearMonth.of(2026, 10)
    private val hoy = LocalDate.of(2026, 10, 21)
    private fun dia(d: Int) = LocalDate.of(2026, 10, d)
    private fun fue(cliente: String, d: Int) = Asistencia(clienteId = cliente, fecha = dia(d).toString(), asistio = true)
    private fun falto(cliente: String, d: Int) = Asistencia(clienteId = cliente, fecha = dia(d).toString(), asistio = false)
    private fun cliente(id: String, activo: Boolean = true, aDistancia: Boolean = false, ingreso: LocalDate? = null) =
        ClienteDelCalendario(id, activo, aDistancia, ingreso)

    @Test
    fun `un cliente que entro despues no cuenta para los dias anteriores`() {
        val clientes = listOf(cliente("a", ingreso = dia(1)), cliente("b", ingreso = dia(1)), cliente("nuevo", ingreso = dia(15)))
        val conteo = AsistenciaCalendario.conteoDelMes(clientes, listOf(fue("a", 5), fue("b", 5)), mes, hoy)
        assertEquals(2 to 2, conteo[dia(5)])
        assertEquals(0 to 3, conteo[dia(16)])
        assertEquals(Nivel.BUENA, AsistenciaCalendario.nivelesDelMes(clientes, listOf(fue("a", 5), fue("b", 5)), mes, hoy)[dia(5)])
    }

    @Test
    fun `los que entrenan a distancia no cuentan ni en el total ni en los que fueron`() {
        val clientes = listOf(cliente("a", ingreso = dia(1)), cliente("lejos", aDistancia = true, ingreso = dia(1)))
        val conteo = AsistenciaCalendario.conteoDelMes(clientes, listOf(fue("a", 5), fue("lejos", 5)), mes, hoy)
        assertEquals(1 to 1, conteo[dia(5)])
    }

    @Test
    fun `sin fecha de ingreso cuenta desde su primera asistencia registrada`() {
        val clientes = listOf(cliente("a"), cliente("b"))
        val asistencias = listOf(fue("a", 2), falto("b", 10), fue("a", 10))
        val conteo = AsistenciaCalendario.conteoDelMes(clientes, asistencias, mes, hoy)
        assertEquals(1 to 1, conteo[dia(2)])
        assertEquals(1 to 2, conteo[dia(10)])
    }

    @Test
    fun `uno inactivo cuenta solo hasta su ultimo registro`() {
        val clientes = listOf(cliente("a", ingreso = dia(1)), cliente("se fue", activo = false, ingreso = dia(1)))
        val asistencias = listOf(fue("se fue", 3), fue("a", 3), fue("a", 12))
        val conteo = AsistenciaCalendario.conteoDelMes(clientes, asistencias, mes, hoy)
        assertEquals(2 to 2, conteo[dia(3)])
        assertEquals(1 to 1, conteo[dia(12)])
    }

    @Test
    fun `uno activo sin ingreso ni registros cuenta desde hoy`() {
        val conteo = AsistenciaCalendario.conteoDelMes(listOf(cliente("a")), emptyList(), mes, hoy)
        assertEquals(0 to 0, conteo[dia(20)])
        assertEquals(0 to 1, conteo[dia(21)])
    }

    @Test
    fun `los umbrales de color siguen igual`() {
        val clientes = (1..10).map { cliente("c$it", ingreso = dia(1)) }
        fun nivel(fueron: Int) = AsistenciaCalendario.nivelesDelMes(clientes, (1..fueron).map { fue("c$it", 7) }, mes, hoy)[dia(7)]
        assertEquals(Nivel.SIN_DATOS, nivel(0))
        assertEquals(Nivel.BAJA, nivel(3))
        assertEquals(Nivel.MEDIA, nivel(4))
        assertEquals(Nivel.BUENA, nivel(7))
    }
}
