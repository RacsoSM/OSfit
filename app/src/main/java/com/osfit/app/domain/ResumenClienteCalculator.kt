package com.osfit.app.domain

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

enum class TipoResumen { SEMANAL, MENSUAL }

data class RangoResumen(
    val inicio: LocalDate,
    val fin: LocalDate,
    val tipo: TipoResumen,
    val encabezado: String
)

/**
 * Calcula el resumen de estadísticas de un cliente (asistencia, tiempo en el gym,
 * día favorito, racha) comparado contra los demás clientes activos, para un rango
 * de fechas dado. La misma máquina sirve tanto para el resumen semanal como el
 * mensual: solo cambia el [RangoResumen] que se le pasa.
 */
object ResumenClienteCalculator {

    fun numeroSemanaDelMes(fecha: LocalDate): Int {
        var contador = 0
        var dia = fecha.withDayOfMonth(1)
        while (!dia.isAfter(fecha)) {
            if (dia.dayOfWeek == DayOfWeek.FRIDAY) contador++
            dia = dia.plusDays(1)
        }
        return contador.coerceAtLeast(1)
    }

    fun rangoSemanal(fechaReferencia: LocalDate): RangoResumen {
        val lunes = fechaReferencia.minusDays((fechaReferencia.dayOfWeek.value - DayOfWeek.MONDAY.value).toLong())
        val viernes = lunes.plusDays(4)
        val nombreMes = viernes.month.getDisplayName(TextStyle.FULL, Locale("es"))
        return RangoResumen(
            inicio = lunes,
            fin = viernes,
            tipo = TipoResumen.SEMANAL,
            encabezado = "Semana ${numeroSemanaDelMes(viernes)} de $nombreMes"
        )
    }

    fun rangoMensual(mes: YearMonth): RangoResumen {
        val nombreMes = mes.month.getDisplayName(TextStyle.FULL, Locale("es"))
        return RangoResumen(
            inicio = mes.atDay(1),
            fin = mes.atEndOfMonth(),
            tipo = TipoResumen.MENSUAL,
            encabezado = "Mes de $nombreMes"
        )
    }
}
