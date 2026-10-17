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
 *
 * Desde la ruleta (2026-09-18) el máximo del mes ya no es fijo: perder la ruleta un mes le
 * quita un revive al siguiente. El castigo tampoco se guarda como número — se deduce del
 * documento `ruletas/{cliente}_{mes anterior}`, así que borrar ese documento devuelve el cupo
 * solo, igual que desmarcar una justificada.
 */
object CupoRevivesCalculator {

    const val MAXIMO_POR_MES = 3

    /**
     * Quien alguna vez llegó a esta racha tiene un revive más al mes, para siempre: aunque la
     * racha se rompa después (entrenador, 2026-10-17). Tampoco se guarda: sale de la racha más
     * larga de su historial, así que si el entrenador corrige asistencias se corrige solo.
     *
     * GEMELO: `maximoPorMes` en `web/src/cupo.ts` y `maximoDeRevives` en
     * `functions/src/jugarRuleta.ts`.
     */
    const val RACHA_PARA_REVIVE_EXTRA = 30

    /**
     * Si tiene el revive extra (y la llama azul): llegó alguna vez a una racha de 30, o el
     * entrenador se lo dio a mano con [otorgado] (`Cliente.reviveExtraOtorgado`).
     */
    fun tieneReviveExtra(asistencias: List<Asistencia>, otorgado: Boolean = false): Boolean =
        otorgado ||
            RachaCalculator.calcularRachaMasLarga(RachaCalculator.fechasQueCuentan(asistencias)) >=
            RACHA_PARA_REVIVE_EXTRA

    /** 3 al mes, o 4 con el revive extra. Antes del castigo de la ruleta, que se le resta a este. */
    fun maximoPorMes(asistencias: List<Asistencia>, otorgado: Boolean = false): Int =
        MAXIMO_POR_MES + if (tieneReviveExtra(asistencias, otorgado)) 1 else 0

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

    /**
     * [castigo] son los revives que el cliente perdió por fallar la ruleta el mes pasado
     * (0 o 1). Entra como parámetro y no se lee acá: este objeto es puro y se prueba en la
     * JVM, sin Firestore. Quien lo llama ya tiene el documento de la tirada.
     */
    fun disponiblesEnElMes(
        asistencias: List<Asistencia>,
        mes: String,
        castigo: Int = 0,
        otorgado: Boolean = false
    ): Int = (maximoPorMes(asistencias, otorgado) - castigo - gastadosEnElMes(asistencias, mes)).coerceAtLeast(0)
}
