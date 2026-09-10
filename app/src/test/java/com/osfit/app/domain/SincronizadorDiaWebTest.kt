package com.osfit.app.domain

import com.osfit.app.data.SincronizadorDiaWeb
import com.osfit.app.domain.EscenarioRutina.Companion.ANA
import com.osfit.app.domain.EscenarioRutina.Companion.DIA1
import com.osfit.app.domain.EscenarioRutina.Companion.DIA2
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * El trío denormalizado solo sirve si está fresco. Estos tests recorren cada camino que
 * mueve el día y verifican que después de cada uno, interpretar el trío guardado da lo
 * mismo que preguntarle al calculador.
 */
class SincronizadorDiaWebTest {

    private suspend fun assertFresco(e: EscenarioRutina, id: String, hoy: String) {
        val cliente = e.cliente(id)
        val totalDias = cliente.rutinaAsignada?.dias?.size ?: 0
        val guardado = com.osfit.app.data.model.DiaDenormalizado(
            dia = cliente.ultimoDia,
            fecha = cliente.ultimoDiaFecha,
            esAncla = cliente.ultimoDiaEsAncla
        )
        assertEquals(
            "el trío guardado quedó viejo",
            RutinaProgressCalculator.diaQueToca(cliente, e.asistenciasDe(id), hoy),
            RutinaProgressCalculator.interpretar(guardado, totalDias, hoy)
        )
    }

    private fun sincronizador(e: EscenarioRutina) =
        SincronizadorDiaWeb(e.clientes, e.asistencias)

    @Test
    fun `tras marcar asistencia el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras marcar falta el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = false)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras asignar dia el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ANA, dia = 3, fecha = DIA1)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras corregir el dia en calendario el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        e.corregirDiaEnCalendario(ANA, DIA1, dia = 2)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras reiniciar el dia el trio vuelve al estado anterior`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        sincronizador(e).refrescar(ANA, DIA1)
        e.reiniciarDia(DIA1)
        sincronizador(e).refrescarTodos(DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `tras iniciar tiempo el trio queda fresco`() = runBlocking {
        val e = EscenarioRutina()
        e.iniciarTiempo(ANA, DIA1)
        sincronizador(e).refrescar(ANA, DIA1)
        assertFresco(e, ANA, DIA1)
    }

    @Test
    fun `refrescar en un dia no adelanta el trio de dias futuros`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        sincronizador(e).refrescar(ANA, DIA1)
        // Sin escrituras nuevas, el mismo trío tiene que servir mañana.
        assertFresco(e, ANA, DIA2)
    }
}
