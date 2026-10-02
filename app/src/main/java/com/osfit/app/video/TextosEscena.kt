package com.osfit.app.video

import com.osfit.app.domain.RankingResultado

internal object TextosEscena {
    const val SALUDO_PREFIJO = "Hola, "
    const val DESPEDIDA = "Gracias por confiar en nosotros"
    const val TIEMPO_PREFIJO = "Estuviste en el poderoso Focus un total de"
    const val TIEMPO_PRIMERO = "¡Vas primero en tiempo asistido!"
    const val TIEMPO_LUGAR = "tiempo asistido"
    const val RACHA_PREFIJO = "Tu racha más larga fue de"
    const val RACHA_PRIMERO = "¡Vas primero en racha este mes!"
    const val RACHA_LUGAR = "racha"
    const val MEDALLA_PREFIJO = "¡Felicidades! Te ganaste:"
    const val LOGROS_PREFIJO = "Y contra ti mismo, lograste:"
    const val TITULO_GRUPAL = "Logros grupales"
    const val TITULO_PERSONAL = "Logros personales"

    fun determinante(unidad: String, mayuscula: Boolean = false): String {
        val base = if (unidad == "mes") "este" else "esta"
        return if (mayuscula) base.replaceFirstChar { it.uppercase() } else base
    }

    fun asistenciaPrefijo(e: EscenaResumen.Asistencia): String =
        "${determinante(e.unidad, mayuscula = true)} ${e.unidad} asististe "
    fun asistenciaDias(e: EscenaResumen.Asistencia): String = "${e.dias} días"
    fun asistenciaSufijo(e: EscenaResumen.Asistencia): String = " de ${e.diasHabiles} días hábiles"
    fun tiempoDuracion(minutos: Int): String = "${minutos / 60}h ${minutos % 60}min"
    fun rachaDias(dias: Int): String = "${dias} días seguidos"

    // La frase del primer lugar es específica de cada escena; no se deriva de su etiqueta.
    fun comparacion(ranking: RankingResultado, fraseVasPrimero: String, etiquetaLugar: String): String =
        if (ranking.nombresPorEncima.isEmpty()) {
            fraseVasPrimero
        } else {
            "Estás en el lugar ${ranking.puesto} de $etiquetaLugar, solamente detrás de: " +
                ranking.nombresPorEncima.joinToString(", ")
        }

    fun mensajeDiaFavorito(t: EscenaResumen.DiaFavorito): String = when {
        t.nombreDia != null -> "Tu día favorito fue ${t.nombreDia}"
        t.diasAsistidos == 0 ->
            "${determinante(t.unidad, mayuscula = true)} ${t.unidad} no viniste, ¡te esperamos la próxima!"
        else -> "¡Sigue registrando tu día de rutina para descubrir cuál es tu favorito!"
    }
}
