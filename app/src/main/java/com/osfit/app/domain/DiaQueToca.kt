package com.osfit.app.domain

/**
 * Lo que le toca hoy a un cliente.
 *
 * Es un tipo y no un `Int` porque desde el reinicio semanal hay un tercer caso real —la
 * semana ya está completa— y un entero no puede decirlo sin inventarse un valor centinela.
 * Al ser sellado, el compilador obliga a que cada pantalla decida qué hace con él en vez
 * de dejar que un caso nuevo se cuele en silencio.
 *
 * Es **solo el resultado del cálculo**. Lo que se guarda en una asistencia no cambia: una
 * asistencia con `asistio = true` y `diaRutinaRealizado = null` ya significaba hoy "vino
 * pero esto no mueve el ciclo", y sigue significando eso.
 */
sealed interface DiaQueToca {

    /** Índice dentro de `rutinaAsignada.dias`. La UI muestra `indice + 1`. */
    data class Dia(val indice: Int) : DiaQueToca

    /**
     * Ya completó el ciclo de esta semana: hoy no hay día que darle.
     * Solo puede ocurrir con [com.osfit.app.data.model.Rutina.reinicioSemanal].
     */
    data object Descanso : DiaQueToca

    /** El cliente no tiene rutina asignada, o la tiene sin días. */
    data object SinRutina : DiaQueToca
}
