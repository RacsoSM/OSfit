package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Calcula rachas de asistencia. Entre semana (lunes-viernes) faltar rompe la racha. El fin de
 * semana es opcional (decisión del entrenador, 2026-10-17): si vino suma, si no vino se salta
 * sin romperla. GEMELO: `web/src/racha.ts` y `functions/src/rachas.ts`.
 */
object RachaCalculator {

    private fun esDiaHabil(fecha: LocalDate): Boolean =
        fecha.dayOfWeek != DayOfWeek.SATURDAY && fecha.dayOfWeek != DayOfWeek.SUNDAY

    /**
     * Fechas que cuentan para la racha: las asistidas y las faltas justificadas
     * ("soborno"), que valen igual que una asistencia. Para todo lo demás
     * (días asistidos, tiempo en el gym, rankings) una falta justificada sigue
     * siendo una falta.
     */
    fun fechasQueCuentan(asistencias: List<Asistencia>): Set<LocalDate> =
        asistencias.filter { it.asistio || it.justificada }.map { LocalDate.parse(it.fecha) }.toSet()

    fun calcularRachaActual(fechasAsistencia: Set<LocalDate>, hoy: LocalDate): Int {
        var fecha = hoy
        // Día de gracia: si hoy es hábil y aún no hay registro, no rompe la racha todavía.
        if (esDiaHabil(fecha) && fecha !in fechasAsistencia) {
            fecha = fecha.minusDays(1)
        }
        var racha = 0
        // Tope de seguridad, igual que en la web y el servidor.
        repeat(3650) {
            if (fecha in fechasAsistencia) {
                racha++
            } else if (esDiaHabil(fecha)) {
                return racha
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
            if (fecha in fechasAsistencia) {
                actual++
                if (actual > mejor) mejor = actual
            } else if (esDiaHabil(fecha)) {
                actual = 0
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
