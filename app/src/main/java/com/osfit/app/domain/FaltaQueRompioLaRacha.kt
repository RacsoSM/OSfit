package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia
import java.time.DayOfWeek
import java.time.LocalDate

/**
 * La única falta pasada que el cliente puede justificar desde la web.
 *
 * Acotarlo a una sola fecha es lo que impide que revivir la racha sea "justificar cualquier
 * día de mi historial": se repara la rotura más reciente o no se repara nada.
 *
 * GEMELO: `web/src/faltaRompio.ts`. Si cambia acá, cambia allá.
 */
object FaltaQueRompioLaRacha {

    /** Tope de seguridad: sin él, un dato raro haría girar el bucle para siempre. */
    private const val MAXIMO_DIAS_HACIA_ATRAS = 3650

    private fun esDiaHabil(fecha: LocalDate): Boolean =
        fecha.dayOfWeek != DayOfWeek.SATURDAY && fecha.dayOfWeek != DayOfWeek.SUNDAY

    fun calcular(asistencias: List<Asistencia>, hoy: String): String? {
        // El primer registro es el piso del historial: antes de él el cliente no existía para
        // el gimnasio, así que un día hábil sin registro anterior a esa fecha no es una falta
        // suya y no hay nada que reparar. Sin este piso, un cliente nuevo vería como "falta"
        // el día hábil anterior a su alta.
        val primerRegistro = asistencias.minOfOrNull { LocalDate.parse(it.fecha) } ?: return null
        val cuentan = RachaCalculator.fechasQueCuentan(asistencias)

        // Se camina hacia atrás desde ayer, saltando fines de semana, hasta el primer día
        // hábil que no cuenta: ése es el que cortó la racha. Se sigue caminando por encima de
        // los días que sí cuentan porque la racha viva puede haber arrancado DESPUÉS de la
        // rotura — el caso normal, de hecho: el cliente falta un día y vuelve al siguiente.
        //
        // Empezar en ayer y no en hoy es lo que hace que hoy nunca se devuelva: hoy se
        // justifica por el otro camino, el de "hoy no voy a poder ir".
        var fecha = LocalDate.parse(hoy).minusDays(1)
        var vueltas = 0
        while (!fecha.isBefore(primerRegistro) && vueltas < MAXIMO_DIAS_HACIA_ATRAS) {
            if (esDiaHabil(fecha) && fecha !in cuentan) return fecha.toString()
            fecha = fecha.minusDays(1)
            vueltas++
        }
        return null
    }
}
