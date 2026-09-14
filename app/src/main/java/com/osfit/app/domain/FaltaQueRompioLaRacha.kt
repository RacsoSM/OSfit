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
 * GEMELOS: `web/src/faltaRompio.ts` y `functions/src/faltaRompio.ts`. Son tres copias del mismo
 * algoritmo: si cambia acá, cambia en las otras dos.
 */
object FaltaQueRompioLaRacha {

    /**
     * Ventana de reparación: los 2 días **hábiles** anteriores a hoy. Una rotura más vieja ya
     * no se puede revivir.
     *
     * Hábiles y no 48 horas de reloj, y la diferencia importa justo en el caso más común. La
     * página no dibuja acciones en fin de semana (no hay nada que proteger: la racha solo
     * cuenta días hábiles), así que con horas de reloj una falta del viernes vencería el
     * domingo — sin que el cliente hubiera tenido nunca un botón que tocar. Contando hábiles,
     * el lunes el viernes sigue siendo "el día hábil anterior" y todavía se repara.
     */
    private const val DIAS_HABILES_REPARABLES = 2

    private fun esDiaHabil(fecha: LocalDate): Boolean =
        fecha.dayOfWeek != DayOfWeek.SATURDAY && fecha.dayOfWeek != DayOfWeek.SUNDAY

    fun calcular(asistencias: List<Asistencia>, hoy: String): String? {
        // El primer registro es el piso del historial: antes de él el cliente no existía para
        // el gimnasio, así que un día hábil sin registro anterior a esa fecha no es una falta
        // suya y no hay nada que reparar. Sin este piso, un cliente nuevo vería como "falta"
        // los días hábiles anteriores a su alta.
        val primerRegistro = asistencias.minOfOrNull { LocalDate.parse(it.fecha) } ?: return null
        val cuentan = RachaCalculator.fechasQueCuentan(asistencias)

        // Se camina hacia atrás desde ayer, saltando fines de semana, y se miran solo los
        // DIAS_HABILES_REPARABLES más recientes. El primero de ellos que no cuente es el que
        // cortó la racha y es el reparable; si los dos cuentan, o si la rotura quedó más
        // atrás, no hay nada que ofrecer.
        //
        // Empezar en ayer y no en hoy es lo que hace que hoy nunca se devuelva: hoy se
        // justifica por el otro camino, el de "hoy no voy a poder ir".
        var fecha = LocalDate.parse(hoy).minusDays(1)
        var habilesExaminados = 0
        while (habilesExaminados < DIAS_HABILES_REPARABLES && !fecha.isBefore(primerRegistro)) {
            if (esDiaHabil(fecha)) {
                habilesExaminados++
                if (fecha !in cuentan) return fecha.toString()
            }
            fecha = fecha.minusDays(1)
        }
        return null
    }
}
