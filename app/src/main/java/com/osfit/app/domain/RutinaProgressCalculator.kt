package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import java.time.LocalDate

/**
 * Calcula el próximo día del ciclo de rutina que le toca a un cliente
 * después de marcar su asistencia en una fecha.
 */
object RutinaProgressCalculator {

    fun diaEfectivo(diaActualIndex: Int, diaPendienteIndex: Int?, diaPendienteFecha: String?, hoy: String): Int {
        return if (diaPendienteIndex != null && diaPendienteFecha != null && hoy > diaPendienteFecha) {
            diaPendienteIndex
        } else {
            diaActualIndex
        }
    }

    fun diaEfectivo(cliente: Cliente): Int =
        diaEfectivo(cliente.diaActualIndex, cliente.diaPendienteIndex, cliente.diaPendienteFecha, LocalDate.now().toString())

    fun calcularSiguienteDiaActualIndex(
        asistio: Boolean,
        diaActualIndexPrevio: Int,
        diaRutinaRealizado: Int?,
        totalDias: Int
    ): Int {
        require(totalDias > 0) { "totalDias debe ser mayor a 0, fue $totalDias" }

        if (!asistio) {
            return diaActualIndexPrevio
        }

        val realizado = requireNotNull(diaRutinaRealizado) {
            "diaRutinaRealizado es obligatorio cuando asistio = true"
        }
        require(realizado in 0 until totalDias) {
            "diaRutinaRealizado ($realizado) fuera de rango [0, $totalDias)"
        }

        val siguiente = realizado + 1
        return if (siguiente >= totalDias) 0 else siguiente
    }

    /**
     * Al corregir el día de rutina realizado en una fecha pasada, el avance resultante
     * solo debe quedar pendiente (no aplicarse ya) y solo si esa fecha es la más reciente
     * conocida. Si ya había un pendiente de una fecha posterior, la corrección de una
     * fecha más vieja no debe pisarlo.
     */
    fun debeActualizarPendiente(fecha: String, diaPendienteFechaActual: String?): Boolean =
        diaPendienteFechaActual == null || fecha >= diaPendienteFechaActual

    /**
     * Al reiniciar por completo una fecha (borrar toda la asistencia tomada ese día),
     * hay que deshacer también el avance de rutina que esa fecha haya dejado pendiente
     * en cada cliente. Si el pendiente es de otra fecha, no se toca.
     */
    fun clientesConPendienteEnFecha(clientes: List<Cliente>, fecha: String): List<String> =
        clientes.filter { it.diaPendienteFecha == fecha }.map { it.id }
}
