package com.osfit.app.domain

import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio

/**
 * Los ejercicios que toca hacer en [dia] con la variación [variacion].
 *
 * Aplica el invariante de [DiaRutina]: sin variaciones manda la lista base y el índice da
 * igual. El índice se **acota** en vez de reventar porque el documento se puede editar
 * entre que la variación se calculó y que se lee: el entrenador quita una variación y el
 * índice guardado queda apuntando fuera.
 */
fun ejerciciosDe(dia: DiaRutina, variacion: Int): List<Ejercicio> {
    if (dia.variaciones.isEmpty()) return dia.ejercicios
    return dia.variaciones[variacion.coerceIn(0, dia.variaciones.size - 1)].ejercicios
}

/** Cuántas variaciones tiene el día. 0 = se comporta como siempre, con la lista base. */
fun totalVariaciones(dia: DiaRutina?): Int = dia?.variaciones?.size ?: 0
