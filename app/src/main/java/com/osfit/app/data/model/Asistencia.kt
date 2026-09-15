package com.osfit.app.data.model

import com.google.firebase.Timestamp

data class Asistencia(
    val id: String = "",
    val clienteId: String = "",
    val fecha: String = "",
    val asistio: Boolean = false,
    /** Falta justificada ("soborno"): no asistió, pero cuenta para la racha. */
    val justificada: Boolean = false,
    /** La justificó el cliente desde la web (no el entrenador). Solo estas gastan su cupo. */
    val justificadaPorCliente: Boolean = false,
    val diaRutinaRealizado: Int? = null,
    /**
     * Qué variación de ese día se hizo. **Es el registro de lo que pasó, no un contador
     * mutable** — la misma naturaleza que [diaRutinaRealizado], que vive aquí al lado. De él
     * deriva `VariacionCalculator` la que toca la próxima vez.
     *
     * Nulo en todo lo anterior al 2026-09-15 y en los días sin variaciones; vale 0.
     */
    val variacionRealizada: Int? = null,
    val nota: String = "",
    val horaLlegada: Timestamp? = null,
    val horaSalida: Timestamp? = null,
    val duracionMinutos: Int? = null
)
