package com.osfit.app.data.model

/**
 * Una de las variantes de ejercicios de un día del ciclo.
 *
 * Envuelve la lista en un objeto **porque Firestore no admite arreglos anidados**: un
 * `List<List<Ejercicio>>` no se puede guardar, pero un `List<VariacionDia>` sí, porque
 * viaja como un arreglo de mapas. No es indirección de adorno: quitarla rompe la
 * escritura del documento.
 */
data class VariacionDia(
    val ejercicios: List<Ejercicio> = emptyList()
)
