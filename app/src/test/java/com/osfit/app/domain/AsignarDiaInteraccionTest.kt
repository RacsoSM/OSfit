package com.osfit.app.domain

import com.osfit.app.data.fake.FakeAsistenciaRepository
import com.osfit.app.data.fake.FakeClienteRepository
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Escenarios donde "Asignar día" (corrección manual) se cruza con la asistencia y el
 * cronómetro. Cada test replica la misma secuencia de llamadas que hacen las pantallas
 * (TomarAsistenciaViewModel / ClienteDetailViewModel / SandboxViewModel), para cubrir
 * las combinaciones donde el día efectivo podría descuadrarse.
 */
class AsignarDiaInteraccionTest {

    private val dia1 = "2026-09-02"
    private val dia2 = "2026-09-03"
    private val dia3 = "2026-09-04"

    // ---- Ayudas que imitan exactamente lo que hacen los ViewModels ----

    private class Escenario {
        val clientes = FakeClienteRepository()
        val asistencias = FakeAsistenciaRepository(clientes)

        suspend fun cliente(id: String): Cliente =
            clientes.observarClientes().first().first { it.id == id }

        suspend fun asistencia(id: String, fecha: String): Asistencia? =
            asistencias.observarAsistenciasPorFecha(fecha).first().firstOrNull { it.clienteId == id }

        suspend fun diaEfectivo(id: String, hoy: String): Int = cliente(id).let {
            RutinaProgressCalculator.diaEfectivo(
                it.diaActualIndex, it.diaPendienteIndex, it.diaPendienteFecha, hoy
            )
        }

        suspend fun totalDias(id: String): Int = cliente(id).rutinaAsignada?.dias?.size ?: 1

        /** Equivale al botón "Asignar día" (ClienteDetailViewModel.asignarDiaActual). */
        suspend fun asignarDia(id: String, dia: Int) = clientes.actualizarDiaActual(id, dia)

        /** Equivale a marcar Asistió/Faltó y guardar (TomarAsistenciaViewModel.guardarTodo). */
        suspend fun marcar(id: String, fecha: String, asistio: Boolean) {
            val c = cliente(id)
            val efectivo = diaEfectivo(id, fecha)
            asistencias.registrarAsistencia(
                clienteId = id,
                fecha = fecha,
                asistio = asistio,
                diaActualIndexPrevio = efectivo,
                diaRutinaRealizado = if (asistio) efectivo else null,
                totalDiasRutina = totalDias(id),
                diaPendienteFechaActual = c.diaPendienteFecha,
                nota = ""
            )
        }

        /** Equivale al botón "Iniciar tiempo". */
        suspend fun iniciarTiempo(id: String, fecha: String) {
            asistencias.iniciarTiempo(
                clienteId = id,
                fecha = fecha,
                diaActualIndexPrevio = diaEfectivo(id, fecha),
                totalDiasRutina = totalDias(id)
            )
        }

        /** Equivale a "Reiniciar día" en Tomar asistencia. */
        suspend fun reiniciarDia(fecha: String) {
            val conPendiente = RutinaProgressCalculator.clientesConPendienteEnFecha(
                clientes.observarClientes().first(), fecha
            )
            asistencias.reiniciarDia(fecha, conPendiente)
        }
    }

    // Ana: rutina de 4 días (Empuje/Tirón/Pierna/Full Body), diaActualIndex = 1.
    private val ana = "1"
    // Beto: rutina de 3 días, diaActualIndex = 2 (último del ciclo).
    private val beto = "2"
    // Carla: 4 días, diaActualIndex = 0 con pendiente = 1 ya vencido.
    private val carla = "3"
    // Diego: sin rutina asignada.
    private val diego = "4"

    // ---------------- Asignar día por sí solo ----------------

    @Test
    fun `asignar dia fija el dia y no avanza aunque pasen los dias`() = runBlocking {
        val e = Escenario()
        e.asignarDia(ana, 3)

        assertEquals(3, e.diaEfectivo(ana, dia1))
        assertEquals("sin asistencia no debe avanzar", 3, e.diaEfectivo(ana, dia2))
        assertEquals(3, e.diaEfectivo(ana, dia3))
    }

