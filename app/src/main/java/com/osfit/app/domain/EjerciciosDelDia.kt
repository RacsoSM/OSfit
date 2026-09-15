package com.osfit.app.domain

import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import com.osfit.app.data.model.VariacionDia

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

/**
 * Agrega una variación al día, respetando el invariante de [DiaRutina].
 *
 * Desde un día sin variaciones hace falta crear **dos**: la lista base pasa a ser la primera y
 * la nueva es la segunda. Una sola variación no rotaría a ningún lado, así que el primer
 * "Agregar variación" tiene que dejar dos o el botón no haría nada visible.
 *
 * Vive en `domain/` y no en una pantalla porque desde el 2026-09-15 lo usan **dos** editores
 * —el de la rutina propia de una clienta y el de las plantillas— y el invariante sólo puede
 * tener una casa: dos copias se separan y dejan documentos con las dos listas llenas.
 */
fun conVariacionNueva(dia: DiaRutina): DiaRutina = if (dia.variaciones.isEmpty()) {
    dia.copy(
        ejercicios = emptyList(),
        variaciones = listOf(VariacionDia(dia.ejercicios), VariacionDia())
    )
} else {
    dia.copy(variaciones = dia.variaciones + VariacionDia())
}

/**
 * Quita la última variación. Al bajar a una sola se deshace el camino de [conVariacionNueva]:
 * sus ejercicios vuelven a la lista base y `variaciones` queda vacía, porque una lista que ya
 * nadie lee se queda vieja en silencio y el siguiente que la mire va a creerle.
 */
fun sinLaUltimaVariacion(dia: DiaRutina): DiaRutina = when (dia.variaciones.size) {
    0 -> dia
    1, 2 -> dia.copy(
        ejercicios = dia.variaciones.first().ejercicios,
        variaciones = emptyList()
    )
    else -> dia.copy(variaciones = dia.variaciones.dropLast(1))
}

/** Etiqueta de una variación: A, B, C… Nunca la ve la clienta, sólo el entrenador. */
fun etiquetaVariacion(indice: Int): String = ('A' + indice).toString()
