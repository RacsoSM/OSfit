package com.osfit.app.util

import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * El renglón de la tarjeta "Acceso web": cuántas veces se canjeó su link y cuándo fue la
 * última.
 *
 * Vive aparte y sin nada de Android ni de Firebase para poder testearse en JVM, igual que
 * [EncajeInsignia].
 *
 * Lo que cuenta son **canjes del link**, no personas ni visitas: la página vuelve a canjear
 * en cada carga donde no hay sesión viva, y en el navegador que WhatsApp abre encima eso es
 * siempre. Una recarga suma. Sirve para ver quién usa su página y quién no la ha abierto
 * nunca; no para comparar a una clienta con otra que usa otro navegador.
 */
object TextoEntradas {

    fun resumen(entradas: Long, ultimoAcceso: Instant?, ahora: Instant): String {
        if (entradas <= 0) return "Todavía no ha abierto su página"
        val veces = if (entradas == 1L) "1 entrada" else "$entradas entradas"
        // Sin marca no se dice cuándo: los accesos anteriores al contador tienen el número
        // pero no la fecha, y poner "hoy" por defecto sería inventarla.
        val cuando = ultimoAcceso?.let { " · ${haceCuanto(it, ahora)}" } ?: ""
        return "$veces$cuando"
    }

    private fun haceCuanto(momento: Instant, ahora: Instant): String {
        val dias = ChronoUnit.DAYS.between(momento, ahora)
        return when {
            dias <= 0L -> "hoy"
            dias == 1L -> "ayer"
            else -> "hace $dias días"
        }
    }
}
