package com.osfit.app.domain

import com.osfit.app.domain.EscenarioRutina.Companion.ANA
import com.osfit.app.domain.EscenarioRutina.Companion.BETO
import com.osfit.app.domain.EscenarioRutina.Companion.CARLA
import com.osfit.app.domain.EscenarioRutina.Companion.DIA1
import com.osfit.app.domain.EscenarioRutina.Companion.DIA2
import com.osfit.app.domain.EscenarioRutina.Companion.DIA3
import com.osfit.app.domain.EscenarioRutina.Companion.DIEGO
import com.osfit.app.domain.EscenarioRutina.Companion.ELENA
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * La web no recalcula el día: interpreta el trío que la app denormaliza. Este test es la
 * red de seguridad de ese mecanismo — verifica que interpretar el trío da **exactamente**
 * lo mismo que `diaQueToca`, que es la única implementación real.
 *
 * Si alguien cambia el calculador y no la denormalización, estos tests fallan.
 */
class DiaDenormalizadoTest {

    /** Denormaliza en [hoy] e interpreta en [cuando]; debe coincidir con diaQueToca(cuando). */
    private fun assertEquivale(e: EscenarioRutina, id: String, hoy: String, cuando: String) = runBlocking {
        val cliente = e.cliente(id)
        val asistencias = e.asistenciasDe(id)
        val rutina = cliente.rutinaAsignada
        val totalDias = rutina?.dias?.size ?: 0

        val valor = RutinaProgressCalculator.denormalizar(cliente, asistencias, hoy)
        val interpretado = RutinaProgressCalculator.interpretar(
            valor, totalDias, cuando, rutina?.reinicioSemanal ?: false
        )

        assertEquals(
            "denormalizado en $hoy e interpretado en $cuando",
            RutinaProgressCalculator.diaQueToca(cliente, asistencias, cuando),
            interpretado
        )
    }

    @Test
    fun `sin asistencias equivale al dia del ancla`() {
        val e = EscenarioRutina()
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA1)
    }

    @Test
    fun `sin asistencias sigue equivaliendo dias despues`() {
        val e = EscenarioRutina()
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA3)
    }

    @Test
    fun `con asistencia de hoy equivale al dia que esta haciendo`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA1)
    }

    @Test
    fun `con asistencia de ayer equivale al dia siguiente`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `el trio no caduca al pasar los dias sin escrituras`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = true)
        // Denormalizado una sola vez en DIA1, interpretado tres días después: la web
        // funciona sin que nadie refresque nada mientras no haya movimientos.
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA3)
    }

    @Test
    fun `equivale en la vuelta al dia 1 del ciclo`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(BETO, DIA1, asistio = true) // Beto está en el último día de su ciclo
        assertEquivale(e, BETO, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `las faltas no avanzan el ciclo tampoco al denormalizar`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ANA, DIA1, asistio = false)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `equivale para un cliente anterior al corte`() {
        val e = EscenarioRutina()
        assertEquivale(e, CARLA, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `sin rutina asignada equivale a cero`() {
        val e = EscenarioRutina()
        assertEquivale(e, DIEGO, hoy = DIA1, cuando = DIA1)
    }

    @Test
    fun `tras asignar dia manualmente equivale al dia asignado`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ANA, dia = 3, fecha = DIA1)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA1)
        assertEquivale(e, ANA, hoy = DIA1, cuando = DIA2)
    }

    @Test
    fun `sin rutina el dia denormalizado es nulo`() = runBlocking {
        val e = EscenarioRutina()
        val valor = RutinaProgressCalculator.denormalizar(e.cliente(DIEGO), e.asistenciasDe(DIEGO), DIA1)
        assertEquals(null, valor.dia)
    }

    @Test
    fun `con reinicio semanal el cruce de semana equivale`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ELENA, EscenarioRutina.VIERNES, asistio = true)
        assertEquivale(e, ELENA, hoy = EscenarioRutina.VIERNES, cuando = EscenarioRutina.LUNES_SIGUIENTE)
    }

    @Test
    fun `con reinicio semanal el descanso equivale`() = runBlocking {
        val e = EscenarioRutina()
        listOf(
            EscenarioRutina.LUNES, EscenarioRutina.MARTES, EscenarioRutina.MIERCOLES,
            EscenarioRutina.JUEVES, EscenarioRutina.VIERNES
        ).forEach { e.marcar(ELENA, it, asistio = true) }
        assertEquivale(e, ELENA, hoy = EscenarioRutina.VIERNES, cuando = EscenarioRutina.SABADO)
    }

    @Test
    fun `con reinicio semanal el ancla de la semana pasada equivale`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ELENA, dia = 2, fecha = EscenarioRutina.MIERCOLES)
        assertEquivale(e, ELENA, hoy = EscenarioRutina.MIERCOLES, cuando = EscenarioRutina.LUNES_SIGUIENTE)
    }

    /**
     * El ancla que escribe `cambiarDia` un lunes queda fechada en domingo, y el domingo, en
     * ISO, pertenece a la semana anterior. Si `interpretar` truncara a lunes, reiniciaría un
     * ancla que es de esta semana y la web mostraría el día 1 mientras la app muestra el 3.
     */
    @Test
    fun `con reinicio semanal el cambio manual del lunes equivale`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ELENA, dia = 2, fecha = EscenarioRutina.LUNES)
        assertEquivale(e, ELENA, hoy = EscenarioRutina.LUNES, cuando = EscenarioRutina.LUNES)
        assertEquivale(e, ELENA, hoy = EscenarioRutina.LUNES, cuando = EscenarioRutina.MARTES)
    }
}
