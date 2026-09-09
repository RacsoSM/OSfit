package com.osfit.app.domain

import java.time.LocalDate

/**
 * Las quincenas son deterministas (días 1-15 y 16-fin de mes), así que la lista de periodos se
 * calcula del calendario y no de la base: no hace falta consultar nada para saber qué
 * quincenas existen.
 *
 * Delega en [ResumenClienteCalculator.rangoQuincenal] para que los encabezados sean
 * exactamente los mismos que muestra el resumen.
 */
object PeriodosQuincenales {

    /**
     * La quincena siguiente a la de [hoy], la de [hoy], y [haciaAtras] anteriores — de más
     * nueva a más vieja. Incluye la siguiente para poder dejar la paleta lista antes de que
     * arranque el periodo.
     */
    fun ultimos(hoy: LocalDate, haciaAtras: Int = 12): List<RangoResumen> {
        val periodos = mutableListOf<RangoResumen>()
        var referencia = ResumenClienteCalculator.rangoQuincenal(hoy).fin.plusDays(1)
        repeat(haciaAtras + 1) {
            val rango = ResumenClienteCalculator.rangoQuincenal(referencia)
            periodos += rango
            referencia = rango.inicio.minusDays(1)
        }
        return periodos
    }
}
