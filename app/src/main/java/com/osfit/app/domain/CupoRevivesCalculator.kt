package com.osfit.app.domain

import com.osfit.app.data.model.Asistencia

/**
 * Cupo mensual de revives del cliente.
 *
 * No hay contador en ningún lado: se cuenta consultando las asistencias del mes. Se prefiere
 * contar antes que mantener un contador porque si el entrenador desmarca una justificada
 * desde su app, el cupo se le devuelve al cliente solo; un contador se quedaría viejo y
 * habría que acordarse de corregirlo en un lugar que nadie mira.
 *
 * GEMELO: `web/src/cupo.ts`. Si cambia acá, cambia allá.
 */
object CupoRevivesCalculator {

    const val MAXIMO_POR_MES = 3

    /**
     * [mes] en formato `AAAA-MM`. Las fechas son strings ISO, así que comparar por prefijo
     * es exacto y no necesita parsear nada.
     *
     * Exige las dos banderas: `justificadaPorCliente` marca quién la pidió, y `justificada`
     * si sigue vigente. El entrenador puede desmarcar la segunda sin borrar la primera, y en
     * ese caso el revive no debe seguir contando como gastado.
     */
    fun gastadosEnElMes(asistencias: List<Asistencia>, mes: String): Int =
        asistencias.count {
            it.justificadaPorCliente && it.justificada && it.fecha.startsWith("$mes-")
        }

    fun disponiblesEnElMes(asistencias: List<Asistencia>, mes: String): Int =
        (MAXIMO_POR_MES - gastadosEnElMes(asistencias, mes)).coerceAtLeast(0)
}