    @Test
    fun `asignar dia limpia un pendiente vencido en vez de dejar que lo pise`() = runBlocking {
        val e = Escenario()
        // Carla llega con pendiente vencido: su día efectivo ya es el 1.
        assertEquals(1, e.diaEfectivo(carla, dia1))

        // El entrenador la corrige manualmente al día 0.
        e.asignarDia(carla, 0)

        val c = e.cliente(carla)
        assertNull("el pendiente debe quedar limpio", c.diaPendienteIndex)
        assertNull(c.diaPendienteFecha)
        assertEquals("la corrección manual manda hoy", 0, e.diaEfectivo(carla, dia1))
        assertEquals("y también mañana", 0, e.diaEfectivo(carla, dia2))
    }

    // ---------------- Asignar día + asistencia ----------------

    @Test
    fun `asignar dia y luego marcar asistencia avanza desde el dia asignado`() = runBlocking {
        val e = Escenario()
        e.asignarDia(ana, 3)
        e.marcar(ana, dia1, asistio = true)

        assertEquals("hoy se está haciendo el día asignado", 3, e.diaEfectivo(ana, dia1))
        assertEquals(
            "la asistencia registra el día asignado",
            3,
            e.asistencia(ana, dia1)?.diaRutinaRealizado
        )
        assertEquals("mañana da la vuelta al día 0", 0, e.diaEfectivo(ana, dia2))
    }

    @Test
    fun `asignar dia y luego iniciar tiempo avanza desde el dia asignado`() = runBlocking {
        val e = Escenario()
        e.asignarDia(ana, 2)
        e.iniciarTiempo(ana, dia1)

        assertEquals(2, e.diaEfectivo(ana, dia1))
        assertEquals(2, e.asistencia(ana, dia1)?.diaRutinaRealizado)
        assertEquals(3, e.diaEfectivo(ana, dia2))
    }

