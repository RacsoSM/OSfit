package com.osfit.app.domain

import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import java.time.LocalDate

/**
 * "Asignar día": corrección manual del día del ciclo que le toca a un cliente.
 *
 * Escribe las dos cosas que hacen falta para que la corrección valga hoy y siga viva mañana:
 *
 *  1. **El ancla** ([ClienteRepository.asignarDiaAncla]), que manda mientras el cliente no
 *     tenga asistencias posteriores a su fecha. Se fecha en el **día anterior** a [hoy]
 *     porque [RutinaProgressCalculator] toma el historial *estrictamente* después del ancla:
 *     así la asistencia de hoy entra en la ventana y mañana el ciclo avanza, en vez de
 *     quedarse trabado para siempre en el día asignado.
 *  2. **El registro de hoy** ([AsistenciaRepository.actualizarDiaRealizado]), si el cliente
 *     ya tenía asistencia marcada. Calendario-Rutina es la fuente de verdad, así que debe
 *     decir lo mismo que se acaba de asignar; si no, el historial pisaría la corrección al
 *     instante y además las estadísticas contarían un día que el cliente no hizo. No hace
 *     nada si hoy no hay registro, o si el registro es una falta.
 *
 * El resultado es el mismo sin importar el orden en que el entrenador haga las cosas
 * (asignar y luego marcar asistencia, o marcar asistencia y luego corregir el día).
 */
object AsignarDiaManual {

    suspend fun ejecutar(
        clienteRepository: ClienteRepository,
        asistenciaRepository: AsistenciaRepository,
        clienteId: String,
        diaIndex: Int,
        hoy: String
    ) {
        val ancla = LocalDate.parse(hoy).minusDays(1).toString()
        clienteRepository.asignarDiaAncla(clienteId, diaIndex, ancla)
        asistenciaRepository.actualizarDiaRealizado(clienteId, hoy, diaIndex)
    }
}
