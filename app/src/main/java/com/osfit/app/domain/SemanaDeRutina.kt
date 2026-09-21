package com.osfit.app.domain

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Aritmética de la semana de entrenamiento, que va de **lunes a domingo** — el mismo
 * criterio que `RachaCalculator.esDiaHabil`.
 *
 * GEMELO: `lunesDe` en `web/src/dia.ts`. Si cambia acá, cambia allá.
 *
 * Devuelve `String` y no `LocalDate` a propósito: todo el resto del dominio compara
 * fechas como texto ISO-8601, y devolver otro tipo obligaría a convertir en cada uso.
 */
object SemanaDeRutina {

    /** Lunes de la semana en la que cae [fecha]. */
    fun lunesDe(fecha: String): String =
        LocalDate.parse(fecha).with(DayOfWeek.MONDAY).toString()

    /**
     * Domingo anterior al lunes de la semana de [fecha].
     *
     * Es la fecha que sirve como ancla del reinicio semanal, y es **domingo y no lunes**
     * porque el ancla es exclusiva: el historial manda estrictamente después de ella, así
     * que fecharla en domingo es lo que hace que la asistencia del lunes ya cuente.
     */
    fun domingoAnterior(fecha: String): String =
        LocalDate.parse(fecha).with(DayOfWeek.MONDAY).minusDays(1).toString()
}
