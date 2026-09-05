package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.model.Cliente
import java.time.LocalDate

/**
 * Determina qué día del ciclo de rutina le toca a un cliente.
 *
 * La fuente de verdad es el historial de asistencias (Calendario-Rutina): el día se
 * deduce del último día registrado, no se guarda en el cliente. "Asignar día" deja un
 * ancla que manda solo mientras no haya asistencias posteriores a su fecha.
 *
 * [Cliente.diaAnclaFecha] es **exclusiva**: el historial toma el mando estrictamente
 * después de ella. Por eso [AsignarDiaManual] fecha el ancla en el día anterior a la
 * corrección — así la asistencia del mismo día ya cuenta y el ciclo avanza al día
 * siguiente en vez de quedarse trabado en el día asignado.
 */
object RutinaProgressCalculator {

    /**
     * Día anterior a que Calendario-Rutina pasara a ser la fuente de verdad.
     *
     * Los clientes creados antes de ese cambio no tienen [Cliente.diaAnclaFecha]: su día
     * se congela evaluando la fórmula vieja en el día siguiente a esta fecha, y a partir
     * de aquí manda el historial. Congelar (en vez de recalcular desde el historial
     * completo) evita que a nadie le cambie el día al actualizar la app.
     */
    const val FECHA_CORTE = "2026-09-01"

    /** Día del ancla y la última fecha que cubre (exclusiva), para clientes viejos y nuevos. */
    private data class Ancla(val dia: Int, val fecha: String)

    private fun anclaDe(cliente: Cliente): Ancla {
        val fechaAncla = cliente.diaAnclaFecha
        if (fechaAncla != null) return Ancla(cliente.diaActualIndex, fechaAncla)

        // Cliente anterior al cambio: se congela con la fórmula vieja, evaluada un día
        // después del corte para que los pendientes de esa fecha o anteriores ya hayan
        // vencido y queden contados aquí en vez de en el historial.
        val diaCongelado = diaEfectivoLegacy(
            diaActualIndex = cliente.diaActualIndex,
            diaPendienteIndex = cliente.diaPendienteIndex,
            diaPendienteFecha = cliente.diaPendienteFecha,
            hoy = LocalDate.parse(FECHA_CORTE).plusDays(1).toString()
        )
        return Ancla(diaCongelado, FECHA_CORTE)
    }

    /**
     * Fórmula anterior al cambio, conservada solo para congelar el día de los clientes
     * que ya existían. No usar para lógica nueva.
     */
    private fun diaEfectivoLegacy(
        diaActualIndex: Int,
        diaPendienteIndex: Int?,
        diaPendienteFecha: String?,
        hoy: String
    ): Int = if (diaPendienteIndex != null && diaPendienteFecha != null && hoy > diaPendienteFecha) {
        diaPendienteIndex
    } else {
        diaActualIndex
    }

    /**
     * Día del ciclo que le toca al cliente en [hoy].
     *
     * Toma la asistencia más reciente posterior al ancla: si es de hoy, es el día que
     * está haciendo hoy; si es anterior, le toca el siguiente del ciclo. Las faltas
     * guardan `diaRutinaRealizado = null`, así que quedan fuera por construcción y no
     * avanzan el ciclo.
     *
     * [asistenciasDelCliente] puede traer asistencias de cualquier fecha; se filtran aquí.
     */
    fun diaQueToca(cliente: Cliente, asistenciasDelCliente: List<Asistencia>, hoy: String): Int {
        val totalDias = cliente.rutinaAsignada?.dias?.size ?: return 0
        if (totalDias <= 0) return 0

        val ancla = anclaDe(cliente)

        val ultima = asistenciasDelCliente
            .filter { it.clienteId == cliente.id || cliente.id.isEmpty() }
            .filter { it.asistio && it.diaRutinaRealizado != null }
            .filter { it.fecha > ancla.fecha && it.fecha <= hoy }
            .maxByOrNull { it.fecha }
            ?: return ancla.dia.coerceIn(0, totalDias - 1)

        val realizado = ultima.diaRutinaRealizado!!.coerceIn(0, totalDias - 1)
        return if (ultima.fecha == hoy) realizado else siguienteDia(realizado, totalDias)
    }

    /** Versión de conveniencia para "hoy" real. */
    fun diaQueToca(cliente: Cliente, asistenciasDelCliente: List<Asistencia>): Int =
        diaQueToca(cliente, asistenciasDelCliente, LocalDate.now().toString())

    /** Siguiente día del ciclo, dando la vuelta al llegar al final. */
    fun siguienteDia(diaRealizado: Int, totalDias: Int): Int {
        require(totalDias > 0) { "totalDias debe ser mayor a 0, fue $totalDias" }
        val siguiente = diaRealizado + 1
        return if (siguiente >= totalDias) 0 else siguiente
    }
}
