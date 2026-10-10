package com.osfit.app.util

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * El renglón de la tarjeta "Acceso web": cuántas veces se canjeó su link y cuándo fue la
 * última.
 *
 * Vive aparte y sin nada de Android ni de Firebase para poder testearse en JVM, igual que
 * [EncajeInsignia].
 *
 * Lo que cuenta son **aperturas de la página**, no personas: la página avisa a la función
 * `registrarEntrada` cada vez que carga, así que una recarga suma. Sirve para ver quién usa
 * su página y quién no la ha abierto nunca.
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

    /**
     * El renglón de una clienta a la que se le revocó el acceso, para no confundir "nunca le
     * compartí" con "se lo quité". La fecha va en la zona del gimnasio, no la del teléfono.
     */
    fun revocado(momento: Instant, zona: ZoneId): String =
        "Acceso revocado el " + FECHA.format(momento.atZone(zona))

    private val FECHA: DateTimeFormatter =
        DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale.forLanguageTag("es-MX"))

    /**
     * Un renglón de "Últimas entradas": "10 oct, 7:42 pm · iPhone". La hora va en la zona del
     * gimnasio. Se arma a mano y no con `DateTimeFormatter`, que en español escribe "p.m." y,
     * según la versión de Java, "oct." con punto.
     */
    fun entrada(cuando: Instant?, plataforma: String, zona: ZoneId): String {
        val telefono = when (plataforma) {
            "ios" -> "iPhone"
            "android" -> "Android"
            else -> "Otro dispositivo"
        }
        if (cuando == null) return "Sin hora · $telefono"
        val local = cuando.atZone(zona)
        val hora12 = (local.hour % 12).let { if (it == 0) 12 else it }
        val minutos = local.minute.toString().padStart(2, '0')
        val mediodia = if (local.hour < 12) "am" else "pm"
        val mes = MESES[local.monthValue - 1]
        return "${local.dayOfMonth} $mes, $hora12:$minutos $mediodia · $telefono"
    }

    private val MESES = listOf(
        "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"
    )

    private fun haceCuanto(momento: Instant, ahora: Instant): String {
        val dias = ChronoUnit.DAYS.between(momento, ahora)
        return when {
            dias <= 0L -> "hoy"
            dias == 1L -> "ayer"
            else -> "hace $dias días"
        }
    }
}
