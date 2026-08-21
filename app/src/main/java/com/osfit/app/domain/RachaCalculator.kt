package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Calcula rachas de asistencia contando solo días hábiles (lunes-viernes).
 * Los fines de semana ni suman ni rompen la racha.
 */
object RachaCalculator {

    private fun esDiaHabil(fecha: LocalDate): Boolean =
        fecha.dayOfWeek != DayOfWeek.SATURDAY && fecha.dayOfWeek != DayOfWeek.SUNDAY

    fun calcularRachaActual(fechasAsistencia: Set<LocalDate>, hoy: LocalDate): Int {
        var fecha = hoy
        // Día de gracia: si hoy es hábil y aún no hay registro, no rompe la racha todavía.
        if (esDiaHabil(fecha) && fecha !in fechasAsistencia) {
            fecha = fecha.minusDays(1)
        }
        var racha = 0
        while (true) {
            if (esDiaHabil(fecha)) {
                if (fecha in fechasAsistencia) {
                    racha++
                } else {
                    break
                }
            }
            fecha = fecha.minusDays(1)
        }
        return racha
    }

    fun calcularRachaMasLarga(fechasAsistencia: Set<LocalDate>): Int {
        if (fechasAsistencia.isEmpty()) return 0
        return calcularRachaMasLargaEnRango(fechasAsistencia, fechasAsistencia.min(), fechasAsistencia.max())
    }

    fun calcularRachaMasLargaEnRango(fechasAsistencia: Set<LocalDate>, inicio: LocalDate, fin: LocalDate): Int {
        var mejor = 0
        var actual = 0
        var fecha = inicio
        while (!fecha.isAfter(fin)) {
            if (esDiaHabil(fecha)) {
                if (fecha in fechasAsistencia) {
                    actual++
                    if (actual > mejor) mejor = actual
                } else {
                    actual = 0
                }
            }
            fecha = fecha.plusDays(1)
        }
        return mejor
    }

    fun diasTotalesAsistidos(asistencias: List<Asistencia>): Int =
        asistencias.count { it.asistio }

    fun diaFavorito(asistencias: List<Asistencia>): Int? =
        asistencias.mapNotNull { it.diaRutinaRealizado }
            .groupingBy { it }
            .eachCount()
            .maxByOrNull { it.value }
            ?.key

    fun diasDesdeIngreso(fechaIngreso: LocalDate, hoy: LocalDate): Int =
        ChronoUnit.DAYS.between(fechaIngreso, hoy).toInt()
}
