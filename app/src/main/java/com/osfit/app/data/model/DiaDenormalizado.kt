package com.osfit.app.data.model

/**
 * Resultado de `RutinaProgressCalculator.denormalizar`, guardado en el documento del cliente
 * para que la web no tenga que recalcular el día.
 *
 * No es un documento de Firestore: se guarda desarmado en tres campos de `Cliente`, porque
 * un objeto anidado obligaría a la web a manejar el caso "el mapa existe pero está vacío".
 *
 * @param dia día del ciclo; null si el cliente no tiene rutina asignada.
 * @param fecha fecha ISO a la que corresponde [dia]; null si [dia] es null.
 * @param esAncla true si [dia] viene de una asignación manual y no de una asistencia. Cambia
 *   cómo se interpreta: un ancla vale tal cual mientras no haya asistencias posteriores, una
 *   asistencia vieja significa que le toca el día siguiente.
 */
data class DiaDenormalizado(
    val dia: Int? = null,
    val fecha: String? = null,
    val esAncla: Boolean = false
)
