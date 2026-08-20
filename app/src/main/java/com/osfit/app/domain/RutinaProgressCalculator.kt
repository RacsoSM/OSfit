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
}
