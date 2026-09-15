package com.osfit.app.data.model

/**
 * Un día del ciclo de rutina.
 *
 * **Invariante: exactamente una de las dos listas está llena.** Si [variaciones] está
 * vacía manda [ejercicios] (el estado de todo lo que existe hoy y de toda plantilla
 * compartida); si tiene contenido manda [variaciones] y [ejercicios] queda vacía. Al
 * crear la primera variación se mueve [ejercicios] a `variaciones[0]` y se vacía, porque
 * una lista que ya nadie lee se queda vieja en silencio y el siguiente que la mire va a
 * creerle. Leer siempre con [com.osfit.app.domain.ejerciciosDe].
 */
data class DiaRutina(
    val nombreDia: String = "",
    val ejercicios: List<Ejercicio> = emptyList(),
    val variaciones: List<VariacionDia> = emptyList()
)
