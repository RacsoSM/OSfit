package com.osfit.app.domain

import com.osfit.app.data.fake.FakeAsistenciaRepository
import com.osfit.app.data.fake.FakeClienteRepository
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Qué cambia exactamente al corregir el día desde la pestaña "Rutina" de Tomar asistencia
 * (TomarAsistenciaViewModel.guardarCambiosDia): además del registro de asistencia, esa
 * acción también reescribe el día pendiente del cliente.
 */
class CorregirDiaRealizadoTest {

    private val dia1 = "2026-09-02"
    private val dia2 = "2026-09-03"
    private val dia3 = "2026-09-04"

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

        suspend fun marcar(id: String, fecha: String, asistio: Boolean) {
            val c = cliente(id)
            val efectivo = diaEfectivo(id, fecha)
            asistencias.registrarAsistencia(
                clienteId = id, fecha = fecha, asistio = asistio,
                diaActualIndexPrevio = efectivo,
                diaRutinaRealizado = if (asistio) efectivo else null,
                totalDiasRutina = totalDias(id),
                diaPendienteFechaActual = c.diaPendienteFecha, nota = ""
            )
        }

        /** Réplica exacta de TomarAsistenciaViewModel.guardarCambiosDia para un cliente. */
        suspend fun corregirDiaRealizado(id: String, fecha: String, diaElegido: Int) {
            val c = cliente(id)
            val total = c.rutinaAsignada?.dias?.size ?: return
            asistencias.actualizarDiaRealizado(id, fecha, diaElegido)
            if (RutinaProgressCalculator.debeActualizarPendiente(fecha, c.diaPendienteFecha)) {
                val siguiente = (diaElegido + 1).let { if (it >= total) 0 else it }
                clientes.actualizarDiaPendiente(id, siguiente, fecha)
            }
        }
    }

    private val ana = "1" // 4 días, diaActualIndex = 1

    @Test
    fun `corregir el dia cambia el registro Y tambien el dia que le toca despues`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true) // registra el día 1
        assertEquals(1, e.asistencia(ana, dia1)?.diaRutinaRealizado)
        assertEquals("antes de corregir, mañana tocaba el día 2", 2, e.diaEfectivo(ana, dia2))

        // El entrenador corrige: en realidad hizo el día 3 (último de 4).
        e.corregirDiaRealizado(ana, dia1, 3)

        // 1) Cambia el registro de asistencia.
        assertEquals("el registro guarda el día corregido", 3, e.asistencia(ana, dia1)?.diaRutinaRealizado)
        // 2) Y TAMBIÉN cambia el día que le toca después: ya no el 2, sino el siguiente al corregido.
        assertEquals("mañana toca el siguiente al corregido (da la vuelta)", 0, e.diaEfectivo(ana, dia2))
    }

    @Test
    fun `corregir el dia no mueve el dia efectivo de hoy, solo el de mañana`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true)
        val hoyAntes = e.diaEfectivo(ana, dia1)

        e.corregirDiaRealizado(ana, dia1, 3)

        assertEquals("hoy no se mueve al corregir", hoyAntes, e.diaEfectivo(ana, dia1))
    }

    @Test
    fun `corregir una fecha mas vieja que el pendiente actual no pisa el avance reciente`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true) // pendiente (2, dia1)
        e.marcar(ana, dia2, asistio = true) // pendiente (3, dia2)
        assertEquals(3, e.diaEfectivo(ana, dia3))

        // Se corrige una fecha vieja: no debe pisar el pendiente generado por la más reciente.
        e.corregirDiaRealizado(ana, dia1, 0)

        assertEquals("el registro viejo sí se corrige", 0, e.asistencia(ana, dia1)?.diaRutinaRealizado)
        assertEquals("pero el avance reciente se respeta", 3, e.diaEfectivo(ana, dia3))
    }

    @Test
    fun `corregir el dia dos veces deja el ultimo valor elegido`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true)

        e.corregirDiaRealizado(ana, dia1, 3)
        e.corregirDiaRealizado(ana, dia1, 2)

        assertEquals(2, e.asistencia(ana, dia1)?.diaRutinaRealizado)
        assertEquals("mañana toca el siguiente al último corregido", 3, e.diaEfectivo(ana, dia2))
    }

    @Test
    fun `corregir sin asistencia registrada no crea registro ni mueve el dia`() = runBlocking {
        val e = Escenario()
        val antes = e.diaEfectivo(ana, dia2)

        // actualizarDiaRealizado no crea el registro si no existe (return temprano).
        e.asistencias.actualizarDiaRealizado(ana, dia1, 3)

        assertEquals("no se inventa un registro", null, e.asistencia(ana, dia1))
        assertEquals("y el día no se mueve", antes, e.diaEfectivo(ana, dia2))
    }

    @Test
    fun `corregir un registro viejo pisa una asignacion manual posterior`() = runBlocking {
        val e = Escenario()
        e.marcar(ana, dia1, asistio = true) // deja pendiente (2, dia1)

        // El entrenador corrige manualmente el día del cliente: esto limpia el pendiente.
        e.clientes.actualizarDiaActual(ana, 1)
        assertEquals("la asignación manual manda", 1, e.diaEfectivo(ana, dia3))

        // Ahora toca el registro viejo del día 1 desde la pestaña Rutina. Como la asignación
        // manual dejó el pendiente en null, debeActualizarPendiente() devuelve true y la
        // corrección de una fecha VIEJA vuelve a escribir el pendiente, pisando la asignación.
        e.corregirDiaRealizado(ana, dia1, 3)

        assertEquals(
            "corregir una fecha vieja revive el avance y pisa la asignación manual",
            0,
            e.diaEfectivo(ana, dia3)
        )
    }

    @Test
    fun `tras corregir, el dia efectivo de mañana coincide con el siguiente al registro guardado`() = runBlocking {
        val e = Escenario()
        val total = e.totalDias(ana)

        // Recorre todas las correcciones posibles y comprueba la invariante:
        // día efectivo de mañana == (día del registro + 1) dentro del ciclo.
        for (diaCorregido in 0 until total) {
            val esc = Escenario()
            esc.marcar(ana, dia1, asistio = true)
            esc.corregirDiaRealizado(ana, dia1, diaCorregido)

            val registro = esc.asistencia(ana, dia1)?.diaRutinaRealizado
            val esperadoMañana = (diaCorregido + 1).let { if (it >= total) 0 else it }
            assertEquals("registro tras corregir a $diaCorregido", diaCorregido, registro)
            assertEquals(
                "mañana tras corregir a $diaCorregido",
                esperadoMañana,
                esc.diaEfectivo(ana, dia2)
            )
        }
    }
}
