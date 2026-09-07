package com.osfit.app.video

private const val CROSSFADE_MS = 600L

data class TramoEscena(val escena: EscenaResumen, val inicioMs: Long, val duracionMs: Long) {
    val finMs: Long get() = inicioMs + duracionMs
}

/**
 * Timeline global del video: convierte la lista ordenada de [EscenaResumen] en tramos con
 * tiempos absolutos, y resuelve el crossfade de 600ms entre escenas consecutivas.
 *
 * El crossfade no agrega tiempo: los últimos 600ms de cursor de una escena son, a la vez, los
 * primeros 600ms del reloj de contenido de la escena siguiente, que arranca 600ms antes de su
 * propio `inicioMs` de cursor. Así la escena entrante ya está animando cuando alcanza opacidad
 * completa exactamente en el borde de cursor, y la saliente ya terminó su contenido (elapsed
 * llega a su `duracionMs` tope justo 600ms antes de ese borde) así que se ve congelada mientras
 * se desvanece.
 */
class TimelineResumen(escenas: List<EscenaResumen>) {

    init {
        require(escenas.isNotEmpty()) { "El timeline necesita al menos una escena" }
    }

    val tramos: List<TramoEscena> = run {
        var cursor = 0L
        escenas.map { escena ->
            val duracion = duracionParaTipo(escena)
            TramoEscena(escena, cursor, duracion).also { cursor += duracion }
        }
    }

    val duracionTotalMs: Long = tramos.last().finMs

    private fun indiceActivo(tiempoGlobalMs: Long): Int =
        tramos.indexOfLast { tiempoGlobalMs >= it.inicioMs }.coerceAtLeast(0)

    fun tramoActivo(tiempoGlobalMs: Long): TramoEscena = tramos[indiceActivo(tiempoGlobalMs)]

    /** Próximo tramo si [tiempoGlobalMs] cae en los 600ms previos al cambio de escena; null
     * fuera de esa ventana o si el tramo activo es el último. */
    fun tramoEntrante(tiempoGlobalMs: Long): TramoEscena? {
        val indice = indiceActivo(tiempoGlobalMs)
        if (indice == tramos.lastIndex) return null
        val activo = tramos[indice]
        return if (tiempoGlobalMs >= activo.finMs - CROSSFADE_MS) tramos[indice + 1] else null
    }

    /** 0f al empezar la ventana de crossfade, creciendo a 1f al terminarla. Llamar solo si
     * [tramoEntrante] no es null en ese instante. */
    fun alphaEntrante(tiempoGlobalMs: Long): Float {
        val activo = tramoActivo(tiempoGlobalMs)
        val inicioVentana = activo.finMs - CROSSFADE_MS
        val transcurrido = (tiempoGlobalMs - inicioVentana).coerceIn(0L, CROSSFADE_MS)
        return transcurrido.toFloat() / CROSSFADE_MS.toFloat()
    }

    /** Milisegundos transcurridos dentro del contenido propio de [tramo], acotados a
     * [0, tramo.duracionMs]. Si [tramo] no es la primera escena, su reloj arranca 600ms antes
     * de su `inicioMs` de cursor (ver doc de la clase). */
    fun elapsedEnTramo(tramo: TramoEscena, tiempoGlobalMs: Long): Long {
        val esPrimero = tramo.inicioMs == 0L
        val inicioReloj = if (esPrimero) 0L else tramo.inicioMs - CROSSFADE_MS
        return (tiempoGlobalMs - inicioReloj).coerceIn(0L, tramo.duracionMs)
    }

    private fun duracionParaTipo(escena: EscenaResumen): Long = when (escena) {
        is EscenaResumen.Saludo -> 3_000L
        is EscenaResumen.Asistencia -> 6_000L
        // 8s y no 6s como Asistencia: su frase de entrada es larga y la línea de ranking
        // ("...solamente detrás de: <nombres>") necesita más tiempo en pantalla para leerse.
        is EscenaResumen.Tiempo -> 8_000L
        // 10.5s y no 8s como Tiempo: además de la línea del porcentaje carga la línea de
        // "no te espantes" 500ms después de que esa termine de escribirse (con un texto de
        // entrenando/descansando largo esa cola puede llegar a los ~8.4s), más 1s extra a
        // pedido del trainer para que la escena no corte justo cuando termina de animarse.
        is EscenaResumen.Esfuerzo -> 10_500L
        // 7s y no 4s: la dona de días de rutina empieza a aparecer justo cuando termina de
        // escribirse el texto (~2.2s) y necesita quedarse en pantalla un rato para leerse;
        // +2s extra a pedido del trainer sobre los 5s que ya tenía.
        is EscenaResumen.DiaFavorito -> 7_000L
        is EscenaResumen.RachaMasLarga -> 4_000L
        // 6.5s: el título ("¡Felicidades! Te ganaste:") tarda ~1.8s en escribirse, la imagen
        // hace fade 600ms después, y el resto es tiempo para que se lea el nombre de la medalla.
        is EscenaResumen.Medalla -> 6_500L
        // Escala con la cantidad porque el contenido en pantalla cambia: con 1 logro es el
        // mismo layout y ritmo que Medalla (título + insignia + mensaje); con 2 o 3 no hay
        // mensaje que leer, pero sí insignias entrando en cascada (la tercera recién a los
        // ~3.2s) y varios nombres.
        is EscenaResumen.LogrosPersonales -> when (escena.logros.size) {
            1 -> 6_500L
            2 -> 7_500L
            else -> 9_000L
        }
        // "Gracias por confiar en nosotros" a la velocidad del saludo (~155ms/carácter) tarda
        // ~4.8s en escribirse; se deja 1.2s extra de margen para que quede en pantalla ya completa.
        is EscenaResumen.Despedida -> 6_000L
    }
}
