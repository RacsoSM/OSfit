package com.osfit.app.video

/**
 * Momento en que el mensaje de la medalla empieza a escribirse, al final de su coreografía:
 * título grupal (0s) → "¡Felicidades! Te ganaste:" (0.5s, tarda ~1.8s) → la medalla entra 1s
 * después de ese texto (3.3s) y tarda 600ms → 2s de pausa. Debe coincidir con el bloque de
 * texto que arma ResumenFrameRenderer.
 */
internal const val MENSAJE_MEDALLA_INICIO_MS = 5_900L

/** Duración de la animación de máquina de escribir del mensaje personalizado de la medalla (2 segundos). */
internal const val DURACION_ANIMACION_MENSAJE_MEDALLA_MS = 2_000L

/** Tiempo que el mensaje queda completo en pantalla antes de que la escena termine. */
private const val MARGEN_LECTURA_MS = 2_000L

data class TramoEscena(val escena: EscenaResumen, val inicioMs: Long, val duracionMs: Long) {
    val finMs: Long get() = inicioMs + duracionMs
}

/**
 * Convierte las escenas en tramos absolutos usando el ritmo del estilo.
 * La ventana no agrega tiempo: adelanta el contenido entrante y congela el saliente.
 * El ritmo predeterminado conserva la ventana original de 600 ms.
 */
class TimelineResumen(escenas: List<EscenaResumen>, val ritmo: RitmoVideo = RitmoVideo.ESTANDAR) {

    init {
        require(escenas.isNotEmpty()) { "El timeline necesita al menos una escena" }
    }

    val tramos: List<TramoEscena> = run {
        var cursor = 0L
        escenas.map { escena ->
            val duracion = duracionParaTipo(escena) + ritmo.extraMs(escena)
            TramoEscena(escena, cursor, duracion).also { cursor += duracion }
        }
    }

    val duracionTotalMs: Long = tramos.last().finMs

    private fun indiceActivo(tiempoGlobalMs: Long): Int =
        tramos.indexOfLast { tiempoGlobalMs >= it.inicioMs }.coerceAtLeast(0)

    fun tramoActivo(tiempoGlobalMs: Long): TramoEscena = tramos[indiceActivo(tiempoGlobalMs)]

    /** Próximo tramo si [tiempoGlobalMs] cae en la ventana previa al cambio de escena; null
     * fuera de esa ventana o si el tramo activo es el último. */
    fun tramoEntrante(tiempoGlobalMs: Long): TramoEscena? {
        val indice = indiceActivo(tiempoGlobalMs)
        if (indice == tramos.lastIndex) return null
        val activo = tramos[indice]
        return if (tiempoGlobalMs >= activo.finMs - ritmo.ventanaTransicionMs) tramos[indice + 1] else null
    }

    /** 0f al empezar la ventana de crossfade, creciendo a 1f al terminarla. Llamar solo si
     * [tramoEntrante] no es null en ese instante. */
    fun alphaEntrante(tiempoGlobalMs: Long): Float {
        val activo = tramoActivo(tiempoGlobalMs)
        val inicioVentana = activo.finMs - ritmo.ventanaTransicionMs
        val transcurrido = (tiempoGlobalMs - inicioVentana).coerceIn(0L, ritmo.ventanaTransicionMs)
        return transcurrido.toFloat() / ritmo.ventanaTransicionMs.toFloat()
    }

    /** Milisegundos transcurridos dentro del contenido propio de [tramo], acotados a
     * [0, tramo.duracionMs]. Si [tramo] no es la primera escena, su reloj arranca una ventana antes
     * de su `inicioMs` de cursor (ver doc de la clase). */
    fun elapsedEnTramo(tramo: TramoEscena, tiempoGlobalMs: Long): Long {
        val esPrimero = tramo.inicioMs == 0L
        val inicioReloj = if (esPrimero) 0L else tramo.inicioMs - ritmo.ventanaTransicionMs
        return (tiempoGlobalMs - inicioReloj).coerceIn(0L, tramo.duracionMs)
    }

    /** t=0 cuando la nube destapa la escena; puede ser negativo mientras está cubierta. */
    fun relojVisible(tramo: TramoEscena, tiempoGlobalMs: Long): Long =
        elapsedEnTramo(tramo, tiempoGlobalMs) -
            if (tramo.inicioMs == 0L) 0L else ritmo.ventanaTransicionMs / 2L

    private fun duracionParaTipo(escena: EscenaResumen): Long = when (escena) {
        is EscenaResumen.Saludo -> 4_000L
        is EscenaResumen.Asistencia -> 6_000L
        // 8s y no 6s como Asistencia: su frase de entrada es larga y la línea de ranking
        // ("...solamente detrás de: <nombres>") necesita más tiempo en pantalla para leerse.
        is EscenaResumen.Tiempo -> 8_000L
        // 7s y no 4s: la dona de días de rutina empieza a aparecer justo cuando termina de
        // escribirse el texto (~2.2s) y necesita quedarse en pantalla un rato para leerse;
        // +2s extra a pedido del trainer sobre los 5s que ya tenía.
        is EscenaResumen.DiaFavorito -> 7_000L
        // 5s y no 4s a pedido del trainer: con 4s la escena cortaba justo cuando la última
        // animación terminaba de cargar.
        is EscenaResumen.RachaMasLarga -> 5_000L
        // Sin mensaje alcanza con MENSAJE_MEDALLA_INICIO_MS (que ya deja 2s para leer el nombre).
        // Con mensaje, se suman 2s de animación de máquina de escribir y 2s de margen de lectura.
        is EscenaResumen.Medalla -> if (escena.mensaje.isBlank()) {
            MENSAJE_MEDALLA_INICIO_MS
        } else {
            MENSAJE_MEDALLA_INICIO_MS +
                DURACION_ANIMACION_MENSAJE_MEDALLA_MS +
                MARGEN_LECTURA_MS
        }
        // Escala con la cantidad porque el contenido en pantalla cambia: con 1 logro es el
        // mismo layout y ritmo que Medalla (título + insignia + mensaje); con 2 o 3, insignias
        // entrando en cascada, cada una con su propio nombre y mensaje (más chicos, pero ya no
        // se omiten). Todo corrido 1s respecto de lo que duraba antes: ahora la escena abre con
        // su propio título ("Logros personales") y recién después entra el resto.
        is EscenaResumen.LogrosPersonales -> when (escena.logros.size) {
            1 -> 7_500L
            2 -> 8_500L
            else -> 10_000L
        }
        // "Gracias por confiar en nosotros" a la velocidad del saludo (~155ms/carácter) tarda
        // ~4.8s en escribirse; se deja 1.2s extra de margen para que quede en pantalla ya completa.
        is EscenaResumen.Despedida -> 6_000L
    }
}
