package com.osfit.app.domain

import com.osfit.app.domain.EscenarioRutina.Companion.ANA
import com.osfit.app.domain.EscenarioRutina.Companion.ELENA
import com.osfit.app.domain.EscenarioRutina.Companion.JUEVES
import com.osfit.app.domain.EscenarioRutina.Companion.LUNES
import com.osfit.app.domain.EscenarioRutina.Companion.LUNES_SIGUIENTE
import com.osfit.app.domain.EscenarioRutina.Companion.MARTES
import com.osfit.app.domain.EscenarioRutina.Companion.MIERCOLES
import com.osfit.app.domain.EscenarioRutina.Companion.SABADO
import com.osfit.app.domain.EscenarioRutina.Companion.VIERNES
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Rutina
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * El caso que originó la feature: la rutina de Elena empieza y termina con pierna, así que
 * el día 5 y el día 1 no pueden caer en días consecutivos.
 */
class ReinicioSemanalTest {

    @Test
    fun `la semana completa recorre los cinco dias`() = runBlocking {
        val e = EscenarioRutina()
        val fechas = listOf(LUNES, MARTES, MIERCOLES, JUEVES, VIERNES)

        fechas.forEachIndexed { indice, fecha ->
            assertEquals("día en $fecha", DiaQueToca.Dia(indice), e.estado(ELENA, fecha))
            e.marcar(ELENA, fecha, asistio = true)
        }

        assertEquals("el lunes siguiente vuelve al día 1", DiaQueToca.Dia(0), e.estado(ELENA, LUNES_SIGUIENTE))
    }

    @Test
    fun `faltar un dia deja la semana en el dia 4 y el dia 5 no se hace`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ELENA, LUNES, asistio = true)      // día 1
        e.marcar(ELENA, MARTES, asistio = true)     // día 2
        e.marcar(ELENA, MIERCOLES, asistio = false) // falta
        e.marcar(ELENA, JUEVES, asistio = true)     // día 3
        e.marcar(ELENA, VIERNES, asistio = true)    // día 4

        assertEquals("termina la semana en el día 4", DiaQueToca.Dia(3), e.estado(ELENA, VIERNES))
        assertEquals(
            "y el lunes empieza en el día 1, no en el 5",
            DiaQueToca.Dia(0),
            e.estado(ELENA, LUNES_SIGUIENTE)
        )
    }

    @Test
    fun `faltar el lunes no corre el dia uno, lo hace el martes`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ELENA, LUNES, asistio = false)

        assertEquals("el martes es su primera asistencia de la semana", DiaQueToca.Dia(0), e.estado(ELENA, MARTES))
    }

    @Test
    fun `con la semana completa el sabado toca descansar`() = runBlocking {
        val e = EscenarioRutina()
        listOf(LUNES, MARTES, MIERCOLES, JUEVES, VIERNES).forEach {
            e.marcar(ELENA, it, asistio = true)
        }

        assertEquals("ya hizo los cinco días", DiaQueToca.Descanso, e.estado(ELENA, SABADO))
    }

    /** Decisión consciente del spec, sección "Un caso aceptado a sabiendas". */
    @Test
    fun `con la semana incompleta el sabado sirve para recuperar el dia que falta`() = runBlocking {
        val e = EscenarioRutina()
        e.marcar(ELENA, LUNES, asistio = true)
        e.marcar(ELENA, MARTES, asistio = true)
        e.marcar(ELENA, MIERCOLES, asistio = false)
        e.marcar(ELENA, JUEVES, asistio = true)
        e.marcar(ELENA, VIERNES, asistio = true)

        assertEquals("le queda el día 5 por hacer", DiaQueToca.Dia(4), e.estado(ELENA, SABADO))
    }

    @Test
    fun `asignar el dia a mano manda el resto de la semana y no mas alla`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ELENA, dia = 1, fecha = MIERCOLES)

        assertEquals("el miércoles hace el día asignado", DiaQueToca.Dia(1), e.estado(ELENA, MIERCOLES))
        e.marcar(ELENA, MIERCOLES, asistio = true)
        assertEquals("el jueves sigue desde ahí", DiaQueToca.Dia(2), e.estado(ELENA, JUEVES))
        assertEquals(
            "y el lunes el reinicio lo barre igual",
            DiaQueToca.Dia(0),
            e.estado(ELENA, LUNES_SIGUIENTE)
        )
    }

    /**
     * Los clientes anteriores a `FECHA_CORTE` no tienen ancla propia: `anclaDe` se la congela
     * en la fecha de corte. Esa fecha es de una semana muy anterior, así que el reinicio la
     * corre al domingo sin necesitar ningún tratamiento especial.
     */
    @Test
    fun `un cliente anterior al corte arranca en el dia 1 con reinicio semanal`() {
        val rutina = Rutina(
            id = "r",
            nombre = "Cinco días",
            reinicioSemanal = true,
            dias = (1..5).map { DiaRutina(nombreDia = "Día $it") }
        )
        val cliente = Cliente(
            id = "legacy",
            nombre = "Anterior al corte",
            rutinaAsignada = rutina,
            diaActualIndex = 3,
            diaAnclaFecha = null,
            diaPendienteIndex = 4,
            diaPendienteFecha = "2026-08-20"
        )

        assertEquals(
            "el día congelado no sobrevive al reinicio",
            DiaQueToca.Dia(0),
            RutinaProgressCalculator.diaQueToca(cliente, emptyList(), LUNES)
        )
    }

    /**
     * `cambiarDia` (Cloud Function) fecha el ancla AYER. Hecho en lunes, ayer es domingo, que
     * es exactamente la fecha del ancla del reinicio. La comparación es `>=` y no `>` para que
     * ese empate lo gane el cambio manual: si lo perdiera, la clienta cambiaría su día un lunes
     * y el cambio se evaporaría en el acto.
     */
    @Test
    fun `un cambio manual hecho en lunes sobrevive al reinicio de ese mismo lunes`() = runBlocking {
        val e = EscenarioRutina()
        e.asignarDia(ELENA, dia = 2, fecha = LUNES)

        assertEquals("el ancla de domingo empata y gana", DiaQueToca.Dia(2), e.estado(ELENA, LUNES))
    }

    @Test
    fun `una rutina sin reinicio sigue dando la vuelta`() = runBlocking {
        val e = EscenarioRutina()
        // Ana tiene 4 días, sin reinicio semanal, y su ancla la deja en el día 2 (índice 1).
        e.marcar(ANA, LUNES, asistio = true)      // índice 1
        e.marcar(ANA, MARTES, asistio = true)     // índice 2
        e.marcar(ANA, MIERCOLES, asistio = true)  // índice 3, el último

        assertEquals("da la vuelta al primero", DiaQueToca.Dia(0), e.estado(ANA, JUEVES))
        assertEquals(
            "y el lunes siguiente sigue rodando, sin reiniciar",
            DiaQueToca.Dia(0),
            e.estado(ANA, LUNES_SIGUIENTE)
        )
    }
}