    @Test
    fun `asignar dia despues de marcar asistencia el mismo dia manda sobre el avance`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true) // deja pendiente el día 2
        assertEquals(2, e.diaEfectivo(ana, dia2))

        // El entrenador corrige manualmente: la corrección es la última palabra.
        e.asignarDia(ana, 0)

        assertEquals("la corrección manual pisa el avance", 0, e.diaEfectivo(ana, dia1))
        assertEquals(0, e.diaEfectivo(ana, dia2))
        // La asistencia de ese día NO se toca: sigue diciendo que hizo el día 1.
        // Documenta la divergencia conocida entre Calendario-Rutina y el día del cliente.
        assertEquals(
            "la asistencia guardada conserva el día que se registró",
            1,
            e.asistencia(ana, dia1)?.diaRutinaRealizado
        )
    }

    @Test
    fun `asignar dia al ultimo del ciclo y asistir da la vuelta al dia 1`() = runBlocking {
        val e = Escenario()
        val total = e.totalDias(ana)
        e.asignarDia(ana, total - 1)
        e.marcar(ana, dia1, asistio = true)

        assertEquals(total - 1, e.diaEfectivo(ana, dia1))
        assertEquals("tras el último día vuelve al primero", 0, e.diaEfectivo(ana, dia2))
    }

    // ---------------- Deshacer / idempotencia ----------------

    @Test
    fun `iniciar tiempo y luego marcar falto el mismo dia deshace el avance`() = runBlocking {
        val e = Escenario()
        e.iniciarTiempo(ana, dia1)
        assertEquals(2, e.diaEfectivo(ana, dia2))

        // El entrenador se corrige: en realidad faltó.
        e.marcar(ana, dia1, asistio = false)

        val c = e.cliente(ana)
        assertNull("el pendiente se deshace", c.diaPendienteIndex)
        assertEquals("sigue tocando el día 1 hoy", 1, e.diaEfectivo(ana, dia1))
        assertEquals("y mañana también, faltar no avanza", 1, e.diaEfectivo(ana, dia2))
        assertEquals(false, e.asistencia(ana, dia1)?.asistio)
        assertNull("faltar borra el día realizado", e.asistencia(ana, dia1)?.diaRutinaRealizado)
    }

    @Test
    fun `marcar asistencia y luego iniciar tiempo el mismo dia no avanza dos veces`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true)
        e.iniciarTiempo(ana, dia1)

        assertEquals("hoy sigue siendo el día 1", 1, e.diaEfectivo(ana, dia1))
        assertEquals("mañana toca el 2, no el 3", 2, e.diaEfectivo(ana, dia2))
    }

    @Test
    fun `marcar asistencia dos veces el mismo dia es idempotente`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true)
        e.marcar(ana, dia1, asistio = true)

        assertEquals(1, e.diaEfectivo(ana, dia1))
        assertEquals(2, e.diaEfectivo(ana, dia2))
    }

    @Test
    fun `reiniciar el dia deja al cliente como si no se hubiera tocado ese dia`() = runBlocking {
        val e = Escenario()
        val antes = e.diaEfectivo(ana, dia1)
        e.marcar(ana, dia1, asistio = true)
        e.reiniciarDia(dia1)

        assertNull("no queda asistencia de ese día", e.asistencia(ana, dia1))
        assertEquals("el día efectivo vuelve a lo que era", antes, e.diaEfectivo(ana, dia1))
        assertEquals("y no avanza al día siguiente", antes, e.diaEfectivo(ana, dia2))
    }

    @Test
    fun `reiniciar un dia solo deshace el avance de ese dia, no el de dias anteriores`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true) // día 1 hecho -> pendiente día 2
        e.marcar(ana, dia2, asistio = true) // día 2 hecho -> pendiente día 3
        assertEquals(3, e.diaEfectivo(ana, dia3))

        e.reiniciarDia(dia2)

        assertNull(e.asistencia(ana, dia2))
        assertEquals(
            "se conserva el avance ganado el día 1",
            2,
            e.diaEfectivo(ana, dia3)
        )
    }

    // ---------------- Casos límite ----------------

    @Test
    fun `cliente sin rutina asignada no rompe al iniciar tiempo`() = runBlocking {
        val e = Escenario()
        e.iniciarTiempo(diego, dia1)

        assertEquals(0, e.diaEfectivo(diego, dia1))
        assertEquals(0, e.diaEfectivo(diego, dia2))
        assertEquals(true, e.asistencia(diego, dia1)?.asistio)
    }

    @Test
    fun `ciclo completo de tres dias con iniciar tiempo vuelve al inicio`() = runBlocking {
        val e = Escenario()
        // Beto arranca en el último día de un ciclo de 3.
        val esperados = listOf(2, 0, 1, 2)
        val fechas = listOf(dia1, dia2, dia3, "2026-09-05")

        fechas.forEachIndexed { indice, fecha ->
            assertEquals("día efectivo en $fecha", esperados[indice], e.diaEfectivo(beto, fecha))
            e.iniciarTiempo(beto, fecha)
            assertEquals(
                "iniciar tiempo no mueve el día de $fecha",
                esperados[indice],
                e.diaEfectivo(beto, fecha)
            )
        }
    }

    @Test
    fun `faltar varios dias seguidos no mueve el dia del ciclo`() = runBlocking {
        val e = Escenario()
        val inicial = e.diaEfectivo(ana, dia1)

        e.marcar(ana, dia1, asistio = false)
        e.marcar(ana, dia2, asistio = false)
        e.marcar(ana, dia3, asistio = false)

        assertEquals("sigue tocando el mismo día", inicial, e.diaEfectivo(ana, dia3))
        assertEquals(inicial, e.diaEfectivo(ana, "2026-09-05"))
    }

    @Test
    fun `corregir el dia realizado en la pestana Rutina no descuadra el dia del cliente`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true) // registra que hizo el día 1

        // El entrenador corrige en la pestaña Rutina: en realidad hizo el día 3.
        e.asistencias.actualizarDiaRealizado(ana, dia1, 3)
        val total = e.totalDias(ana)
        if (RutinaProgressCalculator.debeActualizarPendiente(dia1, e.cliente(ana).diaPendienteFecha)) {
            val siguiente = (3 + 1).let { if (it >= total) 0 else it }
            e.clientes.actualizarDiaPendiente(ana, siguiente, dia1)
        }

        assertEquals(3, e.asistencia(ana, dia1)?.diaRutinaRealizado)
        assertEquals("mañana toca el día siguiente al corregido", 0, e.diaEfectivo(ana, dia2))
    }
}
